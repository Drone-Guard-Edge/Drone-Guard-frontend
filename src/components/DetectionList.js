import React from "react";
import "./DetectionList.css";

const DetectionList = ({ detections = [] }) => {
  return (
    <div className="detection-list">
      <div className="detection-list-header">
        <span className="col-class">클래스</span>
        <span className="col-confidence">신뢰도</span>
        <span className="col-risk">위험도</span>
      </div>

      <div className="detection-list-body">
        {detections.map((detection) => (
          <div key={detection.id} className="detection-item">
            <span className="col-class">
              <code>{detection.class}</code>
            </span>
            <span className="col-confidence">
              {detection.confidencePercent}%
            </span>
            <span className="col-risk">
              <span
                className="risk-badge"
                style={{ backgroundColor: detection.riskLevel.color }}
              >
                {detection.riskLevel.label}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DetectionList;
