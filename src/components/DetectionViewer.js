import React from "react";
import "./DetectionViewer.css";

const DetectionViewer = ({
  imageUrl,
  detections = [],
  imageWidth,
  imageHeight,
}) => {
  const containerRef = React.useRef(null);
  const canvasRef = React.useRef(null);

  React.useEffect(() => {
    if (!canvasRef.current || !imageUrl) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = imageWidth || img.width;
      canvas.height = imageHeight || img.height;

      // 이미지 그리기
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // 탐지된 객체 bounding box 그리기
      detections.forEach((detection) => {
        const { bbox, confidence, riskLevel } = detection;

        // Bounding box 그리기
        ctx.strokeStyle = riskLevel.color;
        ctx.lineWidth = 3;
        ctx.strokeRect(bbox.x1, bbox.y1, bbox.width, bbox.height);

        // 라벨 배경
        ctx.fillStyle = riskLevel.color;
        const labelText = `${detection.class} ${(confidence * 100).toFixed(1)}%`;
        const textMetrics = ctx.measureText(labelText);
        const labelPadding = 5;

        ctx.fillRect(
          bbox.x1,
          bbox.y1 - 25,
          textMetrics.width + labelPadding * 2,
          25,
        );

        // 라벨 텍스트
        ctx.fillStyle = "white";
        ctx.font = "bold 12px Arial";
        ctx.fillText(labelText, bbox.x1 + labelPadding, bbox.y1 - 8);
      });
    };

    img.src = imageUrl;
  }, [imageUrl, detections, imageWidth, imageHeight]);

  return (
    <div ref={containerRef} className="detection-viewer">
      <canvas
        ref={canvasRef}
        className="detection-canvas"
        alt="Detection Result"
      />
    </div>
  );
};

export default DetectionViewer;
