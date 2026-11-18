import { ADMIN, SITE } from "@aihot/site";
import { useState } from "react";
import { Form, useSearchParams } from "react-router";
import type { Route } from "./+types/feedback";
import type { AdminFeedback, AdminFeedbackRow } from "@aihot/contracts/admin";
import { adminGet } from "../../lib/admin.server";
import { useAdminAction } from "../../features/admin/action";
import { bj } from "../../features/admin/format";
import { FEEDBACK_KIND, FEEDBACK_STATUS } from "../../features/admin/labels";
import { AdminPage, Badge, Button, Card, Empty, FilterChips, Input, Pager, ReasonDialog, Select, Textarea, Time } from "../../features/admin/ui";



export async function loader({ request }: Route.LoaderArgs) {
  return adminGet<AdminFeedback>(request, `/api/admin/feedback${new URL(request.url).search}`);
}

export const meta: Route.MetaFunction = () => [{ title: `피드백 관리 · ${SITE.name} 관리자` }];

const TONE: Record<string, "accent" | "warn" | "ok" | "muted"> = { new: "accent", triaged: "warn", replied: "ok", resolved: "ok", spam: "muted" };
/** The pool's names, offered while naming a suggestion so the same idea keeps one name. */
const IDEAS_LIST = "feedback-ideas";

function FeedbackCard({ f }: { f: AdminFeedbackRow }) {
  const { run, pending } = useAdminAction();
  const [note, setNote] = useState(f.note ?? "");
  const [idea, setIdea] = useState(f.idea ?? "");
  const [dialog, setDialog] = useState<null | "ban" | "email-ban" | "erase">(null);
  const base = `/api/admin/feedback/${f.id}`;
  const version = new Date(f.updated_at).toISOString();
  const edited = note !== (f.note ?? "") || idea !== (f.idea ?? "");
  return (
    <article className="rounded-panel bg-surface p-4 ring-1 ring-line">
      <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3">
        <span className="num font-medium text-ink-2">#{f.id}</span>
        <Badge tone={TONE[f.status] ?? "muted"}>{FEEDBACK_STATUS[f.status] ?? f.status}</Badge>
        {f.kind && <Badge tone="info">{FEEDBACK_KIND[f.kind] ?? f.kind}</Badge>}
        {f.idea && <Badge tone="muted" title="제안 풀에 분류된 항목">{f.idea}</Badge>}
        <Time at={f.created_at} />
        {f.email && <a className="text-accent" href={`mailto:${f.email}`}>{f.email}</a>}
        {f.page_url && <a className="max-w-[320px] truncate hover:text-accent" href={f.page_url} target="_blank" rel="noreferrer">{f.page_url}</a>}
        {f.from_source > 1 && <Badge tone="info" title="동일 출처 (IP 및 브라우저 비가역 식별자)">동일 출처 {f.from_source}건</Badge>}
        {f.banned && <Badge tone="bad">출처 차단됨</Badge>}
        {f.email_banned && <Badge tone="bad">이메일 임시 차단됨</Badge>}
        {!f.forwarded_at && f.status === "new" && (
          <Badge tone="warn" title={f.forward_error && f.forward_error !== "pending" ? `내부 채널로 전달되지 않음: ${f.forward_error}` : "내부 채널로 전달되지 않음"}>미전달</Badge>
        )}
      </div>
      <p className="mt-2.5 whitespace-pre-wrap text-[14px] leading-relaxed text-ink">{f.content}</p>
      {f.screenshot === "local" && (
        <a href={`${base}/screenshot`} target="_blank" rel="noreferrer" className="mt-2 inline-block">
          <img src={`${base}/screenshot`} alt="피드백 스크린샷" loading="lazy" className="max-h-48 rounded-control ring-1 ring-line" />
        </a>
      )}
      {f.screenshot === "feishu" && <p className="mt-2 text-[12.5px] text-ink-4">스크린샷이 피드백과 함께 내부 채널로 전달되었습니다.</p>}
      {f.screenshot === "gone" && <p className="mt-2 text-[12.5px] text-ink-4">스크린샷이 전달되지 못해 삭제되었습니다.</p>}
      <div className="mt-3 grid gap-2 sm:grid-cols-[180px_1fr_auto] sm:items-start">
        <div className="grid gap-2">
          <Select
            aria-label="처리 상태"
            value={f.status}
            disabled={!!pending}
            onChange={(e) => run("PATCH", base, { status: e.target.value, version }, { label: "status", success: "상태가 변경되었습니다" })}
          >
            {Object.entries(FEEDBACK_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Select
            aria-label="유형"
            value={f.kind ?? ""}
            disabled={!!pending}
            onChange={(e) => run("PATCH", base, { kind: e.target.value || null, version }, { label: "kind", success: "유형이 변경되었습니다" })}
          >
            <option value="">미분류</option>
            {Object.entries(FEEDBACK_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </div>
        <div className="grid gap-2">
          <Textarea rows={1} className="!min-h-[38px]" placeholder="처리 메모 (내부 열람용)" value={note} onChange={(e) => setNote(e.target.value)} />
          {f.kind === "suggestion" && (
            <Input list={IDEAS_LIST} aria-label="분류된 제안" placeholder="분류된 제안 (동일 요구사항에 동일 명칭 사용)" value={idea} onChange={(e) => setIdea(e.target.value)} />
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="md" disabled={!edited} busy={pending === "note"} onClick={() => run("PATCH", base, { note: note || null, ...(f.kind === "suggestion" ? { idea: idea || null } : {}), version }, { label: "note", success: "저장되었습니다" })}>
            저장
          </Button>
          <Button tone="ghost" onClick={() => setDialog(f.banned ? null : "ban")} disabled={f.banned} title="이 출처의 후속 피드백 접수 거부">출처 차단</Button>
          {f.email && <Button tone="ghost" onClick={() => setDialog("email-ban")} disabled={f.email_banned} title="이 이메일의 피드백 접수 일시 거부 (48시간 후 자동 해제)">이메일 임시 차단</Button>}
          <Button tone="ghost" onClick={() => setDialog("erase")} title="개인정보처리방침에 따른 제출자 정보 삭제">개인정보 삭제</Button>
        </div>
      </div>
      <ReasonDialog
        open={dialog === "ban"}
        title="피드백 출처 차단"
        description={`동일 출처에서 이후 접수되는 피드백은 거부됩니다. 출처 식별자는 IP로 역산할 수 없습니다. ${ADMIN?.banNote ?? ""}`}
        danger
        confirmLabel="차단 실행"
        onClose={() => setDialog(null)}
        onSubmit={async (reason) => (await run("POST", "/api/admin/feedback-bans", { sourceHash: f.source_hash, reason }, { label: "ban", success: "출처가 차단되었습니다" })) !== null}
      />
      <ReasonDialog
        open={dialog === "email-ban"}
        title="피드백 이메일 임시 차단"
        description="이 이메일로 접수되는 피드백을 48시간 동안 중단합니다. 웹사이트 접근 자체는 차단되지 않습니다."
        danger
        confirmLabel="48시간 차단"
        onClose={() => setDialog(null)}
        onSubmit={async (reason) => (await run("POST", "/api/admin/feedback-bans", { feedbackId: f.id, reason }, { label: "email-ban", success: "이메일이 48시간 임시 차단되었습니다" })) !== null}
      />
      <ReasonDialog
        open={dialog === "erase"}
        title="제출자 정보 영구 삭제"
        description="본문, 이메일, 페이지 URL 및 스크린샷을 영구 삭제하며 처리 이력만 보존합니다. 복구할 수 없습니다."
        danger
        confirmLabel="영구 삭제"
        onClose={() => setDialog(null)}
        onSubmit={async (reason) => (await run("POST", `${base}/erase`, { reason }, { label: "erase", success: "제출자 정보가 영구 삭제되었습니다" })) !== null}
      />
    </article>
  );
}

export default function FeedbackAdmin({ loaderData }: Route.ComponentProps) {
  const { rows, counts, kinds, ideas, bans, page } = loaderData;
  const [sp] = useSearchParams();
  const { run } = useAdminAction();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <AdminPage title="피드백 관리" subtitle={ADMIN?.feedbackNote}>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-2">
          <FilterChips
            param="status"
            options={[{ value: "", label: "전체", count: total }, ...Object.entries(FEEDBACK_STATUS).map(([k, v]) => ({ value: k, label: v, count: counts[k] ?? 0 }))]}
          />
          <FilterChips
            param="kind"
            resets={["idea"]}
            options={[{ value: "", label: "전체 유형" }, ...Object.entries(FEEDBACK_KIND).map(([k, v]) => ({ value: k, label: v, count: kinds[k] ?? 0 }))]}
          />
        </div>
        <Form method="get" className="w-full max-w-xs">
          {["status", "kind", "idea"].map((k) => sp.get(k) && <input key={k} type="hidden" name={k} value={sp.get(k)!} />)}
          <Input name="q" defaultValue={sp.get("q") ?? ""} placeholder="내용, 이메일, URL 검색" aria-label="피드백 검색" />
        </Form>
      </div>
      {sp.get("kind") === "suggestion" && ideas.length > 0 && (
        <Card className="mb-4" title="제안 풀" right="제안 인원순 정렬">
          <FilterChips param="idea" options={[{ value: "", label: "전체 제안" }, ...ideas.map((i) => ({ value: i.idea, label: i.idea, count: i.people }))]} />
        </Card>
      )}
      <datalist id={IDEAS_LIST}>{ideas.map((i) => <option key={i.idea} value={i.idea} />)}</datalist>
      <div className="space-y-3">
        {rows.length ? rows.map((f) => <FeedbackCard key={`${f.id}-${f.updated_at}`} f={f} />) : <Card><Empty>조건에 맞는 피드백이 없습니다</Empty></Card>}
      </div>
      <Pager page={page} hasMore={rows.length === 50} />
      {bans.length > 0 && (
        <Card className="mt-8" title="차단 목록">
          <ul className="space-y-2 text-[13px]">
            {bans.map((b) => (
              <li key={b.source_hash} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {b.source_hash.startsWith("email:") ? "이메일" : "출처"} · <span className="break-all font-mono text-[12px] text-ink-3">{b.source_hash}</span> · {b.reason} · {b.created_by} · {bj(b.created_at, true)}
                  {b.expires_at && <span> · {bj(b.expires_at, true)} 자동 해제</span>}
                </span>
                <Button size="sm" tone="ghost" onClick={() => run("DELETE", `/api/admin/feedback-bans/${encodeURIComponent(b.source_hash)}`, undefined, { label: `unban-${b.source_hash}`, success: "차단이 해제되었습니다" })}>
                  차단 해제
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </AdminPage>
  );
}
