import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

async def check():
    load_dotenv(Path(__file__).parent / '.env')
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    m_count = await db.store_items.count_documents({})
    f_count = await db.female_store_items.count_documents({})
    print(f"Male count: {m_count}")
    print(f"Female count: {f_count}")
    client.close()

if __name__ == "__main__":
    asyncio.run(check())
