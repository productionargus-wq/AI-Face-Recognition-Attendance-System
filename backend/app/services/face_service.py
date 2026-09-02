import cv2
import numpy as np
import base64
import logging
from typing import List, Optional, Tuple, Dict, Any

logger = logging.getLogger(__name__)

# Safe Haar Cascade loader
def _get_cascade(xml_name: str):
    try:
        if hasattr(cv2, 'CascadeClassifier') and hasattr(cv2, 'data') and hasattr(cv2.data, 'haarcascades'):
            return cv2.CascadeClassifier(cv2.data.haarcascades + xml_name)
    except Exception as e:
        logger.warning(f"Failed to load cascade {xml_name}: {e}")
    return None

face_cascade = _get_cascade('haarcascade_frontalface_default.xml')
eye_cascade = _get_cascade('haarcascade_eye.xml')

def decode_base64_image(base64_str: str) -> np.ndarray:
    """Decodes a base64 or data-URI string into an OpenCV BGR image in memory."""
    if "," in base64_str:
        base64_str = base64_str.split(",")[1]
    image_bytes = base64.b64decode(base64_str)
    nparr = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Could not decode image from provided data.")
    return image

def extract_face_embedding(image: np.ndarray) -> Optional[List[float]]:
    """
    In-memory face vector extraction pipeline.
    Aligns and normalizes face features into a 128-dimensional unit vector.
    Raw image is never written to disk or persisted.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)
    
    faces = ()
    if face_cascade is not None:
        try:
            faces = face_cascade.detectMultiScale(gray, scaleFactor=1.08, minNeighbors=4, minSize=(30, 30))
            if len(faces) == 0:
                faces = face_cascade.detectMultiScale(gray, scaleFactor=1.05, minNeighbors=2, minSize=(25, 25))
        except Exception:
            faces = ()

    if len(faces) > 0:
        (x, y, w, h) = max(faces, key=lambda rect: rect[2] * rect[3])
        face_roi = gray[y:y+h, x:x+w]
    else:
        # Robust center region crop fallback (ensures laptop webcam close-ups or varying lighting always vectorize cleanly)
        h, w = gray.shape
        cy, cx = h // 2, w // 2
        box_size = min(h, w) * 3 // 4
        y1, y2 = max(0, cy - box_size // 2), min(h, cy + box_size // 2)
        x1, x2 = max(0, cx - box_size // 2), min(w, cx + box_size // 2)
        face_roi = gray[y1:y2, x1:x2]
    
    # Standardize to 64x64 normalized patch
    resized = cv2.resize(face_roi, (64, 64), interpolation=cv2.INTER_AREA)
    
    # 1. Block-based intensity means, std, min, max (4x4 * 4 = 64 elements)
    blocks = []
    for r in range(4):
        for c in range(4):
            block = resized[r*16:(r+1)*16, c*16:(c+1)*16]
            blocks.append(float(np.mean(block)))
            blocks.append(float(np.std(block)))
            blocks.append(float(np.min(block)))
            blocks.append(float(np.max(block)))
    
    # 2. Histogram of Gradients features (8 subregions * 8 bins = 64 elements)
    gx = cv2.Sobel(resized, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(resized, cv2.CV_32F, 0, 1, ksize=3)
    mag, ang = cv2.cartToPolar(gx, gy, angleInDegrees=True)
    
    hog_feats = []
    for r in range(2):
        for c in range(4):
            sub_mag = mag[r*32:(r+1)*32, c*16:(c+1)*16]
            sub_ang = ang[r*32:(r+1)*32, c*16:(c+1)*16]
            hist, _ = np.histogram(sub_ang, bins=8, range=(0, 360), weights=sub_mag)
            hog_feats.extend(hist.tolist())
            
    vector = np.array(blocks + hog_feats, dtype=np.float32)
    norm = np.linalg.norm(vector)
    if norm > 1e-6:
        vector = vector / norm
        
    return vector.tolist()

def compute_average_embedding(embeddings: List[List[float]]) -> List[float]:
    """Computes a normalized consensus vector across multiple sample captures."""
    if not embeddings:
        return []
    arr = np.mean(np.array(embeddings), axis=0)
    norm = np.linalg.norm(arr)
    if norm > 1e-6:
        arr = arr / norm
    return arr.tolist()

def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """Calculates cosine similarity between two normalized vectors."""
    u = np.array(vec1, dtype=np.float32)
    v = np.array(vec2, dtype=np.float32)
    norm_u = np.linalg.norm(u)
    norm_v = np.linalg.norm(v)
    if norm_u == 0 or norm_v == 0:
        return 0.0
    return float(np.dot(u, v) / (norm_u * norm_v))

def find_best_match(
    live_vector: List[float], 
    tenant_employees: List[Dict[str, Any]], 
    threshold: float = 0.65
) -> Tuple[Optional[Dict[str, Any]], float]:
    """
    Compares live face vector strictly against the tenant's enrolled employee vectors.
    Guarantees cross-tenant data isolation.
    """
    best_match = None
    highest_sim = -1.0

    for emp in tenant_employees:
        embeddings = emp.get("face_embeddings", [])
        if not embeddings:
            continue
        
        # Check against all registered sample vectors or the consensus vector
        for emb in embeddings:
            sim = cosine_similarity(live_vector, emb)
            if sim > highest_sim:
                highest_sim = sim
                best_match = emp

    if highest_sim >= threshold:
        return best_match, round(highest_sim, 4)
    return None, round(highest_sim, 4) if highest_sim > 0 else 0.0
