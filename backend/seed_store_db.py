import asyncio
import os
import uuid
import torch
from transformers import CLIPModel, CLIPProcessor
from motor.motor_asyncio import AsyncIOMotorClient
from PIL import Image
import requests
from io import BytesIO
from dotenv import load_dotenv
from pathlib import Path

# Load env
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Config
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/')
DB_NAME = os.environ.get('DB_NAME', 'fashion_stylist')

# Model
device = "cuda" if torch.cuda.is_available() else "cpu"
model = CLIPModel.from_pretrained("patrickjohncyh/fashion-clip").to(device)
processor = CLIPProcessor.from_pretrained("patrickjohncyh/fashion-clip")
model.eval()

# Constants for seeding
CATEGORIES = ["t-shirt", "shirt", "hoodie", "jacket", "jeans", "trousers", "shorts", "dress", "shoes", "sneakers", "sandals"]
COLORS = ["red", "blue", "black", "white", "green", "yellow", "grey", "brown", "pink"]
STYLES = ["casual", "formal", "sporty", "streetwear"]

# Sample images (using placeholder images for seeding)
# In a real scenario, these would be real fashion product images
def get_placeholder_image(category, color):
    # Just creating a solid color image as a placeholder for the store
    img = Image.new('RGB', (224, 224), color=color if color != "multi-color" else "grey")
    return img

async def seed_db():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print(f"Connecting to {DB_NAME}...")
    
    # Clear existing store items
    await db.store_items.delete_many({})
    
    items = []
    print("Generating 60 fake store items with embeddings...")
    
    for _ in range(60):
        cat = CATEGORIES[uuid.uuid4().int % len(CATEGORIES)]
        color = COLORS[uuid.uuid4().int % len(COLORS)]
        style = STYLES[uuid.uuid4().int % len(STYLES)]
        
        img = get_placeholder_image(cat, color)
        
        # Get embedding
        with torch.no_grad():
            inputs = processor(images=img, return_tensors="pt").to(device)
            outputs = model.get_image_features(**inputs)
            # Handle cases where the output might be an object instead of a tensor
            if hasattr(outputs, "image_embeds"):
                emb = outputs.image_embeds
            elif hasattr(outputs, "pooler_output"):
                emb = outputs.pooler_output
            elif isinstance(outputs, torch.Tensor):
                emb = outputs
            else:
                # Fallback for other output types
                emb = outputs[0] if isinstance(outputs, (list, tuple)) else outputs
                
            emb = emb / emb.norm(p=2, dim=-1, keepdim=True)
            embedding = emb.cpu().numpy().tolist()[0]
            
        item = {
            "product_id": f"prod_{uuid.uuid4().hex[:12]}",
            "name": f"{color.capitalize()} {cat.capitalize()}",
            "category": cat,
            "color": color,
            "style": style,
            "price": (uuid.uuid4().int % 4000) + 500,
            "embedding": embedding,
            "image_url": f"https://via.placeholder.com/300?text={color}+{cat}"
        }
        items.append(item)
        
    if items:
        await db.store_items.insert_many(items)
        print(f"Successfully seeded {len(items)} items into store_items collection.")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_db())
