import { useState } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/models";
import type { AdminModels } from "@aihot/contracts/admin";
import { SITE } from "@aihot/site";
import { adminGet } from "../../lib/admin.server";
import { useAdminAction } from "../../features/admin/action";
import { bj, money, num } from "../../features/admin/format";
import { AdminPage, Badge, Button, Card, DataTable, Empty, Field, FilterChips, ReasonDialog, Select } from "../../features/admin/ui";



export async function loader({ request }: Route.LoaderArgs) {
  const days = new URL(request.url).searchParams.get("days") ?? "7";
  return adminGet<AdminModels>(request, `/api/admin/models?days=${encodeURIComponent(days)}`);
}

export const meta: Route.MetaFunction = () => [{ title: `모델 및 벤치마크 · ${SITE.name} 관리자` }];

const SOURCE_LABEL = { admin: "관리자 설정", env: "환경 변수", default: "기본값" } as const;

/** A cost the provider did not report and no price covers. */
function Unpriced() {
  return <span className="whitespace-nowrap text-ink-4" title="제공자 미과금 항목이거나 단가 미설정 상태입니다">미책정</span>;
}
const secs = (ms: number | null) => (ms == null ? "—" : ms >= 10_000 ? `${Math.round(ms / 1000)} s` : `${(ms / 1000).toFixed(1)} s`);

export default function ModelsAdmin({ loaderData: m }: Route.ComponentProps) {
  const { run, pending } = useAdminAction();
  const [target, setTarget] = useState<AdminModels["capabilities"][number] | null>(null);
  const [choice, setChoice] = useState<string>("");
  const labelOf = (key: string) => m.capabilities.find((c) => `capability:${c.key}` === key)?.label ?? key;

  return (
    <AdminPage
      title="모델 및 벤치마크"
      subtitle="기능별 AI 모델 배정 현황(관리자 콘솔 > 환경 변수 > 기본값), 최근 성공률, 지연 시간 및 토큰 비용을 모니터링합니다. 모델 변경은 이후 신규 작업부터 즉시 적용됩니다. 모델 교체 전 SelectBench 골드 라벨 벤치마크를 확인하십시오."
      actions={<FilterChips param="days" options={[{ value: "1", label: "24시간" }, { value: "", label: "7일" }, { value: "30", label: "30일" }]} />}
    >
      <div className="grid grid-cols-1 gap-5">
        {m.capabilities.map((c) => {
          const total = c.usage.reduce((a, u) => a + u.calls, 0);
          return (
            <Card
              key={c.key}
              title={
                <span className="inline-flex flex-wrap items-center gap-2">
                  {c.label}
                  <span className="font-mono text-[12px] font-normal text-ink-3 [overflow-wrap:anywhere]">{c.current.model}</span>
                  <Badge tone={c.current.source === "admin" ? "accent" : "muted"}>{SOURCE_LABEL[c.current.source]}</Badge>
                  {c.current.invalid && <Badge tone="bad">설정된 {c.current.invalid} 모델이 존재하지 않아 미적용</Badge>}
                  {c.fallback && <span className="text-xs font-normal text-ink-3">
                    예비 모델 {c.fallback.model} · {c.fallback.primaryPaused
                      ? c.fallback.backupPaused ? "주/예비 모두 중단, 복구 대기" : "예비 모델 구동 중"
                      : c.fallback.backupPaused ? "일시 불가" : "대기"}
                    {c.fallback.nextProbeAt && ` · ${bj(c.fallback.nextProbeAt)} 후 신규 요청 시 주 모델 재확인`}
                  </span>}
                </span>
              }
              right={
                <Button
                  size="sm"
                  onClick={() => {
                    setTarget(c);
                    setChoice(c.current.model);
                  }}
                >
                  변경
                </Button>
              }
              pad={false}
            >
              {c.usage.length ? (
                <DataTable
                  dense
                  rows={c.usage}
                  rowKey={(u) => `${u.purpose}|${u.model}|${u.promptVersion}`}
                  columns={[
                    { key: "m", label: "모델", render: (u) => <span className="whitespace-nowrap font-mono text-[12px]">{u.model}</span> },
                    { key: "v", label: "프롬프트 버전", render: (u) => <span className="whitespace-nowrap font-mono text-[11.5px] text-ink-3">{u.promptVersion ?? "—"}</span> },
                    { key: "p", label: "용도", render: (u) => <span className="whitespace-nowrap font-mono text-[11.5px] text-ink-3">{u.purpose}</span> },
                    { key: "c", label: "호출수", align: "right", render: (u) => num(u.calls) },
                    {
                      key: "ok",
                      label: "성공률",
                      align: "right",
                      render: (u) => {
                        const rate = u.calls ? u.ok / u.calls : 0;
                        return <span className={rate < 0.95 ? "text-hot" : ""} title={`실패 ${u.failed} · 결과 불명 ${u.unknown}`}>{`${Math.round(rate * 1000) / 10}%`}</span>;
                      },
                    },
                    { key: "l", label: "지연 p50 / p95", align: "right", render: (u) => <span className="whitespace-nowrap">{`${secs(u.p50)} / ${secs(u.p95)}`}</span> },
                    { key: "t", label: "입/출력 토큰", align: "right", render: (u) => <span className="whitespace-nowrap">{`${num(u.tokensIn)} / ${num(u.tokensOut)}`}</span> },
                    {
                      key: "$",
                      label: "비용",
                      align: "right",
                      render: (u) =>
                        u.actualCost !== null ? (
                          `${money(u.actualCost)}${u.currency && u.currency !== "CNY" ? ` ${u.currency}` : ""}`
                        ) : u.estimate ? (
                          <span title="사용량 × 단가 추정치">≈ {money(u.estimate.amount)}{u.estimate.currency !== "CNY" ? ` ${u.estimate.currency}` : ""}</span>
                        ) : (
                          <Unpriced />
                        ),
                    },
                  ]}
                />
              ) : (
                <Empty>{m.days}일 내 호출 이력 없음{total === 0 && c.vision ? " (이미지 포함 시에만 사용)" : ""}</Empty>
              )}
            </Card>
          );
        })}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title="모델 변경 이력" pad={false}>
          {m.history.length ? (
            <DataTable
              dense
              rows={m.history}
              rowKey={(h) => `${h.at}|${h.subject}`}
              columns={[
                { key: "at", label: "일시", render: (h) => <span className="num whitespace-nowrap">{bj(h.at)}</span> },
                { key: "c", label: "기능", render: (h) => labelOf(h.subject) },
                { key: "m", label: "변경 내용", render: (h) => <span className="font-mono text-[12px]">{h.before?.model ?? "—"} → {h.after?.model ?? "—"}</span> },
                { key: "r", label: "사유", render: (h) => <span className="text-ink-3">{h.reason}</span> },
                { key: "a", label: "작업자", render: (h) => h.actor },
              ]}
            />
          ) : (
            <Empty>관리자 콘솔에서 변경된 모델 이력이 없습니다</Empty>
          )}
        </Card>
        <Card title="골드 샘플 비교 (SelectBench)" right={<Link to="/admin/selectbench" className="text-accent">전체 실행 목록</Link>} pad={false}>
          {m.benches.length ? (
            <DataTable
              dense
              rows={m.benches}
              rowKey={(b) => b.id}
              columns={[
                { key: "l", label: "실행 라벨", render: (b) => <Link to={`/admin/selectbench/${b.id}`} className="text-ink hover:text-accent">{b.label}</Link> },
                { key: "m", label: "비교 모델", render: (b) => <span className="font-mono text-[11.5px] text-ink-3">{b.models.join("、")}</span> },
                { key: "n", label: "샘플수", align: "right", render: (b) => num(b.sample_size) },
                { key: "at", label: "실행 일시", render: (b) => <span className="num whitespace-nowrap">{bj(b.created_at)}</span> },
              ]}
            />
          ) : (
            <Empty>가져온 비교 실행 리포트가 없습니다</Empty>
          )}
        </Card>
      </div>

      <ReasonDialog
        open={!!target}
        title={`모델 변경: ${target?.label ?? ""}`}
        description="이후 신규 작업부터 즉시 적용됩니다. '기본값 복원'을 선택하면 환경 변수 또는 코드 기본 설정으로 복원됩니다."
        confirmLabel="모델 변경"
        busy={pending === "switch"}
        onClose={() => setTarget(null)}
        onSubmit={async (reason) =>
          (await run("POST", `/api/admin/models/${target!.key}`, { model: choice === "__default" ? null : choice, reason }, { label: "switch", success: "모델이 변경되었습니다. 다음 호출부터 적용됩니다" })) !== null
        }
      >
        <Field label="대상 모델">
          <Select value={choice} onChange={(e) => setChoice(e.target.value)}>
            {m.choices
              .filter((x) => !target?.vision || x.vision)
              .map((x) => (
                <option key={x.key} value={x.key}>
                  {x.key}（{x.service}）
                </option>
              ))}
            <option value="__default">기본값 복원（{target?.env} 또는 {target?.defaultModel}）</option>
          </Select>
        </Field>
      </ReasonDialog>
    </AdminPage>
  );
}
