// Model per capability: the code default (the site's choice in site/models.ts, else `default`, the deployment's
// own model), an environment override, and an admin switch kept in settings (every switch is audited).
// Read at call time and cached for a minute, so a switch applies to the next call without a restart; a
// changed model only affects work done from then on (history is not re-judged).
import { READER_WORDING } from "@aihot/industry/wording";
import { DEFAULTS } from "@aihot/site/models";
import { sql } from "../db.ts";
import { serverModules } from "../modules.ts";
import { MODELS } from "../providers/llm.ts";

export interface Capability {
  /** The step's name on the admin page, with an explanation in full-width brackets if it needs one; alerts use the name alone. */
  label: string;
  env: string;
  default: string;
  /** Receipt purposes this capability produces (for the admin statistics). */
  purposes: string[];
  /** The step needs a model that reads images. */
  vision?: boolean;
  /** The step has nothing to do on this site, so a service's outage does not stop it. */
  idle?: () => boolean;
}

export const CAPABILITIES = {
  prefilter: { label: "사전 필터（안보 도메인 연관성 1차 판별, 광범위 재현율）", env: "PREFILTER_MODEL", default: DEFAULTS.prefilter ?? "default", purposes: ["prefilter_article"] },
  score: { label: "엄선 채점（2회 독립 정밀 채점, 출처 티어 및 카테고리별 임계값 적용）", env: "SCORE_MODEL", default: DEFAULTS.score ?? "default", purposes: ["score_article"] },
  understand: { label: "심층 정세 요약（엄선 및 준엄선 기사의 제목·결론 우선 3줄 요약·선정 사유）", env: "UNDERSTAND_MODEL", default: DEFAULTS.understand ?? "default", purposes: ["understand_article"] },
  summarize: { label: "일반 제목·요약（기타 기사의 한국어 제목 및 요약 생성）", env: "SUMMARIZE_MODEL", default: DEFAULTS.summarize ?? "default", purposes: ["summarize_article"] },
  wording: { label: "선전 어휘 교정（제목·요약·선정 사유 내 편향/선전 어휘 중립화）", env: "WORDING_MODEL", default: DEFAULTS.wording ?? "default", purposes: ["mend_wording"], idle: () => !READER_WORDING.length },
  structure: { label: "군사 제원·구조 추출（카테고리, 태그, 주요 주체, 사건 팩트 구조화）", env: "STRUCTURE_MODEL", default: DEFAULTS.structure ?? "default", purposes: ["structure_article"] },
  group: { label: "사건 클러스터링（신규 보도와 기존 사건 간 동일 사건·후속 진척·무관 판별）", env: "GROUP_MODEL", default: DEFAULTS.group ?? "default", purposes: ["group_article", "group_signal", "group_story", "group_card"] },
  groupReview: { label: "병합 교차 검증（유사도가 낮은 사건 병합 및 사건 간 통합 시 재검토）", env: "GROUP_REVIEW_MODEL", default: DEFAULTS.groupReview ?? "default", purposes: ["group_review", "group_story_review", "group_card_review"] },
  digest: { label: "사건 종합 브리핑（단일 사건 타임라인 총괄 요약）", env: "DIGEST_MODEL", default: DEFAULTS.digest ?? "default", purposes: ["story_digest"] },
  // Dailies are computed by rule; report_lead and report_daily remain for their older receipts.
  report: { label: "주보·월보 총괄 브리핑（일일 정세 일보는 무모델 규칙 알고리즘으로 조판）", env: "REPORT_MODEL", default: DEFAULTS.report ?? "default", purposes: ["report_weekly", "report_monthly", "report_lead", "report_daily"] },
  translate: { label: "엄선 원문 전체 번역（인용 포스트 포함）", env: "TRANSLATE_MODEL", default: DEFAULTS.translate ?? "default", purposes: ["translate_body", "translate_quoted"] },
  feedback: { label: "독자 피드백 필터링（유효 제보 여부 판별）", env: "FEEDBACK_MODEL", default: DEFAULTS.feedback ?? "default", purposes: ["judge_feedback"] },
} satisfies Record<string, Capability>;

export type CapabilityKey = keyof typeof CAPABILITIES;

/** Every step: the engine's, then the installed modules' (their defaults also from site/models.ts). */
export function capabilities(): Record<string, Capability> {
  const all: Record<string, Capability> = { ...CAPABILITIES };
  for (const m of serverModules()) for (const [key, step] of Object.entries(m.models ?? {})) all[key] = { ...step, default: DEFAULTS[key] ?? "default" };
  return all;
}

/** Names of the active steps currently routed to a service, using the same choices as model calls. */
export async function stepsOnService(service: string, models?: ReadonlySet<string>): Promise<string[]> {
  const current = await modelSources();
  const steps = Object.entries(capabilities())
    .filter(([key, c]) => {
      if (c.idle?.()) return false;
      const primary = current[key]!.model;
      return [primary, fallbackModelFor(key, primary)].some(key => {
        const model = key && MODELS[key];
        return model && model.service === service && (!models || models.has(model.model));
      });
    })
    .map(([, c]) => c.label.split("（")[0]!);
  return [...new Set(steps)];
}

let cache: { at: number; switches: Record<string, string> } | null = null;

/** The name each admin switch holds, registered or not. */
async function switches(): Promise<Record<string, string>> {
  if (cache && Date.now() - cache.at < 60_000) return cache.switches;
  const rows = await sql<{ key: string; value: { model?: string } }[]>`SELECT key, value FROM settings WHERE key LIKE 'models.%'`;
  const map: Record<string, string> = {};
  for (const r of rows) if (r.value?.model) map[r.key.slice("models.".length)] = r.value.model;
  cache = { at: Date.now(), switches: map };
  return map;
}

export function invalidateModelCache() {
  cache = null;
}

/** Whether a registered model explicitly declares image input support. Unspecified means text-only. */
export function modelSupportsVision(model: string): boolean {
  return MODELS[model]?.vision === true;
}

/** Whether a step can use a registered model. A model that reads images writes text as well. */
export function capabilityAcceptsModel(capability: Capability, model: { vision?: boolean }): boolean {
  return !capability.vision || model.vision === true;
}

/** The model a capability uses now: admin switch, else environment, else the code default. */
export async function modelFor(capability: CapabilityKey | (string & {})): Promise<string> {
  const c = capabilities()[capability];
  if (!c) throw new Error(`unknown model step: ${capability}`);
  const held = (await switches())[capability];
  const chosen = held && MODELS[held] ? held : process.env[c.env] ?? c.default;
  return MODELS[chosen] ? chosen : c.default;
}

/** Where the current choice comes from, for the admin page; `invalid` is an unregistered name passed over to reach it. */
export async function modelSources(): Promise<Record<string, { model: string; source: "admin" | "env" | "default"; invalid?: string }>> {
  const held = await switches();
  const out: Record<string, { model: string; source: "admin" | "env" | "default"; invalid?: string }> = {};
  for (const [key, c] of Object.entries(capabilities())) {
    const pick = held[key];
    const env = process.env[c.env];
    if (pick && MODELS[pick]) {
      out[key] = { model: pick, source: "admin" };
      continue;
    }
    const invalid = pick ?? (env && !MODELS[env] ? env : undefined);
    out[key] = { ...(env && MODELS[env] ? { model: env, source: "env" as const } : { model: c.default, source: "default" as const }), ...(invalid ? { invalid } : {}) };
  }
  return out;
}

export function fallbackModelFor(capability: string, primary: string): string | undefined {
  return Object.values(MODELS).find(model => model.fallbackFor?.[capability] === primary && model.service !== MODELS[primary]!.service)?.key;
}

/** Preserve an explicit primary choice; only the site's evaluated pair may fail over. */
export async function modelRoute(capability: CapabilityKey | (string & {})): Promise<{ model: string; fallbackModel?: string }> {
  const model = await modelFor(capability);
  return { model, fallbackModel: fallbackModelFor(capability, model) };
}
