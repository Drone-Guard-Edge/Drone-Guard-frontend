import React from "react";
import "./DetectionViewer.css";

/** 트레일 보관 최대 포인트 수 (많을수록 긴 선) */
const TRAIL_MAX_POINTS = 120;

/** bbox 중심점 계산 (스케일 적용) */
const bboxCenter = (bbox, scaleX, scaleY) => ({
  x: ((bbox.x1 + bbox.x2) / 2) * scaleX,
  y: ((bbox.y1 + bbox.y2) / 2) * scaleY,
});

/** 위험도 색상 (riskLevel.color 또는 confidence 기반) */
const trackColor = (detection) => {
  if (detection.riskLevel?.color) return detection.riskLevel.color;
  const c = detection.confidence ?? 0;
  if (c >= 0.85) return "#EF4444";
  if (c >= 0.65) return "#F59E0B";
  return "#3B82F6";
};

/** hex 색상을 r,g,b 숫자로 분해 */
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 255, g: 255, b: 255 };
};

/**
 * 드론 추적선을 캔버스에 그린다.
 * 경로 전체가 선명하게 남는 레이더 스타일 solid line.
 */
const drawTrail = (ctx, points, color) => {
  if (points.length < 2) return;

  const { r, g, b } = hexToRgb(color);

  // 1. 외곽선 (대비용 검정 outline) — 배경 이미지와 구분을 위해
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth   = 3.5;
  ctx.lineCap     = "round";
  ctx.lineJoin    = "round";
  ctx.stroke();

  // 2. 메인 추적선 — 완전 불투명 solid
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.strokeStyle = `rgb(${r},${g},${b})`;
  ctx.lineWidth   = 1.8;
  ctx.lineCap     = "round";
  ctx.lineJoin    = "round";
  ctx.stroke();

  // 3. 현재 위치 마커 (끝점 강조 원)
  const tip = points[points.length - 1];
  ctx.beginPath();
  ctx.arc(tip.x, tip.y, 4, 0, Math.PI * 2);
  ctx.fillStyle   = `rgb(${r},${g},${b})`;
  ctx.shadowColor = `rgba(${r},${g},${b},0.8)`;
  ctx.shadowBlur  = 8;
  ctx.fill();
  ctx.shadowBlur  = 0;

  // 4. 시작점 작은 원 (경로 시작 표시)
  const start = points[0];
  ctx.beginPath();
  ctx.arc(start.x, start.y, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${r},${g},${b},0.5)`;
  ctx.fill();
};

const DetectionViewer = ({
  imageData,
  detections = [],
  imageWidth,
  imageHeight,
}) => {
  const canvasRef      = React.useRef(null);
  const containerRef   = React.useRef(null);
  const trailMapRef    = React.useRef(new Map()); // trackId → [{x,y}, ...]

  const [containerSize, setContainerSize] = React.useState({
    width: 800,
    height: 400,
  });

  // 컨테이너 크기 감지
  React.useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height || 400 });
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // 탐지 결과가 없어지면 trail 초기화
  React.useEffect(() => {
    if (detections.length === 0) {
      trailMapRef.current.clear();
    }
  }, [detections.length]);

  // 렌더링
  React.useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");

    const containerWidth  = containerSize.width;
    const containerHeight = containerSize.height;

    const render = (scaleX, scaleY) => {
      // ── 1. trail 업데이트 ──────────────────────────────────
      const activeIds = new Set();

      detections.forEach((det) => {
        if (!det.bbox) return;
        const id = det.id ?? `${det.class}_${Math.round(det.bbox.x1)}`;
        activeIds.add(id);

        const center = bboxCenter(det.bbox, scaleX, scaleY);

        if (!trailMapRef.current.has(id)) {
          trailMapRef.current.set(id, []);
        }
        const pts = trailMapRef.current.get(id);
        pts.push(center);
        if (pts.length > TRAIL_MAX_POINTS) pts.shift();
      });

      // 화면에서 사라진 트랙은 trail 제거
      for (const id of trailMapRef.current.keys()) {
        if (!activeIds.has(id)) {
          trailMapRef.current.delete(id);
        }
      }

      // ── 2. trail 그리기 ────────────────────────────────────
      detections.forEach((det) => {
        if (!det.bbox) return;
        const id = det.id ?? `${det.class}_${Math.round(det.bbox.x1)}`;
        const pts = trailMapRef.current.get(id);
        if (pts && pts.length >= 2) {
          drawTrail(ctx, pts, trackColor(det));
        }
      });

      // ── 3. Bounding Box 그리기 ────────────────────────────
      detections.forEach((det) => {
        if (!det.bbox) return;
        const { bbox, confidence, riskLevel, class: className } = det;

        const sx1 = bbox.x1 * scaleX;
        const sy1 = bbox.y1 * scaleY;
        const sw  = (bbox.x2 - bbox.x1) * scaleX;
        const sh  = (bbox.y2 - bbox.y1) * scaleY;

        const color = riskLevel?.color ?? trackColor(det);

        // 박스
        ctx.strokeStyle = color;
        ctx.lineWidth   = 2;
        ctx.strokeRect(sx1, sy1, sw, sh);

        // 라벨 배경
        ctx.fillStyle = color;
        const confidencePercent = ((confidence ?? 0) * 100).toFixed(1);
        const labelText  = `${className} ${confidencePercent}%`;
        const metrics    = ctx.measureText(labelText);
        const pad        = 6;
        const labelH     = 20;
        ctx.fillRect(sx1, Math.max(0, sy1 - labelH - 2), metrics.width + pad * 2, labelH);

        // 라벨 텍스트
        ctx.fillStyle = "white";
        ctx.font      = "bold 11px Arial";
        ctx.fillText(labelText, sx1 + pad, Math.max(14, sy1 - 4));
      });
    };

    if (imageData) {
      const img = new Image();

      img.onload = () => {
        const origW = imageWidth  || img.width;
        const origH = imageHeight || img.height;

        let scaledW = containerWidth;
        let scaledH = (origH / origW) * containerWidth;

        if (scaledH > containerHeight) {
          scaledH = containerHeight;
          scaledW = (origW / origH) * containerHeight;
        }

        canvas.width        = Math.floor(scaledW);
        canvas.height       = Math.floor(scaledH);
        canvas.style.width  = `${scaledW}px`;
        canvas.style.height = `${scaledH}px`;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const scaleX = canvas.width  / origW;
        const scaleY = canvas.height / origH;

        render(scaleX, scaleY);
      };

      img.onerror = () => console.error("이미지 로드 실패");
      img.src = imageData;
    } else {
      canvas.width        = containerWidth;
      canvas.height       = containerHeight;
      canvas.style.width  = `${containerWidth}px`;
      canvas.style.height = `${containerHeight}px`;

      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#666";
      ctx.font      = "16px Arial";
      ctx.textAlign = "center";
      ctx.fillText("이미지 대기 중...", canvas.width / 2, canvas.height / 2);
    }
  }, [imageData, detections, imageWidth, imageHeight, containerSize]);

  return (
    <div ref={containerRef} className="detection-viewer">
      <canvas ref={canvasRef} className="detection-canvas" />
    </div>
  );
};

export default DetectionViewer;
