// Topic pages: which articles a topic takes, and their counts.
// Written before the code, from the ways it can go wrong:
// - a company topic takes an article about another company that only mentions it (several subjects,
//   its name nowhere in the title), or drops one about it whose title names it in English, in another
//   case, next to Chinese text, or only by a product (it is the article's only subject);
// - a Latin name matches inside another word ("Metadata" is not Meta); a headline naming a company
//   that is not a subject of the article gets in;
// - a technical-direction topic stops taking its tags;
// - withdrawn or not yet released articles appear in a list or a count;
// - an article or story page names a topic its reports do not belong to;
// - a topic without content has no page, or an unknown slug or a page past the end has one.
import { tag } from "./setup.ts";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { upsertMaterial } from "@aihot/backend/content/materials";
import { stopBoss } from "@aihot/backend/jobs/queue";
import { publishArticle } from "@aihot/backend/publication/publish";
import { TOPICS, loadTopicPage, listTopicSummaries, topicsOfStory } from "@aihot/backend/publication/topics";
import { buildApp } from "../apps/api/src/app.ts";

const T = tag();
const OFFICIAL = `test-topics-official-${T}`;
const MEDIA = `test-topics-media-${T}`;
const app = await buildApp();

before(async () => {
  await sql`INSERT INTO sources (id, name, kind, tier, participation_mode, first_party, next_fetch_at) VALUES
    (${OFFICIAL}, 'Official', 'rss', 'T1', 'editorial', true, '2100-01-01'),
    (${MEDIA}, 'Media', 'rss', 'T2', 'editorial', false, '2100-01-01')`;
});
after(async () => {
  await app.close();
  await stopBoss();
  await closeDb();
});

let n = 0;
interface Report {
  source?: string;
  at: Date;
  title: string;
  originalTitle?: string;
  subjects?: string[];
  tags?: string[];
  score?: number;
  selected?: boolean;
  fact?: number;
  category?: string;
}

/** A published report; `fact` links it to a fact before publishing, as grouping would. */
async function report(r: Report): Promise<string> {
  n += 1;
  const { articleId } = await upsertMaterial({
    sourceId: r.source ?? MEDIA, url: `https://example.com/topics-${T}-${n}`, title: r.originalTitle ?? r.title, bodyText: "body", bodyHtml: "<p>body</p>", bodyStatus: "ok", via: "fetch", publishedAt: r.at,
  });
  await sql`UPDATE articles SET discovered_at = ${r.at}, timeline_at = ${r.at}, grouped_at = now() WHERE id = ${articleId}`;
  await sql`INSERT INTO analyses (article_id, input_revision, origin, relevance, category, title_zh, summary_zh, score, selected, subjects, tags)
            VALUES (${articleId}, 1, 'rule', 'pass', ${r.category ?? "military_strategic"}, ${r.title}, ${`요약 ${n}`}, ${r.score ?? 80}, ${r.selected ?? true}, ${r.subjects ?? []}, ${[r.category === "maritime_security" ? "해양 도발/충돌" : r.category === "hybrid_cyber_crime" ? "사이버 공격/APT" : r.category === "economic_security" ? "공급망/광물 통제" : r.category === "alliance_sanctions" ? "정상회담/동맹" : r.category === "opinion" ? "전문가 정세 평가" : "미사일 도발", ...(r.tags ?? [])]})`;
  if (r.fact) await sql`INSERT INTO fact_articles (fact_id, article_id, role) VALUES (${r.fact}, ${articleId}, 'report')`;
  await publishArticle(articleId, { releasedAt: new Date(r.at.getTime() + 60_000) });
  return articleId;
}

async function story(title: string): Promise<{ id: number; publicId: string }> {
  const publicId = randomUUID();
  const [s] = await sql<{ id: number }[]>`INSERT INTO stories (public_id, title, first_report_at, latest_at) VALUES (${publicId}, ${title}, now(), now()) RETURNING id`;
  return { id: s!.id, publicId };
}

async function fact(storyId: number | null, title: string): Promise<number> {
  const [f] = await sql<{ id: number }[]>`INSERT INTO facts (public_id, story_id, title) VALUES (${`f-${T}-${randomUUID()}`}, ${storyId}, ${title}) RETURNING id`;
  return f!.id;
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);
const ids = (items: Array<{ id: string }>) => items.map((i) => i.id);
const page = async (slug: string, p = 1) => {
  const data = await loadTopicPage(slug, p, new Date());
  assert.ok(data, `${slug} page ${p}`);
  return data;
};
/** Every article of a topic, over all its pages. */
async function members(slug: string): Promise<string[]> {
  const first = await page(slug);
  const out = ids(first.items);
  for (let p = 2; p <= first.pageCount; p++) out.push(...ids((await page(slug, p)).items));
  return out;
}

test("a company topic takes the articles about it, not the ones that only mention it", async () => {
  const about = await report({ at: hoursAgo(30), title: `DoD 국방 전략 발표 ${T}`, subjects: ["us-dod"] });
  const product = await report({ at: hoursAgo(31), title: `펜타곤 전력 배치 ${T}`, subjects: ["us-dod"] });
  const english = await report({ at: hoursAgo(32), title: `신형 무기 공개 ${T}`, originalTitle: `Pentagon updates posture ${T}`, subjects: ["us-dod", "dprk"] });
  const subpoena = await report({ at: hoursAgo(33), title: `국제사회, DPRK 제재 보고 ${T}`, subjects: ["dprk", "us-dod", "jcs-korea"] });
  const lowerCase = await report({ at: hoursAgo(34), title: `dprk 신규 미사일 시험 ${T}`, subjects: ["dprk", "us-dod"] });
  const pact = await report({ at: hoursAgo(35), title: `다자 안보 성명 발표 ${T}`, subjects: ["dprk", "us-dod", "jcs-korea"] });
  const metadata = await report({ at: hoursAgo(36), title: `NATOesque 회의, DPRK 논의 ${T}`, subjects: ["nato", "dprk"] });
  const adjacent = await report({ at: hoursAgo(37), title: `발표NATO의 공동 성명 ${T}`, subjects: ["nato", "dprk"] });
  const headline = await report({ at: hoursAgo(38), title: `DoD 종합 보도에 언급 ${T}`, subjects: ["jcs-korea"] });
  const agent = await report({ at: hoursAgo(39), title: `사이버 해킹 포착 ${T}`, tags: ["라자루스"] });

  const usDod = await members("us-dod");
  for (const id of [about, product, english]) assert.ok(usDod.includes(id), "about DoD");
  for (const id of [subpoena, lowerCase, pact, headline]) assert.ok(!usDod.includes(id), "only mentions DoD");
  const dprk = await members("dprk");
  for (const id of [subpoena, lowerCase, metadata]) assert.ok(dprk.includes(id), "about DPRK");
  for (const id of [english, pact]) assert.ok(!dprk.includes(id), "only mentions DPRK");
  const nato = await members("nato");
  assert.ok(nato.includes(adjacent), "NATO next to Korean text");
  assert.ok(!nato.includes(metadata), "NATOesque is not NATO");
  assert.ok((await members("lazarus-apt")).includes(agent), "a field topic takes its tag");

  // The article page names the topics it belongs to.
  const topicsOf = async (id: string) => {
    const res = await app.inject({ method: "GET", url: `/api/site/items/${id}` });
    return (JSON.parse(res.body) as { topics: Array<{ slug: string }> }).topics.map((t) => t.slug);
  };
  assert.deepEqual(await topicsOf(about), ["us-dod", "missile-provocation"]);
  assert.deepEqual(await topicsOf(subpoena), ["dprk", "missile-provocation"]);
  assert.deepEqual(await topicsOf(pact), ["missile-provocation"]);
  assert.deepEqual(await topicsOf(agent), ["lazarus-apt", "missile-provocation"]);
});

test("renaming a company topic keeps its old full name usable for search", async () => {
  const id = await report({at: hoursAgo(2), title: `중국군 합동훈련 ${T}`, subjects: ['prc-pla'], selected: false});
  for (const query of ['중국 국방부 / 인민해방군 (PLA)', '중국 외교부']) {
    const res = await app.inject({method: 'GET', url: `/api/site/pool?q=${encodeURIComponent(query)}`});
    assert.equal(res.statusCode, 200);
    assert.ok(ids(JSON.parse(res.body).items).includes(id), 'full company names must still find subject-tagged reports');
  }
});

test("a story page names the topics of its reports", async () => {
  const launch = await story(`라자루스 사이버 작전 ${T}`);
  await report({ source: OFFICIAL, at: hoursAgo(26), title: `라자루스 사이버 작전 ${T}`, tags: ["라자루스"], fact: await fact(launch.id, "작전 포착") });
  assert.deepEqual(await topicsOfStory(launch.id), [{ slug: "lazarus-apt", name: "대북 사이버 공작 (라자루스)" }, { slug: "missile-provocation", name: "미사일·무력 도발" }]);
});

test("withdrawn articles stay out of lists and counts", async () => {
  const kept = await report({ at: hoursAgo(5), title: `PLA 해상 훈련 ${T}`, subjects: ["prc-pla"] });
  const withdrawn = await report({ at: hoursAgo(4), title: `PLA 철회된 보도 ${T}`, subjects: ["prc-pla"] });
  await sql`UPDATE publications SET visibility = 'withdrawn' WHERE article_id = ${withdrawn}`;

  const data = await page("prc-pla");
  assert.deepEqual(ids(data.items), [kept]);
  assert.equal(data.topic.total, 1);
  const summary = (await listTopicSummaries()).topics.find((t) => t.slug === "prc-pla")!;
  assert.equal(summary.latest?.title, `PLA 해상 훈련 ${T}`, "the index shows the newest public article");
});

test("every topic has a page; unknown topics and pages past the end have none", async () => {
  const empty = await page("iran-irgc");
  assert.equal(empty.topic.indexable, false, "a topic without content is not indexed");
  assert.deepEqual(empty.items, []);
  assert.equal(await loadTopicPage("not-a-topic", 1, new Date()), null);
  assert.equal(await loadTopicPage("iran-irgc", 2, new Date()), null);
  const index = await app.inject({ method: "GET", url: "/api/site/topics" });
  const body = JSON.parse(index.body) as { groups: Array<{ key: string }>; topics: Array<{ slug: string }> };
  assert.deepEqual(body.groups.map((g) => g.key), ["company", "field", "genre"]);
  assert.deepEqual(body.topics.map((t) => t.slug).sort(), TOPICS.map((t) => t.slug).sort(), "the index lists every topic");
});
