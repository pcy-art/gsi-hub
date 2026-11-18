import { gate, stub, tag } from "./setup.ts";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { pickRepresentative, representativePriority } from "@aihot/backend/publication/representative";
import { loadTimeline } from "@aihot/backend/publication/timeline";
import { loadStoryFollowups } from "@aihot/backend/publication/followups";
import { loadGroupReports } from "@aihot/backend/publication/groups";
import { loadItemDetail } from "@aihot/backend/publication/detail";
import { loadStoryDetail, v1HotTopics, v1Story } from "@aihot/backend/publication/stories";
import { candidates } from "@aihot/backend/reports/edition";
import { composeStoryDigest, DIGEST_PROMPT_VERSION, DIGEST_SYSTEM, DigestSchema } from "@aihot/backend/events/digest";
import { chatJson } from "@aihot/backend/providers/llm";
import { computeHotRanking } from "@aihot/backend/events/hot";
import { detachFromFact, moveToFact, rewriteStoryDigest } from "@aihot/backend/events/corrections";
import { overrideFields, setVisibility } from "@aihot/backend/admin/content";
import { stopBoss } from "@aihot/backend/jobs/queue";
import { latestHotRanking } from "@aihot/backend/publication/hot";
import { storyTexts } from "@aihot/backend/publication/story-text";

const key = `evidence-${tag()}`;
const now = new Date();
const at = (hours: number) => new Date(+now - hours * 3600_000);
let digestPrompt = "";
let digestHold: { entered: ReturnType<typeof gate<void>>; release: ReturnType<typeof gate<void>> } | null = null;
const provider = await stub(async (_hit, req) => {
  digestPrompt = JSON.parse(req.body).messages[1].content;
  if (digestHold) {
    const hold = digestHold;
    digestHold = null;
    hold.entered.open();
    await hold.release.promise;
  }
  return { id: "local", choices: [{ message: { content: JSON.stringify({ title: "DoD, Dots 체계 공개", digest: "Dots 대화 기능은 사용 가능하나 자율 실행 작업은 할당량을 소모합니다.", latest: "모델이 생성한 무관한 최신 진전은 사용할 수 없음" }) } }], usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 } };
});
process.env.DEEPSEEK_BASE_URL = `${provider.url}/v1`;
process.env.DEEPSEEK_API_KEY = "test-key";
after(async () => { await provider.close(); await stopBoss(); await closeDb(); });

async function source(suffix: string, tier: string, owner: string | null = null, role: string | null = null) {
  const id = `${key}-${suffix}`;
  await sql`INSERT INTO sources (id,name,kind,tier,participation_mode,owner_entity_id,config,first_party,next_fetch_at)
    VALUES (${id},${suffix},'rss',${tier},'editorial',${owner},${sql.json(role ? { publisherRole: role } : {})},${tier !== 'T1'},'2100-01-01')`;
  return id;
}
async function story(title = "DoD, Dots 체계 공개") {
  const [s] = await sql`INSERT INTO stories (public_id,title,first_report_at,latest_at,latest) VALUES (${randomUUID()},${title},${at(100)},${at(0)},'잘못 생성된 진전') RETURNING id, public_id`;
  const [f] = await sql`INSERT INTO facts (public_id,story_id,title,subject,action,object,conditions)
    VALUES (${`f-${randomUUID()}`},${s!.id},${title},'DoD','발표','Dots','자율 실행 작업 소모') RETURNING id, public_id`;
  return { storyId: Number(s!.id), storyPublicId: s!.public_id as string, factId: Number(f!.id), factPublicId: f!.public_id as string };
}
async function report(sourceId: string, group: Awaited<ReturnType<typeof story>>, opts: { title: string; hours: number; selected?: boolean; score?: number; role?: string }) {
  const id = `${key}-${randomUUID()}`;
  const date = at(opts.hours);
  await sql`INSERT INTO articles (id,source_id,identity_key,url,title,timeline_at,discovered_at,published_at)
    VALUES (${id},${sourceId},${id},${`https://example.org/${id}`},${opts.title},${date},${date},${date})`;
  const [a] = await sql`INSERT INTO analyses (article_id,input_revision,origin,relevance,title_zh,summary_zh,score,selected,output)
    VALUES (${id},1,'rule','pass',${opts.title},${opts.title},${opts.score ?? 70},${opts.selected ?? true},
      ${sql.json({ fact: { evidence: "Tasks consume usage.", conditions: [{ text: "자율 작업 시 할당량 소모", quote: "Tasks consume usage." }] } })}) RETURNING id`;
  await sql`INSERT INTO publications (article_id,analysis_id,source_id,title,summary,url,channel,first_party,timeline_at,discovered_at,published_at,sort_at,
    story_id,fact_id,selected,eligible,visible_after,tags,body_mode,score)
    VALUES (${id},${a!.id},${sourceId},${opts.title},${opts.title},${`https://example.org/${id}`},'news',true,${date},${date},${date},${date},
    ${group.storyId},${group.factId},${opts.selected ?? true},true,${date},${[key]},'full',${opts.score ?? 70})`;
  await sql`INSERT INTO fact_articles (fact_id,article_id,role,evidence) VALUES (${group.factId},${id},${opts.role ?? 'report'},'Tasks consume usage.')`;
  return id;
}

test("source tier and event ownership are separate; mentions of an entity do not establish authority", () => {
  const row = { body_mode: "full" as const, score: 70, timeline_at: now, source_tier: "T2", publisher_role: null, owner_entity_id: null, fact_subject: "DoD" };
  const org = { ...row, source_tier: "T1_5", publisher_role: "organization", owner_entity_id: "us-dod", score: 60 };
  const person = { ...org, publisher_role: "person", score: 90 };
  assert.equal(pickRepresentative([person, org]), org);
  const first = { ...row, source_tier: "T1", score: 40, first_party: false };
  assert.equal(pickRepresentative([org, first]), first, "T1 does not depend on the first_party flag");
  for (const subject of [null, "Databricks", "DoD 협력사", "John Doe (@doe)"]) {
    assert.equal(representativePriority({ ...org, fact_subject: subject }), 3, String(subject));
  }
  assert.equal(representativePriority({ ...org, fact_subject: "Pentagon" }), 1, "exact configured entity alias");
  assert.equal(representativePriority({ ...org, fact_subject: "DoD / 국방부" }), 1, "explicit co-subject list");
  assert.equal(representativePriority({ ...org, owner_entity_id: "dprk", fact_subject: "조선중앙통신" }), 1, "the entity under another of its own names");
  assert.equal(representativePriority({ ...org, owner_entity_id: "prc-pla", fact_subject: "중국 인민해방군 + 동부전구" }), 1);
  assert.equal(representativePriority({ ...org, owner_entity_id: "dprk", fact_subject: "KCNA" }), 1, "DPRK alternate name");
  assert.equal(representativePriority({ ...org, owner_entity_id: "iran-irgc", fact_subject: "쿠드스군" }), 1, "IRGC org unit");
  assert.equal(representativePriority({ ...org, owner_entity_id: "russia-mod", fact_subject: "크렘린궁" }), 1, "Russia MoD alias");
  assert.equal(representativePriority({ ...org, fact_subject: "DoD + " }), 3, "incomplete subject list is not evidence");
  assert.equal(representativePriority({ ...org, owner_entity_id: null }), 3);
  assert.equal(representativePriority({ ...org, owner_entity_id: "unregistered-org", fact_subject: "unregistered-org" }), 3, "equal unknown strings are not verified identity");
  assert.equal(representativePriority({ ...org, fact_subject: "DoD + unregistered-org" }), 3, "an unrecognized co-subject is not silently accepted");
  assert.equal(representativePriority({ ...row, first_party: true } as typeof row), 3, "the first_party flag never elevates a source");
});

test("mentions cannot choose a timeline origin, anchor, representative, or a latest-progress link", async () => {
  const organization = await source("organization", "T1_5", "us-dod", "organization");
  const media = await source("media", "T2");
  const t1 = await source("t1", "T1");
  const g = await story();
  const official = await report(organization, g, { title: "Dots 정식 발표", hours: 3, score: 65 });
  const latest = await report(media, g, { title: "Dots 후속 업데이트", hours: 2, score: 90 });
  const earlyMention = await report(t1, g, { title: "EARLY ROUNDUP", hours: 90, role: "mention" });
  const lateMention = await report(t1, g, { title: "LATEST ROUNDUP", hours: 1, role: "mention" });
  await report(t1, g, { title: "미선별 공식 원고", hours: 4, selected: false, score: 30 });
  const q = { channel: "all" as const, category: null, tag: key, now };
  const timeline = await loadTimeline(q);
  const card = timeline.cards.find(c => c.key === `f${g.factId}`)!;
  assert.equal(card.item.id, official);
  assert.equal(card.anchorAt, at(3).toISOString());
  assert.ok(timeline.cards.some(c => c.key === `a${earlyMention}`) && timeline.cards.some(c => c.key === `a${lateMention}`), "a stale mention projection stays an independent selected article");
  assert.equal((await loadStoryFollowups(g.storyPublicId, now))!.items[0]!.representative.id, official);
  const group = await loadGroupReports({ factPublicId: g.factPublicId, channel: "all", category: null, tag: key }, now);
  assert.equal(group?.reports.length, 3, "only primary/report members are same-fact reports");
  const detail = (await loadStoryDetail(g.storyId, now))!;
  assert.equal(detail.developments[0]!.representative.id, official, "unselected T1 cannot enter the selected representative pool");
  assert.equal(detail.firstReportAt, at(4).toISOString());
  assert.deepEqual(detail.latestReport, { id: latest });
  assert.equal(detail.latest, "Dots 후속 업데이트");
  assert.equal(detail.officialReports.length, 1, "only tier T1 has the first-party label");
  assert.equal(detail.developments[0]!.representative.source.firstParty, false);
  const edition = await candidates(at(100), now);
  assert.equal(edition.find((c) => c.factId === g.factPublicId)?.itemId, official, "report editions use the same authority within their own time window");
  assert.equal(edition.find((c) => c.itemId === official)?.firstParty, false);
  assert.equal(edition.find((c) => c.itemId === earlyMention)?.factId, null, "a related roundup stays independent in reports");
  await sql`UPDATE publications SET visibility='withdrawn' WHERE article_id=${latest}`;
  const after = (await loadStoryDetail(g.storyId, now))!;
  assert.equal(after.latestReport!.id, official);
  assert.equal(after.latest, "Dots 정식 발표");
  assert.equal((await v1Story(g.storyId))!.story.latest, after.latest);
  const firstParty = await loadTimeline({ ...q, channel: "firstParty" });
  assert.ok(!firstParty.cards.some(c => c.item.id === official), "a stale true projection flag cannot put T1_5 into first-party channel");
});

// The detail's group badge and its expanded report list must count the same evidence, even while
// an old projection still points to a fact after a report became a mention or composite.
test("item detail counts the same fact evidence as its expanded group", async () => {
  const s = await source("detail-count", "T1");
  const other = await source("detail-count-other", "T2");
  const g = await story();
  const main = await report(s, g, { title: "사건 최초 보도", hours: 3 });
  await report(other, g, { title: "사건 보충 보도", hours: 2 });
  await report(other, g, { title: "단순 언급 기사", hours: 1, role: "mention" });
  const composite = await report(other, g, { title: "복합 사건 종합 기사", hours: 1 });
  await sql`UPDATE analyses SET output = output || '{"scope":"composite"}'::jsonb WHERE article_id = ${composite}`;
  const detail = await loadItemDetail(main, "zh", now);
  assert.equal(detail.kind, "found");
  if (detail.kind !== "found") return;
  const expanded = (await loadGroupReports({ factPublicId: g.factPublicId, channel: "all", category: null, tag: null }, now))!;
  assert.equal(expanded.reports.length, 2);
  assert.equal(detail.item.group!.reportCount, expanded.reports.length);
  assert.equal(detail.item.group!.additionalSourceCount, 1);
});

// A newer archive report may remain readable without qualifying as news. It cannot become the
// machine-only latest development while the website points at a different report; archive-only
// stories still need one shared readable fallback.
test("website and machine stories choose the same latest development and archive fallback", async () => {
  const s = await source("latest-scope", "T1");
  const g = await story();
  const news = await report(s, g, { title: "공개 유지 중인 최근 진전", hours: 3, selected: false });
  const archive = await report(s, g, { title: "공개 목록 미진입 최근 아카이브", hours: 1, selected: false });
  await sql`UPDATE publications SET eligible = false WHERE article_id = ${archive}`;
  for (const [expectedId, expectedTitle, expectedHours] of [[news, "공개 유지 중인 최근 진전", 3], [archive, "공개 목록 미진입 최근 아카이브", 1]] as const) {
    const site = (await loadStoryDetail(g.storyId, now))!;
    const api = (await v1Story(g.storyId))!.story;
    assert.equal(site.latest, expectedTitle);
    assert.equal(site.latestReport!.id, expectedId);
    assert.equal(site.latestAt, at(expectedHours).toISOString());
    assert.equal(api.latest, site.latest);
    assert.equal(api.latestAt, site.latestAt);
    assert.equal(site.reportCount, 2);
    assert.equal(api.reportCount, 2);
    await sql`UPDATE publications SET eligible = false WHERE article_id = ${news}`;
  }
});

test("digest input excludes mentions, preserves scoped conditions, and ignores generated latest", async () => {
  const s = await source("digest", "T1");
  const g = await story();
  const main = await report(s, g, { title: "Dots 작업 할당량 여전히 과금", hours: 5 });
  const mention = await report(s, g, { title: "MENTION MUST NOT ENTER DIGEST", hours: 1, role: "mention" });
  const composite = await report(s, g, { title: "COMPOSITE WAITING FOR GROUP CLEANUP", hours: 1 });
  await sql`UPDATE analyses SET output=output || '{"scope":"composite"}'::jsonb WHERE article_id=${composite}`;
  assert.equal((await candidates(at(100), now)).find((c) => c.itemId === composite)?.factId, null, "known composites cannot occupy a report's fact before projection repair");
  assert.equal((await composeStoryDigest(g.storyId)).updated, true);
  assert.ok(digestPrompt.includes("Tasks consume usage.") && digestPrompt.includes("자율 실행 작업 소모"));
  assert.ok(!digestPrompt.includes(mention) && !digestPrompt.includes("MENTION MUST NOT ENTER DIGEST"));
  assert.ok(!digestPrompt.includes(composite), "known composite input is excluded before its stale hard membership is cleaned");
  const [stored] = await sql`SELECT latest FROM stories WHERE id=${g.storyId}`;
  assert.equal(stored!.latest, "Dots 작업 할당량 여전히 과금");
  const calls = provider.hits();
  assert.equal((await composeStoryDigest(g.storyId)).updated, false);
  assert.equal(provider.hits(), calls);
  await sql`UPDATE facts SET conditions='자율 작업에만 할당량 소모, 대화는 무료' WHERE id=${g.factId}`;
  assert.equal((await composeStoryDigest(g.storyId)).updated, true, "changed conditions invalidate the saved inputs hash");
  assert.ok(digestPrompt.includes("자율 작업에만 할당량 소모, 대화는 무료"));
  const [version] = await sql`SELECT article_ids FROM story_digests WHERE story_id=${g.storyId} ORDER BY version DESC LIMIT 1`;
  assert.deepEqual(version!.article_ids, [main]);
  const remaining = await report(s, g, { title: "보존된 후속 보도", hours: 2 });
  await sql`UPDATE publications SET visibility='withdrawn' WHERE article_id=${main}`;
  const publicStory = (await loadStoryDetail(g.storyId, now))!;
  assert.equal(publicStory.digest, null, "a saved digest loses its withdrawn evidence before any model refresh");
  assert.equal(publicStory.latestReport!.id, remaining);
  await sql`UPDATE publications SET visibility='withdrawn' WHERE article_id IN ${sql([remaining, composite])}`;
  assert.equal(await v1Story(g.storyId), null, "mentions alone cannot supply an event or invent required v1 latest/time fields");
  const beforeClear = provider.hits();
  assert.equal((await composeStoryDigest(g.storyId)).updated, true);
  assert.equal(provider.hits(), beforeClear, "clearing an empty story does not call a model");
  const [cleared] = await sql`SELECT digest, latest FROM stories WHERE id=${g.storyId}`;
  assert.deepEqual({ ...cleared }, { digest: null, latest: null });
});

// A prompt change reaches a story only when its reports change; the rewrite writes it again now, from the
// current reports without the previous digest, and is audited.
test("rewriting a story digest uses the current reports and prompt and is audited", async () => {
  const s = await source("digest-rewrite", "T1");
  const g = await story();
  await report(s, g, { title: "Dots 대화 기능 미과금", hours: 3 });
  assert.equal((await composeStoryDigest(g.storyId)).updated, true);
  const calls = provider.hits();
  assert.equal((await composeStoryDigest(g.storyId)).updated, false, "unchanged reports keep the digest");
  assert.equal(provider.hits(), calls);
  const [before] = await sql`SELECT version FROM stories WHERE id=${g.storyId}`;
  const result = await rewriteStoryDigest(g.storyId, "digest prompt changed", "ops-script");
  assert.equal(result.updated, true);
  assert.equal(provider.hits(), calls + 1);
  assert.ok(!digestPrompt.includes("이전 요약본"), "a rewrite does not start from the previous digest");
  const [after] = await sql`SELECT version FROM stories WHERE id=${g.storyId}`;
  assert.equal(after!.version, before!.version + 1);
  const [entry] = await sql`SELECT actor, reason, after FROM audit_log WHERE action='story.rewrite-digest' AND subject=${`story:${g.storyId}`}`;
  assert.deepEqual([entry!.actor, entry!.reason, entry!.after.updated], ["ops-script", "digest prompt changed", true]);
  await assert.rejects(rewriteStoryDigest(-1, "missing", "ops-script"), /story not found/);
});

// Recovery failures: restoring identical evidence must restore the saved digest without another
// model request; evidence corrected while withdrawn must be rewritten instead of resurrecting it.
test("a cleared digest recovers from matching saved evidence without another model call", async () => {
  const s = await source("digest-restoration", "T1");
  const g = await story();
  const id = await report(s, g, { title: "복구 가능한 실제 보도", hours: 2, selected: false });
  assert.equal((await composeStoryDigest(g.storyId)).updated, true);
  const original = (await v1Story(g.storyId))!.story.digest;
  const calls = provider.hits();
  await sql`UPDATE publications SET visibility = 'withdrawn' WHERE article_id = ${id}`;
  assert.equal((await composeStoryDigest(g.storyId)).updated, true);
  assert.equal(await v1Story(g.storyId), null);
  await sql`UPDATE publications SET visibility = 'public' WHERE article_id = ${id}`;
  assert.equal((await composeStoryDigest(g.storyId)).updated, true, "restoration cannot be skipped merely because the input hash is unchanged");
  assert.equal((await v1Story(g.storyId))!.story.digest, original);
  assert.equal(provider.hits(), calls, "the matching saved digest is reused without paying again");
  assert.equal((await composeStoryDigest(g.storyId)).updated, false, "the restored projection is idempotent");

  await sql`UPDATE publications SET visibility = 'withdrawn' WHERE article_id = ${id}`;
  await composeStoryDigest(g.storyId);
  await sql`UPDATE publications SET visibility = 'public', summary = '정정이 완료된 자료' WHERE article_id = ${id}`;
  assert.equal((await composeStoryDigest(g.storyId)).updated, true);
  assert.equal(provider.hits(), calls + 1, "changed evidence must generate a corrected digest");
  assert.ok(digestPrompt.includes("정정이 완료된 자료"));
});

// A digest can outlive its evidence without losing an article id: titles, summaries, source identity,
// times and fact conditions can be corrected. New reports alone must not remove the still-valid
// digest; changed or unlisted evidence must hide it on every read without waiting for another model.
for (const correction of ["title", "summary", "source", "time", "conditions", "evidence", "unlisted"] as const) {
  test(`all story exits hide a digest whose ${correction} input changed`, async () => {
    const s = await source(`read-correction-${correction}`, "T1");
    const g = await story();
    const id = await report(s, g, { title: "이전 종합에 사용된 보도", hours: 2, selected: false });
    await composeStoryDigest(g.storyId);
    const original = (await v1Story(g.storyId))!.story.digest;
    assert.ok(original);
    await report(s, g, { title: "기존 근거를 바꾸지 않고 새로 도착한 보도", hours: 1, selected: false });
    assert.equal((await storyTexts([g.storyId], now)).get(g.storyId)!.digest, original);
    assert.equal((await v1Story(g.storyId))!.story.digest, original);
    if (correction === "title" || correction === "summary") {
      await overrideFields(id, { fields: { [correction]: "검증 완료된 정정 내용" }, reason: "correct evidence", version: 0 }, "test");
    }
    if (correction === "source") await sql`UPDATE sources SET name = '정정된 원발 작성자' WHERE id = ${s}`;
    if (correction === "time") await sql`UPDATE publications SET published_at = ${at(3)} WHERE article_id = ${id}`;
    if (correction === "conditions") await sql`UPDATE facts SET conditions = '정정된 적용 조건' WHERE id = ${g.factId}`;
    if (correction === "evidence") await sql`UPDATE fact_articles SET evidence = 'Corrected source quote.' WHERE article_id = ${id}`;
    if (correction === "unlisted") await sql`UPDATE publications SET eligible = false WHERE article_id = ${id}`;
    const calls = provider.hits();
    const site = (await loadStoryDetail(g.storyId, now))!;
    const api = (await v1Story(g.storyId))!.story;
    const hot = (await storyTexts([g.storyId], now)).get(g.storyId)!;
    for (const [exit, result] of [["site", site], ["v1/agent/mcp", api], ["hot text", hot]] as const) {
      assert.equal(result.digest, null, `${exit} still publishes corrected evidence`);
      assert.equal(result.digestUpdatedAt, null, exit);
    }
    assert.equal(provider.hits(), calls, "public reads never regenerate a digest");
  });
}

// Saved text without a fingerprint or evidence ids cannot establish that its words remain valid.
// A separate imported story summary must not bring the same withdrawn or corrected words back.
for (const proof of ["no-hash", "no-ids", "no-version", "different-text"] as const) {
  test(`story text without ${proof} never republishes unverifiable historical claims`, async () => {
    const s = await source(`missing-proof-${proof}`, "T1");
    const g = await story();
    const id = await report(s, g, { title: "보존된 현재 보도", hours: 2, selected: false });
    await composeStoryDigest(g.storyId);
    await sql`UPDATE stories SET summary = '근거 없는 과거 사건 설명' WHERE id = ${g.storyId}`;
    if (proof === "no-hash") await sql`UPDATE story_digests SET inputs_hash = NULL WHERE story_id = ${g.storyId}`;
    if (proof === "no-ids") await sql`UPDATE story_digests SET article_ids = '{}' WHERE story_id = ${g.storyId}`;
    if (proof === "no-version") await sql`DELETE FROM story_digests WHERE story_id = ${g.storyId}`;
    if (proof === "different-text") await sql`UPDATE stories SET digest = '근거 있는 버전과 불일치하는 구 종합 요약' WHERE id = ${g.storyId}`;
    const calls = provider.hits();
    for (const change of ["unchanged", "corrected", "withdrawn"] as const) {
      if (change === "corrected") await overrideFields(id, { fields: { summary: "정정된 현재 요약" }, reason: "correct historical evidence", version: 0 }, "test");
      if (change === "withdrawn") {
        await report(s, g, { title: "철회 후에도 공개된 보도", hours: 1, selected: false });
        await setVisibility(id, { visibility: "withdrawn", reason: "withdraw historical evidence", version: 1 }, "test");
      }
      const site = (await loadStoryDetail(g.storyId, now))!;
      const api = (await v1Story(g.storyId))!.story;
      const hot = (await storyTexts([g.storyId], now)).get(g.storyId)!;
      for (const [exit, result] of [["site", site], ["v1/agent/mcp", api], ["hot", hot]] as const) {
        assert.equal(result.digest, null, `${exit} ${change}`);
        assert.equal(result.digestUpdatedAt, null, `${exit} ${change}`);
      }
      assert.equal(site.summary, null);
      assert.equal(hot.summary, null);
      assert.ok(site.latest && site.excerpt?.text, "current evidence remains readable without old generated text");
    }
    assert.equal(provider.hits(), calls, "verification never calls a model");
  });
}

test("a story summary is visible only while a current public report supports those exact words", async () => {
  const s = await source("summary-evidence", "T1");
  const g = await story();
  const id = await report(s, g, { title: "현재 검증 가능한 팩트 요약", hours: 2, selected: false });
  await sql`UPDATE stories SET summary = '현재 검증 가능한 팩트 요약' WHERE id = ${g.storyId}`;
  assert.equal((await storyTexts([g.storyId], now)).get(g.storyId)!.summary, "현재 검증 가능한 팩트 요약");
  await overrideFields(id, { fields: { summary: "정정 완료 팩트 요약" }, reason: "correct supporting report", version: 0 }, "test");
  assert.equal((await storyTexts([g.storyId], now)).get(g.storyId)!.summary, null);
  await sql`UPDATE stories SET summary = '정정 완료 팩트 요약' WHERE id = ${g.storyId}`;
  await setVisibility(id, { visibility: "withdrawn", reason: "withdraw supporting report", version: 1 }, "test");
  assert.equal((await storyTexts([g.storyId], now)).get(g.storyId)!.summary, null);
});

test("the hot board shows an event under its own title, linked to the fact most sources report", async () => {
  const s = await source("hot", "T2");
  const official = await source("hot-official", "T1");
  const other = await source("hot-other", "T2");
  const g = await story("DoD, Dots 체계 공개");
  const fact = async (title: string) => Number((await sql`INSERT INTO facts (public_id,story_id,title,subject) VALUES (${`f-${randomUUID()}`},${g.storyId},${title},'OpenAI') RETURNING id`)[0]!.id);
  // A leak opens the story and a single follow-up scores highest; the launch is what two sources report.
  const leak = await report(s, { ...g, factId: await fact("사전 유출 동향 포착") }, { title: "발표 전 유출 보도", hours: 30, score: 99 });
  const media = await report(s, g, { title: "Dots 언론 보도", hours: 4, score: 90 });
  const blog = await report(official, g, { title: "Dots 공식 발표", hours: 3, score: 60 });
  const followUp = await report(other, { ...g, factId: await fact("신규 작전 구역 후속 진전") }, { title: "후속 고득점 보도", hours: 2, score: 99 });
  for (const [i, id] of [leak, media, blog, followUp].entries()) await sql`INSERT INTO story_signals (story_id,article_id,source_id,participant_key,kind,observed_at)
    VALUES (${g.storyId},${id},(SELECT source_id FROM articles WHERE id=${id}),${`${key}-participant-${i}`},'editorial',${at(1)})`;
  await computeHotRanking(now);
  const entry = (await latestHotRanking())!.entries.find(e => e.storyId === g.storyId)!;
  assert.ok(entry);
  assert.equal(entry.title, "DoD, Dots 체계 공개");
  assert.equal(entry.representativeItemId, blog, "the launch's first-party report, not the earlier leak or a later high score");
  assert.equal(entry.participantCount, 3, "heat still counts each source once");
  await sql`UPDATE stories SET title='DoD, 상시 작전 체계 Dots 공개' WHERE id=${g.storyId}`;
  assert.equal((await latestHotRanking())!.entries.find(e => e.storyId === g.storyId)!.title, "DoD, 상시 작전 체계 Dots 공개", "a retitled event shows at once");
  await sql`UPDATE fact_articles SET role='mention' WHERE article_id=${blog}`;
  assert.ok(!(await latestHotRanking())!.entries.some(e => e.storyId === g.storyId), "regrouped or mention-only representatives leave cached rankings immediately");
});

// A saved ranking's event clock can still point at a withdrawn report. Public hot metadata must use
// the same current evidence as the event page, without waiting for another heat computation.
test("hot exits date latest progress by current event evidence after a withdrawal", async () => {
  const g = await story("동일 사건의 현재 시각");
  const ids: string[] = [];
  for (const [i, hours] of [6, 4, 2].entries()) {
    const s = await source(`hot-clock-${i}`, i === 0 ? "T1" : "T2");
    const id = await report(s, g, { title: `현재 진전 ${hours}`, hours });
    ids.push(id);
    await sql`INSERT INTO story_signals (story_id,article_id,source_id,participant_key,kind,observed_at)
      VALUES (${g.storyId},${id},${s},${`source:${s}`},'editorial',${at(hours)})`;
  }
  await computeHotRanking(new Date());
  for (const hours of [2, 4]) {
    const detail = (await loadStoryDetail(g.storyId, now))!;
    const hot = (await v1HotTopics()).items.find((entry) => entry.links.story.endsWith(g.storyPublicId))!;
    const common = (await latestHotRanking())!.entries.find((entry) => entry.storyId === g.storyId)!;
    assert.equal(detail.latestAt, at(hours).toISOString());
    assert.equal(hot.latestAt, detail.latestAt);
    assert.equal(common.latestAt, detail.latestAt, "legacy and site share the same current ranking metadata");
    await sql`UPDATE publications SET visibility = 'withdrawn' WHERE article_id = ${ids[2]!}`;
  }
});

test("an editor moves a report into the fact it repeats: no false development remains and the membership is the editor's", async () => {
  const s = await source("move", "T1");
  const g = await story("DoD, GPT-6.1 Sol 체계 공개");
  const launch = await report(s, g, { title: "Sol 공식 발표", hours: 6 });
  const [dup] = await sql`INSERT INTO facts (public_id,story_id,title,subject) VALUES (${`f-${randomUUID()}`},${g.storyId},'DoD GPT-6.1 Sol 발표','DoD') RETURNING id`;
  const repost = await report(s, { ...g, factId: Number(dup!.id) }, { title: "공식 스레드 내 중복 게시", hours: 1 });
  await sql`INSERT INTO story_signals (story_id,article_id,source_id,participant_key,kind,observed_at) VALUES (${g.storyId},${repost},${s},${`source:${s}`},'editorial',${at(1)})`;
  // Moving re-derives the publication from its analysis, which carries no test tag: read the unfiltered timeline.
  const cards = async () => (await loadTimeline({ channel: "all", category: null, tag: null, limit: 40, now: new Date() })).cards.filter(c => [launch, repost].includes(c.item.id));
  assert.equal((await cards()).length, 2);
  assert.deepEqual(await moveToFact(repost, g.factPublicId, "동일 발표의 공식 중복 게시물", "test"), { fact: g.factId, story: g.storyId, left: 1 });
  const after = await cards();
  assert.equal(after.length, 1);
  assert.equal(after[0]!.item.id, launch);
  assert.equal(after[0]!.group!.reportCount, 2);
  assert.deepEqual([...await sql`SELECT fact_id, role, manual, evidence FROM fact_articles WHERE article_id=${repost}`].map(r => ({ ...r, fact_id: Number(r.fact_id) })),
    [{ fact_id: g.factId, role: "report", manual: true, evidence: "Tasks consume usage." }]);
  assert.equal((await sql`SELECT 1 FROM story_signals WHERE article_id=${repost} AND story_id=${g.storyId}`).length, 1, "its heat evidence stays with the story");
  await assert.rejects(moveToFact(repost, "f-missing", "x", "test"), /대상 팩트가 존재하지 않거나/);
});

test("an in-flight digest cannot overwrite an editor revision or a merge, and its paid response remains reusable", async () => {
  const s = await source('digest-concurrency', 'T1');
  for (const merge of [false, true]) {
    const g = await story();
    await report(s, g, {title:'Dots 관련 동일 실제 보도',hours:1});
    const target = merge ? await story('수동 병합 대상') : null;
    const entered = gate(), release = gate();
    digestHold = {entered,release};
    const pending = composeStoryDigest(g.storyId);
    await entered.promise;
    const user = digestPrompt;
    try {
      await sql`UPDATE stories SET version=version+2,origin='manual',title='수동 정정 후 사건',digest='수동 정정 후 종합 내용',latest='수동 확인 진전',merged_into=${target?.storyId ?? null} WHERE id=${g.storyId}`;
    } finally { release.open(); }
    assert.deepEqual(await pending,{updated:false});
    const [stored] = await sql`SELECT version,title,digest,latest,merged_into FROM stories WHERE id=${g.storyId}`;
    assert.deepEqual({...stored},{version:3,title:'수동 정정 후 사건',digest:'수동 정정 후 종합 내용',latest:'수동 확인 진전',merged_into:target?.storyId ?? null});
    assert.equal((await sql`SELECT 1 FROM story_digests WHERE story_id=${g.storyId}`).length,0,'obsolete input cannot create digest history');
    const calls = provider.hits();
    const reused = await chatJson({model:'deepseek-flash',purpose:'story_digest',subject:`story:${g.storyId}@1`,promptVersion:DIGEST_PROMPT_VERSION,
      system:DIGEST_SYSTEM,user,schema:DigestSchema,temperature:0.3,maxTokens:1200});
    assert.equal(provider.hits(),calls,'the settled response is reused without another provider request');
    const [receipt] = await sql`SELECT status FROM receipts WHERE id=${reused.receiptId}`;
    assert.equal(receipt!.status,'completed');
  }
});

// A story version alone does not describe the input: an article correction, withdrawal, detachment
// or a new report can all happen while its model request is in flight without editing the story.
for (const change of ["correction", "withdrawal", "detach", "addition"] as const) {
  test(`an in-flight digest rejects changed report inputs after ${change}`, async () => {
    const s = await source(`digest-input-${change}`, "T1");
    const g = await story();
    const id = await report(s, g, { title: "생성 중 정정될 수 있는 보도", hours: 2, selected: false });
    const entered = gate(), release = gate();
    digestHold = { entered, release };
    const pending = composeStoryDigest(g.storyId);
    await entered.promise;
    try {
      if (change === "correction") await overrideFields(id, { fields: { summary: "검증된 정정 요약" }, reason: "correct input", version: 0 }, "test");
      if (change === "withdrawal") await setVisibility(id, { visibility: "withdrawn", reason: "withdraw input", version: 0 }, "test");
      if (change === "detach") await detachFromFact(id, "wrong fact", "test");
      if (change === "addition") await report(s, g, { title: "모델 요청 후 도착한 신규 진전", hours: 1, selected: false });
    } finally { release.open(); }
    assert.deepEqual(await pending, { updated: false });
    assert.equal((await sql`SELECT 1 FROM story_digests WHERE story_id = ${g.storyId}`).length, 0);
    if (change === "correction" || change === "addition") {
      assert.equal((await composeStoryDigest(g.storyId)).updated, true, "a subsequent job accepts the current evidence");
      assert.ok(digestPrompt.includes(change === "correction" ? "검증된 정정 요약" : "모델 요청 후 도착한 신규 진전"));
    }
  });
}
