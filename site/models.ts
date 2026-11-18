// 시스템에서 사용할 LLM 모델 설정.
// 기본값은 `default`로 환경변수 LLM_BASE_URL / LLM_API_KEY / LLM_MODEL 설정을 따릅니다.
// 폐쇄망(에어갭) 환경에서는 내부 SGLang(Qwen 3.8 27B FP8) 로컬 서빙 엔드포인트를 기본 연동합니다.

import type { ModelPreset } from "@aihot/contracts/site-config";
export type { ModelPreset } from "@aihot/contracts/site-config";

/** 사전 정의 모델 프리셋 */
export const PRESETS: Record<string, ModelPreset> = {
  // Google Gemini & Gemma 멀티 모델 풀 (OpenAI 호환 엔드포인트)
  "gemini-3.1-flash-lite": {
    service: "llm",
    model: "gemini-3.1-flash-lite",
    baseUrlEnv: "LLM_BASE_URL",
    apiKeyEnv: "LLM_API_KEY",
    jsonMode: true,
    vision: true,
  },
  "gemini-3.1-flash-lite-preview": {
    service: "llm",
    model: "gemini-3.1-flash-lite-preview",
    baseUrlEnv: "LLM_BASE_URL",
    apiKeyEnv: "LLM_API_KEY",
    jsonMode: true,
    vision: true,
  },
  "gemini-flash-lite-latest": {
    service: "llm",
    model: "gemini-flash-lite-latest",
    baseUrlEnv: "LLM_BASE_URL",
    apiKeyEnv: "LLM_API_KEY",
    jsonMode: true,
    vision: true,
  },
  "gemini-3-flash-preview": {
    service: "llm",
    model: "gemini-3-flash-preview",
    baseUrlEnv: "LLM_BASE_URL",
    apiKeyEnv: "LLM_API_KEY",
    jsonMode: true,
    vision: true,
    reasoningTokens: 4000,
  },
  "gemma-4-31b-it": {
    service: "llm",
    model: "gemma-4-31b-it",
    baseUrlEnv: "LLM_BASE_URL",
    apiKeyEnv: "LLM_API_KEY",
    jsonMode: true,
  },
  "gemma-4-26b-a4b-it": {
    service: "llm",
    model: "gemma-4-26b-a4b-it",
    baseUrlEnv: "LLM_BASE_URL",
    apiKeyEnv: "LLM_API_KEY",
    jsonMode: true,
    reasoningTokens: 4000,
  },
  "gemini-3.5-flash-lite": {
    service: "llm",
    model: "gemini-3.5-flash-lite",
    baseUrlEnv: "LLM_BASE_URL",
    apiKeyEnv: "LLM_API_KEY",
    jsonMode: true,
    vision: true,
  },
  "gemini-3.5-flash": {
    service: "llm",
    model: "gemini-3.5-flash",
    baseUrlEnv: "LLM_BASE_URL",
    apiKeyEnv: "LLM_API_KEY",
    jsonMode: true,
    vision: true,
  },
  // 폐쇄망 환경 로컬 SGLang 서빙 (Qwen 3.8 27B FP8, OpenAI 호환 엔드포인트)
  "sglang-qwen-27b": {
    service: "openai",
    model: "Qwen/Qwen3.8-27B-Instruct-FP8",
    baseUrlEnv: "SGLANG_BASE_URL",
    apiKeyEnv: "SGLANG_API_KEY",
    jsonMode: true,
  },
  "glm-5.3-flash": {
    service: "zhipu", model: "glm-5.3-flash", baseUrlEnv: "ZHIPU_BASE_URL", apiKeyEnv: "ZHIPU_API_KEY",
    extra: { thinking: { type: "enabled" }, reasoning_effort: "low" }, jsonMode: true, vision: true,
  },
  "glm-5.3-flash-selection": {
    service: "zhipu", model: "glm-5.3-flash", baseUrlEnv: "ZHIPU_BASE_URL", apiKeyEnv: "ZHIPU_API_KEY",
    extra: { thinking: { type: "enabled", clear_thinking: false }, reasoning_effort: "high", top_p: 0.95 }, jsonMode: true, vision: true,
    scoreCall: { temperature: 1, maxTokens: 65_536, timeoutMs: 180_000 },
  },
  "deepseek-flash": {
    service: "deepseek", model: "deepseek-flash", baseUrlEnv: "DEEPSEEK_BASE_URL", apiKeyEnv: "DEEPSEEK_API_KEY",
    extra: { thinking: { type: "disabled" } }, jsonMode: true,
  },
  "deepseek-flash-think": {
    service: "deepseek", model: "deepseek-flash", baseUrlEnv: "DEEPSEEK_BASE_URL", apiKeyEnv: "DEEPSEEK_API_KEY", reasoningTokens: 4000, jsonMode: true,
  },
  "qwen3.7-flash": {
    service: "dashscope", model: "qwen3.7-flash", baseUrlEnv: "DASHSCOPE_BASE_URL", apiKeyEnv: "DASHSCOPE_API_KEY",
    extra: { enable_thinking: false }, jsonMode: true,
  },
  "qwen3.8-flash": {
    service: "dashscope", model: "qwen3.8-flash", baseUrlEnv: "DASHSCOPE_BASE_URL", apiKeyEnv: "DASHSCOPE_API_KEY",
    extra: { enable_thinking: false }, jsonMode: true,
  },
  "mimo-v2.6-flash": {
    service: "mimo", model: "mimo-v2.6-flash", baseUrlEnv: "XIAOMI_MIMO_BASE_URL", apiKeyEnv: "XIAOMI_MIMO_API_KEY",
    extra: { thinking: { type: "disabled" } }, jsonMode: true,
  },
  "qwen3-vl-flash": {
    service: "dashscope", model: "qwen3-vl-flash", baseUrlEnv: "DASHSCOPE_BASE_URL", apiKeyEnv: "DASHSCOPE_API_KEY",
    extra: { enable_thinking: false }, jsonMode: false, vision: true,
  },
};

/**
 * 각 파이프라인 단계별 기본 모델 (관리자 '모델 및 평가' 화면 연동).
 * Google AI Studio에서 실제 응답이 확인된 6개 독립 쿼터 모델로 단계별 부하를 분산하고,
 * 429/500/502/503 발생 시 llm.ts의 멀티 모델 풀 자동 순환으로 처리량을 극대화합니다:
 * - prefilter / score: gemma-4-26b-a4b-it (30 RPM / 1,500 RPD 풀, 사전 필터 및 2회 엄선 채점)
 * - structure: gemini-3.1-flash-lite (독립 버킷, 군사/안보 제원 및 카테고리 구조화)
 * - understand / feedback: gemini-3.5-flash-lite (독립 버킷, 심층 정세 요약 및 피드백)
 * - summarize / wording / translate: gemini-flash-lite-latest (독립 버킷, 일반 요약·정제·번역)
 * - group / groupReview / digest: gemini-3.1-flash-lite-preview (독립 버킷, 사건 클러스터링·타임라인 요약)
 * - report: gemini-3-flash-preview (주보/월보 종합 정세 브리핑)
 * (오버플로우 예비 풀: gemma-4-31b-it 및 위 가용 모델 상호 순환)
 */
export const DEFAULTS: Record<string, string> = {
  prefilter: "gemma-4-26b-a4b-it",
  score: "gemma-4-26b-a4b-it",
  structure: "gemini-3.1-flash-lite",
  understand: "gemini-3.5-flash-lite",
  summarize: "gemini-flash-lite-latest",
  wording: "gemini-flash-lite-latest",
  group: "gemini-3.1-flash-lite-preview",
  groupReview: "gemini-3.1-flash-lite-preview",
  digest: "gemini-3.1-flash-lite-preview",
  translate: "gemini-flash-lite-latest",
  report: "gemini-3-flash-preview",
  feedback: "gemini-3.5-flash-lite",
};
