import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Await, isRouteErrorResponse, Link, useAsyncError, useLoaderData, useNavigate, useRevalidator, type ClientLoaderFunctionArgs } from "react-router";
import type { Route } from "./+types/item";
import type { FeedItemSummary, SiteItemDetail, StoryFollowupsResponse } from "@aihot/contracts/site";
import { ITEM_COPY, SITE } from "@aihot/site";
import { cachedPage, loadOr404 } from "../lib/api.server";
import { loadFollowups } from "../features/item/followups.server";
import { pageReuse } from "../lib/page-reuse";
import { articleLd, breadcrumbLd, pageMeta, siteUrl, titled } from "../lib/seo";
import { fullDateTime, relativeTime } from "../lib/format";
import { markRead } from "../lib/local-state";
import { copyText } from "../lib/clipboard";
import { SameEventBadge, SelectedBadge } from "../components/ui/Badge";
import { ScoreLabel, shownScore } from "../components/ui/Score";
import { PillTabs } from "../components/ui/Tabs";
import { ArticleLayout, RailSection, useContainedScroll } from "../components/ui/Page";
import { Menu, MenuItem } from "../components/ui/Menu";
import { StarButton } from "../features/feed/parts";
import { GroupButton, GroupSources } from "../features/feed/ReadingGroup";
import { StoryFollowups } from "../features/item/StoryFollowups";
import { MediaGallery } from "../features/item/MediaGallery";
import { QuotedPost } from "../features/item/QuotedPost";
import { ArticleBody } from "../features/item/ArticleBody";
import { ActionsSheet, ReaderToolbar, type ActionRow } from "../features/item/ReaderTools";
import { OutlineSheet } from "../components/ui/OutlineSheet";
import { scrollToAnchor } from "../lib/motion";
import { takePreview } from "../features/item/preview";
import { IconArrowLeft, IconCopy, IconDownload, IconExternal, IconImage, IconList, IconMenu, IconMore, IconShare } from "../components/icons";
import { BarButton, PhoneBar } from "../components/shell/PhoneBar";
import { isPhone, type Screen } from "../components/shell/screens";

export const handle: Screen = { home: "featured", toolbar: true };
export { pageHeaders as headers } from "../lib/api.server";

const PosterSheet = lazy(() => import("../features/item/PosterSheet"));

export async function loader({ params, request }: Route.LoaderArgs) {
  const item = await loadOr404<SiteItemDetail>(`/api/site/items/${encodeURIComponent(params.id)}`, { signal: request.signal });
  return cachedPage(600, { item, followups: await loadFollowups(item, request.signal) });
}

type Loaded = { item: SiteItemDetail; followups: StoryFollowupsResponse | null };
type Preview = { item: null; preview: FeedItemSummary; detail: Promise<Loaded> };

/**
 * Phones: an article tapped in a list opens at once with what the card showed (title, summary, reason),
 * while its full text loads. Opened any other way, or on desktop, the page waits for its data as usual.
 */
const reuse = pageReuse<typeof loader>();
export const { shouldRevalidate } = reuse;
export async function clientLoader(args: ClientLoaderFunctionArgs) {
  const { params } = args;
  const preview = isPhone() && params.id ? takePreview(params.id) : null;
  if (!preview) return reuse.clientLoader(args);
  return { item: null, preview, detail: reuse.clientLoader(args) } satisfies Preview;
}
clientLoader.hydrate = true as const;

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: titled("내용이 존재하지 않습니다") }, { name: "robots", content: "noindex" }];
  const { item } = loaderData;
  if (!item) return [{ title: titled(loaderData.preview.title) }];
  return pageMeta({
    title: item.title,
    description: item.summary ?? undefined,
    path: `/items/${item.id}`,
    image: `/og/items/${item.id}.png`,
    type: "article",
    noindex: !item.indexable,
    jsonLd: [
      articleLd({ path: `/items/${item.id}`, headline: item.title, description: item.summary, publishedAt: item.publishedAt, image: `/og/items/${item.id}.png`, basedOn: item.links.original }),
      breadcrumbLd([
        { name: SITE.name, path: "/" },
        { name: item.selected ? "엄선" : "전체 동향", path: item.selected ? "/" : "/all" },
        { name: item.title, path: `/items/${item.id}` },
      ]),
    ],
  });
}

/** A 2px accent line across the top that follows long bodies. */
function ReadingProgress() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (ref.current) ref.current.style.transform = `scaleX(${max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0})`;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);
  return <div ref={ref} aria-hidden="true" className="fixed inset-x-0 top-0 z-50 h-[2px] origin-left scale-x-0 bg-accent transition-transform duration-150 ease-out" />;
}

/** An outline link: a plain click scrolls in place (above); modifier clicks keep the browser's behaviour. */
function jumpTo(e: React.MouseEvent, id: string) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  if (!document.getElementById(id)) return;
  e.preventDefault();
  scrollToAnchor(id);
}

/**
 * The outline takes what is left of its rail and scrolls within it; with room for fewer than six entries it
 * keeps six (an entry is its 12.5px line at leading-snug plus 8px of padding), and the rail scrolls instead.
 */
function ArticleOutline({ outline }: { outline: SiteItemDetail["outline"] }) {
  const [nav, overscroll] = useContainedScroll<HTMLElement>();
  const containKeys = (e: React.KeyboardEvent<HTMLElement>) => {
    const nav = e.currentTarget;
    if (nav.scrollHeight <= nav.clientHeight || e.altKey || e.ctrlKey || e.metaKey) return;
    const up = ["ArrowUp", "PageUp", "Home"].includes(e.key) || (e.key === " " && e.shiftKey);
    const down = ["ArrowDown", "PageDown", "End"].includes(e.key) || (e.key === " " && !e.shiftKey);
    // WebKit can chain keyboard scrolling even with overscroll-behavior: contain.
    if ((up && nav.scrollTop <= 0) || (down && nav.scrollTop + nav.clientHeight >= nav.scrollHeight - 1)) e.preventDefault();
  };
  return (
    <RailSection title="목차" shrink>
      <nav ref={nav} aria-label="목차" tabIndex={overscroll ? 0 : undefined} onKeyDown={containKeys} className={`scrollbar-thin min-h-[calc(6*(12.5px*1.375+8px))] overflow-y-auto ${overscroll}`}>
        <ol className="space-y-0.5 border-l border-line">
          {outline.map((o) => (
            <li key={o.id}>
              <a href={`#${o.id}`} onClick={(e) => jumpTo(e, o.id)} className={`-ml-px block border-l border-transparent py-1 text-[12.5px] leading-snug text-ink-3 transition-colors hover:border-accent hover:text-ink focus-visible:outline-offset-[-2px] ${o.level > 2 ? "pl-5" : "pl-3"}`}>
                {o.text}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </RailSection>
  );
}

/** WeChat's in-app browser cannot save downloads: there the Markdown is copied instead. */
function inWeChat(): boolean {
  return typeof navigator !== "undefined" && /MicroMessenger/i.test(navigator.userAgent);
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function shareOrCopy(item: Pick<SiteItemDetail, "id" | "title">): Promise<"shared" | "copied" | null> {
  const url = `${siteUrl()}/items/${item.id}`;
  try {
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      await navigator.share({ title: item.title, url });
      return "shared";
    }
    await copyText(`${item.title}\n${url}`);
    return "copied";
  } catch {
    return null;
  }
}

/** A short line over the page's foot, gone after a moment. */
function useToast(): [string | null, (text: string) => void] {
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(t);
  }, [toast]);
  return [toast, setToast];
}

function Toast({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div role="status" className="fixed bottom-[calc(80px+env(safe-area-inset-bottom))] left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-[13px] text-bg shadow-[var(--shadow-pop)] lg:bottom-8">
      {text}
    </div>
  );
}

export default function ItemPage() {
  const data = useLoaderData<typeof clientLoader>() as Loaded | Preview;
  if (data.item) return <ItemView key={`${data.item.id}:${data.item.bodyLanguage}`} item={data.item} followups={data.followups} />;
  return (
    <Suspense fallback={<ItemPreview preview={data.preview} />}>
      <Await resolve={data.detail} errorElement={<ItemGone />}>
        {(loaded) => <ItemView key={`${loaded.item.id}:${loaded.item.bodyLanguage}`} item={loaded.item} followups={loaded.followups} />}
      </Await>
    </Suspense>
  );
}

/** Phones, while the article loads: what the card showed, in the article's own places. */
function ItemPreview({ preview }: { preview: FeedItemSummary }) {
  const [toast, setToast] = useToast();
  const isX = preview.channel === "x" && !!preview.x;
  // Without a reliable date from the original, the card's time is when it was collected, and says so.
  const shownAt = preview.publishedAt ?? preview.timelineAt;
  return (
    <div className="mx-auto max-w-[var(--page-max-reading)] pb-8">
      <PhoneBar back={{ to: preview.selected ? "/" : "/all", label: preview.selected ? "엄선" : "전체" }} title={isX ? preview.x!.authorName : preview.title} />
      <article className="pb-6 pt-3" aria-busy="true">
        <div className="mb-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-ink-3">
          <span className="font-semibold text-ink-2">{isX ? preview.x!.authorName : preview.source.name}</span>
          {isX && <span>· @{preview.x!.handle} · X</span>}
          <span>·</span>
          {!preview.publishedAt && <span>수집: </span>}
          <time dateTime={shownAt} className="mono">{fullDateTime(shownAt)}</time>
          {preview.selected && <span className="ml-1">{preview.sameEvent ? <SameEventBadge /> : <SelectedBadge />}</span>}
          {shownScore(preview.score) !== null && (
            <span className="ml-1">
              <ScoreLabel score={preview.score} />
            </span>
          )}
        </div>
        {!isX && <h1 data-page-title="" className="text-[26px] font-bold leading-[1.38] tracking-[-0.01em] text-ink">{preview.title}</h1>}
        {preview.summary && (
          <section className={isX ? "mt-4" : "mt-7"}>
            <div className="mb-2 text-[12px] font-semibold text-accent">{isX && preview.summary.replace(/\s+/g, " ").trim() === preview.title ? "원문" : "AI 핵심 요약"}</div>
            <p className="text-[18px] leading-[1.7] text-ink">{preview.summary}</p>
          </section>
        )}
        {preview.reason && (
          <section className="mt-6 border-t border-line pt-4">
            <div className="mb-1 text-[12px] font-semibold text-ink-3">{ITEM_COPY.reasonLabel}</div>
            <p className="text-[15px] leading-[1.75] text-ink-2">{preview.reason}</p>
          </section>
        )}
        <div className="mt-9 space-y-3 border-t border-line pt-6" aria-hidden="true">
          {[92, 100, 96, 88, 98, 64].map((w, i) => (
            <div key={i} className="skeleton h-4" style={{ width: `${w}%` }} />
          ))}
        </div>
      </article>
      <ReaderToolbar
        item={preview}
        originalLabel={isX ? "원문 보기(X)" : "원문 보기"}
        onShare={async () => {
          if ((await shareOrCopy(preview)) === "copied") setToast("링크가 복사되었습니다");
        }}
      />
      <Toast text={toast} />
    </div>
  );
}

/** The article could not load after the tap: gone (withdrawn, merged away), or the service is busy. */
function ItemGone() {
  const error = useAsyncError();
  const revalidator = useRevalidator();
  const gone = isRouteErrorResponse(error) && error.status === 404;
  return (
    <div className="mx-auto max-w-sm pb-8">
      <PhoneBar back={{ to: "/", label: "엄선" }} />
      <div className="py-24 text-center">
        <div className="text-[20px] font-bold text-ink">{gone ? "내용을 찾을 수 없습니다" : "일시적으로 불러올 수 없습니다"}</div>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-3">{gone ? "잘못된 링크이거나 이미 삭제 또는 비공개 처리된 콘텐츠입니다." : "서버가 혼잡하오니 잠시 후 다시 시도해 주세요."}</p>
        {!gone && (
          <button type="button" onClick={() => void revalidator.revalidate()} className="mt-6 h-11 rounded-full border border-line-strong bg-surface px-5 text-[14px] font-medium text-ink-2 active:bg-bg-sunk">
            다시 시도
          </button>
        )}
      </div>
    </div>
  );
}

function ItemView({ item, followups }: Loaded) {
  const navigate = useNavigate();
  const hasTranslation = item.hasTranslation;
  const lang = item.bodyLanguage;
  const [posterRequested, setPosterRequested] = useState(false);
  const [posterOpen, setPosterOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [toast, setToast] = useToast();
  useEffect(() => { markRead(item.id); }, [item.id]);
  const closePoster = useCallback(() => setPosterOpen(false), []);
  const openPoster = () => {
    setPosterRequested(true);
    setPosterOpen(true);
  };
  const share = async () => {
    const r = await shareOrCopy(item);
    if (r === "copied") setToast("링크가 복사되었습니다");
  };
  const copyLink = async () => {
    try {
      await copyText(`${siteUrl()}/items/${item.id}`);
      setToast("링크가 복사되었습니다");
    } catch {
      // clipboard unavailable
    }
  };
  const copyMarkdown = async () => {
    try {
      const res = await fetch(`/items/${item.id}/markdown`);
      if (!res.ok) throw new Error(String(res.status));
      await copyText(await res.text());
      setToast("Markdown이 복사되었습니다");
    } catch {
      setToast("복사 실패: 브라우저에서 직접 내보내기를 이용해 주세요");
    }
  };

  const bodyHtml = lang === "zh" ? (item.body?.zh ?? item.body?.original) : (item.body?.original ?? item.body?.zh);
  const bodyLabel = !item.body ? null : lang === "zh" && item.body.zhKind === "translation" ? "본문 · AI 번역" : lang === "original" ? "본문 · 원문" : "본문";
  const isX = item.channel === "x" && !!item.x;
  // Without a reliable date from the original, the time shown is when it was collected, labelled as such.
  const shownAt = item.publishedAt ?? item.discoveredAt;
  const timeLabel = item.publishedAt ? "발행 일시" : "수집 일시";
  const summaryOnly = item.readingMode === "summary-only";
  const showOutline = item.outline.length >= 3;
  const originalLabel = isX ? "X(트위터)에서 원문 보기" : "원문 열기";

  const related = item.relatedStories.filter((s) => s.publicId !== item.story?.publicId);

  const back = () => {
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate(item.selected ? "/" : "/all");
  };
  // In the left rail (a flex column) it keeps its own height and width.
  const backButton = (
    <button type="button" onClick={back} className="-ml-1.5 inline-flex h-8 shrink-0 items-center gap-1.5 self-start rounded-full px-1.5 text-[13px] text-ink-3 transition-colors hover:text-ink touch:h-11">
      <IconArrowLeft size={16} /> 뒤로
    </button>
  );
  const moreMenu = (
    <Menu label="추가 기능" trigger={<IconMenu size={17} />}>
      {(close) => (
        <>
          <MenuItem icon={<IconShare size={15} />} onSelect={() => { close(); void share(); }}>링크 공유</MenuItem>
          <MenuItem icon={<IconImage size={15} />} onSelect={() => { close(); openPoster(); }}>공유 카드 생성</MenuItem>
          <MenuItem icon={<IconCopy size={15} />} onSelect={() => { close(); void copyLink(); }}>링크 복사</MenuItem>
          {item.markdownAvailable &&
            (inWeChat() ? (
              <MenuItem icon={<IconDownload size={15} />} onSelect={() => { close(); void copyMarkdown(); }}>Markdown 복사</MenuItem>
            ) : (
              <MenuItem icon={<IconDownload size={15} />} href={`/items/${item.id}/markdown`} download onSelect={close}>
                Markdown 내보내기
              </MenuItem>
            ))}
        </>
      )}
    </Menu>
  );
  // Phones: the same actions as a sheet from the bar (공유 and 원문 are on the toolbar).
  const phoneActions: ActionRow[] = [
    { key: "poster", label: "공유 카드 생성", icon: <IconImage size={20} />, onSelect: openPoster },
    { key: "copy", label: "링크 복사", icon: <IconCopy size={20} />, onSelect: () => void copyLink() },
    ...(item.markdownAvailable
      ? [inWeChat()
        ? { key: "markdown", label: "Markdown 복사", icon: <IconDownload size={20} />, onSelect: () => void copyMarkdown() }
        : { key: "markdown", label: "Markdown 내보내기", icon: <IconDownload size={20} />, href: `/items/${item.id}/markdown`, download: true }]
      : []),
  ];
  const originalLink = (className: string) => (
    <a
      href={item.links.original}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-line-strong bg-surface px-3.5 text-[12.5px] font-medium text-ink-2 transition-colors hover:border-ink-4 hover:text-ink ${className}`}
    >
      {originalLabel} <IconExternal size={13} />
    </a>
  );
  // Desktop actions head the right rail, one row as tall as back at the head of the left one.
  const actions = (
    <div className="flex items-center gap-1">
      {originalLink("flex-1 touch:h-11")}
      <StarButton item={item} className="size-8 touch:size-11" />
      {moreMenu}
    </div>
  );
  const verdict = (item.selected || shownScore(item.score) !== null) && (
    <div className="flex items-center gap-2">
      {item.selected && (item.sameEvent ? <SameEventBadge /> : <SelectedBadge />)}
      <ScoreLabel score={item.score} />
    </div>
  );

  // Rails: the piece's facts on the left (wide screens), the editor's notes on the right, the outline
  // under the facts (or under the notes when only the right rail shows).
  const facts = (
    <RailSection title="출처 정보">
      <div className="text-[14px] font-semibold leading-snug text-ink">{isX ? item.x!.authorName : item.source.name}</div>
      <div className="mt-1 text-[12.5px] leading-relaxed text-ink-3">
        {isX ? `@${item.x!.handle} · X` : item.author ?? hostOf(item.links.original)}
      </div>
      <div className="mt-3 text-[12px] text-ink-4">{timeLabel}</div>
      <time dateTime={shownAt} className="mono mt-0.5 block text-[12.5px] text-ink-2">
        {fullDateTime(shownAt)}
      </time>
      <div className="mt-0.5 text-[12px] text-ink-4" suppressHydrationWarning>
        {relativeTime(shownAt)}
      </div>
    </RailSection>
  );
  const outline = showOutline && <ArticleOutline outline={item.outline} />;
  const notes = (
    <>
      {item.reason && !summaryOnly ? (
        <RailSection title={ITEM_COPY.reasonLabel}>
          {verdict && <div className="mb-3">{verdict}</div>}
          <p className="text-[13.5px] leading-[1.8] text-ink-2">{item.reason}</p>
        </RailSection>
      ) : (
        verdict && <RailSection title={shownScore(item.score) !== null ? "AI 채점 점수" : undefined}>{verdict}</RailSection>
      )}
      {item.topics.length > 0 && (
        <RailSection title="관련 토픽">
          <div className="flex flex-wrap gap-1.5">
            {item.topics.map((t) => (
              <Link viewTransition key={t.slug} to={`/topics/${t.slug}`} className="chip">
                {t.name}
              </Link>
            ))}
          </div>
        </RailSection>
      )}
      {item.tags.length > 0 && (
        <RailSection title="태그">
          <div className="flex flex-wrap gap-1.5">
            {item.tags.slice(0, 8).map((t) => (
              <Link key={t} to={`/all?tag=${encodeURIComponent(t)}`} className="chip">
                #{t}
              </Link>
            ))}
          </div>
        </RailSection>
      )}
    </>
  );

  return (
    <div className="mx-auto max-w-[var(--page-max-reading)] pb-8">
      {item.body && <ReadingProgress />}

      {/* Phones: back to where the reader came from, the title once it has scrolled away, more actions. */}
      <PhoneBar
        back={{ to: item.selected ? "/" : "/all", label: item.selected ? "엄선" : "전체" }}
        title={isX ? item.x!.authorName : item.title}
        actions={
          <BarButton label="추가 기능" onClick={() => setActionsOpen(true)}>
            <IconMore size={22} />
          </BarButton>
        }
      />

      {/* The text on the page in one column; back and the facts in the left rail, actions and notes in the right. */}
      <ArticleLayout
        left={
          <>
            {backButton}
            {facts}
            {outline}
          </>
        }
        right={
          <>
            {actions}
            {notes}
            <div className="flex min-h-0 flex-col space-y-8 2xl:hidden">{outline}</div>
          </>
        }
      >
        {/* Between lg and 2xl the left rail is hidden: back stays at the top while reading, as on the original site.
            Below side the right rail is hidden too, and its actions and the outline join back. */}
        <div className="sticky top-0 z-20 -mx-2 hidden items-center justify-between gap-3 bg-bg/95 px-2 py-1.5 backdrop-blur lg:flex 2xl:hidden">
          {backButton}
          <div className="flex items-center gap-1 side:hidden">
            {showOutline && (
              <button type="button" onClick={() => setOutlineOpen(true)} className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium text-ink-3 transition-colors hover:bg-bg-sunk hover:text-ink touch:h-11">
                <IconList size={15} /> 목차
              </button>
            )}
            {originalLink("touch:h-11")}
            <StarButton item={item} className="size-8 touch:size-11" />
            {moreMenu}
          </div>
        </div>
        <article className="pb-6 pt-3 lg:pt-2 2xl:pt-1">
          <div className={`flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-ink-3 2xl:hidden ${isX ? "" : "mb-3"}`}>
            <span className="font-semibold text-ink-2">{isX ? item.x!.authorName : item.source.name}</span>
            {isX && <span>· @{item.x!.handle} · X</span>}
            {item.author && !isX && <span>· {item.author}</span>}
            <span>·</span>
            {!item.publishedAt && <span>수집: </span>}
            <time dateTime={shownAt} className="mono">{fullDateTime(shownAt)}</time>
            <span suppressHydrationWarning>· {relativeTime(shownAt)}</span>
            {item.selected && (
              <span className="ml-1 side:hidden">
                {item.sameEvent ? <SameEventBadge /> : <SelectedBadge />}
              </span>
            )}
            {shownScore(item.score) !== null && (
              <span className="ml-1 side:hidden">
                <ScoreLabel score={item.score} />
              </span>
            )}
          </div>
          {!isX && <h1 data-page-title="" className="text-[26px] font-bold leading-[1.38] tracking-[-0.01em] text-ink lg:text-[32px] lg:leading-[1.34] xl:text-[36px] xl:leading-[1.3]">{item.title}</h1>}
          {!isX && item.originalTitle && <p className="mt-2.5 text-[14px] leading-relaxed text-ink-4">{item.originalTitle}</p>}

          {item.summary && (!isX || item.summary.replace(/\s+/g, " ").trim() !== item.title) && (
            <section className={isX ? "mt-4" : "mt-7 xl:mt-8"}>
              <div className="mb-2 text-[12px] font-semibold text-accent">{summaryOnly ? "요약" : "AI 핵심 요약"}</div>
              <p className="text-[18px] leading-[1.7] text-ink xl:text-[20px] xl:leading-[1.7]">{item.summary}</p>
            </section>
          )}

          {item.reason && !summaryOnly && (
            <section className="mt-6 border-t border-line pt-4 side:hidden">
              <div className="mb-1 text-[12px] font-semibold text-ink-3">{ITEM_COPY.reasonLabel}</div>
              <p className="text-[15px] leading-[1.75] text-ink-2">{item.reason}</p>
            </section>
          )}

          {item.sameEvent && (
            <p className="mt-5 text-[13px] leading-relaxed text-ink-4">
              동일 사건의 엄선 수록 기사:{" "}
              <Link viewTransition to={`/items/${item.sameEvent.id}`} className="text-ink-3 transition-colors hover:text-accent">
                《{item.sameEvent.title}》
              </Link>
            </p>
          )}

          {item.group && item.group.reportCount > 1 && (
            <div className="mt-5">
              <div className="hidden lg:block"><GroupSources group={item.group} parentId={item.id} /></div>
              <GroupButton group={item.group} parentId={item.id} />
            </div>
          )}

          {summaryOnly && <p className="mt-7 rounded-control bg-bg-sunk px-4 py-3 text-[13.5px] leading-relaxed text-ink-3">정보원의 요청에 따라 요약 및 원문 링크만 제공됩니다. 전문은 원문을 참조해 주시기 바랍니다.</p>}

          {item.body && bodyHtml && (
            <section className="mt-9 border-t border-line pt-4 xl:mt-10">
              <div className="mb-6 flex items-center justify-between gap-3">
                <span className="text-[12px] text-ink-4">{bodyLabel}</span>
                {hasTranslation && (
                  <PillTabs
                    size="xs"
                    layoutId="item-body-lang"
                    label="본문 언어"
                    active={lang}
                    items={[
                      { key: "zh", label: "한국어", prefetchOnPress: true, replace: true, to: `/items/${item.id}` },
                      { key: "original", label: "원문", prefetchOnPress: true, replace: true, to: `/items/${item.id}/original` },
                    ]}
                  />
                )}
              </div>
              {hasTranslation && lang === "zh" && !item.body.complete && (
                <p className="mb-5 rounded-control bg-bg-sunk px-3 py-2 text-[13px] text-ink-3">번역이 완전히 완료되지 않았습니다. 전체 내용은 원문으로 확인해 주십시오.</p>
              )}
              <ArticleBody html={bodyHtml} />
            </section>
          )}

          {isX && item.x!.media.length > 0 && <MediaGallery media={item.x!.media} postUrl={item.links.original} />}
          {isX && item.x!.quoted?.text && <QuotedPost quoted={item.x!.quoted} original={lang === "original"} />}

          <p className="mt-8 text-[13px] text-ink-4">
            출처:{" "}
            <a href={item.links.original} target="_blank" rel="noopener noreferrer" className="text-ink-3 hover:text-accent">
              {isX ? item.x!.authorName : item.source.name}
            </a>
            <span> · {hostOf(item.links.original)}</span>
          </p>

          {(item.topics.length > 0 || item.tags.length > 0) && (
            <div className="mt-4 flex flex-wrap gap-1.5 side:hidden">
              {item.topics.map((t) => (
                <Link viewTransition key={t.slug} to={`/topics/${t.slug}`} className="chip">
                  {t.name}
                </Link>
              ))}
              {item.tags.slice(0, 6).map((t) => (
                <Link key={t} to={`/all?tag=${encodeURIComponent(t)}`} className="chip">
                  #{t}
                </Link>
              ))}
            </div>
          )}

          {item.story && <StoryFollowups followups={followups} story={item.story} currentId={item.id} />}

          {related.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-2 text-[14px] font-semibold text-ink">관련 사건</h2>
              <ul className="divide-y divide-line-soft">
                {related.map((s) => (
                  <li key={s.publicId}>
                    <Link viewTransition to={`/story/${s.publicId}`} className="block py-2.5 text-[14px] text-ink-2 hover:text-accent">
                      {s.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>
      </ArticleLayout>

      <ReaderToolbar
        item={item}
        originalUrl={item.links.original}
        originalLabel={isX ? "원문 보기(X)" : "원문 보기"}
        onOutline={showOutline ? () => setOutlineOpen(true) : undefined}
        onShare={() => void share()}
      />
      {showOutline && <OutlineSheet open={outlineOpen} onClose={() => setOutlineOpen(false)} outline={item.outline} />}
      <ActionsSheet open={actionsOpen} onClose={() => setActionsOpen(false)} rows={phoneActions} />

      {posterRequested && (
        <Suspense fallback={null}>
          <PosterSheet id={item.id} title={item.title} open={posterOpen} onClose={closePoster} />
        </Suspense>
      )}
      <Toast text={toast} />
    </div>
  );
}
