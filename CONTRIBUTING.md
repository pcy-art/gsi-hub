# 기여 가이드 (Contributing)

재현 가능한 버그 리포트, 문서 교정, 그리고 다른 산업군에도 범용적으로 유용한 기능 개선 기여를 환영합니다. 한국어, 영어, 중국어로 자유롭게 소통하실 수 있습니다.

## 커뮤니케이션 채널

- [Issues](https://github.com/KKKKhazix/AIHOT/issues/new/choose): 재현 가능한 버그 및 명확한 사용 시나리오가 있는 기능 제안.
- [배포 및 사용 Q&A](https://github.com/KKKKhazix/AIHOT/discussions/categories/q-a): 설치, 설정, 배포 및 사용 관련 질문 (해결 시 채택 가능).
- [아이디어 토론](https://github.com/KKKKhazix/AIHOT/discussions/categories/ideas): 기능 구현 전 방향성과 시나리오 사전 논의.
- [Show & Tell](https://github.com/KKKKhazix/AIHOT/discussions/categories/show-and-tell): 직접 구축한 산업별 핫이슈 사이트 및 운영 경험 공유.
- 보안 취약점은 [보안 가이드](SECURITY.md)에 따라 비공개 채널로 접수해 주세요.

## 기여 범위

배포 편의성, 범용 크롤링 기능, 데이터 처리 파이프라인, 공개 인터페이스, 웹 접근성, 문서화 및 재현 가능한 결함 수정 기여를 우선적으로 환영합니다. 대규모 아키텍처 변경이나 핵심 동작 변경은 착수 전에 Issue나 Discussion을 통해 먼저 논의해 주세요.

특정 도메인에만 국한된 정보원이나 선별 기준은 자체 저장소의 `industry/`에서 수정하고, 사이트명/브랜드는 `site/`에서, 독자적인 추가 기능은 `modules/`에 모듈로 추가하세요([아키텍처 문서](docs/architecture.md#모듈) 및 [커스터마이징 가이드](docs/customize.md) 참조). 규정 준수 및 보안상 전체 운영 정보원 목록은 공유하지 않으며, 특정 폐쇄 플랫폼 전용 크롤링 어댑터는 유지보수하지 않으므로 [정보원 가이드](docs/sources.md)의 외부 푸시 API로 연동하세요.

## 변경사항 제출 절차

1. 저장소를 Fork하고 최신 `main` 브랜치에서 새 작업 브랜치를 생성합니다. (독립 사이트만 구축하는 경우 GitHub의 [Use this template](https://github.com/KKKKhazix/AIHOT/generate)을 사용할 수 있으나, 향후 업스트림 기여나 업데이트 병합에는 Fork가 유리합니다.)
2. [AGENTS.md](AGENTS.md) 및 관련 문서를 확인합니다. 1개의 PR은 1개의 명확한 문제를 해결해야 하며, 무관한 리팩토링이나 단순 의존성 재설치로 인한 `package-lock.json` 변경을 포함하지 마세요.
3. [배포 문서](docs/deploy.md)에 따라 로컬 환경을 구성하고, 테스트 시에는 수집, 모델 호출 및 외부 푸시를 비활성화합니다. 프로덕션 DB나 실제 유료 API로 테스트하지 마세요.
4. 코드 수정 후 다음을 실행해 검증합니다:
   - `npm run typecheck`
   - `npm test` (테스트 DB명은 `_test` 또는 `_ci`로 끝나야 하며 DB 계정에 `CREATEDB` 권한 필요)
   - `npm run build -w @aihot/web && npm run test:web`
   - 실행 중인 사이트 스모크 테스트: `node scripts/smoke.ts --base http://localhost:3000`
   - DB 마이그레이션 검사: `node scripts/check-migrations.ts --base main` ([마이그레이션 규칙](docs/architecture.md#데이터베이스-마이그레이션) 참조)
   - 백업 복원 테스트에는 `tar`와 서버 버전과 호환되는 `pg_dump`/`pg_restore`가 필요합니다.
5. `main` 브랜치를 향해 PR을 생성하고, 관련 Issue를 연결하며, "Allow edits by maintainers" 옵션을 켜주세요. 화면 변경 시 스크린샷을 첨부하고 설정·업그레이드 절차가 바뀐 경우 [배포 문서](docs/deploy.md)를 함께 갱신하세요.
6. 머지 전 PR 브랜치를 단일 커밋으로 정리해 올바른 작성자 정보를 유지하고, 이미 푸시한 브랜치 갱신 시 `git push --force-with-lease`를 사용하세요.
7. `.env`, API 키, 관리자 비밀번호, 쿠키, 프로덕션 데이터 또는 라이선스 미확인 자료는 절대 커밋에 포함하지 마세요. 코드는 [MIT 라이선스](LICENSE)를 따르며 브랜드 및 서드파티 에셋 안내는 [NOTICE](NOTICE)를 참조하세요.
