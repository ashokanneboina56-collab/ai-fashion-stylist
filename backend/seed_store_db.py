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
CATEGORY_MAP = {
    "shirts": "shirt",
    "pants": "trousers",
    "shoes": "shoes",
    "accessories": "accessory"
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
    dataset_path = ROOT_DIR / "dataset"
    if not dataset_path.exists():
        print(f"Error: Dataset path {dataset_path} does not exist.")
        return []

    images_to_process = []
    
    # Traverse dataset folder
    for root, dirs, files in os.walk(dataset_path):
        for file in files:
            if file.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.avif')):
                img_path = os.path.join(root, file)
                
                # Determine category and subcategory
                relative_root = os.path.relpath(root, dataset_path)
                parts = relative_root.split(os.sep)
                
                raw_cat = parts[0]
                category = CATEGORY_MAP.get(raw_cat, raw_cat)
                
                subcategory = None
                if raw_cat == "accessories" and len(parts) > 1:
                    subcategory = parts[1].rstrip('s') # belts -> belt
                elif raw_cat in ["belts", "bracelets", "watches"]:
                    # Handle if they are at root level
                    category = "accessory"
                    subcategory = raw_cat.rstrip('s')

                try:
                    img = Image.open(img_path)
                    if img.mode != 'RGB':
                        img = img.convert('RGB')
                    images_to_process.append((img, category, subcategory, img_path))
                except Exception as e:
                    print(f"Skipping corrupted image {img_path}: {e}")
                    
    return images_to_process

async def seed_db():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print(f"Connecting to {DB_NAME}...")
    
    # Clear existing store items
    await db.store_items.delete_many({})
    
    dataset_images = load_dataset_images()
    if not dataset_images:
        print("No images found in dataset. Seeding aborted.")
        return

    print(f"Processing {len(dataset_images)} images from dataset...")
    
    items = []
    for img, cat, subcat, img_path in dataset_images:
        # Generate embedding
        emb = get_image_embedding(img)
        embedding = emb.cpu().numpy().tolist()[0]
        
        # Color extraction
        color = extract_dominant_color(img)
        
        # URL conversion
        # Ensure path uses forward slashes and extract path after 'dataset/'
        path_obj = Path(img_path)
        parts = path_obj.parts
        try:
            dataset_idx = parts.index("dataset")
            relative_path = "/".join(parts[dataset_idx+1:])
        except ValueError:
            relative_path = os.path.basename(img_path)
            
        image_url = f"/images/{relative_path}"
        
        # Randomly assign a store name for variety
        store_name = random.choice(["Amazon", "Flipkart", "Myntra"])
        
        item = {
            "product_id": f"prod_{uuid.uuid4().hex[:12]}",
            "name": f"{color.capitalize()} {cat.capitalize()}" + (f" ({subcat})" if subcat else ""),
            "category": cat,
            "subcategory": subcat,
            "color": color,
            "style": "casual",
            "pattern": "plain",
            "price": random.randint(500, 4500),
            "embedding": embedding,
            "image_url": image_url,
            "store": store_name
        }
        items.append(item)
        
    if items:
        await db.store_items.insert_many(items)
        print(f"Successfully seeded {len(items)} items into store_items collection.")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_db())
