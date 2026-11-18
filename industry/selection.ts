// 선별 기준 점수(Selection Floor). 평가 기준 자체는 prompts/selection-score.md에 기술되어 있으며, 본 설정은 "몇 점 이상을 선정할 것인가"를 정의합니다.
// 수집된 모든 정보원은 평가 모델을 통해 2회 독립 채점(0–100점)을 수행하며, 두 점수의 합계가 2 × 기준점수 이상이어야 선별 후보가 됩니다.
// 정보 가치 및 신규성이 확인된 후 발행 규칙에 따라 게재 여부가 결정되며(docs/selection.md 참조), 카드에는 2회 채점의 평균 점수가 표시됩니다.
// 기준 점수는 출처 등급(Tier)에 따라 구분됩니다: 정부/군 공식 1차 정보원은 문턱을 낮추고, 일반 언론 및 개인 채널은 문턱을 높입니다.
// 기준 점수나 프롬프트를 변경한 후에는 scripts/eval-selection.ts를 통해 라벨링된 검증 셋에서 사전 재평가를 수행합니다.

export const SELECTION = {
  /**
   * 정보원 등급(Tier)별 선별 기준 점수(평균 점수). 관리자 '정보원 관리' 메뉴에서 설정:
   *   T1: 공식 1차 당국 (국방부, 합참, 백악관, DoD, 방위성, NATO 등)
   *   T1_5: 전문 싱크탱크 및 준공식 기관 (CSIS, 38North, RUSI, ISW 등)
   *   T2: 글로벌 외신 및 일반 언론 (Reuters, AP, 연합뉴스 등)
   * EXCLUDE_MP 및 미분류 등급은 선별 채점에 참여하지 않고 '전체 동향'으로만 인입됩니다.
   */
  thresholds: { T1: 60, T1_5: 65, T2: 76 } as Record<string, number>,
  /**
   * 정보원 카테고리별 기준 하한선:
   *   ecosystem (방산·사이버 인프라): 핵심 기술, 위성, 통신망, 방산 연구소, 사이버 보안 위협 분석
   *   leaderboard (싱크탱크·평가 리포트): 전력 평가 지표, 군사력 랭킹, 심층 안보 연구 보고서
   */
  classes: {
    ecosystem: { label: "방산·사이버 인프라", threshold: 70 },
    leaderboard: { label: "싱크탱크·평가 리포트", threshold: 76 },
  } as Record<string, { label: string; threshold: number }>,
  /**
   * 선별 기준에는 미치지 못했으나 본 점수 이상인 문건은 상세 분석(제목, 핵심 요약, 추천 사유)을 생성하며,
   * 그 미만 문건은 경량 번역 요약만 생성합니다.
   */
  understandFloor: 50,
  /**
   * '전체 동향' 피드 표시 하한선: 평균 점수가 40점 이상인 문건만 표시하여 저품질 복제/도배 기사를 필터링합니다.
   */
  browseFloor: 40,
} as const;
