import React from "react";
import "./DetectionViewer.css";

const DetectionViewer = ({
  imageData,
  detections = [],
  imageWidth,
  imageHeight,
}) => {
  const canvasRef = React.useRef(null);
  const containerRef = React.useRef(null);
  const [containerSize, setContainerSize] = React.useState({
    width: 800,
    height: 400,
  });

  React.useEffect(() => {
    // 컨테이너 크기를 감지하는 함수
    const updateContainerSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({
          width: rect.width,
          height: rect.height || 400,
        });
        console.log(`컨테이너 크기 업데이트: ${rect.width}x${rect.height}`);
      }
    };

    updateContainerSize();
    window.addEventListener("resize", updateContainerSize);
    return () => window.removeEventListener("resize", updateContainerSize);
  }, []);

  React.useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const containerWidth = containerSize.width;
    const containerHeight = containerSize.height;

    console.log(
      `캔버스 렌더링 - 컨테이너: ${containerWidth}x${containerHeight}`,
    );

    // 이미지 데이터가 있으면 그리기
    if (imageData) {
      const img = new Image();

      img.onload = () => {
        const originalWidth = imageWidth || img.width;
        const originalHeight = imageHeight || img.height;

        console.log(`원본 이미지 크기: ${originalWidth}x${originalHeight}`);

        // 원본 이미지 비율 유지하면서 컨테이너에 맞춰서 스케일링
        let scaledWidth = containerWidth;
        let scaledHeight = (originalHeight / originalWidth) * containerWidth;

        // 높이가 너무 크면 높이 기준으로 조정
        if (scaledHeight > containerHeight) {
          scaledHeight = containerHeight;
          scaledWidth = (originalWidth / originalHeight) * containerHeight;
        }

        console.log(`스케일된 캔버스 크기: ${scaledWidth}x${scaledHeight}`);

        // Canvas 크기 설정 (실제 픽셀 크기)
        canvas.width = Math.floor(scaledWidth);
        canvas.height = Math.floor(scaledHeight);

        // 스타일로도 크기 설정 (CSS 픽셀)
        canvas.style.width = `${scaledWidth}px`;
        canvas.style.height = `${scaledHeight}px`;

        // 이미지 그리기 (스케일된 크기로)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // 스케일 비율 계산 (원본 대비)
        const scaleX = canvas.width / originalWidth;
        const scaleY = canvas.height / originalHeight;

        console.log(
          `스케일 비율: X=${scaleX.toFixed(2)}, Y=${scaleY.toFixed(2)}`,
        );

        // DTO의 detections 배열 기반으로 Bounding Box 그리기 (스케일 적용)
        detections.forEach((detection) => {
          if (!detection.bbox) return;

          const { bbox, confidence, riskLevel, class: className } = detection;

          // 스케일된 좌표
          const scaledX1 = bbox.x1 * scaleX;
          const scaledY1 = bbox.y1 * scaleY;
          const scaledX2 = bbox.x2 * scaleX;
          const scaledY2 = bbox.y2 * scaleY;
          const scaledBoxWidth = scaledX2 - scaledX1;
          const scaledBoxHeight = scaledY2 - scaledY1;

          // Bounding box 그리기
          ctx.strokeStyle = riskLevel.color;
          ctx.lineWidth = 2;
          ctx.strokeRect(scaledX1, scaledY1, scaledBoxWidth, scaledBoxHeight);

          // 라벨 배경
          ctx.fillStyle = riskLevel.color;
          const confidencePercent = (confidence * 100).toFixed(1);
          const labelText = `${className} ${confidencePercent}% [${riskLevel.label}]`;
          const textMetrics = ctx.measureText(labelText);
          const labelPadding = 6;
          const labelHeight = 20;

          ctx.fillRect(
            scaledX1,
            Math.max(0, scaledY1 - labelHeight - 2),
            textMetrics.width + labelPadding * 2,
            labelHeight,
          );

          // 라벨 텍스트
          ctx.fillStyle = "white";
          ctx.font = "bold 11px Arial";
          ctx.fillText(
            labelText,
            scaledX1 + labelPadding,
            Math.max(14, scaledY1 - 4),
          );

          // 좌표 정보 (왼쪽 아래)
          ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
          ctx.font = "9px Arial";
          const coordText = `(${bbox.x1},${bbox.y1})-(${bbox.x2},${bbox.y2})`;
          const coordMetrics = ctx.measureText(coordText);
          ctx.fillRect(scaledX1, scaledY2 + 2, coordMetrics.width + 4, 12);
          ctx.fillStyle = "#00FF00";
          ctx.fillText(coordText, scaledX1 + 2, scaledY2 + 11);
        });
      };

      img.onerror = () => {
        console.error("이미지 로드 실패");
      };

      img.src = imageData;
    } else {
      // 이미지 없을 때 캔버스 초기화
      canvas.width = containerWidth;
      canvas.height = containerHeight;
      canvas.style.width = `${containerWidth}px`;
      canvas.style.height = `${containerHeight}px`;
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#666";
      ctx.font = "16px Arial";
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
