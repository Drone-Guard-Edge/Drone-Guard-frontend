import React from "react";
import "./RiskCard.css";

const RiskCard = ({ riskLevel, detectionCount, timestamp }) => {
  const getRiskClassName = () => {
    return `risk-card risk-card-${riskLevel.level.toLowerCase()}`;
  };

  return (
    <div className={getRiskClassName()}>
      <div className="risk-header">
        <div
          className="risk-level-indicator"
          style={{ backgroundColor: riskLevel.color }}
        >
          {riskLevel.level}
        </div>
        <div className="risk-label">{riskLevel.label}</div>
      </div>

      <div className="risk-content">
        <div className="risk-stat">
          <span className="risk-label-small">탐지 수</span>
          <span className="risk-value">{detectionCount}</span>
        </div>

        {timestamp && (
          <div className="risk-timestamp">
            {new Date(timestamp).toLocaleTimeString("ko-KR")}
          </div>
        )}
      </div>
    </div>
  );
};

export default RiskCard;
