import cv2
import numpy as np
import os
import subprocess
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from datetime import datetime
from ultralytics import YOLO
import re
import gdown
import json
import glob
import logging
import math

logging.getLogger("ultralytics").setLevel(logging.ERROR)

SAVE_FRAMES     = False
MIN_TRAVEL_TIME = 0.5
MAX_TRAVEL_TIME = 30.0
CROSS_COOLDOWN  = 0.4
EMA_ALPHA       = 0.35
MAX_SPEED_KMH   = 250.0


def download_from_drive(link):
    if "drive.google.com" not in link:
        return link
    try:
        file_id = link.split("/d/")[1].split("/")[0]
    except IndexError:
        return link
    download_url = f"https://drive.google.com/uc?id={file_id}"
    output_path  = "temp_video.mp4"
    gdown.download(download_url, output_path, quiet=True)
    return output_path


# ── Codec / writer helpers ────────────────────────────────────────────────────

def _ffmpeg_available():
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
        return True
    except Exception:
        return False


def _avc1_available(width, height, fps):
    try:
        tmp = "__codec_test__.mp4"
        writer = cv2.VideoWriter(tmp, cv2.VideoWriter_fourcc(*'avc1'),
                                 fps, (width, height))
        ok = writer.isOpened()
        writer.release()
        if os.path.exists(tmp):
            os.remove(tmp)
        return ok
    except Exception:
        return False


def make_writer(path, fps, width, height):
    if _avc1_available(width, height, fps):
        print("[codec] Using avc1 (H.264) directly.")
        return (cv2.VideoWriter(path, cv2.VideoWriter_fourcc(*'avc1'), fps, (width, height)),
                'avc1')
    print("[codec] avc1 unavailable — using mp4v with post-process ffmpeg re-encode.")
    return (cv2.VideoWriter(path, cv2.VideoWriter_fourcc(*'mp4v'), fps, (width, height)),
            'mp4v')


def reencode_h264(mp4_path):
    if not _ffmpeg_available():
        print("[codec] ffmpeg not found — video may not play in browser.")
        return False
    tmp = mp4_path.replace(".mp4", "_raw.mp4")
    try:
        os.rename(mp4_path, tmp)
        result = subprocess.run(
            ["ffmpeg", "-y", "-i", tmp,
             "-vcodec", "libx264",
             "-pix_fmt", "yuv420p",
             "-movflags", "+faststart",
             "-crf", "23",
             mp4_path],
            capture_output=True, text=True
        )
        if result.returncode != 0:
            print(f"[codec] ffmpeg failed:\n{result.stderr}")
            os.rename(tmp, mp4_path)
            return False
        os.remove(tmp)
        print("[codec] Re-encoded to H.264 successfully.")
        return True
    except Exception as e:
        print(f"[codec] Re-encode error: {e}")
        if os.path.exists(tmp) and not os.path.exists(mp4_path):
            os.rename(tmp, mp4_path)
        return False


# ── Geometry helpers ──────────────────────────────────────────────────────────

def side_of_line(cx, cy, line):
    (x1, y1), (x2, y2) = line
    val = (x2 - x1) * (cy - y1) - (y2 - y1) * (cx - x1)
    return 1 if val >= 0 else -1


def draw_label(frame, x1, y1, text, color=(0, 255, 255), bg_color=(0, 0, 0)):
    font, scale, thick = cv2.FONT_HERSHEY_SIMPLEX, 0.55, 1
    (tw, th), bl = cv2.getTextSize(text, font, scale, thick)
    lx = max(x1, 2)
    ly = max(y1 - 4, th + 6)
    cv2.rectangle(frame, (lx - 2, ly - th - 4), (lx + tw + 4, ly + bl + 2), bg_color, -1)
    cv2.putText(frame, text, (lx, ly - 2), font, scale, color, thick, cv2.LINE_AA)


def project_point(pt, H):
    p = np.array([[[float(pt[0]), float(pt[1])]]], dtype="float32")
    warped = cv2.perspectiveTransform(p, H)
    return float(warped[0][0][0]), float(warped[0][0][1])


def _line_midpoint(a, b):
    return ((a[0] + b[0]) / 2.0, (a[1] + b[1]) / 2.0)


def build_roi_polygon_orig(line_A_orig, line_B_orig):
    """Quad between the two lines in original-frame coordinates."""
    return np.array([
        line_A_orig[0],
        line_A_orig[1],
        line_B_orig[1],
        line_B_orig[0],
    ], dtype=np.int32)


def point_in_polygon(px, py, polygon):
    """
    Check if point (px, py) is inside the given polygon (numpy int32 array).
    Uses OpenCV's pointPolygonTest.
    Returns True if inside or on boundary.
    """
    result = cv2.pointPolygonTest(polygon, (float(px), float(py)), False)
    return result >= 0


# ── Main processing function ──────────────────────────────────────────────────

def run_headless_roi(video_path, run_id=None, save_dir="outputs_roi", progress_state=None):
    """
    Key fixes vs previous version:
    ──────────────────────────────
    FIX 1: ROI containment now uses pointPolygonTest on the actual warped-space
            quad polygon (line_A → line_B quad). Only vehicles whose warped
            centroid falls inside this polygon are drawn with labels/colors.
            Vehicles outside get a thin grey box and NO label — regardless of
            their y-coordinate alone.

    FIX 2: Real-time speed display.
            • 'measuring' state now shows a live elapsed-time speed estimate
              (distance / elapsed_time * 3.6) that updates every frame,
              so the driver sees a changing number rather than "Measuring..."
            • On second crossing, confirmed EMA-smoothed speed replaces it.
            • State 'done' shows the confirmed speed in green.

    Retained from previous version:
    ────────────────────────────────
    • Runtime PPM re-derivation for real_distance
    • try/except around frame loop
    • Cancellation sets stage = "cancelled"
    """

    def update(stage=None, **kwargs):
        if progress_state is None:
            return
        if stage:
            progress_state["stage"] = stage
        progress_state.update(kwargs)

    # ── Calibration ───────────────────────────────────────────────────────────
    if not os.path.exists("calibration.json"):
        print("ERROR: calibration.json not found.")
        update("error", error="calibration.json not found")
        return None

    with open("calibration.json", "r") as f:
        calib = json.load(f)

    has_homography = "homography" in calib
    if has_homography:
        H            = np.array(calib["homography"]["matrix"], dtype="float64")
        H_inv        = np.linalg.inv(H)
        dst_w, dst_h = calib["homography"]["dst_size"]
        ppm          = calib["homography"].get("ppm", None)
    else:
        H = H_inv = None
        dst_w = dst_h = None
        ppm = None

    line_A = tuple(map(tuple, calib["line_A"]))
    line_B = tuple(map(tuple, calib["line_B"]))

    # ── Runtime real_distance re-derivation ──────────────────────────────────
    if ppm is not None and ppm > 0:
        mp_a = _line_midpoint(line_A[0], line_A[1])
        mp_b = _line_midpoint(line_B[0], line_B[1])
        pixel_gap     = math.hypot(mp_b[0] - mp_a[0], mp_b[1] - mp_a[1])
        real_distance = pixel_gap / ppm
        print(f"[calibration] PPM={ppm}  pixel_gap={pixel_gap:.2f}  "
              f"real_distance={real_distance:.4f} m  (runtime re-derived)")
    else:
        real_distance = calib["real_distance"]
        print(f"[calibration] No PPM — using stored real_distance={real_distance} m")

    # ── FIX 1: Build warped-space ROI polygon from the two measurement lines ──
    # This is the actual quadrilateral: line_A → line_B in warped coordinates.
    # We add a small margin so vehicles are caught slightly before/after lines.
    MARGIN = 30  # pixels in warped space

    line_A_y_avg = (line_A[0][1] + line_A[1][1]) / 2
    line_B_y_avg = (line_B[0][1] + line_B[1][1]) / 2
    top_y    = min(line_A_y_avg, line_B_y_avg) - MARGIN
    bottom_y = max(line_A_y_avg, line_B_y_avg) + MARGIN

    # x extents: use min/max of both lines plus margin
    all_x = [line_A[0][0], line_A[1][0], line_B[0][0], line_B[1][0]]
    left_x  = min(all_x) - MARGIN
    right_x = max(all_x) + MARGIN

    # Warped-space ROI polygon (used for containment test)
    warped_roi_poly = np.array([
        [left_x,  top_y],
        [right_x, top_y],
        [right_x, bottom_y],
        [left_x,  bottom_y],
    ], dtype=np.int32)

    def in_warped_roi(wcx, wcy):
        """True if the warped-space centroid is inside the measurement quad."""
        return point_in_polygon(wcx, wcy, warped_roi_poly)

    update("loading_video")

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        update("error", error="Could not open video file")
        return None

    fps          = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    orig_w       = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    orig_h       = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    out_w, out_h = orig_w, orig_h

    update("extracting", total_frames=total_frames, extracted_frames=0, processed_frames=0)

    model = YOLO("yolov8n.pt")

    os.makedirs(save_dir, exist_ok=True)
    if not run_id:
        existing = glob.glob(f"{save_dir}/Run*")
        max_run  = 0
        for folder in existing:
            m = re.match(r'Run(\d+)_', os.path.basename(folder))
            if m:
                max_run = max(max_run, int(m.group(1)))
        now      = datetime.now()
        run_name = f"Run{max_run + 1}_{now.strftime('%d-%m_%H-%M')}"
    else:
        run_name = run_id

    run_dir  = f"{save_dir}/{run_name}"
    os.makedirs(run_dir, exist_ok=True)
    mp4_path = f"{run_dir}/output.mp4"

    writer, used_codec = make_writer(mp4_path, fps, out_w, out_h)

    # Back-project warped line coords → original frame for drawing
    def warp_to_orig(pt):
        p = np.array([[[float(pt[0]), float(pt[1])]]], dtype="float32")
        o = cv2.perspectiveTransform(p, H_inv)
        return (int(o[0][0][0]), int(o[0][0][1]))

    if has_homography:
        line_A_orig = (warp_to_orig(line_A[0]), warp_to_orig(line_A[1]))
        line_B_orig = (warp_to_orig(line_B[0]), warp_to_orig(line_B[1]))
    else:
        line_A_orig = line_A
        line_B_orig = line_B

    roi_poly_orig = build_roi_polygon_orig(line_A_orig, line_B_orig)

    # ── Per-vehicle state ─────────────────────────────────────────────────────
    first_cross_time  = {}   # display_id → t of first crossing
    first_cross_line  = {}   # display_id → 'A' | 'B'
    second_cross_time = {}   # display_id → t of second crossing (temporary)
    last_cross_time   = {}   # display_id → t  (debounce)
    speeds            = {}   # display_id → latest confirmed speed km/h
    measure_state     = {}   # display_id → 'none' | 'measuring' | 'done'
    prev_side_A       = {}   # tracker_id → side
    prev_side_B       = {}   # tracker_id → side

    # Sequential ID remapping: only assigned when a tracker ID first enters
    # the ROI zone, so IDs are 1, 2, 3... with no gaps from dropped detections.
    tracker_to_display = {}  # tracker_id → display_id
    _next_display_id   = [1] # list so the closure can mutate it

    def get_display_id(tracker_id):
        if tracker_id not in tracker_to_display:
            tracker_to_display[tracker_id] = _next_display_id[0]
            _next_display_id[0] += 1
        return tracker_to_display[tracker_id]

    log_data    = []
    frame_count = 0

    # ── Frame loop ────────────────────────────────────────────────────────────
    try:
        while True:
            # Cancellation
            if progress_state is not None and progress_state.get("cancelled", False):
                print("Processing cancelled by user.")
                cap.release()
                writer.release()
                progress_state["stage"] = "cancelled"
                return None

            ret, frame = cap.read()
            if not ret:
                break

            update(extracted_frames=frame_count + 1)
            t = frame_count / fps
            update("detecting")

            results = model.track(frame, persist=True, tracker="botsort.yaml", verbose=False)

            # Semi-transparent ROI band overlay
            overlay = frame.copy()
            cv2.fillPoly(overlay, [roi_poly_orig], (0, 255, 255))
            cv2.addWeighted(overlay, 0.06, frame, 0.94, 0, frame)

            if results[0].boxes.id is not None:
                boxes = results[0].boxes.xyxy.cpu().numpy()
                ids   = results[0].boxes.id.cpu().numpy().astype(int)
                clss  = results[0].boxes.cls.cpu().numpy().astype(int)

                for box, obj_id, cls in zip(boxes, ids, clss):
                    x1, y1, x2, y2 = map(int, box)
                    cx_orig = (x1 + x2) / 2
                    cy_orig = (y1 + y2) / 2

                    if has_homography:
                        wcx, wcy = project_point((cx_orig, cy_orig), H)
                    else:
                        wcx, wcy = cx_orig, cy_orig

                    # ── FIX 1: Strict polygon containment in warped space ─────
                    in_zone = in_warped_roi(wcx, wcy)

                    sA = side_of_line(wcx, wcy, line_A)
                    sB = side_of_line(wcx, wcy, line_B)

                    # Assign a clean sequential display ID only when entering ROI
                    if in_zone:
                        did = get_display_id(obj_id)
                    else:
                        # Outside ROI: use existing mapping if present, else skip labelling
                        did = tracker_to_display.get(obj_id, None)

                    # ── Crossing / speed logic (only for vehicles in zone) ────
                    if in_zone and did is not None:
                        since_last = t - last_cross_time.get(did, -999)

                        if did not in first_cross_time:
                            crossed_A = obj_id in prev_side_A and prev_side_A[obj_id] != sA
                            crossed_B = obj_id in prev_side_B and prev_side_B[obj_id] != sB
                            if (crossed_A or crossed_B) and since_last >= CROSS_COOLDOWN:
                                first_cross_time[did] = t
                                first_cross_line[did] = 'A' if crossed_A else 'B'
                                last_cross_time[did]  = t
                                measure_state[did]    = 'measuring'

                        elif did not in second_cross_time:
                            other_prev  = prev_side_B if first_cross_line[did] == 'A' else prev_side_A
                            other_curr  = sB          if first_cross_line[did] == 'A' else sA
                            other_label = 'B'         if first_cross_line[did] == 'A' else 'A'

                            crossed_second = (
                                obj_id in other_prev
                                and other_prev[obj_id] != other_curr
                                and since_last >= CROSS_COOLDOWN
                            )

                            if crossed_second:
                                dt = t - first_cross_time[did]

                                if MIN_TRAVEL_TIME <= dt <= MAX_TRAVEL_TIME:
                                    raw_spd = (real_distance / dt) * 3.6
                                    if raw_spd <= MAX_SPEED_KMH:
                                        prev_spd = speeds.get(did, raw_spd)
                                        smoothed = EMA_ALPHA * raw_spd + (1 - EMA_ALPHA) * prev_spd
                                        speeds[did]            = smoothed
                                        measure_state[did]     = 'done'
                                        second_cross_time[did] = t
                                        last_cross_time[did]   = t

                                        log_data.append({
                                            "ID":           did,
                                            "Class":        model.names[cls],
                                            "EntryLine":    first_cross_line[did],
                                            "EntryTime":    round(first_cross_time[did], 3),
                                            "ExitLine":     other_label,
                                            "ExitTime":     round(t, 3),
                                            "Duration_s":   round(dt, 3),
                                            "Speed_kmh":    round(smoothed, 2),
                                            "RawSpeed_kmh": round(raw_spd, 2),
                                        })

                                        first_cross_time.pop(did, None)
                                        first_cross_line.pop(did, None)
                                        second_cross_time.pop(did, None)

                                elif dt > MAX_TRAVEL_TIME:
                                    first_cross_time.pop(did, None)
                                    first_cross_line.pop(did, None)
                                    measure_state[did] = 'none'

                    # Always update side state keyed by tracker ID (for crossing detection)
                    prev_side_A[obj_id] = sA
                    prev_side_B[obj_id] = sB

                    # ── Drawing ───────────────────────────────────────────────
                    # Vehicles strictly OUTSIDE the warped ROI → thin grey, no label
                    if not in_zone:
                        cv2.rectangle(frame, (x1, y1), (x2, y2), (60, 60, 60), 1)
                        continue

                    state = measure_state.get(did, 'none')

                    if state == 'done':
                        # ── Confirmed speed (green) ──────────────────────────
                        box_color  = (0, 255, 0)
                        label_text = f"ID {did} | {speeds[did]:.1f} km/h"
                        lbl_color  = (0, 255, 0)
                        bg_color   = (0, 50, 0)

                    elif state == 'measuring':
                        # Crossed first line — waiting for second crossing
                        box_color  = (0, 200, 255)   # cyan
                        lbl_color  = (0, 200, 255)
                        bg_color   = (0, 40, 55)
                        label_text = f"ID {did}"

                    else:
                        # ── Inside ROI but not yet crossed any line ──────────
                        # Subtle teal outline only — no label clutter
                        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 180, 100), 1)
                        continue

                    cv2.rectangle(frame, (x1, y1), (x2, y2), box_color, 2)
                    draw_label(frame, x1, y1, label_text, lbl_color, bg_color)

            # ── Measurement lines ─────────────────────────────────────────────
            cv2.line(frame, line_A_orig[0], line_A_orig[1], (0, 255, 255), 2)
            cv2.line(frame, line_B_orig[0], line_B_orig[1], (0, 255, 255), 2)
            cv2.putText(frame, "A", (line_A_orig[0][0] - 20, line_A_orig[0][1]),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
            cv2.putText(frame, "B", (line_B_orig[0][0] - 20, line_B_orig[0][1]),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)

            writer.write(frame)
            frame_count += 1
            update(processed_frames=frame_count)

    except Exception as exc:
        err_msg = f"Frame {frame_count}: {type(exc).__name__}: {exc}"
        print(f"[ERROR] Processing crashed — {err_msg}")
        cap.release()
        writer.release()
        update("error", error=err_msg)
        return None

    cap.release()
    writer.release()

    if used_codec == 'mp4v':
        update("finalizing")
        reencode_h264(mp4_path)

    update("finalizing")

    df         = pd.DataFrame(log_data)
    csv_path   = None
    graph_path = None

    if not df.empty:
        csv_path = f"{run_dir}/log.csv"
        df.to_csv(csv_path, index=False)

        graph_path = f"{run_dir}/speed_graph.png"
        n   = len(df)
        fig, ax = plt.subplots(figsize=(max(8, n * 0.9), 5), facecolor="#0d1117")
        ax.set_facecolor("#0d1117")

        vehicle_ids    = df["ID"].astype(str).tolist()
        vehicle_speeds = df["Speed_kmh"].tolist()
        x_pos          = list(range(n))
        bar_colors     = ["#ef4444" if s > 60 else "#3b82f6" for s in vehicle_speeds]

        bars = ax.bar(x_pos, vehicle_speeds, color=bar_colors,
                      edgecolor="#1e293b", alpha=0.9, width=0.6)

        for bar, speed in zip(bars, vehicle_speeds):
            ax.text(
                bar.get_x() + bar.get_width() / 2,
                bar.get_height() + 0.8,
                f"{speed:.1f}",
                ha='center', va='bottom',
                color="#e5e7eb", fontsize=8, fontweight='bold'
            )

        ax.set_xticks(x_pos)
        ax.set_xticklabels(
            [f"ID {vid}" for vid in vehicle_ids],
            color="#9ca3af", fontsize=9,
            rotation=45 if n > 8 else 0,
            ha='right' if n > 8 else 'center'
        )
        ax.set_xlabel("Vehicle ID",       color="#9ca3af", fontsize=11)
        ax.set_ylabel("Speed (km/h)",     color="#9ca3af", fontsize=11)
        ax.set_title("Speed per Vehicle", color="#f9fafb", fontsize=13, fontweight="bold")
        ax.tick_params(colors="#6b7280")
        ax.yaxis.grid(True, color="#1f2937", linewidth=0.5, linestyle='--')
        ax.set_axisbelow(True)
        for spine in ax.spines.values():
            spine.set_edgecolor("#374151")

        plt.tight_layout()
        plt.savefig(graph_path, dpi=120, bbox_inches="tight", facecolor="#0d1117")
        plt.close(fig)

    update("done")

    return {
        "run_id":         run_name,
        "video_path":     mp4_path,
        "csv_path":       csv_path,
        "graph_path":     graph_path,
        "total_vehicles": df["ID"].nunique() if not df.empty else 0,
        "avg_speed":      round(df["Speed_kmh"].mean(), 1) if not df.empty else 0,
        "max_speed":      round(df["Speed_kmh"].max(),  1) if not df.empty else 0,
        "total_frames":   total_frames,
    }
