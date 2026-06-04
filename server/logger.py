"""
logger.py  –  US-12: 안정적인 장기간 운영 (E5 – 시스템 인프라)

Acceptance Criteria:
  1. 장기간 실행 시 오류 없이 동작
  2. 기본적인 로그 기록

구현 내용:
  - 날짜별 로그 파일 자동 로테이션 (TimedRotatingFileHandler)
  - 로그 레벨: DEBUG / INFO / WARNING / ERROR / CRITICAL
  - 최대 30일치 로그 보관 후 자동 삭제
  - 예외 발생 시 재기동 없이 계속 동작하도록 uncaught exception 핸들러 등록
  - 시작/종료 이벤트, 프레임 수신, 클라이언트 연결/해제 기록
"""

import logging
import logging.handlers
import os
import sys
import traceback
from datetime import datetime
from pathlib import Path


# ───────────────────────────────────────────────────────────
# 설정
# ───────────────────────────────────────────────────────────
LOG_DIR        = Path(__file__).parent / "logs"
LOG_FILENAME   = "droneguard.log"
LOG_LEVEL      = logging.DEBUG          # 운영 시 INFO로 변경 가능
BACKUP_COUNT   = 30                     # 30일치 보관
ROTATION_WHEN  = "midnight"             # 매일 자정 로테이션
LOG_ENCODING   = "utf-8"

# 포맷: [시각] [레벨] [모듈:라인] 메시지
LOG_FORMAT     = "[%(asctime)s] [%(levelname)-8s] [%(name)s:%(lineno)d] %(message)s"
DATE_FORMAT    = "%Y-%m-%d %H:%M:%S"


# ───────────────────────────────────────────────────────────
# 초기화
# ───────────────────────────────────────────────────────────

def _create_log_dir() -> None:
    """로그 디렉터리가 없으면 생성한다."""
    LOG_DIR.mkdir(parents=True, exist_ok=True)


def setup_logging() -> logging.Logger:
    """
    루트 로거를 구성한다. 앱 시작 시 1회 호출.

    Returns:
        logging.Logger: 'droneguard' 네임 로거
    """
    _create_log_dir()

    formatter = logging.Formatter(LOG_FORMAT, datefmt=DATE_FORMAT)

    # ── 파일 핸들러: 날짜별 로테이션 (US-12 AC-2) ──────────
    file_handler = logging.handlers.TimedRotatingFileHandler(
        filename=str(LOG_DIR / LOG_FILENAME),
        when=ROTATION_WHEN,
        backupCount=BACKUP_COUNT,
        encoding=LOG_ENCODING,
        utc=False,
    )
    file_handler.setFormatter(formatter)
    file_handler.setLevel(LOG_LEVEL)

    # ── 콘솔 핸들러: 실시간 확인용 ──────────────────────────
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    console_handler.setLevel(logging.INFO)  # 콘솔은 INFO 이상만

    # ── 루트 로거 설정 ───────────────────────────────────────
    root_logger = logging.getLogger()
    root_logger.setLevel(LOG_LEVEL)

    # 중복 핸들러 방지
    if not root_logger.handlers:
        root_logger.addHandler(file_handler)
        root_logger.addHandler(console_handler)

    # ── 앱 전용 로거 ─────────────────────────────────────────
    logger = logging.getLogger("droneguard")

    # ── Uncaught exception 핸들러: 서버 다운 방지 (US-12 AC-1) ──
    _register_exception_handler(logger)

    logger.info("=" * 60)
    logger.info("DroneGuard Edge start - %s", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    logger.info("로그 파일: %s", LOG_DIR / LOG_FILENAME)
    logger.info("=" * 60)

    return logger


def get_logger(name: str = "droneguard") -> logging.Logger:
    """
    모듈별 로거를 반환한다.

    Args:
        name: 로거 이름 (예: "droneguard.server", "droneguard.ingest")

    Returns:
        logging.Logger
    """
    return logging.getLogger(name)


# ───────────────────────────────────────────────────────────
# 특화 로그 헬퍼 함수
# ───────────────────────────────────────────────────────────

def log_server_start(logger: logging.Logger, host: str, port: int) -> None:
    """서버 기동 이벤트를 기록한다."""
    logger.info("[STARTUP] server start - host=%s port=%d", host, port)


def log_server_stop(logger: logging.Logger) -> None:
    """서버 종료 이벤트를 기록한다."""
    logger.info("[SHUTDOWN] 서버 정상 종료")


def log_frame_received(
    logger: logging.Logger,
    frame_seq: int,
    client_id: str,
    detection_count: int,
    fps: float | None = None,
) -> None:
    """
    NPU로부터 프레임 수신 이벤트를 기록한다.
    매 프레임마다 DEBUG로 기록 (운영 부하 최소화).
    """
    fps_str = f" fps={fps:.1f}" if fps is not None else ""
    logger.debug(
        "[FRAME] seq=%d client=%s detections=%d%s",
        frame_seq, client_id, detection_count, fps_str,
    )


def log_client_connect(logger: logging.Logger, addr: str, role: str = "subscriber") -> None:
    """웹 클라이언트 접속 이벤트를 기록한다."""
    logger.info("[CONNECT] %s addr=%s", role.upper(), addr)


def log_client_disconnect(logger: logging.Logger, addr: str, role: str = "subscriber") -> None:
    """웹 클라이언트 해제 이벤트를 기록한다."""
    logger.info("[DISCONNECT] %s addr=%s", role.upper(), addr)


def log_danger_detected(
    logger: logging.Logger,
    level: str,
    reason: str,
    drone_count: int,
    confidence: float,
) -> None:
    """
    위험 상황 자동 판단 결과를 기록한다. (US-05 연동)
    HIGH는 WARNING, 나머지는 INFO.
    """
    msg = "[DANGER] level=%s count=%d conf=%.2f reason=%s"
    if level == "HIGH":
        logger.warning(msg, level, drone_count, confidence, reason)
    else:
        logger.info(msg, level, drone_count, confidence, reason)


def log_alert_sent(logger: logging.Logger, alert_level: str, alert_id: str) -> None:
    """알림 발송 이벤트를 기록한다. (US-06/07 연동)"""
    logger.info("[ALERT] level=%s id=%s", alert_level, alert_id)


def log_alert_dedup(logger: logging.Logger, level: str, cooldown_ms: int) -> None:
    """중복 알림이 차단됐을 때 기록한다. (US-08 연동)"""
    logger.debug("[ALERT_DEDUP] level=%s cooldown=%dms", level, cooldown_ms)


def log_parse_error(logger: logging.Logger, error: Exception) -> None:
    """프레임 파싱 에러를 기록한다. 서버는 계속 실행된다 (US-12 AC-1)."""
    logger.warning("[PARSE_ERROR] %s", error)


def log_exception(logger: logging.Logger, context: str = "") -> None:
    """
    현재 예외 스택 트레이스 전체를 ERROR로 기록한다.
    try-except 블록의 except 절에서 호출한다.
    """
    logger.error("[EXCEPTION] context=%s\n%s", context, traceback.format_exc())


# ───────────────────────────────────────────────────────────
# Uncaught exception 핸들러 (US-12 AC-1: 오류 없이 동작)
# ───────────────────────────────────────────────────────────

def _register_exception_handler(logger: logging.Logger) -> None:
    """
    처리되지 않은 예외가 발생해도 서버가 다운되지 않도록
    sys.excepthook을 재정의한다.
    asyncio 코루틴 내 예외는 FastAPI/uvicorn이 처리하므로
    동기 코드의 비정상 종료만 여기서 잡는다.
    """
    def _handle_exception(exc_type, exc_value, exc_tb):
        if issubclass(exc_type, KeyboardInterrupt):
            # Ctrl+C는 정상 종료로 처리
            sys.__excepthook__(exc_type, exc_value, exc_tb)
            return
        logger.critical(
            "[UNCAUGHT] unhandled exception - server continues running.\n%s",
            "".join(traceback.format_exception(exc_type, exc_value, exc_tb)),
        )

    sys.excepthook = _handle_exception
