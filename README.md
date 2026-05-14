# Drone Guard - Frontend

드론 탐지 및 위험도 분석을 위한 실시간 모니터링 웹 애플리케이션 (Sprint 1)

## 프로젝트 구조

```
src/
├── api/                      # API 통신 관련
│   ├── index.js             # 기본 API 함수 (GET, POST, PUT, DELETE)
│   ├── detectionApi.js      # 드론 탐지 관련 API
│   └── mockData.js          # Mock 테스트 데이터
├── components/              # 재사용 가능한 컴포넌트
│   ├── DetectionViewer.js   # 탐지 이미지 및 Bounding Box 표시
│   ├── DetectionList.js     # 탐지 객체 리스트
│   ├── DetectionViewer.css
│   └── DetectionList.css
├── pages/                   # 페이지 컴포넌트
│   ├── Dashboard.js         # 메인 대시보드 페이지
│   └── Dashboard.css
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
    "image_data": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
    "created_at": "2026-05-14T09:47:58",
    "source": "laptop",
    "detections": [
      {
        "class": "drone",
        "confidence": 0.97,
        "bbox": {
          "x1": 180,
          "y1": 180,
          "x2": 460,
          "y2": 460
        }
      },
      {
        "class": "person",
        "confidence": 0.85,
        "bbox": {
          "x1": 50,
          "y1": 100,
          "x2": 150,
          "y2": 300
        }
      }
    ]
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

### 통신 모드

**🔴 Mock 모드 (통신없음)**

- Mock 데이터 사용 (샘플 탐지 데이터)
- 수동 갱신 (새로고침 버튼 클릭)
- API 서버 없이 독립적으로 테스트 가능

**🟢 API 모드 (통신시작)**

- 백엔드 서버에서 실시간 프레임 수신
- 1초마다 자동으로 GET 요청 (프레임 단위)
- 탐지 데이터 없을 때 "백엔드와 연동 대기 중..." 표시
- 백엔드 서버와 완벽 연동

### Sprint 1 - 드론 탐지 및 위험도 시각화

✅ **실시간 탐지 데이터 표시**

- EO-IR Fusion 모델의 실시간 탐지 결과 표시
- Canvas 기반 Bounding Box 시각화
- 탐지 객체별 신뢰도(%) 및 위험도 레벨 표시
- 원본 이미지 좌표 정보 표시

✅ **위험도 단계 제공**

- 신뢰도(Confidence) 기반 위험도 계산
- 3단계 위험도 레벨 (HIGH, MEDIUM, LOW)
- 색상 코드로 직관적 표현 (빨강/주황/초록)
- 위험도별 경고 시스템

✅ **이미지 스케일링**

- 원본 이미지 비율 유지 (640x640 → 컨테이너에 맞춰 동적 스케일)
- Bounding Box 좌표 자동 스케일링
- 반응형 레이아웃 (2컬럼: 이미지/요약정보)

✅ **상세 정보 제공**

- 현재 위험도 레벨
- 탐지된 객체 수
- 데이터 소스 및 업데이트 시간
- 탐지 피드 (객체별 신뢰도 테이블)

✅ **자동 갱신**

- Mock 모드: 수동 갱신 (새로고침 버튼)
- API 모드: 1초마다 자동 GET 요청 (프레임 단위)
- 통신 모드 실시간 전환 가능

## 주요 컴포넌트

### DetectionViewer

Canvas를 이용한 실시간 이미지 및 Bounding Box 렌더링

- 컨테이너 크기 감지 (getBoundingClientRect)
- 비율 유지하며 동적 스케일링
- JSON 기반 Bounding Box 좌표 렌더링

### DetectionList

탐지된 객체들의 테이블 형식 표시

- 클래스, 신뢰도, 위험도 3컬럼
- 스크롤 가능한 리스트
- 위험도별 컬러 배지

### Dashboard

메인 페이지 레이아웃 및 상태 관리

- Mock/API 모드 토글
- 실시간 데이터 폴링 (1초 간격)
- 2컬럼 반응형 레이아웃

## 빌드

```bash
npm run build
```

## 사용 예제

### Mock 모드로 테스트 (백엔드 없이)

```bash
npm start
# 브라우저에서 http://localhost:3000 접속
# 🔴 통신없음 버튼 클릭하여 Mock 데이터 확인
# 새로고침 버튼으로 수동 갱신
```

### API 모드로 백엔드와 연동

```bash
# 1. .env 파일 설정
REACT_APP_API_URL=http://localhost:8000

# 2. npm start로 프론트엔드 실행
npm start

# 3. 브라우저에서 🟢 통신시작 버튼 클릭
# 4. 백엔드 서버에서 GET /detections/latest 엔드포인트 제공 시
#    자동으로 1초마다 폴링하여 실시간 데이터 표시
```

## 개발 팁

### Console 로그 확인

- 컨테이너 크기 감지 로그
- 원본/스케일된 이미지 크기 로그
- 스케일 비율 로그

### Mock 데이터 수정

`src/api/mockData.js`의 `mockDetectionData` 객체 수정으로 테스트 데이터 변경 가능

### 이미지 최대 높이 조정

`src/components/DetectionViewer.css`의 `max-height: 750px` 값 조정

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
