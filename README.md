# Industrial Camera Safety Monitoring

AI-powered PPE detection, safety-rule evaluation, risk scoring, and real-time incident alerts for industrial environments.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Python](https://img.shields.io/badge/python-3.11+-green)
![Node](https://img.shields.io/badge/node-18+-green)
![License](https://img.shields.io/badge/license-MIT-gray)

## Overview

Industrial Camera Safety Monitoring is a computer-vision application that analyzes video from webcams, uploaded video files, or RTSP cameras. It detects PPE (Personal Protective Equipment) compliance, evaluates safety rule violations, calculates configurable risk scores, and records incidents with evidence for human review.

> **⚠️ Important**: This is an assistive monitoring tool. It does not replace trained safety personnel or certified safety procedures. Risk scores are indicators, not predictions of accident probability.

### Key Features

- **PPE Detection**: Detects helmets, safety vests, masks using YOLOv8 pretrained model
- **Violation Detection**: Identifies missing PPE with temporal confirmation and uncertainty handling
- **Restricted Zone Monitoring**: Configurable polygon zones with entry detection
- **Risk Scoring**: Transparent, rule-based scoring with configurable severity bands
- **Real-time Dashboard**: Live video feed, detection overlays, and instant incident alerts
- **Incident Management**: Full lifecycle (Open → Acknowledged → Resolved) with evidence and audit trail
- **Analytics**: Trend charts, breakdowns by type/severity/camera, and CSV export
- **Multi-source Video**: Webcam capture, video file upload, and RTSP stream support

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│  Dashboard │ Monitoring │ Incidents │ Analytics │ Admin  │
└──────────────────────┬──────────────────────────────────┘
                       │ REST API + WebSocket
┌──────────────────────┴──────────────────────────────────┐
│                  FastAPI Backend                         │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────────┐  │
│  │ API Layer│  │ Services  │  │   Vision Pipeline    │  │
│  │ Auth     │  │ Video     │  │ Detector (YOLOv8)    │  │
│  │ Cameras  │  │ Incidents │  │ Tracker (IoU-based)  │  │
│  │ Sessions │  │ Alerts    │  │ PPE Rules Engine     │  │
│  │ Incidents│  │           │  │ Zone Rules Engine    │  │
│  │ Analytics│  │           │  │ Risk Scoring         │  │
│  └──────────┘  └───────────┘  └──────────────────────┘  │
│                       │                                  │
│              ┌────────┴────────┐                         │
│              │   SQLite / DB   │                         │
│              └─────────────────┘                         │
└─────────────────────────────────────────────────────────┘
```

## Model Information

| Property | Value |
|----------|-------|
| **Repository** | [Hansung-Cho/yolov8-ppe-detection](https://huggingface.co/Hansung-Cho/yolov8-ppe-detection) |
| **Framework** | Ultralytics YOLOv8 |
| **Classes** | Hardhat, Mask, NO-Hardhat, NO-Mask, NO-Safety Vest, Person, Safety Cone, Safety Vest, machinery, vehicle |
| **Task** | Object Detection |

> Review the model card and license on Hugging Face before any commercial use.

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- Git
- (Optional) NVIDIA GPU with CUDA for faster inference

### 1. Clone and Setup

```bash
git clone <repository-url>
cd Industry_Camera_Safety
```

### 2. Backend Setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Create a `.env` file (copy from `.env.example`):
```powershell
copy .env.example .env
```

Start the backend:
```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The first startup will download the model from Hugging Face (~25MB). The API will be available at `http://localhost:8000`.

### 3. Frontend Setup

```powershell
cd frontend
npm install
npm run dev
```

The dashboard will be available at `http://localhost:5173`.

### 4. Default Login

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `admin123` |

> ⚠️ Change the default credentials in production.

## API Documentation

Once the backend is running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Key Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/login` | Authenticate user |
| GET/POST | `/api/cameras` | List or register cameras |
| POST | `/api/videos/upload` | Upload video file |
| POST | `/api/sessions` | Start monitoring session |
| POST | `/api/sessions/{id}/stop` | Stop processing |
| GET | `/api/incidents` | Filter and paginate incidents |
| PATCH | `/api/incidents/{id}` | Update status and notes |
| GET | `/api/analytics/summary` | Get summary metrics |
| GET | `/api/models/status` | Get model readiness |
| WS | `/ws/monitoring/{session_id}` | Real-time events |

## Configuration

All settings can be configured via environment variables or `.env` file:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:///./safety_monitor.db` | Database connection string |
| `SECRET_KEY` | (dev key) | JWT signing key — **change in production** |
| `MODEL_REPO_ID` | `Hansung-Cho/yolov8-ppe-detection` | HuggingFace model repository |
| `DEVICE` | `auto` | Inference device: `auto`, `cpu`, or `cuda` |
| `PERSON_CONFIDENCE` | `0.35` | Person detection confidence threshold |
| `PPE_CONFIDENCE` | `0.40` | PPE detection confidence threshold |
| `FRAME_SAMPLE_FPS` | `5` | Target frames processed per second |
| `VIOLATION_CONFIRM_FRAMES` | `5` | Consecutive frames to confirm violation |
| `INCIDENT_COOLDOWN_SECONDS` | `30` | Deduplication cooldown per violation |
| `MAX_UPLOAD_MB` | `500` | Maximum video upload size |

## Safety Rules

### PPE Compliance
- Detects missing helmets and safety vests using both direct model predictions (NO-Hardhat, NO-Safety Vest classes) and spatial association logic
- Requires temporal confirmation across configurable consecutive frames
- Supports `compliant`, `violation`, and `uncertain` outcomes

### Restricted Zones
- Polygon zones defined per camera (normalized coordinates)
- Uses bottom-center of person bounding box as ground-contact proxy
- Entry triggers incident after persistence threshold

### Risk Scoring

Formula: `R = min(100, 100 × S × C × P)`

| Parameter | Description |
|-----------|-------------|
| S | Base severity normalized to 0–1 |
| C | Model confidence (0–1) |
| P | Persistence/context multiplier (0.5–2.0) |

Severity bands: **Low** (0–29) · **Medium** (30–59) · **High** (60–79) · **Critical** (80–100)

## Model Validation

Run the standalone validation script:

```bash
python scripts/test_video.py --video path/to/test.mp4
python scripts/test_video.py --webcam 0
python scripts/test_video.py --video test.mp4 --output annotated.mp4 --no-display
```

## Docker Deployment

```bash
docker-compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000

## Project Structure

```
Industry_Camera_Safety/
├── backend/
│   ├── app/
│   │   ├── api/          # REST endpoints and WebSocket
│   │   ├── core/         # Config, security
│   │   ├── db/           # Database models and setup
│   │   ├── safety/       # PPE rules, zone rules, risk scoring
│   │   ├── services/     # Video processing, incidents, alerts
│   │   └── vision/       # Detector, adapter, tracker, preprocessing
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/   # React components by feature
│   │   ├── hooks/        # Custom React hooks
│   │   ├── services/     # API and WebSocket clients
│   │   └── types/        # TypeScript interfaces
│   ├── package.json
│   └── Dockerfile
├── models/               # Model documentation (not weights)
├── scripts/              # Validation and utility scripts
├── storage/              # Evidence and uploads (git-ignored)
├── docker-compose.yml
└── README.md
```

## Testing

```bash
# Backend unit tests
cd backend
python -m pytest app/tests/ -v

# Frontend
cd frontend
npm test
```

## Known Limitations

- Detection accuracy depends on camera angle, lighting, distance, and occlusion
- The model was trained on construction site data; performance may vary in other industrial settings
- Risk scores are configurable indicators, not calibrated probabilities
- Frame sampling may miss very brief events
- Tracking uses simple IoU matching, not a production-grade tracker like ByteTrack
- RTSP support depends on network configuration and camera codec compatibility

## Roadmap

- [ ] Browser/email push notifications
- [ ] Multi-camera worker scheduling
- [ ] Model fine-tuning workflow
- [ ] Role-based access control enforcement
- [ ] PostgreSQL support for production
- [ ] Action recognition for unsafe activities
- [ ] Centralized object storage for evidence

## License

This project is for educational and demonstration purposes. Review the [model license](https://huggingface.co/Hansung-Cho/yolov8-ppe-detection) before commercial deployment.
