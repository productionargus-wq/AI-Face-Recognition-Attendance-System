import pytest
import numpy as np
from app.services.face_service import cosine_similarity, find_best_match
from app.services.liveness_service import liveness_service
from app.core.security import verify_password, get_password_hash, create_access_token, decode_token

def test_password_hashing():
    pw = "ArgusSecurePass2026!"
    hashed = get_password_hash(pw)
    assert verify_password(pw, hashed) is True
    assert verify_password("WrongPassword", hashed) is False

def test_jwt_token_generation():
    payload = {"sub": "user-123", "org_id": "org-456", "role": "org_admin"}
    token = create_access_token(payload)
    decoded = decode_token(token)
    assert decoded["sub"] == "user-123"
    assert decoded["org_id"] == "org-456"
    assert decoded["role"] == "org_admin"

def test_cosine_similarity_identity():
    # Random 128-d vector
    vec1 = np.random.rand(128).astype(np.float32)
    vec1 /= np.linalg.norm(vec1)
    
    # Exact match similarity must be 1.0
    sim = cosine_similarity(vec1.tolist(), vec1.tolist())
    assert abs(sim - 1.0) < 1e-4

def test_tenant_face_matching_isolation():
    vec_emp1 = (np.ones(128, dtype=np.float32) / np.sqrt(128)).tolist()
    vec_emp2 = (-np.ones(128, dtype=np.float32) / np.sqrt(128)).tolist()
    
    tenant_employees = [
        {"id": "emp-1", "first_name": "John", "last_name": "Doe", "face_embeddings": [vec_emp1]}
    ]
    
    # Matching with vec_emp1 should find emp-1
    matched, conf = find_best_match(vec_emp1, tenant_employees, threshold=0.7)
    assert matched is not None
    assert matched["id"] == "emp-1"
    assert conf > 0.9
    
    # Matching with opposite vector should yield no match
    no_match, conf2 = find_best_match(vec_emp2, tenant_employees, threshold=0.7)
    assert no_match is None

def test_margin_ambiguity_protection():
    # Two employees with almost identical templates
    vec_base = (np.ones(128, dtype=np.float32) / np.sqrt(128)).tolist()
    # Tiny difference (0.01) between emp A and emp B
    vec_a = list(vec_base)
    vec_b = list(vec_base)
    vec_b[0] += 0.01
    
    tenant_employees = [
        {"id": "emp-a", "first_name": "Alice", "face_embeddings": [vec_a]},
        {"id": "emp-b", "first_name": "Bob", "face_embeddings": [vec_b]}
    ]
    
    # Matching should reject because difference is smaller than margin_threshold (0.07)
    match, conf = find_best_match(vec_base, tenant_employees, threshold=0.80, margin_threshold=0.07)
    assert match is None  # Rejection protects against wrong login!

def test_liveness_challenge_generation():
    challenge = liveness_service.generate_random_challenge()
    assert "instruction" in challenge
    assert "action" in challenge

def test_haversine_distance_calculation():
    from app.api.v1.reports import calculate_haversine_distance
    # Chennai Central (13.0827, 80.2707) to Marina Beach (13.0500, 80.2824) ~ 3.8 km
    dist = calculate_haversine_distance(13.0827, 80.2707, 13.0500, 80.2824)
    assert 3500 <= dist <= 4100
    
    # Same point distance should be 0.0
    zero_dist = calculate_haversine_distance(13.0827, 80.2707, 13.0827, 80.2707)
    assert zero_dist == 0.0

def test_geofence_perimeter_logic():
    from app.api.v1.reports import calculate_haversine_distance
    office_lat, office_lon = 13.0827, 80.2707
    radius = 150  # 150 meters
    
    # 50m away point (Inside)
    inside_lat = 13.0831
    inside_lon = 80.2707
    dist_inside = calculate_haversine_distance(office_lat, office_lon, inside_lat, inside_lon)
    assert dist_inside <= radius
    
    # 500m away point (Outside)
    outside_lat = 13.0870
    outside_lon = 80.2707
    dist_outside = calculate_haversine_distance(office_lat, office_lon, outside_lat, outside_lon)
    assert dist_outside > radius