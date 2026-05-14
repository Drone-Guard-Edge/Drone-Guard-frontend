import React, { useState, useEffect } from "react";
import DetectionViewer from "../components/DetectionViewer";
import DetectionList from "../components/DetectionList";
import { mockDetectionData } from "../api/mockData";
import {
  formatDetectionData,
  getOverallRiskLevel,
} from "../utils/riskCalculator";
import "./Dashboard.css";

const Dashboard = () => {
  const [detectionData, setDetectionData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [communicationMode, setCommunicationMode] = useState("mock"); // "mock" or "api"
  const [apiData, setApiData] = useState(null); // API 모드에서 받은 데이터

  useEffect(() => {
    // Mock 데이터로 초기화
    if (communicationMode === "mock") {
      const formattedData = formatDetectionData(mockDetectionData);
      setDetectionData(formattedData);
      setApiData(null);
    } else {
      // API 모드: 데이터 초기화 (백엔드에서 받을 때까지 대기)
      setDetectionData({
        imageId: "",
        filename: "",
        width: 0,
        height: 0,
        format: "",
        createdAt: new Date(),
        source: "API",
        tags: [],
        note: "",
        detections: [],
      });
      setApiData(null);
    }
  }, [communicationMode]);

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => {
      if (communicationMode === "mock") {
        // Mock 모드: 새로운 timestamp로 업데이트
        const updatedData = {
          ...mockDetectionData,
          created_at: new Date().toISOString(),
        };
        const formattedData = formatDetectionData(updatedData);
        setDetectionData(formattedData);
      } else {
        // API 모드: 실제로는 백엔드에서 받아야 함
        console.log("API 모드: 백엔드에서 데이터를 받아오는 중...");
        // TODO: 실제 API 호출
      }
      setLoading(false);
    }, 500);
  };

  const toggleCommunicationMode = () => {
    setCommunicationMode(communicationMode === "mock" ? "api" : "mock");
  };

  if (!detectionData) {
    return (
      <div className="dashboard">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>드론 탐지 데이터를 로드하는 중...</p>
        </div>
      </div>
    );
  }

  const overallRisk = getOverallRiskLevel(detectionData.detections);

  return (
    <div className="dashboard">
      {/* 헤더 */}
      <div className="dashboard-header">
        <div className="header-content">
          <h1>🛡️ Drone Guard - Edge 모니터링</h1>
          <p>실시간 드론 탐지 및 위험도 분석 시스템</p>
        </div>
        <div className="header-buttons">
          <button
            className={`comm-btn ${communicationMode}`}
            onClick={toggleCommunicationMode}
            title="통신 모드 전환"
          >
            {communicationMode === "mock" ? "🔴 통신없음" : "🟢 통신시작"}
          </button>
          <button
            className="refresh-btn"
            onClick={handleRefresh}
            disabled={loading}
          >
            {loading ? "업데이트 중..." : "새로고침"}
          </button>
        </div>
      </div>

      {/* 메인 컨테이너 - 2컬럼 레이아웃 */}
      <div className="dashboard-main">
        {/* 왼쪽: 위험도 정보 */}
        <div className="dashboard-left">
          {/* 요약 정보 */}
          <div className="summary-section">
            <div className="summary-grid">
              <div className="summary-card">
                <span className="label">현재 위험도</span>
                <span className="value" style={{ color: overallRisk.color }}>
                  {overallRisk.label}
                </span>
              </div>
              <div className="summary-card">
                <span className="label">탐지 수</span>
                <span className="value">{detectionData.detections.length}</span>
              </div>
              <div className="summary-card">
                <span className="label">소스</span>
                <span className="value">{detectionData.source}</span>
              </div>
              <div className="summary-card">
                <span className="label">업데이트</span>
                <span className="value">
                  {detectionData.createdAt.toLocaleTimeString("ko-KR")}
                </span>
              </div>
            </div>
          </div>

          {/* 탐지 이미지 뷰어 */}
          <div className="detection-section">
            <h2>탐지 결과</h2>
            <DetectionViewer
              imageUrl={`data:image/${detectionData.format};base64,...`}
              detections={detectionData.detections}
              imageWidth={detectionData.width}
              imageHeight={detectionData.height}
            />
          </div>
        </div>

        {/* 오른쪽: 탐지 피드 */}
        <div className="dashboard-right">
          <div className="list-section">
            <h2>탐지 피드</h2>
            {communicationMode === "api" &&
            detectionData.detections.length === 0 ? (
              <div className="api-waiting">
                <p>🔗 백엔드와 연동 대기 중...</p>
                <small>백엔드 서버에서 데이터를 받으면 표시됩니다.</small>
              </div>
            ) : (
              <DetectionList detections={detectionData.detections} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
