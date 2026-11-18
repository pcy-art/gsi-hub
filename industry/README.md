# 도메인 산업 패키지 (Industry Pack)

해당 산업군의 전문 지식(분류, 주제, 정보원, 선별 기준, 커트라인)이 모두 여기에 위치합니다. 타 산업군으로 서비스를 전환할 때는 주로 이 폴더와 [`site/`](../site/)(사이트명, 문구, 브랜드, 페이지)를 수정합니다. 세부 절차는 [나만의 산업군으로 변경하기](../docs/customize.md)를 참조하세요.

| 파일 / 폴더 | 설명 |
|---|---|
| `taxonomy.ts` | 카테고리, 태그, 기업/기관 목록, 환각 방지 사전, 주요 릴리즈 정의(`RELEASE`) |
| `topics.json` | 주제 디렉터리(`/topics`), 사이트 부팅 시 로드 |
| `sources.json` | 최초 기동 시 자동 등록될 데모 정보원 목록 |
| `prompts/` | 파이프라인 단계별 프롬프트 (사전 필터, 채점, 작성, 구조화, 클러스터링, 개요, 리포트, 번역) |
| `selection.ts` | 소스 등급별 선정 커트라인 점수 |
| `wording.ts` | 독자용 문구 교정 규칙 (`mend-wording.md`) |
| `gold.example.jsonl` | 큐레이션 선별 평가용 골드 데이터셋 예시 |
| `relation-gold.example.jsonl` | 사건 관계 판별 평가용 데이터셋 예시 |
| `story-digest-eval.example.jsonl` | 사건 개요 프롬프트 평가 케이스 예시 |
