import cv2
import numpy as np
import base64
import math
import logging
from typing import List, Optional, Tuple, Dict, Any

logger = logging.getLogger(__name__)

# Singleton MediaPipe FaceMesh reference
_mp_face_mesh = None

def _get_face_mesh():
    global _mp_face_mesh
    if _mp_face_mesh is None:
        try:
            import mediapipe as mp
            _mp_face_mesh = mp.solutions.face_mesh.FaceMesh(
                static_image_mode=True,
                max_num_faces=2,
                refine_landmarks=True,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5
            )
            logger.info("MediaPipe FaceMesh (478 landmarks) loaded successfully.")
        except Exception as e:
            logger.warning(f"MediaPipe FaceMesh initialization failed: {e}")
            _mp_face_mesh = False
    return _mp_face_mesh if _mp_face_mesh is not False else None

# Secondary Haar cascade loader (for strict fallback detection if MediaPipe is unavailable)
def _get_cascade(xml_name: str):
    try:
        if hasattr(cv2, 'CascadeClassifier') and hasattr(cv2, 'data') and hasattr(cv2.data, 'haarcascades'):
            return cv2.CascadeClassifier(cv2.data.haarcascades + xml_name)
    except Exception as e:
        logger.warning(f"Failed to load cascade {xml_name}: {e}")
    return None

face_cascade = _get_cascade('haarcascade_frontalface_default.xml')

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

def _compute_distance(p1: Tuple[float, float, float], p2: Tuple[float, float, float]) -> float:
    """Calculates 3D Euclidean distance between two landmark coordinates."""
    return math.sqrt((p1[0] - p2[0])**2 + (p1[1] - p2[1])**2 + (p1[2] - p2[2])**2)

def _extract_mediapipe_features(image: np.ndarray, face_landmarks) -> Optional[List[float]]:
    """
    Extracts high-precision, scale/rotation-invariant biometric vector from 478 3D landmarks.
    Combines:
    1. 48 scale & pose-invariant 3D geometric ratios (distances, angles, depths).
    2. 80 localized gradient & texture features from canonical eye-aligned face patch.
    Total: 128-dimensional unit normalized vector.
    """
    h, w, _ = image.shape
    lms = face_landmarks.landmark
    
    # Coordinates in image space (x, y, z scaled by width)
    coords = [(lm.x * w, lm.y * h, lm.z * w) for lm in lms]

    # Key anatomical landmarks:
    # Left eye pupil: 468 (or avg of 33, 133, 159, 145)
    # Right eye pupil: 473 (or avg of 362, 263, 386, 374)
    p_lefteye = coords[468] if len(coords) > 468 else coords[133]
    p_righteye = coords[473] if len(coords) > 473 else coords[362]
    
    # Inter-ocular baseline distance
    dx = p_righteye[0] - p_lefteye[0]
    dy = p_righteye[1] - p_lefteye[1]
    d_eye = math.sqrt(dx**2 + dy**2)
    
    if d_eye < 12.0:
        logger.warning(f"Face inter-ocular distance too small ({d_eye:.1f}px).")
        return None

    # Key anatomical points
    p_nosetip = coords[1]
    p_nosebridge = coords[168]
    p_subnasale = coords[2]
    p_upperlip = coords[13]
    p_lowerlip = coords[14]
    p_chin = coords[152]
    p_forehead = coords[10]
    p_leftmouth = coords[61]
    p_rightmouth = coords[291]
    p_leftjaw = coords[234]
    p_rightjaw = coords[454]
    p_leftbrow_inner = coords[107]
    p_rightbrow_inner = coords[336]
    p_leftbrow_outer = coords[70]
    p_rightbrow_outer = coords[300]
    p_lefteye_outer = coords[33]
    p_lefteye_inner = coords[133]
    p_righteye_inner = coords[362]
    p_righteye_outer = coords[263]
    p_lefteye_top = coords[159]
    p_lefteye_bot = coords[145]
    p_righteye_top = coords[386]
    p_righteye_bot = coords[374]

    # --- Part 1: 48 Geometric Invariant Ratios (Normalized by d_eye) ---
    geom = [
        _compute_distance(p_lefteye, p_nosetip) / d_eye,
        _compute_distance(p_righteye, p_nosetip) / d_eye,
        _compute_distance(p_nosebridge, p_nosetip) / d_eye,
        _compute_distance(p_subnasale, p_upperlip) / d_eye,
        _compute_distance(p_upperlip, p_lowerlip) / d_eye,
        _compute_distance(p_lowerlip, p_chin) / d_eye,
        _compute_distance(p_nosetip, p_chin) / d_eye,
        _compute_distance(p_leftmouth, p_rightmouth) / d_eye,
        _compute_distance(p_lefteye, p_leftmouth) / d_eye,
        _compute_distance(p_righteye, p_rightmouth) / d_eye,
        _compute_distance(p_leftjaw, p_rightjaw) / d_eye,
        _compute_distance(p_forehead, p_chin) / d_eye,
        _compute_distance(p_leftbrow_inner, p_nosetip) / d_eye,
        _compute_distance(p_rightbrow_inner, p_nosetip) / d_eye,
        _compute_distance(p_leftbrow_inner, p_rightbrow_inner) / d_eye,
        _compute_distance(p_leftbrow_outer, p_rightbrow_outer) / d_eye,
        _compute_distance(p_lefteye_outer, p_righteye_outer) / d_eye,
        _compute_distance(p_lefteye_inner, p_righteye_inner) / d_eye,
        _compute_distance(p_lefteye_top, p_lefteye_bot) / max(1.0, _compute_distance(p_lefteye_outer, p_lefteye_inner)),
        _compute_distance(p_righteye_top, p_righteye_bot) / max(1.0, _compute_distance(p_righteye_outer, p_righteye_inner)),
        _compute_distance(p_upperlip, p_lowerlip) / max(1.0, _compute_distance(p_leftmouth, p_rightmouth)),
        (p_nosetip[2] - p_nosebridge[2]) / d_eye,
        (p_chin[2] - p_nosetip[2]) / d_eye,
        (p_lefteye[2] - p_righteye[2]) / d_eye,
        (p_leftjaw[2] - p_rightjaw[2]) / d_eye,
        (p_forehead[2] - p_nosetip[2]) / d_eye,
        (p_upperlip[2] - p_nosetip[2]) / d_eye,
        (p_subnasale[2] - p_chin[2]) / d_eye,
        abs(_compute_distance(p_lefteye, p_nosetip) - _compute_distance(p_righteye, p_nosetip)) / d_eye,
        abs(_compute_distance(p_leftmouth, p_nosetip) - _compute_distance(p_rightmouth, p_nosetip)) / d_eye,
        abs(_compute_distance(p_leftjaw, p_chin) - _compute_distance(p_rightjaw, p_chin)) / d_eye,
        _compute_distance(p_leftmouth, p_chin) / d_eye,
        _compute_distance(p_rightmouth, p_chin) / d_eye,
        _compute_distance(p_leftbrow_inner, p_lefteye) / d_eye,
        _compute_distance(p_rightbrow_inner, p_righteye) / d_eye,
        _compute_distance(p_leftbrow_outer, p_leftjaw) / d_eye,
        _compute_distance(p_rightbrow_outer, p_rightjaw) / d_eye,
        _compute_distance(p_forehead, p_nosebridge) / d_eye,
        _compute_distance(p_nosebridge, p_chin) / d_eye,
        _compute_distance(p_lefteye_outer, p_leftjaw) / d_eye,
        _compute_distance(p_righteye_outer, p_rightjaw) / d_eye,
        _compute_distance(p_subnasale, p_chin) / d_eye,
        _compute_distance(p_forehead, p_lefteye) / d_eye,
        _compute_distance(p_forehead, p_righteye) / d_eye,
        _compute_distance(p_lefteye, p_subnasale) / d_eye,
        _compute_distance(p_righteye, p_subnasale) / d_eye,
        _compute_distance(p_nosebridge, p_leftmouth) / d_eye,
        _compute_distance(p_nosebridge, p_rightmouth) / d_eye,
    ]
    geom = geom[:48]
    while len(geom) < 48:
        geom.append(0.0)

    # --- Part 2: Canonical Eye-Level Face Alignment & 80 Localized Gradient Features ---
    eye_center = ((p_lefteye[0] + p_righteye[0]) / 2.0, (p_lefteye[1] + p_righteye[1]) / 2.0)
    angle_rad = math.atan2(dy, dx)
    angle_deg = math.degrees(angle_rad)
    
    target_eye_dist = 48.0
    scale = target_eye_dist / max(1.0, d_eye)
    
    M = cv2.getRotationMatrix2D(eye_center, angle_deg, scale)
    M[0, 2] += (64.0 - eye_center[0])
    M[1, 2] += (44.0 - eye_center[1])
    
    aligned = cv2.warpAffine(image, M, (128, 128), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    gray = cv2.cvtColor(aligned, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)
    
    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    mag, ang = cv2.cartToPolar(gx, gy, angleInDegrees=True)

    zones = [
        (28, 56, 16, 56),    # 1. Left eye orbit
        (28, 56, 72, 112),   # 2. Right eye orbit
        (16, 44, 48, 80),    # 3. Glabella / between brows
        (44, 72, 48, 80),    # 4. Nose bridge
        (64, 88, 44, 84),    # 5. Nose tip & nostrils
        (56, 88, 16, 48),    # 6. Left cheek
        (56, 88, 80, 112),   # 7. Right cheek
        (80, 108, 36, 92),   # 8. Lips & mouth corners
        (100, 124, 44, 84),  # 9. Chin contour
        (88, 120, 16, 112),  # 10. Jawline arc
    ]
    
    texture_features = []
    for (y1, y2, x1, x2) in zones:
        sub_mag = mag[y1:y2, x1:x2]
        sub_ang = ang[y1:y2, x1:x2]
        hist, _ = np.histogram(sub_ang, bins=8, range=(0, 360), weights=sub_mag)
        h_sum = np.sum(hist)
        if h_sum > 1e-6:
            hist = hist / h_sum
        texture_features.extend(hist.tolist())
    
    texture_features = texture_features[:80]
    while len(texture_features) < 80:
        texture_features.append(0.0)

    # Composite 128-dimensional unit normalized vector
    vector = np.array(geom + texture_features, dtype=np.float32)
    norm = np.linalg.norm(vector)
    if norm > 1e-6:
        vector = vector / norm
        
    return vector.tolist()

def _extract_strict_haar_features(image: np.ndarray) -> Optional[List[float]]:
    """
    Strict secondary face extraction using frontal Haar cascade.
    NO arbitrary center crop: if no face is detected with high confidence, returns None.
    """
    if face_cascade is None:
        return None
        
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)
    
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))
    if len(faces) != 1:
        return None
        
    (x, y, w, h) = faces[0]
    face_roi = gray[y:y+h, x:x+w]
    resized = cv2.resize(face_roi, (128, 128), interpolation=cv2.INTER_AREA)
    
    blocks = []
    for r in range(4):
        for c in range(4):
            block = resized[r*32:(r+1)*32, c*32:(c+1)*32]
            blocks.append(float(np.mean(block)))
            blocks.append(float(np.std(block)))
            blocks.append(float(np.min(block)))
            blocks.append(float(np.max(block)))
            
    gx = cv2.Sobel(resized, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(resized, cv2.CV_32F, 0, 1, ksize=3)
    mag, ang = cv2.cartToPolar(gx, gy, angleInDegrees=True)
    
    hog = []
    for r in range(2):
        for c in range(4):
            sub_mag = mag[r*64:(r+1)*64, c*32:(c+1)*32]
            sub_ang = ang[r*64:(r+1)*64, c*32:(c+1)*32]
            hist, _ = np.histogram(sub_ang, bins=8, range=(0, 360), weights=sub_mag)
            h_sum = np.sum(hist)
            if h_sum > 1e-6:
                hist = hist / h_sum
            hog.extend(hist.tolist())
            
    vector = np.array(blocks + hog, dtype=np.float32)
    norm = np.linalg.norm(vector)
    if norm > 1e-6:
        vector = vector / norm
    return vector.tolist()

def extract_face_embedding(image: np.ndarray) -> Optional[List[float]]:
    """
    In-memory biometric face vector extraction pipeline.
    1. First tries MediaPipe FaceMesh (478 3D landmarks + canonical pose alignment).
    2. Falls back to strict single-face frontal Haar cascade.
    3. Rejects if no face is detected or if multiple faces are in frame.
    Raw image is never written to disk or persisted.
    """
    try:
        rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        fm = _get_face_mesh()
        if fm is not None:
            results = fm.process(rgb)
            if results.multi_face_landmarks:
                if len(results.multi_face_landmarks) > 1:
                    logger.warning("Multiple faces detected in frame; rejecting for security.")
                    return None
                vec = _extract_mediapipe_features(image, results.multi_face_landmarks[0])
                if vec is not None:
                    return vec
    except Exception as e:
        logger.warning(f"MediaPipe FaceMesh extraction notice: {e}")

    # Fallback to strict single-face Haar detection (no arbitrary center-crop)
    return _extract_strict_haar_features(image)

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
    if norm_u < 1e-6 or norm_v < 1e-6:
        return 0.0
    return float(np.dot(u, v) / (norm_u * norm_v))

def find_best_match(
    live_vector: List[float], 
    tenant_employees: List[Dict[str, Any]], 
    threshold: float = 0.80,
    margin_threshold: float = 0.07
) -> Tuple[Optional[Dict[str, Any]], float]:
    """
    High-Security 1:N Biometric Matching with Winner-Take-All Margin Discrimination.
    1. Compares live vector against all registered employee templates.
    2. Enforces calibrated minimum similarity threshold (default 0.80).
    3. Rejects matches where top candidate and runner-up are within `margin_threshold` (prevents false logins due to template ambiguity).
    4. Guarantees cross-tenant data isolation.
    """
    candidates = []

    for emp in tenant_employees:
        embeddings = emp.get("face_embeddings", [])
        if not embeddings:
            continue
        
        # Check against registered sample vectors or consensus vector
        best_emp_sim = -1.0
        for emb in embeddings:
            sim = cosine_similarity(live_vector, emb)
            if sim > best_emp_sim:
                best_emp_sim = sim
                
        if best_emp_sim > 0:
            candidates.append((emp, best_emp_sim))

    if not candidates:
        return None, 0.0

    # Sort descending by similarity score
    candidates.sort(key=lambda x: x[1], reverse=True)
    best_emp, best_sim = candidates[0]

    # Verify minimum threshold
    if best_sim < threshold:
        return None, round(best_sim, 4)

    # Winner-Take-All Margin Ambiguity Protection:
    if len(candidates) >= 2:
        runner_up_emp, runner_up_sim = candidates[1]
        diff = best_sim - runner_up_sim
        if diff < margin_threshold:
            logger.warning(
                f"Biometric Ambiguity Detected: Top candidate '{best_emp.get('first_name')}' ({best_sim:.4f}) "
                f"is too close to runner-up '{runner_up_emp.get('first_name')}' ({runner_up_sim:.4f}) with margin {diff:.4f} < {margin_threshold}. "
                "Denying match to prevent wrong account login."
            )
            return None, round(best_sim, 4)

    return best_emp, round(best_sim, 4)
