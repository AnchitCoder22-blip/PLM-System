# 🅿️ ParkManager — Parking Lot Management System

A full-stack, real-time parking lot management system with JWT authentication, live slot tracking, automated license plate recognition via YOLO/OCR, and a revenue dashboard.

---

## 📁 Project Structure

```
PLMSystem/
├── frontend/               # Static web UI (served by Express)
│   ├── css/style.css       # Global stylesheet
│   ├── js/app.js           # Frontend JavaScript (API calls, UI logic)
│   ├── index.html          # Dashboard
│   ├── login.html          # Login page
│   ├── admin.html          # Admin control panel
│   ├── entry.html          # Vehicle entry form
│   └── exit.html           # Vehicle exit form
│
├── backend/                # Node.js + Express REST API
│   ├── middleware/         # JWT auth middleware
│   ├── models/             # Mongoose schemas (User, Employee, Log, Settings)
│   ├── routes/             # API route handlers
│   ├── .env                # Environment variables (Mongo URI, JWT secret)
│   ├── package.json
│   └── server.js           # App entry point
│
├── scanner/                # Python FastAPI microservice (YOLO + EasyOCR)
│   ├── main.py             # Scan endpoint (/scan, /health)
│   ├── requirements.txt    # Python dependencies
│   └── yolov8n.pt          # YOLOv8 model weights
│
├── docs/                   # Project documentation
│   └── Testing_And_Validation_Report.md
│
└── .gitignore
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** v18+ and **npm**
- **Python** 3.10+ with a virtual environment
- **MongoDB** running locally or a MongoDB Atlas URI

---

### 1. Start the Backend (Node.js API)

```bash
cd backend
npm install
# Set your MONGO_URI and JWT_SECRET in backend/.env
npm start
```
The server runs on **http://localhost:5000**. The frontend is served automatically at that address.

**Default credentials:**
| Role     | Username | Password      |
|----------|----------|---------------|
| Admin    | `admin`  | `admin14`    |
| Security | `security` | `security123` |

---

### 2. Start the Scanner Microservice (Python)

```bash
cd scanner
# Activate your virtual environment first, e.g.:
# .venv\Scripts\activate  (Windows)
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
The scanner API runs on **http://localhost:8000**.

---

## 🔑 Environment Variables (`backend/.env`)

| Variable         | Description                              |
|------------------|------------------------------------------|
| `MONGO_URI`      | MongoDB connection string                |
| `JWT_SECRET`     | Secret key for signing JWT tokens        |
| `PORT`           | Server port (default: `5000`)            |

---

## ✨ Features

- **JWT Authentication** — Role-based access (Admin / Security)
- **Live Slot Grid** — Real-time parking slot visualization via Socket.io
- **Vehicle Entry/Exit** — Token generation, slot assignment, fee calculation
- **Employee Registry** — Manage employee vehicles for free parking zones
- **Revenue Dashboard** — 7-day revenue trend chart with configurable pricing
- **YOLO License Plate Scanner** — Automated OCR using YOLOv8 + EasyOCR
- **Dark Mode** — Persistent theme toggle
