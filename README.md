# Argus AI Attendance System - Multi-Tenant SaaS Platform

Simple, light-themed, and responsive **Facial Recognition Attendance Web Application** for Argus Technologies and client organizations.

---

## 🌟 Key Features

1. **Multi-Tenant Data Isolation**: Complete tenant data isolation (`organization_id`). Facial vector matching is strictly scoped to each organization's employee pool.
2. **Privacy First (Biometric Compliance)**: In-memory camera frame processing. Stores **only 128-d float embeddings**, never raw photos.
3. **Simple & Intuitive Light Theme UI**:
   - **Kiosk Mode (`/kiosk`)**: Big camera oval with real-time liveness prompt (*"Look at camera & blink"*) and instant check-in/out feedback.
   - **Admin Dashboard (`/admin`)**: Summary KPIs, live roster feed, 1-click **Excel (.xlsx)** & **CSV** exports, and 3-step employee enrollment wizard.
   - **Employee Self-Service (`/portal`)**: View monthly hours, timestamps, and biometric consent verification.
4. **Interactive Anti-Spoofing Liveness Detection**: Motion & sharpness validation prevents photo/screen playback spoofing.
5. **Render Ready**: `render.yaml` & `Dockerfile` included for one-click cloud deployment.

---

## 🚀 Quick Start (Local Development)

### 1. Backend Setup
```bash
cd backend
python -m pip install -r requirements.txt
python seed.py
python -m uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

Visit: `http://localhost:5173`

---

## 🏢 Preloaded Demo Credentials

| Role | Organization | Email | Password |
|---|---|---|---|
| **Org Admin** | Argus Technologies | `admin@argustech.ai` | `ArgusAdmin@2026` |
| **Org Admin** | Acme Global Corp | `admin@acmecorp.com` | `AcmeAdmin@2026` |
| **Employee** | Argus Technologies (Alex) | `alex.vance@argustech.ai` | `Argus@123` |
