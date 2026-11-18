// Operator settings: about-page QR codes (replaced without a release), notification targets
// (switching a group on records enabled_at so older content is never back-filled) and per-service
// request budgets (the circuit breaker paid calls check before sending).
import type { AdminBudget, AdminNotifyTarget, AdminSettings, BeforeJson } from "@aihot/contracts/admin";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { config } from "../config.ts";
import { sql } from "../db.ts";
import { sha256 } from "../lib/ids.ts";
import { loadContact, type ContactSettings } from "../site/contact.ts";
import { audit } from "../audit.ts";

const MAX_QR_BYTES = 2 * 1024 * 1024;

export async function replaceContactQr(input: { slot: keyof ContactSettings; data: Buffer }, actor: string) {
  if (input.slot !== "wechatQr" && input.slot !== "feishuQr") throw new Error("unknown slot");
  if (input.data.length > MAX_QR_BYTES) throw new Error("QR코드 이미지는 최대 2MB까지 업로드 가능합니다.");
  const meta = await sharp(input.data).metadata().catch(() => null);
  if (!meta || !["png", "jpeg", "webp"].includes(meta.format ?? "")) throw new Error("PNG, JPG 또는 WebP 형식의 이미지가 필요합니다.");
  if ((meta.width ?? 0) < 120 || (meta.height ?? 0) < 120) throw new Error("이미지 해상도가 너무 작습니다 (최소 120x120px 권장).");
  const ext = meta.format === "jpeg" ? "jpg" : meta.format!;
  const name = `qr-${input.slot === "wechatQr" ? "wechat" : "feishu"}-${sha256(input.data).slice(0, 8)}.${ext}`;
  const dir = path.join(config.dataDir, "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), input.data);
  const before = await loadContact();
  const next = { ...before, [input.slot]: `/contact/${name}` };
  await sql`INSERT INTO settings (key, value, updated_by) VALUES ('contact_qr', ${sql.json(next)}, ${actor})
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`;
  await audit(actor, "settings.contact_qr", "settings:contact_qr", null, { [input.slot]: before[input.slot] }, { [input.slot]: next[input.slot] });
  return next;
}

/** The settings page: contact QR codes, content push targets and paid-service budgets. */
export async function settingsOverview(): Promise<BeforeJson<AdminSettings>> {
  const [contact, targets, budgets] = await Promise.all([loadContact(), listTargets(), listBudgets()]);
  return { contact, targets, budgets };
}

export async function listTargets(): Promise<BeforeJson<AdminNotifyTarget>[]> {
  return sql<BeforeJson<AdminNotifyTarget>[]>`
    SELECT t.key, t.purpose, t.kind, t.enabled, t.enabled_at, t.config_ref, t.note, t.updated_at,
           (SELECT count(*)::int FROM deliveries d WHERE d.target_key = t.key AND d.created_at > now() - interval '7 days') AS deliveries_7d,
           (SELECT max(d.sent_at) FROM deliveries d WHERE d.target_key = t.key) AS last_sent_at
    FROM notify_targets t ORDER BY t.purpose, t.key`;
}

export async function setTargetEnabled(key: string, enabled: boolean, reason: string, actor: string) {
  if (!reason?.trim()) throw new Error("reason is required");
  const [before] = await sql`SELECT enabled, enabled_at FROM notify_targets WHERE key = ${key}`;
  if (!before) return null;
  const [after] = await sql`
    UPDATE notify_targets SET enabled = ${enabled}, enabled_at = CASE WHEN ${enabled} AND NOT enabled THEN now() ELSE enabled_at END, updated_at = now()
    WHERE key = ${key} RETURNING key, enabled, enabled_at`;
  await audit(actor, enabled ? "notify.enable" : "notify.disable", `notify-target:${key}`, reason, before, after);
  return { ...after, pushEnabledHere: config.feishuContentPushEnabled };
}

const BUDGET_NOTE_KO: Record<string, string> = {
  "正文兜底（按请求计费）": "본문 추출 폴백 (요청당 과금)",
  "X 搜索（按请求计费）": "X 검색 (요청당 과금)",
  "公众号列表与正文（按请求计费）": "위챗 공식계정 목록 및 본문 (요청당 과금)",
  "模型调用熔断（智谱）": "모델 호출 서킷 브레이커 (Zhipu)",
  "模型调用熔断（DeepSeek）": "모델 호출 서킷 브레이커 (DeepSeek)",
  "模型与向量调用熔断（阿里云百炼）": "모델 및 임베딩 호출 서킷 브레이커 (DashScope)",
  "模型调用熔断（小米 MiMo）": "모델 호출 서킷 브레이커 (Xiaomi MiMo)",
  "模型调用熔断（默认模型，所有步骤共用）": "모델 호출 서킷 브레이커 (기본 모델, 전 단계 공용)",
  "向量调用熔断": "임베딩 벡터 호출 서킷 브레이커",
};

export async function listBudgets(): Promise<BeforeJson<AdminBudget>[]> {
  const rows = await sql<BeforeJson<AdminBudget>[]>`
    SELECT b.service, b.per_minute, b.per_hour, b.per_day, b.note, b.updated_at,
           (SELECT count(*)::int FROM receipt_attempts a WHERE a.service = b.service AND a.origin = 'live' AND a.started_at > now() - interval '1 day') AS used_day,
           (SELECT count(*)::int FROM receipt_attempts a WHERE a.service = b.service AND a.origin = 'live' AND a.started_at > now() - interval '1 hour') AS used_hour
    FROM budgets b ORDER BY b.service`;
  return rows.map((r) => ({ ...r, note: (r.note && BUDGET_NOTE_KO[r.note]) ?? r.note }));
}

export async function updateBudget(service: string, input: { perMinute: number; perHour: number; perDay: number; reason: string }, actor: string) {
  if (!input.reason?.trim()) throw new Error("reason is required");
  for (const v of [input.perMinute, input.perHour, input.perDay]) if (!Number.isInteger(v) || v < 0) throw new Error("budgets are non-negative integers (0 stops the service)");
  const [before] = await sql`SELECT per_minute, per_hour, per_day FROM budgets WHERE service = ${service}`;
  const [after] = await sql`
    INSERT INTO budgets (service, per_minute, per_hour, per_day, note) VALUES (${service}, ${input.perMinute}, ${input.perHour}, ${input.perDay}, ${input.reason})
    ON CONFLICT (service) DO UPDATE SET per_minute = EXCLUDED.per_minute, per_hour = EXCLUDED.per_hour, per_day = EXCLUDED.per_day, note = EXCLUDED.note, updated_at = now()
    RETURNING service, per_minute, per_hour, per_day`;
  await audit(actor, "budget.update", `budget:${service}`, input.reason, before ?? null, after);
  return after;
}
