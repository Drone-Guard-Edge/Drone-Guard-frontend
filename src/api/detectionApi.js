import { apiGet, apiPost } from "./index";

// 실시간 드론 탐지 데이터 조회
export const getDetectionDataApi = async () => {
  try {
    const response = await apiGet("/api/detections/latest");
    if (response.result === "ok") {
      return {
        success: true,
        data: response.data,
      };
    } else {
      return {
        success: false,
        message: "탐지 데이터 조회에 실패했습니다.",
      };
    }
  } catch (error) {
    console.error("탐지 데이터 조회 오류:", error);
    return {
      success: false,
      message: "탐지 데이터 조회 중 오류가 발생했습니다.",
    };
  }
};

// 특정 이미지 ID로 탐지 데이터 조회
export const getDetectionByIdApi = async (imageId) => {
  try {
    const response = await apiGet(`/api/detections/${imageId}`);
    if (response.result === "ok") {
      return {
        success: true,
        data: response.data,
      };
    } else {
      return {
        success: false,
        message: "탐지 데이터 조회에 실패했습니다.",
      };
    }
  } catch (error) {
    console.error("탐지 데이터 조회 오류:", error);
    return {
      success: false,
      message: "탐지 데이터 조회 중 오류가 발생했습니다.",
    };
  }
};

// 탐지 이력 조회 (페이지네이션)
export const getDetectionHistoryApi = async (page = 1, limit = 10) => {
  try {
    const response = await apiGet(
      `/api/detections?page=${page}&limit=${limit}`,
    );
    if (response.result === "ok") {
      return {
        success: true,
        data: response.data,
      };
    } else {
      return {
        success: false,
        message: "탐지 이력 조회에 실패했습니다.",
      };
    }
  } catch (error) {
    console.error("탐지 이력 조회 오류:", error);
    return {
      success: false,
      message: "탐지 이력 조회 중 오류가 발생했습니다.",
    };
  }
};

// 위험도 레벨 분석
export const analyzeRiskLevelApi = async (detectionData) => {
  try {
    const response = await apiPost(
      "/api/detections/risk-analysis",
      detectionData,
    );
    if (response.result === "ok") {
      return {
        success: true,
        data: response.data,
      };
    } else {
      return {
        success: false,
        message: "위험도 분석에 실패했습니다.",
      };
    }
  } catch (error) {
    console.error("위험도 분석 오류:", error);
    return {
      success: false,
      message: "위험도 분석 중 오류가 발생했습니다.",
    };
  }
};
