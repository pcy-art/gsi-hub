import { SITE } from "@aihot/site";
import { Form, Link, useNavigate, useSearchParams } from "react-router";
import type { Route } from "./+types/sources";
import type { AdminSources } from "@aihot/contracts/admin";
import { SELECTION } from "@aihot/industry/selection";
import { adminGet } from "../../lib/admin.server";
import { num } from "../../features/admin/format";
import { HEALTH_LABEL, KIND_LABEL, MODE_LABEL } from "../../features/admin/labels";
import { AdminPage, Badge, ButtonLink, Card, DataTable, Dot, FilterChips, healthTone, Input, Pager, Select, Stat, Time } from "../../features/admin/ui";



export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  return adminGet<AdminSources>(request, `/api/admin/sources${url.search}`);
}

export const meta: Route.MetaFunction = () => [{ title: `수집원 · ${SITE.name} 관리자` }];

export default function Sources({ loaderData }: Route.ComponentProps) {
  const { rows, totals, page, useLabels } = loaderData;
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const pick = (param: string, value: string) => {
    const next = new URLSearchParams(sp);
    if (value) next.set(param, value);
    else next.delete(param);
    next.delete("page");
    navigate(`?${next}`, { preventScrollReset: true });
  };
  return (
    <AdminPage
      title="수집원 관리"
      subtitle="수집원 목록은 헬스 상태(실패 수집원 우선)로 정렬됩니다. 상세 페이지에서 수집 미리보기, 수동 수집 실행, 수집 주기 및 파이프라인 모드를 설정할 수 있습니다."
      actions={<ButtonLink to="/admin/sources/new" tone="primary">신규 수집원 등록</ButtonLink>}
    >
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="전체" value={num(totals.total)} />
        <Stat label="활성" value={num(totals.enabled)} />
        <Stat label="실패" value={num(totals.failing)} tone={totals.failing ? "bad" : "ok"} />
        <Stat label="불안정" value={num(totals.degraded)} tone={totals.degraded ? "warn" : undefined} />
      </div>
      <Card pad={false}>
        <div className="flex flex-col gap-3 border-b border-line p-3 lg:flex-row lg:items-center lg:justify-between">
          <Form method="get" className="flex w-full max-w-md gap-2" preventScrollReset>
            {["kind", "health", "mode", "use"].map((k) => sp.get(k) && <input key={k} type="hidden" name={k} value={sp.get(k)!} />)}
            <Input name="q" defaultValue={sp.get("q") ?? ""} placeholder="이름, ID 또는 URL 주소" aria-label="수집원 검색" />
          </Form>
          <div className="flex flex-wrap items-center gap-3">
            <FilterChips param="health" options={[{ value: "", label: "전체" }, { value: "failing", label: "실패" }, { value: "degraded", label: "불안정" }, { value: "paused", label: "일시중지" }]} />
            <Select aria-label="유형" className="!w-auto" value={sp.get("kind") ?? ""} onChange={(e) => pick("kind", e.target.value)}>
              <option value="">전체 유형</option>
              {Object.entries(KIND_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
            {Object.keys(useLabels).length > 0 && (
              <Select aria-label="용도" className="!w-auto" value={sp.get("use") ?? ""} onChange={(e) => pick("use", e.target.value)}>
                <option value="">전체 용도</option>
                {Object.entries(useLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
            )}
          </div>
        </div>
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate(`/admin/sources/${encodeURIComponent(r.id)}`)}
          columns={[
            {
              key: "name",
              label: "수집원",
              render: (r) => (
                <div className="min-w-[220px]">
                  <Link to={`/admin/sources/${encodeURIComponent(r.id)}`} className="font-medium text-ink hover:text-accent" onClick={(e) => e.stopPropagation()}>
                    {r.name}
                  </Link>
                  <div className="font-mono text-[11.5px] text-ink-4">{r.id}</div>
                  {r.health === "failing" && r.last_error && <div className="mt-1 line-clamp-1 text-[12px] text-hot">{r.last_error}</div>}
                </div>
              ),
            },
            { key: "kind", label: "유형", render: (r) => <Badge>{KIND_LABEL[r.kind] ?? r.kind}</Badge> },
            {
              key: "mode",
              label: "파이프라인",
              render: (r) => (
                <div className="flex gap-1">
                  <Badge tone={r.participation_mode === "editorial" ? "accent" : "muted"}>{MODE_LABEL[r.participation_mode] ?? r.participation_mode}</Badge>
                  {r.uses.map((u) => <Badge key={u} tone="info">{useLabels[u] ?? u}</Badge>)}
                  <Badge tone="info">{r.tier.replace("_", ".")}</Badge>
                  {r.selection_class && <Badge tone="muted">{SELECTION.classes[r.selection_class]?.label ?? r.selection_class}</Badge>}
                  {r.first_party && <Badge tone="ok">1차 출처</Badge>}
                </div>
              ),
            },
            {
              key: "health",
              label: "상태",
              render: (r) => (
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <Dot tone={r.enabled ? healthTone(r.health) : "muted"} />
                  {r.enabled ? HEALTH_LABEL[r.health] ?? r.health : "일시중지됨"}
                  {r.fail_count > 0 && <span className="num text-[11.5px] text-ink-4">×{r.fail_count}</span>}
                </span>
              ),
            },
            { key: "ok", label: "최근 성공", render: (r) => <Time at={r.last_ok_at} /> },
            { key: "interval", label: "주기", align: "right", render: (r) => `${r.interval_minutes}분` },
            { key: "items", label: "7일 수집건", align: "right", render: (r) => num(r.items_7d) },
            { key: "sel", label: "30일 엄선건", align: "right", render: (r) => num(r.selected_30d) },
          ]}
        />
      </Card>
      <Pager page={page} hasMore={rows.length === 100} />
    </AdminPage>
  );
}
