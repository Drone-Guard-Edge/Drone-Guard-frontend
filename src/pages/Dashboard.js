import React, { useState, useEffect } from "react";
import DetectionViewer from "../components/DetectionViewer";
import DetectionList from "../components/DetectionList";
import { mockDetectionData } from "../api/mockData";
import { getDetectionDataApi } from "../api/detectionApi";
import {
  formatDetectionData,
  getOverallRiskLevel,
} from "../utils/riskCalculator";
import "./Dashboard.css";

const Dashboard = () => {
  const [detectionData, setDetectionData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [communicationMode, setCommunicationMode] = useState("mock"); // "mock" or "api"
  const [intervalId, setIntervalId] = useState(null);

  useEffect(() => {
    // Mock 데이터로 초기화
    if (communicationMode === "mock") {
      const formattedData = formatDetectionData(mockDetectionData);
      setDetectionData(formattedData);

      // 기존 interval 정리
      if (intervalId) clearInterval(intervalId);
      setIntervalId(null);
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

      // API 모드: 주기적 GET 요청 시작 (1초마다 프레임 수신)
      console.log("🔗 API 모드: 백엔드에서 프레임 수신 시작...");
      const id = setInterval(() => {
        fetchDetectionDataFromAPI();
      }, 1000); // 1초마다 GET 요청

      setIntervalId(id);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [communicationMode, intervalId]);

  const fetchDetectionDataFromAPI = async () => {
    try {
      const result = await getDetectionDataApi();
      if (result.success && result.data) {
        const formattedData = formatDetectionData(result.data);
        setDetectionData(formattedData);
      }
    } catch (error) {
      console.error("API 요청 오류:", error);
    }
  };

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
        // API 모드: 즉시 한 번 요청
        console.log("🔄 수동 갱신: 백엔드에서 데이터를 받아오는 중...");
        fetchDetectionDataFromAPI();
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
        {/* 왼쪽: 탐지 이미지 */}
        <div className="dashboard-left">
          {/* 탐지 이미지 뷰어 */}
          <div className="detection-section">
            <h2>탐지 결과</h2>
            <DetectionViewer
              imageData={detectionData.imageData || null}
              detections={detectionData.detections}
              imageWidth={detectionData.width}
              imageHeight={detectionData.height}
            />
          </div>
        </div>

        {/* 오른쪽: 요약 정보 + 탐지 피드 */}
        <div className="dashboard-right">
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

          {/* 탐지 피드 */}
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
