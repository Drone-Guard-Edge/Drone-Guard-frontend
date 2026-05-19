import { calculateRiskLevel, confidenceToPercent } from "./riskCalculator";

// IoU 계산 함수
export function calculateIoU(boxA, boxB) {
  const xA = Math.max(boxA.x1, boxB.x1);
  const yA = Math.max(boxA.y1, boxB.y1);
  const xB = Math.min(boxA.x2, boxB.x2);
  const yB = Math.min(boxA.y2, boxB.y2);

  const interWidth = Math.max(0, xB - xA);
  const interHeight = Math.max(0, yB - yA);
  const interArea = interWidth * interHeight;

  if (interArea === 0) return 0;

  const boxAArea = boxA.width * boxA.height;
  const boxBArea = boxB.width * boxB.height;

  const iou = interArea / (boxAArea + boxBArea - interArea);
  return iou;
}

export class DetectionTracker {
  constructor(options = {}) {
    this.posAlpha = options.posAlpha !== undefined ? options.posAlpha : 1.0;
    this.confUpdateInterval = options.confUpdateInterval || 500;
    this.iouThreshold = options.iouThreshold || 0.05;
    this.maxLostFrames = options.maxLostFrames !== undefined ? options.maxLostFrames : 0;
    this.activeTracks = [];
    this.trackIdCounter = 0;
  }

  update(currentDetections) {
    const updatedTracks = [];
    // 복사본을 만들어 매칭된 항목을 제거해 나갈 배열
    const unmatchedDetections = [...currentDetections];
    const now = Date.now();

    this.activeTracks.forEach((track) => {
      let bestMatchIdx = -1;
      let maxIou = 0;

      // 현재 남아있는 탐지들과 트랙 간 매칭
      unmatchedDetections.forEach((det, idx) => {
        if (det.class !== track.class) return;
        const iou = calculateIoU(track.bbox, det.bbox);
        if (iou > maxIou && iou > this.iouThreshold) {
          maxIou = iou;
          bestMatchIdx = idx;
        }
      });

      if (bestMatchIdx !== -1) {
        // 매칭 성공: EMA로 위치 및 신뢰도 부드럽게 조정
        const matchedDet = unmatchedDetections[bestMatchIdx];

        track.bbox.x1 =
          this.posAlpha * matchedDet.bbox.x1 + (1 - this.posAlpha) * track.bbox.x1;
        track.bbox.y1 =
          this.posAlpha * matchedDet.bbox.y1 + (1 - this.posAlpha) * track.bbox.y1;
        track.bbox.x2 =
          this.posAlpha * matchedDet.bbox.x2 + (1 - this.posAlpha) * track.bbox.x2;
        track.bbox.y2 =
          this.posAlpha * matchedDet.bbox.y2 + (1 - this.posAlpha) * track.bbox.y2;
        track.bbox.width = track.bbox.x2 - track.bbox.x1;
        track.bbox.height = track.bbox.y2 - track.bbox.y1;

        // 신뢰도 주기적 평균 업데이트
        track.confidenceBuffer.push(matchedDet.confidence);

        if (now - track.lastConfUpdateTime >= this.confUpdateInterval) {
          const sum = track.confidenceBuffer.reduce((a, b) => a + b, 0);
          const avg = sum / track.confidenceBuffer.length;

          track.confidence = avg;
          track.confidencePercent = confidenceToPercent(avg);
          track.riskLevel = calculateRiskLevel(avg);

          track.confidenceBuffer = []; // 평균 계산 후 버퍼 초기화
          track.lastConfUpdateTime = now;
        }

        track.lostFrames = 0; // 매칭되었으므로 누락 수치 초기화
        updatedTracks.push(track);

        // 매칭된 탐지 항목 제거
        unmatchedDetections.splice(bestMatchIdx, 1);
      } else {
        // 매칭 실패: 객체가 안 보임 (Patience 로직)
        track.lostFrames += 1;
        if (track.lostFrames <= this.maxLostFrames) {
          updatedTracks.push(track);
        }
      }
    });

    // 남은(매칭되지 않은) 탐지 결과들은 새로운 트랙으로 등록
    unmatchedDetections.forEach((det) => {
      updatedTracks.push({
        id: `track_${this.trackIdCounter++}_${det.class}`,
        class: det.class,
        confidence: det.confidence,
        confidencePercent: det.confidencePercent,
        riskLevel: det.riskLevel,
        bbox: { ...det.bbox },
        lostFrames: 0,
        // Confidence 평균 계산용 상태
        confidenceBuffer: [det.confidence],
        lastConfUpdateTime: now,
      });
    });

    this.activeTracks = updatedTracks;

    // React에서 불변성을 위해 새로운 객체/배열로 반환
    return this.activeTracks.map((track) => ({
      ...track,
      bbox: { ...track.bbox },
    }));
  }

  reset() {
    this.activeTracks = [];
    this.trackIdCounter = 0;
  }
}
