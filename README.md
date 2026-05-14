# Drone Guard - Frontend

드론 탐지 및 위험도 분석을 위한 실시간 모니터링 웹 애플리케이션 (Sprint 1)

## 프로젝트 구조

```
src/
├── api/                      # API 통신 관련
│   ├── index.js             # 기본 API 함수 (GET, POST, PUT, DELETE)
│   └── detectionApi.js      # 드론 탐지 관련 API
├── components/              # 재사용 가능한 컴포넌트
│   ├── DetectionViewer.js   # 탐지 이미지 및 Bounding Box 표시
│   ├── RiskCard.js          # 위험도 레벨 카드
│   └── DetectionList.js     # 탐지 객체 리스트
├── pages/                   # 페이지 컴포넌트
│   └── Dashboard.js         # 메인 대시보드 페이지
├── utils/                   # 유틸리티 함수
│   └── riskCalculator.js    # 위험도 계산 및 데이터 포맷팅
└── App.js                   # 메인 애플리케이션
```

## 개발 환경 설정

### 필수 요구사항

- Node.js 14.0 이상
- npm 6.0 이상

### 설치

```bash
npm install
```

### 실행

```bash
npm start
```

브라우저에서 [http://localhost:3000](http://localhost:3000)으로 접속합니다.

## API 명세

### Base URL

```
http://localhost:8000/api
```

### 엔드포인트

#### 1. 최신 탐지 데이터 조회

```
GET /detections/latest

Response:
{
  "result": "ok",
  "data": {
    "image_id": "sample_0001",
    "filename": "sample.jpg",
    "width": 640,
    "height": 640,
    "format": "jpg",
    "created_at": "2026-05-14T09:47:58",
    "source": "laptop",
    "detections": [
      {
        "class": "test_box",
        "confidence": 0.97,
        "bbox": {
          "x1": 180,
          "y1": 180,
          "x2": 460,
          "y2": 460
        }
      }
    ],
    "tags": ["test", "websocket", "demo"],
    "note": "노트북에서 데스크톱으로 송신하는 샘플 페어"
  }
}
```

#### 2. 특정 이미지 ID로 탐지 데이터 조회

```
GET /detections/{imageId}

Response: 위와 동일
```

#### 3. 탐지 이력 조회 (페이지네이션)

```
GET /detections?page=1&limit=10

Response:
{
  "result": "ok",
  "data": {
    "items": [...],
    "total": 100,
    "page": 1,
    "limit": 10
  }
}
```

#### 4. 위험도 분석

```
POST /detections/risk-analysis

Request:
{
  "detections": [
    {
      "class": "drone",
      "confidence": 0.95,
      "bbox": { ... }
    }
  ]
}

Response:
{
  "result": "ok",
  "data": {
    "overall_risk": "HIGH",
    "confidence": 0.95,
    "recommendation": "긴급 조치 필요"
  }
}
```

## 위험도 레벨 기준

| 레벨   | 신뢰도    | 색상    | 설명                  |
| ------ | --------- | ------- | --------------------- |
| HIGH   | ≥ 0.9     | 🔴 빨강 | 높음 - 긴급 조치 필요 |
| MEDIUM | 0.7 ~ 0.9 | 🟠 주황 | 중간 - 주의 필요      |
| LOW    | < 0.7     | 🟢 초록 | 낮음 - 정상           |
| SAFE   | 탐지 없음 | 🟢 초록 | 안전                  |

## 환경 변수

`.env` 파일에서 다음 변수를 설정할 수 있습니다:

```env
# API 서버 URL
REACT_APP_API_URL=http://localhost:8000
```

## 주요 기능

### Sprint 1 - 드론 탐지 및 위험도 시각화

✅ **실시간 탐지 데이터 표시**

- EO-IR Fusion 모델의 실시간 탐지 결과 표시
- Bounding Box 시각화

✅ **위험도 단계 제공**

- 신뢰도(Confidence) 기반 위험도 계산
- 3단계 위험도 레벨 (HIGH, MEDIUM, LOW)
- 색상 코드로 직관적 표현

✅ **상세 정보 제공**

- 탐지 객체별 신뢰도 및 좌표
- 메타 정보 (이미지 크기, 소스, 생성 시간)
- 태그 및 노트

✅ **자동 갱신**

- 5초마다 데이터 자동 새로고침
- 실시간 모니터링 지원

## 빌드

```bash
npm run build
```

## 라이선스

MIT

## 연락처

Drone Guard Edge Team

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
