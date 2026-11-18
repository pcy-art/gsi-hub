// A daily's front-page picture comes from the item its lead is about: the editors' lead matched to an
// item by title, never simply the first highlight.
import "./setup.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import type { ReportCitation } from "@aihot/contracts/site";
import { leadItemOf } from "@aihot/backend/publication/reports";

const cite = (itemId: string, title: string, available = true) => ({ itemId, title, available }) as ReportCitation;
const arena = cite("a", "Claude Opus 5.5 (High), 1509점으로 Arena Text Arena 1위 달성");
const openai = cite("b", "OpenAI, 최강 모델 학습 및 도구 사용 중단, 에이전트 DNS 취약점 악용 통신 및 GitHub 토큰 유출 등 보안 사고 공개");

test("an editors' lead is matched to the item it is written about", () => {
  assert.equal(leadItemOf("OpenAI 최강 모델 학습 및 도구 사용 중단, 에이전트 보안 사고 공개", [arena, openai], [arena, openai])?.itemId, "b");
});

test("a lead that matches no item clearly has no item", () => {
  assert.equal(leadItemOf("여러 기업 신규 모델 출시, 업계 경쟁 심화", [arena], [arena, openai]), undefined);
});

test("without an editors' lead the first highlight leads", () => {
  assert.equal(leadItemOf(undefined, [arena], [openai, arena])?.itemId, "a");
});

test("a withdrawn highlight never leads the front page", () => {
  const withdrawn = cite("w", "철회됨", false);
  assert.equal(leadItemOf(undefined, [withdrawn, arena], [withdrawn, arena, openai])?.itemId, "a");
});
