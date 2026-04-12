import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

async def check():
    load_dotenv(Path(__file__).parent / '.env')
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    
    m_cats = await db.store_items.distinct("category")
    f_cats = await db.female_store_items.distinct("category")
    print(f"Male categories: {m_cats}")
    print(f"Female categories: {f_cats}\n")
    
    m_items = await db.store_items.find({}, {"_id": 0, "name": 1, "image_url": 1, "gender": 1}).to_list(5)
    f_items = await db.female_store_items.find({}, {"_id": 0, "name": 1, "image_url": 1, "gender": 1}).to_list(5)
    
    print("--- MALE STORE ITEMS (First 5) ---")
    for i in m_items:
        print(f"Name: {i['name']}, URL: {i['image_url']}, Gender: {i.get('gender')}")
        
    print("\n--- FEMALE STORE ITEMS (First 5) ---")
    for i in f_items:
        print(f"Name: {i['name']}, URL: {i['image_url']}, Gender: {i.get('gender')}")
        
    client.close()

if __name__ == "__main__":
    asyncio.run(check())
