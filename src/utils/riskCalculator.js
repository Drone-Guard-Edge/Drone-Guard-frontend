// 위험도 레벨 계산 (옵션 A: confidence 기반 — README 스펙 준수)
export const calculateRiskLevel = (confidence) => {
  if (confidence >= 0.9) {
    return {
      level: "HIGH",
      color: "#EF4444",
      label: "높음",
    };
  } else if (confidence >= 0.7) {
    return {
      level: "MEDIUM",
      color: "#F59E0B",
      label: "중간",
    };
  } else {
    return {
      level: "LOW",
      color: "#10B981",
      label: "낮음",
    };
  }
};

// 신뢰도를 퍼센트로 변환
export const confidenceToPercent = (confidence) => {
  return Math.round(confidence * 100);
};

/**
 * bbox 정규화: 배열([x1,y1,x2,y2]) 또는 객체({x1,y1,x2,y2}) 모두 허용
 * todo.md 시나리오 3: bbox 포맷 불일치 입력 자동 처리
 */
export const normalizeBbox = (bbox) => {
  if (!bbox) return { x1: 0, y1: 0, x2: 0, y2: 0, width: 0, height: 0 };
  if (Array.isArray(bbox)) {
    const [x1, y1, x2, y2] = bbox;
    return { x1, y1, x2, y2, width: x2 - x1, height: y2 - y1 };
  }
  return {
    x1: bbox.x1,
    y1: bbox.y1,
    x2: bbox.x2,
    y2: bbox.y2,
    width: (bbox.x2 || 0) - (bbox.x1 || 0),
    height: (bbox.y2 || 0) - (bbox.y1 || 0),
  };
};

/**
 * detection 단건 정규화
 * - bbox 배열/객체 통일
 * - score 필드를 confidence로 통일 (server.py 호환)
 */
export const normalizeDetection = (detection) => {
  const confidence = detection.confidence ?? detection.score ?? 0;
  return {
    class: detection.class || detection.label || "unknown",
    confidence,
    bbox: normalizeBbox(detection.bbox),
  };
};

// 탐지 데이터 포맷팅
export const formatDetectionData = (rawData) => {
  if (!rawData) return null;

  // 이미지 데이터가 있으면 base64 URI로 변환
  let imageData = null;
  if (rawData.image_data) {
    if (rawData.image_data.startsWith("data:image")) {
      imageData = rawData.image_data;
    } else {
      imageData = `data:image/${rawData.format || "jpg"};base64,${rawData.image_data}`;
    }
  }

  return {
    imageId: rawData.image_id,
    filename: rawData.filename,
    width: rawData.width,
    height: rawData.height,
    format: rawData.format,
    imageData: imageData,
    createdAt: new Date(rawData.created_at),
    source: rawData.source,
    tags: rawData.tags || [],
    note: rawData.note,
    detections: (rawData.detections || []).map((detection) => {
      const normalized = normalizeDetection(detection);
      return {
        id: `${normalized.class}_${Math.random()}`,
        class: normalized.class,
        confidence: normalized.confidence,
        confidencePercent: confidenceToPercent(normalized.confidence),
        riskLevel: calculateRiskLevel(normalized.confidence),
        bbox: normalized.bbox,
      };
    }),
  };
};

// 전체 위험도 판정 (최고 신뢰도 기준)
export const getOverallRiskLevel = (detections) => {
  if (!detections || detections.length === 0) {
    return {
      level: "SAFE",
      color: "#10B981",
      label: "안전",
    };
  }

  const maxConfidence = Math.max(...detections.map((d) => d.confidence));
  return calculateRiskLevel(maxConfidence);
};
