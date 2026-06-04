# -*- coding: utf-8 -*-
"""
mock_npu.py  -  NPU simulator (dev/test only)

Sends realistic drone-detection frames to server.py /ws/ingest.
Drones move with smooth physics-based trajectories and persist across frames.

Usage:
    python mock_npu.py
    python mock_npu.py --fps 10 --drones 2
"""

import argparse
import asyncio
import io
import json
import math
import random
import struct
import sys
import time

# Fix Windows console UTF-8 output
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import websockets
from PIL import Image, ImageDraw

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
WS_URL     = "ws://localhost:8765/ws/ingest"
AUTH_TOKEN = "change-me"
CLIENT_ID  = "mock-npu-01"
IMG_W, IMG_H = 640, 480
MAGIC = b"DPX1"

# Drone box size range
BOX_W_RANGE = (60, 120)
BOX_H_RANGE = (50, 90)

# How long each drone lives before leaving the scene (seconds)
DRONE_LIFETIME = (8.0, 20.0)

# Score drift per frame (confidence changes gradually)
SCORE_DRIFT = 0.015

COLOR_HIGH   = (239,  68,  68)
COLOR_MEDIUM = (245, 158,  11)
COLOR_LOW    = ( 59, 130, 246)
COLOR_GRID   = ( 35,  40,  60)
COLOR_HUD    = (160, 160, 180)
COLOR_DIM    = (100, 100, 120)


# ---------------------------------------------------------------------------
# Drone entity with smooth movement
# ---------------------------------------------------------------------------

class Drone:
    """A single drone that moves across the scene with smooth velocity."""

    _id_counter = 0

    def __init__(self):
        Drone._id_counter += 1
        self.id = Drone._id_counter

        bw = random.randint(*BOX_W_RANGE)
        bh = random.randint(*BOX_H_RANGE)

        # Spawn from one of the 4 edges
        edge = random.choice(["top", "bottom", "left", "right"])
        if edge == "top":
            cx = random.randint(bw // 2, IMG_W - bw // 2)
            cy = -bh // 2
            vx = random.uniform(-1.2, 1.2)
            vy = random.uniform(0.5, 2.0)
        elif edge == "bottom":
            cx = random.randint(bw // 2, IMG_W - bw // 2)
            cy = IMG_H + bh // 2
            vx = random.uniform(-1.2, 1.2)
            vy = random.uniform(-2.0, -0.5)
        elif edge == "left":
            cx = -bw // 2
            cy = random.randint(bh // 2, IMG_H - bh // 2)
            vx = random.uniform(0.5, 2.0)
            vy = random.uniform(-1.2, 1.2)
        else:  # right
            cx = IMG_W + bw // 2
            cy = random.randint(bh // 2, IMG_H - bh // 2)
            vx = random.uniform(-2.0, -0.5)
            vy = random.uniform(-1.2, 1.2)

        self.cx, self.cy = float(cx), float(cy)
        self.vx, self.vy = vx, vy
        self.bw, self.bh = bw, bh

        # Gentle acceleration (simulates wind / drone agility)
        self.ax = random.uniform(-0.03, 0.03)
        self.ay = random.uniform(-0.03, 0.03)

        self.score = random.uniform(0.55, 0.95)
        self.born  = time.time()
        self.lifetime = random.uniform(*DRONE_LIFETIME)

    def step(self, dt: float = 1.0):
        """Advance position by one frame."""
        # Update velocity with small acceleration
        self.vx = max(-3.0, min(3.0, self.vx + self.ax))
        self.vy = max(-3.0, min(3.0, self.vy + self.ay))

        self.cx += self.vx * dt
        self.cy += self.vy * dt

        # Score drifts slowly
        self.score = max(0.50, min(0.99,
            self.score + random.uniform(-SCORE_DRIFT, SCORE_DRIFT)))

    def is_alive(self) -> bool:
        age = time.time() - self.born
        if age > self.lifetime:
            return False
        # Also expire if well outside the frame
        margin = max(self.bw, self.bh) * 2
        if (self.cx < -margin or self.cx > IMG_W + margin or
                self.cy < -margin or self.cy > IMG_H + margin):
            return False
        return True

    def bbox(self):
        hw, hh = self.bw / 2, self.bh / 2
        return (
            int(self.cx - hw), int(self.cy - hh),
            int(self.cx + hw), int(self.cy + hh),
        )

    def is_visible(self) -> bool:
        x1, y1, x2, y2 = self.bbox()
        return x2 > 0 and x1 < IMG_W and y2 > 0 and y1 < IMG_H

    def color(self):
        if self.score >= 0.85:
            return COLOR_HIGH
        if self.score >= 0.65:
            return COLOR_MEDIUM
        return COLOR_LOW


# ---------------------------------------------------------------------------
# JPEG renderer
# ---------------------------------------------------------------------------

def make_jpeg(drones: list, frame_seq: int) -> bytes:
    img  = Image.new("RGB", (IMG_W, IMG_H), color=(15, 18, 32))
    draw = ImageDraw.Draw(img)

    # Background grid
    for x in range(0, IMG_W + 1, 64):
        draw.line([(x, 0), (x, IMG_H)], fill=COLOR_GRID, width=1)
    for y in range(0, IMG_H + 1, 48):
        draw.line([(0, y), (IMG_W, y)], fill=COLOR_GRID, width=1)

    # Center crosshair
    cx, cy = IMG_W // 2, IMG_H // 2
    draw.line([(cx - 24, cy), (cx + 24, cy)], fill=(60, 180, 100), width=2)
    draw.line([(cx, cy - 24), (cx, cy + 24)], fill=(60, 180, 100), width=2)
    draw.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], outline=(60, 180, 100), width=1)

    # HUD
    ts = time.strftime("%H:%M:%S")
    visible = [d for d in drones if d.is_visible()]
    draw.text(( 8,  8), f"FRAME  #{frame_seq:06d}", fill=COLOR_HUD)
    draw.text(( 8, 24), f"TIME   {ts}",             fill=COLOR_DIM)
    draw.text(( 8, 40), f"TRACKS {len(drones)}  VISIBLE {len(visible)}", fill=COLOR_DIM)

    # Drone boxes
    for d in visible:
        x1, y1, x2, y2 = d.bbox()
        # Clip to image
        x1c, y1c = max(x1, 0), max(y1, 0)
        x2c, y2c = min(x2, IMG_W), min(y2, IMG_H)
        c = d.color()

        draw.rectangle([x1c, y1c, x2c, y2c], outline=c, width=2)

        # Corner L-marks (only if fully inside)
        if x1 >= 0 and y1 >= 0 and x2 <= IMG_W and y2 <= IMG_H:
            sz = 10
            for px, py, dx, dy in [
                (x1, y1,  1,  1), (x2, y1, -1,  1),
                (x1, y2,  1, -1), (x2, y2, -1, -1),
            ]:
                draw.line([(px, py), (px + dx * sz, py)], fill=c, width=2)
                draw.line([(px, py), (px, py + dy * sz)], fill=c, width=2)

        # Track ID + score label
        label = f"#{d.id} {d.score:.0%}"
        lx    = max(x1c, 2)
        ly    = max(y1c - 16, 2)
        tw    = len(label) * 6 + 4
        draw.rectangle([lx - 1, ly - 1, lx + tw, ly + 11], fill=(0, 0, 0))
        draw.text((lx, ly), label, fill=c)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=75)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Binary packet builder
# ---------------------------------------------------------------------------

def build_packet(frame_seq: int, jpeg: bytes, drones: list) -> bytes:
    visible = [d for d in drones if d.is_visible()]
    detections = [
        {
            "bbox":       list(d.bbox()),
            "score":      round(d.score, 3),
            "confidence": round(d.score, 3),
            "class":      "drone",
            "class_name": "drone",
        }
        for d in visible
    ]
    header = {
        "frame_seq": frame_seq,
        "image": {"w": IMG_W, "h": IMG_H, "size": len(jpeg)},
        "detections": detections,
    }
    hdr = json.dumps(header, separators=(",", ":")).encode()
    return MAGIC + bytes([1]) + struct.pack(">H", len(hdr)) + hdr + jpeg


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

async def run(fps: int, max_drones: int):
    interval = 1.0 / fps
    print(f"[mock-npu] connecting to {WS_URL}")
    print(f"[mock-npu] FPS={fps}  max_drones={max_drones}")

    async for ws in websockets.connect(WS_URL, ping_interval=20):
        try:
            await ws.send(json.dumps({
                "type":      "hello",
                "auth":      AUTH_TOKEN,
                "client_id": CLIENT_ID,
            }))
            ack = json.loads(await ws.recv())
            print(f"[mock-npu] connected - session={ack.get('session_id')}")

            drones: list[Drone] = []
            # Stagger initial spawn
            next_spawn = time.time() + random.uniform(0.5, 2.0)
            frame_seq  = 0

            while True:
                t0 = time.perf_counter()

                # Remove expired drones
                drones = [d for d in drones if d.is_alive()]

                # Spawn new drone if below max and timer expired
                now = time.time()
                if len(drones) < max_drones and now >= next_spawn:
                    drones.append(Drone())
                    # Next spawn in 1-4 seconds
                    next_spawn = now + random.uniform(1.0, 4.0)

                # Advance physics
                for d in drones:
                    d.step()

                # Render and send
                jpeg = make_jpeg(drones, frame_seq)
                pkt  = build_packet(frame_seq, jpeg, drones)
                await ws.send(pkt)

                visible = [d for d in drones if d.is_visible()]
                scores  = [f"{d.score:.2f}" for d in visible]
                print(
                    f"[mock-npu] frame={frame_seq:06d}  "
                    f"tracks={len(drones)}  visible={len(visible)}  "
                    f"scores={scores}"
                )

                frame_seq += 1
                await asyncio.sleep(max(0.0, interval - (time.perf_counter() - t0)))

        except websockets.ConnectionClosed as e:
            print(f"[mock-npu] disconnected (code={e.code}), retrying in 2s...")
            await asyncio.sleep(2)
        except KeyboardInterrupt:
            print("[mock-npu] stopped")
            break


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def parse_args():
    p = argparse.ArgumentParser(description="Drone Guard NPU simulator")
    p.add_argument("--fps",    type=int, default=10, help="Send FPS (default 10)")
    p.add_argument("--drones", type=int, default=2,  help="Max concurrent drones (default 2)")
    return p.parse_args()


if __name__ == "__main__":
    args = parse_args()
    asyncio.run(run(fps=args.fps, max_drones=args.drones))
