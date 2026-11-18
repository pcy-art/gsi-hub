# 사이트 패키지 (Site Package)

이 사이트 고유의 설정(이름, 문구, 브랜드, 정적 페이지, 활성화 모듈)이 위치합니다. 세부 절차는 [나만의 산업군으로 변경하기](../docs/customize.md)를 참조하세요.

| 파일 / 폴더 | 설명 |
|---|---|
| `site.ts` | 사이트명, 산업 키워드, 간행물 발행 시간, 메인/소개 문구, 공유 이미지 텍스트, 공개 API 카테고리 매핑 등 |
| `models.ts` | 지정 모델 명부 및 파이프라인 단계별 기본 모델 매핑 |
| `brand/` | 파비콘, 로고 컴포넌트(`Logo.tsx`), 공유 이미지 워드마크(`wordmark.svg`, `wordmark-dark.svg`), 리포트 헤더 이미지(`nameplates/`), 소개 페이지 QR(`contact/`) |
| `pages/` | 이용약관(`terms.md`), 개인정보처리방침(`privacy.md`) 템플릿 |
| `public/` | 사이트 루트에 서빙되는 고정 파일 (`robots.txt`, `manifest.webmanifest`, `openapi-v1.json`, `.well-known/security.txt`) |
| `changelog.json` | 사이트 업데이트 이력 (릴리즈 노트) |
| `modules/` | 활성화할 확장 모듈 목록 (`index.ts`, `server.ts`, `web.ts`) — [아키텍처 문서](../docs/architecture.md#모듈) 참조 |
