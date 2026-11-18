import { SITE } from "@aihot/site";
import { Form, Link, useNavigate, useSearchParams } from "react-router";
import type { Route } from "./+types/content";
import type { AdminContentRow, AdminContentSearch } from "@aihot/contracts/admin";
import { adminGet } from "../../lib/admin.server";
import { VISIBILITY_LABEL } from "../../features/admin/labels";
import { AdminPage, Badge, Button, Card, DataTable, Empty, Input, Time } from "../../features/admin/ui";


export async function loader({ request }: Route.LoaderArgs) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!q) return { q, rows: [] as AdminContentRow[] };
  const { rows } = await adminGet<AdminContentSearch>(request, `/api/admin/content?q=${encodeURIComponent(q)}`);
  return { q, rows };
}

export const meta: Route.MetaFunction = () => [{ title: `콘텐츠 검수 · ${SITE.name} 관리자` }];

export default function Content({ loaderData }: Route.ComponentProps) {
  const { q, rows } = loaderData;
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  return (
    <AdminPage title="콘텐츠 검수" subtitle="콘텐츠 ID, 원문 링크 또는 제목으로 수집 항목을 검색하여 수집원부터 발행까지의 전체 파이프라인을 진단합니다. 게시 철회, 요약 전용 설정, 수동 수정 및 재처리 작업이 가능합니다.">
      <Form method="get" className="mb-5 flex max-w-2xl gap-2">
        <Input name="q" defaultValue={sp.get("q") ?? ""} placeholder="콘텐츠 ID, URL 또는 제목 키워드" aria-label="콘텐츠 검색" autoFocus />
        <Button type="submit" tone="primary">검색</Button>
      </Form>
      {q && (
        <Card pad={false} title={`“${q}” 검색 결과`} right={<span>{rows.length === 50 ? "최근 50건만 표시" : `${rows.length}건`}</span>}>
          <DataTable
            rows={rows}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate(`/admin/content/${r.id}`)}
            empty="검색 결과가 없습니다. URL 정규화 및 제목 키워드 검색을 지원합니다."
            columns={[
              {
                key: "t",
                label: "제목",
                render: (r) => (
                  <div className="min-w-[320px]">
                    <Link to={`/admin/content/${r.id}`} className="font-medium text-ink hover:text-accent" onClick={(e) => e.stopPropagation()}>{r.title}</Link>
                    <div className="font-mono text-[11.5px] text-ink-4">{r.id}</div>
                  </div>
                ),
              },
              { key: "src", label: "수집원", render: (r) => <span className="whitespace-nowrap">{r.source}</span> },
              {
                key: "st",
                label: "상태",
                render: (r) => (
                  <span className="flex flex-wrap gap-1">
                    {r.selected && <Badge tone="accent">엄선</Badge>}
                    {r.visibility && <Badge tone={r.visibility === "public" ? "muted" : "warn"}>{VISIBILITY_LABEL[r.visibility] ?? r.visibility}</Badge>}
                    {!r.visibility && <Badge>{r.processing_state}</Badge>}
                  </span>
                ),
              },
              { key: "sc", label: "점수", align: "right", render: (r) => r.score ?? "—" },
              { key: "d", label: "수집 시각", render: (r) => <Time at={r.discovered_at} /> },
            ]}
          />
        </Card>
      )}
      {!q && <Empty>콘텐츠 ID, 링크 또는 제목을 입력하여 검색하십시오.</Empty>}
    </AdminPage>
  );
}
