# 사건 클러스터링(Grouping) 및 관계 평가

사이트는 먼저 제목과 요약을 기반으로 최근 2주 동안의 후보 팩트들을 검색한 후(벡터 서비스가 설정되어 있으면 벡터 유사도 비교, 미설정 시 텍스트 중복도 비교), 모델을 통해 보도 기사들 간의 관계를 판별합니다. 동시에 이 기사가 기존 큐레이션 기사와 비교해 새로운 정보가 있는지도 판단합니다(점수가 충분한 기사라도 이 검증을 통과해야 큐레이션에 진입합니다. [큐레이션 및 캘리브레이션](selection.md) 참조). 관계 정의와 사이트에서 실제로 사용하는 프롬프트는 `industry/prompts/group-*.md`에 있으며, 코드 진입점은 `packages/backend/src/events/relate.ts` 및 `group.ts`입니다.

판별하는 4가지 관계 유형은 다음과 같습니다:

- `SAME_OCCURRENCE`: 실제 동일한 사건의 발생 (예: 동일한 제품 발표에 대한 공식 발표문과 미디어 취재 보도).
- `SAME_STORY`: 동일한 시점의 발생은 아니지만, 동일한 구체적 사건의 직접적인 후속 진척 (예: 발표 후 정식 출시, 벤치마크 평가, 공식 입장 발표 등).
- `UNRELATED`: 완전히 다른 사건 (동일한 기업/기관, 동일한 제품 또는 유사 토픽이더라도 사건 자체가 다름).
- `ROUNDUP`: 한쪽이 여러 토픽을 아우르는 종합 브리핑/요약 기사.

## 자체 라벨링 샘플로 기사 간 관계 판별 평가하기

`scripts/eval-relations.ts`는 모델이 두 기사 사이의 관계를 얼마나 정확하게 판별하는지만 전문적으로 평가합니다. 사이트 클러스터링에서 실제 사용하는 `PAIR_SYSTEM`, `pairUser()`, `PairSchema` 및 프롬프트 버전을 그대로 재사용하므로, 프롬프트가 변경되면 평가 기준도 함께 변경됩니다. 후보군 검색을 다시 수행하지 않으며, 평가 결과를 실제 사건 데이터베이스에 반영하지도 않습니다.

직접 라벨링한 데이터를 `.data/` 디렉터리(Git 추적 제외)에 배치하세요. `industry/relation-gold.example.jsonl`에 가상의 예시 4건이 제공됩니다. 파일은 라인당 1건의 JSONL 형식입니다:

```json
{"caseId":"release-001","a":{"title":"...","source":"...","firstParty":true,"publishedAt":"2026-09-01T09:00:00+08:00","summary":"..."},"b":{"title":"...","source":"...","firstParty":false,"publishedAt":"2026-09-01T09:20:00+08:00","summary":"..."},"samplingContext":{"benchmarkSplit":"development","samplingStratum":"same-release"},"gold":{"relation":"SAME_OCCURRENCE"}}
```

`a`, `b`는 사이트 내부 `ReportView`와 호환되는 선택적 `frame` 객체를 포함할 수 있습니다:

```json
{"subject":"Acme","action":"발표","object":"Acme-2","occurredAt":"2026-09-01"}
```

혼동하기 쉬운 경계 사례(Boundary cases)를 개발 세트(`benchmarkSplit: "development"`)에 많이 배치하고, 일부는 최종 검증을 위한 홀드아웃 세트(`benchmarkSplit: "holdout"`)로 남겨두는 것을 권장합니다. `samplingStratum`은 어떤 유형에서 오분류가 발생하는지 분석하기 위한 사용자 정의 그룹 라벨이며 모델 입력에는 영향을 주지 않습니다.

### 실행 방법

정상적인 배포 방식에 맞춰 데이터베이스와 모델을 구성한 후 다음을 실행합니다:

```bash
node --env-file=.env scripts/eval-relations.ts \
  --gold .data/relation-gold.jsonl \
  --split development
```

기본값으로 "클러스터링 재검토(Group Review)" 단계의 현재 모델을 사용합니다. 관리자 "모델 및 평가" 페이지에서 지정한 모델이 최우선 적용되며, 그 다음은 환경 변수 `GROUP_REVIEW_MODEL`, 그 다음은 `site/models.ts`의 `DEFAULTS.groupReview`, 모두 없을 경우 기본 모델(`.env`의 `LLM_*`)을 사용합니다. 구성된 여러 모델을 명시적으로 비교할 수도 있습니다:

```bash
node --env-file=.env scripts/eval-relations.ts \
  --gold .data/relation-gold.jsonl \
  --models default,deepseek-flash \
  --split development \
  --n 200 \
  --seed 7 \
  --thresholds 0.75,0.8
```

사용 가능한 옵션:

| 매개변수 | 기본값 | 설명 |
|---|---|---|
| `--gold` | `.data/relation-gold.jsonl` | 라벨링 샘플 파일 (JSONL) |
| `--models` | "클러스터링 재검토" 현재 모델 | 쉼표로 구분된 모델 목록 |
| `--split` | `all` | `development`, `holdout` 또는 사용자 정의 분할 |
| `--n` | `200` | 최대 평가 샘플 수 |
| `--seed` | `7` | 샘플링 난수 시드 (시드가 같으면 매번 동일한 샘플 추출) |
| `--concurrency` | `6` | 동시 모델 요청 수 |
| `--thresholds` | 프로덕션의 `STORY_REVIEW_MIN_CONFIDENCE,TIE_MIN_CONFIDENCE` | 두 기사를 "동일 사건으로 연결"할 때 적용할 신뢰도 임계값 (명시 시 기본값 덮어씀) |

상세 보고서는 `.data/eval/relations-*.json`에 저장됩니다. 각 모델별로 다음 결과가 산출됩니다:

- 4 × 4 혼동 행렬(Confusion Matrix): 각 정답 라벨이 모델에 의해 어떤 관계로 분류되었는지 대조.
- 관계별 정밀도(Precision), 재현율(Recall), F1 점수 및 샘플 수 (구조화된 판별을 성공적으로 반환한 샘플 대상).
- `coverage`: 전체 골드 샘플 중 모델이 성공적으로 구조화된 판별을 반환한 비율.
- `accuracy` 및 4개 클래스 macro-F1: 성공적으로 완료된 케이스만을 대상으로 품질 측정. 반면 `completeAccuracy`는 호출 실패나 포맷 불일치까지 실패로 간주하여 전체 골드 샘플을 분모로 계산.
- `SAME_OCCURRENCE`와 `SAME_STORY`를 모두 "동일 사건으로 연결"로 간주했을 때, 각 신뢰도 임계값별 정밀도, 재현율, F1 점수 (동일 샘플에 대한 `coverage` 및 `completeAccuracy` 포함).
- 호출 오류 건수, 토큰 사용량, 요청당 평균 소요 시간 및 전체 평가 소요 시간.
- 각 샘플별 상세 판별 결과, 신뢰도, 모델이 작성한 차이점 설명(`difference`), 영수증 번호.

모든 모델 호출은 일반 파이프라인과 동일하게 감사 영수증과 예산 서킷 브레이커를 거칩니다. 동일한 모델, 프롬프트, 입력을 가진 중복 평가는 기존 영수증을 재사용합니다. 동일 실행 내에서 입력이 같은 샘플은 1회의 요청 결과를 공유하며, 실패 결과 역시 공유되어 불필요한 반복 호출을 방지합니다. 보고서의 `reused` 통계에는 공유된 성공/실패 결과 및 재사용된 영수증이 포함됩니다. 관계 평가 호출은 독립적인 `eval_relation_pair` 용도로 기록되므로 사이트 통계와 분리됩니다.

CI는 외부 모델 서비스를 호출하지 않고 로컬 모의(Mock) 모델 서비스를 사용하여 JSONL 파싱, 시드 샘플링, 지표 계산, 동시성 재사용 및 재시도 통계를 검증합니다.
