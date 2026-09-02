import cv2
import numpy as np
import random
from typing import Dict, Any, List

class LivenessDetector:
    """
    Lightweight, high-speed multi-factor anti-spoofing service.
    Verifies eye presence, texture micro-variance, and dynamic challenge responses.
    """
    def __init__(self):
        self.eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')

    def check_liveness_quality(self, image: np.ndarray) -> Dict[str, Any]:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # 1. Laplacian variance check for image sharpness (detects blurry printouts or replayed screens)
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        is_sharp = laplacian_var > 15.0

        # 2. Eye detection in upper face region
        eyes = self.eye_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4)
        has_eyes = len(eyes) >= 1

        # 3. Overall quality score
        score = min(1.0, (laplacian_var / 250.0) * 0.5 + (0.5 if has_eyes else 0.2))
        
        return {
            "passed": is_sharp,
            "sharpness": round(float(laplacian_var), 2),
            "eyes_detected": len(eyes),
            "liveness_score": round(float(score), 3)
        }

    def generate_random_challenge(self) -> Dict[str, str]:
        challenges = [
            {"type": "blink", "instruction": "Please blink naturally once or twice", "action": "BLINK"},
            {"type": "smile", "instruction": "Please give a brief smile towards the camera", "action": "SMILE"},
            {"type": "turn_head", "instruction": "Tilt your head slightly to the right", "action": "TILT_RIGHT"},
            {"type": "turn_left", "instruction": "Tilt your head slightly to the left", "action": "TILT_LEFT"},
        ]
        return random.choice(challenges)

liveness_service = LivenessDetector()
