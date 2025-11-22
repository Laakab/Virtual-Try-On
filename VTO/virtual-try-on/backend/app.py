from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
import shutil
import os
import cv2
import numpy as np
from utils.face_detection import detect_landmarks
from utils.overlay import apply_overlay
import json

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/assets", StaticFiles(directory="../frontend/assets"), name="assets")

# Load products
PRODUCTS_FILE = "models/products.json"
if not os.path.exists(PRODUCTS_FILE):
    # Create default products if not exists
    default_products = [
        {"id": "sunglasses_1", "type": "sunglasses", "name": "Classic Sunglasses", "image": "/assets/sunglasses/default.png"},
        {"id": "hat_1", "type": "hat", "name": "Brown Hat", "image": "/assets/hats/default.png"},
        {"id": "coat_1", "type": "coat", "name": "Blue Coat", "image": "/assets/coats/default.png"}
    ]
    os.makedirs("models", exist_ok=True)
    with open(PRODUCTS_FILE, "w") as f:
        json.dump(default_products, f, indent=4)

@app.get("/products")
async def list_products():
    with open(PRODUCTS_FILE, "r") as f:
        products = json.load(f)
    return products

@app.post("/detect_landmarks")
async def get_landmarks(file: UploadFile = File(...)):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    landmarks = detect_landmarks(img)
    return {"landmarks": landmarks}

@app.post("/try_on")
async def try_on(product_id: str, file: UploadFile = File(...)):
    # Load product
    with open(PRODUCTS_FILE, "r") as f:
        products = json.load(f)
    product = next((p for p in products if p["id"] == product_id), None)
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Load user image
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    user_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    # Detect landmarks
    landmarks = detect_landmarks(user_img)
    if not landmarks:
        raise HTTPException(status_code=400, detail="No face detected")
    
    # Apply overlay
    # Product image path needs to be resolved relative to backend or absolute
    # Since we mounted assets at ../frontend/assets, we need to read from there
    asset_path = os.path.join("..", "frontend", product["image"].lstrip("/"))
    # Fix path for windows if needed, but python handles / usually
    # Actually, product['image'] is /assets/..., so we need to strip /assets/
    # and prepend ../frontend/assets/
    
    # Let's just use the relative path from the project root if we run from backend dir
    # product['image'] = "/assets/sunglasses/default.png"
    # real path = "../frontend/assets/sunglasses/default.png"
    
    real_asset_path = product["image"].replace("/assets", "../frontend/assets")
    
    result_img = apply_overlay(user_img, landmarks, real_asset_path, product["type"])
    
    # Save to temp file to return
    temp_file = "temp_result.png"
    cv2.imwrite(temp_file, result_img)
    
    return FileResponse(temp_file)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
