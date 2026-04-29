# AashaAI — Digital Platform for ASHA Workers

**AashaAI** is the complete digital work platform for India's Accredited Social Health Activist (ASHA) workers. It directly digitises the physical ASHA diary, adds AI intelligence on top, and solves critical pain points identified in real user interviews: no edit option, lack of offline support, double data entry, and typing difficulties.

## 🚀 Core Features

AashaAI's architecture is modular and Amazon-style. Each section is a dedicated, self-contained screen, all sharing one offline sync engine, one voice AI, one ambient AI, and one auth system.

- **Offline-First Architecture**: Built for low-connectivity rural areas like Marathwada. Firebase Firestore with `enableMultiTabIndexedDbPersistence()` allows the entire app to function fully offline. Syncs automatically when internet is restored.
- **Voice Dictation**: A voice button on every form. ASHA speaks family or health details in Marathi, and Gemini structures the fields automatically via Cloud STT.
- **Ambient AI Listener**: Listens to the ASHA-family conversation (with consent) via Gemini Live API and suggests form field values (e.g., family members, ages, names) as interactive chips.
- **OCR Register Import**: Take a photo of an old physical register page. Gemini Vision analyzes the image and extracts all readable rows and columns directly into structured database records.
- **Smart Validation Engine**: Real-time checks to prevent data entry errors without blocking (e.g., duplicate Aadhaar detection, age-DOB cross checks, future dates).
- **Predictive Risk Engine**: Runs nightly via Cloud Scheduler to analyze health records. Flags high-risk cases (e.g., malnutrition, maternal risk) and sends critical FCM push notifications immediately to the ASHA worker.
- **Full Edit Capability**: Every field and every document is editable post-submission. Changes are tracked immutably in an append-only audit trail for transparency.

## 👩‍⚕️ User Roles

1. **ASHA Worker**: Logs in via Phone OTP (+91). Accesses all surveys in her coverage area only.
2. **ASHA Head (Supervisor)**: Logs in via Google/Email. Has a dedicated `/admin/` web dashboard. Can track worker activity, view the coverage map, review flagged data, and use the **Survey Builder** to create and assign new custom surveys.
3. **PHC Officer**: Logs in via Google/Email. Accesses district-level read-only analytics.
4. **Super Admin**: System admin and user management via Email + 2FA.

## 🛠️ Technology Stack

- **Frontend**: React 19 PWA, Vite, Tailwind CSS, Zustand, React Router v7, Firebase JS SDK.
- **Backend**: FastAPI (Python 3.12) running on Google Cloud Run.
- **Database**: Cloud Firestore (NoSQL) with real-time sync and offline indexedDB persistence.
- **AI Services**: Vertex AI (Gemini 2.0 Flash) for structured data extraction and risk scoring, Google Cloud Speech-to-Text (Marathi `chirp_2` model), and Gemini Live for ambient AI.
- **Cloud Infrastructure**: Firebase Authentication, Cloud Storage (encrypted photos/audio), Cloud Functions (Python), and Cloud Scheduler for cron jobs.

## 📁 Modules Included

AashaAI maps directly to the physical registers:
1. Family Survey (कुटुंब पाहणी सर्वेक्षण)
2. Village Health Survey (ग्राम आरोग्य सर्वेक्षण)
3. ANC Registration (माता आरोग्य / गर्भधारणा)
4. Vaccination Tracking (लसीकरण)
5. Child Growth / Malnutrition (बालविकास / कुपोषण)
6. Disease Surveillance (रोग सर्वेक्षण)
7. NCD Tracking (असंसर्गजन्य रोग)
8. Birth Records (जन्म नोंद)
9. Death Records (मृत्यू नोंद)
10. Family Planning (कुटुंब नियोजन)
11. Elderly Care (ज्येष्ठ नागरिक)
12. Sanitation & Hygiene (स्वच्छता)

## 🔒 Security & Compliance

- **No PHI in logs or URLs.**
- **Encrypted Aadhaar/ABHA**: Aadhaar numbers are AES-256-GCM encrypted in Firestore. Only the last 4 digits are shown in the UI.
- **Privacy-First AI**: Voice audio and ambient listening audio are never stored. Only transcribed entities are saved.
- **Immutable Audit Trail**: All edits are appended to an `edit_history` collection which cannot be updated or deleted.

## 📖 Documentation

For full documentation, please refer to the `ashaai-docs` directory:
- [Product Requirements (PRD)](./ashaai-docs/PRD_FINAL.md)
- [Technical Architecture](./ashaai-docs/TECH_STACK.md)
- [Complete Setup Guide](./ashaai-docs/SETUP_GUIDE_COMPLETE.md)
- [Security Guidelines](./ashaai-docs/SECURITY.md)

## ⚙️ Quick Setup Guide

Follow these steps to run the project locally. For full infrastructure setup (GCP, Cloud Functions, etc.), refer to the [Complete Setup Guide](./ashaai-docs/SETUP_GUIDE_COMPLETE.md).

### 1. Prerequisites
- Node.js (v20+ or v22+)
- Python 3.12
- Google Cloud CLI (`gcloud`)
- Firebase CLI (`npm install -g firebase-tools`)

### 2. Environment Variables
Create a `.env.local` file in the `frontend` directory:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=ashaai-prod.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=ashaai-prod
VITE_FIREBASE_STORAGE_BUCKET=ashaai-health-photos.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_GOOGLE_MAPS_API_KEY=your_maps_key
VITE_BACKEND_URL=http://localhost:8000
```

Create a `.env` file in the `backend` directory:
```env
GCP_PROJECT_ID=ashaai-prod
GCP_LOCATION=asia-south1
GCS_BUCKET=ashaai-health-photos
FIREBASE_SECRET_NAME=firebase-service-account
AADHAAR_SECRET_NAME=aadhaar-encryption-key
ALLOWED_ORIGINS=http://localhost:5173
```

### 3. Run Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
# API docs available at http://localhost:8000/docs
```

### 4. Run Frontend (React PWA)
```bash
cd frontend
npm install
npm run dev
# App available at http://localhost:5173
```

### 5. Seed Demo Data
To populate Firestore with dummy ASHA workers and families:
```bash
cd backend
python3 seed_data.py
```
