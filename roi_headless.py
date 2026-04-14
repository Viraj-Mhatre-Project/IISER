import cv2
import numpy as np
import os
import math
import pandas as pd
import matplotlib.pyplot as plt
from datetime import datetime
from ultralytics import YOLO
import re
import gdown
import json
import psutil
from tqdm import tqdm
import logging
import glob

logging.getLogger("ultralytics").setLevel(logging.ERROR)

SAVE_FRAMES = False
MIN_TRAVEL_TIME = 0.3
MAX_TRAVEL_TIME = 30.0

def download_from_drive(link):
    if "drive.google.com" not in link: return link
    try:
        file_id = link.split("/d/")[1].split("/")[0]
    except IndexError:
        return link
    download_url = f"https://drive.google.com/uc?id={file_id}"
    output_path = "temp_video.mp4"
    gdown.download(download_url, output_path, quiet=True)
    return output_path

def side_of_line(cx, cy, line):
    (x1, y1), (x2, y2) = line
    val = (x2 - x1) * (cy - y1) - (y2 - y1) * (cx - x1)
    return 1 if val >= 0 else -1

def draw_label(frame, x1, y1, text, color=(0, 255, 255)):
    font, scale, thick = cv2.FONT_HERSHEY_SIMPLEX, 0.38, 1
    (tw, th), bl = cv2.getTextSize(text, font, scale, thick)
    lx, ly = max(x1, 2), max(y1 - 4, th + 6)
    cv2.rectangle(frame, (lx - 2, ly - th - 4), (lx + tw + 4, ly + bl + 2), (0, 0, 0), -1)
    cv2.putText(frame, text, (lx, ly - 2), font, scale, color, thick, cv2.LINE_AA)

def run_headless_roi(video_path, run_id=None, save_dir="outputs_roi"):
    if not os.path.exists("calibration.json"):
        print("ERROR: calibration.json not found. Run calibrate.py first.")
        return None

    with open("calibration.json", "r") as f:
        calib = json.load(f)
        
    line_A = tuple(map(tuple, calib["line_A"]))
    line_B = tuple(map(tuple, calib["line_B"]))
    real_distance = calib["real_distance"]
    
    line_A_y = (line_A[0][1] + line_A[1][1]) / 2
    line_B_y = (line_B[0][1] + line_B[1][1]) / 2
    roi_y_lo = min(line_A_y, line_B_y) - 20
    roi_y_hi = max(line_A_y, line_B_y) + 20
    
    dx = line_A[1][0] - line_A[0][0]
    dy = line_A[1][1] - line_A[0][1]
    length = math.hypot(dx, dy)
    py_unit = dx / length if length > 0 else 1.0
    
    def in_roi(cy): return roi_y_lo <= cy <= roi_y_hi

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print("Error reading video.")
        return None

    model = YOLO("yolov8n.pt")
    
    os.makedirs(save_dir, exist_ok=True)
    if not run_id:
        existing = glob.glob(f"{save_dir}/Run*")
        max_run = 0
        for folder in existing:
            m = re.match(r'Run(\d+)_', os.path.basename(folder))
            if m: max_run = max(max_run, int(m.group(1)))
        now = datetime.now()
        run_name = f"Run{max_run + 1}_{now.strftime('%d-%m_%H-%M')}"
    else:
        run_name = run_id
        
    run_dir = f"{save_dir}/{run_name}"
    os.makedirs(run_dir, exist_ok=True)

    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    mp4_path = f"{run_dir}/output.mp4"
    out = cv2.VideoWriter(mp4_path, cv2.VideoWriter_fourcc(*'mp4v'), fps, (w, h))

    first_cross_time, first_cross_cy, first_cross_line = {}, {}, {}
    second_cross_time, speeds, ema_speed = {}, {}, {}
    prev_side_A, prev_side_B = {}, {}
    log_data = []

    frame_count = 0
    while True:
        ret, frame = cap.read()
        if not ret: break

        t = frame_count / fps
        results = model.track(frame, persist=True, tracker="botsort.yaml", verbose=False)

        if results[0].boxes.id is not None:
            boxes = results[0].boxes.xyxy.cpu().numpy()
            ids = results[0].boxes.id.cpu().numpy().astype(int)
            clss = results[0].boxes.cls.cpu().numpy().astype(int)

            for box, obj_id, cls in zip(boxes, ids, clss):
                x1, y1, x2, y2 = map(int, box)
                cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
                sA, sB = side_of_line(cx, cy, line_A), side_of_line(cx, cy, line_B)

                if in_roi(cy):
                    if obj_id not in first_cross_time:
                        if obj_id in prev_side_A and prev_side_A[obj_id] != sA:
                            first_cross_time[obj_id], first_cross_cy[obj_id], first_cross_line[obj_id] = t, cy, 'A'
                        elif obj_id in prev_side_B and prev_side_B[obj_id] != sB:
                            first_cross_time[obj_id], first_cross_cy[obj_id], first_cross_line[obj_id] = t, cy, 'B'
                    elif obj_id not in second_cross_time:
                        other_label = 'B' if first_cross_line[obj_id] == 'A' else 'A'
                        other_prev = prev_side_B if first_cross_line[obj_id] == 'A' else prev_side_A
                        other_curr = sB if first_cross_line[obj_id] == 'A' else sA

                        if obj_id in other_prev and other_prev[obj_id] != other_curr:
                            dt = t - first_cross_time[obj_id]
                            if MIN_TRAVEL_TIME <= dt <= MAX_TRAVEL_TIME:
                                spd = (real_distance / dt) * 3.6
                                speeds[obj_id] = spd
                                second_cross_time[obj_id] = t
                                log_data.append({
                                    "ID": obj_id, "Class": model.names[cls],
                                    "EntryLine": first_cross_line[obj_id], "EntryTime": round(first_cross_time[obj_id], 3),
                                    "ExitLine": other_label, "ExitTime": round(t, 3),
                                    "Duration_s": round(dt, 3), "Speed_kmh": round(spd, 2)
                                })
                            elif dt > MAX_TRAVEL_TIME:
                                del first_cross_time[obj_id], first_cross_cy[obj_id], first_cross_line[obj_id]

                prev_side_A[obj_id], prev_side_B[obj_id] = sA, sB
                
                box_color = (0, 255, 0) if in_roi(cy) else (0, 200, 255)
                cv2.rectangle(frame, (x1, y1), (x2, y2), box_color, 2)
                
                if obj_id in speeds:
                    draw_label(frame, x1, y1, f"ID {obj_id} | {speeds[obj_id]:.1f} km/h", (0, 255, 0))
                else:
                    draw_label(frame, x1, y1, f"ID {obj_id}", (200, 200, 200))

        cv2.line(frame, line_A[0], line_A[1], (0, 255, 255), 2)
        cv2.line(frame, line_B[0], line_B[1], (0, 255, 255), 2)
        
        out.write(frame)
        frame_count += 1

    cap.release()
    out.release()
    
    df = pd.DataFrame(log_data)
    if not df.empty:
        df.to_csv(f"{run_dir}/log.csv", index=False)
        
    return {
        "run_id": run_name,
        "video_path": mp4_path,
        "total_vehicles": len(df),
        "avg_speed": round(df["Speed_kmh"].mean(), 1) if not df.empty else 0,
        "max_speed": round(df["Speed_kmh"].max(), 1) if not df.empty else 0
    }
