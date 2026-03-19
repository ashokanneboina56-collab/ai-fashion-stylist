# AI Fashion Stylist Backend


This is the FastAPI backend for the AI Fashion Stylist application. It uses MongoDB for data storage and integrates with an LLM for outfit recommendations.

## Prerequisites

- Python 3.8 or higher
- MongoDB (Local or Atlas)

## MongoDB Installation and Setup (Windows)

### 1. Installation
1.  Download the **MongoDB Community Server** installer from the [MongoDB Download Center](https://www.mongodb.com/try/download/community).
2.  Run the `.msi` installer.
3.  Choose **Complete** setup.
4.  Ensure **"Install MongoDB as a Service"** is checked (this makes it start automatically with Windows).
5.  (Optional) Install **MongoDB Compass** when prompted (it's a useful GUI for managing your database).

### 2. Starting MongoDB
- If you installed it as a service, it should already be running.
- To start/stop manually:
    - Open **Services** (search for "Services" in the Start menu).
    - Find **MongoDB Server**.
    - Right-click and select **Start**.
- Default connection URL: `mongodb://localhost:27017/`

## Backend Setup

### 1. Create a Virtual Environment
```bash
python -m venv venv
.\venv\Scripts\activate
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Environment Configuration
Create a `.env` file in this directory with the following content:
```env
MONGO_URL=mongodb://localhost:27017/
DB_NAME=fashion_stylist
JWT_SECRET=your_jwt_secret_key_here
```
> **Note:** The AI features (clothing analysis and outfit matching) now use **FashionCLIP**, a pretrained visual-language model. No external AI API keys are required, as the model runs locally.

### 4. Run the Backend
```bash
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```
The API will be available at `http://localhost:8000`. You can view the interactive documentation at `http://localhost:8000/docs`.

### **AI Pipeline: FashionCLIP**
This project uses [Fashion-CLIP](https://github.com/patrickjohncyh/fashion-clip) for:
1. **Zero-Shot Classification:** Automatically detecting category, color, style, and pattern from clothing images.
2. **Visual Embeddings:** Generating high-dimensional vector representations for similarity-based outfit matching.
