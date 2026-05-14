// 위험도 레벨 계산
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

// 탐지 데이터 포맷팅
export const formatDetectionData = (rawData) => {
  if (!rawData) return null;

  return {
    imageId: rawData.image_id,
    filename: rawData.filename,
    width: rawData.width,
    height: rawData.height,
    format: rawData.format,
    createdAt: new Date(rawData.created_at),
    source: rawData.source,
    tags: rawData.tags || [],
    note: rawData.note,
    detections: (rawData.detections || []).map((detection) => ({
      id: `${detection.class}_${Math.random()}`,
      class: detection.class,
      confidence: detection.confidence,
      confidencePercent: confidenceToPercent(detection.confidence),
      riskLevel: calculateRiskLevel(detection.confidence),
      bbox: {
        x1: detection.bbox.x1,
        y1: detection.bbox.y1,
        x2: detection.bbox.x2,
        y2: detection.bbox.y2,
        width: detection.bbox.x2 - detection.bbox.x1,
        height: detection.bbox.y2 - detection.bbox.y1,
      },
    })),
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
