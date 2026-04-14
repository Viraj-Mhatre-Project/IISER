from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import os
import shutil
from typing import Optional
import time

# Import our new headless runner
from roi_headless import run_headless_roi

app = FastAPI(title="SpeedSense AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Since frontend runs on diverse local ports, allow all for now
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------
# AUTH SYSTEM (JSON DB)
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

# ---------------------------------------------------------
# ROI PROCESSING
# ---------------------------------------------------------
@app.post("/api/process")
async def process_video(
    file: Optional[UploadFile] = File(None),
    drive_link: Optional[str] = Form(None),
    speed_limit: int = Form(60),
    confidence: float = Form(0.75)
):
    try:
        # Step 1: get the video file locally
        video_path = ""
        if file:
            video_path = f"temp_upload_{int(time.time())}.mp4"
            with open(video_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        elif drive_link:
            video_path = "temp_video.mp4"
        else:
            raise HTTPException(status_code=400, detail="Must provide video file or Drive link")

        # Step 2: Debug prints
        print(f"CWD: {os.getcwd()}")
        print(f"calibration exists: {os.path.exists('calibration.json')}")
        print(f"video_path: {video_path}")

        # Step 3: Run headless ROI
        print(f"--> Starting headless ROI processing on: {video_path}")
        result = run_headless_roi(video_path)
        
        if result is None:
            raise HTTPException(status_code=500, detail="Processing failed or calibration missing")

        if os.path.exists(video_path):
            try: os.remove(video_path)
            except: pass
            
        return {"status": "success", "data": result}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
