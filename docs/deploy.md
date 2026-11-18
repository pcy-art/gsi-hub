# 배포 가이드 (Deployment)

## Docker 배포 (권장)

Docker 및 Docker Compose가 설치된 환경이 필요합니다. 이미지 빌드 과정을 고려하여 클라우드 서버는 최소 2 vCPU, 4GB RAM 이상의 사양을 권장합니다 (지원 아키텍처: Linux x64 및 arm64).

```bash
git clone https://github.com/KKKKhazix/AIHOT.git myhot
cd myhot
node scripts/init-env.ts --llm-key <보유하신_LLM_API_KEY>
```

`init-env.ts` 스크립트는 난수화된 보안 키와 관리자 비밀번호를 포함한 `.env` 파일을 자동 생성하고, 터미널에 관리자 비밀번호를 1회 출력합니다. 만약 호스트 머신에 Node.js가 설치되어 있지 않다면, `.env.example`을 `.env`로 복사한 뒤 `ADMIN_PASSWORD`(최소 12자리 이상), `SESSION_SECRET`, `IMG_PROXY_SIGN_SECRET`, `POSTGRES_PASSWORD`(`openssl rand -hex 32` 명령어로 생성) 및 `LLM_API_KEY`를 직접 입력하세요.

실행 전 `.env` 파일의 `SITE_URL`을 확인하세요:
- 로컬 테스트: `http://localhost:3000` 유지
- 서버 배포: 사용자가 실제로 접속할 주소(IP 또는 도메인)로 변경

```dotenv
SITE_URL=http://192.0.2.10:3000
```

> [!IMPORTANT]
> RSS, 소셜 공유 링크, 사이트맵, Agent Markdown 내의 모든 절대 경로는 `SITE_URL` 값을 기준으로 생성되며, 브라우저가 접속한 주소에 따라 동적으로 바뀌지 않습니다. 도메인 및 HTTPS 환경에서는 아래의 [도메인 및 HTTPS 설정](#도메인-및-https-설정)을 참고하세요.

구성을 마친 후 컨테이너를 빌드하고 백그라운드에서 실행합니다:

```bash
docker compose up -d --build
```

실행 후 `http://서버IP:3000`으로 접속합니다. 관리자 대시보드는 `/admin`에 있으며, 생성된 관리자 비밀번호로 로그인합니다. 첫 기동 시 데모 정보원이 임포트되며, 1~2분 뒤부터 콘텐츠 처리가 시작됩니다. 초기 100여 건의 기사 처리는 전체 분석 파이프라인(사전 필터링, 채점, 구조화, 요약, 클러스터링)을 거치므로 약 30분 정도 소요됩니다.

`docker-compose.yml`은 총 5개의 컨테이너를 띄웁니다:
1. `db`: PostgreSQL 17
2. `setup`: 매 기동 시 DB 마이그레이션과 시드 데이터를 자동 실행한 뒤 정상 종료
3. `api`: 백엔드 Fastify API 서버
4. `worker`: 백그라운드 큐, 크롤러, LLM 파이프라인, 스케줄러
5. `web`: React Router 기반 SSR 웹 프론트엔드 (`web`은 DB/비밀키를 받지 않고 HTTP로 `api`만 조회)

---

### 도메인 및 HTTPS 설정

도메인을 서버 IP로 DNS A 레코드 연결한 뒤 `.env`에 다음을 설정합니다:

```bash
SITE_URL=https://example.com
SITE_DOMAIN=example.com
PORT=127.0.0.1:3000        # 3000 포트는 로컬 Caddy 전용으로 바인딩 (외부 직접 노출 차단)
TRUST_PROXY=true           # Caddy가 전달한 X-Forwarded-* 프록시 헤더 신뢰
```

그런 다음 HTTPS 프로필로 컨테이너를 가동하면 Caddy가 Let's Encrypt SSL 인증서를 자동으로 발급 및 갱신합니다:

```bash
docker compose --profile https up -d --build
```

이미 호스트에 Nginx 등 별도의 웹 서버를 운영 중인 경우, Caddy 프로필 대신 Nginx 리버스 프록시를 `http://127.0.0.1:3000`으로 연결합니다:
- `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`
- `proxy_set_header X-Forwarded-Proto $scheme;` (누락 시 관리자 세션 쿠키의 Secure 플래그가 유실됨)
- `.env`에 `TRUST_PROXY=true` 반드시 설정

#### MCP 허용 호스트 설정
MCP 엔드포인트는 기본적으로 `SITE_URL`의 호스트와 `localhost`, `127.0.0.1`, `[::1]`만 허용합니다. 추가 호스트를 허용하려면 `MCP_ALLOWED_HOSTS`에 쉼표로 구분하여 등록합니다(예: `extra.example.com:8443,[2001:db8::1]`, 대소문자 무관, IPv6는 대괄호 필수, 호스트 검증에만 영향을 미치며 브라우저 Origin 허용 범위는 확장하지 않음).

#### 캐시 정책 주의사항
Nginx나 CDN 캐시를 앞단에 둘 때는 애플리케이션의 `Cache-Control` 헤더 만료 주기를 반드시 준수해야 합니다. 공개 웹페이지, 네비게이션, API, RSS, Markdown 엔드포인트(`/api/v1/agent`), OpenAPI 명세(`/openapi-v1.json`) 등은 5분 뒤 재검증되도록 설계되어 있으며, CDN이 임의로 만료 기한을 연장하거나 오래된 캐시를 stale 응답으로 반환해서는 안 됩니다.

---

### 서비스 업데이트 절차

최신 코드를 풀(pull)받고 무중단 또는 최소 다운타임으로 안전하게 마이그레이션 및 재빌드를 수행하는 표준 절차입니다. 먼저 아래 [데이터 백업 및 복구](#데이터-백업-및-복구) 절차대로 백업한 뒤 진행하세요:

```bash
# 1. 최신 코드 가져오기
git pull

# 2. 신규 이미지 빌드
docker compose build

# 3. 서비스 일시 중지 (DB 및 worker 진행 작업 보호)
docker compose stop api worker web

# 4. setup 컨테이너로 DB 마이그레이션 실행 후 전 서비스 재시작
docker compose run --rm setup && docker compose up -d
```

> [!CAUTION]
> 마이그레이션이 성공한 후에 서비스를 기동해야 합니다. 마이그레이션에 실패한 경우 에러 원인을 먼저 확인하고 수정한 뒤 다시 시도하세요. HTTPS 프로필을 사용 중인 사이트는 `docker compose --profile https up -d` 형태로 실행합니다. worker는 정상 종료 시 진행 중인 유료 API 호출이 끝날 때까지 최대 약 3분 이상 대기한 뒤 종료됩니다. 동시 인덱스 생성이 중단되어 유효하지 않은(`INVALID`) 인덱스가 남은 경우 `DROP INDEX CONCURRENTLY <인덱스명>`으로 정리한 뒤 setup을 다시 실행하세요.

주요 업그레이드 변경 이력:
- **엔진 동기화 (2026-10-31)**: `industry/selection.ts`에 `classes`와 `browseFloor` 추가; 대량 정보원 수집 실패 경보 및 선택형 `WEBHOOK_HUB_URL`/`WEBHOOK_HUB_KEY` 자동 대응 중계 지원; 이미지 AVIF 백그라운드 변환; 피드백 유형 및 제안 풀(`idea`) 지원.
- **프라이빗 피드 허용 목록**: `PRIVATE_FEED_HOSTS`로 `ALLOW_PRIVATE_NETWORK_FETCH` 전체 해제 없이 내부 RSSHub 등 지정 호스트만 허용.
- **금지 어휘 교정 (`industry/wording.ts`)** 및 `NAV.hidden` 네비게이션 숨김 지원.
- **표준 시간 및 안전 밸브**: 모든 `*_ENABLED` 스위치는 소문자 `true`일 때만 활성화됨.

---

### 데이터 백업 및 복구

#### S3 호환 자동 백업
`.env`에 S3 호환 스토리지 설정을 입력하면 매일 04:10에 자동 백업이 수행됩니다:
- `DB_BACKUP_STORE_SECRET_ID`
- `DB_BACKUP_STORE_SECRET_KEY`
- `DB_BACKUP_STORE_BUCKET`
- `DB_BACKUP_STORE_REGION`
- `DB_BACKUP_STORE_DOMAIN` (AWS S3, Cloudflare R2, MinIO 등 버킷 포함 접속 도메인)

백업은 동일 시점의 DB 덤프(`.dump`)와 첨부파일 패키지(`.tar.gz`) 한 쌍으로 생성되며(첨부파일이 없으면 `.dump`만 업로드), 날짜에 따라 `daily/`, `weekly/`(일요일), `monthly/`(매월 1일) 접두사로 각 1회만 업로드됩니다. 복구 시에는 호환되는 `pg_restore`로 빈 DB에 `.dump`를 복원하고 `.tar.gz`를 데이터 디렉터리 루트(Docker는 `/data`, 비-Docker는 `AIHOT_DATA_DIR`)에 해제합니다.

#### 수동 DB 백업 (명령어)
```bash
docker compose exec -T db pg_dump -U aihot aihot | gzip > myhot-$(date +%F).sql.gz
```

Docker 볼륨 영속성:
- `db`: PostgreSQL 데이터베이스 데이터
- `data`: 업로드 이미지, 이미지 캐시, 로컬 백업
- `caddy`: SSL 인증서
- `docker compose down` 명령어는 볼륨을 삭제하지 않습니다 (`-v` 플래그를 붙이지 않는 한 안전함).

---

### 로그 확인 및 관리자 세션 관리

```bash
docker compose logs -f --tail 100 api worker web
```

관리자 대시보드의 **"운영"** 페이지에서 최근 백그라운드 큐 작업 및 스케줄러 상태를 확인할 수 있으며, **"정보원"** 페이지에서 개별 소스의 크롤링 성공/실패 여부를 모니터링할 수 있습니다.

관리자 세션은 로그인 방식과 당시 자격 증명에 바인딩됩니다. `ADMIN_PASSWORD`, `ADMIN_FEISHU_UNION_IDS`, `ADMIN_EMAILS`, `SESSION_SECRET` 등을 변경한 후에는 모든 API 프로세스를 재시작해야 새 설정이 일관되게 반영되며 기존 무효 세션이 폐기됩니다.

---

### 운영 비용 관리 (Cost Optimization)

- **LLM 호출 비용**:
  - 기사 수집 시 1차 사전 필터링(1회) → 합격 시 2회 채점, 구조화(1회), 제목/요약 작성(1회) → 사건 클러스터링(유사 기사 존재 시 1회) + 사건 개요·주간/월간 총괄·전문 번역.
  - 본문 없는 단순 링크 X 게시글은 모델을 호출하지 않습니다.
  - 일일 리포트(일일 상황보고)는 룰 기반 알고리즘으로 작성되므로 모델 비용이 들지 않습니다.
  - 데모 소스 기준 초기 152개 기사 분석에 약 930회의 모델 호출이 발생했습니다. 이후의 일일 비용은 등록한 정보원의 하루 발행량에 정비례합니다.
- **유료 수집 서비스 (X, 위챗, Jina)**: 요청당 과금되며 키를 설정한 경우에만 동작합니다.
- **예산 서킷 브레이커 (Safety Circuit Breaker)**:
  - 관리자 "설정 → 유료 요청 한도"에서 분/시간/일 단위 API 호출 상한선을 지정할 수 있으며(`0` 입력 시 즉시 중단), 상한 도달 시 자동으로 요청이 중단되어 요금 폭탄을 방지합니다.
- **비용 절감 팁**:
  1. 관리자 **"모델 및 평가"** 페이지에서 토큰 소모량이 큰 단계를 식별합니다.
  2. 추론(Thinking/Reasoning) 모드가 불필요한 단계는 비활성화합니다(`.env.example`의 `LLM_EXTRA_JSON` 참고).
  3. 단순 필터링이나 사전 검사 단계에는 가볍고 저렴한 모델(`PREFILTER_MODEL`, `SCORE_MODEL`, `STRUCTURE_MODEL` 등)을 매핑합니다(채점 모델 변경 전 `scripts/eval-selection.ts`로 검증 권장).
  4. 도메인과 무관한 노이즈가 많은 소스는 과감히 주기를 늦추거나 비활성화합니다.

---

## 비-Docker 직접 설치 (Linux 환경)

Node.js 24.11 이상 및 PostgreSQL 16/17이 구성된 Linux 환경에서 직접 구동할 수 있습니다.

```bash
# 1. 패키지 설치 및 초기 환경 생성
npm ci
node scripts/init-env.ts --llm-key <보유하신_LLM_API_KEY>
createdb myhot
```

`.env` 파일에 데이터베이스 연결 정보를 추가합니다:

```dotenv
DATABASE_URL=postgres://사용자명@127.0.0.1:5432/myhot
API_BASE_URL=http://127.0.0.1:3001
```

마이그레이션 실행 및 초기 빌드:

```bash
node --env-file=.env scripts/migrate.ts
node --env-file=.env scripts/seed.ts
npm run build -w @aihot/web
```

3개 독립 프로세스 실행(반드시 모두 `NODE_ENV=production` 설정):

```bash
# 1. API 서버 (3001 포트)
NODE_ENV=production node --env-file=.env apps/api/src/main.ts

# 2. 백그라운드 워커 (별도 터미널 또는 백그라운드)
NODE_ENV=production node --env-file=.env apps/worker/src/main.ts

# 3. Web 프론트엔드 (3000 포트)
cd apps/web && NODE_ENV=production node --env-file=../../.env server.ts
```

> [!NOTE]
> 프로덕션 운영 시에는 `systemd` 또는 `pm2`를 사용하여 프로세스를 데몬화하세요(`NODE_ENV=production` 유지). worker 종료 시 큐 드레인(470초) 및 DB·백업(`pg_dump`, `tar`) 정상 종료를 위해 graceful shutdown 타임아웃을 최소 515초 이상 부여해야 합니다 (`systemd`: `TimeoutStopSec=515`, `KillMode=mixed` / `pm2`: `kill_timeout: 515000`, `treekill: false`). 개발 시에는 `npm run dev:api`, `npm run dev:worker`, `npm run dev:web`를 사용할 수 있습니다.
