// Failure cases: the new report or selected reading background loses evidence after character 6000;
// a very long body consumes an unbounded context; changing the body allowance damages short reports.
import './standalone.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { batchUser, describeReport, type ReportView } from '@aihot/backend/events/relate';

test('grouping includes late evidence from both sides within its ten-thousand-character allowance',()=>{
  const sourceText='앞'.repeat(6500)+'후반부의 독립 분석 근거'+'뒤'.repeat(3500)+'상한 초과';
  const report:ReportView={title:'연구 발표 후 장문 해설',source:'Example',firstParty:false,at:new Date(),summary:'개요',sourceText};
  const prompt=batchUser(report,[],'신규 보도',[{report:{...report,sourceText:null},sourceText}]);
  assert.equal(prompt.split('후반부의 독립 분석 근거').length-1,2);
  assert.ok(!prompt.includes('상한 초과'));
  assert.ok(describeReport({...report,sourceText:'짧은 본문'},'신규 보도').includes('짧은 본문'));
});
