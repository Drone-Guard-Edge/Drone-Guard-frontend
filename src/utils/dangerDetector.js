/**
 * dangerDetector.js  –  US-05: 위험 상황 자동 판단 (E2 – 위험 판단)
 *
 * Acceptance Criteria:
 *  1. 특정 조건에서 자동으로 위험 상태로 전환됨
 *  2. 위험 발생 시 UI에 경고 메시지가 표시됨
 *
 * 자동 판단 규칙:
 *  - HIGH   : confidence ≥ 0.9  또는  탐지 수 ≥ 3
 *  - MEDIUM : confidence ≥ 0.7  또는  탐지 수 ≥ 2
 *  - LOW    : confidence ≥ 0.5  또는  탐지 수 ≥ 1
 *  - SAFE   : 탐지 없음
 */

/** 위험 레벨 우선순위 (높을수록 심각) */
const LEVEL_PRIORITY = { SAFE: 0, LOW: 1, MEDIUM: 2, HIGH: 3 };

/**
 * 단일 탐지 결과의 confidence 값으로 위험 레벨을 결정한다.
 * @param {number} confidence  0.0 ~ 1.0
 * @returns {'HIGH'|'MEDIUM'|'LOW'}
 */
const confidenceToLevel = (confidence) => {
  if (confidence >= 0.9) return "HIGH";
  if (confidence >= 0.7) return "MEDIUM";
  return "LOW";
};

/**
 * 탐지 수(count) 기반 위험 레벨을 결정한다.
 * @param {number} count
 * @returns {'HIGH'|'MEDIUM'|'LOW'|'SAFE'}
 */
const countToLevel = (count) => {
  if (count >= 3) return "HIGH";
  if (count >= 2) return "MEDIUM";
  if (count >= 1) return "LOW";
  return "SAFE";
};

/**
 * 두 레벨 중 더 높은 쪽을 반환한다.
 * @param {string} a
 * @param {string} b
 * @returns {string}
 */
const higherLevel = (a, b) =>
  LEVEL_PRIORITY[a] >= LEVEL_PRIORITY[b] ? a : b;

/**
 * 탐지 배열 전체를 분석해 자동으로 위험 상태를 결정한다.
 *
 * @param {Array<{confidence: number, riskLevel?: {level: string}}>} detections
 * @returns {{
 *   level: 'SAFE'|'LOW'|'MEDIUM'|'HIGH',
 *   color: string,
 *   label: string,
 *   isDanger: boolean,
 *   reason: string,
 *   triggerCount: number,
 *   maxConfidence: number
 * }}
 */
export const evaluateDanger = (detections) => {
  if (!detections || detections.length === 0) {
    return {
      level: "SAFE",
      color: "#10B981",
      label: "안전",
      isDanger: false,
      reason: "탐지된 드론 없음",
      triggerCount: 0,
      maxConfidence: 0,
    };
  }

  const count = detections.length;
  const maxConfidence = Math.max(...detections.map((d) => d.confidence ?? 0));

  // confidence 기반 레벨
  const confLevel = confidenceToLevel(maxConfidence);
  // 탐지 수 기반 레벨
  const cntLevel = countToLevel(count);
  // 최종 레벨 = 둘 중 더 높은 것
  const finalLevel = higherLevel(confLevel, cntLevel);

  const META = {
    HIGH:   { color: "#EF4444", label: "위험 (높음)", isDanger: true },
    MEDIUM: { color: "#F59E0B", label: "주의 (보통)", isDanger: true },
    LOW:    { color: "#3B82F6", label: "관찰 (낮음)", isDanger: false },
    SAFE:   { color: "#10B981", label: "안전",        isDanger: false },
  };

  const meta = META[finalLevel];

  // 어떤 규칙이 트리거됐는지 이유 문자열 생성
  const reasons = [];
  if (LEVEL_PRIORITY[confLevel] >= LEVEL_PRIORITY[cntLevel]) {
    reasons.push(`신뢰도 ${Math.round(maxConfidence * 100)}% 드론 탐지`);
  }
  if (LEVEL_PRIORITY[cntLevel] >= LEVEL_PRIORITY[confLevel]) {
    reasons.push(`드론 ${count}대 동시 탐지`);
  }

  return {
    level: finalLevel,
    color: meta.color,
    label: meta.label,
    isDanger: meta.isDanger,
    reason: reasons.join(" / "),
    triggerCount: count,
    maxConfidence,
  };
};

/**
 * 이전 상태와 현재 상태를 비교해 위험 상태로 **전환됐는지** 여부를 반환한다.
 * (US-05 AC-1: 특정 조건에서 자동으로 위험 상태로 전환됨)
 *
 * @param {string} prevLevel  이전 위험 레벨
 * @param {string} nextLevel  현재 위험 레벨
 * @returns {boolean}  true = 위험 상태로 전환됨(또는 레벨 상승)
 */
export const isDangerTransition = (prevLevel, nextLevel) => {
  const prev = LEVEL_PRIORITY[prevLevel] ?? 0;
  const next = LEVEL_PRIORITY[nextLevel] ?? 0;
  // SAFE→LOW, LOW→MEDIUM, MEDIUM→HIGH 등 레벨이 올라가는 경우를 '전환'으로 판단
  return next > prev;
};

/**
 * UI에 표시할 경고 메시지 문자열을 생성한다.
 * (US-05 AC-2: 위험 발생 시 UI에 경고 메시지가 표시됨)
 *
 * @param {{level: string, reason: string, triggerCount: number}} dangerInfo
 * @returns {string}
 */
export const buildDangerMessage = (dangerInfo) => {
  const prefix = {
    HIGH:   "🚨 위험 경보",
    MEDIUM: "⚠️ 주의 경보",
    LOW:    "📡 드론 탐지",
    SAFE:   "",
  }[dangerInfo.level] || "";

  if (!prefix) return "";
  return `${prefix}: ${dangerInfo.reason}`;
};
