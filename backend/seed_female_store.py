import asyncio
import os
import uuid
import torch
import numpy as np
from transformers import CLIPModel, CLIPProcessor
from motor.motor_asyncio import AsyncIOMotorClient
from PIL import Image
from io import BytesIO
from dotenv import load_dotenv
from pathlib import Path
from sklearn.cluster import KMeans
import random

# Load env
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Config
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/')
DB_NAME = os.environ.get('DB_NAME', 'fashion_stylist')

# Model Initialization
device = "cuda" if torch.cuda.is_available() else "cpu"
model = CLIPModel.from_pretrained("patrickjohncyh/fashion-clip").to(device)
processor = CLIPProcessor.from_pretrained("patrickjohncyh/fashion-clip")
model.eval()

# Constants
TOPS = ["t-shirt", "shirt", "hoodie", "jacket", "top", "blouse", "crop top"]
BOTTOMS = ["jeans", "trousers", "shorts", "pants", "skirt", "leggings"]
SHOES = ["shoes", "sneakers", "sandals", "footwear", "heels", "flats", "boots"]
ACCESSORIES = ["accessory", "belt", "bracelet", "watch", "handbag", "scarf"]
DRESSES = ["dress", "gown"]

CATEGORIES = TOPS + BOTTOMS + SHOES + ACCESSORIES + DRESSES
STYLES = ["casual", "formal", "sporty", "streetwear", "party wear", "ethnic"]
PATTERNS = ["plain", "striped", "checked", "floral", "printed"]

CATEGORY_MAP = {
    "tops": "shirt",
    "bottoms": "trousers",
    "shoes": "shoes",
    "accessories": "accessory",
    "dresses": "dress",
    "outerwear": "jacket"
}

# --- AI Helpers (Mirrored from server.py) ---
def crop_center(image):
    w, h = image.size
    return image.crop((w*0.25, h*0.25, w*0.75, h*0.75))

def map_rgb_to_color_name(r, g, b):
    if r < 50 and g < 50 and b < 50:
        return "black"
    if r > 200 and g > 200 and b > 200:
        return "white"
    if r > 150 and g < 100 and b < 100:
        return "red"
    if b > 150 and r < 100:
        return "blue"
    if g > 150 and r < 100:
        return "green"
    if r > 150 and g > 150 and b < 100:
        return "yellow"
    if r > 150 and b > 150:
        return "pink"
    if r > 100 and g > 100 and b > 100:
        return "grey"
    return "multi-color"

def extract_dominant_color(image):
    try:
        image = crop_center(image)
        image = image.resize((100, 100))
        img_array = np.array(image)
        pixels = img_array.reshape((-1, 3))
        
        # Remove dark noise
        pixels = pixels[np.sum(pixels, axis=1) > 30]
        if len(pixels) == 0:
            return "black"
            
        kmeans = KMeans(n_clusters=3, n_init=10)
        kmeans.fit(pixels)
        
        counts = np.bincount(kmeans.labels_)
        dominant = kmeans.cluster_centers_[counts.argmax()]
        r, g, b = dominant.astype(int)
        
        return map_rgb_to_color_name(r, g, b)
    except Exception:
        return "multi-color"

def get_attributes(image):
    try:
        results = {}
        # Zero-shot CLIP for attributes
        for label_set, key in [(CATEGORIES, "category"), (STYLES, "style"), (PATTERNS, "pattern")]:
            prompts = [f"a photo of a {label} clothing" for label in label_set]
            with torch.no_grad():
                inputs = processor(text=prompts, images=image, return_tensors="pt", padding=True).to(device)
                outputs = model(**inputs)
                probs = outputs.logits_per_image.softmax(dim=1)
                best_idx = probs.argmax().item()
                results[key] = label_set[best_idx]
        return results
    except Exception as e:
        print(f"AI analysis error: {e}")
        return {
            "category": "t-shirt",
            "style": "casual",
            "pattern": "plain"
        }

def get_image_embedding(image):
    with torch.no_grad():
        inputs = processor(images=image, return_tensors="pt").to(device)
        outputs = model.get_image_features(**inputs)
        if hasattr(outputs, "image_embeds"):
            emb = outputs.image_embeds
        elif hasattr(outputs, "pooler_output"):
            emb = outputs.pooler_output
        elif isinstance(outputs, torch.Tensor):
            emb = outputs
        else:
            emb = outputs[0] if isinstance(outputs, (list, tuple)) else outputs
            
        emb = emb / emb.norm(p=2, dim=-1, keepdim=True)
    return emb

def load_dataset_images():
    dataset_path = ROOT_DIR / "dataset2"
    if not dataset_path.exists():
        print(f"Error: Dataset path {dataset_path} does not exist.")
        return []

    images_to_process = []
    
    # Traverse dataset folder
    for root, dirs, files in os.walk(dataset_path):
        for file in files:
            if file.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.avif')):
                img_path = os.path.join(root, file)
                
                # Determine category and subcategory from path
                relative_root = os.path.relpath(root, dataset_path)
                parts = relative_root.split(os.sep)
                
                raw_cat = parts[0]
                # Default mapping for known folders, but we'll use CLIP to refine it
                base_category = CATEGORY_MAP.get(raw_cat, raw_cat)
                
                subcategory = None
                if raw_cat == "accessories" and len(parts) > 1:
                    subcategory = parts[1].rstrip('s') # belts -> belt
                elif raw_cat in ["belts", "bracelets", "watches"]:
                    base_category = "accessory"
                    subcategory = raw_cat.rstrip('s')

                try:
                    img = Image.open(img_path)
                    if img.mode != 'RGB':
                        img = img.convert('RGB')
                    images_to_process.append((img, base_category, subcategory, img_path))
                except Exception as e:
                    print(f"Skipping corrupted image {img_path}: {e}")
                    
    return images_to_process

async def seed_db():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print(f"Connecting to {DB_NAME}...")
    
    # Clear existing female store items
    await db.female_store_items.delete_many({})
    
    dataset_images = load_dataset_images()
    if not dataset_images:
        print("No images found in dataset2. Seeding aborted.")
        return

    print(f"Processing {len(dataset_images)} images from dataset2...")
    
    items = []
    for img, base_cat, subcat, img_path in dataset_images:
        # Generate attributes using CLIP
        attrs = get_attributes(img)
        
        # Use CLIP-predicted category but respect the top-level folder (tops/bottoms)
        # to ensure it stays in a reasonable group
        predicted_cat = attrs.get("category", base_cat)
        
        # Validate category based on top-level folder
        if base_cat == "shirt" and predicted_cat not in TOPS:
            category = "shirt" # Fallback
        elif base_cat == "trousers" and predicted_cat not in BOTTOMS:
            category = "trousers" # Fallback
        elif base_cat == "shoes" and predicted_cat not in SHOES:
            category = "shoes" # Fallback
        else:
            category = predicted_cat

        # Generate embedding
        emb = get_image_embedding(img)
        embedding = emb.cpu().numpy().tolist()[0]
        
        # Color extraction
        color = extract_dominant_color(img)
        
        # URL conversion
        path_obj = Path(img_path)
        parts = path_obj.parts
        try:
            dataset_idx = parts.index("dataset2")
            relative_path = "/".join(parts[dataset_idx+1:])
        except ValueError:
            relative_path = os.path.basename(img_path)
            
        image_url = f"/images2/{relative_path}"
        
        # Randomly assign a store name for variety
        store_name = random.choice(["Amazon", "Flipkart", "Myntra", "Zara", "H&M"])
        
        item = {
            "product_id": f"prod_fem_{uuid.uuid4().hex[:12]}",
            "name": f"{color.capitalize()} {category.capitalize()}" + (f" ({subcat})" if subcat else ""),
            "category": category,
            "subcategory": subcat,
            "color": color,
            "style": attrs.get("style", "casual"),
            "pattern": attrs.get("pattern", "plain"),
            "price": random.randint(500, 4500),
            "embedding": embedding,
            "image_url": image_url,
            "store": store_name,
            "gender": "female"
        }
        items.append(item)
        
    if items:
        await db.female_store_items.insert_many(items)
        print(f"Successfully seeded {len(items)} items into female_store_items collection.")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(seed_db())
