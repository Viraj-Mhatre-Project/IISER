import cv2
import json
import math
import os
import numpy as np
import gdown


# ─────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────

def download_from_drive(link):
    if "drive.google.com" not in link:
        return link

    print("\nDownloading video from Google Drive...")
    try:
        file_id = link.split("/d/")[1].split("/")[0]
    except IndexError:
        print("Could not extract file ID from Drive link. Attempting direct path.")
        return link

    download_url = f"https://drive.google.com/uc?id={file_id}"
    output_path = "temp_calibration_video.mp4"
    gdown.download(download_url, output_path, quiet=False)
    print("Download complete!\n")
    return output_path


def snap_point(ax, ay, bx, by):
    """Snap second point to the dominant axis of the first."""
    if abs(bx - ax) >= abs(by - ay):
        return (bx, ay)
    return (ax, by)


def order_quadrilateral(pts):
    """
    Given 4 (x, y) points in any order, return them as
    [top-left, top-right, bottom-right, bottom-left].
    """
    pts = np.array(pts, dtype="float32")
    by_y       = pts[np.argsort(pts[:, 1])]
    top_two    = by_y[:2]
    bottom_two = by_y[2:]
    tl, tr = top_two[np.argsort(top_two[:, 0])]
    bl, br = bottom_two[np.argsort(bottom_two[:, 0])]
    return np.array([tl, tr, br, bl], dtype="float32")


def compute_homography(src_pts_ordered, dst_width, dst_height):
    dst = np.array([
        [0,           0],
        [dst_width-1, 0],
        [dst_width-1, dst_height-1],
        [0,           dst_height-1],
    ], dtype="float32")
    H, _ = cv2.findHomography(src_pts_ordered, dst)
    return H


def warp_frame(frame, H, dst_w, dst_h):
    return cv2.warpPerspective(frame, H, (dst_w, dst_h))


# ─────────────────────────────────────────────
#  Phase 1 – Mark 4 road-corner points
#  With snap options, undo/redo
# ─────────────────────────────────────────────

CORNER_LABELS = ["Top-Left", "Top-Right", "Bottom-Right", "Bottom-Left"]
CORNER_COLORS = [(0, 255, 255), (0, 165, 255), (0, 0, 255), (255, 0, 0)]

# Phase 1 state
_p1_points  = []   # committed points
_p1_redo    = []   # redo stack
_p1_mouse   = [0, 0]
_p1_snap_tb = False  # snap top edge (pts 0→1 horizontal)
_p1_snap_bb = False  # snap bottom edge (pts 2→3 horizontal)


def _cb_quad(event, x, y, flags, param):
    global _p1_points, _p1_redo, _p1_mouse
    _p1_mouse = [x, y]
    if event == cv2.EVENT_LBUTTONDOWN and len(_p1_points) < 4:
        new_pt = (x, y)
        idx = len(_p1_points)

        # Snap top edge: pt 1 snaps horizontally to pt 0
        if _p1_snap_tb and idx == 1 and len(_p1_points) == 1:
            new_pt = snap_point(_p1_points[0][0], _p1_points[0][1], x, y)
        # Snap bottom edge: pt 3 snaps horizontally to pt 2
        if _p1_snap_bb and idx == 3 and len(_p1_points) == 3:
            new_pt = snap_point(_p1_points[2][0], _p1_points[2][1], x, y)

        _p1_points.append(new_pt)
        _p1_redo.clear()   # new action clears redo stack
        print(f"  Corner {len(_p1_points)} ({CORNER_LABELS[len(_p1_points)-1]}): {_p1_points[-1]}")


def phase1_mark_quad(frame):
    """Let user click 4 road-corners; returns ordered numpy array."""
    global _p1_points, _p1_redo, _p1_mouse, _p1_snap_tb, _p1_snap_bb
    _p1_points = []
    _p1_redo   = []

    # ── Pre-window prompts ────────────────────────────────────────────────────
    print("\n── STEP 1: Mark the 4 road corners ──────────────────────────")
    print("  Click the 4 corners of the road region in order:")
    print("    1 → Top-Left   2 → Top-Right")
    print("    3 → Bottom-Right  4 → Bottom-Left")

    snap_tb_input = input("  Snap top edge horizontal (pts 1→2)? [y/N]: ").strip().lower()
    _p1_snap_tb = snap_tb_input == 'y'

    snap_bb_input = input("  Snap bottom edge horizontal (pts 3→4)? [y/N]: ").strip().lower()
    _p1_snap_bb = snap_bb_input == 'y'

    print("  Press ENTER to confirm once all 4 points are placed.")
    print("  Z / Ctrl+Z = undo last point  |  Y / Ctrl+Y = redo  |  R = reset all\n")

    cv2.namedWindow("Calibration – Step 1: Road Corners", cv2.WINDOW_NORMAL)
    cv2.resizeWindow("Calibration – Step 1: Road Corners", 1000, 700)
    cv2.setMouseCallback("Calibration – Step 1: Road Corners", _cb_quad)

    while True:
        disp = frame.copy()
        n = len(_p1_points)

        # Draw completed polygon edges
        for i in range(n):
            j = (i + 1) % n
            if j < n:
                cv2.line(disp, _p1_points[i], _p1_points[j], (200, 200, 200), 1)

        # Rubber-band line from last point to cursor
        if 0 < n < 4:
            cv2.line(disp, _p1_points[-1], tuple(_p1_mouse), (200, 200, 200), 1)

        # Close the quad preview when 4 points are set
        if n == 4:
            pts_np = np.array(_p1_points, dtype=np.int32)
            cv2.polylines(disp, [pts_np], isClosed=True, color=(0, 255, 0), thickness=2)
            overlay = disp.copy()
            cv2.fillPoly(overlay, [pts_np], (0, 255, 0))
            cv2.addWeighted(overlay, 0.15, disp, 0.85, 0, disp)

        for i, p in enumerate(_p1_points):
            cv2.circle(disp, p, 7, CORNER_COLORS[i], -1)
            cv2.putText(disp, f"{i+1}:{CORNER_LABELS[i]}", (p[0]+10, p[1]-10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, CORNER_COLORS[i], 2)

        if n < 4:
            hint = f"Click point {n+1}: {CORNER_LABELS[n]}"
        else:
            hint = "4 points set – press ENTER to confirm  |  R to reset"
        cv2.putText(disp, hint, (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

        # Undo/redo hint
        cv2.putText(disp, "Z=Undo  Y=Redo  R=Reset", (10, disp.shape[0] - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (150, 150, 150), 1)

        cv2.imshow("Calibration – Step 1: Road Corners", disp)
        key = cv2.waitKey(1) & 0xFF

        if key == 13 and n == 4:           # ENTER – confirm
            break
        elif key in (ord('r'), ord('R')):  # R – reset all
            _p1_points = []
            _p1_redo   = []
            print("  Points reset.\n")
        elif key in (ord('z'), ord('Z'), 26):  # Z or Ctrl+Z – undo
            if _p1_points:
                _p1_redo.append(_p1_points.pop())
                print(f"  Undo → {len(_p1_points)} point(s) remaining")
        elif key in (ord('y'), ord('Y'), 25):  # Y or Ctrl+Y – redo
            if _p1_redo:
                _p1_points.append(_p1_redo.pop())
                print(f"  Redo → {len(_p1_points)} point(s)")
        elif key == 27:                    # ESC – abort
            cv2.destroyAllWindows()
            return None

    cv2.destroyAllWindows()

    ordered = order_quadrilateral(_p1_points)
    print(f"\n  Ordered corners: {ordered.tolist()}")
    return ordered


# ─────────────────────────────────────────────
#  Phase 2 – Mark entry line on warped frame
#  With undo/redo
# ─────────────────────────────────────────────

_p2_points = []
_p2_redo   = []
_p2_mouse  = [0, 0]
_snap_mode = True


def _cb_line(event, x, y, flags, param):
    global _p2_points, _p2_redo, _p2_mouse
    _p2_mouse = [x, y]
    if event == cv2.EVENT_LBUTTONDOWN and len(_p2_points) < 2:
        new_pt = (x, y)
        if _snap_mode and len(_p2_points) == 1:
            new_pt = snap_point(_p2_points[0][0], _p2_points[0][1], x, y)
        _p2_points.append(new_pt)
        _p2_redo.clear()
        print(f"  Line point {len(_p2_points)}: {_p2_points[-1]}")


def phase2_entry_line(warped):
    """Let user mark the entry (green) line on the top-view frame."""
    global _p2_points, _p2_redo, _snap_mode, _p2_mouse
    _p2_points = []
    _p2_redo   = []

    print("\n── STEP 2: Mark the ENTRY line ──────────────────────────────")
    while True:
        mode_input = input("Line mode – 1: straight (snap)  2: free  [1/2]: ").strip()
        if mode_input in ("1", "2"):
            _snap_mode = (mode_input == "1")
            break
        print("  Please enter 1 or 2.")

    print("\n  Click 2 points to define the ENTRY line (GREEN).")
    print("  Z / Ctrl+Z = undo  |  Y / Ctrl+Y = redo")
    print("  Press ENTER to confirm.\n")

    win = "Calibration – Step 2: Entry Line"
    cv2.namedWindow(win, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(win, 1000, 700)
    cv2.setMouseCallback(win, _cb_line)

    while True:
        disp = warped.copy()
        mx, my = _p2_mouse

        if len(_p2_points) == 1:
            ep = snap_point(_p2_points[0][0], _p2_points[0][1], mx, my) if _snap_mode else (mx, my)
            cv2.line(disp, _p2_points[0], ep, (0, 255, 0), 1)
            cv2.circle(disp, ep, 4, (0, 255, 0), -1)

        for i, p in enumerate(_p2_points):
            cv2.circle(disp, p, 6, (0, 255, 0), -1)
            cv2.putText(disp, str(i+1), (p[0]+8, p[1]-8),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)

        if len(_p2_points) == 2:
            cv2.line(disp, _p2_points[0], _p2_points[1], (0, 255, 0), 2)
            cv2.putText(disp, "ENTRY", (_p2_points[0][0], _p2_points[0][1]-12),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

        cv2.putText(disp, f"Points: {len(_p2_points)}/2  (Z=Undo  Y=Redo  ENTER=confirm)",
                    (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        cv2.imshow(win, disp)

        key = cv2.waitKey(1) & 0xFF
        if key == 13 and len(_p2_points) == 2:
            break
        elif key in (ord('z'), ord('Z'), 26):  # Z / Ctrl+Z
            if _p2_points:
                _p2_redo.append(_p2_points.pop())
                print(f"  Undo → {len(_p2_points)} point(s)")
        elif key in (ord('y'), ord('Y'), 25):  # Y / Ctrl+Y
            if _p2_redo:
                _p2_points.append(_p2_redo.pop())
                print(f"  Redo → {len(_p2_points)} point(s)")
        elif key == 27:
            cv2.destroyAllWindows()
            return None, None

    cv2.destroyAllWindows()
    return _p2_points[0], _p2_points[1]


# ─────────────────────────────────────────────
#  Phase 3 – Position exit line on warped frame
#  With coordinate scaling, canvas-bounds clamp,
#  W/S nudge, and live gap readout
# ─────────────────────────────────────────────

# Display window size for phase 3
_P3_WIN_W = 1000
_P3_WIN_H = 700


def phase3_exit_line(warped, p1, p2, ppm):
    """
    Slide/resize the exit (red) line parallel to the entry line.
    Mouse coords are scaled from window space to canvas space so the
    line can reach any position on a large canvas.
    ppm = pixels per metre (used for live gap readout).
    """
    canvas_h, canvas_w = warped.shape[:2]

    dx = p2[0] - p1[0]
    dy = p2[1] - p1[1]
    length = math.hypot(dx, dy) or 1
    ux, uy = dx / length, dy / length
    px_unit, py_unit = -uy, ux   # perpendicular unit vector

    exit_offset    = 80.0
    exit_scale     = 1.0
    exit_confirmed = False

    def get_exit_line(offset, scale):
        cx = (p1[0] + p2[0]) / 2
        cy = (p1[1] + p2[1]) / 2
        ecx = cx + px_unit * offset
        ecy = cy + py_unit * offset
        half = (length * scale) / 2
        ex1 = (int(ecx - ux * half), int(ecy - uy * half))
        ex2 = (int(ecx + ux * half), int(ecy + uy * half))
        return ex1, ex2

    def clamp_offset(offset):
        """Clamp exit line midpoint so it stays inside the canvas."""
        cx = (p1[0] + p2[0]) / 2
        cy = (p1[1] + p2[1]) / 2
        ecx = cx + px_unit * offset
        ecy = cy + py_unit * offset
        # clamp midpoint
        ecx = max(0, min(canvas_w - 1, ecx))
        ecy = max(0, min(canvas_h - 1, ecy))
        # back-project to offset
        new_offset_x = (ecx - cx) / (px_unit if px_unit != 0 else 1e-9)
        new_offset_y = (ecy - cy) / (py_unit if py_unit != 0 else 1e-9)
        # use whichever axis has more motion
        if abs(px_unit) >= abs(py_unit):
            return (ecx - cx) / (px_unit if px_unit != 0 else 1e-9)
        else:
            return (ecy - cy) / (py_unit if py_unit != 0 else 1e-9)

    def _cb_exit(event, x_win, y_win, flags, param):
        nonlocal exit_offset, exit_scale, exit_confirmed

        # Scale from window coords → canvas coords
        scale_x = canvas_w / _P3_WIN_W
        scale_y = canvas_h / _P3_WIN_H
        x = x_win * scale_x
        y = y_win * scale_y

        if event == cv2.EVENT_MOUSEMOVE:
            cx = (p1[0] + p2[0]) / 2
            cy = (p1[1] + p2[1]) / 2
            raw = (x - cx) * px_unit + (y - cy) * py_unit
            exit_offset = clamp_offset(raw)
        elif event == cv2.EVENT_MOUSEWHEEL:
            exit_scale = (min(exit_scale + 0.05, 5.0)
                          if flags > 0 else max(exit_scale - 0.05, 0.1))
        elif event == cv2.EVENT_LBUTTONDOWN:
            exit_confirmed = True

    win = "Calibration – Step 3: Exit Line"
    cv2.namedWindow(win, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(win, _P3_WIN_W, _P3_WIN_H)
    cv2.setMouseCallback(win, _cb_exit)

    print("\n── STEP 3: Position the EXIT line ───────────────────────────")
    print("  Move mouse  → slide line parallel to entry line")
    print("  Scroll wheel → resize line")
    print("  W / S keys  → nudge line up / down (fine adjustment)")
    print("  Left-click  → confirm position, then press ENTER\n")

    nudge_step = max(1.0, length * 0.005)  # ~0.5% of line length per nudge

    while True:
        # Render at canvas resolution, then resize for display
        disp_canvas = warped.copy()
        cv2.line(disp_canvas, p1, p2, (0, 255, 0), 2)
        cv2.putText(disp_canvas, "ENTRY", (p1[0], p1[1]-12),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 255, 0), 2)

        ex1, ex2 = get_exit_line(exit_offset, exit_scale)
        color = (0, 0, 255) if exit_confirmed else (0, 200, 255)
        cv2.line(disp_canvas, ex1, ex2, color, 2)
        cv2.putText(disp_canvas, "EXIT", (ex1[0], ex1[1]-12),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, color, 2)

        # Live gap readout
        gap_px = abs(exit_offset)
        gap_m  = gap_px / ppm if ppm > 0 else 0.0
        gap_text = f"Gap: {gap_px:.0f} px = {gap_m:.2f} m"
        cv2.putText(disp_canvas, gap_text,
                    (10, canvas_h - 40),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 220, 50), 2)

        status = ("CONFIRMED – press ENTER"
                  if exit_confirmed
                  else "Move mouse | Scroll=resize | W/S=nudge | Click=confirm")
        cv2.putText(disp_canvas, status, (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2)

        # Downscale for display
        disp = cv2.resize(disp_canvas, (_P3_WIN_W, _P3_WIN_H))
        cv2.imshow(win, disp)

        key = cv2.waitKey(1) & 0xFF
        if key == 13 and exit_confirmed:        # ENTER
            break
        elif key in (ord('w'), ord('W')):        # nudge toward entry
            exit_offset = clamp_offset(exit_offset - nudge_step)
        elif key in (ord('s'), ord('S')):        # nudge away from entry
            exit_offset = clamp_offset(exit_offset + nudge_step)
        elif key == 27:                          # ESC
            cv2.destroyAllWindows()
            return None, None

    cv2.destroyAllWindows()
    return get_exit_line(exit_offset, exit_scale)


# ─────────────────────────────────────────────
#  Main calibration runner
# ─────────────────────────────────────────────

def run_calibration(video_path):
    cap = cv2.VideoCapture(video_path)
    ret, frame = cap.read()
    cap.release()
    if not ret:
        print("Error reading video for calibration.")
        return False

    # ── Phase 1: quad selection ──────────────────
    ordered_quad = phase1_mark_quad(frame)
    if ordered_quad is None:
        return False

    # ── Ask real-world quad dimensions (before computing canvas) ─────────────
    print("\n── Real-world quad dimensions ───────────────────────────────")
    try:
        real_width_m  = float(input("  Enter real-world WIDTH  of the marked region (metres): "))
        real_height_m = float(input("  Enter real-world HEIGHT of the marked region (metres): "))
    except ValueError:
        real_width_m, real_height_m = 10.0, 10.0
        print("  Invalid input, defaulting to 10 m × 10 m")

    # ── PPM-anchored warped canvas: 1 px = 1 cm ──────────────────────────────
    PPM = 100.0  # pixels per metre  (100 px = 1 m  →  1 px = 1 cm)
    dst_w = max(10, int(round(real_width_m  * PPM)))
    dst_h = max(10, int(round(real_height_m * PPM)))

    print(f"\n  PPM = {PPM:.1f}  →  Canvas size: {dst_w} × {dst_h} px  "
          f"(= {real_width_m} m × {real_height_m} m)")

    H = compute_homography(ordered_quad, dst_w, dst_h)
    warped = warp_frame(frame, H, dst_w, dst_h)

    # ── Phase 2: entry line on warped frame ──────
    p1, p2 = phase2_entry_line(warped)
    if p1 is None:
        return False

    # ── Phase 3: exit line on warped frame ───────
    ex1, ex2 = phase3_exit_line(warped, p1, p2, ppm=PPM)
    if ex1 is None:
        return False

    # ── Auto-compute real_distance from pixel gap ─────────────────────────────
    # Perpendicular distance between the two line midpoints in warped space
    def line_midpoint(a, b):
        return ((a[0] + b[0]) / 2.0, (a[1] + b[1]) / 2.0)

    mp1 = line_midpoint(p1, p2)
    mp2 = line_midpoint(ex1, ex2)
    pixel_gap    = math.hypot(mp2[0] - mp1[0], mp2[1] - mp1[1])
    real_distance = pixel_gap / PPM

    print(f"\n  Pixel gap between lines: {pixel_gap:.1f} px")
    print(f"  Auto-computed real distance: {real_distance:.3f} m  "
          f"(= {pixel_gap:.1f} px ÷ {PPM} ppm)")

    # ── Save calibration ──────────────────────────
    calibration_data = {
        "homography": {
            "src_quad": ordered_quad.tolist(),
            "dst_size": [dst_w, dst_h],
            "matrix":   H.tolist(),
            "ppm":      PPM,
            "real_width_m":  real_width_m,
            "real_height_m": real_height_m,
        },
        "line_A":       [list(p1),  list(p2)],
        "line_B":       [list(ex1), list(ex2)],
        "real_distance": round(real_distance, 6),
        "video_reference": video_path
    }

    with open("calibration.json", "w") as f:
        json.dump(calibration_data, f, indent=4)

    print("\n✅ Calibration saved to calibration.json")
    print(f"   Canvas: {dst_w}×{dst_h} px  |  PPM: {PPM}  |  "
          f"Line gap: {real_distance:.3f} m")
    return True


# ─────────────────────────────────────────────
#  Entry point
# ─────────────────────────────────────────────

if __name__ == "__main__":
    v_path     = input("Enter path to a reference video (or Google Drive link): ").strip()
    local_path = download_from_drive(v_path)
    run_calibration(local_path)

    if local_path == "temp_calibration_video.mp4" and os.path.exists(local_path):
        os.remove(local_path)
