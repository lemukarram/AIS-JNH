#!/usr/bin/env python3
"""Bake real detections for the SENTRA demo (runs on YOUR laptop, never on the server).

Reads  source_videos/camN.mp4
Writes assets/tracks/camN.json   frame-indexed boxes / ids / classes / confidence, dwell, line-crossings
       assets/tracks/events.json derived alerts (queue, dwell, crossings)

CPU-only is fine (YOLOv8n). Resumable: finished cameras are skipped unless --force.
Box coordinates are normalised 0..1 so they scale to any video size.

    pip install -r tools/requirements.txt
    python tools/bake_tracks.py --videos source_videos --out assets/tracks
"""
import argparse
import json
import sys
from pathlib import Path

try:
    import cv2
    from ultralytics import YOLO
except ImportError:
    sys.exit("Missing deps. Run: pip install -r tools/requirements.txt")

# COCO class ids we care about
CLASSES = {0: "person", 24: "backpack", 26: "handbag", 28: "suitcase", 41: "cup", 56: "chair", 63: "laptop", 2: "car", 7: "truck"}


def load_zones(path: Path, cam: str):
    """tools/zones.json: {"cam1": {"zones":[{"name":"Queue","kind":"queue","x":0.1,"y":0.4,"w":0.3,"h":0.5}], "line":{"a":[x,y],"b":[x,y]}}}"""
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8")).get(cam, {})
    return {}


def side(line, x, y):
    (x1, y1), (x2, y2) = line["a"], line["b"]
    v = (x2 - x1) * (y - y1) - (y2 - y1) * (x - x1)
    return (v > 0) - (v < 0)


def bake(video: Path, out: Path, model, zones_cfg: dict, stride: int, conf: float):
    cap = cv2.VideoCapture(str(video))
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    w, h = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    cap.release()

    frames, dwell, first_seen, last_side, crossings, events = [], {}, {}, {}, [], []
    zones, line = zones_cfg.get("zones", []), zones_cfg.get("line")
    queue_zone = next((z for z in zones if z.get("kind") == "queue"), None)

    results = model.track(source=str(video), stream=True, persist=True, tracker="bytetrack.yaml",
                          classes=list(CLASSES), conf=conf, vid_stride=stride, verbose=False)
    try:
        from tqdm import tqdm
        results = tqdm(results, total=(total // stride) or None, desc=video.name, unit="f")
    except ImportError:
        pass

    for i, r in enumerate(results):
        t = i * stride / fps
        boxes = []
        if r.boxes is not None and r.boxes.id is not None:
            for xyxy, tid, cls, c in zip(r.boxes.xyxyn.tolist(), r.boxes.id.int().tolist(), r.boxes.cls.int().tolist(), r.boxes.conf.tolist()):
                x1, y1, x2, y2 = xyxy
                cx, cy = (x1 + x2) / 2, y2  # foot point
                first_seen.setdefault(tid, t)
                dwell[tid] = round(t - first_seen[tid], 1)
                boxes.append({"id": tid, "c": CLASSES[cls], "p": round(c, 2), "b": [round(v, 4) for v in (x1, y1, x2 - x1, y2 - y1)], "d": dwell[tid]})
                if line and CLASSES[cls] == "person":
                    s = side(line, cx, cy)
                    prev = last_side.get(tid)
                    if prev is not None and s != prev and s != 0:
                        crossings.append({"t": round(t, 2), "id": tid, "dir": "in" if s < 0 else "out"})
                    last_side[tid] = s
        if queue_zone:
            n = sum(1 for b in boxes if b["c"] == "person" and queue_zone["x"] <= b["b"][0] + b["b"][2] / 2 <= queue_zone["x"] + queue_zone["w"]
                    and queue_zone["y"] <= b["b"][1] + b["b"][3] <= queue_zone["y"] + queue_zone["h"])
            if n >= 5 and (not events or events[-1]["t"] < t - 20):
                events.append({"t": round(t, 2), "type": "queue", "sev": "warn", "detail": {"len": n}})
        frames.append({"t": round(t, 3), "o": boxes})

    return {"video": video.name, "fps": fps, "stride": stride, "width": w, "height": h, "zones": zones, "line": line,
            "frames": frames, "crossings": crossings, "events": events}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--videos", default="source_videos")
    ap.add_argument("--out", default="assets/tracks")
    ap.add_argument("--zones", default="tools/zones.json")
    ap.add_argument("--model", default="yolov8n.pt")
    ap.add_argument("--stride", type=int, default=2, help="process every Nth frame (2 = half the work)")
    ap.add_argument("--conf", type=float, default=0.35)
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()

    vids = sorted(Path(a.videos).glob("cam*.mp4"))
    if not vids:
        sys.exit(f"No cam*.mp4 in {a.videos}. The demo still works without them (simulation pipeline).")
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    model = YOLO(a.model)
    all_events = []
    for v in vids:
        dst = out / f"{v.stem}.json"
        if dst.exists() and not a.force:
            print(f"skip {v.name} (already baked; --force to redo)")
            data = json.loads(dst.read_text(encoding="utf-8"))
        else:
            data = bake(v, out, model, load_zones(Path(a.zones), v.stem), a.stride, a.conf)
            dst.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
        all_events += [{**e, "cam": v.stem} for e in data.get("events", [])]
    (out / "events.json").write_text(json.dumps(sorted(all_events, key=lambda e: e["t"]), indent=1), encoding="utf-8")
    print(f"done: {len(vids)} cameras, {len(all_events)} events -> {out}")


if __name__ == "__main__":
    main()
