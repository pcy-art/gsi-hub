import { useState } from "react";
import { SITE } from "@aihot/site";
import { Link, useFetcher } from "react-router";
import { useEffect } from "react";
import type { Route } from "./+types/runs";
import type { AdminDeliveryIssue, AdminReceiptIssue, AdminRuns } from "@aihot/contracts/admin";
import { adminGet } from "../../lib/admin.server";
import { useAdminAction } from "../../features/admin/action";
import { ago, bj, duration, num } from "../../features/admin/format";
import { AdminPage, Badge, Button, Card, DataTable, Dot, Empty, Field, Json, ReasonDialog, Select, Stat, Time } from "../../features/admin/ui";


export async function loader({ request }: Route.LoaderArgs) {
  return adminGet<AdminRuns>(request, "/api/admin/runs");
}

export const meta: Route.MetaFunction = () => [{ title: `실행 모니터링 · ${SITE.name} 관리자` }];

const STATE_LABEL: Record<string, string> = { created: "대기", retry: "재시도 대기", active: "실행 중" };

export default function RunsAdmin({ loaderData }: Route.ComponentProps) {
  const refresh = useFetcher<typeof loader>();
  const r = refresh.data ?? loaderData;
  const { run, pending } = useAdminAction();
  const [receipt, setReceipt] = useState<AdminReceiptIssue | null>(null);
  const [billed, setBilled] = useState("false");
  const [delivery, setDelivery] = useState<AdminDeliveryIssue | null>(null);
  const [outcome, setOutcome] = useState<"sent" | "drop" | "resend">("sent");
  // Failure group to put back into processing ("" = every failure of the last 30 days).
  const [requeue, setRequeue] = useState<string | null>(null);

  // Live view: refresh every 20 s while visible.
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && refresh.state === "idle" && refresh.load("/admin/runs"), 20_000);
    return () => clearInterval(t);
  }, [refresh]);

  const backlog = new Map<string, Record<string, { n: number; oldest: string }>>();
  for (const q of r.queues) backlog.set(q.name, { ...(backlog.get(q.name) ?? {}), [q.state]: { n: q.n, oldest: q.oldest } });
  const queued = r.queues.filter((q) => q.state !== "active").reduce((a, q) => a + q.n, 0);
  const worker = r.processes.find((p) => p.role === "worker");
  const failing = r.jobs.filter((j) => j.status === "failed");

  return (
    <AdminPage title="실행 모니터링" subtitle={<>작업, 큐, 수집 지연, 인공 확인이 필요한 실행 영수증 및 발송 상태를 모니터링합니다. 20초마다 자동 갱신 · 최근 확인 {bj(r.checkedAt)}</>}>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat
          label="worker"
          value={<span className="inline-flex items-center gap-2 text-[18px]"><Dot tone={worker?.alive ? "ok" : "bad"} />{worker ? (worker.alive ? "실행 중" : "하트비트 중단") : "하트비트 없음"}</span>}
          hint={worker ? `${worker.host} · 하트비트 ${ago(worker.at)}` : "worker 하트비트 미수신"}
        />
        <Stat label="큐 적체" value={num(queued)} tone={queued > 500 ? "warn" : undefined} hint="대기 및 재시도 대기" />
        <Stat label="실패 배치 작업" value={num(failing.length)} tone={failing.length ? "bad" : "ok"} hint="최근 1회 실행 실패" />
        <Stat label="영수증 상태 불명" value={num(r.receipts.issues.filter((x) => x.status === "unknown").length)} tone={r.receipts.issues.some((x) => x.status === "unknown") ? "bad" : "ok"} hint={`7일간 유료 요청 ${num(Object.values(r.receipts.counts).reduce((a, b) => a + b, 0))}회`} />
        <Stat label="발송 상태 확인 필요" value={num(r.deliveries.filter((d) => d.status === "unknown").length)} tone={r.deliveries.some((d) => d.status === "unknown") ? "bad" : "ok"} />
      </div>

      {r.grouping.waiting > 0 && (
        <Card className="mb-5" title="중복 검증 대기 중인 엄선 항목" right={<span>{num(r.grouping.waiting)}건 대기 · {num(r.grouping.needsAttention)}건 10분 초과</span>} pad={false} scrollable>
          <p className="px-4 py-3 text-[13px] text-ink-3">엄선 기준을 통과하였으나, 중복 보도 여부를 확인한 후 엄선 피드에 반영됩니다. 대기 시간이 긴 상위 30건을 표시합니다.</p>
          <DataTable dense rows={r.grouping.items} rowKey={(item) => item.articleId} columns={[
            { key: "title", label: "뉴스 제목", render: (item) => <Link className="text-accent" to={`/admin/content/${item.articleId}`}>{item.title}</Link> },
            { key: "since", label: "대기 시작", render: (item) => <Time at={item.since} /> },
            { key: "recovery", label: "다음 조치", render: (item) => <Badge tone={item.recovery === "manual" ? "bad" : "warn"}>{item.recovery === "manual" ? "수동 처리 후 복구" : item.recovery === "receipt" ? "결과 자동 대기 후 복구" : "자동 처리 중"}</Badge> },
            { key: "error", label: "사유", render: (item) => <span className="line-clamp-2 text-[12px] text-ink-3">{item.receiptId ? `실행기록 #${item.receiptId} · ` : ""}{item.error ?? "식별 확인 대기"}</span> },
          ]} />
        </Card>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="작업 큐" pad={false} scrollable>
          <DataTable
            dense
            rows={[...backlog.entries()]}
            rowKey={([name]) => name}
            empty="큐가 비어 있습니다"
            columns={[
              { key: "n", label: "큐 이름", render: ([name]) => <span className="font-mono text-[12.5px]">{name}</span> },
              ...(["created", "retry", "active"] as const).map((st) => ({
                key: st,
                label: STATE_LABEL[st],
                align: "right" as const,
                render: ([, v]: [string, Record<string, { n: number; oldest: string }>]) => (v[st] ? <span title={`최초 등록 ${bj(v[st]!.oldest, true)}`}>{num(v[st]!.n)}</span> : <span className="text-ink-4">0</span>),
              })),
              { key: "old", label: "최장 대기", render: ([, v]) => <Time at={v.created?.oldest ?? v.retry?.oldest ?? null} /> },
            ]}
          />
        </Card>
        <Card title="정기 배치 작업" pad={false} scrollable>
          <DataTable
            dense
            rows={r.jobs}
            rowKey={(j) => j.job}
            columns={[
              { key: "j", label: "작업", render: (j) => <span className="font-mono text-[12.5px]">{j.job}</span> },
              { key: "s", label: "최근 결과", render: (j) => <Badge tone={j.status === "ok" ? "ok" : j.status === "failed" ? "bad" : "muted"} title={j.error ?? undefined}>{j.status ?? "실행 중"}</Badge> },
              { key: "at", label: "일시", render: (j) => <Time at={j.started_at} /> },
              { key: "d", label: "소요 시간", align: "right", render: (j) => duration(j.started_at, j.finished_at) },
              { key: "f", label: "24시간 실패율", align: "right", render: (j) => (j.failed_24h ? <span className="text-hot">{j.failed_24h}/{j.runs_24h}</span> : `0/${j.runs_24h}`) },
            ]}
          />
        </Card>
      </div>

      {r.failedJobs.length > 0 && (
        <Card className="mt-5" title="24시간 내 실패한 큐 작업" pad={false} scrollable>
          <DataTable
            dense
            rows={r.failedJobs}
            rowKey={(j) => j.name}
            columns={[
              { key: "n", label: "큐", render: (j) => <span className="font-mono text-[12.5px]">{j.name}</span> },
              { key: "c", label: "실패 건수", align: "right", render: (j) => num(j.failed) },
              { key: "l", label: "최근 실패", render: (j) => <Time at={j.last} /> },
              { key: "o", label: "최근 오류", render: (j) => <span className="line-clamp-2 font-mono text-[11.5px] text-ink-3">{j.last_output}</span> },
            ]}
          />
        </Card>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card title="확인이 필요한 유료 호출 영수증" right={<span>{Object.entries(r.receipts.counts).map(([k, v]) => `${k} ${v}`).join(" · ")}</span>} pad={false} scrollable>
          <DataTable
            dense
            rows={r.receipts.issues}
            rowKey={(x) => x.id}
            empty="처리 대기 중인 영수증이 없습니다"
            columns={[
              { key: "id", label: "영수증", render: (x) => <span className="num">#{x.id}</span> },
              { key: "s", label: "상태", render: (x) => <Badge tone={x.status === "unknown" ? "bad" : "warn"}>{x.status}</Badge> },
              { key: "w", label: "서비스", render: (x) => <span className="whitespace-nowrap">{x.service}{x.model ? ` · ${x.model}` : ""}</span> },
              { key: "p", label: "용도", render: (x) => (x.subject && /^[\w-]{10,}$/.test(x.subject) && x.purpose.includes("analy") ? <Link className="text-accent" to={`/admin/content/${x.subject}`}>{x.purpose}</Link> : x.purpose) },
              { key: "e", label: "오류", render: (x) => <span className="line-clamp-2 text-[12px] text-ink-3" title={x.error ?? ""}>{x.error}</span> },
              { key: "a", label: "", render: (x) => (x.status === "unknown" ? <Button size="sm" onClick={() => setReceipt(x)}>확인</Button> : null) },
            ]}
          />
        </Card>
        <Card title="확인이 필요한 외부 발송" pad={false} scrollable>
          <DataTable
            dense
            rows={r.deliveries}
            rowKey={(d) => d.id}
            empty="확인 대기 중인 발송이 없습니다"
            columns={[
              { key: "t", label: "대상 채널", render: (d) => d.target_key },
              { key: "s", label: "상태", render: (d) => <Badge tone={d.status === "unknown" ? "bad" : "warn"}>{d.status}</Badge> },
              { key: "sub", label: "콘텐츠", render: (d) => (d.subject_kind === "selected" ? <Link className="text-accent" to={`/admin/content/${d.subject_id}`}>{d.subject_id}</Link> : `${d.subject_kind} ${d.subject_id}`) },
              { key: "at", label: "일시", render: (d) => <Time at={d.updated_at} /> },
              { key: "a", label: "", render: (d) => <Button size="sm" onClick={() => setDelivery(d)}>처리</Button> },
            ]}
          />
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card title="지연 또는 실패 수집원" right={<Link className="text-accent" to="/admin/sources?health=failing">실패 수집원 전체</Link>} pad={false} scrollable>
          <DataTable
            dense
            rows={r.lagging}
            rowKey={(s) => s.id}
            empty="모든 수집원이 정상 주기로 수집 중입니다"
            columns={[
              { key: "n", label: "수집원", render: (s) => <Link className="text-ink hover:text-accent" to={`/admin/sources/${encodeURIComponent(s.id)}`}>{s.name}</Link> },
              { key: "h", label: "상태", render: (s) => <Badge tone={s.health === "failing" ? "bad" : s.health === "degraded" ? "warn" : "muted"}>{s.health}</Badge> },
              { key: "ok", label: "최근 성공", render: (s) => <Time at={s.last_ok_at} /> },
              { key: "nx", label: "예정 시각", render: (s) => <Time at={s.next_fetch_at} /> },
              { key: "e", label: "오류", render: (s) => <span className="line-clamp-1 text-[12px] text-ink-3" title={s.last_error ?? ""}>{s.last_error}</span> },
            ]}
          />
        </Card>
        <Card
          title="처리 실패 (최근 30일, 오류 유형별 분류)"
          right={
            <span className="flex items-center gap-3">
              {r.retrying.count > 0 && <span>재시도 대기 {num(r.retrying.count)}건 · 다음 실행 <Time at={r.retrying.next} /></span>}
              {r.errors.length > 0 && <Button size="sm" onClick={() => setRequeue("")}>전체 재처리</Button>}
            </span>
          }
          pad={false} scrollable
        >
          <DataTable
            dense
            rows={r.errors}
            rowKey={(e) => e.error}
            empty="처리 실패 항목이 없습니다"
            columns={[
              { key: "e", label: "오류 유형", render: (e) => <span className="font-mono text-[11.5px] text-ink-2">{e.error}</span> },
              { key: "n", label: "건수", align: "right", render: (e) => num(e.n) },
              { key: "x", label: "예시", render: (e) => <Link className="text-accent" to={`/admin/content/${e.example}`}>확인</Link> },
              { key: "l", label: "최근 일시", render: (e) => <Time at={e.last} /> },
              { key: "a", label: "", align: "right", render: (e) => <Button size="sm" onClick={() => setRequeue(e.error)}>재처리</Button> },
            ]}
          />
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card title="작업 타임라인" pad={false} scrollable>
          <DataTable
            dense
            rows={r.timeline}
            rowKey={(t) => t.id}
            columns={[
              { key: "at", label: "시작", render: (t) => <span className="num whitespace-nowrap">{bj(t.started_at)}</span> },
              { key: "j", label: "작업", render: (t) => <span className="font-mono text-[12px]">{t.job}</span> },
              { key: "s", label: "결과", render: (t) => <Badge tone={t.status === "ok" ? "ok" : t.status === "failed" ? "bad" : "muted"} title={t.error ?? undefined}>{t.status ?? "실행 중"}</Badge> },
              { key: "d", label: "소요 시간", align: "right", render: (t) => duration(t.started_at, t.finished_at) },
            ]}
          />
        </Card>
        <Card title="외부 수집 보고" pad={false} scrollable>
          {r.ingest.length ? (
            <DataTable
              dense
              rows={r.ingest}
              rowKey={(e) => `${e.client}-${e.created_at}`}
              columns={[
                { key: "at", label: "일시", render: (e) => <Time at={e.created_at} /> },
                { key: "c", label: "클라이언트", render: (e) => e.client },
                { key: "k", label: "유형", render: (e) => e.kind },
                { key: "s", label: "결과", render: (e) => <Badge tone={e.status === "ok" ? "ok" : e.status === "error" ? "bad" : "muted"} title={e.error ?? undefined}>{e.status}</Badge> },
                { key: "x", label: "요약", render: (e) => <Json value={e.summary} label="요약" /> },
              ]}
            />
          ) : (
            <Empty>외부 수집 보고 기록이 없습니다 (수집 스크립트)</Empty>
          )}
        </Card>
      </div>

      {r.processes.length > 0 && (
        <Card className="mt-5" title="프로세스 현황">
          <ul className="grid gap-2 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
            {r.processes.map((p) => (
              <li key={p.role} className="flex items-center gap-2">
                <Dot tone={p.alive ? "ok" : "bad"} />
                <span className="font-medium">{p.role}</span>
                <span className="text-ink-3">{p.host} · pid {p.pid} · {p.release} · 시작 일시: {bj(p.startedAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ReasonDialog
        open={!!receipt}
        title={`영수증 확인 #${receipt?.id ?? ""}`}
        description="자동 복구 후에도 결과 불명인 요청은 수동 승인이 필요합니다. 과금 여부를 확인하십시오. 승인 시 재호출되므로 중복 과금될 수 있습니다."
        confirmLabel="기록 및 승인"
        busy={pending === "release"}
        onClose={() => setReceipt(null)}
        onSubmit={async (note) => (await run("POST", `/api/admin/receipts/${receipt!.id}/release`, { billed: billed === "unknown" ? null : billed === "true", note }, { label: "release", success: "승인되었습니다" })) !== null}
      >
        <Field label="공급자 과금 여부">
          <Select value={billed} onChange={(e) => setBilled(e.target.value)}>
            <option value="false">미과금 (요청 미접수)</option>
            <option value="true">과금됨 (결과 미수신)</option>
            <option value="unknown">과금 불명 (재시도 승인)</option>
          </Select>
        </Field>
      </ReasonDialog>
      <ReasonDialog
        open={requeue !== null}
        title={requeue ? "해당 유형 실패 건 재처리" : "전체 실패 건 재처리"}
        description="해당 기사들이 다시 처리 큐(본문 추출, 모델 평가, 발행)에 진입합니다. 모델 호출에 따른 추가 비용이 발생할 수 있습니다."
        confirmLabel="재처리 실행"
        busy={pending === "requeue"}
        onClose={() => setRequeue(null)}
        onSubmit={async (reason) => (await run("POST", "/api/admin/processing/requeue", { group: requeue || null, reason }, { label: "requeue", success: "재처리 큐에 등록되었습니다" })) !== null}
      />
      <ReasonDialog
        open={!!delivery}
        title="외부 발송 처리"
        description="메신저 채널 등에서 실제 수신 여부를 확인하십시오. 확인 후 처리 방안을 선택하십시오."
        confirmLabel="확인"
        danger={outcome === "resend"}
        busy={pending === "delivery"}
        onClose={() => setDelivery(null)}
        onSubmit={async (note) => (await run("POST", `/api/admin/deliveries/${delivery!.id}/resolve`, { outcome, note }, { label: "delivery", success: "처리되었습니다" })) !== null}
      >
        <Field label="처리 방안">
          <Select value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)}>
            <option value="sent">채널 수신 확인됨 (도달 완료 처리)</option>
            <option value="drop">발송 포기 (추가 전송 안 함)</option>
            <option value="resend">미수신 확인됨 (재발송 실행)</option>
          </Select>
        </Field>
      </ReasonDialog>
    </AdminPage>
  );
}
