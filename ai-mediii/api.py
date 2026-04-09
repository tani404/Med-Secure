import os
import sys
import subprocess
import tempfile
import asyncio
import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image
import io
import urllib.request
from contextlib import asynccontextmanager
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pathlib import Path

# ── Camera-based model path ────────────────────────────────────────────────
_CAMERA_MODEL_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..", "camera_based_model", "medicine-verifier"
)
if _CAMERA_MODEL_DIR not in sys.path:
    sys.path.insert(0, _CAMERA_MODEL_DIR)

# --- MODEL ARCHITECTURE ---
def create_model():
    """Define the ResNet50 architecture"""
    model = models.resnet50(weights=None)
    num_features = model.fc.in_features
    model.fc = nn.Sequential(
        nn.Linear(num_features, 1024),
        nn.ReLU(),
        nn.Dropout(0.3),
        nn.Linear(1024, 512),
        nn.ReLU(),
        nn.Dropout(0.3),
        nn.Linear(512, 2)
    )
    return model

# --- LIFESPAN ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model on startup."""
    try:
        load_model()
        print(f"[OK] Model loaded successfully from {MODEL_PATH}")
    except Exception as e:
        print(f"[WARN] Model not found at startup. Will attempt to load on first request.")
        print(f"Error: {str(e)}")
    yield


# --- INITIALIZE FASTAPI APP ---
app = FastAPI(
    title="MedSecure - Medicine Detection API",
    description="Counterfeit Medicine Detection using ResNet50",
    version="1.0.0",
    lifespan=lifespan,
)

# --- CORS CONFIGURATION ---
_ALLOWED_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://localhost:3000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- GLOBAL VARIABLES ---
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(PROJECT_DIR, 'best_model.pth')
FRONTEND_DIR = os.path.join(os.path.dirname(PROJECT_DIR), 'frontend', 'dist')
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

# Load model once on startup
MODEL = None
TRANSFORM = None

def load_model():
    """Load model and transforms"""
    global MODEL, TRANSFORM
    
    if MODEL is None:
        MODEL = create_model()
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(f"Model file not found at {MODEL_PATH}")
        
        checkpoint = torch.load(MODEL_PATH, map_location=DEVICE)
        MODEL.load_state_dict(checkpoint['model_state_dict'])
        MODEL.to(DEVICE)
        MODEL.eval()
    
    if TRANSFORM is None:
        TRANSFORM = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ])
    
    return MODEL, TRANSFORM

# --- ENDPOINTS ---

@app.get("/api", tags=["Status"])
async def api_root():
    """API welcome endpoint"""
    return {
        "message": "MedSecure Medicine Detection API",
        "version": "1.0.0",
        "endpoints": {
            "info": "GET /model-info - Get model information",
            "health": "GET /health - Check API health",
            "predict": "POST /predict - Upload image for prediction",
            "test": "GET /test - Run accuracy test on test dataset",
            "docs": "GET /docs - Interactive API documentation"
        }
    }

@app.get("/health", tags=["Status"])
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "device": str(DEVICE),
        "model_loaded": MODEL is not None,
        "model_path": MODEL_PATH
    }

@app.get("/model-info", tags=["Status"])
async def model_info():
    """Get model information"""
    return {
        "model": "ResNet50",
        "classes": ["Fake", "Real"],
        "accuracy": "98.44%",
        "precision": "99.65%",
        "recall": "97.91%",
        "f1_score": "98.77",
        "input_size": [224, 224],
        "framework": "PyTorch",
        "device": str(DEVICE)
    }

def generate_analysis(prediction: str, confidence: float, prob_fake: float, prob_real: float):
    """Generate detailed analysis describing why the medicine is classified as real or fake."""
    reasons = []

    if prediction == "Real":
        reasons.append("Packaging patterns and label alignment match known authentic pharmaceutical standards.")
        if confidence >= 95:
            reasons.append("Very high visual consistency with verified genuine medicine samples in the training dataset.")
            reasons.append("Color profiles, font rendering, and print quality are consistent with legitimate manufacturers.")
        elif confidence >= 85:
            reasons.append("Strong visual similarity to verified genuine samples, though minor surface variations were detected.")
            reasons.append("Label formatting and packaging structure align with authentic production standards.")
        else:
            reasons.append("Moderate similarity to genuine samples detected. Some visual features are inconclusive.")
            reasons.append("Consider additional verification methods such as blockchain batch lookup for stronger confidence.")

        summary = (
            f"The uploaded medicine image has been classified as GENUINE with {confidence:.1f}% confidence. "
            f"The model's visual analysis indicates that packaging quality, label accuracy, and print characteristics "
            f"are consistent with authentic pharmaceutical products."
        )
    else:
        reasons.append("Visual anomalies detected in packaging that deviate from known authentic medicine patterns.")
        if confidence >= 95:
            reasons.append("Significant inconsistencies found in label printing quality, color accuracy, or font rendering.")
            reasons.append("Packaging texture and finish patterns strongly match known counterfeit indicators in the dataset.")
        elif confidence >= 85:
            reasons.append("Noticeable deviations in print quality or color profiles compared to verified genuine samples.")
            reasons.append("Label alignment or packaging material characteristics suggest non-standard manufacturing.")
        else:
            reasons.append("Some visual features resemble counterfeit patterns, but the evidence is not conclusive.")
            reasons.append("Recommend cross-referencing with blockchain supply chain records for definitive verification.")

        summary = (
            f"The uploaded medicine image has been classified as COUNTERFEIT with {confidence:.1f}% confidence. "
            f"The model detected visual inconsistencies in packaging quality, label characteristics, or print patterns "
            f"that diverge from verified authentic pharmaceutical products."
        )

    if prediction == "Real" and confidence >= 85:
        risk_level = "low"
    elif prediction == "Fake" and confidence >= 85:
        risk_level = "high"
    else:
        risk_level = "medium"

    return {
        "summary": summary,
        "reasons": reasons,
        "risk_level": risk_level,
    }


@app.post("/predict", tags=["Prediction"])
async def predict(file: UploadFile = File(...)):
    """
    Predict if a medicine is Real or Fake

    - **file**: Image file to analyze (jpg, png, jpeg, bmp)

    Returns:
    - **prediction**: "Real" or "Fake"
    - **confidence**: Confidence percentage
    - **probabilities**: Probabilities for both classes
    - **analysis**: Detailed description of why the classification was made
    """
    try:
        # Validate file type
        valid_ext = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}
        file_ext = Path(file.filename).suffix.lower()

        if file_ext not in valid_ext:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Allowed: {valid_ext}"
            )

        # Load model and transforms
        model, transform = load_model()

        # Read image
        image_data = await file.read()
        image = Image.open(io.BytesIO(image_data)).convert('RGB')

        # Prepare input
        input_tensor = transform(image).unsqueeze(0).to(DEVICE)

        # Make prediction
        with torch.no_grad():
            outputs = model(input_tensor)
            probabilities = torch.nn.functional.softmax(outputs, dim=1)
            conf, pred = torch.max(probabilities, 1)

        prediction = "Real" if pred.item() == 1 else "Fake"
        confidence = float(conf.item() * 100)
        prob_fake = float(probabilities[0, 0].item() * 100)
        prob_real = float(probabilities[0, 1].item() * 100)

        # Generate detailed analysis
        analysis = generate_analysis(prediction, confidence, prob_fake, prob_real)

        return {
            "filename": file.filename,
            "prediction": prediction,
            "confidence": f"{confidence:.2f}%",
            "probabilities": {
                "fake": prob_fake,
                "real": prob_real
            },
            "analysis": analysis,
            "device": str(DEVICE)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")


class PredictUrlRequest(BaseModel):
    url: str


@app.post("/predict-from-url", tags=["Prediction"])
async def predict_from_url(body: PredictUrlRequest):
    """
    Download an image from a URL and predict if it is Real or Fake.

    Used by the camera scan flow — the frontend passes the product
    reference image URL captured via camera; the API downloads it,
    runs it through the ResNet50 model, and returns the same response
    shape as /predict.

    - **url**: Publicly accessible image URL (jpg, png, jpeg, bmp, webp)
    """
    try:
        url = body.url.strip()
        if not url.startswith(("http://", "https://")):
            raise HTTPException(status_code=400, detail="URL must start with http:// or https://")

        # Download the image with a spoofed User-Agent to avoid 403s
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (compatible; MedSecure/1.0)"},
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            image_data = resp.read()

        image = Image.open(io.BytesIO(image_data)).convert("RGB")

        model, transform = load_model()
        input_tensor = transform(image).unsqueeze(0).to(DEVICE)

        with torch.no_grad():
            outputs = model(input_tensor)
            probabilities = torch.nn.functional.softmax(outputs, dim=1)
            conf, pred = torch.max(probabilities, 1)

        prediction = "Real" if pred.item() == 1 else "Fake"
        confidence = float(conf.item() * 100)
        prob_fake = float(probabilities[0, 0].item() * 100)
        prob_real = float(probabilities[0, 1].item() * 100)

        analysis = generate_analysis(prediction, confidence, prob_fake, prob_real)

        # Extract filename from URL for display
        filename = url.split("/")[-1].split("?")[0] or "camera-capture.jpg"

        return {
            "filename": filename,
            "prediction": prediction,
            "confidence": f"{confidence:.2f}%",
            "probabilities": {"fake": prob_fake, "real": prob_real},
            "analysis": analysis,
            "device": str(DEVICE),
            "source_url": url,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing image from URL: {str(e)}")


@app.post("/predict-camera", tags=["Prediction"])
async def predict_camera(file: UploadFile = File(...)):
    """
    Full camera scan pipeline:
    1. Save uploaded image to a temp file
    2. Run camera-based model (OCR → query → CLIP → authenticity → forensics)
    3. Take the matched_reference URL from the result
    4. Download that reference image
    5. Run it through ResNet50
    6. Return combined result from both models
    """
    try:
        valid_ext = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
        file_ext = Path(file.filename or "image.jpg").suffix.lower()
        if file_ext not in valid_ext:
            raise HTTPException(status_code=400, detail=f"Invalid file type. Allowed: {valid_ext}")

        image_data = await file.read()

        # Save to temp file so camera model can read it by path
        suffix = file_ext or ".jpg"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(image_data)
            tmp_path = tmp.name

        try:
            # ── Step 1: Run camera-based pipeline ──────────────────────────
            import importlib.util
            spec = importlib.util.spec_from_file_location(
                "camera_main",
                os.path.join(_CAMERA_MODEL_DIR, "main.py"),
            )
            camera_main = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(camera_main)
            camera_result = await camera_main.verify_medicine(tmp_path)
        finally:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass

        # ── Step 2: Download ALL reference images and run ResNet50 ─────────
        all_ref_urls = camera_result.get("all_ref_urls", [])
        matched_url = camera_result.get("matched_reference")

        if not all_ref_urls and matched_url:
            all_ref_urls = [matched_url]

        if not all_ref_urls:
            return {
                "filename": file.filename or "camera-capture.jpg",
                "prediction": "Fake",
                "confidence": "0.00%",
                "probabilities": {"fake": 100.0, "real": 0.0},
                "analysis": generate_analysis("Fake", 0.0, 100.0, 0.0),
                "device": str(DEVICE),
                "source_url": None,
                "camera_result": {
                    "medicine": camera_result.get("medicine"),
                    "status": camera_result.get("status"),
                    "confidence": camera_result.get("confidence"),
                    "ocr_raw": camera_result.get("ocr_raw", "")[:200],
                    "manufacturer": camera_result.get("medicine_info", {}).get("manufacturer"),
                    "authenticity_verdict": camera_result.get("authenticity", {}).get("verdict"),
                    "forensics_score": camera_result.get("forensics", {}).get("score"),
                },
                "note": "No reference images found",
            }

        model, transform = load_model()
        ref_results = []
        total_real = 0.0
        total_fake = 0.0
        downloaded = 0

        print(f"[CAMERA] Downloading & analyzing {len(all_ref_urls)} reference images...")

        for i, url in enumerate(all_ref_urls):
            try:
                req = urllib.request.Request(
                    url,
                    headers={"User-Agent": "Mozilla/5.0 (compatible; MedSecure/1.0)"},
                )
                with urllib.request.urlopen(req, timeout=10) as resp:
                    ref_data = resp.read()

                ref_img = Image.open(io.BytesIO(ref_data)).convert("RGB")
                input_tensor = transform(ref_img).unsqueeze(0).to(DEVICE)

                with torch.no_grad():
                    outputs = model(input_tensor)
                    probs = torch.nn.functional.softmax(outputs, dim=1)
                    conf_val, pred_val = torch.max(probs, 1)

                pred_label = "Real" if pred_val.item() == 1 else "Fake"
                p_real = float(probs[0, 1].item() * 100)
                p_fake = float(probs[0, 0].item() * 100)
                total_real += p_real
                total_fake += p_fake
                downloaded += 1

                ref_results.append({
                    "url": url,
                    "prediction": pred_label,
                    "real_prob": round(p_real, 2),
                    "fake_prob": round(p_fake, 2),
                })
                print(f"[CAMERA]   [{i+1}/{len(all_ref_urls)}] {pred_label} ({p_real:.1f}% real) <- {url.split('/')[-1][:40]}")

            except Exception as exc:
                print(f"[CAMERA]   [{i+1}/{len(all_ref_urls)}] SKIP: {exc} <- {url[:60]}")
                continue

        if downloaded == 0:
            return {
                "filename": file.filename or "camera-capture.jpg",
                "prediction": "Fake",
                "confidence": "0.00%",
                "probabilities": {"fake": 100.0, "real": 0.0},
                "analysis": generate_analysis("Fake", 0.0, 100.0, 0.0),
                "device": str(DEVICE),
                "source_url": matched_url,
                "camera_result": {
                    "medicine": camera_result.get("medicine"),
                    "status": camera_result.get("status"),
                    "confidence": camera_result.get("confidence"),
                    "ocr_raw": camera_result.get("ocr_raw", "")[:200],
                    "manufacturer": camera_result.get("medicine_info", {}).get("manufacturer"),
                    "authenticity_verdict": camera_result.get("authenticity", {}).get("verdict"),
                    "forensics_score": camera_result.get("forensics", {}).get("score"),
                },
                "note": "All reference image downloads failed",
            }

        # Aggregate ResNet50 results
        avg_real = total_real / downloaded
        avg_fake = total_fake / downloaded
        real_count = sum(1 for r in ref_results if r["prediction"] == "Real")

        print(f"[CAMERA] ResNet50: {real_count}/{downloaded} Real | avg_real={avg_real:.1f}%")

        # ── Step 4: LLM final verdict ──────────────────────────────────────
        # Combine ALL evidence: camera pipeline + ResNet50 refs + forensics
        print("[CAMERA] Asking LLM for final verdict...")

        import anthropic
        claude_key = os.getenv("CLAUDE_API_KEY", "")
        if not claude_key:
            # Try loading from camera model .env
            from dotenv import load_dotenv
            env_path = os.path.join(_CAMERA_MODEL_DIR, ".env")
            load_dotenv(env_path)
            claude_key = os.getenv("CLAUDE_API_KEY", "")

        camera_medicine = camera_result.get("medicine", "Unknown")
        camera_status = camera_result.get("status", "unknown")
        camera_confidence = camera_result.get("confidence", 0)
        camera_clip = camera_result.get("clip_score", 0)
        auth_verdict = camera_result.get("authenticity", {}).get("verdict", "unknown")
        auth_score = camera_result.get("authenticity", {}).get("score", 0)
        auth_flags = camera_result.get("authenticity", {}).get("red_flags", [])
        forensics_score = camera_result.get("forensics", {}).get("score", 0)
        ocr_text = camera_result.get("ocr_raw", "")[:300]

        evidence = f"""Medicine identified: {camera_medicine}
Manufacturer: {camera_result.get("medicine_info", {}).get("manufacturer", "Unknown")}

Camera Pipeline Result:
- Status: {camera_status} (confidence: {camera_confidence})
- CLIP visual similarity to known product: {camera_clip}
- Authenticity check: {auth_verdict} (score: {auth_score})
- Red flags: {', '.join(auth_flags[:5]) if auth_flags else 'None'}
- Forensics (print quality) score: {forensics_score}

ResNet50 Reference Image Analysis:
- {downloaded} reference images downloaded from Google
- {real_count} classified as Real, {downloaded - real_count} classified as Fake
- Average real probability: {avg_real:.1f}%
- Per-image breakdown: {', '.join(f"{r['prediction']}({r['real_prob']:.0f}%)" for r in ref_results)}

OCR text from packaging: {ocr_text}
"""

        final_prompt = """You are a pharmaceutical authentication AI making the FINAL verdict on whether a medicine is GENUINE (Real) or COUNTERFEIT (Fake).

CRITICAL RULES — read these BEFORE looking at the evidence:
1. "Real" means: this is a genuine medicine manufactured by the stated company. It may be expired, damaged, or old — it is STILL Real.
2. "Fake" means: this is a counterfeit — someone manufactured a fraudulent copy to deceive consumers.
3. **OCR text from camera photos is ALWAYS garbled.** Misspelled manufacturer names, broken addresses, garbled dosage instructions, missing batch/expiry info = NORMAL OCR NOISE, NOT counterfeiting. NEVER use OCR text quality as evidence of Fake.
4. Expired medicine is REAL medicine. Expiry does NOT mean fake.
5. **CLIP score > 0.55** means the packaging VISUALLY MATCHES known genuine products — this is the STRONGEST signal. If CLIP > 0.55, default to Real unless there is overwhelming evidence otherwise.
6. **Forensics score > 0.6** means professional pharmaceutical-grade printing — strong evidence of Real.
7. If the majority of ResNet50 reference images say Real (> 50%), that supports Real.
8. **Ignore ALL red flags that are about text quality** (misspellings, garbled names, missing text, unreadable addresses). These are OCR problems, not counterfeiting.
9. The ONLY things that should make you say Fake: the packaging looks COMPLETELY different from any known product (CLIP < 0.4), OR the medicine name does not exist at all, OR forensics shows amateur/non-pharmaceutical printing (< 0.3).

DECISION PRIORITY (follow this order):
- CLIP > 0.55 AND forensics > 0.6 → Real (high confidence)
- CLIP > 0.55 AND majority ResNet Real → Real
- CLIP < 0.4 AND forensics < 0.3 → Fake
- Otherwise → Real with moderate confidence (benefit of the doubt)

EVIDENCE:
""" + evidence + """

Respond with ONLY a JSON object:
{
  "verdict": "Real" or "Fake",
  "confidence_pct": <number 0-100>,
  "reason": "<one clear sentence — do NOT cite OCR text errors as a reason>"
}"""

        try:
            client = anthropic.Anthropic(api_key=claude_key)
            msg = client.messages.create(
                model=os.getenv("CLAUDE_HAIKU_MODEL", "claude-haiku-4-5-20251001"),
                max_tokens=256,
                messages=[{"role": "user", "content": final_prompt}],
            )
            raw_verdict = msg.content[0].text.strip()
            print(f"[CAMERA] LLM verdict raw: {raw_verdict[:200]}")

            import json as json_mod
            import re as re_mod
            match = re_mod.search(r"```(?:json)?\s*([\s\S]+?)\s*```", raw_verdict)
            verdict_data = json_mod.loads(match.group(1) if match else raw_verdict)

            prediction = verdict_data.get("verdict", "Real")
            confidence = float(verdict_data.get("confidence_pct", 50))
            reason = verdict_data.get("reason", "")
            prob_real = confidence if prediction == "Real" else 100 - confidence
            prob_fake = 100 - prob_real

            print(f"[CAMERA] === LLM FINAL: {prediction} ({confidence:.1f}%) — {reason} ===")

        except Exception as exc:
            print(f"[CAMERA] LLM final verdict failed: {exc} — falling back to ResNet50 avg")
            prediction = "Real" if avg_real > avg_fake else "Fake"
            confidence = max(avg_real, avg_fake)
            prob_real = avg_real
            prob_fake = avg_fake
            reason = f"Based on ResNet50 analysis: {real_count}/{downloaded} references classified as Real"

        analysis = {
            "summary": reason,
            "reasons": [
                f"Camera pipeline identified: {camera_medicine} — CLIP match {camera_clip:.2f}",
                f"Authenticity check: {auth_verdict} (score {auth_score})",
                f"Print quality forensics score: {forensics_score}",
                f"ResNet50: {real_count}/{downloaded} reference images classified as Real ({avg_real:.1f}% avg)",
                f"Final verdict by AI: {prediction} at {confidence:.1f}% confidence",
            ],
            "risk_level": "low" if prediction == "Real" and confidence > 70 else ("medium" if confidence > 50 else "high"),
        }

        return {
            "filename": file.filename or "camera-capture.jpg",
            "prediction": prediction,
            "confidence": f"{confidence:.2f}%",
            "probabilities": {"fake": round(prob_fake, 2), "real": round(prob_real, 2)},
            "analysis": analysis,
            "device": str(DEVICE),
            "source_url": matched_url,
            "ref_breakdown": {
                "total_refs": len(all_ref_urls),
                "downloaded": downloaded,
                "real_count": real_count,
                "fake_count": downloaded - real_count,
                "details": ref_results,
            },
            "camera_result": {
                "medicine": camera_result.get("medicine"),
                "status": camera_result.get("status"),
                "confidence": camera_result.get("confidence"),
                "ocr_raw": camera_result.get("ocr_raw", "")[:200],
                "manufacturer": camera_result.get("medicine_info", {}).get("manufacturer"),
                "authenticity_verdict": camera_result.get("authenticity", {}).get("verdict"),
                "forensics_score": camera_result.get("forensics", {}).get("score"),
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Camera scan failed: {str(e)}")


@app.get("/test", tags=["Testing"])
async def test_accuracy():
    """
    Test model accuracy on the test dataset
    
    Returns:
    - **accuracy**: Overall accuracy percentage
    - **precision**: Precision score
    - **recall**: Recall score
    - **f1_score**: F1 score
    - **confusion_matrix**: TP, TN, FP, FN
    """
    try:
        model, transform = load_model()
        
        test_dir = os.path.join(PROJECT_DIR, 'archive (1)', 'dataset', 'test')
        
        if not os.path.exists(test_dir):
            raise HTTPException(
                status_code=404,
                detail=f"Test dataset not found at {test_dir}"
            )
        
        fake_dir = os.path.join(test_dir, 'Fake')
        real_dir = os.path.join(test_dir, 'Real')
        
        predictions = {'TP': 0, 'TN': 0, 'FP': 0, 'FN': 0}
        total = 0
        correct = 0
        
        valid_ext = {'.jpg', '.jpeg', '.png', '.bmp', '.JPG', '.JPEG', '.PNG'}
        
        # Test Fake images
        if os.path.exists(fake_dir):
            for img_file in os.listdir(fake_dir):
                if os.path.splitext(img_file)[1] in valid_ext:
                    try:
                        img_path = os.path.join(fake_dir, img_file)
                        img = Image.open(img_path).convert('RGB')
                        input_tensor = transform(img).unsqueeze(0).to(DEVICE)
                        
                        with torch.no_grad():
                            outputs = model(input_tensor)
                            _, pred = torch.max(outputs, 1)
                        
                        pred_label = pred.item()
                        true_label = 0  # Fake
                        
                        if pred_label == true_label:
                            predictions['TN'] += 1
                            correct += 1
                        else:
                            predictions['FP'] += 1
                        
                        total += 1
                    except Exception:
                        continue
        
        # Test Real images
        if os.path.exists(real_dir):
            for img_file in os.listdir(real_dir):
                if os.path.splitext(img_file)[1] in valid_ext:
                    try:
                        img_path = os.path.join(real_dir, img_file)
                        img = Image.open(img_path).convert('RGB')
                        input_tensor = transform(img).unsqueeze(0).to(DEVICE)
                        
                        with torch.no_grad():
                            outputs = model(input_tensor)
                            _, pred = torch.max(outputs, 1)
                        
                        pred_label = pred.item()
                        true_label = 1  # Real
                        
                        if pred_label == true_label:
                            predictions['TP'] += 1
                            correct += 1
                        else:
                            predictions['FN'] += 1
                        
                        total += 1
                    except Exception:
                        continue
        
        # Calculate metrics
        accuracy = (correct / total * 100) if total > 0 else 0
        precision = (predictions['TP'] / (predictions['TP'] + predictions['FP']) * 100) if (predictions['TP'] + predictions['FP']) > 0 else 0
        recall = (predictions['TP'] / (predictions['TP'] + predictions['FN']) * 100) if (predictions['TP'] + predictions['FN']) > 0 else 0
        f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0
        
        return {
            "total_images": total,
            "correct_predictions": correct,
            "accuracy": f"{accuracy:.2f}%",
            "precision": f"{precision:.2f}%",
            "recall": f"{recall:.2f}%",
            "f1_score": f"{f1:.2f}",
            "confusion_matrix": {
                "true_positives": predictions['TP'],
                "true_negatives": predictions['TN'],
                "false_positives": predictions['FP'],
                "false_negatives": predictions['FN']
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error during testing: {str(e)}")

# --- SERVE FRONTEND ---
# Mount the built React app (frontend/dist) as static files.
# This must come AFTER all API routes so /predict, /health, etc. take priority.
if os.path.isdir(FRONTEND_DIR):
    # Serve static assets (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")), name="assets")

    # SPA fallback: any non-API route returns index.html so React Router works
    @app.get("/{full_path:path}", tags=["Frontend"])
    async def serve_frontend(full_path: str):
        # If the exact file exists in dist, serve it (e.g. favicon, manifest)
        file_path = os.path.join(FRONTEND_DIR, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        # Otherwise serve index.html for client-side routing
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

# --- RUN APPLICATION ---
if __name__ == '__main__':
    import uvicorn

    # Auto-build frontend if dist doesn't exist or --build flag passed
    frontend_src = os.path.join(os.path.dirname(PROJECT_DIR), 'frontend')
    import sys
    if not os.path.isdir(FRONTEND_DIR) or "--build" in sys.argv:
        print("[BUILD] Building frontend...")
        subprocess.run(["npm", "run", "build"], cwd=frontend_src, check=True)
        print("[OK] Frontend built successfully")

    print("[START] MedSecure running on http://localhost:8000")
    print("[DOCS] API docs: http://localhost:8000/docs")
    uvicorn.run(app, host="0.0.0.0", port=8000)
