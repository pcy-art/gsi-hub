import { SITE, SOURCE_DEFAULTS } from "@aihot/site";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import type { Route } from "./+types/source-new";
import type { AdminSourceCreated, AdminSourcePreview } from "@aihot/contracts/admin";
import { useAdminAction } from "../../features/admin/action";
import { bj } from "../../features/admin/format";
import { KIND_LABEL, MODE_LABEL, SELECTION_CLASS_LABEL, TIER_LABEL } from "../../features/admin/labels";
import { AdminPage, Button, Card, Empty, Field, Input, Select, Textarea } from "../../features/admin/ui";

export const meta: Route.MetaFunction = () => [{ title: `신규 수집원 등록 · ${SITE.name} 관리자` }];

const TEMPLATES: Record<string, Record<string, unknown>> = {
  rss: { feedUrl: "https://example.com/feed.xml" },
  web_list: { url: "https://example.com/blog", baseUrl: "https://example.com", itemSelector: "article", linkSelector: "a", titleSelector: "h2", allowUrlPrefixes: ["https://example.com/blog/"] },
  json_list: { url: "https://example.com/api/posts", mode: "json_api", method: "GET", itemsPath: "data.items", titlePaths: ["title"], urlTemplate: "{raw:url}", summaryPaths: ["summary"] },
  x_search: { query: "from:handle -filter:replies", searchType: "Latest" },
  mp_account: { ghid: "gh_", nickname: "" },
  external: {},
};


export default function NewSource() {
  const navigate = useNavigate();
  const { run, pending } = useAdminAction();
  const [form, setForm] = useState({ id: "", name: "", kind: "rss", tier: "T2", selection_class: "", participation_mode: "editorial", interval_minutes: 30, first_party: false, site_fulltext: SOURCE_DEFAULTS.siteFulltext, syndicate_fulltext: false, tags: "" });
  const [config, setConfig] = useState(JSON.stringify(TEMPLATES.rss, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<AdminSourcePreview | null>(null);
  const [duplicate, setDuplicate] = useState<{ id: string; name: string } | null>(null);

  const parsed = () => {
    try {
      setError(null);
      return JSON.parse(config) as Record<string, unknown>;
    } catch (e) {
      setError(`설정이 올바른 JSON 규격이 아닙니다: ${(e as Error).message}`);
      return null;
    }
  };

  return (
    <AdminPage title="신규 수집원 등록" subtitle="사전 중복 검증 및 수집 미리보기를 제공합니다. RSS, REST JSON 등 신뢰할 수 있는 수집 프로토콜을 우선 권장합니다. 1차 출처 여부는 정부 기관, 군 사령부, 국방연구원 등 공식 공시 증거가 필요합니다.">
      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <Card title="수집원 정의">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="수집원 ID" hint="영문 소문자, 숫자, 하이픈만 허용되며 생성 후 변경할 수 없습니다">
              <Input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value.toLowerCase() })} placeholder="mnd-press" />
            </Field>
            <Field label="수집원 명칭">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="국방부 보도자료" />
            </Field>
            <Field label="프로토콜 유형">
              <Select
                value={form.kind}
                onChange={(e) => {
                  setForm({ ...form, kind: e.target.value });
                  setConfig(JSON.stringify(TEMPLATES[e.target.value] ?? {}, null, 2));
                  setPreview(null);
                }}
              >
                {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="수집 주기 (분)">
              <Input type="number" min={1} max={1440} value={form.interval_minutes} onChange={(e) => setForm({ ...form, interval_minutes: Number(e.target.value) })} />
            </Field>
            <Field label="파이프라인 모드">
              <Select value={form.participation_mode} onChange={(e) => setForm({ ...form, participation_mode: e.target.value })}>
                {Object.entries(MODE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="출처 등급" hint="T1은 1차 공식 발표 출처">
              <Select value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })}>
                {Object.entries(TIER_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="선별 분류" hint="엄선 판정 기준 가중치 부여">
              <Select value={form.selection_class} onChange={(e) => setForm({ ...form, selection_class: e.target.value })}>
                <option value="">미지정 (등급 기본값 적용)</option>
                {Object.entries(SELECTION_CLASS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="태그 (쉼표로 구분)">
              <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
            </Field>
            <div className="flex flex-col justify-end gap-2 text-[13px] text-ink-2">
              {([
                ["site_fulltext", "사이트 내 전체 본문 표시 허용"],
                ["syndicate_fulltext", "외부 연동 시 전체 본문 제공 허용"],
              ] as const).map(([k, label]) => (
                <label key={k} className="inline-flex items-center gap-2">
                  <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.checked })} />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <Field label="수집 상세 설정 (JSON)">
              <Textarea className="font-mono !text-[12px]" rows={10} value={config} onChange={(e) => setConfig(e.target.value)} spellCheck={false} />
            </Field>
            {error && <div className="mt-1 text-[12.5px] text-hot">{error}</div>}
          </div>
          {duplicate && (
            <div className="mt-4 rounded-card bg-amber/10 px-4 py-3 text-[13px] text-ink-2 ring-1 ring-amber/25">
              이미 등록된 주소입니다: <Link className="font-medium text-accent" to={`/admin/sources/${encodeURIComponent(duplicate.id)}`}>{duplicate.name}</Link> ({duplicate.id}). 중복 생성되지 않았습니다.
            </div>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <Button
              busy={pending === "preview"}
              onClick={async () => {
                const c = parsed();
                if (!c) return;
                const r = await run<AdminSourcePreview>("POST", "/api/admin/sources/preview", { id: form.id || "draft", kind: form.kind, config: c }, { label: "preview", revalidate: false });
                if (r) setPreview(r);
              }}
            >
              수집 미리보기
            </Button>
            <Button
              tone="primary"
              busy={pending === "create"}
              disabled={!form.id || !form.name}
              onClick={async () => {
                const c = parsed();
                if (!c) return;
                const r = await run<AdminSourceCreated>(
                  "POST",
                  "/api/admin/sources",
                  { ...form, selection_class: form.selection_class || null, tags: form.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean), config: c },
                  { label: "create", revalidate: false },
                );
                if (!r) return;
                if (r.created) navigate(`/admin/sources/${encodeURIComponent(r.source.id)}`);
                else setDuplicate(r.duplicate);
              }}
            >
              수집원 등록
            </Button>
          </div>
        </Card>
        <Card title={preview ? `미리보기: ${preview.count}건 (${preview.ms}ms)` : "수집 미리보기"}>
          {!preview ? (
            <Empty>수집 설정을 입력한 후 '수집 미리보기'를 클릭하면 수집될 샘플 항목이 표시됩니다 (DB에 저장되지 않음).</Empty>
          ) : preview.items.length ? (
            <ul className="space-y-3">
              {preview.items.map((i) => (
                <li key={i.url} className="text-[13px]">
                  <a href={i.url} target="_blank" rel="noreferrer" className="font-medium text-ink hover:text-accent">{i.title}</a>
                  <div className="text-[12px] text-ink-4">{i.publishedAt ? bj(i.publishedAt, true) : "발행 일시 없음"}</div>
                  {i.excerpt && <div className="mt-0.5 line-clamp-2 text-[12.5px] text-ink-3">{i.excerpt}</div>}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>수집된 항목이 없습니다.</Empty>
          )}
        </Card>
      </div>
    </AdminPage>
  );
}
