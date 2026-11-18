import type { ReactNode } from "react";

type Tone = "selected" | "accent" | "amber" | "hot" | "ok" | "neutral";

const TONES: Record<Tone, string> = {
  selected: "bg-amber-soft text-amber-ink",
  accent: "bg-accent-soft text-accent",
  amber: "bg-amber-soft text-amber-ink",
  hot: "bg-hot-soft text-hot",
  ok: "bg-ok-soft text-ok",
  neutral: "bg-bg-sunk text-ink-3 border border-line-soft",
};

/** Small label next to a source or title: 주요 정세, statuses and counts. */
export function Badge({ tone = "neutral", dot = false, children, className = "", title }: { tone?: Tone; dot?: boolean; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={`inline-flex h-[18px] shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-medium leading-none ${TONES[tone]} ${className}`}>
      {dot && <span className="size-[5px] rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}

/** The "엄선" mark on a report. */
export function SelectedBadge() {
  return (
    <Badge tone="selected" dot>
      엄선
    </Badge>
  );
}

/** A selected report whose fact is shown by another report (the one holding its selected seat). */
export function SameEventBadge() {
  return <Badge title="동일 사안이 이미 다른 엄선 기사로 수록되었습니다">동일사건</Badge>;
}
