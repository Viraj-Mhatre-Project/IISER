import cv2
import json
import math
import os
import gdown

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

points = []
snap_mode = True
mouse_pos = [0, 0]

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

def run_calibration(video_path):
    global points, snap_mode, mouse_pos
    
    cap = cv2.VideoCapture(video_path)
    ret, frame = cap.read()
    if not ret:
        print("Error reading video for calibration.")
        return False
        
    cv2.namedWindow("Calibration", cv2.WINDOW_NORMAL)
    cv2.resizeWindow("Calibration", 1000, 700)
    cv2.setMouseCallback("Calibration", select_points)

    print("\nLine drawing mode:")
    print("  1 -> Straight lines only (snaps to horizontal or vertical)")
    print("  2 -> Free lines (place points anywhere)")
    while True:
        mode_input = input("Choose mode [1/2]: ").strip()
        if mode_input in ("1", "2"):
            snap_mode = (mode_input == "1")
            break
        print("  Please enter 1 or 2.")

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
            cv2.putText(temp, "ENTRY", (points[0][0], points[0][1]-10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,255,0), 2)

        cv2.putText(temp, f"Points marked: {len(points)}/2 (Press ENTER to confirm)", 
                    (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255,255,255), 2)
        cv2.imshow("Calibration", temp)
        key = cv2.waitKey(1) & 0xFF
        if key == 13 and len(points) == 2:
            break
        if key == 27:
            cap.release()
            cv2.destroyAllWindows()
            return False

    p1, p2 = points[0], points[1]
    
    dx = p2[0] - p1[0]
    dy = p2[1] - p1[1]
    length = math.hypot(dx, dy)
    if length == 0: length = 1
    ux, uy = dx / length, dy / length
    px_unit, py_unit = -uy, ux

    exit_offset = 80
    exit_scale = 1.0
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

    def setup_mouse(event, x, y, flags, param):
        nonlocal exit_offset, exit_scale, exit_confirmed
        if event == cv2.EVENT_MOUSEMOVE:
            cx, cy = (p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2
            raw = (x - cx) * px_unit + (y - cy) * py_unit
            exit_offset = max(-1500, min(1500, raw))
        elif event == cv2.EVENT_MOUSEWHEEL:
            exit_scale = min(exit_scale + 0.05, 5.0) if flags > 0 else max(exit_scale - 0.05, 0.1)
        elif event == cv2.EVENT_LBUTTONDOWN:
            exit_confirmed = True

    cv2.setMouseCallback("Calibration", setup_mouse)

    print("\nPHASE 2: Position the EXIT line (RED).")
    print("  Move mouse to slide it parallel.")
    print("  Scroll wheel to resize.")
    print("  Left-click to confirm, then press ENTER.\n")

    while True:
        temp = frame.copy()
        cv2.line(temp, p1, p2, (0, 255, 0), 2)
        ex1, ex2 = get_exit_line(exit_offset, exit_scale)
        color = (0, 200, 255) if not exit_confirmed else (0, 0, 255)
        cv2.line(temp, ex1, ex2, color, 2)
        
        status = "CONFIRMED - press ENTER" if exit_confirmed else "Move mouse | Scroll to resize | Click to confirm"
        cv2.putText(temp, status, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255,255,255), 2)
        
        cv2.imshow("Calibration", temp)
        key = cv2.waitKey(1) & 0xFF
        if key == 13 and exit_confirmed:
            break

    cv2.destroyAllWindows()
    cap.release()

    ex1, ex2 = get_exit_line(exit_offset, exit_scale)
    
    cv2.destroyAllWindows()
    
    try:
        real_distance = float(input("\nEnter distance between lines (meters): "))
    except ValueError:
        real_distance = 10.0
        print("Invalid input, defaulting to 10.0 meters")

    calibration_data = {
        "line_A": [list(p1), list(p2)],
        "line_B": [list(ex1), list(ex2)],
        "real_distance": real_distance,
        "video_reference": video_path
    }

    with open("calibration.json", "w") as f:
        json.dump(calibration_data, f, indent=4)
        
    print("\n✅ Calibration saved to calibration.json")
    return True

if __name__ == "__main__":
    v_path = input("Enter path to a reference video (or Google Drive link): ").strip()
    
    local_path = download_from_drive(v_path)
    run_calibration(local_path)
    
    # Cleanup downloaded video
    if local_path == "temp_calibration_video.mp4" and os.path.exists(local_path):
        os.remove(local_path)
