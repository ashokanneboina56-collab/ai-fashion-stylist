from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import json
import base64
import io
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
from PIL import Image
import torch
from transformers import CLIPModel, CLIPProcessor
import numpy as np
from sklearn.cluster import KMeans
import requests

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# --- Model Initialization ---
device = "cuda" if torch.cuda.is_available() else "cpu"
model = CLIPModel.from_pretrained("patrickjohncyh/fashion-clip").to(device)
processor = CLIPProcessor.from_pretrained("patrickjohncyh/fashion-clip")
model.eval()

# Model Warmup
def warmup():
    with torch.no_grad():
        dummy = Image.new("RGB", (224, 224))
        inputs = processor(images=dummy, return_tensors="pt").to(device)
        model.get_image_features(**inputs)
warmup()

# --- Fashion Constants ---
TOPS = ["t-shirt", "shirt", "hoodie", "jacket", "top"]
BOTTOMS = ["jeans", "trousers", "shorts", "pants"]
SHOES = ["shoes", "sneakers", "sandals", "footwear"]
ACCESSORIES = ["accessory", "belt", "bracelet", "watch"]
DRESSES = ["dress"]

CATEGORIES = TOPS + BOTTOMS + SHOES + ACCESSORIES + DRESSES
COLORS = ["red", "blue", "black", "white", "green", "yellow", "grey", "brown", "pink", "multi-color"]
STYLES = ["casual", "formal", "sporty", "streetwear", "party wear", "ethnic"]
PATTERNS = ["plain", "striped", "checked", "floral", "printed"]

COLOR_COMPATIBILITY = {
    "black": ["white", "grey", "blue", "red", "yellow"],
    "white": ["black", "blue", "red", "green", "grey"],
    "blue": ["white", "black", "grey"],
    "red": ["black", "white", "grey"],
    "grey": ["black", "white", "blue", "red"],
    "multi-color": ["white", "black"]
}

OCCASIONS = {
    "formal": {"tops": ["shirt"], "bottoms": ["trousers"], "shoes": ["shoes"], "styles": ["formal"]},
    "casual": {"tops": ["t-shirt", "hoodie"], "bottoms": ["jeans", "shorts"], "shoes": ["sneakers", "sandals"], "styles": ["casual", "streetwear"]},
    "sporty": {"tops": ["t-shirt", "hoodie"], "bottoms": ["shorts", "trousers"], "shoes": ["sneakers"], "styles": ["sporty"]},
}

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET')
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 168

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Models ---
class UserRegister(BaseModel):
    name: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class GoogleAuthRequest(BaseModel):
    session_id: str

class WardrobeItemCreate(BaseModel):
    image_base64: str
    name: Optional[str] = None

class WardrobeBatchAdd(BaseModel):
    items: List[WardrobeItemCreate]

class OutfitPredictRequest(BaseModel):
    item_id: str
    occasion: Optional[str] = None
    source: Optional[str] = "wardrobe"

class OutfitSaveRequest(BaseModel):
    top_id: Optional[str] = None
    bottom_id: Optional[str] = None
    shoes_id: Optional[str] = None
    accessory_id: Optional[str] = None
    compatibility_score: float
    reason: Optional[str] = ""

class WearOutfitRequest(BaseModel):
    outfit_id: str

class ProfileSetup(BaseModel):
    gender: Optional[str] = None
    age: Optional[int] = None
    location: Optional[str] = None
    dress_preference: Optional[str] = None
    top_size: Optional[str] = None
    bottom_size: Optional[str] = None
    shoe_size: Optional[str] = None

# --- Auth Helpers ---
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_jwt(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth_header.split(" ")[1]
    # Try JWT
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"user_id": payload["user_id"]}, {"_id": 0})
        if user:
            return user
    except jwt.exceptions.PyJWTError:
        pass
    # Try session token
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if session:
        expires_at = session.get("expires_at")
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at > datetime.now(timezone.utc):
            user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
            if user:
                return user
    raise HTTPException(status_code=401, detail="Not authenticated")

# --- Image Processing ---
def clean_base64(data: str) -> str:
    if ',' in data:
        return data.split(',', 1)[1]
    return data

def process_image(image_base64: str) -> str:
    try:
        clean = clean_base64(image_base64)
        image_data = base64.b64decode(clean)
        image = Image.open(io.BytesIO(image_data))
        max_size = 800
        if max(image.size) > max_size:
            ratio = max_size / max(image.size)
            new_size = (int(image.size[0] * ratio), int(image.size[1] * ratio))
            image = image.resize(new_size, Image.LANCZOS)
        if image.mode in ('RGBA', 'P'):
            image = image.convert('RGB')
        buffer = io.BytesIO()
        image.save(buffer, format='JPEG', quality=85)
        return base64.b64encode(buffer.getvalue()).decode()
    except Exception as e:
        logger.error(f"Image processing error: {e}")
        return clean_base64(image_base64)

# --- AI Helpers ---
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
        
        # Remove dark noise (pixels with low sum of RGB)
        pixels = pixels[np.sum(pixels, axis=1) > 30]
        if len(pixels) == 0:
            return "black"
            
        kmeans = KMeans(n_clusters=3, n_init=10)
        kmeans.fit(pixels)
        
        counts = np.bincount(kmeans.labels_)
        dominant = kmeans.cluster_centers_[counts.argmax()]
        r, g, b = dominant.astype(int)
        
        return map_rgb_to_color_name(r, g, b)
    except Exception as e:
        logger.error(f"Color extraction error: {e}")
        return "multi-color"

def get_image_embedding(image):
    with torch.no_grad():
        inputs = processor(images=image, return_tensors="pt").to(device)
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
    return emb

async def analyze_clothing_image(image_base64: str) -> dict:
    try:
        clean = clean_base64(image_base64)
        image_data = base64.b64decode(clean)
        image = Image.open(io.BytesIO(image_data))
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
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
        
        # Category validation safety
        if results.get("category") not in CATEGORIES:
            results["category"] = "t-shirt"
            
        # Dominant color extraction
        results["color"] = extract_dominant_color(image)
        results["name"] = f"{results['color'].capitalize()} {results['category'].capitalize()}"
        return results
    except Exception as e:
        logger.error(f"AI analysis error: {e}")
        return {
            "category": "t-shirt",
            "color": "black",
            "style": "casual",
            "pattern": "plain",
            "name": "Clothing Item"
        }

async def generate_outfit_suggestions(wardrobe_items: list, selected_item: dict, user_id: str = None, occasion: str = None) -> list:
    try:
        # 1. Cache embeddings as tensors to avoid repeated conversion
        item_emb_cache = {}
        for item in wardrobe_items:
            # Handle both 'item_id' (wardrobe) and 'product_id' (store)
            iid = item.get("item_id") or item.get("product_id")
            if iid and "embedding" in item:
                item_emb_cache[iid] = torch.tensor(item["embedding"]).to(device)

        # 2. Get history to penalize repeated outfits
        history_keys = set()
        if user_id:
            hist = await db.outfit_history.find({"user_id": user_id}).to_list(20)
            for h in hist:
                outfit = await db.outfits.find_one({"outfit_id": h["outfit_id"]})
                if outfit:
                    history_keys.add((outfit.get("top_id"), outfit.get("bottom_id"), outfit.get("shoes_id")))

        # 3. Pre-filter by category
        selected_cat = selected_item["category"]
        selected_id = selected_item.get("item_id") or selected_item.get("product_id")
        
        # Matching targets based on selected category
        tops, bottoms, shoes_list = [], [], []
        
        if selected_cat in TOPS:
            tops = [selected_item]
            bottoms = [i for i in wardrobe_items if i["category"] in BOTTOMS]
            shoes_list = [i for i in wardrobe_items if i["category"] in SHOES]
        elif selected_cat in BOTTOMS:
            tops = [i for i in wardrobe_items if i["category"] in TOPS]
            bottoms = [selected_item]
            shoes_list = [i for i in wardrobe_items if i["category"] in SHOES]
        elif selected_cat in SHOES:
            tops = [i for i in wardrobe_items if i["category"] in TOPS]
            bottoms = [i for i in wardrobe_items if i["category"] in BOTTOMS]
            shoes_list = [selected_item]
        elif selected_cat in DRESSES:
            shoes_list = [i for i in wardrobe_items if i["category"] in SHOES]
            combinations = []
            for s in (shoes_list if shoes_list else [None]):
                score = 75.0
                sid = s.get("item_id") or s.get("product_id") if s else None
                if sid and sid in item_emb_cache and selected_id in item_emb_cache:
                    score = torch.nn.functional.cosine_similarity(
                        item_emb_cache[selected_id].unsqueeze(0), 
                        item_emb_cache[sid].unsqueeze(0)
                    ).item() * 100
                combinations.append({
                    "top_id": None, "bottom_id": None, "shoes_id": sid,
                    "accessory_id": None, "compatibility_score": min(100, max(0, score)),
                    "reason": "FashionCLIP matching"
                })
            return combinations[:3]
        else:
            return []

        # 4. Generate combinations
        combinations = []
        seen_combos = set() # For diversity filtering
        
        for t in (tops if tops else [None]):
            for b in (bottoms if bottoms else [None]):
                for s in (shoes_list if shoes_list else [None]):
                    items = [i for i in [t, b, s] if i]
                    if len(items) < 2: continue
                    
                    tid = t.get("item_id") or t.get("product_id") if t else None
                    bid = b.get("item_id") or b.get("product_id") if b else None
                    sid = s.get("item_id") or s.get("product_id") if s else None
                    
                    # Diversity Filter: Avoid same (top, bottom) combination
                    combo_key = (tid, bid)
                    if combo_key in seen_combos: continue
                    
                    # Embedding similarity
                    sims = []
                    item_ids = [tid, bid, sid]
                    for i in range(len(item_ids)):
                        for j in range(i + 1, len(item_ids)):
                            id1, id2 = item_ids[i], item_ids[j]
                            if id1 in item_emb_cache and id2 in item_emb_cache:
                                sim = torch.nn.functional.cosine_similarity(
                                    item_emb_cache[id1].unsqueeze(0), 
                                    item_emb_cache[id2].unsqueeze(0)
                                ).item()
                                sims.append(sim)
                    
                    emb_sim = sum(sims) / len(sims) if sims else 0.7
                    
                    # Color score
                    color_match = 0
                    if t and b:
                        if b["color"] in COLOR_COMPATIBILITY.get(t["color"], []): color_match += 1
                    if b and s:
                        if s["color"] in COLOR_COMPATIBILITY.get(b["color"], []): color_match += 1
                    color_score = (color_match / 2.0) if t and b and s else color_match
                    
                    # Style score
                    style_match = 0
                    styles_found = [i["style"] for i in items if i.get("style")]
                    if len(set(styles_found)) == 1: style_match = 1.0
                    elif len(set(styles_found)) <= 2: style_match = 0.5
                    
                    # Occasion boost
                    occ_boost = 0
                    if occasion and occasion in OCCASIONS:
                        occ_rules = OCCASIONS[occasion]
                        matches = sum(1 for i in items if i["category"] in (occ_rules.get("tops", []) + occ_rules.get("bottoms", []) + occ_rules.get("shoes", [])))
                        occ_boost = (matches / len(items)) * 15

                    # Final Score
                    final_score = (0.6 * emb_sim * 100) + (20 * color_score) + (20 * style_match) + occ_boost
                    
                    # Repeated outfit penalty
                    if (tid, bid, sid) in history_keys:
                        final_score -= 15
                    
                    seen_combos.add(combo_key)
                    combinations.append({
                        "top_id": tid,
                        "bottom_id": bid,
                        "shoes_id": sid,
                        "accessory_id": None,
                        "compatibility_score": min(100, max(0, final_score)),
                        "reason": f"Visual similarity with {occasion if occasion else 'casual'} style boost"
                    })

        combinations.sort(key=lambda x: x["compatibility_score"], reverse=True)
        return combinations[:3]
    except Exception as e:
        logger.error(f"Outfit generation error: {e}")
        return []

async def generate_recommendations(wardrobe_items: list, user_profile: dict = None, price_range: str = None, platform: str = None, category: str = None) -> list:
    try:
        # Fetch items from fake store
        store_query = {}
        
        # Category Mapping (STRICT)
        TOPS = ["t-shirt", "shirt", "hoodie", "jacket"]
        BOTTOMS = ["jeans", "trousers", "shorts"]
        SHOES = ["shoes", "sneakers", "sandals"]
        ACCESSORIES = ["accessory", "belt", "bracelet", "watch"]

        if category and category != "All":
            cat_lower = category.lower()
            if cat_lower == "tops":
                store_query["category"] = {"$in": TOPS}
            elif cat_lower == "bottoms":
                store_query["category"] = {"$in": BOTTOMS}
            elif cat_lower == "shoes":
                store_query["category"] = {"$in": SHOES}
            elif cat_lower == "accessories":
                store_query["category"] = {"$in": ACCESSORIES}
            else:
                store_query["category"] = cat_lower
        
        # Add basic platform filtering if provided
        if platform and platform != "All":
            store_query["store"] = platform
            
        # Price range filtering
        if price_range and price_range != "All":
            if "Under" in price_range:
                store_query["price"] = {"$lt": int(price_range.split("₹")[1])}
            elif "-" in price_range:
                parts = price_range.split("-")
                low = int(parts[0].split("₹")[1])
                high = int(parts[1].split("₹")[1])
                store_query["price"] = {"$gte": low, "$lte": high}
            elif "Above" in price_range:
                store_query["price"] = {"$gt": int(price_range.split("₹")[1])}
        
        store_items = await db.store_items.find(store_query, {"_id": 0}).to_list(100)
        if not store_items: return []
        
        # 2. Get user reference embeddings (avg of wardrobe items)
        ref_embs = []
        for item in wardrobe_items:
            if "embedding" in item:
                ref_embs.append(torch.tensor(item["embedding"]).to(device))
        
        avg_ref_emb = torch.mean(torch.stack(ref_embs), dim=0) if ref_embs else None
        
        # 3. Simple preference matching
        user_styles = [i.get("style") for i in wardrobe_items if i.get("style")]
        fav_style = max(set(user_styles), key=user_styles.count) if user_styles else "casual"
        
        # Rank store items
        recommendations = []
        for s_item in store_items:
            if "embedding" not in s_item: continue
            
            score = 60 # Base
            
            # Style bonus
            if s_item.get("style") == fav_style: score += 10
            
            # Embedding similarity score
            if avg_ref_emb is not None:
                s_emb = torch.tensor(s_item["embedding"]).to(device)
                sim = torch.nn.functional.cosine_similarity(avg_ref_emb.unsqueeze(0), s_emb.unsqueeze(0)).item()
                score += (sim * 30) # Weights embedding similarity at 30% of base ranking
            
            recommendations.append({
                "product_id": s_item.get("product_id"),
                "name": s_item["name"],
                "category": s_item["category"],
                "color": s_item["color"],
                "price": f"₹{s_item['price']}",
                "price_value": s_item["price"],
                "store": s_item.get("store", "Fashion AI Store"),
                "search_url": s_item.get("image_url", ""),
                "match_score": min(100, int(score)),
                "wardrobe_match": f"Matches your {fav_style} style"
            })
            
        recommendations.sort(key=lambda x: x["match_score"], reverse=True)
        return recommendations[:50] # Show more items in the grid
    except Exception as e:
        logger.error(f"Recommendation error: {e}")
        return []

# --- Auth Routes ---
@api_router.post("/auth/register")
async def register(data: UserRegister):
    print(f"DEBUG: Registering user: {data.email}")
    existing_user = await db.users.find_one({"email": data.email})
    existing_cred = await db.credentials.find_one({"email": data.email})
    
    if existing_user or existing_cred:
        print(f"DEBUG: Email already registered: {data.email}")
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    hashed_password = hash_password(data.password)
    timestamp = datetime.now(timezone.utc).isoformat()
    
    # Store credentials in dedicated collection
    await db.credentials.insert_one({
        "user_id": user_id,
        "email": data.email,
        "password": hashed_password,
        "created_at": timestamp
    })
    
    # Store profile in users collection (no password)
    user = {
        "user_id": user_id,
        "name": data.name,
        "email": data.email,
        "profile_image": None,
        "gender": None,
        "age": None,
        "location": None,
        "dress_preference": None,
        "top_size": None,
        "bottom_size": None,
        "shoe_size": None,
        "profile_complete": False,
        "created_at": timestamp
    }
    await db.users.insert_one(user)
    
    print(f"DEBUG: User registered successfully: {user_id}")
    token = create_jwt(user_id)
    return {"token": token, "user": {"user_id": user_id, "name": data.name, "email": data.email, "profile_image": None, "profile_complete": False}}

@api_router.post("/auth/login")
async def login(data: UserLogin):
    print(f"DEBUG: Login attempt for: {data.email}")
    # 1. Check credentials collection first
    auth_data = await db.credentials.find_one({"email": data.email})
    
    if not auth_data:
        print(f"DEBUG: User not in credentials, checking users fallback for: {data.email}")
        # 2. Backward compatibility: check users collection
        auth_data = await db.users.find_one({"email": data.email})
        if not auth_data or "password" not in auth_data:
            print(f"DEBUG: User not found in either collection or has no password: {data.email}")
            raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Validate password
    if not verify_password(data.password, auth_data["password"]):
        print(f"DEBUG: Password verification failed for: {data.email}")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Fetch user profile
    user = await db.users.find_one({"user_id": auth_data["user_id"]}, {"_id": 0, "password": 0})
    if not user:
        print(f"DEBUG: Profile not found for user_id: {auth_data['user_id']}")
        raise HTTPException(status_code=401, detail="Invalid credentials")
        
    print(f"DEBUG: Login successful for: {data.email} (user_id: {user['user_id']})")
    token = create_jwt(user["user_id"])
    return {
        "token": token, 
        "user": {
            "user_id": user["user_id"], 
            "name": user["name"], 
            "email": user["email"], 
            "profile_image": user.get("profile_image"), 
            "profile_complete": user.get("profile_complete", False)
        }
    }

@api_router.post("/auth/google")
async def google_auth(data: GoogleAuthRequest):
    resp = requests.get(
        "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
        headers={"X-Session-ID": data.session_id}
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google session")
    auth_data = resp.json()
    email = auth_data["email"]
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": auth_data["name"], "profile_image": auth_data.get("picture")}}
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "name": auth_data["name"],
            "email": email,
            "password": "",
            "profile_image": auth_data.get("picture"),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    session_token = f"session_{uuid.uuid4().hex}"
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    token = create_jwt(user_id)
    existing_user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    pc = existing_user.get("profile_complete", False) if existing_user else False
    return {"token": token, "user": {"user_id": user_id, "name": auth_data["name"], "email": email, "profile_image": auth_data.get("picture"), "profile_complete": pc}}

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return {
        "user_id": user["user_id"], "name": user["name"], "email": user["email"],
        "profile_image": user.get("profile_image"), "gender": user.get("gender"),
        "age": user.get("age"), "location": user.get("location"),
        "dress_preference": user.get("dress_preference"), "top_size": user.get("top_size"),
        "bottom_size": user.get("bottom_size"), "shoe_size": user.get("shoe_size"),
        "profile_complete": user.get("profile_complete", False),
    }

@api_router.post("/auth/logout")
async def logout(user: dict = Depends(get_current_user)):
    await db.user_sessions.delete_many({"user_id": user["user_id"]})
    return {"status": "success", "message": "Logged out successfully"}

# --- Profile Routes ---
@api_router.put("/profile/setup")
async def setup_profile(data: ProfileSetup, user: dict = Depends(get_current_user)):
    update_data = {}
    if data.gender is not None:
        update_data["gender"] = data.gender
    if data.age is not None:
        update_data["age"] = data.age
    if data.location is not None:
        update_data["location"] = data.location
    if data.dress_preference is not None:
        update_data["dress_preference"] = data.dress_preference
    if data.top_size is not None:
        update_data["top_size"] = data.top_size
    if data.bottom_size is not None:
        update_data["bottom_size"] = data.bottom_size
    if data.shoe_size is not None:
        update_data["shoe_size"] = data.shoe_size
    update_data["profile_complete"] = True
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": update_data})
    updated = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password": 0})
    return updated

@api_router.get("/profile")
async def get_profile(user: dict = Depends(get_current_user)):
    profile = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password": 0})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile

# --- Wardrobe Routes ---
@api_router.get("/wardrobe")
async def get_wardrobe(user: dict = Depends(get_current_user), category: Optional[str] = None, search: Optional[str] = None, sort: Optional[str] = None):
    query = {"user_id": user["user_id"]}
    if category and category != "All":
        query["category"] = category
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    sort_field = "created_at"
    sort_dir = -1
    if sort == "most_worn":
        sort_field = "wear_count"
        sort_dir = -1
    elif sort == "least_worn":
        sort_field = "wear_count"
        sort_dir = 1
    items = await db.wardrobe_items.find(query, {"_id": 0}).sort(sort_field, sort_dir).to_list(200)
    return {"items": items}

@api_router.post("/wardrobe/add")
async def add_wardrobe_item(data: WardrobeItemCreate, user: dict = Depends(get_current_user)):
    processed_image_b64 = process_image(data.image_base64)
    attributes = await analyze_clothing_image(processed_image_b64)
    
    # Generate embedding
    image_data = base64.b64decode(processed_image_b64)
    image = Image.open(io.BytesIO(image_data)).convert('RGB')
    embedding = get_image_embedding(image).cpu().numpy().tolist()[0]
    
    item_id = f"item_{uuid.uuid4().hex[:12]}"
    item = {
        "item_id": item_id,
        "user_id": user["user_id"],
        "image_base64": processed_image_b64,
        "name": data.name or attributes.get("name", "Clothing Item"),
        "category": attributes.get("category", "Tops"),
        "color": attributes.get("color", "Unknown"),
        "texture": attributes.get("texture", "Unknown"),
        "style": attributes.get("style", "Casual"),
        "pattern": attributes.get("pattern", "plain"),
        "embedding": embedding,
        "wear_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.wardrobe_items.insert_one(item)
    item.pop("_id", None)
    item.pop("embedding", None)
    return item

@api_router.post("/wardrobe/batch-add")
async def batch_add_wardrobe_items(data: WardrobeBatchAdd, user: dict = Depends(get_current_user)):
    results = []
    for item_data in data.items:
        try:
            processed_image_b64 = process_image(item_data.image_base64)
            attributes = await analyze_clothing_image(processed_image_b64)
            
            image_data = base64.b64decode(processed_image_b64)
            image = Image.open(io.BytesIO(image_data)).convert('RGB')
            embedding = get_image_embedding(image).cpu().numpy().tolist()[0]
            
            item_id = f"item_{uuid.uuid4().hex[:12]}"
            item = {
                "item_id": item_id,
                "user_id": user["user_id"],
                "image_base64": processed_image_b64,
                "name": item_data.name or attributes.get("name", "Clothing Item"),
                "category": attributes.get("category", "Tops"),
                "color": attributes.get("color", "Unknown"),
                "texture": attributes.get("texture", "Unknown"),
                "style": attributes.get("style", "Casual"),
                "pattern": attributes.get("pattern", "plain"),
                "embedding": embedding,
                "wear_count": 0,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.wardrobe_items.insert_one(item)
            item.pop("_id", None)
            item.pop("embedding", None)
            results.append(item)
        except Exception as e:
            logger.error(f"Batch add error for item: {e}")
            continue
    return {"items": results}

@api_router.get("/wardrobe/{item_id}")
async def get_wardrobe_item(item_id: str, user: dict = Depends(get_current_user)):
    item = await db.wardrobe_items.find_one({"item_id": item_id, "user_id": user["user_id"]}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@api_router.delete("/wardrobe/{item_id}")
async def delete_wardrobe_item(item_id: str, user: dict = Depends(get_current_user)):
    print(f"DEBUG: Delete request for item_id: {item_id}, user_id: {user['user_id']}")
    # Try deleting by item_id
    result = await db.wardrobe_items.delete_one({"item_id": item_id, "user_id": user["user_id"]})
    
    if result.deleted_count == 0:
        print(f"DEBUG: Item not found by item_id, trying by _id or other fields...")
        # Fallback: maybe it's stored as something else? (though shouldn't be with current logic)
        # But let's check if the item exists at all for this user
        item = await db.wardrobe_items.find_one({"item_id": item_id})
        if item:
            print(f"DEBUG: Item found but user_id mismatch! Item user: {item.get('user_id')}, Current user: {user['user_id']}")
        else:
            print(f"DEBUG: Item {item_id} not found in database at all.")
        raise HTTPException(status_code=404, detail="Item not found")
    
    print(f"DEBUG: Item {item_id} deleted successfully.")
    return {"status": "deleted"}

# --- Outfit Routes ---
@api_router.post("/outfit/predict")
async def predict_outfit(data: OutfitPredictRequest, user: dict = Depends(get_current_user)):
    selected = await db.wardrobe_items.find_one({"item_id": data.item_id, "user_id": user["user_id"]}, {"_id": 0})
    if not selected:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Strictly choose source
    if data.source == "store":
        all_items = await db.store_items.find({"category": {"$in": CATEGORIES}}, {"_id": 0}).to_list(100)
        # map field name for consistency in matching logic
        for s in all_items:
            s["item_id"] = s["product_id"]
            s["is_store_item"] = True
    else:
        all_items = await db.wardrobe_items.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(100)
        for i in all_items:
            i["is_store_item"] = False

    suggestions = await generate_outfit_suggestions(all_items, selected, user_id=user["user_id"], occasion=data.occasion)
    
    items_map = {i.get("item_id") or i.get("product_id"): i for i in all_items}
    # Add selected item to map if not present (selected is always from wardrobe)
    sel_id = selected.get("item_id") or selected.get("product_id")
    if sel_id not in items_map:
        items_map[sel_id] = selected

    enriched = []
    for s in suggestions:
        outfit = {
            "outfit_id": f"outfit_{uuid.uuid4().hex[:12]}",
            "top": items_map.get(s.get("top_id")),
            "bottom": items_map.get(s.get("bottom_id")),
            "shoes": items_map.get(s.get("shoes_id")),
            "accessory": items_map.get(s.get("accessory_id")),
            "compatibility_score": s.get("compatibility_score", 80),
            "reason": s.get("reason", "Great combination!")
        }
        enriched.append(outfit)
    return {"outfits": enriched}

@api_router.post("/outfit/save")
async def save_outfit(data: OutfitSaveRequest, user: dict = Depends(get_current_user)):
    # Create a unique outfit key (sort IDs to handle order)
    component_ids = sorted([str(id) for id in [data.top_id, data.bottom_id, data.shoes_id, data.accessory_id] if id])
    outfit_key = "*".join(component_ids)
    
    # Check for duplicate
    existing = await db.outfits.find_one({
        "user_id": user["user_id"],
        "outfit_key": outfit_key
    })
    
    if existing:
        return {
            "status": "already_saved",
            "message": "Outfit already saved",
            "outfit_id": existing["outfit_id"]
        }

    outfit_id = f"outfit_{uuid.uuid4().hex[:12]}"
    outfit = {
        "outfit_id": outfit_id,
        "outfit_key": outfit_key,
        "user_id": user["user_id"],
        "top_id": data.top_id,
        "bottom_id": data.bottom_id,
        "shoes_id": data.shoes_id,
        "accessory_id": data.accessory_id,
        "compatibility_score": data.compatibility_score,
        "reason": data.reason,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.outfits.insert_one(outfit)
    outfit.pop("_id", None)
    return {"status": "success", "outfit_id": outfit_id, "outfit": outfit}

@api_router.post("/outfit/wear")
async def wear_outfit(data: WearOutfitRequest, user: dict = Depends(get_current_user)):
    # 1. Fetch outfit to get component IDs and unique key
    outfit = await db.outfits.find_one({"outfit_id": data.outfit_id})
    if not outfit:
        raise HTTPException(status_code=404, detail="Outfit not found")
        
    outfit_key = outfit.get("outfit_key")
    if not outfit_key:
        component_ids = sorted([str(outfit.get(f)) for f in ["top_id", "bottom_id", "shoes_id", "accessory_id"] if outfit.get(f)])
        outfit_key = "*".join(component_ids)

    # 2. Update/Insert history with wear count
    timestamp = datetime.now(timezone.utc).isoformat()
    existing_history = await db.outfit_history.find_one({
        "user_id": user["user_id"],
        "outfit_key": outfit_key
    })
    
    if existing_history:
        await db.outfit_history.update_one(
            {"_id": existing_history["_id"]},
            {"$inc": {"wear_count": 1}, "$set": {"worn_date": timestamp, "outfit_id": data.outfit_id}}
        )
        history_id = existing_history["history_id"]
    else:
        history_id = f"hist_{uuid.uuid4().hex[:12]}"
        history = {
            "history_id": history_id,
            "user_id": user["user_id"],
            "outfit_id": data.outfit_id,
            "outfit_key": outfit_key,
            "wear_count": 1,
            "worn_date": timestamp
        }
        await db.outfit_history.insert_one(history)
    
    # 3. Increment wear count for individual wardrobe items (only if they are wardrobe items, not store items)
    item_ids = [outfit.get(f) for f in ["top_id", "bottom_id", "shoes_id", "accessory_id"] if outfit.get(f)]
    if item_ids:
        # Check which IDs are wardrobe items vs store items
        wardrobe_items = await db.wardrobe_items.find({"item_id": {"$in": item_ids}, "user_id": user["user_id"]}).to_list(None)
        wardrobe_item_ids = [wi["item_id"] for wi in wardrobe_items]
        
        if wardrobe_item_ids:
            await db.wardrobe_items.update_many(
                {"item_id": {"$in": wardrobe_item_ids}, "user_id": user["user_id"]},
                {"$inc": {"wear_count": 1}}
            )
        
        # 4. User preference learning (using wardrobe items found)
        for item in wardrobe_items:
            color = item.get("color")
            style = item.get("style")
            if color:
                await db.users.update_one({"user_id": user["user_id"]}, {"$inc": {f"preferences.colors.{color}": 1}})
            if style:
                await db.users.update_one({"user_id": user["user_id"]}, {"$inc": {f"preferences.styles.{style}": 1}})
            
    return {"status": "success", "history_id": history_id}

@api_router.get("/outfit/history")
async def get_outfit_history(user: dict = Depends(get_current_user)):
    history = await db.outfit_history.find({"user_id": user["user_id"]}, {"_id": 0}).sort("worn_date", -1).to_list(50)
    
    # Pre-fetch items to avoid repeated DB calls
    wardrobe_items = await db.wardrobe_items.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(200)
    store_items = await db.store_items.find({}, {"_id": 0}).to_list(200)
    
    items_map = {i.get("item_id") or i.get("product_id"): i for i in wardrobe_items + store_items}
    
    enriched_history = []
    for h in history:
        outfit = await db.outfits.find_one({"outfit_id": h["outfit_id"]}, {"_id": 0})
        if outfit:
            h["top"] = items_map.get(outfit.get("top_id"))
            h["bottom"] = items_map.get(outfit.get("bottom_id"))
            h["shoes"] = items_map.get(outfit.get("shoes_id"))
            h["accessory"] = items_map.get(outfit.get("accessory_id"))
            h["compatibility_score"] = outfit.get("compatibility_score")
            h["reason"] = outfit.get("reason")
            enriched_history.append(h)
            
    return {"history": enriched_history}

@api_router.get("/outfit/saved")
async def get_saved_outfits(user: dict = Depends(get_current_user)):
    outfits = await db.outfits.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    
    # Pre-fetch items to avoid repeated DB calls
    wardrobe_items = await db.wardrobe_items.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(200)
    store_items = await db.store_items.find({}, {"_id": 0}).to_list(200)
    
    items_map = {i.get("item_id") or i.get("product_id"): i for i in wardrobe_items + store_items}
    
    enriched = []
    for o in outfits:
        enriched.append({
            "outfit_id": o["outfit_id"],
            "top": items_map.get(o.get("top_id")),
            "bottom": items_map.get(o.get("bottom_id")),
            "shoes": items_map.get(o.get("shoes_id")),
            "accessory": items_map.get(o.get("accessory_id")),
            "compatibility_score": o.get("compatibility_score"),
            "reason": o.get("reason"),
            "created_at": o.get("created_at")
        })
    return {"outfits": enriched}

@api_router.delete("/outfit/{outfit_id}")
async def delete_outfit(outfit_id: str, user: dict = Depends(get_current_user)):
    print(f"DEBUG: Unsave request for outfit_id: {outfit_id}, user_id: {user['user_id']}")
    result = await db.outfits.delete_one({"outfit_id": outfit_id, "user_id": user["user_id"]})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Outfit not found or already unsaved")
    
    # Optional: also remove from history? No, user only asked to unsave (remove from saved list).
    return {"status": "unsaved"}

# --- Recommendations ---
@api_router.get("/recommendations")
async def get_recommendations(
    user: dict = Depends(get_current_user),
    price_range: Optional[str] = None,
    platform: Optional[str] = None,
    category: Optional[str] = None
):
    items = await db.wardrobe_items.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(50)
    # Build user profile from DB
    user_profile = {
        "gender": user.get("gender"),
        "age": user.get("age"),
        "location": user.get("location"),
        "dress_preference": user.get("dress_preference"),
        "top_size": user.get("top_size"),
        "bottom_size": user.get("bottom_size"),
        "shoe_size": user.get("shoe_size"),
    }
    recs = await generate_recommendations(items, user_profile=user_profile, price_range=price_range, platform=platform, category=category)
    return {"recommendations": recs}

# --- Analytics ---
@api_router.get("/analytics")
async def get_analytics(user: dict = Depends(get_current_user)):
    items = await db.wardrobe_items.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(200)
    total_items = len(items)
    total_outfits = await db.outfits.count_documents({"user_id": user["user_id"]})
    total_worn = await db.outfit_history.count_documents({"user_id": user["user_id"]})
    categories = {}
    colors = {}
    styles = {}
    most_worn = None
    least_worn = None
    for item in items:
        cat = item.get("category", "Other")
        categories[cat] = categories.get(cat, 0) + 1
        color = item.get("color", "Unknown")
        colors[color] = colors.get(color, 0) + 1
        style = item.get("style", "Unknown")
        styles[style] = styles.get(style, 0) + 1
        wear = item.get("wear_count", 0)
        if most_worn is None or wear > most_worn.get("wear_count", 0):
            most_worn = item
        if least_worn is None or wear < least_worn.get("wear_count", 0):
            least_worn = item
    return {
        "total_items": total_items,
        "total_outfits": total_outfits,
        "total_worn": total_worn,
        "categories": categories,
        "colors": colors,
        "styles": styles,
        "most_worn": most_worn,
        "least_worn": least_worn
    }

# Include router
app.include_router(api_router)

# Mount dataset images
app.mount("/images", StaticFiles(directory="dataset"), name="images")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
