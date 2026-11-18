// 사이트 정체성 및 독자 노출 문구. 산업군 변경 시 가장 먼저 이 파일을 수정합니다.
// 웹 프론트엔드와 백엔드가 모두 읽으며, 수정 후 재빌드(docker compose up --build)하면 반영됩니다.
// 도메인 주소는 여기에 적지 않으며, 배포 시 환경변수 SITE_URL로 설정합니다.

import type { Founder } from "@aihot/contracts/site-config";

/**
 * 일일·주간·월간 리포트 발행 시각(베이징 시간 기준, HH:mm): 일일 보고는 해당 시각 이전 24시간을 수집하며,
 * 주간 보고는 매주 월요일, 월간 보고는 매월 1일에 발행됩니다. 스케줄러, 집계 창, 누락 알림 및 시간 표기 문구 전체가
 * 이 설정을 참조하며(`public/` 파일에서는 {{dailyTime}}, {{weeklyTime}}, {{monthlyTime}} 치환자 사용),
 * 스케줄러가 매 30분마다 확인하므로 정시 또는 30분 단위로 작성합니다.
 */
export const EDITION_TIMES = { daily: "08:00", weekly: "10:00", monthly: "10:30" };

/** “매일 08:00”“매주 월요일 10:00”“매월 1일 10:30”：문장 내 표기용 발간 시간. */
export const EDITION_WHEN = {
  daily: `매일 ${EDITION_TIMES.daily}`,
  weekly: `매주 월요일 ${EDITION_TIMES.weekly}`,
  monthly: `매월 1일 ${EDITION_TIMES.monthly}`,
};

export const SITE = {
  /** 사이트명: 네비게이션, 페이지 제목, 공유 카드, RSS, MCP, 관리자 페이지 공통 사용. */
  name: "글로벌 안보 인텔리전스 허브",
  /**
   * 도메인 대표 주제어: 기본 문구 조합용.
   */
  subject: "국제안보",
  /** 홈 화면 전체 타이틀 (브라우저 탭, 검색엔진 결과). */
  homeTitle: "글로벌-한반도 복합 안보 인텔리전스 허브 — 일일 정세 일보 및 실시간 위협 감시",
  /** 전략 토픽 페이지 (/topics) 타이틀. */
  topicsTitle: "전략 안보 핵심 토픽: 군사 도발, 해양 안보, 동맹 재편, 하이브리드 위협",
  /** 피드백 입력란 안내 문구. */
  feedbackExample: "예: 특정 군사 충돌 사건 검색 시 발생한 문제, 데이터 이상 제보 등...",
  /** 피드백 페이지 헤더 안내문. */
  feedbackLead: "오류 제보, 기능 제안, 개선 의견을 남겨주시면 시스템에 적극 반영합니다.",
  /** 피드백 이메일 입력 안내. */
  feedbackEmailHint: "이메일을 남겨주시면 검토 및 조치 결과를 회신해 드립니다",
  /** 사이트 대표 설명 (검색엔진, 공유 카드, RSS, llms.txt 공통 사용). */
  description: `글로벌 정부·군 당국 및 다국어 OSINT를 24시간 실시간 수집·융합하고, ${EDITION_WHEN.daily} 무결점 정세 일보(SitRep)를 자동 발간합니다.`,
  /** llms.txt 상세 설명 (선택). */
  llmsIntro: null as string | null,
  /** 슬로건 (공유 카드, 포스터 하단). */
  tagline: "글로벌-한반도 실시간 복합 안보 위협 인텔리전스",
  /** 검색엔진 키워드. */
  keywords: ["국제안보", "대북군사동향", "해양안보", "안보정세일보", "위협인텔리전스", "OSINT"] as string[],
  /** 사이트 수집 시작 연도. */
  since: null as string | null,
  /** 기본 로케일. */
  locale: "ko-KR",
  /** 기본 URL. */
  defaultUrl: "http://localhost:3000",
  rootIcons: [] as string[],
  /** MCP 도구명 접두사. */
  mcpPrefix: "security_intel",
  interfaceVersion: "4.0.0",
  contactEmail: null as string | null,
  footerNote: "AIHOT 오픈소스 프레임워크 기반 안보 인텔리전스 시스템",
  icp: null as string | null,
  psb: null as string | null,
  github: null as string | null,
  organization: {
    name: "글로벌 안보 인텔리전스 허브",
    founder: null as Founder | null,
  },
  crawlerName: "SecurityIntelBot/1.0",
} as const;

/** 이용 규정 및 개인정보처리방침. */
export const POLICY = {
  terms: {
    name: "이용 규정",
    description: "본 포털, RSS, 공개 API 및 MCP 서비스 이용 규정 안내.",
    covers: null as string | null,
    notes: null as null | { rss: string; api: string },
    license: null as null | { llms: string; agent: string },
    headers: null as null | Record<string, string>,
  },
  privacy: {
    description: "브라우저 로컬 데이터, 피드백 및 시스템 접근 로그 처리 방침.",
    covers: null as string | null,
  },
  xPostIsFullText: true,
} as const;

export const NAV = {
  hidden: [] as Array<"/hot" | "/topics">,
};

export const ITEM_COPY = {
  reasonLabel: "선별 근거",
  showScore: true,
};

interface ContactCard {
  kind: string;
  title: string;
  note: string;
  alias?: string;
}

export const ABOUT = {
  kicker: "시스템 소개",
  description: `시스템 소개: ${SITE.name} — ${SITE.description}`,
  headline: ["전 세계에서 쏟아지는 수많은 안보 정보 중,", "진짜 핵심 팩트만을 정밀 선별합니다."] as [string, string],
  lead: `${SITE.name}는 글로벌 정부·군 당국 및 OSINT 등 {sources}개 출처를 상시 감시하여 실시간 융합 및 분석을 수행하고, ${EDITION_WHEN.daily} 일일 정세 일보를 발간합니다.`,
  sourcesFallback: "수십",
  steps: {
    collect: "한·미·일 군 당국, 외신, 전문 싱크탱크 및 위성/AIS 센서를 최단 15분 주기로 상시 수집합니다.",
    store: "수집된 다국어 원문을 정밀 적재하고, 동일 사건을 단일 타임라인으로 병합하여 화제성 지수를 산출합니다.",
    select: `군사·안보 관련성을 1차 검증하고, 2회 독립 정밀 채점과 팩트 구조화(사거리·좌표 등)를 거쳐 결론 우선 3줄 요약과 ${ITEM_COPY.reasonLabel}를 작성합니다.`,
    publish: `${EDITION_WHEN.daily} 정세 일보(SitRep) 및 주간/월간 종합 심층 분석 리포트를 자동 발간합니다.`,
  },
  maker: null as null | {
    name: string;
    avatarSourceId?: string | null;
    greeting: string[];
    wechat?: ContactCard;
    feishu?: ContactCard;
  },
  copyright: [`${SITE.name}는 오픈소스 인텔리전스 기반의 융합 요약 및 정세 분석 색인 체계입니다. 원문 정보의 권리는 각 출처 기관에 귀속되며, 데이터 수정이나 정정 요청은`, "피드백 페이지를 통해 접수할 수 있습니다."] as [string, string],
  termsAnchor: null as string | null,
} as const;

export const ADMIN = {
  feedbackNote: null as string | null,
  banNote: null as string | null,
  budgetNote: null as string | null,
};

export const AGENT = {
  search: { scope: "국가, 군사 부대, 무기 체계, 인물 또는 안보 이슈 기준 최근 7일 검색", ask: "해당 지역의 최근 군사 충돌 상황은?" },
};

export const REPORTS = {
  imprint: "GLOBAL SECURITY INTELLIGENCE HUB",
  motto: SITE.subject as string,
  descriptions: {
    daily: `${SITE.name} ${EDITION_WHEN.daily} 발행 일일 안보 상황보고(SitRep)`,
    weekly: "주간 안보 정세 종합 평가 리포트",
    monthly: "월간 글로벌 안보 전략 평가서",
  },
  entry: { measure: "건", noun: "주요 사건" },
  metricUnits: { sourcesCount: "개 정보원", firstPartyEvents: "건 1차 당국 발표", selectedCount: "건 선별 사건", reportsCovered: "호 상황보고" },
  shareUnit: "건의 주요 사건",
  quiet: { title: "금일 주요 군사 도발 및 특이동향 없음", paragraph: "해당 기간 동안 새로운 주요 안보 사건이 포착되지 않았습니다." },
};

export const ALERTS = {
  quietMinutes: 360,
  quietWhileFetchingMinutes: 720,
  usualFlow: null as string | null,
  workerLogs: "worker 컨테이너 로그 확인 (docker compose logs worker)",
};

export const SOURCE_DEFAULTS = {
  siteFulltext: false,
};

export const COMMUNITY_FEEDS: { dev: string[]; hn: string[] } = {
  dev: [],
  hn: [],
};

export const CARDS: Record<string, { kicker: string; title: string; subtitle: string; accent?: "hot" | "amber" }> = {
  site: { kicker: "일일 주요 정세", title: SITE.tagline, subtitle: SITE.description },
  all: { kicker: "전체 동향", title: "모든 정보원의 최신 안보 동향", subtitle: "시간순 안보 피드 및 카테고리/태그 필터링 제공" },
  hot: { kicker: "실시간 핫이슈", title: "최근 48시간 글로벌 핵심 안보 이슈", subtitle: "화제성 지수 및 시계열 트렌드 분석", accent: "hot" },
  daily: { kicker: "일일 상황보고", title: `매일 ${spokenTime(EDITION_TIMES.daily)}, 한눈에 파악하는 상황보고`, subtitle: "전일 24시간 검증된 핵심 안보 브리핑" },
  weekly: { kicker: "주간 정세평가", title: "주간 글로벌 안보 정세 종합 평가", subtitle: "한 주간의 주요 군사 동향 및 전략 평가" },
  monthly: { kicker: "월간 전략평가", title: "월간 글로벌 안보 전략 평가", subtitle: "월간 핵심 안보 지형 및 거시 추세 분석" },
  about: { kicker: "시스템 소개", title: `소개 — ${SITE.name}`, subtitle: SITE.description },
  terms: { kicker: "이용 규정", title: `${SITE.name} 이용 규정`, subtitle: "웹, API, RSS 및 MCP 이용 범위 안내" },
  privacy: { kicker: "개인정보처리방침", title: `${SITE.name} 개인정보처리방침`, subtitle: "시스템 접근 로그 및 피드백 데이터 처리 안내" },
  changelog: { kicker: "업데이트 내역", title: `${SITE.name} 업데이트 내역`, subtitle: "시스템 기능 추가 및 프롬프트 튜닝 기록" },
  feedback: { kicker: "피드백", title: "시스템 개선 및 오류 제보", subtitle: "정보원 추가 요청, 데이터 오류 제보" },
  agent: { kicker: "AI 에이전트 연동", title: `${SITE.name} MCP / API 연동 가이드`, subtitle: "MCP 도구, RSS 피드, REST API 표준 연동 인터페이스" },
};

/** 공개 인터페이스 접근 규약 중 배포 환경에 따라 달라지는 항목: 에이전트 사용 안내 및 llms.txt에 반영됩니다. */
export const ACCESS = {
  /** 동일 IP 기준 분당 대략적 요청 한도(초과 시 429 및 Retry-After 반환, 선택 — 앞단 리버스 프록시에서 제한). null이면 무제한이며 안내에 표시하지 않음. */
  ratePerMinute: null as number | null,
  /** 데이터 자동 동기화 클라이언트가 포함해야 할 권장 User-Agent(선택), JSON API 안내 뒤에 표시됨. */
  userAgent: null as string | null,
};

/** 현재 배포 환경 고유 설정(선택). */
export const DEPLOYMENT = {
  /** 자격 증명 그룹 파일(models.env, collectors.env 등) 기본 디렉터리(저장소 루트 기준 상대 경로). AIHOT_CREDENTIALS_DIR 환경변수가 우선하며, 둘 다 없으면 환경변수만 읽음. */
  credentialsDir: null as string | null,
  /** 자격 증명 그룹별 파일명(자격 증명 디렉터리 내, 선택): 미지정 그룹은 "<그룹명>.env"(예: models.env) 사용. */
  credentialFiles: {} as Partial<Record<string, string>>,
  /** 이 배포에서 추가로 요구하는 자격 증명([그룹, 환경변수명]). 프로덕션 API 시작 시 검사하며 기본값은 없음. */
  requiredSecrets: [] as const,
  /** 프로덕션 API가 수신할 Host 헤더(CDN 오리진 회신용 도메인, 선택). 로컬 개발 시 웹 개발 서버가 API로 프록시할 때도 동일하게 사용됨. */
  originHost: null as string | null,
  /** 리버스 프록시가 미인증 관리자 요청을 로그인으로 리다이렉트할 때 원래 주소를 전달하는 요청 헤더(선택, 로그인 후 복귀용). */
  loginReturnHeader: null as string | null,
  /**
   * 이미지 프록시가 원본 사이트에서 이미지를 가져올 때의 트래픽 상한: 초과 시 미캐시 이미지는 503을 반환하며,
   * 해당 분/일이 지나면 회복되고 일일 한도 소진 시 운영 일보에 기록됨. null이면 상한 없음.
   * 환경변수 IMGPROXY_UPSTREAM_MB_PER_MINUTE, IMGPROXY_UPSTREAM_GB_PER_DAY가 우선함.
   */
  imageUpstreamBudget: null as null | { mbPerMinute: number; gbPerDay: number },
  /**
   * 아웃바운드 프록시(EGRESS_PROXY_URL)를 거치지 않고 서버가 직접 연결해야 하는 도메인 목록(수집 및 이미지 프록시 공용, 선택).
   * 리다이렉트 시 대상 도메인 기준으로 경로를 재판정하며, 직결 시에도 실제 연결 주소 검사는 유지됨.
   */
  directFetchHosts: [] as string[],
  /**
   * 큐레이션 평가(scripts/eval-selection.ts) 인자 미지정 시 기본 골드 데이터셋: 파일 경로(저장소 루트 기준), 샘플 수, 분할, 임계값 스캔 범위.
   * null이면 .data/gold.jsonl 전체 샘플(최대 200건)을 40–90 범위에서 스캔함.
   */
  selectionGold: null as null | { file: string; sample: number; split: string; sweep: [number, number] },
};

/** RSS 피드 설명문 중 사이트별로 달라지는 문구. */
export const FEED_COPY = {
  /** "전체 동향" 피드 설명에서 미심사 자료, 저관련/저점수 항목, 병합된 중복 항목 외에 추가로 제외되는 항목 안내(선택). */
  allLeavesOut: [] as string[],
};

/**
 * 공개 인터페이스(API, RSS, MCP)에서 웹 화면과 다른 카테고리 노출 규칙(선택). 서비스 오픈 후 변경 금지: API 파라미터 및 피드 URL에 key가 포함됨.
 * merge: 다른 카테고리로 합쳐서 발행할 매핑(key는 산업 패키지 카테고리, 값은 병합 대상 카테고리).
 * feedLabels: 분류 RSS 제목에 쓸 이름(산업 패키지의 feedLabel 대체).
 */
export const PUBLIC_CATEGORIES = {
  merge: {},
  feedLabels: {},
} as const;

/** “국제안보 정세 일보” 등의 표현 조합용. */
export function withSubject(noun: string): string {
  return `${SITE.subject} ${noun}`;
}

export function subjectAfter(text: string, noun?: string): string {
  return `${text} ${noun ? withSubject(noun) : SITE.subject}`;
}

/** “8시”“10시 30분”：발간 시간 표기. */
function spokenTime(time: string): string {
  const [hour, minute] = time.split(":").map(Number) as [number, number];
  return `${hour}시${minute ? ` ${minute}분` : ""}`;
}
