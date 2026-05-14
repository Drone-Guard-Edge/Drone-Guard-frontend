// Base64 더미 이미지 생성 함수
const generateDummyImageBase64 = () => {
  // Canvas를 이용하여 더미 이미지 생성
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 640;
  const ctx = canvas.getContext("2d");

  // 배경 (진회색)
  ctx.fillStyle = "#2a2a2a";
  ctx.fillRect(0, 0, 640, 640);

  // 그리드 패턴
  ctx.strokeStyle = "rgba(100, 100, 100, 0.3)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 640; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 640);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(640, i);
    ctx.stroke();
  }

  // 제목 텍스트
  ctx.fillStyle = "#00FF00";
  ctx.font = "bold 24px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Thermal Imaging - Test", 320, 40);

  // 배경 원형 패턴 (열화상 느낌)
  ctx.fillStyle = "rgba(255, 100, 0, 0.15)";
  ctx.beginPath();
  ctx.arc(320, 320, 200, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 200, 0, 0.1)";
  ctx.beginPath();
  ctx.arc(150, 150, 120, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(100, 150, 255, 0.1)";
  ctx.beginPath();
  ctx.arc(500, 450, 100, 0, Math.PI * 2);
  ctx.fill();

  // 정보 텍스트
  ctx.fillStyle = "#CCCCCC";
  ctx.font = "12px Arial";
  ctx.textAlign = "left";
  ctx.fillText("EO-IR Fusion Model", 20, 620);
  ctx.fillText("Resolution: 640x640", 450, 620);

  // Canvas를 Base64로 변환
  return canvas.toDataURL("image/jpeg");
};

// Mock 데이터 - API 없이 테스트할 때 사용
export const mockDetectionData = {
  image_id: "sample_0001",
  filename: "sample.jpg",
  width: 640,
  height: 640,
  format: "jpg",
  created_at: "2026-05-14T09:47:58",
  source: "laptop",
  image_data:
    typeof document !== "undefined" ? generateDummyImageBase64() : null,
  detections: [
    {
      class: "drone",
      confidence: 0.97,
      bbox: {
        x1: 180,
        y1: 180,
        x2: 460,
        y2: 460,
      },
    },
    {
      class: "person",
      confidence: 0.85,
      bbox: {
        x1: 50,
        y1: 100,
        x2: 150,
        y2: 300,
      },
    },
    {
      class: "vehicle",
      confidence: 0.72,
      bbox: {
        x1: 400,
        y1: 300,
        x2: 600,
        y2: 500,
      },
    },
  ],
  tags: ["test", "demo", "fusion"],
  note: "EO-IR Fusion 모델 테스트 데이터",
};

// 여러 탐지 결과 Mock 데이터
export const mockDetectionHistory = [
  {
    image_id: "sample_0001",
    filename: "sample_0001.jpg",
    created_at: "2026-05-14T10:23:01",
    detections: 1,
    max_confidence: 0.97,
  },
  {
    image_id: "sample_0002",
    filename: "sample_0002.jpg",
    created_at: "2026-05-14T10:22:48",
    detections: 2,
    max_confidence: 0.85,
  },
  {
    image_id: "sample_0003",
    filename: "sample_0003.jpg",
    created_at: "2026-05-14T10:22:31",
    detections: 1,
    max_confidence: 0.72,
  },
  {
    image_id: "sample_0004",
    filename: "sample_0004.jpg",
    created_at: "2026-05-14T10:22:19",
    detections: 2,
    max_confidence: 0.91,
  },
  {
    image_id: "sample_0005",
    filename: "sample_0005.jpg",
    created_at: "2026-05-14T10:22:05",
    detections: 0,
    max_confidence: 0,
  },
];
