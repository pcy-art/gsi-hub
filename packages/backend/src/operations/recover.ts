// In-doubt work. A stopped process leaves "pending" receipts and deliveries: they become
// "unknown" and are never re-sent on their own. An unknown receipt is released once automatically after
// half an hour without checking the provider's bill, so a lost answer costs at most one repeat; one that
// turns unknown again waits for an authorized manual release with the actual billing state and a note. A released
// receipt lets its request call again, and an article that stopped on it goes back to processing.
// A primary already handed to a backup is retained for billing; only the backup may need recovery.
import { audit, Conflict } from "../audit.ts";
import { sql } from "../db.ts";
import { resumeAfterRelease } from "../jobs/content.ts";
import { sweepUngrouped } from "../jobs/events.ts";
import { retryReleasedReceiptJobs } from "../jobs/queue.ts";
import { markStaleDeliveries } from "../notify/deliver.ts";
import { awaitingRelease, markStalePendingReceipts, releaseUnknownReceipt } from "../providers/receipts.ts";

const AUTO_RELEASE_AFTER_MS = 30 * 60_000;
export const AUTO_RELEASE_NOTE = "자동 해제: 30분 이상 결과 미상 상태 지속 (과금 여부 미확인)";

async function release(id: number, error: string, actor: string, note: string, billed: boolean | null) {
  return sql.begin(async (tx) => {
    const receipt = await releaseUnknownReceipt(tx, id, error);
    if (!receipt) return null;
    const requeued = await resumeAfterRelease(receipt, tx);
    await audit(actor, "receipt.release", `receipt:${id}`, note, { status: "unknown" }, { status: "failed", billed, requeued }, { db: tx });
    return { id, status: "failed", subject: receipt.subject, purpose: receipt.purpose, requeued };
  });
}

/** Record verified billing, or explicitly unknown billing for an authorized manual recovery. */
export async function releaseReceipt(id: number, input: { billed: boolean | null; note: string }, actor: string) {
  if (!input.note?.trim()) throw new Error("note is required");
  if (input.billed !== null && typeof input.billed !== "boolean") throw new Error("billed must be true, false or null");
  const [row] = await sql<{ status: string }[]>`SELECT status FROM receipts WHERE id = ${id}`;
  if (!row) return null;
  if (row.status !== "unknown") throw new Conflict("결과가 미상(unknown) 상태인 영수증만 수동 확인이 필요합니다");
  const error = input.billed === null ? `수동 해제: 과금 여부 미상, 승인 기준 복구. ${input.note}`
    : `수동 확인: ${input.billed ? "공급자 과금됨 (응답 미수신)" : "공급자 미과금"}. ${input.note}`;
  return release(id, error, actor, input.note, input.billed);
}

/**
 * Unknown receipts older than half an hour, released without checking the provider's bill. A request
 * released this way once and unknown again stays for the admin (the alerts' follow-ups list it).
 * Primaries continued by a backup are not awaiting release: that would revive their old request.
 */
export async function autoReleaseUnknownReceipts(now = Date.now()) {
  const rows = await sql<{ id: number }[]>`
    SELECT r.id FROM receipts r
    WHERE ${awaitingRelease(sql`r`)} AND r.updated_at < ${new Date(now - AUTO_RELEASE_AFTER_MS)}
      AND NOT EXISTS (SELECT 1 FROM receipt_attempts a WHERE a.receipt_id = r.id AND a.error LIKE ${AUTO_RELEASE_NOTE + "%"})
    ORDER BY r.id LIMIT 200`;
  let released = 0;
  let requeued = 0;
  for (const r of rows) {
    const done = await release(r.id, AUTO_RELEASE_NOTE, "ops.recover", "결과 미상 상태로 1회 자동 해제", null);
    if (done) released += 1;
    if (done?.requeued) requeued += 1;
  }
  return { released, requeued };
}

/** ops.recover, every 10 minutes. */
export async function recoverStaleWork() {
  return { receipts: await markStalePendingReceipts(), released: await autoReleaseUnknownReceipts(), jobs: await retryReleasedReceiptJobs(), grouping: await sweepUngrouped(), deliveries: await markStaleDeliveries() };
}
