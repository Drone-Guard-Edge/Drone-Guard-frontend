// Mock 데이터 - API 없이 테스트할 때 사용
export const mockDetectionData = {
  image_id: "sample_0001",
  filename: "sample.jpg",
  width: 640,
  height: 640,
  format: "jpg",
  created_at: "2026-05-14T09:47:58",
  source: "laptop",
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
