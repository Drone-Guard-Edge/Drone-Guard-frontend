# server.py - 로컬 서버 (NPU 수신 + 웹 브로드캐스트)
#
# 실행:
#   pip install fastapi 'uvicorn[standard]' websockets
#   uvicorn server:app --host 0.0.0.0 --port 8765 \
#       --ssl-keyfile key.pem --ssl-certfile cert.pem
#
# 그러면 브라우저에서 https://<서버IP>:8765/ 접속하면 끝.

import asyncio
import base64
import json
import struct
import time
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, status
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# ═══════════════════════════════════════════════════
# 설정 (필요시 여기 직접 수정)
# ═══════════════════════════════════════════════════
AUTH_TOKEN            = "change-me"     # NPU client.py와 동일해야 함
HELLO_TIMEOUT_SEC     = 5.0
SUBSCRIBER_QUEUE_SIZE = 4               # 웹 클라이언트당 버퍼 (작게 = 최신성 우선)

# ═══════════════════════════════════════════════════
# 바이너리 프레임 파서
# ═══════════════════════════════════════════════════
MAGIC = b"DPX1"
HDR_PREFIX_LEN = 7


class ProtocolError(Exception):
    pass


def parse_frame_packet(data: bytes):
    if len(data) < HDR_PREFIX_LEN or data[:4] != MAGIC:
        raise ProtocolError("bad magic")
    if data[4] != 1:
        raise ProtocolError(f"unsupported version {data[4]}")
    (hlen,) = struct.unpack(">H", data[5:7])
    if HDR_PREFIX_LEN + hlen > len(data):
        raise ProtocolError("header range")
    header = json.loads(data[HDR_PREFIX_LEN:HDR_PREFIX_LEN + hlen])
    jpeg = data[HDR_PREFIX_LEN + hlen:]
    expected = (header.get("image") or {}).get("size", 0)
    if len(jpeg) != expected:
        raise ProtocolError(f"jpeg size {len(jpeg)} != {expected}")
    return header, jpeg


# ═══════════════════════════════════════════════════
# 브로드캐스트 허브
# ═══════════════════════════════════════════════════
class Hub:
    def __init__(self):
        self.subscribers: set[asyncio.Queue] = set()
        self.stats = {
            "frames_received": 0,
            "parse_errors": 0,
            "subscribers": 0,
            "last_frame_seq": 0,
        }

    async def subscribe(self):
        q = asyncio.Queue(maxsize=SUBSCRIBER_QUEUE_SIZE)
        self.subscribers.add(q)
        self.stats["subscribers"] = len(self.subscribers)
        return q

    async def unsubscribe(self, q):
        self.subscribers.discard(q)
        self.stats["subscribers"] = len(self.subscribers)

    async def publish(self, msg: dict):
        for q in list(self.subscribers):
            try:
                q.put_nowait(msg)
            except asyncio.QueueFull:
                # latest-wins: 가장 오래된 거 버리고 새 거 넣음
                try: q.get_nowait()
                except asyncio.QueueEmpty: pass
                try: q.put_nowait(msg)
                except asyncio.QueueFull: pass


# ═══════════════════════════════════════════════════
# FastAPI 앱
# ═══════════════════════════════════════════════════
@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.hub = Hub()
    print("[server] up")
    yield
    print("[server] down")


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── React Frontend 서빙 ─────────────────────────
react_build_dir = Path(__file__).parent.parent / "build"

@app.get("/health")
async def health():
    return {"ok": True, **app.state.hub.stats}


# ─── NPU → Server (바이너리) ────────────────────────
@app.websocket("/ws/ingest")
async def ws_ingest(ws: WebSocket):
    await ws.accept()
    hub: Hub = ws.app.state.hub

    # hello 인증
    try:
        hello = json.loads(await asyncio.wait_for(ws.receive_text(), HELLO_TIMEOUT_SEC))
        if hello.get("type") != "hello" or hello.get("auth") != AUTH_TOKEN:
            await ws.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    except Exception:
        await ws.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    client_id = hello.get("client_id", "?")
    session_id = f"sess_{datetime.now().strftime('%H%M%S')}_{id(ws) & 0xffff:04x}"
    await ws.send_text(json.dumps({
        "type": "hello_ack",
        "session_id": session_id,
        "server_time_ns": int(time.time() * 1e9),
        "server_version": "1.0.0",
    }))
    print(f"[ingest] connected: {client_id} ({session_id})")

    # 프레임 수신 루프
    try:
        while True:
            data = await ws.receive_bytes()
            try:
                header, jpeg = parse_frame_packet(data)
            except ProtocolError as e:
                hub.stats["parse_errors"] += 1
                print(f"[ingest] parse error: {e}")
                continue

            hub.stats["frames_received"] += 1
            hub.stats["last_frame_seq"] = header.get("frame_seq", 0)

            await hub.publish({
                "type": "frame",
                "frame_seq": header.get("frame_seq"),
                "ts": time.time(),
                "image": "data:image/jpeg;base64," + base64.b64encode(jpeg).decode(),
                "image_size": [header["image"]["w"], header["image"]["h"]],
                "detections": header.get("detections", []),
            })
    except WebSocketDisconnect:
        print(f"[ingest] disconnected: {client_id}")


# ─── Server → Web (브로드캐스트) ─────────────────────
@app.websocket("/ws/live")
async def ws_live(ws: WebSocket):
    await ws.accept()
    hub: Hub = ws.app.state.hub
    q = await hub.subscribe()
    addr = ws.client.host if ws.client else "?"
    print(f"[live] subscriber: {addr} (total={len(hub.subscribers)})")

    try:
        await ws.send_text(json.dumps({"type": "hello", "server_version": "1.0.0"}))
        while True:
            msg = await q.get()
            await ws.send_text(json.dumps(msg))
    except WebSocketDisconnect:
        pass
    finally:
        await hub.unsubscribe(q)
        print(f"[live] gone: {addr}")

# ─── React Frontend 정적 파일 서빙 (항상 맨 아래에 위치) ──
if react_build_dir.exists():
    app.mount("/", StaticFiles(directory=str(react_build_dir), html=True), name="react")
else:
    @app.get("/{full_path:path}", response_class=HTMLResponse)
    async def not_found_build(full_path: str):
        return HTMLResponse(
            "<h1>React Build Not Found</h1><p>프론트엔드 폴더에서 <code>npm run build</code>를 실행하여 빌드해주세요.</p>",
            status_code=404,
        )

if __name__ == "__main__":
    import uvicorn
    import os
    from pathlib import Path

    # .env 파일이 있다면 포트 설정을 가져오기 위해 로드
    port = int(os.environ.get("REACT_APP_WS_PORT", 8765))
    
    # SSL 인증서 파일 경로 확인 (server 폴더 기준)
    server_dir = Path(__file__).parent
    key_path = server_dir / "key.pem"
    cert_path = server_dir / "cert.pem"

    if key_path.exists() and cert_path.exists():
        print(f"Starting WSS server (SSL enabled) on 0.0.0.0:{port}...")
        uvicorn.run(
            "server:app", 
            host="0.0.0.0", 
            port=port, 
            reload=True,
            ssl_keyfile=str(key_path),
            ssl_certfile=str(cert_path)
        )
    else:
        print(f"Starting WS server (NO SSL) on 0.0.0.0:{port}...")
        uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)