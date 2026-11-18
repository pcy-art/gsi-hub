# 나만의 산업군으로 변경하기 (커스터마이징 가이드)

이 저장소는 산업별 핫이슈 큐레이션 웹사이트 프레임워크입니다. 다른 도메인("법률 핫이슈", "HR 핫이슈", "금융/골드 핫이슈", "글로벌 안보 인텔리전스" 등)으로 전환하기 위해 수정해야 할 내용은 거의 대부분 [`site/`](../site/)(사이트 명칭, 문구, 브랜드, 페이지)와 [`industry/`](../industry/)(산업별 분류, 정보원, 프롬프트, 선정 커트라인) 폴더에 모여 있으며, 핵심 엔진 코드는 거의 수정할 필요가 없습니다.

Claude Code, Codex, Cursor 등의 AI 코딩 에이전트를 사용하는 경우 아래 프롬프트를 에이전트에게 그대로 전달하여 작업을 진행할 수 있습니다:

```text
AGENTS.md와 docs/customize.md를 읽고, 이 사이트를 「OOO 산업」 전문 핫이슈 사이트로 수정해줘.
내가 집중하고 싶은 분야와 정보원은 다음과 같아:
- 모니터링할 주요 정보원: ... (URL 및 명칭)
- 중요한 뉴스 기준: ... (구체적인 예시)
- 배제해야 할 노이즈 기준: ... (홍보글, 단순 공지 등)
수정이 끝나면 npm run typecheck, npm test, node scripts/smoke.ts를 실행해 검증하고, 내가 추가로 결정해야 할 사항들을 정리해줘.
```

다음은 변경 작업의 순서별 세부 지침입니다.

---

## 1. 사이트 명칭 및 기본 문구: `site/site.ts`

[`site/site.ts`](../site/site.ts)의 각 필드에는 상세한 주석(어디에 쓰이는지, 빈 값 허용 여부, 기본값의 의미 등)이 적혀 있습니다. 주석을 참고하여 위에서부터 아래로 수정하면 됩니다. 수정 후 다시 빌드(`docker compose up -d --build`)하면 프론트엔드와 백엔드에 즉시 반영됩니다.

**주요 주의사항**:
- **사이트 URL은 `site.ts`에서 설정하지 않음**: 배포 시 환경 변수 `SITE_URL`로 지정합니다(`SITE.defaultUrl`은 `SITE_URL` 미설정 시의 로컬 대체용).
- **함께 수정해야 하는 이름**: `SITE.name` 수정 시 검색엔진 구조화 데이터용인 `SITE.organization.name`도 함께 수정하세요. `SITE.crawlerName`은 자체 크롤러 식별자이므로 타 사이트의 명칭을 도용하지 않도록 주의합니다.
- **배포 후 외부 연동 시 변경하지 말아야 할 식별자**: `SITE.mcpPrefix`(MCP 도구 접두사), `PUBLIC_CATEGORIES`(공개 인터페이스 및 구독 피드의 카테고리 매핑), `ABOUT.termsAnchor`(외부 앵커 링크). `SITE.interfaceVersion`은 내림 없이 올리며, 기존 공개 필드나 의미를 바꿀 때 주 버전을 올립니다.
- **간행물 발행 시각은 정시 또는 30분 단위**: `EDITION_TIMES`(한국/베이징 기준 `HH:mm`)는 30분 주기의 스케줄러가 체크하므로 08:00, 08:30 등과 같이 설정합니다.
- **네비게이션 숨김 범위**: `NAV.hidden`은 현재 `"/hot"` 및 `"/topics"` 숨김을 지원합니다(사이드바, 모바일 하단바, 더보기/내 정보, 뒤로가기 링크, 빵부스러기, `"/hot"` 숨김 시 홈 핫이슈 바 및 사건 순위가 함께 정리되지만 직접 URL 접근은 유지됨).
- **속도 제한 안내는 실제 정책과 일치**: 앞단의 리버스 프록시가 실제로 IP 단위 제한을 적용하는 경우에만 `ACCESS.ratePerMinute`를 설정합니다.

---

## 2. 분류, 태그 및 테마: `industry/taxonomy.ts`, `industry/topics.json`

[`industry/taxonomy.ts`](../industry/taxonomy.ts)는 카테고리(`CATEGORIES`), 헤더 중점 소식 카운트(`RELEASE`), 총괄 브리핑 예외 공통 단어(`PLAIN_TERMS`), 콘텐츠 유형(`ITEM_TYPES`), 태그 어휘집 및 동의어(`CATEGORY_TAGS`, `TOPIC_TAGS`, `ENTITY_TAGS`, `TAG_SYNONYMS`), 주요 주체 명부 및 환각 방지 사전(`ENTITIES`, `IDENTITY_LEXICON`, `PUBLISHER_DOMAINS`, `IDENTITY_CONTEXT_ALIASES`)을 정의합니다.

**연동 주의사항**:
- **URL 키는 배포 후 변경 금지**: `CATEGORIES`의 `key`는 실제 URL 경로 및 피드 주소에 포함됩니다(`/all?category=`, `/feed/category/<key>.xml`). 웹 화면은 분리하되 공개 API/RSS에서는 특정 카테고리를 통합 발행하고 싶다면 `site/site.ts`의 `PUBLIC_CATEGORIES`에서 설정하세요.
- **프롬프트와의 동기화**: `CATEGORIES`, 태그 목록 또는 `ITEM_TYPES`를 변경한 경우, `industry/prompts/structure.md`(분류 원칙 및 태그 규칙), `content-understanding.md`(콘텐츠 유형 열거형), `selection-score.md`(콘텐츠 유형별 5대 가중치 표)도 반드시 함께 업데이트해야 합니다.
- **환각 방지 사전 미사용 시**: `IDENTITY_LEXICON`, `PUBLISHER_DOMAINS`, `IDENTITY_CONTEXT_ALIASES`는 기사 제목/요약에 언급된 주체가 실제 원문에 등장했는지를 대조하는 사전입니다. 해당 검사가 필요 없다면 빈 배열 `[]`로 두면 됩니다.
- **주제(Topic) 디렉터리 `industry/topics.json`**: 사이트 부팅 시 로드되며, 수정 후 빌드 재시작이 필요합니다. `company`(기업/기관), `field`(분야/전구), `genre`(유형) 세 그룹으로 나뉘며 `slug`는 배포 후 변경하지 마세요.
  - `company` 주제는 `entityId`(`ENTITIES`의 id)로 해당 주체가 핵심인 보도를 모읍니다(복수 주체가 포함된 보도는 제목에 명기된 경우 포함). 선택 항목 `aliases`에 지정한 단어로도 검색이 가능합니다.
  - `field`와 `genre` 주제는 `tags` 기준으로 해당 태그가 부여된 보도를 모읍니다.

---

## 3. 정보원: `industry/sources.json`

최초 기동 시 데이터베이스로 자동 임포트되는 데모 소스 목록입니다. 이미 존재하는 소스는 덮어쓰지 않으며, 파일에서 삭제하더라도 DB에서 자동 삭제되지 않습니다(불필요한 소스는 관리자 페이지에서 일시정지 처리). 사이트 운영 시작 후에는 주로 관리자 대시보드의 **"정보원"** 페이지에서 추가, 테스트 수집, 주기 조정을 진행합니다.

**핵심 필드**:

| 필드 | 설명 |
|---|---|
| `kind` | `rss`, `web_list`(웹 크롤링), `json_list`(JSON API), `x_search`(X 계정), `mp_account`(위챗), `external`(외부 웹훅) |
| `config` | 소스 종류별 세부 설정 ([정보원 가이드](sources.md) 참조) |
| `tier` | 소스 신뢰도 등급: `T1`(공식 1차 소스), `T1_5`(공식 계정 및 준공식), `T2`(미디어 및 개인), `EXCLUDE_MP`(큐레이션 제외). 등급별로 커트라인 점수가 다름. |
| `owner_entity_id` | 소유 주체 ID(`ENTITIES`). 동일 주체의 여러 소스는 화제성 산출 시 단일 참여자로 취급되며, `T1_5` 공식 계정이 대표 보도가 되려면 지정 필요 ([정보원 가이드](sources.md) 참조). |
| `participation_mode` | `editorial`(추천 큐레이션 및 전체 피드 진입), `hot_signal`(화제성 계산에만 반영), `isolated`(어떤 공개 피드에도 노출 안 됨) |
| `site_fulltext` | 사이트 내 전문(Full-text) 노출 여부. **기본값은 OFF**(요약과 원문 링크만 노출). 소스가 전재를 명시적으로 허용한 경우에만 ON. |
| `syndicate_fulltext` | 전문 RSS에 원문 포함 여부. **기본값은 OFF**. `site_fulltext`가 켜진 경우에만 함께 적용됨. |

---

## 4. 선별 및 작성 프롬프트: `industry/prompts/`

가장 많은 노력을 들여야 하는 영역입니다. 여러분의 업계 전문 지식과 안목이 여기에 작성됩니다.

| 프롬프트 파일 | 역할 |
|---|---|
| `prefilter.md` | 사전 필터: 이 자료가 우리 산업 분야와 관련이 있는지 검사 (광범위 수용, 명백한 무관 건만 차단) |
| `selection-score.md` | **채점 기준**: 0~100점 부여. 콘텐츠 유형, 5개 평가 차원 및 가중치, 필수 평가 가치, 억제해야 할 노이즈 규정 |
| `content-understanding.md` | 입선 및 입선 근접 기사의 가공 양식: 제목, 결론 우선 3줄 요약, 추천 이유 작성 (분류와 태그는 `structure.md` 기준 사용) |
| `rules-domain.md` | 도메인 전문 용어 번역 및 표기 규칙 (예: 영어 약어 유지 여부 등) |
| `mend-wording.md` | 단어 교정: 제목/요약문/선별 근거에 `industry/wording.ts`에 지정된 금지 단어가 포함된 경우 교정 |
| `summarize-*.md` | 일반 기사의 경량 제목·요약 작성 |
| `structure.md` | 카테고리, 태그, 주체 식별, 단일 뉴스 vs 종합 기사 판별, 뉴스 팩트 프레임 추출 |
| `group-*.md` | 사건 클러스터링: 두 기사의 관계(동일 사건, 후속 진척, 별개 사건) 판별 및 중복 검증 |
| `story-digest.md` | 사건 상세 페이지의 종합 개요 생성 (수정 전 [사건 개요 평가](story-digest-evaluation.md)로 병렬 비교) |
| `report-period.md`, `report-period-sections.md` | 주간/월간 리포트의 총괄 브리핑 및 섹션 리드문 작성 (일일 상황보고는 프롬프트 없이 규칙 컴파일) |
| `translate-*.md` | 외신 전문 번역 |

금지 단어 목록(`industry/wording.ts`)을 설정하면 제목·요약·선별 근거 작성 후 정규식으로 검사해 위반 시 1회 교정 호출(`WORDING_MODEL` 지정 가능)을 수행합니다. 교정 후 수치가 바뀌거나 본문이 비거나 모델이 거부하면 원본 문구를 유지하며, 목록이 비어 있으면 검사 및 추가 호출을 생략합니다.

프롬프트 내부에서는 `{{siteName}}`으로 사이트명을, `{{> 파일명}}`으로 다른 프롬프트를 포함할 수 있으며 코드를 수정하지 않고 편집할 수 있습니다.

> [!TIP]
> 기존 프롬프트의 골격(5개 차원 가중치, 노이즈 억제 규칙, 안전 가드레일)은 그대로 유지하고, **"무엇이 중요한 소식인지"**와 **"무엇이 노이즈인지"**의 구체적인 예시만 본인 산업에 맞게 교체하는 방식을 권장합니다.

---

## 5. 커트라인 및 캘리브레이션: `industry/selection.ts`

2회 채점 점수의 합이 `2 × 커트라인` 이상이어야 합격합니다(`browseFloor` 기본값 40, `classes`로 특정 소스 카테고리 하한선 상향 가능).
1. 정보원에서 100~200개 기사를 모아 직접 선정/탈락을 라벨링하고 `.data/gold.jsonl`로 저장합니다([큐레이션 및 캘리브레이션](selection.md) 참조).
2. `node --env-file=.env scripts/eval-selection.ts --gold .data/gold.jsonl` 명령어로 평가를 실행하여 정확도, 정밀도, 재현율, F1 스코어 및 커트라인별 시뮬레이션 결과를 확인합니다.
3. 관리자 대시보드의 **SelectBench**에서 모델이 틀린 사례들을 점검하고 프롬프트(`selection-score.md`)를 보완한 뒤 다시 실행합니다.

---

## 6. 브랜드 및 디자인: `site/brand/`

- `logo.svg`, `icon.png`(512x512), `icon-192.png`, `apple-icon.png`(180), `favicon.ico`: 사이트 아이콘 및 파비콘 교체.
- `Logo.tsx`: 좌측 상단 헤더 로고 컴포넌트. 자체 SVG 로고가 있으면 `Wordmark`를 동일한 props 규격으로 교체하세요.
- `wordmark.svg`, `wordmark-dark.svg`(선택): 공유 카드 및 포스터용 워드마크.
- 공유 이미지 폰트(선택, `assets/og-fonts/`): `<이름>-400.otf/ttf`, `<이름>-700.otf/ttf` 형태로 배치하면 누락된 글자를 파일명 순으로 폴백 렌더링합니다(한국어용 `noto-sans-kr-400.otf`, `noto-sans-kr-700.otf` 등). 폰트 교체 후에는 서비스를 재시작해야 공유 이미지 캐시가 갱신됩니다.
- `nameplates/`: 일보, 주보, 월보 헤더에 들어가는 타이틀 SVG 이미지. 산업 단어 또는 폰트 변경 후 다시 생성:
  ```bash
  node scripts/nameplates.ts [폰트 경로(기본값: assets/og-fonts/noto-sans-kr-700.otf)]
  ```
- 소개 페이지 연락처 QR 코드: `site.ts`의 `ABOUT.maker` 작성 후 관리자 설정에서 업로드하거나 `site/brand/contact/`에 `qr-wechat.*`, `qr-feishu.*`로 배치.

> [!CAUTION]
> AIHOT의 명칭과 공식 로고는 오픈소스 라이선스에 포함되지 않으므로 고유한 이름과 로고를 사용해야 합니다.

독자는 설정 화면에서 "기본 폰트"를 "브라우저 기본 폰트"로 전환할 수 있으며, 이 설정은 현재 브라우저 로컬에만 저장됩니다(로고, 제호 SVG, 공유 이미지는 사이트 브랜드 유지).

---

## 7. 정적 페이지 및 약관: `site/pages/`, `site/public/`, `site/changelog.json`

- `pages/terms.md`, `pages/privacy.md`: 이용약관 및 개인정보처리방침 템플릿입니다. 실제 서비스 운영 정책에 맞게 수정하세요.
- `public/`: 사이트 루트 경로에 배포되는 4가지 고정 파일: `robots.txt`, `manifest.webmanifest`, `openapi-v1.json`, `.well-known/security.txt`. 템플릿 변수(`{{siteName}}`, `{{siteUrl}}`, `{{description}}`, `{{tagline}}`, `{{locale}}`, `{{dailyTime}}`, `{{weeklyTime}}`, `{{monthlyTime}}`, `{{version}}`, `{{categoryList}}`, `"{{categories}}"`)가 빌드/서빙 시 치환됩니다.
- `changelog.json`: 서비스 릴리즈 노트 파일입니다. `kind`는 `"업데이트"`, `"최적화"`, `"공지"`, `"지원종료"` 중 하나를 사용하며, 긴급 공지는 `"urgent": true`를 추가합니다.

---

## 8. 모델 설정 및 배포

- `.env`에 `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`을 지정하면 모든 단계에서 해당 모델이 기본 사용됩니다.
- 단계별로 서로 다른 모델을 적용하려면 `site/models.ts`에 모델을 등록하고 각 단계에 매핑합니다(실행 중에는 환경변수 또는 관리자 "모델 및 평가"에서 재정의 가능).
- 추론형 모델(Reasoning/Thinking)을 사용할 때는 토큰 부족 에러를 방지하기 위해 반드시 `LLM_REASONING_TOKENS`(또는 프리셋의 `reasoningTokens`)를 넉넉하게 설정해야 합니다. 채점 프리셋은 `scoreCall: { temperature, maxTokens, timeoutMs }`를 지정할 수 있으며, `fallbackFor`로 대체 모델을 연결할 수 있습니다.
- 자세한 배포 절차는 [배포 가이드](deploy.md)를 참고하세요.

---

## 수정 후 검증 체크리스트

```bash
# 1. TypeScript 타입 무결성 검사
npm run typecheck

# 2. 백엔드 테스트 실행 (테스트 DB명은 _test 또는 _ci로 끝나야 하며 CREATEDB 권한 필요)
DATABASE_URL=postgres://127.0.0.1:5432/myhot_test npm test

# 3. 프론트엔드 빌드 및 테스트
npm run build -w @aihot/web && npm run test:web

# 4. 서비스 실행 후 스모크 테스트
node scripts/smoke.ts --base http://localhost:3000
```

프롬프트나 커트라인 수정 자체는 테스트를 깨뜨리지 않습니다(테스트가 `industry/selection.ts`와 실제 프롬프트를 동적으로 읽음). 다만 `industry/taxonomy.ts`를 변경한 경우 `tests/` 내의 분류/태그/주체 예시를 새 산업의 항목으로 맞춰야 합니다.
