import React, { useState, useEffect, useCallback, useRef } from "react";
import DetectionViewer from "../components/DetectionViewer";
import DetectionList from "../components/DetectionList";
import { wsClient } from "../api/wsClient";
import {
  formatDetectionData,
  getOverallRiskLevel,
} from "../utils/riskCalculator";
import "./Dashboard.css";

const WS_STATUS_LABELS = {
  disconnected: { text: "서버 연결 끊김", color: "#6b7280" },
  connecting: { text: "서버 연결 중...", color: "#F59E0B" },
  connected: { text: "서버 연결됨", color: "#10B981" },
  error: { text: "서버 오류", color: "#EF4444" },
};

const Dashboard = () => {
  const [detectionData, setDetectionData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [wsStatus, setWsStatus] = useState("disconnected");
  const [wsError, setWsError] = useState(null);
  const [currentFps, setCurrentFps] = useState(0);
  
  // NPU에서 데이터가 오고 있는지 확인하는 상태
  const [npuActive, setNpuActive] = useState(false);
  const npuTimerRef = useRef(null);
  const npuStartTimeRef = useRef(null);
  const npuFrameCountRef = useRef(0);

  const makeEmptyFrame = () => ({
    imageId: "",
    filename: "",
    width: 0,
    height: 0,
    format: "",
    imageData: null,
    createdAt: new Date(),
    source: "npu",
    tags: [],
    note: "",
    detections: [],
  });

  const applyRawFrame = useCallback((rawData) => {
    if (!rawData) return;
    const formatted = formatDetectionData(rawData);
    if (formatted) {
      setDetectionData(formatted);
      
      const now = Date.now();
      if (!npuStartTimeRef.current) {
        npuStartTimeRef.current = now;
        npuFrameCountRef.current = 1;
        setCurrentFps(0);
      } else {
        npuFrameCountRef.current += 1;
        const elapsed = (now - npuStartTimeRef.current) / 1000;
        if (elapsed > 0) {
          setCurrentFps((npuFrameCountRef.current / elapsed).toFixed(1));
        }
      }

      // 프레임이 들어오면 NPU 활성 상태로 전환하고 타이머 초기화
      setNpuActive(true);
      if (npuTimerRef.current) clearTimeout(npuTimerRef.current);
      
      // 2초 동안 새 프레임이 안 오면 NPU 신호 끊김으로 간주
      npuTimerRef.current = setTimeout(() => {
        setNpuActive(false);
        npuStartTimeRef.current = null;
        npuFrameCountRef.current = 0;
        setCurrentFps(0);
      }, 2000);
    }
  }, []);

  const startWs = useCallback(() => {
    setWsError(null);
    wsClient.connect({
      onFrame: (rawFrame) => {
        applyRawFrame(rawFrame);
      },
      onStatusChange: (status) => {
        console.log(`📡 WS 상태 변경: ${status}`);
        setWsStatus(status);
      },
      onError: (err) => {
        setWsError("WebSocket 연결 오류가 발생했습니다.");
        console.error("WS 오류:", err);
      },
    });
  }, [applyRawFrame]);

  const stopWs = useCallback(() => {
    wsClient.disconnect();
    setWsStatus("disconnected");
    setNpuActive(false);
    npuStartTimeRef.current = null;
    npuFrameCountRef.current = 0;
    setCurrentFps(0);
  }, []);

  useEffect(() => {
    console.log("🟢 WebSocket 모드: 연결 시작");
    setDetectionData(makeEmptyFrame());
    startWs();

    return () => {
      stopWs();
    };
  }, [startWs, stopWs]);

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => {
      if (wsStatus !== "connected") {
        stopWs();
        startWs();
      }
      setLoading(false);
    }, 400);
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
  const wsStatusInfo = WS_STATUS_LABELS[wsStatus] || WS_STATUS_LABELS.disconnected;
  const isWaiting = wsStatus !== "connected" || !npuActive;

  // 서버엔 연결되었으나 NPU 데이터가 없는 상태
  const isServerConnectedButNoNpu = wsStatus === "connected" && !npuActive;

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="header-content">
          <h1>🛡️ Drone Guard - Edge 모니터링</h1>
          <p>실시간 드론 탐지 및 위험도 분석 시스템</p>
        </div>
        <div className="header-buttons">
          <span
            className="ws-status-badge"
            style={{ 
              borderColor: isServerConnectedButNoNpu ? "#F59E0B" : wsStatusInfo.color, 
              color: isServerConnectedButNoNpu ? "#F59E0B" : wsStatusInfo.color 
            }}
            title={wsError || ""}
          >
            <span
              className={`ws-dot ${wsStatus === "connected" ? "ws-dot-active" : ""}`}
              style={{ backgroundColor: isServerConnectedButNoNpu ? "#F59E0B" : wsStatusInfo.color }}
            />
            {isServerConnectedButNoNpu ? "서버 연결됨 (NPU 신호 없음)" : wsStatusInfo.text}
          </span>

          {wsStatus === "connected" && (
            <span className="frame-counter">
              FPS: {currentFps} | 프레임: {npuFrameCountRef.current}
            </span>
          )}

          <button
            className="refresh-btn"
            onClick={handleRefresh}
            disabled={loading}
          >
            {loading ? "처리 중..." : "재연결"}
          </button>
        </div>
      </div>

      {wsError && (
        <div className="ws-error-banner">
          ⚠️ {wsError} &nbsp;—&nbsp; 자동 재연결 중...
        </div>
      )}

      <div className="dashboard-main">
        <div className="dashboard-left">
          <div className="detection-section">
            <h2>
              탐지 결과
              {wsStatus === "connected" && (
                <span className="live-badge">● LIVE</span>
              )}
            </h2>
            <DetectionViewer
              imageData={detectionData.imageData || null}
              detections={detectionData.detections}
              imageWidth={detectionData.width}
              imageHeight={detectionData.height}
            />
          </div>
        </div>

        <div className="dashboard-right">
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
                <span className="value">{detectionData.source || "-"}</span>
              </div>
              <div className="summary-card">
                <span className="label">업데이트</span>
                <span className="value">
                  {detectionData.createdAt instanceof Date &&
                  !isNaN(detectionData.createdAt)
                    ? detectionData.createdAt.toLocaleTimeString("ko-KR")
                    : "-"}
                </span>
              </div>
            </div>
          </div>

          <div className="list-section">
            <h2>탐지 피드</h2>
            {isWaiting ? (
              <div className="api-waiting">
                <p>
                  {wsStatus === "connecting"
                    ? "⏳ WebSocket 연결 중..."
                    : wsStatus === "connected"
                    ? "📡 프레임 수신 대기 중..."
                    : "🔌 백엔드와 연동 대기 중..."}
                </p>
                <small>
                  {wsStatus === "connected"
                    ? "NPU에서 프레임이 도착하면 자동으로 표시됩니다."
                    : "백엔드 WebSocket 서버에 연결 중입니다."}
                </small>
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
