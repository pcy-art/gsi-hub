// 글로벌 안보 인텔리전스 도메인 분류 체계: 4대 전략 축, 카테고리, 태그, 주요 주체 및 정체성 사전
// 모델은 본 사전에 따라 팩트를 추출하고 태그를 부여하며, 정세 일보 편철 및 필터링에 반영됨.

/**
 * 포털 카테고리 (필터, 카드 뱃지, RSS 분류 구독).
 * key는 시스템 URL 및 API 식별자.
 * section은 정세 일보 및 리포트 섹션 헤더.
 */
export const CATEGORIES = [
  {
    key: "military_strategic",
    tagColor: "red",
    label: "군사·도발",
    feedLabel: "군사 및 무력도발",
    section: "군사 도발 및 무력 충돌",
    guide: "탄도/순항/극초음속 미사일 발사, 핵시설 가동, WMD 징후, 전황, 국경 충돌, 군사 훈련, 무기 이전 및 국제 테러 단체(하마스, 후티 등) 무기 유입 커넥션.",
  },
  {
    key: "maritime_security",
    tagColor: "turquoise",
    label: "해양안보",
    feedLabel: "해양 안보 및 SLOC",
    section: "해양 안보 및 전략 해상교통로",
    guide: "서해/동해 NLL 침범, 대만해협 및 남중국해 영유권 충돌/물대포, 홍해·호르무즈 해협 상선 피격, 해저 광케이블/가스관 사보타주, 공해상 다크쉽 불법 환적(STS).",
  },
  {
    key: "alliance_sanctions",
    tagColor: "indigo",
    label: "동맹·외교",
    feedLabel: "동맹 및 제재외교",
    section: "글로벌 동맹 재편 및 다자 안보·제재",
    guide: "한미동맹, 한미일 캠프 데이비드, NATO-IP4, QUAD, AUKUS, 북·러 포괄적 조약, UN 안보리 대북/대러 제재 결의 및 다국적 제재 모니터링 팀(MSMT) 추적.",
  },
  {
    key: "hybrid_cyber_crime",
    tagColor: "violet",
    label: "사이버·우주",
    feedLabel: "하이브리드 및 사이버·초국가 범죄",
    section: "하이브리드 위협, 사이버 범죄 및 우주 안보",
    guide: "국가 배후 APT 해킹(라자루스, 김수키 등), 방산/원전 기밀 탈취, 가상자산 탈취 및 다국적 믹서 자금세탁, 국가 인프라 랜섬웨어, 군사정찰위성 발사, 전자전(EW), GPS 교란.",
  },
  {
    key: "economic_security",
    tagColor: "orange",
    label: "경제안보",
    feedLabel: "경제 안보 및 공급망",
    section: "경제 안보 및 핵심 공급망",
    guide: "반도체, 희토류, 이차전지 핵심 광물 수출 통제, 핵심 공급망 블록화 및 통상 압박 조치.",
  },
  {
    key: "opinion",
    tagColor: "purple",
    label: "정세분석",
    section: "전문가 및 싱크탱크 정세 평가",
    guide: "국내외 권위 있는 안보 싱크탱크(CSIS, ISW, RAND, KIDA 등) 및 전문가의 전략 논평, 전황 예측, 정책 제언.",
    commentary: true,
  },
] as const satisfies ReadonlyArray<{ key: string; tagColor: string; label: string; feedLabel?: string; section: string; guide: string; commentary?: true }>;

/** 정세 일보 헤더의 주요 지표 카운트 기준 */
export const RELEASE: { category: string; tag: string; unit: string } | null = {
  category: "military_strategic",
  tag: "미사일 도발",
  unit: "회 도발",
};

/** 종합 리포트 총괄 브리핑에서 출처 검증 없이 사용할 수 있는 범용 군사·안보 용어 (소문자) */
export const PLAIN_TERMS: readonly string[] = [
  "icbm", "srbm", "irbm", "slbm", "nll", "dprk", "un", "nato", "tel", "gps", "apt", "eez", "sloc",
  "quad", "aukus", "msmt", "iaea", "ew", "emp",
];

/** 팩트 추출 단계(`prompts/content-understanding.md`)에서 분류하는 콘텐츠 유형 */
export const ITEM_TYPES = [
  "missile_launch",
  "military_clash",
  "nuclear_wmd",
  "maritime_incident",
  "diplomatic_sanction",
  "cyber_attack",
  "strategic_analysis",
] as const;

// ── 태그 및 어휘 사전 ──────────────────────────────────────────────────────────────────

/** 기사 1차 분류 태그 */
export const CATEGORY_TAGS = [
  "미사일 도발", "군사 훈련/배치", "핵·WMD 동향", "국경/무력 충돌", "무기 수출/이전",
  "해양 도발/충돌", "항행의 자유/봉쇄", "다크쉽/제재 회피", "해저 인프라",
  "정상회담/동맹", "안보리/제재 결의",
  "사이버 공격/APT", "가상자산 탈취", "우주/정찰위성", "전자전/GPS 교란",
  "공급망/광물 통제", "전문가 정세 평가", "기타",
] as const;

/** 세부 토픽 태그 */
export const TOPIC_TAGS = [
  "대북 위협", "우크라이나 전선", "중동 분쟁", "대만해협", "남중국해",
  "한미동맹", "캠프 데이비드", "NATO-IP4", "QUAD", "AUKUS",
  "러·북 군사협력", "하마스·헤즈볼라", "후티 반군", "라자루스",
  "SLOC/해상교통로", "반도체/희토류 공급망", "방위산업",
] as const;

/** 주요 주체 태그 */
export const ENTITY_TAGS = [
  "합참", "국방부", "주한미군", "백악관", "DoD", "방위성", "중국군", "크렘린", "이란/IRGC", "KCNA", "노동신문", "UN", "NATO",
] as const;

/** 유의어 정규화 매핑 */
export const TAG_SYNONYMS: Readonly<Record<string, string>> = {
  "탄도미사일": "미사일 도발", "순항미사일": "미사일 도발", "ICBM": "미사일 도발", "SRBM": "미사일 도발",
  "핵실험": "핵·WMD 동향", "영변": "핵·WMD 동향", "풍계리": "핵·WMD 동향",
  "NLL": "해양 도발/충돌", "물대포": "해양 도발/충돌", "항적차단": "다크쉽/제재 회피", "불법환적": "다크쉽/제재 회피",
  "해킹": "사이버 공격/APT", "랜섬웨어": "사이버 공격/APT", "코인탈취": "가상자산 탈취",
  "정찰위성": "우주/정찰위성", "전파교란": "전자전/GPS 교란",
  "희토류": "공급망/광물 통제", "반도체통제": "공급망/광물 통제",
};

// ── 주요 안보 기구 및 국가 주체 ────────────────────────────────────────────────────────

export const ENTITIES: Record<string, { name: string; displayTag: string | null; aliases: string[]; orgNames?: string[]; otherNames?: string[] }> = {
  dprk: {
    name: "북한(DPRK)",
    displayTag: "북한",
    aliases: ["북한", "조선민주주의인민공화국", "DPRK", "North Korea"],
    orgNames: ["조선중앙통신", "노동신문", "국방성"],
    otherNames: ["KCNA", "조선인민군"],
  },
  "jcs-korea": {
    name: "합동참모본부",
    displayTag: "합참",
    aliases: ["합참", "합동참모본부", "JCS"],
    orgNames: ["합동참모본부", "대한민국 합참"],
  },
  "mod-korea": {
    name: "대한민국 국방부",
    displayTag: "국방부",
    aliases: ["국방부", "MND"],
    orgNames: ["대한민국 국방부"],
  },
  usfk: {
    name: "주한미군",
    displayTag: "주한미군",
    aliases: ["주한미군", "USFK"],
    orgNames: ["주한미군사령부"],
  },
  "us-dod": {
    name: "미 국방부(DoD)",
    displayTag: "미 국방부",
    aliases: ["미 국방부", "DoD", "Pentagon", "펜타곤"],
    orgNames: ["미국 국방부", "U.S. Department of Defense"],
  },
  "japan-mod": {
    name: "일본 방위성",
    displayTag: "방위성",
    aliases: ["방위성", "통합막료감부"],
    orgNames: ["일본 방위성", "통합막료감부"],
  },
  "prc-pla": {
    name: "중국 국방부 / 인민해방군(PLA)",
    displayTag: "중국군",
    aliases: ["중국 국방부", "인민해방군", "PLA", "중국 외교부", "중국 해경"],
    orgNames: ["중국 인민해방군", "동부전구", "북부전구", "중국 외교부", "신화통신", "인민일보"],
    otherNames: ["CCG", "중공군"],
  },
  "russia-mod": {
    name: "러시아 국방부",
    displayTag: "러 국방부",
    aliases: ["러시아 국방부", "크렘린", "러 국방부", "러시아 외무부", "타스통신", "리아노보스티"],
    orgNames: ["러시아 국방부", "크렘린궁", "러시아 연방군", "태평양함대", "ТАСС", "РИА Новости"],
  },
  "iran-irgc": {
    name: "이란 / 이슬람혁명수비대(IRGC)",
    displayTag: "이란/IRGC",
    aliases: ["이란", "혁명수비대", "IRGC", "이란 국방부", "이란 외무부", "테헤란"],
    orgNames: ["이슬람혁명수비대", "이란군", "쿠드스군", "IRNA", "Mehr News"],
    otherNames: ["Islamic Revolutionary Guard Corps"],
  },
  un: {
    name: "유엔(UN)",
    displayTag: "UN",
    aliases: ["UN", "유엔", "안보리"],
    orgNames: ["유엔 안보리", "UN Security Council"],
  },
  nato: {
    name: "NATO",
    displayTag: "NATO",
    aliases: ["NATO", "나토", "북대서양조약기구"],
    orgNames: ["NATO"],
  },
};

/**
 * 팩트 프레임 주체 오인 방지 사전.
 * 다국어(영·중·러·일·페르시아어) 안보 보도에서는 인명·직책(예: Hegseth → 미 국방부 장관, Guterres → 유엔 사무총장)을
 * 한국어 요약 시 기관명과 함께 풀어서 표기하는 경우가 많으므로, 정규식 불일치로 요약문이 삭제되지 않도록 비워 둡니다.
 */
export const IDENTITY_LEXICON: ReadonlyArray<{ id: string; name: string; patterns: RegExp[] }> = [];

export const PUBLISHER_DOMAINS: ReadonlyArray<{ entityId: string; domains: readonly string[] }> = [
  { entityId: "jcs-korea", domains: ["jcs.mil.kr"] },
  { entityId: "mod-korea", domains: ["mnd.go.kr"] },
  { entityId: "us-dod", domains: ["defense.gov"] },
  { entityId: "japan-mod", domains: ["mod.go.jp"] },
  { entityId: "un", domains: ["un.org"] },
  { entityId: "nato", domains: ["nato.int"] },
];

export const IDENTITY_CONTEXT_ALIASES: ReadonlyArray<{ entityId: string; pattern: RegExp }> = [];
