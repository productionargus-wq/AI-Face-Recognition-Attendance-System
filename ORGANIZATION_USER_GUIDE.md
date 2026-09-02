# 📘 Argus AI Attendance Platform — User & Organization Guide

Welcome to the **Argus AI Attendance System**, an enterprise-grade, multi-tenant facial recognition attendance and liveness verification platform.

This guide provides step-by-step instructions for:
1. **New Organizations & HR Administrators** (Account setup, employee onboarding, analytics, and reports).
2. **Employees & Staff** (Daily kiosk check-in/out and personal self-service portal).

---

## 🏢 Part 1: Guide for Organizations & Administrators

### 1. Onboarding Your Organization (Multi-Tenancy)
If your company is new to Argus AI Attendance:
1. Go to the platform URL and click **`Register Org`** in the top navigation.
2. Fill in your details:
   - **Organization Name** (e.g., *Acme Global Corporation*)
   - **Company Slug** (a unique identifier, e.g., `acme-corp`)
   - **Admin Email & Password**
   - **Work Hours & Late Grace Period** (e.g., 09:00 AM start with 15 mins grace).
3. Click **Create Organization Account**.
> 🔒 **Privacy & Data Security**: Your organization's employee profiles, attendance logs, and biometric face vectors are strictly partitioned in the database and completely invisible to any other organization.

---

### 2. Enrolling New Employees & Biometric Face Vectors
To add an employee and capture their facial vector:
1. Log in with your Admin account at `/login` and navigate to the **Admin Dashboard**.
2. Click the blue **`+ Add & Enroll Employee`** button.
3. Follow the **3-Step Wizard**:
   - **Step 1: Details** — Enter Employee ID (e.g., `EMP-101`), Full Name, Department, and Email.
   - **Step 2: Privacy Consent** — Explicit biometric processing consent check (GDPR & Data Privacy Compliant).
   - **Step 3: Face Vector Capture** — Position the employee in front of the camera inside the oval guide and click **`Auto-Capture 3 Samples`**. Click **`Save Face Vector`**.

> 🛡️ **Zero Photo Storage Policy**: The platform never saves or stores photographic image files on disk or databases. The system converts facial geometry into a mathematical 128-dimensional embedding vector directly in RAM and discards the image immediately.

---

### 3. Monitoring Daily Attendance & Exporting Reports
1. In the **Admin Dashboard**:
   - **Summary Cards**: View real-time KPIs (*Total Employees, Present Today, Late Arrivals, Absent*).
   - **Live Attendance Feed**: Real-time timestamps, verification mode (`FACE_KIOSK`), and match confidence scores.
2. **Exporting Records**:
   - Click **`Export Excel (.xlsx)`** or **`Export CSV`** in the top right to download attendance reports for payroll and compliance.

---

## 👤 Part 2: Guide for Employees

### 1. Touchless Kiosk Check-In & Check-Out
No physical contact, RFID cards, or fingerprints required!

1. Walk up to the dedicated iPad, tablet, or PC kiosk terminal (`/kiosk`).
2. Verify that your **Organization** is selected in the top dropdown.
3. Position your face inside the circle guide.
4. Follow the anti-spoofing challenge prompt (*e.g., "Look directly at camera & blink naturally"*).
5. Click **`Verify & Log Attendance`** (or stand in front of the camera).
6. **Confirmation**:
   - A **green checkmark card** appears with your name, department, and timestamp.
   - **1st scan of the day** = Recorded as **Check-In**.
   - **2nd scan of the day** = Recorded as **Check-Out** (calculates total working hours).

---

### 2. Employee Self-Service Portal
1. Open the login page and sign in with your employee email and password.
2. Go to **`My Attendance`** (`/portal`):
   - View your personal attendance records for the last 60 days.
   - Track your total hours worked and punctuality rate (On-Time vs Late).
   - Review your verified check-in and check-out timestamps.

---

## ❓ Frequently Asked Questions (FAQ)

| Question | Answer |
| :--- | :--- |
| **Is my facial photo saved?** | **No.** Raw photos are never saved to databases or disk. Only an encrypted 128-d mathematical vector is stored. |
| **Can another company see our staff data?** | **No.** All data queries are partitioned by `organization_id` at the database level. |
| **What happens if someone tries to use a photo/phone screen?** | The embedded anti-spoofing and micro-variance liveness verification will detect the lack of natural movement and reject the punch. |
| **Can employees check in from remote/multiple offices?** | Yes, multiple kiosks and tablets can run simultaneously in different offices under the same organization account. |
