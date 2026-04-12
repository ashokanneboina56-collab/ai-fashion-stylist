import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

async def check():
    load_dotenv(Path(__file__).parent / '.env')
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    users = await db.users.find({}, {"_id": 0, "name": 1, "email": 1, "gender": 1}).to_list(10)
    for u in users:
        print(u)
    client.close()

if __name__ == "__main__":
    asyncio.run(check())
