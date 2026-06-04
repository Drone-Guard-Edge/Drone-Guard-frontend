# Drone Guard — Frontend

**실시간 드론 탐지 및 위험도 분석 모니터링 웹 애플리케이션**

NPU 단말기에서 전송된 EO/IR 융합 탐지 결과를 WebSocket으로 수신하여 브라우저에서 실시간으로 렌더링하고, 자체 위험도 평가 로직을 통해 3단계 경보를 시각화합니다.

**배포 URL**: https://drone-guard-frontend.vercel.app/

---

## 목차

1. [시스템 아키텍처](#시스템-아키텍처)
2. [서비스 구조](#서비스-구조)
3. [웹 화면](#웹-화면)
4. [프로젝트 구조](#프로젝트-구조)
5. [통신 명세](#통신-명세)
6. [설치 및 실행](#설치-및-실행)
7. [주요 기능](#주요-기능)

---

## 시스템 아키텍처

```text
[NPU 단말기] ──(ws/ingest, DPX1 Binary)──► [FastAPI 백엔드] ──(ws/live, JSON)──► [React 프론트엔드]
  드론 탐지 추론                               파싱 · 브로드캐스트                    실시간 렌더링 · 위험도 평가
```

| 구성 요소 | 역할 |
|-----------|------|
| **NPU 단말기** | YOLO26nano로 드론 탐지 후 DPX1 바이너리 패킷을 백엔드로 전송 |
| **FastAPI 백엔드** (`server.py`) | DPX1 파싱 → JSON 변환 → 접속된 모든 웹 클라이언트에 브로드캐스트 |
| **React 프론트엔드** (`Dashboard`) | WebSocket 수신 → 캔버스 렌더링 → 위험도 자체 평가 · 시각화 |

---

## 서비스 구조

![서비스 구조](docs/images/service_architecture.png)

---

## 웹 화면

![메인 대시보드](docs/images/dashboard_main.png)

---

## 프로젝트 구조

```text
Drone-Guard-frontend/
├── public/                  # React 정적 템플릿 및 PWA 매니페스트
│   ├── index.html
│   ├── manifest.json
│   └── robots.txt
├── src/                     # React 소스 코드
│   ├── api/
│   │   └── wsClient.js      # WebSocket 연결 및 메시지 처리
│   ├── components/
│   │   ├── AlertPanel.jsx
│   │   ├── DetectionList.js
│   │   ├── DetectionViewer.js
│   │   └── RiskCard.js
│   ├── pages/
│   │   └── Dashboard.js
│   ├── utils/
│   │   ├── alertManager.js   # 위험도별 알림 및 중복 방지
│   │   ├── dangerDetector.js # 위험 상황 자동 판단
│   │   ├── detectionTracker.js
│   │   └── riskCalculator.js
│   ├── App.js
│   └── index.js
├── build/                   # `npm run build` 후 생성되는 배포용 정적 파일
├── server/                  # FastAPI 백엔드
│   ├── server.py            # 서버 진입점
│   ├── logger.py            # 서버 로그 기록 및 로테이션
│   ├── mock_npu.py          # 개발/테스트용 NPU 시뮬레이터
│   ├── requirements.txt
│   ├── cert.pem             # (선택) SSL/TLS 인증서
│   └── key.pem              # (선택) SSL/TLS 개인 키
├── start-dev.bat            # Windows 개발 환경 실행 스크립트
├── .env                     # 로컬 개발 설정
└── package.json
```

> 현재 서비스 프론트엔드는 Vercel에서 서빙합니다. `build/` 폴더와 `server.py`의 정적 파일 서빙은 로컬 빌드 확인 또는 백엔드 단독 배포 시 사용할 수 있는 방식입니다.

---

## 통신 명세

### 1. NPU → 백엔드

- **Endpoint**: `ws://<서버IP>:8765/ws/ingest`
- **프로토콜**: Binary (DPX1 매직넘버)

```json
{
  "frame_seq": 1234,
  "image": { "w": 640, "h": 640, "size": 45000 },
  "detections": [
    { "class_name": "drone", "score": 0.95, "bbox": [180, 180, 460, 460] }
  ]
}
```

### 2. 백엔드 → 프론트엔드

- **Endpoint**: `ws://<서버IP>:8765/ws/live`
- **프로토콜**: JSON Text

```json
{
  "type": "frame",
  "frame_seq": 1234,
  "ts": 1716000000.0,
  "image": "data:image/jpeg;base64,...",
  "image_size": [640, 640],
  "detections": [
    { "class_name": "drone", "score": 0.95, "bbox": [180, 180, 460, 460] }
  ]
}
```

> `wsClient.js`는 수신 즉시 `bbox` 배열을 `{x1, y1, x2, y2}` 객체로 정규화하고 위험도 평가 로직을 실행합니다.

---

## 설치 및 실행

### 1. 프론트엔드 접속

현재 프론트엔드는 Vercel에서 호스팅합니다.

```text
https://drone-guard-frontend.vercel.app/
```

Vercel 프론트엔드는 백엔드 WebSocket 주소를 `REACT_APP_WS_URL` 환경 변수로 받아 `/ws/live`에 연결합니다.

### 2. 백엔드 실행

```bash
# 의존성 설치
pip install -r server/requirements.txt

# 서버 실행
python .\server\server.py
```

### 3. ngrok 터널 실행

Vercel에 배포된 HTTPS 프론트엔드가 로컬 PC의 백엔드에 접근하려면 외부에서 접근 가능한 WSS 주소가 필요합니다. 개발/시연 환경에서는 ngrok으로 로컬 백엔드를 공개합니다.

```bash
ngrok http 8765
```

예시:

```text
Forwarding https://<ngrok-domain> -> http://localhost:8765
```

Vercel 환경 변수에는 다음 형식으로 설정합니다.

```text
REACT_APP_WS_URL=wss://<ngrok-domain>
```

`/ws/live`는 붙이지 않습니다. 프론트엔드 코드가 자동으로 `/ws/live`를 붙입니다.

### 4. NPU 연결

NPU가 백엔드 PC에 직접 연결되는 경우:

```text
ws://<서버IP>:8765/ws/ingest
```

### SSL/WSS 활성화

`server/` 디렉터리에 `cert.pem`, `key.pem`이 존재하면 자동으로 HTTPS/WSS 모드로 전환됩니다.

```bash
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout server/key.pem \
  -out server/cert.pem \
  -days 365 \
  -subj "/CN=localhost"
```

---

## 주요 기능

### 실시간 WebSocket 통신

- NPU 데이터가 **2초 이상 수신되지 않으면** 상태 배지가 **"서버 연결됨 (NPU 신호 없음)"** 으로 자동 전환
- 접속 시 호스트 이름을 자동 감지하여 WebSocket URL을 동적으로 구성
- Vercel 배포 환경에서는 ngrok WSS 주소를 통해 로컬 백엔드와 통신

### 드론 탐지 및 위험 상황 자동 판단

| 위험 등급 | 기준 |
|-----------|------|
| **HIGH** | confidence ≥ 0.9 또는 탐지 수 ≥ 3 |
| **MEDIUM** | confidence ≥ 0.7 또는 탐지 수 ≥ 2 |
| **LOW** | confidence ≥ 0.5 또는 탐지 수 ≥ 1 |
| **SAFE** | 탐지 없음 |

- 원본 이미지의 비율을 유지하며 컨테이너 크기에 맞춰 Bounding Box를 동적으로 렌더링
- 탐지 객체의 위치 변화를 기반으로 이동 추적선(trail)을 표시
- 위험도 평가는 `dangerDetector.js`에서 프론트엔드 단독으로 수행

### 위험도 기반 알림

- `AlertPanel`에서 위험도별 알림을 표시
- `HIGH`, `MEDIUM`, `LOW`, `SAFE`별 색상, 우선순위, 강조 효과 구분
- 동일 레벨 반복 알림은 쿨다운으로 제한
- `HIGH`는 수동 확인, `MEDIUM`/`LOW`는 자동 닫힘 적용

### 서버 로깅 및 Mock NPU

- 서버 시작/종료, 클라이언트 접속/해제, 프레임 수신, 파싱 오류를 `server/logs/droneguard.log`에 기록
- 날짜별 로그 로테이션 및 최근 30일 보관
- 실제 NPU 없이 `server/mock_npu.py`로 개발/테스트용 탐지 프레임 생성 가능

### SSL/WSS 지원

`server/` 내에 인증서 파일이 있으면 자동으로 보안 서버로 전환되어 외부 모바일 기기 및 다른 PC에서의 접속을 지원합니다.

---

## 개발 팁

- **React 코드 수정 시**: Git에 반영 후 Vercel 재배포를 통해 운영 페이지에 반영합니다.
- **로컬 화면 확인 시**: `npm start`로 React 개발 서버를 실행해 확인할 수 있습니다.
- **NPU 없이 UI 테스트**: `server/mock_npu.py`를 실행해 백엔드 `/ws/ingest`로 mock frame을 전송할 수 있습니다.

---
