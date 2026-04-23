from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel
import json
import os
import shutil
from typing import Optional
import time
import asyncio

from roi_headless import run_headless_roi, download_from_drive

app = FastAPI(title="SpeedSense AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

RUNS_FILE = "runs.json"

# ---------------------------------------------------------
# RUNS PERSISTENCE
# ---------------------------------------------------------
def load_runs():
    if not os.path.exists(RUNS_FILE):
        return []
    with open(RUNS_FILE, "r") as f:
        return json.load(f)

def save_run(run_data: dict):
    runs = load_runs()
    # Replace if run_id already exists, else append
    runs = [r for r in runs if r.get("run_id") != run_data.get("run_id")]
    runs.insert(0, run_data)
    with open(RUNS_FILE, "w") as f:
        json.dump(runs, f, indent=2)

# ---------------------------------------------------------
# AUTH SYSTEM
# ---------------------------------------------------------
class AuthRequest(BaseModel):
    username: str
    password: str

def load_json(filepath):
    if not os.path.exists(filepath): return {}
    with open(filepath, "r") as f:
        return json.load(f)

def save_json(filepath, data):
    with open(filepath, "w") as f:
        json.dump(data, f, indent=4)

@app.post("/api/login")
def login(req: AuthRequest):
    admins = load_json("admins.json")
    users = load_json("users.json")
    if req.username in admins and admins[req.username] == req.password:
        return {"token": f"token-{req.username}", "role": "admin", "username": req.username}
    if req.username in users and users[req.username] == req.password:
        return {"token": f"token-{req.username}", "role": "user", "username": req.username}
    raise HTTPException(status_code=401, detail="Invalid username or password")

@app.post("/api/signup")
def signup(req: AuthRequest):
    admins = load_json("admins.json")
    users = load_json("users.json")
    if req.username in admins or req.username in users:
        raise HTTPException(status_code=400, detail="Username already exists")
    users[req.username] = req.password
    save_json("users.json", users)
    return {"message": "User created successfully", "token": f"token-{req.username}", "role": "user", "username": req.username}

@app.delete("/api/runs/{run_id}")
def delete_run(run_id: str):
    """Delete a run's record from runs.json and remove its output folder."""
    import shutil
 
    # Remove from runs.json
    runs = load_runs()
    new_runs = [r for r in runs if r.get("run_id") != run_id]
    if len(new_runs) == len(runs):
        raise HTTPException(status_code=404, detail="Run not found")
    with open(RUNS_FILE, "w") as f:
        json.dump(new_runs, f, indent=2)
 
    # Remove output folder
    run_dir = os.path.join("outputs_roi", run_id)
    if os.path.exists(run_dir):
        shutil.rmtree(run_dir)
 
    return {"status": "deleted", "run_id": run_id}

# ---------------------------------------------------------
# PROGRESS STATE (in-memory per process, good enough for single-user)
# ---------------------------------------------------------
processing_state = {
    "active": False,
    "total_frames": 0,
    "extracted_frames": 0,
    "processed_frames": 0,
    "stage": "idle",   # idle | extracting | detecting | finalizing | done | error | cancelled
    "error": None,
    "cancelled": False,
}

def reset_state():
    processing_state.update({
        "active": False,
        "total_frames": 0,
        "extracted_frames": 0,
        "processed_frames": 0,
        "stage": "idle",
        "error": None,
        "cancelled": False,
    })

# ---------------------------------------------------------
# SSE PROGRESS STREAM
# ---------------------------------------------------------
@app.get("/api/progress")
async def progress_stream():
    """SSE endpoint — client connects before POSTing /api/process."""
    async def event_generator():
        while True:
            state = dict(processing_state)
            data = json.dumps(state)
            yield f"data: {data}\n\n"
            if state["stage"] in ("done", "error"):
                break
            await asyncio.sleep(0.4)
    return StreamingResponse(event_generator(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

# ---------------------------------------------------------
# CANCEL ENDPOINT
# ---------------------------------------------------------
@app.post("/api/cancel")
def cancel_processing():
    if processing_state["active"]:
        processing_state["cancelled"] = True
        processing_state["stage"] = "cancelled"
        return {"status": "cancellation requested"}
    return {"status": "no active processing"}

# ---------------------------------------------------------
# MAIN PROCESSING ENDPOINT
# ---------------------------------------------------------
@app.post("/api/process")
async def process_video(
    file: Optional[UploadFile] = File(None),
    drive_link: Optional[str] = Form(None),
    speed_limit: Optional[int] = Form(None),
    confidence: float = Form(0.75)
):  
    try:
        reset_state()
        processing_state["active"] = True
        processing_state["stage"] = "uploading"

        # Use global setting if no explicit value sent from frontend
        if speed_limit is None:
            speed_limit = load_settings().get("speed_limit", 60)

        video_path = ""
        if file:
            video_path = f"temp_upload_{int(time.time())}.mp4"
            await file.seek(0)
            with open(video_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        elif drive_link:
            processing_state["stage"] = "downloading"
            video_path = download_from_drive(drive_link)
            if not os.path.exists(video_path):
                raise HTTPException(status_code=400, detail="Failed to download video from Drive link")
            if os.path.getsize(video_path) < 50_000:
                os.remove(video_path)
                raise HTTPException(status_code=400, detail="Could not access the video. Make sure the file is shared publicly.")
        else:
            raise HTTPException(status_code=400, detail="Must provide video file or Drive link")

        processing_state["stage"] = "initializing"

        print(f"--> Starting headless ROI processing on: {video_path}")
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None, lambda: run_headless_roi(video_path, progress_state=processing_state)
        )

        if result is None:
            processing_state["stage"] = "error"
            processing_state["error"] = "Processing failed or calibration missing"
            raise HTTPException(status_code=500, detail="Processing failed or calibration missing")

        # Persist this run
        run_record = {
            **result,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "speed_limit": speed_limit,
            "source": "drive" if drive_link else "file",
        }
        save_run(run_record)

        processing_state["stage"] = "done"
        processing_state["active"] = False

        if os.path.exists(video_path):
            try: os.remove(video_path)
            except: pass

        return {"status": "success", "data": result}

    except HTTPException:
        processing_state["stage"] = "error"
        raise
    except Exception as e:
        processing_state["stage"] = "error"
        processing_state["error"] = str(e)
        raise HTTPException(status_code=500, detail=str(e))

# ---------------------------------------------------------
# GALLERY & DASHBOARD ENDPOINTS
# ---------------------------------------------------------
@app.get("/api/runs")
def get_runs():
    return {"runs": load_runs()}

@app.get("/api/runs/{run_id}")
def get_run(run_id: str):
    runs = load_runs()
    run = next((r for r in runs if r["run_id"] == run_id), None)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run

@app.get("/api/stats")
def get_stats():
    runs = load_runs()
    total_videos = len(runs)
    total_vehicles = sum(r.get("total_vehicles", 0) for r in runs)
    speeds = [r.get("avg_speed", 0) for r in runs if r.get("avg_speed", 0) > 0]
    avg_speed = round(sum(speeds) / len(speeds), 1) if speeds else 0
    max_speeds = [r.get("max_speed", 0) for r in runs if r.get("max_speed", 0) > 0]
    # Overspeed: count runs where max_speed exceeded their speed_limit
    overspeed = sum(1 for r in runs if r.get("max_speed", 0) > r.get("speed_limit", 60))
    return {
        "total_videos": total_videos,
        "total_vehicles": total_vehicles,
        "overspeed_violations": overspeed,
        "avg_speed": avg_speed,
        "recent_runs": runs[:5],
    }

# ---------------------------------------------------------
# SPEED LIMIT SETTINGS
# ---------------------------------------------------------
SETTINGS_FILE = "settings.json"

def load_settings():
    if not os.path.exists(SETTINGS_FILE):
        return {"speed_limit": 60}
    with open(SETTINGS_FILE, "r") as f:
        return json.load(f)

def save_settings(data: dict):
    with open(SETTINGS_FILE, "w") as f:
        json.dump(data, f, indent=2)

@app.get("/api/speed-limit")
def get_speed_limit():
    return load_settings()

@app.post("/api/speed-limit")
def set_speed_limit(limit: int = Form(...)):
    if not (10 <= limit <= 300):
        raise HTTPException(status_code=400, detail="Speed limit must be between 10 and 300 km/h")
    settings = load_settings()
    settings["speed_limit"] = limit
    save_settings(settings)
    return {"speed_limit": limit}

# ---------------------------------------------------------
# VIOLATIONS — per-vehicle records from CSV logs
# ---------------------------------------------------------
@app.get("/api/violations")
def get_violations():
    """
    Reads every run's log.csv, finds rows where Speed_kmh > run's speed_limit,
    and returns a flat list of violation records sorted newest first.
    """
    import csv
    settings = load_settings()
    global_limit = settings.get("speed_limit", 60)
    runs = load_runs()
    violations = []

    for run in runs:
        run_id = run.get("run_id")
        run_limit = run.get("speed_limit", global_limit)
        csv_path = os.path.join("outputs_roi", run_id, "log.csv")
        if not os.path.exists(csv_path):
            continue
        try:
            with open(csv_path, newline="") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    speed = float(row.get("Speed_kmh", 0))
                    if speed > run_limit:
                        violations.append({
                            "run_id": run_id,
                            "timestamp": run.get("timestamp"),
                            "vehicle_id": row.get("ID"),
                            "vehicle_class": row.get("Class", "unknown"),
                            "speed_kmh": round(speed, 1),
                            "speed_limit": run_limit,
                            "excess_kmh": round(speed - run_limit, 1),
                            "entry_time": row.get("EntryTime"),
                            "exit_time": row.get("ExitTime"),
                            "duration_s": row.get("Duration_s"),
                            "video_url": f"/api/file/{run_id}/output.mp4",
                            "graph_url": f"/api/file/{run_id}/speed_graph.png",
                        })
        except Exception as e:
            print(f"Error reading CSV for {run_id}: {e}")
            continue

    # Sort by timestamp desc
    violations.sort(key=lambda x: x.get("timestamp") or "", reverse=True)
    return {"violations": violations, "total": len(violations), "speed_limit": global_limit}

@app.get("/api/file/{run_id}/{filename}")
def serve_file(run_id: str, filename: str, request: Request):
    """Serve output video/CSV/graph with HTTP Range support for browser video playback."""
    from starlette.responses import Response
    safe_name = os.path.basename(filename)
    path = os.path.join("outputs_roi", run_id, safe_name)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")

    file_size = os.path.getsize(path)

    # Determine content type
    ext = safe_name.rsplit('.', 1)[-1].lower()
    content_types = {
        'mp4': 'video/mp4', 'avi': 'video/x-msvideo', 'mov': 'video/quicktime',
        'csv': 'text/csv', 'png': 'image/png', 'jpg': 'image/jpeg',
    }
    media_type = content_types.get(ext, 'application/octet-stream')

    range_header = request.headers.get('range')
    if range_header:
        # Parse Range: bytes=start-end
        try:
            range_val = range_header.replace('bytes=', '')
            start_str, end_str = range_val.split('-')
            start = int(start_str)
            end = int(end_str) if end_str else file_size - 1
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid range header")

        end = min(end, file_size - 1)
        chunk_size = end - start + 1

        def iter_file():
            with open(path, 'rb') as f:
                f.seek(start)
                remaining = chunk_size
                while remaining > 0:
                    data = f.read(min(65536, remaining))
                    if not data:
                        break
                    remaining -= len(data)
                    yield data

        headers = {
            'Content-Range': f'bytes {start}-{end}/{file_size}',
            'Accept-Ranges': 'bytes',
            'Content-Length': str(chunk_size),
            'Content-Disposition': f'inline; filename="{safe_name}"',
        }
        return StreamingResponse(iter_file(), status_code=206,
                                 headers=headers, media_type=media_type)

    # No range — serve entire file
    def iter_full():
        with open(path, 'rb') as f:
            while chunk := f.read(65536):
                yield chunk

    headers = {
        'Accept-Ranges': 'bytes',
        'Content-Length': str(file_size),
        'Content-Disposition': f'inline; filename="{safe_name}"',
    }
    return StreamingResponse(iter_full(), headers=headers, media_type=media_type)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)