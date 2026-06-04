/**
 * AlertPanel.jsx  –  US-05/07/08 UI 컴포넌트
 *
 * US-05 AC-2: 위험 발생 시 UI에 경고 메시지 표시
 * US-07 AC-1: 위험도에 따라 알림 구분
 * US-07 AC-2: 위험도가 높을수록 더 강조 표시
 */

import React, { useEffect, useRef } from "react";
import "./AlertPanel.css";

/**
 * @param {{
 *   alerts: Array<import('../utils/alertManager').AlertItem>,
 *   onDismiss: (id: string) => void,
 *   onDismissAll: () => void
 * }} props
 */
const AlertPanel = ({ alerts = [], onDismiss, onDismissAll }) => {
  const panelRef = useRef(null);

  // 새 HIGH 알림이 오면 패널 최상단으로 스크롤
  useEffect(() => {
    if (alerts.length > 0 && alerts[0]?.level === "HIGH" && panelRef.current) {
      panelRef.current.scrollTop = 0;
    }
  }, [alerts]);

  if (alerts.length === 0) {
    return (
      <div className="alert-panel-empty">
        🔔<br />알림 없음<br /><span style={{ fontSize: "11px" }}>위험 탐지 시 표시됩니다</span>
      </div>
    );
  }

  return (
    <div className="alert-panel" ref={panelRef} aria-live="assertive">
      <div className="alert-panel-header">
        <span className="alert-panel-title">
          🔔 알림 <span className="alert-badge">{alerts.length}</span>
        </span>
        <button className="alert-clear-btn" onClick={onDismissAll} title="모든 알림 닫기">
          전체 닫기
        </button>
      </div>

      <ul className="alert-list">
        {alerts.map((alert) => (
          <AlertItem key={alert.id} alert={alert} onDismiss={onDismiss} />
        ))}
      </ul>
    </div>
  );
};

/**
 * 개별 알림 아이템
 * US-07 AC-2: emphasis에 따라 blink/pulse CSS 클래스 적용
 */
const AlertItem = ({ alert, onDismiss }) => {
  const {
    id, icon, label, message, detail,
    bgColor, borderColor, color,
    emphasis, timestampStr,
  } = alert;

  const emphasisClass = emphasis !== "none" ? `alert-item--${emphasis}` : "";

  return (
    <li
      className={`alert-item ${emphasisClass}`}
      style={{ backgroundColor: bgColor, borderColor }}
    >
      {/* 좌측 위험 레벨 표시바 (US-07 AC-2: 높을수록 강조) */}
      <span className="alert-level-bar" style={{ backgroundColor: color }} />

      <div className="alert-content">
        <div className="alert-top-row">
          <span className="alert-icon">{icon}</span>
          <span className="alert-label" style={{ color }}>{label}</span>
          <span className="alert-time">{timestampStr}</span>
          <button
            className="alert-dismiss-btn"
            onClick={() => onDismiss(id)}
            title="닫기"
            aria-label="알림 닫기"
          >
            ✕
          </button>
        </div>

        <p className="alert-message">{message}</p>
        {detail && <p className="alert-detail">{detail}</p>}
      </div>
    </li>
  );
};

export default AlertPanel;
