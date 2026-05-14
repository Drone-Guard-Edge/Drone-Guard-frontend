// API 기본 설정
const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

// API 요청 함수들
export const apiGet = async (endpoint, options = {}) => {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });
    return await response.json();
  } catch (error) {
    console.error("GET 요청 실패:", error);
    throw error;
  }
};

export const apiPost = async (endpoint, data, options = {}) => {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      body: JSON.stringify(data),
      ...options,
    });
    return await response.json();
  } catch (error) {
    console.error("POST 요청 실패:", error);
    throw error;
  }
};

export const apiPut = async (endpoint, data, options = {}) => {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      body: JSON.stringify(data),
      ...options,
    });
    return await response.json();
  } catch (error) {
    console.error("PUT 요청 실패:", error);
    throw error;
  }
};

export const apiDelete = async (endpoint, options = {}) => {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });
    return await response.json();
  } catch (error) {
    console.error("DELETE 요청 실패:", error);
    throw error;
  }
};
