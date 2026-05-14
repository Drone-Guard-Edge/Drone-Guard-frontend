/**
 * wsClient.js
 * WebSocket /ws/live 구독 클라이언트
 *
 * server.py 브로드캐스트 메시지 형식:
 * {
 *   "type"       : "frame",
 *   "frame_seq"  : 123,
 *   "ts"         : 1716000000.0,
 *   "image"      : "data:image/jpeg;base64,...",   ← image_data 로 매핑
 *   "image_size" : [640, 640],                     ← width/height 로 매핑
 *   "detections" : [{"bbox":[x1,y1,x2,y2], "score":0.97, "class":"drone"}],
 *   "risks"      : [{"detection_idx":0, "level":"critical", ...}]
 * }
 *
 * ★ WS URL 자동 감지 규칙 (우선순위):
 *   1. REACT_APP_WS_URL 환경변수 (명시 지정)
 *   2. window.location.hostname + REACT_APP_WS_PORT (기본 8765)
 *      → 다른 단말기에서 http://서버IP:3000 으로 접속해도 올바른 서버로 연결됨
 */

/** WS 서버 URL을 런타임에 결정한다. */
const getWsBaseUrl = () => {
  // 1. 명시적 환경변수 우선
  if (process.env.REACT_APP_WS_URL) {
    return process.env.REACT_APP_WS_URL;
  }

  // 2. 브라우저 접속 호스트 기반 자동 감지
  //    → 다른 PC/모바일에서 IP로 접속해도 같은 서버로 연결
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname;           // 접속한 서버 IP/도메인
    const port = process.env.REACT_APP_WS_PORT || "8765";
    return `${proto}//${host}:${port}`;
  }

  return "ws://localhost:8765";
};

export class DroneGuardWSClient {
  constructor() {
    this._ws = null;
    this._onFrame = null;
    this._onStatusChange = null;
    this._onError = null;
    this._reconnectTimer = null;
    this._shouldReconnect = false;
    this._reconnectDelay = 2000;
    this._maxReconnectDelay = 30000;
    this._status = "disconnected"; // "disconnected" | "connecting" | "connected" | "error"
  }

  get status() {
    return this._status;
  }

  /**
   * /ws/live 엔드포인트에 연결
   * @param {object} callbacks
   * @param {function} callbacks.onFrame        - 새 프레임 수신 시 호출 (정규화된 rawData)
   * @param {function} callbacks.onStatusChange - 상태 변화 시 호출
   * @param {function} callbacks.onError        - 에러 발생 시 호출
   */
  connect({ onFrame, onStatusChange, onError } = {}) {
    this._onFrame = onFrame || null;
    this._onStatusChange = onStatusChange || null;
    this._onError = onError || null;
    this._shouldReconnect = true;
    this._reconnectDelay = 2000;
    this._openConnection();
  }

  disconnect() {
    this._shouldReconnect = false;
    this._clearReconnectTimer();
    if (this._ws) {
      this._ws.close(1000, "Client disconnected");
      this._ws = null;
    }
    this._setStatus("disconnected");
  }

  // ─── Private ─────────────────────────────────────────────

  _openConnection() {
    if (this._ws && this._ws.readyState <= WebSocket.OPEN) return;

    const baseUrl = getWsBaseUrl();
    const url = `${baseUrl}/ws/live`;
    console.log(`🔗 WebSocket 연결 시도: ${url}`);
    this._setStatus("connecting");

    try {
      this._ws = new WebSocket(url);
    } catch (err) {
      console.error("WebSocket 생성 실패:", err);
      this._setStatus("error");
      if (this._onError) this._onError(err);
      this._scheduleReconnect();
      return;
    }

    this._ws.onopen = () => {
      console.log("✅ WebSocket /ws/live 연결 성공");
      this._reconnectDelay = 2000;
      this._setStatus("connected");
    };

    this._ws.onmessage = (event) => {
      this._handleMessage(event);
    };

    this._ws.onerror = (event) => {
      console.error("WebSocket 오류:", event);
      this._setStatus("error");
      if (this._onError) this._onError(event);
    };

    this._ws.onclose = (event) => {
      console.log(`🔌 WebSocket 종료: code=${event.code}, reason=${event.reason}`);
      this._ws = null;
      if (this._shouldReconnect && event.code !== 1000) {
        this._setStatus("disconnected");
        this._scheduleReconnect();
      } else {
        this._setStatus("disconnected");
      }
    };
  }

  _handleMessage(event) {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch (e) {
      console.warn("WebSocket 메시지 파싱 실패:", e);
      return;
    }

    if (data.type === "frame") {
      const normalized = this._normalizeFrame(data);
      if (this._onFrame) this._onFrame(normalized);
    } else if (data.type === "hello") {
      console.log("📡 /ws/live 서버 hello 수신:", data.server_version);
    } else {
      console.debug("알 수 없는 WS 메시지 타입:", data.type);
    }
  }

  /**
   * server.py 브로드캐스트 메시지를 프론트엔드 공통 포맷으로 변환
   *
   * server.py → 프론트 매핑:
   *   frame.image        → image_data
   *   frame.image_size   → [width, height]
   *   det.score          → confidence
   *   det.bbox (배열)    → bbox {x1,y1,x2,y2} 객체
   */
  _normalizeFrame(frame) {
    const detections = (frame.detections || []).map((det) => {
      // bbox: [x1, y1, x2, y2] 배열 → 객체 변환
      let bbox = det.bbox;
      if (Array.isArray(bbox)) {
        bbox = { x1: bbox[0], y1: bbox[1], x2: bbox[2], y2: bbox[3] };
      } else if (!bbox) {
        bbox = { x1: 0, y1: 0, x2: 0, y2: 0 };
      }

      return {
        class: det.class_name || det.class || det.label || "unknown",
        // server.py 는 'score' 필드를 사용
        confidence: det.confidence ?? det.score ?? 0,
        bbox,
      };
    });

    // image_size: [w, h] → width / height
    const [width, height] = frame.image_size || [640, 640];

    // frame_seq → image_id
    const seqStr = frame.frame_seq != null
      ? String(frame.frame_seq).padStart(6, "0")
      : Date.now();
    const imageId = `frame_${seqStr}`;

    // Unix timestamp → ISO8601
    const createdAt = frame.ts
      ? new Date(frame.ts * 1000).toISOString()
      : new Date().toISOString();

    return {
      image_id: imageId,
      filename: `${imageId}.jpg`,
      width,
      height,
      format: "jpg",
      // server.py 는 'image' 키를 사용 (이미 data:image/jpeg;base64,... 포함)
      image_data: frame.image || null,
      created_at: createdAt,
      source: frame.source || frame.client_id || "npu",
      detections,
      // 부가 정보 (server.py 원본)
      frame_seq: frame.frame_seq,
      risks: frame.risks || [],
    };
  }

  _setStatus(status) {
    if (this._status !== status) {
      this._status = status;
      if (this._onStatusChange) this._onStatusChange(status);
    }
  }

  _scheduleReconnect() {
    this._clearReconnectTimer();
    if (!this._shouldReconnect) return;

    console.log(`⏳ ${this._reconnectDelay / 1000}초 후 재연결 시도...`);
    this._reconnectTimer = setTimeout(() => {
      if (this._shouldReconnect) this._openConnection();
    }, this._reconnectDelay);

    // Exponential backoff (최대 30초)
    this._reconnectDelay = Math.min(this._reconnectDelay * 1.5, this._maxReconnectDelay);
  }

  _clearReconnectTimer() {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }
}

export const wsClient = new DroneGuardWSClient();
