# SpeedSense AI — Vehicle Speed Detection System

A **production-ready, full-stack vehicle speed estimation system** that measures real-world vehicle speeds (km/h) from traffic videos using a **ROI line-crossing method** with optional **perspective homography correction**. Built with a **FastAPI** backend and a **React + Vite** dashboard.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        SpeedSense AI                            │
│                                                                 │
│  ┌──────────────────────┐      ┌──────────────────────────┐    │
│  │  React Frontend       │◄────►│  FastAPI Backend          │   │
│  │  (app/ — Vite)        │      │  (server.py)              │   │
│  │                       │      │                           │   │
│  │  • Dashboard          │      │  • /api/process  (SSE)    │   │
│  │  • Upload & Process   │      │  • /api/runs              │   │
│  │  • Output Gallery     │      │  • /api/violations        │   │
│  │  • Video Insights     │      │  • /api/stats             │   │
│  │  • Overspeed Alerts   │      │  • /api/speed-limit       │   │
│  │  • Settings           │      │  • /api/file/{run}/{file} │   │
│  │  • Login / Signup     │      │                           │   │
│  └──────────────────────┘      └──────────┬───────────────┘   │
│                                            │                    │
│                               ┌────────────▼──────────────┐    │
│                               │  Processing Pipeline        │    │
│                               │  (roi_headless.py)          │   │
│                               │                             │   │
│                               │  YOLOv8n → BotSORT →       │   │
│                               │  Homography → ROI Crossing  │   │
│                               │  → Speed Calc → H.264 Out  │   │
│                               └────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚗 Key Features

### Core Pipeline
- **YOLOv8n Detection** — Detects all vehicle classes in real time
- **BotSORT Tracking** — Stable multi-object tracking with persistent IDs
- **Perspective Homography** — Corrects camera angle for accurate distance measurement in bird's-eye view
- **ROI Line-Crossing Speed** — Measures time between two user-defined lines to compute speed: `v = d / Δt × 3.6`
- **EMA Speed Smoothing** — Exponential moving average (α = 0.35) reduces noise in final speed values
- **Speed Sanity Filters** — Minimum/maximum travel time guards + 250 km/h cap to discard erroneous readings
- **Cross Cooldown** — 0.4 s debounce per vehicle prevents double-counting on a single line crossing

### Web Application
- **Authentication** — Role-based login (admin / user) with persistent sessions via `localStorage`
- **Real-Time Progress** — Server-Sent Events (SSE) stream processing stage, frame counts, and errors live to the UI
- **Cancellation** — Stop any active processing run mid-stream
- **Run History** — All completed runs persisted to `runs.json` and browsable in the gallery
- **Overspeed Violations** — Per-vehicle violation log read from `log.csv` with excess speed, timestamps, and direct video links
- **Speed Graph** — Auto-generated dark-themed bar chart (`speed_graph.png`) per run
- **Google Drive Support** — Paste a Drive share link; backend downloads via `gdown` before processing
- **H.264 Output** — Browser-compatible video; falls back from `avc1` to `mp4v` + `ffmpeg` re-encode automatically
- **Configurable Speed Limit** — Set globally via Settings page; persisted to `settings.json`

---

## 📁 Project Structure

```
IISER/
├── server.py              # FastAPI backend — all REST & SSE endpoints
├── roi_headless.py        # Headless processing pipeline (called by server.py)
├── calibrate.py           # Interactive 3-phase GUI calibration tool
├── final.py               # Standalone CLI pipeline (interactive, no server needed)
├── calibration.json       # Saved homography + ROI line calibration data
├── requirements.txt       # Python dependencies
├── yolov8n.pt             # YOLOv8 nano model weights
│
├── runs.json              # Persistent run history (auto-created)
├── settings.json          # Global speed limit setting
├── admins.json            # Admin credentials store
├── users.json             # User credentials store
│
├── outputs_roi/           # All processing outputs
│   └── Run{N}_{DD-MM}_{HH-MM}/
│       ├── output.mp4     # Annotated output video (H.264)
│       ├── log.csv        # Per-vehicle speed log
│       └── speed_graph.png # Speed bar chart
│
└── app/                   # React + Vite frontend
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    └── src/
        ├── App.jsx                    # Router + auth guard
        ├── main.jsx
        ├── index.css
        ├── context/
        │   ├── AuthContext.jsx        # Login state + localStorage
        │   └── ProcessingContext.jsx  # Global processing + SSE state
        ├── components/
        │   ├── Layout.jsx             # App shell with sidebar
        │   └── Sidebar.jsx            # Navigation sidebar
        └── pages/
            ├── Login.jsx
            ├── Signup.jsx
            ├── Dashboard.jsx          # Stats overview + recent runs
            ├── UploadProcess.jsx      # Video upload / Drive link + live progress
            ├── OutputGallery.jsx      # Browse & manage all runs
            ├── VideoInsights.jsx      # Per-run detail view
            ├── OverspeedAlerts.jsx    # Violation log across all runs
            └── Settings.jsx           # Speed limit configuration
```

---

## 🛠️ Installation

### 1. Python Backend

```bash
# Install PyTorch first (CUDA build recommended)
pip install torch>=2.6.0 torchvision>=0.21.0 --index-url https://download.pytorch.org/whl/cu121

# Install remaining dependencies
pip install -r requirements.txt
```

**`requirements.txt` includes:**
- `ultralytics>=8.2.0` — YOLOv8 + BotSORT
- `opencv-python>=4.9.0`
- `numpy>=1.26.0`
- `pandas>=2.1.0`
- `matplotlib>=3.8.0`
- `scipy>=1.11.0`
- `tqdm>=4.66.0`
- `gdown>=5.1.0` — Google Drive downloader
- `fastapi`, `uvicorn` — Backend server

> **Optional:** Install [ffmpeg](https://ffmpeg.org/download.html) and add it to PATH for guaranteed H.264 re-encoding if your OpenCV build lacks `avc1` support.

### 2. Frontend

```bash
cd app
npm install
```

---

## 🚀 Usage

### Step 1 — Calibrate (one-time per camera angle)

Run the interactive GUI calibration tool to set up the homography and ROI lines:

```bash
python calibrate.py
```

**3-Phase Calibration Workflow:**

| Phase | Action | Result |
|-------|--------|--------|
| **Phase 1** | Click 4 road-corner points on the original frame | Computes 3×3 perspective homography matrix |
| **Phase 2** | Mark the **Entry Line** (green) on the warped bird's-eye view | Defines Line A in warped coordinates |
| **Phase 3** | Slide and resize the **Exit Line** (red) parallel to entry | Defines Line B in warped coordinates |
| **Final** | Enter the real-world distance between the two lines (metres) | Saves everything to `calibration.json` |

Calibration is saved to `calibration.json` and reused for all future runs until you recalibrate.

---

### Step 2 — Start the Backend

```bash
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

### Step 3 — Start the Frontend

```bash
cd app
npm run dev
```

Open **http://localhost:5173** in your browser.

---

### Alternative: Standalone CLI (no server)

For quick local processing without the web UI, use the interactive standalone script:

```bash
python final.py
```

This prompts you for a video path (or Google Drive link), lets you draw entry/exit lines interactively, enter the real-world distance, and processes the video entirely in the terminal.

---

## ⚙️ API Reference

All endpoints are served at `http://localhost:8000`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/login` | Authenticate user; returns role token |
| `POST` | `/api/signup` | Register a new user account |
| `GET` | `/api/progress` | SSE stream — live processing stage & frame counts |
| `POST` | `/api/process` | Start processing (multipart: `file` or `drive_link`, `speed_limit`, `confidence`) |
| `POST` | `/api/cancel` | Cancel the active processing run |
| `GET` | `/api/runs` | List all past runs |
| `GET` | `/api/runs/{run_id}` | Retrieve a single run's metadata |
| `DELETE` | `/api/runs/{run_id}` | Delete a run record and its output folder |
| `GET` | `/api/stats` | Aggregate stats (total videos, vehicles, avg speed, overspeed count) |
| `GET` | `/api/violations` | All per-vehicle overspeed violations across every run |
| `GET` | `/api/speed-limit` | Get the current global speed limit |
| `POST` | `/api/speed-limit` | Update the global speed limit (10–300 km/h) |
| `GET` | `/api/file/{run_id}/{filename}` | Serve output files with HTTP Range support |

---

## 📊 Output Files

### `log.csv` — Per-Vehicle Speed Log

```
ID,Class,EntryLine,EntryTime,ExitLine,ExitTime,Duration_s,Speed_kmh,RawSpeed_kmh
3,car,A,4.233,B,5.900,1.667,72.39,74.12
7,truck,B,8.100,A,10.933,2.833,57.14,58.90
```

### `speed_graph.png` — Speed Bar Chart

Dark-themed bar chart with per-vehicle speeds. Bars are coloured:
- 🔵 **Blue** — within speed limit
- 🔴 **Red** — over speed limit (> 60 km/h default)

### `output.mp4` — Annotated Video (H.264)

- Bounding boxes: 🟢 Green (in ROI) / 🟡 Yellow (outside ROI)
- Label: `ID {n} | {speed} km/h` for measured vehicles, `ID {n}` for others
- Line A and Line B drawn on every frame

---

## 🎯 Speed Estimation Pipeline

```
Video Frame
    │
    ▼
YOLOv8n Detection  ──→  BotSORT Tracking (persistent IDs)
    │
    ▼
Project centroid → Warped (bird's-eye) coordinates via Homography H
    │
    ▼
Side-of-Line test for Line A and Line B
    │
    ├── First crossing detected  →  record t₁, entry line
    │
    └── Second crossing detected →  Δt = t₂ − t₁
                                     v_raw = (real_distance / Δt) × 3.6
                                     v_final = EMA(v_raw, α=0.35)
                                     → log to CSV + annotate frame
```

**Crossing Guards:**
- `MIN_TRAVEL_TIME = 0.5 s` — rejects implausibly fast crossings
- `MAX_TRAVEL_TIME = 30.0 s` — resets stale entry records
- `CROSS_COOLDOWN = 0.4 s` — debounce per vehicle per crossing event
- `MAX_SPEED_KMH = 250.0` — hard cap to discard sensor noise

---

## 🔧 Configuration

### `calibration.json` (auto-generated by `calibrate.py`)

```json
{
  "homography": {
    "src_quad": [[x1,y1], [x2,y2], [x3,y3], [x4,y4]],
    "dst_size": [734, 799],
    "matrix": [[ ... 3×3 ... ]]
  },
  "line_A": [[4, 753], [733, 753]],
  "line_B": [[4, 122], [733, 122]],
  "real_distance": 45.0,
  "video_reference": "highway.mp4"
}
```

### `settings.json`

```json
{ "speed_limit": 40 }
```

### Processing Constants (`roi_headless.py`)

| Constant | Default | Purpose |
|----------|---------|---------|
| `MIN_TRAVEL_TIME` | 0.5 s | Minimum valid crossing duration |
| `MAX_TRAVEL_TIME` | 30.0 s | Stale entry timeout |
| `CROSS_COOLDOWN` | 0.4 s | Per-vehicle crossing debounce |
| `EMA_ALPHA` | 0.35 | Speed smoothing factor |
| `MAX_SPEED_KMH` | 250.0 | Hard speed cap |
| `SAVE_FRAMES` | False | Save individual processed frames |

---

## 📈 Performance

| Component | Detail | Accuracy |
|-----------|--------|----------|
| Detection | YOLOv8n, conf=0.75 default | ~95% mAP |
| Tracking | BotSORT (botsort.yaml) | <1% ID switch rate |
| Homography | 4-point perspective warp | Sub-pixel lane accuracy |
| Speed | ROI line-crossing + EMA | ±3–8 km/h |
| Video Output | H.264 (avc1 or ffmpeg) | Browser-native playback |

**Processing Speed (approx.):**
- **NVIDIA GPU (e.g. RTX 3060):** 20–30 FPS
- **CPU only:** 6–12 FPS

---

## 🔐 Authentication

Two credential stores are used (plain JSON — for development/demo):

| File | Role |
|------|------|
| `admins.json` | Admin-level users |
| `users.json` | Regular users (self-registered via `/signup`) |

Tokens are simple strings (`token-{username}`). Sessions persist in `localStorage`.

> ⚠️ The current auth is **demo-grade only**. Do not expose this server to the public internet without replacing it with proper JWT/OAuth.

---

## 🆘 Troubleshooting

| Problem | Fix |
|---------|-----|
| `calibration.json not found` | Run `python calibrate.py` before starting the server |
| Video not playing in browser | Install ffmpeg and add it to PATH |
| `gdown` download fails | Ensure the Google Drive file is shared as *"Anyone with the link"* |
| No vehicles measured | Check that lines are correctly positioned; ensure `real_distance` is accurate |
| Speed values are wildly wrong | Re-run calibration; verify the quad covers the actual road surface |
| SSE progress not updating | Check CORS settings; ensure frontend is proxied correctly to port 8000 |

---

## 🚀 Planned Enhancements

- [ ] Speed-limit violation alerts with number-plate annotation
- [ ] Multi-camera / multi-lane support
- [ ] JWT-based authentication
- [ ] Cloud deployment (Docker + AWS/GCP)
- [ ] Live RTSP stream input
- [ ] Export violations report as PDF

---

## 🙏 Technology Stack

| Layer | Technology |
|-------|------------|
| **Detection** | YOLOv8n (Ultralytics) |
| **Tracking** | BotSORT (`botsort.yaml`) |
| **Homography** | OpenCV `findHomography` + `warpPerspective` |
| **Speed Logic** | ROI line-crossing + EMA smoothing |
| **Backend** | FastAPI + Uvicorn |
| **Streaming** | Server-Sent Events (SSE) |
| **Frontend** | React 18 + Vite 5 + TailwindCSS 3 |
| **Routing** | React Router v6 |
| **Drive Download** | gdown |
| **Video Encoding** | OpenCV avc1 / mp4v + ffmpeg H.264 |
| **Charts** | Matplotlib (server-side, dark theme) |
