/**
 * alertManager.js  –  US-07: 위험도 기반 알림 구분 (E3 – 알림 시스템)
 *                      US-08: 알림 중복 방지 (E3 – 알림 시스템)
 *
 * US-07 Acceptance Criteria:
 *  1. 위험도에 따라 알림이 구분됨
 *  2. 위험도가 높을수록 더 강조되어 표시됨
 *  3. 위험 발생 시 즉시 알림이 생성됨
 *
 * US-08 Acceptance Criteria:
 *  1. 동일 이벤트에 대해 반복 알림 제한
 *  2. 일정 시간 내 중복 알림 발생 제한
 *  3. 상태 변화 시에만 새로운 알림 발생
 */

/** 위험 레벨별 알림 스타일 정의 (US-07 AC-1, AC-2) */
export const ALERT_STYLES = {
  HIGH: {
    level: "HIGH",
    label: "위험",
    color: "#EF4444",
    bgColor: "#FEF2F2",
    borderColor: "#FCA5A5",
    icon: "🚨",
    priority: 3,
    /** 강조 표시: 깜빡임 애니메이션 적용 */
    emphasis: "blink",
    /** 자동 닫힘 없음 (수동 확인 필요) */
    autoDismissMs: null,
  },
  MEDIUM: {
    level: "MEDIUM",
    label: "주의",
    color: "#D97706",
    bgColor: "#FFFBEB",
    borderColor: "#FCD34D",
    icon: "⚠️",
    priority: 2,
    emphasis: "pulse",
    /** 30초 후 자동 닫힘 */
    autoDismissMs: 30000,
  },
  LOW: {
    level: "LOW",
    label: "관찰",
    color: "#2563EB",
    bgColor: "#EFF6FF",
    borderColor: "#93C5FD",
    icon: "📡",
    priority: 1,
    emphasis: "none",
    /** 10초 후 자동 닫힘 */
    autoDismissMs: 10000,
  },
  SAFE: {
    level: "SAFE",
    label: "안전",
    color: "#059669",
    bgColor: "#ECFDF5",
    borderColor: "#6EE7B7",
    icon: "✅",
    priority: 0,
    emphasis: "none",
    autoDismissMs: 5000,
  },
};

/** 레벨별 중복 방지 쿨다운 시간(ms) (US-08 AC-2) */
const DEDUP_COOLDOWN_MS = {
  HIGH:   5_000,   //  5초
  MEDIUM: 15_000,  // 15초
  LOW:    30_000,  // 30초
  SAFE:   10_000,  // 10초
};

/**
 * AlertManager
 *
 * 단일 인스턴스로 사용하며, React 상태(alerts)와 연동하기 위해
 * 리스너(onAlertsChange)를 등록하는 구조.
 *
 * 사용 예시:
 *   alertManager.push(dangerInfo);          // 새 알림 추가
 *   alertManager.dismiss(alertId);          // 알림 수동 닫기
 *   alertManager.onAlertsChange = setAlerts; // React 상태 연동
 */
export class AlertManager {
  constructor() {
    /** @type {Array<AlertItem>} 현재 활성 알림 목록 */
    this._alerts = [];

    /**
     * 레벨별 마지막 알림 타임스탬프 (중복 방지용, US-08 AC-1, AC-2)
     * @type {Map<string, number>}
     */
    this._lastAlertTime = new Map();

    /**
     * 레벨별 마지막 알림 상태 (상태 변화 감지용, US-08 AC-3)
     * @type {string|null}
     */
    this._lastLevel = null;

    /** React 상태 업데이트 콜백 */
    this.onAlertsChange = null;

    /** 자동 닫힘 타이머 저장 */
    this._dismissTimers = new Map();

    /** 알림 ID 카운터 */
    this._idCounter = 0;
  }

  // ─── 공개 API ───────────────────────────────────────

  /**
   * 위험 정보로부터 알림을 생성한다.
   * 중복/쿨다운 체크 후 조건을 통과한 경우에만 실제 알림을 추가한다.
   *
   * @param {{level: string, reason: string, triggerCount: number, maxConfidence: number}} dangerInfo
   * @returns {AlertItem|null}  생성된 알림 또는 null(중복 차단)
   */
  push(dangerInfo) {
    const { level, reason, triggerCount, maxConfidence } = dangerInfo;

    // SAFE 상태는 이전이 위험 상태일 때만 알림 (US-08 AC-3)
    if (level === "SAFE" && this._lastLevel === "SAFE") return null;
    if (level === "SAFE" && !["HIGH", "MEDIUM", "LOW"].includes(this._lastLevel)) return null;

    // 중복 방지: 동일 레벨 쿨다운 체크 (US-08 AC-1, AC-2)
    const now = Date.now();
    const cooldown = DEDUP_COOLDOWN_MS[level] ?? 10_000;
    const lastTime = this._lastAlertTime.get(level) ?? 0;

    if (now - lastTime < cooldown) {
      // 쿨다운 중이면 알림 생략
      return null;
    }

    // 상태 변화 체크: 이전과 동일 레벨이면 생략 (US-08 AC-3)
    // 단, HIGH는 항상 쿨다운 기준으로만 판단 (위험 지속 중에도 주기적 알림 필요)
    if (level !== "HIGH" && level === this._lastLevel && now - lastTime < cooldown * 2) {
      return null;
    }

    // 알림 생성 (US-07 AC-3: 위험 발생 시 즉시)
    const style = ALERT_STYLES[level] || ALERT_STYLES.LOW;
    const alert = {
      id: `alert_${++this._idCounter}_${now}`,
      level,
      label: style.label,
      icon: style.icon,
      color: style.color,
      bgColor: style.bgColor,
      borderColor: style.borderColor,
      emphasis: style.emphasis,
      priority: style.priority,
      message: reason || `드론 ${triggerCount}대 탐지`,
      detail: `신뢰도 ${Math.round((maxConfidence ?? 0) * 100)}% · 드론 ${triggerCount}대`,
      timestamp: now,
      timestampStr: new Date(now).toLocaleTimeString("ko-KR"),
      dismissed: false,
    };

    // 상태 갱신
    this._lastAlertTime.set(level, now);
    this._lastLevel = level;

    // 우선순위 내림차순 정렬로 삽입 (US-07 AC-2: 높은 위험도일수록 상단)
    this._alerts = [alert, ...this._alerts]
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 20); // 최대 20개 유지

    this._notify();

    // 자동 닫힘 등록
    if (style.autoDismissMs) {
      const timer = setTimeout(() => this.dismiss(alert.id), style.autoDismissMs);
      this._dismissTimers.set(alert.id, timer);
    }

    return alert;
  }

  /**
   * 알림을 수동으로 닫는다.
   * @param {string} alertId
   */
  dismiss(alertId) {
    const timer = this._dismissTimers.get(alertId);
    if (timer) {
      clearTimeout(timer);
      this._dismissTimers.delete(alertId);
    }
    this._alerts = this._alerts.filter((a) => a.id !== alertId);
    this._notify();
  }

  /** 모든 알림을 닫는다. */
  dismissAll() {
    this._dismissTimers.forEach((timer) => clearTimeout(timer));
    this._dismissTimers.clear();
    this._alerts = [];
    this._lastLevel = null;
    this._lastAlertTime.clear();
    this._notify();
  }

  /** 현재 알림 목록 (읽기 전용) */
  get alerts() {
    return [...this._alerts];
  }

  /** 현재 가장 높은 우선순위 알림 */
  get topAlert() {
    return this._alerts[0] || null;
  }

  // ─── 내부 메서드 ─────────────────────────────────────

  _notify() {
    if (typeof this.onAlertsChange === "function") {
      this.onAlertsChange([...this._alerts]);
    }
  }
}

/** 싱글톤 인스턴스 (앱 전역 공유) */
export const alertManager = new AlertManager();
