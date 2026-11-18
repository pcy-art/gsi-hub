// Site navigation in one place: the desktop sidebar's sections and the phone tab bar's tabs, the engine's
// and the site's modules'.
import type { ReactNode } from "react";
import { NAV, subjectAfter, withSubject } from "@aihot/site";
import { webModules } from "../../site-modules";
import {
  IconBolt, IconBookmark, IconDoc, IconFlame, IconGrid, IconHeart, IconHistory, IconList, IconMessage, IconPlug, IconUser,
} from "../icons";

export interface NavItem {
  to: string;
  label: string;
  icon: (p: { size?: number }) => ReactNode;
  /** Match the path exactly (the home page). */
  end?: boolean;
  /** Shows the unread dot while the changelog has news. */
  changelog?: boolean;
}

const SECTIONS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "콘텐츠",
    items: [
      { to: "/", label: "주요 정세", icon: IconBolt, end: true },
      { to: "/all", label: subjectAfter("전체", "동향"), icon: IconList },
      { to: "/hot", label: "실시간 핫이슈", icon: IconFlame },
      { to: "/daily", label: "일일 상황보고", icon: IconDoc },
      { to: "/topics", label: "전략 테마", icon: IconGrid },
      { to: "/starred", label: "보관함", icon: IconBookmark },
    ],
  },
  {
    title: "더보기",
    items: [
      { to: "/agent", label: "AI 에이전트 연동 (MCP)", icon: IconPlug },
      { to: "/about", label: "시스템 소개", icon: IconHeart },
      { to: "/changelog", label: "업데이트 내역", icon: IconHistory, changelog: true },
      { to: "/feedback", label: "피드백 제보", icon: IconMessage },
    ],
  },
];

/** Whether an engine page is a way in from the navigation (site.ts NAV.hidden); a hidden page still opens. */
export const inNav = (to: string) => !(NAV.hidden as readonly string[]).includes(to);

const UP = {
  "/hot": { name: "실시간 핫이슈", back: "핫이슈", tab: "hot" },
  "/topics": { name: "전략 테마", back: "전체 테마", tab: "me" },
} as const;

/**
 * Where pages under a navigation entry lead back up to: the entry, or 주요 정세 in its place while the site hides
 * it. `name` is for breadcrumbs and desktop back links (실시간 핫이슈), `back` for the phone bar (핫이슈), `tab` the
 * phone tab it sits under, `crumbs` its breadcrumb after the site's home.
 */
export function navUp(entry: keyof typeof UP): { to: string; name: string; back: string; tab: TabKey; crumbs: Array<{ name: string; path: string }> } {
  if (!inNav(entry)) return { to: "/", name: "주요 정세", back: "주요 정세", tab: "featured", crumbs: [] };
  return { to: entry, ...UP[entry], crumbs: [{ name: UP[entry].name, path: entry }] };
}

/**
 * The sidebar: the engine's sections with the modules' between 콘텐츠 and 더보기; a module naming a section
 * that is already there adds to it.
 */
export function sidebar(): Array<{ title: string; items: NavItem[] }> {
  const [content, ...rest] = SECTIONS;
  const more = rest.pop()!;
  const sections = [content!, ...rest].map((s) => ({ ...s, items: s.items.filter((i) => inNav(i.to)) }));
  for (const m of webModules()) {
    if (!m.sidebar) continue;
    const section = sections.find((s) => s.title === m.sidebar!.section);
    if (section) section.items.push(...m.sidebar.items);
    else sections.push({ title: m.sidebar.section, items: [...m.sidebar.items] });
  }
  return [...sections, more];
}

/** A sidebar entry is lit on its pages; 상황보고 also covers weekly and monthly reports. */
export function sidebarIsActive(item: Pick<NavItem, "to" | "end">, pathname: string): boolean {
  if (item.end) return pathname === item.to;
  if (item.to === "/daily") return /^\/(daily|weekly|monthly)(\/|$)/.test(pathname);
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

/**
 * The phone tab bar: 전체 lives beside 주요 정세 as a switch, 핫이슈 and 상황보고 are tabs, and "더보기" at /more holds
 * 북마크, 화면 설정, the tools and the site's own pages. Which tab a page sits under is declared by the page
 * itself (components/shell/screens.ts).
 */
export type TabKey =
  | "featured"
  | "hot"
  | "daily"
  | "me"
  // A module's tab.
  | (string & {});

export interface Tab {
  key: TabKey;
  to: string;
  label: string;
  icon: (p: { size?: number }) => ReactNode;
  changelog?: boolean;
}

const ENGINE_TABS: Tab[] = [
  { key: "featured", to: "/", label: "주요 정세", icon: IconBolt },
  { key: "hot", to: "/hot", label: "핫이슈", icon: IconFlame },
  { key: "daily", to: "/daily", label: "상황보고", icon: IconDoc },
  { key: "me", to: "/more", label: "더보기", icon: IconUser, changelog: true },
];

/** The tab bar: the engine's, the modules' before 더보기. */
export function tabs(): Tab[] {
  return [...ENGINE_TABS.slice(0, -1).filter((t) => inNav(t.to)), ...webModules().flatMap((m) => m.tabs ?? []), ENGINE_TABS.at(-1)!];
}

/**
 * The rail that stands in for the sidebar on narrow desktops (unfolded foldables, tablets upright): the
 * tabs, with 전체 after 주요 정세 since desktop pages have no 주요 정세 | 전체 switch.
 */
export function rail(): Tab[] {
  const all = tabs();
  if (!inNav("/all")) return all;
  const at = all.findIndex((t) => t.key === "featured") + 1;
  return [...all.slice(0, at), { key: "all", to: "/all", label: "전체 동향", icon: IconList }, ...all.slice(at)];
}

/** A rail entry is lit on its pages; 더보기 also on the pages that sit under it on phones. */
export function railIsActive(tab: Tab, pathname: string, screenTab: TabKey | undefined): boolean {
  if (tab.key === "me") return pathname === tab.to || screenTab === "me";
  return sidebarIsActive({ to: tab.to, end: tab.to === "/" }, pathname);
}
