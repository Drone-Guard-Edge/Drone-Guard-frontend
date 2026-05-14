# Drone Guard - Frontend

드론 탐지 및 위험도 분석을 위한 실시간 모니터링 웹 애플리케이션

## 시스템 아키텍처

```text
[NPU 단말기] --- (ws/ingest) ---> [FastAPI 백엔드] --- (ws/live) ---> [React 프론트엔드]
 (데이터 전송)                       (브로드캐스트)                      (실시간 렌더링)
```

1. **NPU 단말기**: 드론 탐지 이미지와 Bounding Box 좌표, 신뢰도(`score`)를 바이너리(DPX1) 형식으로 백엔드에 전송합니다.
2. **FastAPI 백엔드 (`server.py`)**: NPU에서 보낸 프레임을 파싱하여, 접속된 모든 웹 클라이언트에게 JSON 형태로 브로드캐스트합니다. (React 빌드 결과물 서빙 및 SSL 지원 포함)
3. **React 프론트엔드 (`Dashboard`)**: 웹소켓을 통해 실시간 프레임을 받아 즉시 캔버스에 렌더링하고, 자체 로직으로 위험도를 평가하여 시각화합니다.

## 프로젝트 구조

```text
├── public/                  # React 정적 템플릿 및 PWA 매니페스트
│   ├── index.html
│   ├── manifest.json
│   └── robots.txt
├── src/                     # React 소스 코드
│   ├── api/
│   │   └── wsClient.js      # WebSocket 연결 및 메시지 처리 로직
│   ├── components/          # 재사용 가능한 UI 컴포넌트
│   │   ├── DetectionList.js
│   │   ├── DetectionViewer.js
│   │   └── RiskCard.js
│   ├── pages/               # 페이지 단위 컴포넌트
│   │   └── Dashboard.js
│   ├── utils/
│   │   └── riskCalculator.js # 위험도 계산 함수
│   ├── App.js
│   ├── App.css
│   ├── index.js
│   └── index.css
├── build/                   # `npm run build` 후 생성되는 배포용 정적 파일
│   ├── index.html
│   ├── manifest.json
│   └── static/
├── server/                  # 백엔드 서버 및 WebSocket 중계 코드
│   ├── server.py            # FastAPI 서버 진입점
│   ├── cert.pem             # (선택) SSL/TLS 인증서
│   ├── key.pem              # (선택) SSL/TLS 개인 키
│   └── ...
├── .env                     # 환경 변수 (React/백엔드 설정)
├── package.json             # 프론트엔드 빌드 및 런타임 의존성
└── README.md                # 프로젝트 문서
```

> 프론트엔드 개발 시 `src/` 폴더 안의 파일을 수정하고 `npm run build`를 실행하면 `build/`에 배포용 정적 파일이 생성됩니다. `server/server.py`는 이 `build/` 폴더를 서빙합니다.

## 통신 명세 (WebSocket API)

이 시스템은 NPU에서 데이터를 보내고 웹 클라이언트에서 수신하는 단방향 실시간 브로드캐스트를 기반으로 합니다.

### 1. NPU -> 백엔드 (수신)
- **Endpoint**: `ws://<서버IP>:8765/ws/ingest`
- **프로토콜**: Binary 데이터 (DPX1 매직넘버 사용)
- **JSON Header 예시**:
  ```json
  {
    "frame_seq": 1234,
    "image": { "w": 640, "h": 640, "size": 45000 },
    "detections": [
      {
        "class_name": "drone",
        "score": 0.95,
        "bbox": [180, 180, 460, 460]
      }
    ]
  }
  ```

### 2. 백엔드 -> 프론트엔드 (브로드캐스트)
- **Endpoint**: `ws://<서버IP>:8765/ws/live`
- **프로토콜**: JSON Text
- **Payload 예시**:
  ```json
  {
    "type": "frame",
    "frame_seq": 1234,
    "ts": 1716000000.0,
    "image": "data:image/jpeg;base64,...",
    "image_size": [640, 640],
    "detections": [
      {
        "class_name": "drone",
        "score": 0.95,
        "bbox": [180, 180, 460, 460]
      }
    ]
  }
  ```
*프론트엔드의 `wsClient.js`는 위 페이로드를 받아 객체 형태로 자동 정규화(`bbox` 배열 -> `{x1, y1, x2, y2}`) 및 위험도 평가 로직을 수행합니다.*

## 개발 및 실행 가이드

이 프로젝트는 웹 프론트엔드와 백엔드가 통합된 형태로 구동됩니다.

### 1. 프론트엔드 빌드 (필수)
FastAPI 백엔드가 프론트엔드 화면을 서빙하기 때문에, 코드를 수정한 후에는 반드시 빌드를 먼저 진행해야 합니다.

```bash
# 의존성 설치
npm install

# 프로덕션 빌드 생성
npm run build
```

### 2. 백엔드 실행
Python 가상 환경에 필요한 라이브러리를 설치하고 `server.py`를 실행합니다.

```bash
# 백엔드 의존성 설치
pip install fastapi "uvicorn[standard]" websockets

# 백엔드 실행
python .\server\server.py
```

### 3. 대시보드 접속
서버 실행 후 터미널에 표시되는 주소로 접속합니다.
* 로컬 접속: `http://localhost:8765/` (인증서 설정에 따라 `https://` 일 수 있음)
* 외부 단말 접속: 동일 네트워크 상에서 `http://<서버IP>:8765/` 로 접속

> **참고**: NPU 장비는 `ws://<서버IP>:8765/ws/ingest` 로 데이터를 전송해야 합니다.

## 환경 변수 (.env)

```env
# React 개발 서버 바인딩 (로컬 개발용)
HOST=0.0.0.0

# WebSocket 포트 및 API 주소 (server.py와 일치해야 함)
REACT_APP_API_URL=http://localhost:8765
REACT_APP_WS_PORT=8765
```

## 주요 기능

### 🟢 실시간 WebSocket 통신 (단일 모드)
* 기존 Mock 및 REST API 폴링 방식이 제거되고 오직 실시간 통신으로 통합되었습니다.
* 접속 시 IP(호스트네임)를 자동 감지하여 오류 없이 서버에 연결됩니다.
* 서버 연결은 유지되고 있으나 NPU 데이터가 2초 이상 수신되지 않으면 상태 배지가 **"서버 연결됨 (NPU 신호 없음)"**으로 자동 전환됩니다.

### 🛡️ 드론 탐지 및 위험도 시각화
* **실시간 탐지 렌더링**: 원본 이미지의 비율을 유지하며 컨테이너 크기에 맞춰 동적으로 Bounding Box를 렌더링합니다.
* **위험도 자체 판단**: NPU에서 수신한 Bounding Box 면적과 신뢰도(Confidence) 데이터를 활용하여 프론트엔드(`riskCalculator.js`)에서 직접 3단계 위험도(HIGH, MEDIUM, LOW)를 평가합니다.

### 🔒 외부 단말기 연동 및 SSL 지원
* 백엔드 폴더(`server/`) 내에 `cert.pem`, `key.pem` 파일이 존재할 경우, 자동으로 WSS(SSL) 보안 서버로 열립니다. 이를 통해 외부 모바일 기기나 다른 PC에서의 원활한 접속이 가능합니다.

## 개발 팁

* **React 코드 수정 시**: 코드를 변경하고 `npm run build`를 실행한 후, 브라우저를 새로고침(F5)하면 변경 사항이 즉시 반영됩니다. 백엔드(`server.py`)는 자동으로 빌드 폴더를 감지하므로 껐다 켤 필요가 없습니다.
* **NPU 없이 UI 테스트를 원할 경우**: `src/api/wsClient.js`의 내부 로직을 수정하여 로컬 루프백 테스트를 진행할 수 있습니다.

## 라이선스
MIT

## 연락처
Drone Guard Edge Team
