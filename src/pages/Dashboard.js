import React, { useState, useEffect, useCallback, useRef } from "react";
import DetectionViewer from "../components/DetectionViewer";
import DetectionList from "../components/DetectionList";
import { wsClient } from "../api/wsClient";
import {
  formatDetectionData,
} from "../utils/riskCalculator";
import { DetectionTracker } from "../utils/detectionTracker";
import "./Dashboard.css";

import AlertPanel from "../components/AlertPanel";
import { evaluateDanger, isDangerTransition, buildDangerMessage } from "../utils/dangerDetector";
import { alertManager } from "../utils/alertManager";

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
  const trackerRef = useRef(new DetectionTracker());

  // US-05: 현재 위험 판단 결과
  const [dangerInfo, setDangerInfo] = useState({
    level: "SAFE", color: "#10B981", label: "안전",
    isDanger: false, reason: "", triggerCount: 0, maxConfidence: 0,
  });
  // 이전 위험 레벨 추적 (US-08 상태 변화 감지용)
  const prevDangerLevelRef = useRef("SAFE");

  // US-07/08: 알림 목록
  const [alerts, setAlerts] = useState([]);

  // AlertManager 리스너 등록 (마운트 1회)
  useEffect(() => {
    alertManager.onAlertsChange = setAlerts;
    return () => {
      alertManager.onAlertsChange = null;
      alertManager.dismissAll();
    };
  }, []);

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
      // Tracker를 통해 탐지 결과 스무딩(EMA) 및 프레임 유지(Patience) 적용
      formatted.detections = trackerRef.current.update(formatted.detections);
      setDetectionData(formatted);

      const danger = evaluateDanger(formatted.detections);
      setDangerInfo(danger);
      
      // ── US-05 AC-2 / US-07 AC-3: 위험 전환 시 즉시 알림 ──
      if (isDangerTransition(prevDangerLevelRef.current, danger.level)) {
        const msg = buildDangerMessage(danger);
        if (msg) console.warn("[US-05]", msg); // 콘솔에도 경고 기록
      }
      prevDangerLevelRef.current = danger.level;
      
      // ── US-07 / US-08: 알림 매니저에 전달 (중복 방지 내장) ─
      alertManager.push(danger);
      
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
        trackerRef.current.reset(); // NPU 끊김 시 트래커 리셋
        setDetectionData(makeEmptyFrame()); // 이미지 및 모든 탐지 결과 완전히 초기화
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
    trackerRef.current.reset();
    setDetectionData(makeEmptyFrame());
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
        {/* 좌측: 알림 패널 */}
        <div className="dashboard-alerts">
          <AlertPanel
            alerts={alerts}
            onDismiss={(id) => alertManager.dismiss(id)}
            onDismissAll={() => alertManager.dismissAll()}
          />
        </div>

        {/* 중앙: 탐지 뷰어 */}
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

        {/* 우측: 요약 + 탐지 피드 */}
        <div className="dashboard-right">
          <div className="summary-section">
            <div className="summary-grid">
              <div className="summary-card">
                <span className="label">현재 위험도</span>
                <span className="value" style={{ color: dangerInfo.color }}>
                  {dangerInfo.label}
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
