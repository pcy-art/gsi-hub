// The engine's ways in, one panel each: what it is for, the steps to connect, then the details folded away.
// Addresses are the site's configured public address (`base`); what visitors copy carries the site's tag
// (CopyTag) when it has one.
import { Fragment, useState } from "react";
import { Link } from "react-router";
import { PUBLIC_INTERFACE_VERSION } from "@aihot/contracts/http-policy";
import { MCP_TOOL_NAMES as T, MCP_TOOLS } from "@aihot/contracts/mcp";
import { feedCategoryLabel, PUBLIC_API_CATEGORY_KEYS } from "@aihot/contracts/taxonomy";
import { ACCESS, AGENT, EDITION_WHEN, POLICY, REPORTS, SITE, subjectAfter, withSubject } from "@aihot/site";
import { CodeBlock, CopyButton } from "./CodeBlock";
import { PillTabs } from "../../components/ui/Tabs";
import type { AgentPanelProps } from "../../modules";
import { AGENT_PARTS, GUIDE_CLIENTS, TAG } from "./module-parts";
import { Address, Ask, Block, Bullets, Details, Mono, PanelHead, Step, Steps, Table, Tips } from "./parts";

const V = PUBLIC_INTERFACE_VERSION;

/** Every MCP tool: the engine's and the modules'. */
export const mcpToolCount = () => MCP_TOOLS.length + AGENT_PARTS.reduce((n, a) => n + (a.tools?.length ?? 0), 0);
const link = "text-accent hover:underline";

/** An address on this site as the copy buttons copy it, with the tag. */
function addressOf({ base, tag }: AgentPanelProps, path: string): string {
  return TAG && tag ? `${base}${path}?${TAG.query}=${tag}` : `${base}${path}`;
}

const MCP_CLIENTS = [
  { key: "claude", label: "Claude Code" },
  { key: "codex", label: "Codex" },
  { key: "json", label: "JSON 설정" },
  { key: "other", label: "기타 클라이언트" },
] as const;

export function McpPanel(props: AgentPanelProps) {
  const url = addressOf(props, "/api/mcp");
  const name = SITE.mcpPrefix;
  const [client, setClient] = useState<string>("claude");
  return (
    <>
      <PanelHead label={`MCP · ${V}`} title={`URL 한 줄로 Agent에 ${mcpToolCount()}개의 인텔리전스 도구 연동`}>
        표준 Streamable HTTP 기반으로 완전 비인증 읽기 전용을 지원합니다. 별도 토큰이나 계정 로그인이 필요 없습니다. Claude Desktop, Cursor, Cherry Studio 등 원격 MCP를 지원하는 모든 클라이언트에 적합합니다.
      </PanelHead>
      <Steps>
        <Step n={1} title="서비스 URL 복사">
          <Address url={url} />
          {TAG && <p className="mt-2 text-[13px] text-ink-3">{TAG.mcp}</p>}
        </Step>
        <Step n={2} title="MCP 클라이언트에 추가">
          <PillTabs className="mt-3" size="xs" layoutId="agent-mcp-client" label="클라이언트" active={client} onSelect={setClient} items={MCP_CLIENTS.map((c) => ({ key: c.key, label: c.label }))} />
          {client === "claude" && <CodeBlock className="mb-0 mt-3" lang="bash" code={`claude mcp add --transport http ${name} '${url}'`} />}
          {client === "codex" && <CodeBlock className="mb-0 mt-3" lang="bash" code={`codex mcp add ${name} --url '${url}'`} />}
          {client === "json" && <CodeBlock className="mb-0 mt-3" title="Cursor, Cherry Studio 등 JSON 설정을 사용하는 클라이언트" lang="json" code={JSON.stringify({ mcpServers: { [name]: { type: "http", url } } }, null, 2)} />}
          {client === "other" && <p className="mt-3">{`클라이언트의 MCP 또는 커넥터 설정에서 새 항목 추가: 이름은 ${name}, URL은 상기 주소 입력, 인증은 '없음(None)'을 선택하세요. 로컬 명령만 지원하는 클라이언트는 자체 원격 프록시를 활용하세요.`}</p>}
        </Step>
        <Step n={3} title="Agent 호출 테스트">
          <Ask text={`[${T.latest}] 도구를 호출하여 지난 24시간 동안 가장 중요한 5건의 안보 정세를 요약하고 ${SITE.name} 원문 링크를 첨부해줘.`} />
          <p className="mt-2 text-[13px] text-ink-3">{`클라이언트가 ${T.latest}를 호출하고 시간대, 한국어 요약, ${new URL(props.base).host} 링크를 회신하면 연동 성공입니다.`}</p>
        </Step>
      </Steps>

      <Block title={`${mcpToolCount()}개 인텔리전스 도구`}>
        <Table
          head={["도구명", "기능 설명", "질의 예시"]}
          minWidth={540}
          rows={[
            [<Mono>{T.latest}</Mono>, "지난 24시간 또는 최근 7일간 선별/전체 정세 질의", "오늘 발생한 주요 안보 사건은?"],
            ...(AGENT_PARTS.flatMap((a) => a.tools ?? []).map((t) => [<Mono>{t.name}</Mono>, t.does, t.ask])),
            [<Mono>{T.hot}</Mono>, "실시간 위기/이슈 지수 Top 10 목록", "현재 가장 주목받는 안보 이슈는?"],
            [<Mono>{T.story}</Mono>, "특정 이슈의 타임라인 및 종합 브리핑", "이 사건의 전개 과정과 배경은?"],
            [<Mono>{T.daily}</Mono>, "최신 또는 특정 일자의 일일 정세 보고서", "오늘 정세 일보 보여줘."],
            [<Mono>{T.weekly}</Mono>, "최신 또는 특정 주차의 주간 종합 브리핑", "이번 주 안보 정세 요약해줘."],
            [<Mono>{T.monthly}</Mono>, "최신 또는 특정 월의 월간 결산 보고서", "지난달 주요 안보 결산은?"],
          ]}
        />
      </Block>

      <Details
        items={[
          {
            title: "제약 사항 및 안전 가이드",
            body: (
              <Bullets
                items={[
                  "일반 조회 최대 30건, 핫이슈 최대 10건, 사건 타임라인 최대 50건으로 제한되며 초과 시 오류를 반환합니다.",
                  `${T.story}의 public_id는 핫이슈 도구가 반환한 사건 링크에서 추출해야 하며 임의 추측을 금합니다.`,
                  "제목과 요약은 외부 정보원 기반이므로 정밀 사실 확인이 필요한 경우 원문 링크를 직접 교차 검증하세요.",
                ]}
              />
            ),
          },
          {
            title: "연동 문제 해결",
            body: (
              <Bullets
                items={[
                  "URL 입력 여부 및 클라이언트의 Streamable HTTP 지원 여부를 확인하세요. 신규 도구가 누락된 경우 도구 목록을 새로고침하세요.",
                  "본 서비스는 비인증으로 제공되므로 OAuth나 API Key 입력 요청 시 '없음(None)'을 선택합니다.",
                  "HTTP 429 수신 시 잠시 대기 후 재호출하세요.",
                  <>문제가 지속될 경우 클라이언트 명칭, 버전, 에러 로그를 <Link viewTransition to="/feedback" className={link}>피드백 페이지</Link>에 남겨주세요.</>,
                ]}
              />
            ),
          },
        ]}
      />
    </>
  );
}

const FEED_CATEGORIES = PUBLIC_API_CATEGORY_KEYS.map((k) => [k, feedCategoryLabel(k)] as const);

const FEEDS = [
  { name: "선별 요약", badge: "추천", path: "/feed.xml", desc: "최신 50개 선별 기사의 제목, 핵심 요약, 사이트 및 원문 링크 제공." },
  { name: "선별 전문", path: "/feed/full.xml", desc: "전재가 허용된 공식 정보원의 전체 본문 포함 (그 외 요약문 노출)." },
  { name: "전체 동향", path: "/feed/all.xml", desc: "최근 7일간 수집된 전체 공개 안보 동향 (발행 역순)." },
  { name: withSubject("일보"), path: "/feed/daily.xml", desc: `${EDITION_WHEN.daily} 발행: 헤드라인 및 목차 요약 (최근 30호 보관).` },
  { name: withSubject("주보"), path: "/feed/weekly.xml", desc: `${EDITION_WHEN.weekly} 발행: 주간 종합 및 테마별 정세 요약 (최근 12호 보관).` },
  { name: withSubject("월보"), path: "/feed/monthly.xml", desc: `${EDITION_WHEN.monthly} 발행: 월간 종합 결산 (최근 12호 보관).` },
];

export function RssPanel(props: AgentPanelProps) {
  const lead = "표준 RSS 2.0 리더기 및 n8n, Zapier 등 자동화 도구와 즉시 호환됩니다. 피드 URL은 영구 보장됩니다.";
  return (
    <>
      <PanelHead label="RSS" title="피드 URL 복사 후 리더기 구독">
        {lead}
      </PanelHead>
      <ul className="mt-8 space-y-3">
        {FEEDS.map((f) => (
          <li key={f.path} className="card flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[15.5px] font-semibold text-ink">{f.name}</span>
                {f.badge && <span className="inline-flex h-[18px] items-center rounded-full bg-accent-soft px-2 text-[11px] font-medium text-accent">{f.badge}</span>}
              </div>
              <p className="mt-1 text-[13px] text-ink-3">{f.desc}</p>
            </div>
            <div className="flex items-center gap-2">
              <Address url={addressOf(props, f.path)} />
              <CopyButton text={addressOf(props, f.path)} label="복사" className="shrink-0" />
            </div>
          </li>
        ))}
      </ul>

      <Block title="전략 테마별 피드">
        <Table
          head={["전략 테마", "요약 피드", "전문 피드"]}
          minWidth={420}
          rows={FEED_CATEGORIES.map(([slug, label]) => [
            <span className="font-medium text-ink">{label}</span>,
            <span className="inline-flex items-center gap-2"><Mono>{`/feed/category/${slug}.xml`}</Mono><CopyButton text={addressOf(props, `/feed/category/${slug}.xml`)} className="!h-6 !px-1.5" /></span>,
            <span className="inline-flex items-center gap-2"><Mono>{`/feed/full/category/${slug}.xml`}</Mono><CopyButton text={addressOf(props, `/feed/full/category/${slug}.xml`)} className="!h-6 !px-1.5" /></span>,
          ])}
        />
      </Block>

      <Block title="권장 갱신 주기">
        <p>리더기가 이전 ETag 헤더를 전달하면 내용 변경이 없을 때 304 Not Modified를 반환하여 트래픽을 절약합니다. 30분 단위 갱신을 권장합니다.</p>
        <p className="mt-3 text-[13px] text-ink-3">{`비인증 구독이 허용된다고 하여 무단 상업적 재배포가 허가되는 것은 아닙니다. 자세한 사항은 `}<Link viewTransition to="/terms" className={link}>{POLICY.terms.name}</Link>를 참조하세요.</p>
      </Block>
    </>
  );
}

const RECIPES = [
  { key: "latest", label: "최신 동향 모니터링" },
  { key: "sync", label: "선별 데이터 전체 동기화" },
];

export function ApiPanel(props: AgentPanelProps) {
  const { base, tag } = props;
  const userAgent = [ACCESS.userAgent, TAG && tag ? TAG.userAgent(tag) : null].filter(Boolean).join(" ");
  const curl = `curl --compressed${userAgent ? ` -A '${userAgent}'` : ""}`;
  let pace = `갱신 주기 안내: 신규 동향은 24시간 상시 인입되며, 선별 정세는 수시로 업데이트됩니다. 일보는 ${EDITION_WHEN.daily}, 주보는 ${EDITION_WHEN.weekly}, 월보는 ${EDITION_WHEN.monthly}에 각각 발행됩니다.`;
  if (ACCESS.ratePerMinute) pace += ` 동일 IP 기준 분당 ${ACCESS.ratePerMinute}회 초과 시 429가 반환되므로 Retry-After 헤더를 준수하십시오.`;
  const [recipe, setRecipe] = useState<string>("latest");
  const recipes = AGENT_PARTS.flatMap((a) => a.recipes ?? []);
  const items = `${base}/api/v1/items?mode=selected&window=24h&limit=20`;
  return (
    <>
      <PanelHead label={`REST API · ${V}`} title="비인증 GET 호출로 즉시 연동">
        토큰이 불필요하며 브라우저 CORS, curl, Python 등 표준 HTTP 클라이언트로 즉시 호출 가능합니다. 기본 경로는 /api/v1이며 필드 명세는 <a href="/openapi-v1.json" className={link}>OpenAPI 3.1</a> 문서를 참조하세요.
      </PanelHead>
      <CodeBlock className="mt-6" title="첫 번째 요청 호출" lang="bash" code={`${curl} '${items}'`} />

      <Block title="카테고리별 필터링">
        <p>요청 쿼리에 <Mono>category</Mono>를 추가하여 특정 전략 테마만 선별할 수 있습니다. 미지정 시 전체 테마가 반환됩니다.</p>
        <Table head={["전략 테마", "요청 파라미터"]} rows={FEED_CATEGORIES.map(([key, name]) => [name, <Mono>{`category=${key}`}</Mono>])} />
      </Block>

      <Block title="효율적인 연동 및 최적화">
        <Tips
          items={[
            { title: "압축 활성화", text: <>curl 호출 시 <Mono>--compressed</Mono>를 추가하거나 gzip/br을 사용하세요. 응답 크기가 1/4 ~ 1/8로 감소합니다.</> },
            { title: "ETag 활용", text: <>응답 헤더의 ETag를 저장한 뒤 다음 호출 시 <Mono>If-None-Match</Mono>에 전달하세요. 변경 사항이 없으면 304가 반환됩니다.</> },
            { title: "주기 조절", text: `동향 및 핫이슈는 분당 1회, 일보는 ${EDITION_WHEN.daily} 이후 1회 호출을 권장합니다.` },
          ]}
        />
        <p className="mt-3 text-[13px] leading-[1.75] text-ink-3">{pace}</p>
      </Block>

      <Block title="API 엔드포인트 목록">
        <Table
          head={["엔드포인트 경로", "기능 설명", "권장 호출 빈도"]}
          minWidth={640}
          rows={[
            { group: "정세 동향" },
            [<Mono>/api/v1/items</Mono>, "선별 또는 최근 7일 전체 동향 (분류, 시간창, 키워드 검색 지원)", "최대 1분 1회"],
            { group: "위기 지수 및 사건" },
            [<Mono>/api/v1/hot-topics</Mono>, "실시간 핫이슈 Top 10 목록", "최대 1분 1회"],
            [<Mono>{"/api/v1/stories/{publicId}"}</Mono>, "특정 사건의 타임라인, AI 브리핑 및 연관 사건", "필요시 수시"],
            { group: "정세 일보" },
            [<Mono>/api/v1/dailies/latest</Mono>, "최신 정세 일보", `${EDITION_WHEN.daily} 이후 1회`],
            [<Mono>{"/api/v1/dailies/{date}"}</Mono>, "특정 일자 일보 (YYYY-MM-DD)", "캐시 만료 후 ETag 검증"],
            [<Mono>/api/v1/dailies</Mono>, "일보 발행 일자 인덱스", "일 1회"],
            { group: "주간 및 월간 보고서" },
            [<Mono>/api/v1/weeklies/latest</Mono>, "최신 주간 종합 보고서", `${EDITION_WHEN.weekly} 이후 1회`],
            [<Mono>{"/api/v1/weeklies/{week}"}</Mono>, "특정 주차 주보 (예: 2026-W39)", "캐시 만료 후 ETag 검증"],
            [<Mono>/api/v1/weeklies</Mono>, "주보 발행 인덱스", "주 1회"],
            [<Mono>/api/v1/monthlies/latest</Mono>, "최신 월간 결산 보고서", `${EDITION_WHEN.monthly} 이후 1회`],
            [<Mono>{"/api/v1/monthlies/{month}"}</Mono>, "특정 월 결산 (예: 2026-09)", "캐시 만료 후 ETag 검증"],
            [<Mono>/api/v1/monthlies</Mono>, "월보 발행 인덱스", "월 1회"],
            ...AGENT_PARTS.flatMap((a) => (a.api ? [{ group: a.api.group }, ...a.api.rows.map(([path, does, often]) => [<Mono>{path}</Mono>, does, often])] : [])),
            { group: "AI 어시스턴트 전용" },
            [<Mono>/api/v1/agent</Mono>, "AI 에이전트 전용 마크다운 안내서 및 가이드", "필요시"],
            { group: "데이터 전체 동기화" },
            [<Mono>/api/v1/selected/snapshot</Mono>, "선별 데이터 전체 스냅샷 (페이지네이션)", "최초 1회"],
            [<Mono>/api/v1/selected/changes</Mono>, "증분 변경분 (신규, 수정, 철회)", "수 분 단위"],
          ]}
        />
      </Block>

      <Block title="연동 레시피">
        <PillTabs size="xs" layoutId="agent-api-recipe" label="레시피" active={recipe} onSelect={setRecipe} items={[...RECIPES, ...recipes].map((r) => ({ key: r.key, label: r.label }))} />
        {recipe === "latest" && (
          <>
            <CodeBlock className="mb-3 mt-3" lang="bash" code={`# 최초 호출: 응답 헤더의 ETag 저장\n${curl} -i '${items}'\n# 이후 주기적 호출: ETag 동봉 (304 반환 시 내용 불변)\n${curl} -i -H 'If-None-Match: <이전 ETag>' '${items}'`} />
            <p>이전 목록을 조회할 때는 <Mono>page.nextCursor</Mono>를 cursor 인자로 전달하며, 이미 수집된 지점에 도달하면 조회를 중단합니다.</p>
          </>
        )}
        {recipe === "sync" && (
          <>
            <CodeBlock className="mb-3 mt-3" lang="bash" code={`# 1단계: 전체 스냅샷 수집 및 첫 페이지의 cursor 보관\n${curl} '${base}/api/v1/selected/snapshot?fields=minimal&limit=500'\n# hasMore=true 시 nextPage 파라미터로 끝까지 수집\n${curl} '${base}/api/v1/selected/snapshot?fields=minimal&limit=500&page=<nextPage>'\n# 2단계: 이후 증분 변경분만 동기화\n${curl} '${base}/api/v1/selected/changes?cursor=<보관된 cursor>&limit=100'`} />
            <p>로컬 DB에 저장이 완료된 후 새 cursor를 갱신합니다. 409 <Mono>snapshot_required</Mono> 오류 수신 시 전체 스냅샷을 1단계부터 다시 수집합니다.</p>
          </>
        )}
        {recipes.map((r) => recipe === r.key && <r.Body key={r.key} base={base} curl={curl} />)}
      </Block>

      <Block title="오류 코드 안내" id="agent-api-recovery">
        <dl className="grid grid-cols-[76px_minmax(0,1fr)] gap-x-3 gap-y-2.5">
          <dt className="mono text-[13px] text-ink">400</dt>
          <dd>파라미터 오류: OpenAPI 명세 및 에러 코드를 확인하여 요청을 수정하세요. 커서 만료 시 invalid_cursor가 반환됩니다.</dd>
          <dt className="mono text-[13px] text-ink">409</dt>
          <dd>snapshot_required: 증분 커서가 유효 범위를 벗어났으므로 전체 스냅샷(/snapshot)을 다시 호출하세요.</dd>
          <dt className="mono text-[13px] text-ink">429</dt>
          <dd>호출 빈도 초과: Retry-After 헤더의 대기 시간을 준수하고 동시 다발적 재시도를 중단하세요.</dd>
          <dt className="mono text-[13px] text-ink">5xx</dt>
          <dd>서버 일시 오류: 지수 백오프(Exponential Backoff)를 적용하고 이전 캐시 데이터를 활용하세요.</dd>
          {AGENT_PARTS.flatMap((a) => a.apiErrors ?? []).map(([status, what]) => (
            <Fragment key={status}>
              <dt className="mono text-[13px] text-ink">{status}</dt>
              <dd>{what}</dd>
            </Fragment>
          ))}
        </dl>
        <p className="mt-4 text-[13px] text-ink-3">{`비인증 호출이 허용된다고 하여 무단 상업적 재배포가 허가되는 것은 아닙니다. 자세한 사항은 `}<Link viewTransition to="/terms" className={link}>{POLICY.terms.name}</Link>를 참조하세요.</p>
      </Block>
    </>
  );
}
