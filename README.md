# AshaAI

## 💡 Introduction

**Problem Statement**: Data Driven Volunteer Coordination For Social Impact — India's 1 million+ ASHA (Accredited Social Health Activist) frontline health workers still rely on paper registers to track maternal health, child nutrition, vaccinations, disease surveillance, and orphan/vulnerable-child welfare across rural villages. This causes delayed detection of high-risk cases, double data entry, zero real-time visibility for supervisors, and disconnected coordination with NGOs that care for orphaned and vulnerable children.

**Solution**: AshaAI is a multilingual, AI-powered health platform built on Google Cloud that digitizes ASHA worker operations end-to-end. It automatically flags critical health cases using Gemini's nightly risk engine, gives supervisors real-time oversight through a web dashboard, and is accessible entirely via voice in Marathi and Hindi — even on basic Android phones. Workers can scan handwritten paper registers using Gemini Vision OCR, eliminating manual re-entry entirely. A new **NGO & Orphanage Integration** module connects local orphanages and child-welfare NGOs directly into the platform — supervisors can register NGOs, schedule bulk health visits, and automatically notify NGOs by email, with reschedule requests flowing back through Google Forms. An offline-first Firebase architecture ensures the app works seamlessly in zero-connectivity rural areas, syncing automatically once internet is available.

A **Google Solution Challenge 2026** Project — Selected in the **Global Top 100** — Built by **Team AshaAI**.

## Intro To AshaAI Video

[![Intro To AshaAI](YOUR_YOUTUBE_THUMBNAIL_URL_HERE)
](YOUR_YOUTUBE_VIDEO_LINK_HERE)

A short walkthrough of AshaAI's voice-first, offline-first health platform for ASHA workers. Click the image above to watch the video.

### Our Target SDG Goals 🎯

<p align="center">
  <img src="https://res.cloudinary.com/drb4gctam/image/upload/v1781363044/E_PRINT_03_hnvufu.jpg" width="200"/>
  <img src="https://res.cloudinary.com/drb4gctam/image/upload/v1781362667/E_PRINT_10_xruhrt.jpg" width="200"/>
  <img src="https://res.cloudinary.com/drb4gctam/image/upload/v1781363205/E_PRINT_09_vmaqk2.jpg" width="200"/>
</p>

AshaAI enables early detection of high-risk maternal and child health cases through AI-powered insights and real-time monitoring, directly supporting **SDG 3 — Good Health and Well-being**. Its AI-powered malnutrition grading (SAM/MAM/Normal) and automated NRC referral pipeline target child malnutrition head-on, advancing **SDG 2 — Zero Hunger**. And its new NGO & Orphanage Integration module connects orphaned and vulnerable children with coordinated health visits and welfare support — directly advancing **SDG 10 — Reduced Inequalities** by ensuring no child falls through the cracks of the healthcare system.

## 💯 Project Achievements

- [Global Top 100 | Google Solution Challenge 2026](YOUR_LINKEDIN_OR_ANNOUNCEMENT_LINK_HERE)
- Built with real user research — interviews with practicing ASHA workers and analysis of actual physical health registers from Marathwada, Maharashtra
- Selected for the **Build with AI — Solution Challenge** track by Hack2Skill & Google Developer Groups

## Live Prototype

<table>
  <tr>
    <td>
      <a href="https://ashaai-prod.web.app/">
        <img src="https://i.imgur.com/9p4oJQG.png" alt="Live App" width="200">
      </a>
    </td>
    <td>
      <a href="https://github.com/Rohan45create/aasha-ai">
        <img src="https://user-images.githubusercontent.com/663460/26973090-f8fdc986-4d14-11e7-995a-e7c5e79ed925.png" alt="Github" width="200">
      </a>
    </td>
  </tr>
</table>

Join us in the mission to digitize India's rural healthcare frontline, eliminate paperwork for ASHA workers, and bring AI-powered early warning systems — and coordinated child welfare support — to the communities that need them most!

## 🚀 Getting Started

> [!IMPORTANT]
> AshaAI is offline-first — it works without an internet connection and syncs automatically when connectivity returns.

1. Open the live prototype: [https://ashaai-prod.web.app/](https://ashaai-prod.web.app/)
2. ASHA Worker Login: Phone number + OTP (test credentials available on request)
3. Admin / Supervisor Login:
   Email: *sunita.sharma@asha.gov.in*
   Password: *(provided in demo video / on request)*

## ⚠️ Initial Survey and Problem Statement Research

<table style="width: 100%;">
  <tr>
    <td>
      <img src="YOUR_CLOUDINARY_IMAGE_URL_REGISTER_PHOTO_1" alt="Physical ASHA Register" style="width: 80%; text-align:center">
      <p> </p>
      <p>📌 We conducted in-depth interviews with practicing ASHA workers in the Marathwada region and photographed their actual physical diary registers — a 128-page book covering 75 different task types across village health surveys, family surveys, performance tasks, and training records.</p>
      <p>📝 Our findings revealed major pain points: no edit option once data is written (one mistake = permanent error), apps that crash without internet, double work (paper diary then retype in an app), low digital literacy making typing difficult, and no structured way to coordinate with local NGOs caring for orphaned children. These insights fundamentally shaped AshaAI — shifting it from a narrow malnutrition-tracking app into a comprehensive 75-task digital work platform with built-in NGO coordination.</p>
    </td>
  </tr>
</table>

## 📊 Real User Research

#### In-person interviews with ASHA workers + analysis of physical register pages from real villages in Beed district, Maharashtra.

<hr>

<table style="width: 100%;">
  <tr>
    <p>➡ Our research highlighted that existing digital health apps for ASHA workers are English-only, require typing, depend entirely on internet connectivity, and have no integration with the NGO/orphanage network that supports vulnerable children in the same villages.</p>
    <p>➡ We mapped every column of the physical Family Survey Register (कुटुंब पाहणी सर्वेक्षण) and Village Health Survey Register (ग्राम आरोग्य सर्वेक्षण) field-by-field to ensure AshaAI's digital forms are a 1:1 replacement for the paper register ASHA workers already know — and extended this with a dedicated orphan/vulnerable-child flagging system feeding directly into our new NGO module.</p>
    <td>
      <img src="YOUR_CLOUDINARY_IMAGE_URL_REGISTER_PHOTO_2" alt="Family Survey Register" style="width: 100%;">
    </td>
    <td>
      <img src="YOUR_CLOUDINARY_IMAGE_URL_REGISTER_PHOTO_3" alt="Village Health Register" style="width: 100%;">
    </td>
  </tr>
  <tr>
    <td style="text-align: center;">
      <img src="YOUR_CLOUDINARY_IMAGE_URL_ASHA_INTERVIEW_PHOTO" alt="ASHA Worker Interview" style="width: 100%;">
    </td>
    <td align="center">
      <a href="YOUR_DEMO_VIDEO_LINK_HERE" target="_blank">
        <img src="YOUR_CLOUDINARY_IMAGE_URL_VIDEO_THUMBNAIL" alt="Demo Video" width="250">
      </a>
      <br>
      <b>AshaAI Demo Video</b>
    </td>
  </tr>
</table>

## 🛳 User Guide

### Walkthrough

<table style="width: 100%;">
  <tr>
    <td align="center" width="25%">
      <img src="https://res.cloudinary.com/drb4gctam/image/upload/v1781360961/Galaxy-Note20-Ultra-ashaai-prod.web.app_wj0zdt.png" width="120"/><br>
      <b>ASHA Login Screen</b><br>
      Phone OTP login with EN / मर / हि language toggle always visible.
    </td>
    <td align="center" width="25%">
      <img src="https://res.cloudinary.com/drb4gctam/image/upload/v1781360956/Galaxy-Note20-Ultra-ashaai-prod.web.app_1_clwpwf.png" width="120"/><br>
      <b>ASHA Home Dashboard</b><br>
      Today's families, high-risk count, visits, and quick access to all 12 health modules.
    </td>
    <td align="center" width="25%">
      <img src="https://res.cloudinary.com/drb4gctam/image/upload/v1781360960/Galaxy-Note20-Ultra-ashaai-prod.web.app_9_a7y8uk.png" width="120"/><br>
      <b>Voice Dictation</b><br>
      Tap the mic and speak in Marathi/Hindi — Gemini structures the data into form fields automatically.
    </td>
    <td align="center" width="25%">
      <img src="YOUR_CLOUDINARY_SCREENSHOT_OCR" width="120"/><br>
      <b>Register OCR Import</b><br>
      Photograph a paper register page — Gemini Vision extracts every row directly into the database.
    </td>
  </tr>
  <tr>
    <td align="center" width="25%">
      <img src="https://res.cloudinary.com/drb4gctam/image/upload/v1781360961/Galaxy-Note20-Ultra-ashaai-prod.web.app_13_e8b9dk.png" width="120"/><br>
      <b>AI Malnutrition Scan</b><br>
      Photograph a child — Gemini Vision assesses visible signs and grades SAM/MAM/Normal with confidence score.
    </td>
    <td align="center" width="25%">
      <img src="https://res.cloudinary.com/drb4gctam/image/upload/v1781360956/Galaxy-Note20-Ultra-ashaai-prod.web.app_6_lgk9n0.png" width="120"/><br>
      <b>Ask AshaAI</b><br>
      Conversational health Q&A assistant for protocols, danger signs, and guidance — always online.
    </td>
    <td align="center" width="25%">
      <img src="https://res.cloudinary.com/drb4gctam/image/upload/v1781360960/Galaxy-Note20-Ultra-ashaai-prod.web.app_14_dthump.png" width="120"/><br>
      <b>Download Survey Registers</b><br>
      ASHA workers can export any register as a report for a custom date range.
    </td>
    <td align="center" width="25%">
      <img src="https://res.cloudinary.com/drb4gctam/image/upload/v1781360961/Macbook-Air-ashaai-prod.web.app_1_f6jbmc.png" width="300"/><br>
      <b>Admin Dashboard</b><br>
      Real-time view of all ASHA workers, families covered, critical cases, and survey completion.
    </td>
  </tr>
  <tr>
    <td align="center" width="25%">
      <img src="https://res.cloudinary.com/drb4gctam/image/upload/v1781360968/Macbook-Air-ashaai-prod.web.app_7_bu3xri.png" width="300"/><br>
      <b>Pending Review Queue</b><br>
      Supervisors review AI-flagged critical alerts and approve/reject with one tap.
    </td>
    <td align="center" width="25%">
      <img src="https://res.cloudinary.com/drb4gctam/image/upload/v1781360969/Macbook-Air-ashaai-prod.web.app_8_akgzck.png" width="300"/><br>
      <b>Survey Builder</b><br>
      Supervisors create new survey fields with auto-translation to Marathi & Hindi and publish to all workers instantly.
    </td>
    <td align="center" width="25%">
      <img src="https://res.cloudinary.com/drb4gctam/image/upload/v1781360964/Macbook-Air-ashaai-prod.web.app_4_lrhvky.png" width="300"/><br>
      <b>NRC Referral Tracking</b><br>
      Track malnutrition referrals from pending → admitted → discharged with full case history.
    </td>
    <td align="center" width="25%">
      <img src="https://res.cloudinary.com/drb4gctam/image/upload/v1781360967/Macbook-Air-ashaai-prod.web.app_9_jrzweo.png" width="300"/><br>
      <b>Coverage Map</b><br>
      Google Maps-powered village-level heatmap showing coverage and critical cases across the district.
    </td>
  </tr>
  <tr>
    <td align="center" width="25%">
      <img src="https://res.cloudinary.com/drb4gctam/image/upload/v1781360964/Macbook-Air-ashaai-prod.web.app_6_xwtevu.png" width="300"/><br>
      <b>NGO Management</b><br>
      Supervisors view all registered NGOs/orphanages, approve new registrations, and manage their details.
    </td>
    <td align="center" width="25%">
      <img src="https://res.cloudinary.com/drb4gctam/image/upload/v1781360956/Galaxy-Note20-Ultra-ashaai-prod.web.app_3_yeteie.png" width="120"/><br>
      <b>NGO Appointment Booking</b><br>
      Schedule bulk ASHA worker visits to an NGO/orphanage and assign specific workers, with automatic email confirmation.
    </td>
    <td align="center" width="25%">
      <img src="YOUR_CLOUDINARY_SCREENSHOT_NGO_FORM" width="120"/><br>
      <b>NGO Self-Registration (Google Forms)</b><br>
      New NGOs register themselves via a Google Form — submissions flow into the admin's pending review queue automatically.
    </td>
    <td align="center" width="25%">
      <img src="YOUR_CLOUDINARY_SCREENSHOT_NGO_EMAIL" width="120"/><br>
      <b>Automated NGO Emails</b><br>
      NGOs receive professional email notifications for scheduled visits, with a one-click reschedule link.
    </td>
    <td colspan="2"></td>
  </tr>
</table>

## Key Features:

- Offline-first architecture — fully functional with zero connectivity, automatic Firestore sync when online.
- Voice dictation in Marathi & Hindi on every form via Cloud Speech-to-Text (chirp_2 model).
- Ambient AI conversation listener — suggests form values from overheard ASHA-family conversations (with consent).
- Gemini Vision OCR — digitizes handwritten paper registers row-by-row with confidence scoring.
- AI-powered malnutrition grading (SAM/MAM/Normal) from a simple child photograph — no MUAC tape required.
- Predictive nightly AI risk engine — scores every child and pregnant woman 0–100 and pushes priority lists via FCM.
- 12 health modules in one app: Family Survey, Village Health, ANC, Vaccination, Child Growth, Disease Surveillance, NCD Tracking, Birth/Death Records, Family Planning, Elderly Care, Sanitation.
- Full edit capability on every field with an immutable, append-only audit trail.
- Dynamic Survey Builder — supervisors create and publish new survey forms without code, auto-translated to Marathi & Hindi.
- Aadhaar-based cross-module record linkage with AES-256-GCM encryption.
- Real-time supervisor dashboard with Google Maps coverage heatmap, worker activity tracking, and CSV/PDF reporting.
- **NEW — NGO & Orphanage Integration**: NGOs self-register via Google Forms, supervisors approve registrations, book bulk health visits, assign ASHA workers, and the system automatically emails the NGO with visit details and a reschedule link — closing the loop between frontline health workers and child-welfare organizations.

## Tech Stack

**Technologies involved/used:**

![AshaAI Architecture](YOUR_CLOUDINARY_ARCHITECTURE_DIAGRAM_URL)

# AshaAI Project Implementation Overview

1. **Technology Stack**: React 19 PWA (Vite, Tailwind CSS, Zustand) on the frontend, FastAPI (Python 3.12) on Google Cloud Run for the backend, and Cloud Firestore as the primary real-time, offline-capable database.

2. **AI Layer**: Vertex AI (Gemini 2.0/2.5 Flash) powers OCR extraction, voice structuring, malnutrition grading, smart validation, and ambient suggestions — all via Google Cloud.

3. **Voice & Language**: Google Cloud Speech-to-Text (`chirp_2`, mr-IN/hi-IN) for dictation and Google Cloud Translation API for dynamic Marathi/Hindi UI translation.

4. **Offline-First Design**: Firebase Firestore's `enableMultiTabIndexedDbPersistence()` plus a Service Worker (vite-plugin-pwa) ensures the entire app — including all 12 health modules — works with zero connectivity.

5. **Predictive Risk Engine**: A nightly Cloud Function scores every child and pregnant woman using Gemini, writes results to Firestore, and pushes FCM alerts for CRITICAL cases.

6. **Security & Compliance**: AES-256-GCM encrypted Aadhaar/ABHA fields via Google Cloud Secret Manager, Firebase Auth (Phone OTP + Email/Password), Cloud Armor rate limiting, and structured logging with zero PHI.

7. **Supervisor Web Portal**: A dedicated `/admin` dashboard with real-time Firestore feeds, a Google Maps-powered coverage map, a no-code Survey Builder, and CSV/PDF exports.

8. **Real User Research**: Architecture and feature priorities were directly informed by interviews with practicing ASHA workers and photographs of their physical diary registers.

9. **NGO & Orphanage Integration**: Google Forms + Apps Script webhook pipeline lets NGOs self-register and request appointment changes; the FastAPI backend creates pending reviews for admin approval, books bulk ASHA visits, and sends automated Gmail SMTP notifications with reschedule links.

10. **Zero Non-Google Cloud Services**: The entire stack — compute, database, AI, storage, auth, messaging, and maps — runs on Google Cloud and Firebase, by design.

## Resources

- [React Docs](https://react.dev/)
- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [Firebase Docs](https://firebase.google.com/docs)
- [Vertex AI / Gemini Docs](https://cloud.google.com/vertex-ai/generative-ai/docs)

# Hi, We are Team AshaAI

## 🤝 Contributors

We are a team of Computer Engineering students from Maharashtra, building AshaAI as part of the **Google Solution Challenge 2026**, under the **Build with AI** track organized by Hack2Skill and Google Developer Groups.

| [Rohan Gangawane](https://www.linkedin.com/in/rohan-gangawane/) | [Akshay Chaudhari](https://www.linkedin.com/in/akshay-chaudhari-31b4b4264/) | [Sakshi Bhutekar](https://www.linkedin.com/in/sakshi-bhutekar-3009572ba/) | [Pratik Bhosale](https://www.linkedin.com/in/pratik-bhosale-756489318/) |
| -------------------------------------- | ---------------------------------- | ---------------------------------- | ---------------------------------- |
| <img src="https://media.licdn.com/dms/image/v2/D4D03AQENgwFqARRlMA/profile-displayphoto-crop_800_800/B4DZwE4Xk1KIAM-/0/1769608412988?e=1782950400&v=beta&t=2k7_s3xQOgs4zN6EGQfkZdqL1iryr9gq5q5oz09YRsA" width="300"> | <img src="https://media.licdn.com/dms/image/v2/D4D03AQFyEXb48USP_g/profile-displayphoto-crop_800_800/B4DZrRR0qOHwAI-/0/1764447703320?e=1782950400&v=beta&t=KPHHrqcEzxxY5y3faK-AuFDAlSE1wstekFOYsMOM9uk" width="300"> | <img src="https://media.licdn.com/dms/image/v2/D4D03AQGt7ro194x-Sg/profile-displayphoto-shrink_800_800/B4DZvnNKkNIgAg-/0/1769110548425?e=1782950400&v=beta&t=ztazrSwsoBdKT0aPlRAA0k22KNllitGa6n5i-CB57Sc" width="300"> | <img src="https://media.licdn.com/dms/image/v2/D5603AQE6-WJfSWo8fg/profile-displayphoto-shrink_800_800/B56ZTbO7QcGUAg-/0/1738844913035?e=1782950400&v=beta&t=nuCh5dCFQ2p8rF0YTjpnfI4HwI4HPz71_8m6rIJPIR4" width="300"> |
| Team Lead / Full-Stack & AI | Frontend Dev / Researcher | Backend Developer | UI/UX Designer / Database |

## Keep Building 🚀

Made with ❤️ by Team AshaAI — Empowering ASHA Workers, One Village at a Time.
