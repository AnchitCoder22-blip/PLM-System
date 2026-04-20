import io
import os
import re
import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
import easyocr

# Base directory of this script — keeps paths reliable regardless of working directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = FastAPI(title="YOLO License Plate Scanner API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize YOLO model (requires ultralytics to download standard weights if not available)
# Using a generic YOLOv8n model. In production, 'license_plate_detector.pt' tuned on plates is better.
print("Loading YOLO model...")
try:
    model = YOLO(os.path.join(BASE_DIR, 'yolov8n.pt'))
except Exception as e:
    print(f"Error loading YOLO: {e}")
    model = None

# Initialize EasyOCR reader (Downloads the english reader file on first run)
print("Loading EasyOCR...")
reader = easyocr.Reader(['en'], gpu=False)  # Set gpu=True if CUDA is configured

def clean_plate_text(text: str) -> str:
    # Filter for alphanumeric characters and force uppercase
    cleaned = re.sub(r'[^a-zA-Z0-9]', '', text).upper()
    return cleaned

@app.post("/scan")
async def scan_plate(file: UploadFile = File(...)):
    if not model:
        raise HTTPException(status_code=500, detail="YOLO model failed to load")
        
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image file")

        # Run YOLO detection
        results = model(img)
        
        best_plate = None
        best_conf = 0.0
        
        # We look for bounding boxes. Pretrained yolov8n 'car' or 'truck' might be class config, 
        # but detecting raw plates without a tailored weight is generic. Let's assume the user 
        # points exactly at the plate OR we look at generic detections if tuned weights aren't used.
        # Since we are automating, we'll extract the most confident bounding box out of crop.
        # If the user has a specific license plate YOLO model, it ideally predicts class '0'.
        
        boxes = results[0].boxes
        if len(boxes) == 0:
            return {"text": "", "confidence": 0, "message": "No object detected"}
            
        for box in boxes:
            conf = float(box.conf[0])
            if conf > best_conf:
                best_conf = conf
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                best_plate = img[y1:y2, x1:x2]

        if best_plate is None or best_plate.size == 0:
            return {"text": "", "confidence": 0, "message": "Unable to crop plate area"}

        # OCR Processing on the cropped image
        # EasyOCR works well on cropped, focused images
        ocr_results = reader.readtext(best_plate, detail=1)
        
        full_text = ""
        avg_confidence = 0.0
        
        if ocr_results:
            texts = []
            confs = []
            for (bbox, text, prob) in ocr_results:
                texts.append(text)
                confs.append(prob)
                
            full_text = "".join(texts)
            avg_confidence = sum(confs) / len(confs)
            
        clean_text = clean_plate_text(full_text)
        
        if len(clean_text) < 3:
            return {"text": "", "confidence": avg_confidence, "message": "Plate text too short or unreadable"}

        return {
            "text": clean_text,
            "confidence": avg_confidence,
            "message": "Success"
        }

    except Exception as e:
        print(f"Error during scan: {e}")
        raise HTTPException(status_code=500, detail=str(e))
        
@app.get("/health")
def health_check():
    return {"status": "ok"}
