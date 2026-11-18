# 글로벌 안보 인텔리전스 허브 (GSI Hub)

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-176b75?style=flat-square" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/Node.js-24-176b75?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js 24">
  <img src="https://img.shields.io/badge/PostgreSQL-17-176b75?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL 17">
  <img src="https://img.shields.io/badge/Docker-Compose-176b75?style=flat-square&logo=docker&logoColor=white" alt="Docker Compose">
  <a href="https://github.com/pcy-art/gsi-hub"><img src="https://img.shields.io/badge/GitHub-pcy--art%2Fgsi--hub-202a30?style=flat-square&logo=github&logoColor=white" alt="GitHub pcy-art/gsi-hub"></a>
</p>

<p align="center">
  <b>북한·한반도 정세 및 글로벌 복합 안보 위협 실시간 OSINT 인텔리전스 허브</b><br>
  다국어 공개출처정보(OSINT)를 상시 수집·선별·구조화하고, 동일 사건을 단일 타임라인으로 클러스터링하여<br>
  한국어 <b>상황보고(일보) · 정세평가(주보) · 전략평가(월보)</b>를 자동 발간합니다.
</p>

<p align="center">
  <a href="#시작하기">시작하기</a> ·
  <a href="#수집-정보원-구성-24개-다국어-osint">수집 정보원</a> ·
  <a href="#파이프라인-및-모델-풀-아키텍처">파이프라인 및 모델 풀</a> ·
  <a href="#운영-및-장애-복구">운영·복구</a> ·
  <a href="#문서">문서</a>
</p>

---

## 주요 특징

- **한반도·북한 중심 24개 다국어 OSINT 파이프라인**: 한국어·영어·러시아어·일본어·중국어 공개 출처에서 실시간 위협 징후와 외교·군사 동향을 수집합니다.
- **수집 단계 키워드 필터 (`requireMarkers`)**: 러시아·일본·중국·미 국방부·UN·IAEA·사이버 매체의 일반 뉴스 노이즈(~98%)를 RSS 수집 직후 LLM 호출 전에 차단하여 토큰·쿼터 낭비를 방지합니다([`filters.ts`](packages/backend/src/sources/filters.ts)).
- **6단계 LLM 선별·구조화·클러스터링**: 1차 연관성 사전 필터 → 2회 독립 채점(`SCORE_CALLS=2`) → 군사 제원·팩트 구조화 → 결론 우선 3줄 한국어 요약·선별 근거 작성 → 임베딩 기반 사건 병합 및 화제성(Heat) 산출.
- **멀티 모델 풀 분산 및 자동 순환**: Google AI Studio 가용 6개 모델(`gemma-4-26b-a4b-it`, `gemini-3.1-flash-lite`, `gemini-3.1-flash-lite-preview`, `gemini-3.5-flash-lite`, `gemini-flash-lite-latest`, `gemini-3-flash-preview` + 예비 `gemma-4-31b-it`)에 단계별 부하를 분산하고 `429`/`5xx` 시 15분 쿨다운 후 가용 풀로 즉시 우회합니다([`site/models.ts`](site/models.ts), [`llm.ts`](packages/backend/src/providers/llm.ts)). 폐쇄망 로컬 `SGLang (Qwen 3.8 27B FP8)` 프리셋(`sglang-qwen-27b`)도 내장되어 있습니다.
- **정세 보고서 자동 발간**:
  - **상황보고 (일보)**: 매일 `08:00` 무모델 규칙 기반 자동 조판
  - **정세평가 (주보)**: 매주 월요일 `10:00` 종합 브리핑 발간
  - **전략평가 (월보)**: 매월 1일 `10:30` 월간 전략 총괄 발간
- **대외 연동 및 에이전트 지원**: 웹 UI, 카테고리별 RSS, 공개 REST API(`/api/v1/*`), MCP(`/api/mcp`), Markdown 내보내기(`/items/:id/markdown`), `llms.txt`, `/openapi-v1.json` 제공.

---

## 도메인 분류 체계

### 6대 안보 카테고리 ([`industry/taxonomy.ts`](industry/taxonomy.ts))

| 키 (`key`) | 라벨 | 주요 감시 영역 |
|---|---|---|
| `military_strategic` | **군사·도발** | 탄도·순항·극초음속 미사일 발사, 핵시설·WMD 징후, 군사훈련, 국경 충돌, 무기 이전 |
| `maritime_security` | **해양안보** | NLL 침범, 대만해협·남중국해 충돌, 공해상 다크쉽 불법 환적(STS), SLOC·해저 인프라 |
| `alliance_sanctions` | **동맹·외교** | 한미동맹, 한미일·NATO-IP4·QUAD·AUKUS, 북·러 군사조약, UN 안보리 대북제재 |
| `hybrid_cyber_crime` | **사이버·우주** | 국가 배후 APT(라자루스·김수키 등), 가상자산 탈취, 군사정찰위성, 전자전·GPS 교란 |
| `economic_security` | **경제안보** | 반도체·희토류·핵심광물 수출 통제, 방산 공급망, 국경 통상·세관 제재 |
| `opinion` | **정세분석** | 국내외 싱크탱크(38 North, CSIS 등) 및 전문가 전략 평론·전황 예측 |

### 주요 감시 주체 ([`industry/taxonomy.ts`](industry/taxonomy.ts), [`industry/topics.json`](industry/topics.json))
- 핵심 추적 주체: `dprk`(북한/조선인민군), `mod-korea`(국방부), `jcs-korea`(합참), `usfk`(주한미군), `us-dod`(미 국방부), `japan-mod`(일본 방위성), `prc-pla`(중국 국방부/인민해방군), `russia-mod`(러시아 국방부/크렘린), `un`(유엔/IAEA), `nato`(NATO), `iran-irgc`(이란/IRGC)

---

## 수집 정보원 구성 (24개 다국어 OSINT)

전체 목록은 [`industry/sources.json`](industry/sources.json)에 정의되어 있으며, 기동 시 [`scripts/seed.ts`](scripts/seed.ts)로 자동 등록됩니다.

| 구분 | 매체 수 | 포함 매체 | 수집 방식 |
|---|---:|---|---|
| **북한·한반도 전담** | 10 | 연합뉴스·북한, SPN 서울평양뉴스, 데일리NK, Daily NK English, NK News, VOA 한국어, RFA 자유아시아방송, 통일뉴스, 38 North, CSIS Beyond Parallel | 전량 수집 |
| **러시아 매체** | 5 | 타스 통신(ТАСС), 리아 노보스티(РИА Новости), 코메르산트, 베도모스티, The Moscow Times | `requireMarkers` 대북·한반도 키워드 필터 |
| **일본 매체** | 2 | NHK 뉴스 국제/안보, The Japan Times | `requireMarkers` 대북·미사일·납치 키워드 필터 |
| **중국·홍콩 매체** | 2 | 중국신문망 국제, SCMP Asia | `requireMarkers` 북중·평양·한반도 키워드 필터 |
| **미국·UN·사이버** | 5 | 미 국방부(DoD Defense News · 공식 성명), 유엔 뉴스(안보), IAEA, The Record(CTI) | `requireMarkers` 한반도·핵·DPRK-APT 키워드 필터 |

---

## 파이프라인 및 모델 풀 아키텍처

1. **수집 (`worker` · `sources.schedule`)**: 30~120분 주기로 RSS/피드 수집 및 `admitListing`(`requireMarkers` 포함) 필터링. 최초 수집 기준 시점(`initializedAt`) 이후 48시간 이내 기사는 실시간 뉴스(`backfill=false`)로 처리.
2. **분석 (`worker` · `QUEUES.analyze`, `localConcurrency: 4`)**:
   - **사전 필터 (`prefilter`) / 2회 채점 (`score`)**: `gemma-4-26b-a4b-it`
   - **제원·팩트 구조화 (`structure`)**: `gemini-3.1-flash-lite`
   - **심층 요약 (`understand`) · 피드백 (`feedback`)**: `gemini-3.5-flash-lite`
   - **일반 요약 (`summarize`) · 어휘 교정 (`wording`) · 번역 (`translate`)**: `gemini-flash-lite-latest`
   - **사건 클러스터링 (`group` · `groupReview` · `digest`)**: `gemini-3.1-flash-lite-preview`
   - **종합 정세 리포트 (`report`)**: `gemini-3-flash-preview`
3. **영수증 감사 및 서킷 브레이커 (`providers/receipts.ts`)**: 모든 유료/LLM 호출은 `receipts` / `receipt_attempts`에 기록되며, `budgets` 테이블의 분/시간/일일 상한을 초과하지 않습니다.

---

## 시작하기

### 사전 요구 사항
- **Docker** 및 **Docker Compose**
- **Node.js 24** (로컬 테스트·CLI 스크립트 실행용)
- **PostgreSQL 17** (Docker Compose에 포함)
- **LLM API Key**: Google AI Studio (OpenAI 호환 엔드포인트 `https://generativelanguage.googleapis.com/v1beta/openai`) 또는 폐쇄망 로컬 **SGLang (`Qwen 3.8 27B FP8`)** 등 OpenAI 호환 API Key

### 1. 저장소 클론 및 `.env` 준비

```bash
git clone https://github.com/pcy-art/gsi-hub.git
cd gsi-hub
cp .env.example .env
```

`.env` 파일에서 필수 항목을 설정합니다(세부 항목은 [`.env.example`](.env.example) 및 [배포 가이드](docs/deploy.md) 참조):

```dotenv
SITE_URL=http://localhost:3000
ADMIN_PASSWORD=<관리자_비밀번호>
SESSION_SECRET=<32자_이상_랜덤_시크릿>
IMG_PROXY_SIGN_SECRET=<32자_이상_랜덤_시크릿>
POSTGRES_PASSWORD=<DB_비밀번호>

LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
LLM_API_KEY=<API_KEY>
LLM_MODEL=gemma-4-26b-a4b-it
EMBEDDING_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
EMBEDDING_API_KEY=<API_KEY>
EMBEDDING_MODEL=gemini-embedding-001

COLLECT_ENABLED=true
MODEL_CALLS_ENABLED=true
```

> 초기 환경변수를 자동 생성하려면 `node scripts/init-env.ts --llm-key <API_KEY>`를 사용할 수도 있습니다.

### 2. 빌드 및 전체 서비스 기동

```bash
docker compose up -d --build
```

기동 완료 후:
- **웹 포털**: <http://localhost:3000>
- **관리자 콘솔**: <http://localhost:3000/admin>
- **에이전트 연동 안내**: <http://localhost:3000/agent> (`/api/mcp`, `/openapi-v1.json`, `/llms.txt`, `/feed.xml`)

---

## 운영 및 장애 복구

### 1. 헬스체크 및 스모크 테스트

```bash
docker compose ps
curl -s http://localhost:3000/api/health
node scripts/smoke.ts --base http://localhost:3000
```

### 2. API 사용량 제한(`429` / `provider.stop`) 발생 시 즉시 재개

모델별 일일/분당 한도 도달 시 자동으로 15분 쿨다운 후 가용 풀 모델로 우회하며, 기사는 `new` 대기 상태로 유지됩니다. 한도 상향 또는 API 키 교체 후 대기 없이 즉시 재개하려면:

- **웹 관리자 콘솔**: `/admin/settings`에서 `llm` 서킷 브레이커 한도 상향, `/admin/models`에서 단계별 모델 변경, `/admin/runs`에서 `unknown` 영수증 해제 및 **「전체 재처리」** 실행.
- **CLI 즉시 해제**:

```bash
docker exec aihot-db-1 psql -U aihot -d aihot -c "
  DELETE FROM settings WHERE key LIKE 'provider.stop%';
  UPDATE articles
     SET processing_state = 'new',
         processing_attempts = 0,
         processing_retry_at = NULL,
         processing_error = NULL
   WHERE processing_state = 'failed'
      OR (processing_state = 'new' AND processing_retry_at > now());
"
docker compose restart worker
```

---

## 디렉터리 구조

| 경로 | 역할 |
|---|---|
| [`site/`](site/) | 사이트명·문구([`site.ts`](site/site.ts)), 단계별 모델 풀([`models.ts`](site/models.ts)), 브랜드·약관·정적 파일 |
| [`industry/`](industry/) | 안보 분류·주체 사전([`taxonomy.ts`](industry/taxonomy.ts)), 토픽([`topics.json`](industry/topics.json)), 커트라인([`selection.ts`](industry/selection.ts)), 수집원([`sources.json`](industry/sources.json)), 프롬프트([`prompts/`](industry/prompts/)) |
| [`packages/contracts/`](packages/contracts/) | 백엔드·프론트엔드·API 공용 타입 및 시간·사이트 계약 |
| [`packages/backend/`](packages/backend/) | 수집 필터·파서, LLM 영수증/서킷 브레이커, 분석·클러스터링·발행·알림 엔진 |
| [`apps/api/`](apps/api/) | Fastify HTTP API, 공개 `/api/v1/*`, `/api/mcp`, 관리자 API |
| [`apps/worker/`](apps/worker/) | `pg-boss` 백그라운드 수집·분석·클러스터링·리포트·백업 워커 |
| [`apps/web/`](apps/web/) | React Router v8 SSR 웹 프론트엔드 및 관리자 대시보드 |
| [`database/migrations/`](database/migrations/) | PostgreSQL 온라인 무중단 스키마 마이그레이션 (`0055` 이후 파일당 1 SQL 문) |
| [`scripts/`](scripts/) | DB 마이그레이션, 시딩, 스모크 테스트, SelectBench 평가 스크립트 |

---

## 검증

코드·설정 수정 후 아래 명령으로 전체 정합성을 검증합니다:

```bash
npm run typecheck
npm run test:standalone
DATABASE_URL=postgres://127.0.0.1:5432/gsi_test npm test
npm run build -w @aihot/web
npm run test:web
node scripts/smoke.ts --base http://localhost:3000
```

> **참고**: `npm run test:web` 내 Playwright E2E 스펙(5개 파일)을 실행하려면 실행 호스트에 Chromium/WebKit Playwright 브라우저 바이너리가 설치되어 있어야 합니다.

---

## 문서

| 문서 | 설명 |
|---|---|
| [맞춤 커스터마이징 가이드](docs/customize.md) | 사이트명, 분류, 주제, 정보원, 프롬프트, 커트라인, 모델, 브랜드 변경 절차 |
| [정보원(Sources) 가이드](docs/sources.md) | 6종 정보원 설정, `ingestNoiseFilter`(`requireMarkers`), 티어, 수집 주기 제어 |
| [선별 및 캘리브레이션](docs/selection.md) | 사전 선별·2회 채점 규칙, SelectBench 기반 커트라인 캘리브레이션 |
| [사건 클러스터링 가이드](docs/grouping.md) | 사건 병합, 후속 진척 타임라인 연결, 화제성(Heat) 산출 및 평가 |
| [사건 개요 평가](docs/story-digest-evaluation.md) | 사건 요약 프롬프트 병렬 비교 평가 방법 |
| [배포 가이드](docs/deploy.md) | Docker Compose, HTTPS/Caddy, 백업/복구, 비용 최적화, Linux 직접 구동 |
| [아키텍처](docs/architecture.md) | 3대 프로세스 분리 구조, 불변 규칙, 모듈 확장, 마이그레이션 규칙 |

---

## 기술 스택

- **런타임 · 언어**: Node.js 24, TypeScript
- **백엔드 · 큐**: Fastify, pg-boss, postgres (`PostgreSQL 17`)
- **프론트엔드**: React 19, React Router (SSR), Tailwind CSS 4, Vite 8
- **인프라**: Docker, Docker Compose (Linux x64/arm64)

---

## 라이선스

본 프로젝트는 [AIHOT 오픈소스 프레임워크](https://github.com/KKKKhazix/AIHOT)를 기반으로 구축되었으며, [MIT 라이선스](LICENSE)를 따릅니다. 포함된 폰트(Noto Sans KR / SC 등) 및 서드파티 저작물의 라이선스 고지는 [NOTICE](NOTICE)를 참조하세요.
