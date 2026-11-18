// Shared admin vocabulary.
import { SELECTION } from "@aihot/industry/selection";

export const KIND_LABEL: Record<string, string> = {
  rss: "RSS",
  web_list: "웹 크롤러(목록)",
  json_list: "JSON API",
  x_search: "X(트위터)",
  mp_account: "메신저/소셜 채널",
  external: "외부 센서/인입",
};

export const MODE_LABEL: Record<string, string> = {
  editorial: "선별 큐레이션",
  hot_signal: "정세 위기 신호",
  isolated: "단독 수집(비공개)",
};

export const HEALTH_LABEL: Record<string, string> = {
  ok: "정상",
  degraded: "지연/불안정",
  failing: "수집 실패",
  paused: "일시 정지",
  unknown: "미확인",
};

export const VISIBILITY_LABEL: Record<string, string> = {
  public: "공개",
  "summary-only": "요약 전용",
  withdrawn: "게시 철회",
};

export const FEEDBACK_STATUS: Record<string, string> = {
  new: "신규 제보",
  triaged: "처리중",
  replied: "회신 완료",
  resolved: "조치 완료",
  spam: "스팸",
};

export const FEEDBACK_KIND: Record<string, string> = {
  bug: "시스템 오류",
  suggestion: "기능 제안",
  question: "문의",
  other: "기타",
};

export const TIER_LABEL: Record<string, string> = {
  T1: "T1 (1차 공식 당국)",
  T1_5: "T1.5 (전문 싱크탱크/외신)",
  T2: "T2 (일반 언론)",
  EXCLUDE_MP: "소셜 채널 제외",
};

/** The industry pack's source classes, each with the threshold floor it sets. */
export const SELECTION_CLASS_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(SELECTION.classes).map(([k, c]) => [k, `${c.label} (기준 점수 ≥ ${c.threshold}점)`]),
);
