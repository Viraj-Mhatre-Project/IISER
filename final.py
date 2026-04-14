import cv2
import numpy as np
import os
import math
import pandas as pd
import matplotlib.pyplot as plt
from datetime import datetime
from ultralytics import YOLO
import re
import requests
from tqdm import tqdm
import logging
import glob

# ----------------------------
# SILENCE YOLO LOGS
# ----------------------------
logging.getLogger("ultralytics").setLevel(logging.ERROR)

# ----------------------------
# CONFIG FLAGS
# ----------------------------
SAVE_FRAMES     = False
MIN_TRAVEL_TIME = 0.3
MAX_TRAVEL_TIME = 30.0

# ----------------------------
# DOWNLOAD FUNCTION
# ----------------------------
def download_from_drive(link):
    match = re.search(r'/d/([a-zA-Z0-9_-]+)', link)
    if not match:
        print("Could not extract file ID from Drive link.")
        return link

    file_id     = match.group(1)
    output_path = "temp_video.mp4"
    session     = requests.Session()

    print("\nDownloading video from Google Drive...")

    url      = "https://drive.google.com/uc?export=download"
    response = session.get(url, params={"id": file_id}, stream=True)

    content_type = response.headers.get("Content-Type", "")
    if "text/html" in content_type:
        page_text   = response.text
        token_match = re.search(r'confirm=([0-9A-Za-z_\-]+)', page_text)
        uuid_match  = re.search(r'uuid=([0-9A-Za-z_\-]+)',    page_text)

        if token_match:
            confirm  = token_match.group(1)
            response = session.get(url, params={"id": file_id, "confirm": confirm}, stream=True)
        elif uuid_match:
            uuid     = uuid_match.group(1)
            response = session.get(
                "https://drive.usercontent.google.com/download",
                params={"id": file_id, "export": "download", "confirm": "t", "uuid": uuid},
                stream=True
            )
        else:
            response = session.get(
                "https://drive.usercontent.google.com/download",
                params={"id": file_id, "export": "download", "confirm": "t"},
                stream=True
            )

    total_size = int(response.headers.get("content-length", 0))

    with open(output_path, "wb") as f, tqdm(
        desc="Download", total=total_size, unit="B", unit_scale=True
    ) as bar:
        for chunk in response.iter_content(chunk_size=32768):
            if chunk:
                f.write(chunk)
                bar.update(len(chunk))

    size = os.path.getsize(output_path)
    if size < 50_000:
        print(f"\nERROR: Downloaded file is only {size} bytes — likely an HTML error page.")
        print("Make sure the Google Drive file is shared as 'Anyone with the link can view'.")
        os.remove(output_path)
        exit(1)

    print("Download complete!\n")
    return output_path

# ----------------------------
# GLOBALS
# ----------------------------
points    = []
mouse_pos = [0, 0]
snap_mode = True

def snap(ax, ay, bx, by):
    dx = abs(bx - ax)
    dy = abs(by - ay)
    if dx >= dy:
        return (bx, ay)
    else:
        return (ax, by)

def select_points(event, x, y, flags, param):
    global points, mouse_pos
    mouse_pos = [x, y]
    if event == cv2.EVENT_LBUTTONDOWN and len(points) < 2:
        if snap_mode and len(points) == 1:
            sx, sy = snap(points[0][0], points[0][1], x, y)
            points.append((sx, sy))
        else:
            points.append((x, y))
        print(f"  Point {len(points)}: {points[-1]}")

# ----------------------------
# INPUT VIDEO
# ----------------------------
video_path = input("Enter video path or drive link: ").strip()
if "drive.google.com" in video_path:
    video_path = download_from_drive(video_path)

cap = cv2.VideoCapture(video_path)
ret, frame = cap.read()
if not ret:
    print("Error reading video")
    exit()

# ----------------------------
# LINE MODE
# ----------------------------
print("\nLine drawing mode:")
print("  1 -> Straight lines only (snaps to horizontal or vertical)")
print("  2 -> Free lines (place points anywhere)")
while True:
    mode_input = input("Choose mode [1/2]: ").strip()
    if mode_input in ("1", "2"):
        snap_mode = (mode_input == "1")
        break
    print("  Please enter 1 or 2.")

# ----------------------------
# PHASE 1 — Mark entry line
# ----------------------------
cv2.namedWindow("Setup", cv2.WINDOW_NORMAL)
cv2.resizeWindow("Setup", 1000, 700)
cv2.setMouseCallback("Setup", select_points)

if snap_mode:
    print("\nPHASE 1: Click 2 points for the ENTRY line (GREEN).")
    print("  2nd point snaps to horizontal or vertical.")
else:
    print("\nPHASE 1: Click 2 points for the ENTRY line (GREEN).")
print("Press ENTER to confirm.\n")

while True:
    temp = frame.copy()
    mx, my = mouse_pos

    if len(points) == 1:
        sx, sy = snap(points[0][0], points[0][1], mx, my) if snap_mode else (mx, my)
        cv2.line(temp, points[0], (sx, sy), (0, 255, 0), 1)
        cv2.circle(temp, (sx, sy), 4, (0, 255, 0), -1)

    for i, p in enumerate(points):
        cv2.circle(temp, p, 6, (0, 255, 0), -1)
        cv2.putText(temp, str(i+1), (p[0]+8, p[1]-8), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255,255,0), 2)
    if len(points) >= 2:
        cv2.line(temp, points[0], points[1], (0, 255, 0), 2)
        cv2.putText(temp, "ENTRY", (points[0][0], points[0][1]-10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,255,0), 2)

    cv2.putText(temp, f"Points marked: {len(points)}/2",
                (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255,255,255), 2)
    cv2.imshow("Setup", temp)
    key = cv2.waitKey(1) & 0xFF
    if key == 13 and len(points) == 2:
        break
    if key == 27:
        cap.release()
        exit()

p1, p2 = points[0], points[1]

# ----------------------------
# PHASE 2 — Position & resize exit line
# ----------------------------
dx     = p2[0] - p1[0]
dy     = p2[1] - p1[1]
length = math.hypot(dx, dy)
ux, uy = dx / length, dy / length
px_unit, py_unit = -uy, ux

exit_offset    = 80
exit_scale     = 1.0
exit_confirmed = False

frame_h, frame_w = frame.shape[:2]
max_safe_offset  = min(frame_w, frame_h) * 0.75

def get_exit_line(offset, scale):
    cx   = (p1[0] + p2[0]) / 2
    cy   = (p1[1] + p2[1]) / 2
    ecx  = cx + px_unit * offset
    ecy  = cy + py_unit * offset
    half = (length * scale) / 2
    ex1  = (int(ecx - ux * half), int(ecy - uy * half))
    ex2  = (int(ecx + ux * half), int(ecy + uy * half))
    return ex1, ex2

def setup_mouse(event, x, y, flags, param):
    global exit_offset, exit_scale, exit_confirmed, mouse_pos
    mouse_pos = [x, y]
    if event == cv2.EVENT_MOUSEMOVE:
        cx     = (p1[0] + p2[0]) / 2
        cy     = (p1[1] + p2[1]) / 2
        mx_rel = x - cx
        my_rel = y - cy
        raw    = mx_rel * px_unit + my_rel * py_unit
        exit_offset = max(-max_safe_offset, min(max_safe_offset, raw))
    elif event == cv2.EVENT_MOUSEWHEEL:
        if flags > 0:
            exit_scale = min(exit_scale + 0.05, 5.0)
        else:
            exit_scale = max(exit_scale - 0.05, 0.1)
    elif event == cv2.EVENT_LBUTTONDOWN:
        exit_confirmed = True

cv2.setMouseCallback("Setup", setup_mouse)

print("PHASE 2: Position the EXIT line (RED).")
print("  Move mouse to slide it parallel to the entry line.")
print("  Scroll wheel to resize its length.")
print("  Left-click to confirm, then press ENTER.\n")

while True:
    temp = frame.copy()

    cv2.line(temp, p1, p2, (0, 255, 0), 2)
    cv2.putText(temp, "ENTRY", (p1[0], p1[1]-10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,255,0), 2)

    ex1, ex2 = get_exit_line(exit_offset, exit_scale)
    color     = (0, 200, 255) if not exit_confirmed else (0, 0, 255)
    cv2.line(temp, ex1, ex2, color, 2)
    cv2.putText(temp, "EXIT", (ex1[0], ex1[1]-10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,0,255), 2)

    status = "CONFIRMED — press ENTER" if exit_confirmed else "Move mouse | Scroll to resize | Click to confirm"
    cv2.putText(temp, status, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255,255,255), 2)

    cv2.imshow("Setup", temp)
    key = cv2.waitKey(1) & 0xFF
    if key == 13 and exit_confirmed:
        break
    if key == 27:
        cap.release()
        exit()

cv2.destroyAllWindows()

ex1, ex2 = get_exit_line(exit_offset, exit_scale)
points   = [p1, p2, ex1, ex2]

line_A = (points[0], points[1])
line_B = (points[2], points[3])

line_A_y = (line_A[0][1] + line_A[1][1]) / 2
line_B_y = (line_B[0][1] + line_B[1][1]) / 2

roi_y_lo = min(line_A_y, line_B_y) - 20
roi_y_hi = max(line_A_y, line_B_y) + 20

print(f"\nLine A avg Y: {line_A_y:.1f}")
print(f"Line B avg Y: {line_B_y:.1f}")

# ----------------------------
# INPUT DISTANCE
# ----------------------------
real_distance = float(input("Enter distance between lines (meters): "))

# ----------------------------
# MODEL
# ----------------------------
model = YOLO("yolov8n.pt")

# ----------------------------
# RUN FOLDER
# ----------------------------
os.makedirs("outputs_roi", exist_ok=True)

existing = glob.glob("outputs_roi/Run*")
max_run  = 0
for folder in existing:
    m = re.match(r'Run(\d+)_', os.path.basename(folder))
    if m:
        max_run = max(max_run, int(m.group(1)))

run_number = max_run + 1
now        = datetime.now()
run_name   = f"Run{run_number}_{now.strftime('%d-%m')}_{now.strftime('%H-%M')}"
run_dir    = f"outputs_roi/{run_name}"
os.makedirs(run_dir)

if SAVE_FRAMES:
    frames_dir = f"{run_dir}/frames"
    os.makedirs(frames_dir)

print(f"\nSaving to: {run_dir}")

fps          = cap.get(cv2.CAP_PROP_FPS)
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
w            = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
h            = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

mp4_path = f"{run_dir}/output.mp4"
mp4_ok   = False

for codec in ['mp4v', 'avc1']:
    try:
        test_writer = cv2.VideoWriter(
            mp4_path, cv2.VideoWriter_fourcc(*codec), fps, (w, h)
        )
        if test_writer.isOpened():
            out    = test_writer
            mp4_ok = True
            print(f"Writing video directly as MP4 (codec: {codec}).")
            break
        test_writer.release()
    except Exception:
        continue

if not mp4_ok:
    mp4_path = f"{run_dir}/output.avi"
    out      = cv2.VideoWriter(
        mp4_path, cv2.VideoWriter_fourcc(*'XVID'), fps, (w, h)
    )
    print("MP4 codec unavailable — writing as output.avi (open with VLC).")

# ----------------------------
# HELPERS
# ----------------------------
def side_of_line(cx, cy, line):
    (x1, y1), (x2, y2) = line
    val = (x2 - x1) * (cy - y1) - (y2 - y1) * (cx - x1)
    return 1 if val >= 0 else -1

def in_roi(cy):
    return roi_y_lo <= cy <= roi_y_hi

def draw_label(frame, x1, y1, text, color=(0, 255, 255)):
    """Draw a label box above a bounding box."""
    font  = cv2.FONT_HERSHEY_SIMPLEX
    scale = 0.38   # reduced from 0.6 — smaller, less cluttered
    thick = 1      # thinner stroke matches smaller size
    (tw, th), bl = cv2.getTextSize(text, font, scale, thick)
    lx = max(x1, 2)
    ly = max(y1 - 4, th + 6)
    cv2.rectangle(frame, (lx - 2, ly - th - 4), (lx + tw + 4, ly + bl + 2), (0, 0, 0), -1)
    cv2.putText(frame, text, (lx, ly - 2), font, scale, color, thick, cv2.LINE_AA)

def live_speed_estimate(obj_id, cy, first_cy, dt_live):
    """
    Compute instantaneous speed and smooth it with an EMA so the
    on-screen number doesn't jump every frame.
    EMA_ALPHA: lower = smoother but more lag, higher = more responsive.
    """
    EMA_ALPHA = 0.25   # tweak between 0.05 (very smooth) and 0.3 (more reactive)

    dy_px    = abs(cy - first_cy)
    roi_px   = max(abs(line_A_y - line_B_y), 1)
    perp_px  = dy_px / max(abs(py_unit), 0.01)
    dist_est = (min(perp_px, roi_px) / roi_px) * real_distance

    if dt_live > 0.05 and dy_px > 3:
        raw_kmh = (dist_est / dt_live) * 3.6
        if obj_id in ema_speed:
            ema_speed[obj_id] = EMA_ALPHA * raw_kmh + (1 - EMA_ALPHA) * ema_speed[obj_id]
        else:
            ema_speed[obj_id] = raw_kmh   # seed with first reading
        return f"~{ema_speed[obj_id]:.1f} km/h"
    return "-- km/h"

# ----------------------------
# TRACKING STATE
# ----------------------------
first_cross_time  = {}
first_cross_cy    = {}
first_cross_line  = {}
second_cross_time = {}
speeds            = {}
ema_speed         = {}   # smoothed live speed per vehicle
prev_side_A       = {}
prev_side_B       = {}
log_data          = []

# ----------------------------
# REWIND & PROCESS
# ----------------------------
cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
frame_count = 0

print("Processing...\n")
with tqdm(total=total_frames, desc="Frames", ncols=100) as pbar:
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        t       = frame_count / fps
        results = model.track(frame, persist=True, tracker="botsort.yaml", verbose=False)

        if results[0].boxes.id is not None:
            boxes = results[0].boxes.xyxy.cpu().numpy()
            ids   = results[0].boxes.id.cpu().numpy().astype(int)
            clss  = results[0].boxes.cls.cpu().numpy().astype(int)

            for box, obj_id, cls in zip(boxes, ids, clss):
                x1, y1, x2, y2 = map(int, box)
                cx = (x1 + x2) // 2
                cy = (y1 + y2) // 2

                sA = side_of_line(cx, cy, line_A)
                sB = side_of_line(cx, cy, line_B)

                # ── CROSSING LOGIC: only process if vehicle centroid is in ROI ──
                # FIX 1: Gate ALL crossing detection on in_roi(cy).
                # Previously this check was only on the HUD label, so out-of-ROI
                # vehicles still had their crossing times recorded and received speeds.
                if in_roi(cy):
                    # ── FIRST crossing ──────────────────────────────────
                    if obj_id not in first_cross_time:
                        crossed_A = obj_id in prev_side_A and prev_side_A[obj_id] != sA
                        crossed_B = obj_id in prev_side_B and prev_side_B[obj_id] != sB
                        if crossed_A:
                            first_cross_time[obj_id] = t
                            first_cross_cy[obj_id]   = cy
                            first_cross_line[obj_id] = 'A'
                            print(f"  CROSS-1 id={obj_id} crossed Line A (entry)  t={t:.2f}s")
                        elif crossed_B:
                            first_cross_time[obj_id] = t
                            first_cross_cy[obj_id]   = cy
                            first_cross_line[obj_id] = 'B'
                            print(f"  CROSS-1 id={obj_id} crossed Line B (entry)  t={t:.2f}s")

                    # ── SECOND crossing ─────────────────────────────────
                    elif obj_id not in second_cross_time:
                        other_line  = line_B if first_cross_line[obj_id] == 'A' else line_A
                        other_label = 'B'    if first_cross_line[obj_id] == 'A' else 'A'
                        other_prev  = prev_side_B if first_cross_line[obj_id] == 'A' else prev_side_A
                        other_curr  = sB          if first_cross_line[obj_id] == 'A' else sA

                        if obj_id in other_prev and other_prev[obj_id] != other_curr:
                            dt = t - first_cross_time[obj_id]

                            if dt < MIN_TRAVEL_TIME:
                                print(f"  SKIP  id={obj_id}  dt={dt:.3f}s too small — check line spacing")
                            elif dt > MAX_TRAVEL_TIME:
                                print(f"  SKIP  id={obj_id}  dt={dt:.3f}s too large — likely ID re-association, discarding")
                                del first_cross_time[obj_id]
                                del first_cross_cy[obj_id]
                                del first_cross_line[obj_id]
                            else:
                                spd = (real_distance / dt) * 3.6
                                speeds[obj_id]            = spd
                                second_cross_time[obj_id] = t
                                log_data.append({
                                    "ID":        obj_id,
                                    "Class":     model.names[cls],
                                    "EntryLine": first_cross_line[obj_id],
                                    "EntryTime": round(first_cross_time[obj_id], 3),
                                    "ExitLine":  other_label,
                                    "ExitTime":  round(t, 3),
                                    "Duration_s":round(dt, 3),
                                    "Speed_kmh": round(spd, 2),
                                })
                                print(f"  CROSS-2 id={obj_id} crossed Line {other_label} (exit)  speed={spd:.1f} km/h")

                # Always update prev_side regardless of ROI (needed for edge detection next frame)
                prev_side_A[obj_id] = sA
                prev_side_B[obj_id] = sB

                # ── Draw bounding box for ALL vehicles ──────────────────
                # FIX 2: Every detected vehicle gets a coloured box + ID label.
                # Vehicles in ROI with a known speed show it; others just show ID.
                if in_roi(cy):
                    box_color = (0, 255, 0)   # green = inside ROI
                else:
                    box_color = (0, 200, 255)  # yellow = outside ROI

                cv2.rectangle(frame, (x1, y1), (x2, y2), box_color, 2)

                # Build the label text
                if obj_id in speeds:
                    # Final confirmed speed
                    label_text  = f"ID {obj_id} | {speeds[obj_id]:.1f} km/h"
                    label_color = (0, 255, 0)
                elif obj_id in first_cross_time and in_roi(cy):
                    # Live estimate while travelling between lines
                    dt_live    = t - first_cross_time[obj_id]
                    est        = live_speed_estimate(obj_id, cy, first_cross_cy[obj_id], dt_live)
                    label_text  = f"ID {obj_id} | {est}"
                    label_color = (0, 255, 255)
                else:
                    # Just the ID — not yet in measurement zone
                    label_text  = f"ID {obj_id}"
                    label_color = (200, 200, 200)

                draw_label(frame, x1, y1, label_text, color=label_color)

        # ── Draw lines ──────────────────────────────────────────────
        cv2.line(frame, line_A[0], line_A[1], (0, 255, 255), 2)
        cv2.line(frame, line_B[0], line_B[1], (0, 255, 255), 2)
        cv2.putText(frame, "Line A", (line_A[0][0], line_A[0][1]-8),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
        cv2.putText(frame, "Line B", (line_B[0][0], line_B[0][1]-8),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)

        if SAVE_FRAMES:
            cv2.imwrite(f"{frames_dir}/frame_{frame_count:06d}.jpg", frame)

        out.write(frame)
        frame_count += 1
        pbar.update(1)

# ----------------------------
# ORPHAN REPORT
# ----------------------------
orphans = set(first_cross_time.keys()) - set(second_cross_time.keys())
if orphans:
    print(f"\nWARNING: {len(orphans)} vehicle(s) crossed entry line but never reached exit.")
    print(f"  Orphan IDs: {sorted(orphans)}")
    print("  Possible causes: occlusion, ID switch, vehicle leaving frame, or lines too far apart.")

# ----------------------------
# SAVE CSV + GRAPH
# ----------------------------
df = pd.DataFrame(log_data)

if not df.empty:
    df.to_csv(f"{run_dir}/log.csv", index=False)
    plt.figure(figsize=(10, 5))
    plt.scatter(df["EntryTime"], df["Speed_kmh"], s=60, zorder=5)
    for _, row in df.iterrows():
        label = f"ID {int(row['ID'])} ({row['Class']}) {row['EntryLine']}->{row['ExitLine']}"
        plt.annotate(label,
                     (row["EntryTime"], row["Speed_kmh"]),
                     textcoords="offset points", xytext=(6, 4), fontsize=8)
    plt.xlabel("Entry Time (s)")
    plt.ylabel("Speed (km/h)")
    plt.title(f"Speed vs Time — {run_name}")
    plt.tight_layout()
    plt.savefig(f"{run_dir}/graph.png", dpi=150)
    plt.close()
    print(f"\nCSV and graph saved.")
else:
    print("\nWARNING: No vehicles completed entry->exit. Check line positions!")
    pd.DataFrame(columns=["ID","Class","EntryLine","EntryTime","ExitLine","ExitTime","Duration_s","Speed_kmh"])\
      .to_csv(f"{run_dir}/log.csv", index=False)

# ----------------------------
# CLEANUP
# ----------------------------
cap.release()
out.release()
cv2.destroyAllWindows()

if video_path == "temp_video.mp4" and os.path.exists("temp_video.mp4"):
    os.remove("temp_video.mp4")

# ----------------------------
# SUMMARY
# ----------------------------
print(f"\n{'='*45}")
print(f"DONE  ->  {run_dir}")
print(f"Video    : {os.path.basename(mp4_path)}")
print(f"Vehicles tracked : {len(df)}")
if not df.empty:
    print(f"Avg speed : {df['Speed_kmh'].mean():.1f} km/h")
    print(f"Max speed : {df['Speed_kmh'].max():.1f} km/h")
if orphans:
    print(f"Orphan IDs (no exit): {sorted(orphans)}")
print(f"{'='*45}")
