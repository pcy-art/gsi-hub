# 정보원 (Sources) 가이드

정보원은 관리자 대시보드의 **"정보원"** 페이지에서 관리합니다. 신규 생성, 실시간 테스트 수집(Preview), 수집 주기 변경, 활성화/일시정지, 실패 사유 확인 및 최근 수집 기사 목록 조회가 가능합니다. 사이트 최초 기동 시 `industry/sources.json`에 정의된 데모 정보원들이 데이터베이스로 자동 임포트됩니다.

## 6가지 정보원 유형

| 유형 (`kind`) | 적합한 대상 | 요구 사항 |
|---|---|---|
| `rss` | RSS / Atom 피드를 지원하는 블로그, 미디어, Substack, RSSHub 등 | 없음 |
| `web_list` | RSS가 없는 웹 뉴스 목록 (공지사항, 블로그 목록, 릴리즈 노트) | CSS 선택자 작성 필요 (필요 시 Jina Reader 연동, 건당 과금) |
| `json_list` | JSON 데이터를 반환하는 REST API (GitHub Releases 등) | 필드 경로 매핑 작성 필요 |
| `x_search` | X(트위터) 계정 모니터링 | SocialData API 키 (요청당 과금) |
| `mp_account` | 위챗 공중계정 (WeChat Official Account) | Dajiala(다자라) API 키 (요청당 과금) |
| `external` | 자체 스크립트/크롤러에서 푸시하는 외부 콘텐츠 | `INGEST_TOKEN` 인증 |

`json_list`의 주소나 구성에 자격 증명이 포함될 수 있으므로, 동일 출처(프로토콜, 호스트, 포트 일치) 리다이렉트만 따릅니다.

기본적으로 크롤링 작업은 내부 사설망(Private IP) 접속을 차단합니다. 로컬 Docker 네트워크 내의 RSSHub(`http://rsshub:1200/...`) 등 내부 주소를 사용하려면 `.env`에 `PRIVATE_FEED_HOSTS=rsshub` 형태로 허용 호스트를 등록하세요(쉼표 구분, 대소문자 무관, `rss.feedUrl` / `web_list.url` / `json_list.url` 자체만 직결 허용되며 리다이렉트 대상 호스트·본문·이미지에는 미적용). 링크-로컬이나 클라우드 메타데이터 IP(`169.254.0.0/16`, `100.100.100.200` 등)는 항상 차단됩니다.

각 정보원이 허용하는 설정 키 목록은 [`config-keys.ts`](../packages/backend/src/sources/config-keys.ts)에 정의되어 있습니다. 인식되지 않는 설정 키가 있으면 저장이 거부되거나 수집 시 오류로 보고됩니다.

## 미리보기 후 생성 (Preview First)

`/admin/sources/new`에서 ID, 이름을 입력하고 유형을 선택한 뒤 [아래 유형별 설정](#정보원별-세부-설정-방법)에 맞는 JSON을 입력합니다(`kind`나 `config` 래퍼 없이 설정 객체만 입력).

- **이름 입력 팁**: 이름 뒤 괄호 안의 메모(예: `모 미디어（속보 RSS）`)는 관리자 화면에만 표시되며, 사용자에게는 괄호 내용이 제거된 깨끗한 이름만 노출됩니다. X 계정의 경우 `X: 표시이름 (@handle)` 형식으로 지정하면 일반 사용자에게는 표시이름만 보입니다. 공개 API JSON에는 전체 이름이 유지됩니다.
- **미리보기(Preview)**: `rss`, `web_list`, `json_list`, `x_search`는 "미리보기 수집" 버튼을 눌러 최근 20개 항목의 제목, 링크, 발행일, 요약 파싱 결과를 DB 저장 없이 즉시 검증할 수 있습니다. 미리보기도 실제 수집과 동일한 필터(`allowUrlPrefixes`, 분류, 노이즈 키워드, `publishedAfter`)를 적용하지만, 실제 요청이 발생하므로 X/Jina는 유료 과금될 수 있습니다(`COLLECT_ENABLED=false`는 백그라운드 자동 수집만 끄므로 수동 미리보기에는 적용되지 않음).

---

## 정보원별 세부 설정 방법

### 1. rss

```json
{ "feedUrl": "https://example.com/feed.xml" }
```

- **옵션 필드**:
  - `summaryIsBody`: 피드의 요약(`description`, Atom의 `summary`)이 곧 전체 본문인 경우 `true`로 설정하면 원문 웹페이지를 추가로 크롤링하지 않습니다.
  - `allowCategories` / `denyCategories`: 피드 카테고리 태그 기반 화이트리스트/블랙리스트 필터링.
  - 유튜브, 비메오 등 동영상 재생 페이지는 본문으로 추출하지 않고 텍스트 설명문만 발췌합니다.
  - 기사 본문 내 네이티브 동영상은 안전한 미디어 URL과 재생 컨트롤만 유지하고 자동재생/사전로드를 끕니다. 내장 SVG 그림은 접근성 텍스트(`aria-label`, `<title>`, `<desc>`)만 보존합니다.
  - 웹페이지가 없는 순수 팟캐스트 에피소드는 오디오/비디오 미디어 링크를 원문 링크로 취급합니다.

### 2. web_list

일반 HTML 웹페이지의 기사 목록을 CSS 선택자로 긁어옵니다. 핵심은 `itemSelector`가 전체 목록 컨테이너가 아니라 **각각의 개별 기사 노드**를 가리켜야 한다는 점입니다.

```html
<div class="news-list">
  <div class="news-item">
    <h2><a href="/posts/first">첫 번째 예시 뉴스</a></h2>
    <time datetime="2026-10-01T09:00:00+08:00">10월 1일</time>
  </div>
  <div class="news-item">
    <h2><a href="/posts/second">두 번째 예시 뉴스</a></h2>
    <time datetime="2026-10-01T10:00:00+08:00">10월 1일</time>
  </div>
</div>
```

```json
{
  "url": "https://example.com/news",
  "parseMode": "html",
  "itemSelector": ".news-list > .news-item",
  "linkSelector": "h2 a",
  "titleSelector": "h2 a",
  "publishedAtSelector": "time",
  "allowUrlPrefixes": ["https://example.com/posts/"]
}
```

- `linkSelector` / `titleSelector`: 개별 아이템 내부에서 링크와 제목을 찾을 상대 선택자.
- `publishedAtSelector`: 날짜를 찾을 선택자 (`datetime`, `content`, `title` 속성 및 텍스트 순차 검사). 타임존이 없는 날짜는 `publishedAtUtcOffset`(기본 `+08:00`)이 적용되며, 순수 `YYYY-MM-DD`는 UTC 자정 기준으로 읽습니다.
- `parseMode`: 일반 웹은 `html`. Markdown 문서 목록은 `markdown`, 릴리즈 노트 형태는 `docusaurus_changelog` 또는 `intercom_changelog`.
- **Jina Reader 연동**: 자바스크립트 렌더링이 필요한 SPA 페이지의 경우 URL을 `https://r.jina.ai/https://대상사이트/경로` 형태로 입력하고 `.env`에 `JINA_API_KEY`를 설정합니다(Jina는 기본적으로 Markdown을 반환하며 CSS 선택자를 쓰려면 `parseMode: "html"` 명시 필요).
- `detail`: 목록 페이지에 날짜나 요약이 부족하여 상세 페이지를 추가 방문해야 할 때 지정합니다(`publishedAtSelector`, `titleSelector`, `summarySelector`, `titleAuthoritative`, `titleRegex`, `publishedAtRegex`). `maxFetches`로 1회 수집당 최대 방문할 상세 페이지 수를 제한할 수 있습니다(미설정 시 0). RSS, JSON 목록에서도 `detail`을 사용할 수 있습니다.
- `allowUrlPrefixes` / `denyUrlPrefixes`: 지정된 경로 접두사에 해당하는 기사만 수집합니다.

### 3. json_list

API가 JSON 배열을 반환할 때 각 필드를 점(.) 경로로 매핑합니다(JSONPath가 아니므로 `$`나 `[*]`를 쓰지 않음):

```json
{
  "url": "https://example.com/api/news",
  "mode": "json_api",
  "itemsPath": "data.items",
  "titlePaths": ["title"],
  "urlTemplate": "{raw:url}",
  "summaryPaths": ["summary"],
  "publishedAtPath": "published_at",
  "externalIdPath": "id"
}
```

- API 최상위가 바로 배열인 경우 `itemsPath` 생략. `titlePaths`, `summaryPaths`, `authorPaths`는 첫 번째 비어 있지 않은 값을 취하는 후보 배열입니다.
- `urlTemplate`: `{raw:url}`처럼 원문 필드 값을 그대로 넣거나 `https://example.com/posts/{id}` 형식으로 완전한 HTTP(S) 주소를 조합합니다.
- `summaryIsBody`: 요약이 전문인 경우 `true`로 설정.
- 타임스탬프가 초/밀리초 정수인 경우 `publishedAtUnit: "epoch_s"` 또는 `"epoch_ms"`, `20261001` 형식은 `"yyyymmdd"` 지정.

### 로컬 HTML/JSON 예시 실행

저장소에는 테스트용 가상 예시 [news.html](examples/sources/news.html)과 [news.json](examples/sources/news.json)이 제공됩니다. Node.js 24.11 이상에서 아래 임시 로컬 서버를 띄운 뒤, 개발 API에 `ALLOW_PRIVATE_NETWORK_FETCH=true`를 설정하고 관리자 화면에서 미리보기 수집을 테스트할 수 있습니다:

```bash
node --input-type=module -e '
import http from "node:http";
import { readFileSync } from "node:fs";
const files = {
  "/news.html": ["text/html; charset=utf-8", readFileSync("docs/examples/sources/news.html")],
  "/news.json": ["application/json", readFileSync("docs/examples/sources/news.json")]
};
http.createServer((req, res) => {
  const file = files[req.url];
  res.writeHead(file ? 200 : 404, { "content-type": file ? file[0] : "text/plain" });
  res.end(file ? file[1] : "Not found");
}).listen(8787, "127.0.0.1");'
```

### 4. x_search

SocialData API를 활용한 X(트위터) 계정 검색 수집입니다:

```json
{ "query": "from:SomeAccount -filter:replies", "searchType": "Latest" }
```

- `.env`에 `SOCIALDATA_API_KEY`가 설정되어 있어야 합니다.
- 프로덕션 수집 시 개별 계정 검색 요청은 20여 개씩 자동으로 묶여(Batch) 실행되어 API 호출 비용을 절감합니다(수동 미리보기는 단독 호출).

### 5. mp_account

위챗 공중계정 수집입니다(Dajiala API 연동):

```json
{ "ghid": "gh_xxxxxxxx", "nickname": "공중계정명" }
```

- `.env`에 `DAJIALA_KEY`가 필요하며, `ghid`는 공중계정 고유 ID입니다(`biz`나 `name`이 아닌 `ghid`/`nickname` 사용). 현재 `mp_account`와 `external`은 미리보기 수집을 지원하지 않습니다.

---

## 소스 등급(Tier), 참여 모드, 발행 주체 및 전문 공개 정책

- **신뢰도 등급 (`tier`)**:
  - `T1`: 1차 공식 출처 (정부 기관, 군 당국, 공식 사이트/블로그). 큐레이션 통과 커트라인이 가장 낮음.
  - `T1_5`: 공식 계정 및 준공식 크리에이터.
  - `T2`: 일반 미디어 및 개인 블로그. 높은 커트라인 적용.
  - `EXCLUDE_MP`: 큐레이션 심사에서 제외.
- **소스 카테고리 (`selection_class`, 선택)**: 관리자 화면에서 `industry/selection.ts`의 `classes`를 지정해 커트라인 하한선을 높일 수 있습니다.
- **참여 모드 (`participation_mode`)**:
  - `editorial`: 정식 큐레이션 심사 및 전체 피드에 모두 진입 (기본값).
  - `hot_signal`: 화면에 단독 기사로 노출되지 않고, 화제성(Heat) 언급량 계산에만 반영.
  - `isolated`: 어떤 공개 페이지에도 노출되지 않는 비공개 수집.
- **1차 출처 및 대표 기사 우선권**: `T1`만 1차 출처로 인정됩니다. 동일 사건에 대해 여러 기사가 수집되면 `T1` 1차 소스가 최우선으로 대표 기사 자격을 얻습니다.
- **발행 주체 식별 (`config` 내 선택 항목)**:
  - `publisherUrlPrefixes`: `T1` 소스의 공식 기사 URL 접두사 목록. 타 집계 사이트가 동일 URL을 가져와도 유일한 공식 소스로 식별되면 공식 출처로 귀속됩니다.
  - `publisherRole`: `T1_5` 계정의 신분(`"organization"` 또는 `"person"`). `owner_entity_id`와 함께 설정되면 해당 주체에 관한 기사에서 `T1` 다음 순위의 대표 보도 자격을 얻습니다.
- **전문(Full-text) 공개 여부**:
  - `site_fulltext`: 사이트 화면 내 전문 노출 여부 (기본값 OFF).
  - `syndicate_fulltext`: RSS 피드에 원문 전문 포함 여부 (기본값 OFF).
  - 저작권 보호를 위해 명시적인 전재 허가가 있는 경우에만 활성화해야 합니다.

---

## 크롤링 주기 자동 조정 및 건강도 모니터링

각 정보원은 최근 7일간의 발행 빈도에 따라 매일 04:20에 수집 주기가 자동 조정됩니다:
- 발행 빈도가 높은 소스: 최소 15분 간격 (Jina 사용 웹페이지는 최소 60분).
- 일반적인 소스: 기본 60분 간격.
- X 계정 및 Jina 웹페이지: 최대 120분 (일괄 검색 X 계정은 편집용 30분, 신호용 60분).
- 화제성 신호용(`hot_signal`) 소스: 최대 180분.
- 연속 수집 실패 시 관리자 화면에 적색 경고가 표시되며, 매주 월요일 정보원 주간 리포트 알림이 발송됩니다.
- **"7일 이상 신규 수집 없음"** 판정은 고정 기간이 아니라 최근 90일간의 산출일(중위 간격의 4배 초과 여부, 최소 4일 이상의 산출 이력 필요, 최초 임포트는 1회 산출일로만 계산)을 기준으로 정보원별 발행 리듬에 맞춰 판단합니다.

---

## 규칙: 과거 기사 도배 방지 (Anti-Spam / Backfill Protection)

- **48시간 규칙**: 최초 수집 시점에 이미 발행된 지 48시간을 초과한 기사, 신규 소스 등록 시 들어오는 대량의 과거 아카이브 기사, 백필 푸시는 발행일 기준으로 아카이브만 될 뿐 오늘 피드에 진입하지 않으며 푸시 알림도 발송하지 않습니다. 신뢰할 수 있는 발행 시각이 없는 기사는 날짜가 확인될 때까지 공개하지 않습니다.
- **초기 임포트 제한**: 새 소스 등록 시 목록 상위 30건(`_aihot.initialBackfillLimit`), 최근 12개월 이내(`_aihot.initialBackfillMonths`) 기사만 1회성으로 받아옵니다. 이후 수집에서는 최초 임포트 시점 기준 48시간 전 이후의 기사만 수용합니다(X 계정은 위치 기반으로 예외).
- **모니터링 시작 시점 고정 (`publishedAfter`)**:
  - 특정 시점 이후의 소식만 수집하고 싶을 때 RSS/웹/JSON 설정에 `"publishedAfter": "2026-10-01T00:00:00.000Z"`(완전한 UTC 시각)를 추가하면 이 시점보다 엄격히 이후이고 발행일이 신뢰할 수 있는 기사만 수집합니다.

---

## 외부 푸시 API (External Ingestion)

자체 크롤러나 내부 파이프라인에서 수집한 기사를 시스템으로 직접 밀어 넣을 수 있습니다.

```http
POST /api/ingest/items
Authorization: Bearer <INGEST_TOKEN>
Content-Type: application/json

{
  "sourceId": "my-crawler",
  "sourceName": "사내 수집 스크립트",
  "items": [
    {
      "title": "기사 제목",
      "url": "https://example.com/article/1",
      "publishedAt": "2026-10-01T08:00:00+08:00",
      "author": "홍길동"
    }
  ]
}
```

- `.env`에 16자리 이상의 `INGEST_TOKEN`을 설정해야 합니다(미설정 시 401 반환).
- 1회 요청당 최대 50건까지 전송 가능하며(초과 시 413), 분당 호출 제한은 `INGEST_RATE_LIMIT`(Docker Compose 기본값 10, 초과 시 429)으로 제어합니다.
- 처음 들어온 `sourceId`는 자동으로 `external` 타입 소스로 생성되며, 관리자 페이지에서 참여 모드를 `editorial`로 켜주고 일시정지를 해제해야 정식 큐레이션 심사에 참여합니다(일시정지 시 409 반환).
- 과거 데이터 회귀 적재 시 항목에 `raw._aihot.backfill: true`를 지정하면 당일 피드 도배 없이 과거 날짜로 안전하게 아카이브 적재됩니다.
