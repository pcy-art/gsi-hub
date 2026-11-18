import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { SITE } from "@aihot/site";
import { Presence } from "../components/ui/Presence";
import { edgeTtl } from "../lib/api.server";
import { pageMeta } from "../lib/seo";
import { KEYS, lastPage, readJson, writeRaw } from "../lib/local-state";
import { IconCheck, IconClose, IconImage } from "../components/icons";
import { RingMark } from "@aihot/site/brand/Logo.tsx";
import { AsideCard, ReadingLayout } from "../components/ui/Page";
import { PhoneBar } from "../components/shell/PhoneBar";
import type { Screen } from "../components/shell/screens";
import { webModules } from "../site-modules";

export const handle: Screen = { tab: "me", name: "피드백 제보" };

export function headers() {
  return edgeTtl(300);
}

export function meta() {
  return pageMeta({ title: "피드백 제보", description: `${SITE.name} 시스템 개선, 기사 정정 및 기능 제안을 전달해주세요.`, path: "/feedback", image: "/og/pages/feedback.png", noindex: true });
}

interface Draft {
  content: string;
  email: string;
  pageUrl: string;
}

function parseDraft(value: unknown): Draft | null {
  if (!value || typeof value !== "object") return null;
  const d = value as Record<string, unknown>;
  return { content: String(d.content ?? ""), email: String(d.email ?? ""), pageUrl: String(d.pageUrl ?? "") };
}

/** Drafts the site's modules keep elsewhere in this browser. */
const otherDrafts = () => webModules().flatMap((m) => (m.feedbackDraft ? [m.feedbackDraft] : []));

function readDraft(): Draft | null {
  let draft = parseDraft(readJson(KEYS.feedbackDraft));
  for (const other of otherDrafts()) draft ??= parseDraft(other.read());
  return draft;
}

/** Saves the draft in this browser, or clears it (null); false when the browser refused. */
function writeDraft(d: Draft | null): boolean {
  const saved = writeRaw(KEYS.feedbackDraft, d && JSON.stringify({ ...d, savedAt: new Date().toISOString() }));
  // Another draft is kept until this one is saved; a submitted draft clears them all.
  if (saved || d === null) for (const other of otherDrafts()) other.clear();
  return saved;
}

const TIPS = ["문제가 발생한 페이지 또는 기사 링크", "발생한 현상 및 당초 수행하려던 작업", "화면 스크린샷 첨부 시 신속한 파악 가능 (민감정보 마스킹 필수)"];

function FeedbackAside() {
  return (
    <>
      <AsideCard title="효과적인 피드백 작성 가이드">
        <ol className="space-y-2.5">
          {TIPS.map((t, i) => (
            <li key={t} className="flex gap-2.5 text-[13px] leading-[1.6] text-ink-3">
              <span className="mono mt-px text-[11px] font-bold text-accent">{String(i + 1).padStart(2, "0")}</span>
              {t}
            </li>
          ))}
        </ol>
      </AsideCard>
      <AsideCard title="정보원 권리자">
        <p className="text-[13px] leading-[1.75] text-ink-3">원문 출처 권리자로서 기사 정정, 노출 중단 또는 표시 방식 변경을 희망하시는 경우 관련 링크와 요청 사항을 기재해 주시기 바랍니다.</p>
      </AsideCard>
    </>
  );
}

/**
 * Some phones report a JPEG as image/jpg, or give no type at all: the file name decides then. The
 * server checks the picture's real bytes either way.
 */
function screenshotType(file: File): string {
  const type = file.type.trim().toLowerCase();
  if (type === "image/jpg") return "image/jpeg";
  if (type && type !== "application/octet-stream") return type;
  if (/\.png$/i.test(file.name)) return "image/png";
  if (/\.jpe?g$/i.test(file.name)) return "image/jpeg";
  if (/\.webp$/i.test(file.name)) return "image/webp";
  return type;
}

const MAX_IMAGE = 5 * 1024 * 1024;
const MAX_TEXT = 2000;

export default function FeedbackPage() {
  const [params] = useSearchParams();
  const [draft, setDraft] = useState<Draft>({ content: "", email: "", pageUrl: params.get("from") ?? "" });
  const [shot, setShot] = useState<{ file: File; url: string } | null>(null);
  const [state, setState] = useState<{ kind: "idle" | "sending" | "done" | "error"; message?: string; id?: number }>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = readDraft();
    // The page the reader was on before coming here (tracked across in-site navigation, "more" skipped);
    // a document the browser opened fresh falls back to its referrer.
    const before = params.get("from") ? null : (lastPage() ?? (document.referrer.startsWith(location.origin) ? document.referrer : null));
    const from = before ? new URL(before, location.origin).href : null;
    if (saved) setDraft((d) => ({ ...saved, pageUrl: d.pageUrl || from || saved.pageUrl }));
    else if (from) setDraft((d) => ({ ...d, pageUrl: from }));
  }, []);
  useEffect(() => {
    const t = setTimeout(() => writeDraft(draft.content || draft.email ? draft : null), 400);
    return () => clearTimeout(t);
  }, [draft]);

  useEffect(() => {
    if (!shot) return;
    return () => URL.revokeObjectURL(shot.url);
  }, [shot]);

  const pick = (picked: File | null | undefined) => {
    if (!picked) return;
    const type = screenshotType(picked);
    if (!/^image\/(png|jpeg|webp)$/.test(type)) return setState({ kind: "error", message: "스크린샷은 PNG, JPEG, WebP 형식만 지원됩니다." });
    const file = type === picked.type ? picked : new File([picked], picked.name, { type });
    if (file.size > MAX_IMAGE) return setState({ kind: "error", message: "이미지 파일 용량은 5MB 이하이어야 합니다." });
    setShot({ file, url: URL.createObjectURL(file) });
    setState({ kind: "idle" });
  };

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
      if (file) pick(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (draft.content.trim().length < 2) return setState({ kind: "error", message: "피드백 내용을 입력해주세요." });
    setState({ kind: "sending" });
    try {
      const form = new FormData();
      form.set("content", draft.content);
      form.set("email", draft.email);
      form.set("pageUrl", draft.pageUrl);
      if (shot) form.set("screenshot", shot.file);
      const res = await fetch("/api/site/feedback", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return setState({ kind: "error", message: body.detail ?? "제출에 실패했습니다. 잠시 후 다시 시도해주세요." });
      writeDraft(null);
      setState({ kind: "done", id: body.id });
      setDraft({ content: "", email: "", pageUrl: "" });
      setShot(null);
    } catch {
      setState({ kind: "error", message: "네트워크 연결이 불안정합니다. 임시 저장본이 보존되었으니 잠시 후 다시 제출해주세요." });
    }
  };

  if (state.kind === "done") {
    return (
      <ReadingLayout>
        <div className="card px-6 py-14 text-center">
          <div className="anim-pop-in mx-auto flex size-14 items-center justify-center rounded-full bg-accent text-accent-contrast">
            <IconCheck size={26} />
          </div>
          <h1 className="mt-6 text-[22px] font-semibold text-ink">제보가 정상 접수되었습니다</h1>
          <p className="mt-2 text-[14px] text-ink-3">
            접수 번호 <span className="mono font-semibold text-ink">#{state.id}</span> (회신 시 해당 번호가 참조됩니다).
          </p>
          <Link to="/" className="mt-8 inline-flex h-10 items-center rounded-full bg-ink px-6 text-[14px] font-medium text-bg transition-opacity hover:opacity-90">
            주요 정세로 돌아가기
          </Link>
        </div>
      </ReadingLayout>
    );
  }

  const field = "w-full rounded-card bg-well text-ink outline-none ring-1 ring-inset ring-line-soft transition-[background-color,box-shadow] placeholder:text-ink-4 hover:ring-line-strong focus:bg-surface focus:shadow-[0_0_0_3px_var(--accent-soft)] focus:ring-accent";
  const label = "mb-2 block text-[13px] font-semibold text-ink";
  const canSend = draft.content.trim().length >= 2 && state.kind !== "sending";
  return (
    <>
    <PhoneBar back={{ to: "/more", label: "더보기" }} title="피드백 제보" />
    <ReadingLayout aside={<FeedbackAside />}>
      <header>
        <h1 data-page-title="" className="text-[24px] font-semibold leading-[1.3] text-ink">의견 및 정정 제보</h1>
        <p className="mt-2 text-[14.5px] leading-relaxed text-ink-3">{SITE.feedbackLead}</p>
      </header>

      <form
        onSubmit={submit}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files[0]);
        }}
        className={`card mt-6 overflow-hidden transition-shadow ${dragging ? "shadow-[0_0_0_3px_var(--accent-soft)] ring-1 ring-accent" : ""}`}
      >
        <div className="space-y-5 p-5 sm:p-6">
          <div>
            <label htmlFor="fb-content" className={label}>
              전달하실 의견
            </label>
            <div className="relative">
              <textarea
                id="fb-content"
                required
                rows={9}
                maxLength={MAX_TEXT}
                value={draft.content}
                onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                placeholder={SITE.feedbackExample}
                className={`${field} block resize-y px-4 pb-8 pt-3.5 text-[16px] leading-relaxed sm:text-[14.5px]`}
              />
              <span className="mono pointer-events-none absolute bottom-3 right-4 text-[11px] text-ink-4">
                {draft.content.length} / {MAX_TEXT}
              </span>
            </div>
          </div>

          <div>
            <label htmlFor="fb-email" className={label}>
              이메일 <span className="font-normal text-ink-4">（선택）</span>
            </label>
            <input id="fb-email" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder={SITE.feedbackEmailHint} className={`${field} h-11 px-4 text-[16px] sm:text-[14.5px]`} />
          </div>

          <div>
            <span className={label}>
              스크린샷 <span className="font-normal text-ink-4">（선택）</span>
            </span>
            {shot ? (
              <div className="flex items-center gap-4 well rounded-card p-3">
                <img src={shot.url} alt="스크린샷 미리보기" className="h-16 w-24 shrink-0 rounded-control border border-line bg-surface object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-ink-2">{shot.file.name}</div>
                  <div className="mono mt-0.5 text-[11.5px] text-ink-4">{(shot.file.size / 1024 / 1024).toFixed(2)} MB</div>
                </div>
                <button type="button" aria-label="스크린샷 삭제" onClick={() => setShot(null)} className="grid size-8 shrink-0 place-items-center rounded-full text-ink-4 transition-colors hover:bg-surface hover:text-ink">
                  <IconClose size={15} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={`group flex w-full items-center gap-3.5 rounded-card border border-dashed px-4 py-3.5 text-left transition-colors ${dragging ? "border-accent bg-accent-softer" : "border-line-strong hover:border-ink-4 hover:bg-bg-sunk/60"}`}
              >
                <span className="grid size-10 shrink-0 place-items-center well rounded-tile text-ink-3 transition-colors group-hover:text-accent">
                  <IconImage size={19} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold text-ink-2">스크린샷 첨부</span>
                  <span className="mt-0.5 block text-[12px] leading-relaxed text-ink-4">붙여넣기 또는 드래그 앤 드롭 지원 · 민감정보는 반드시 가린 후 업로드 (PNG/JPEG/WebP, 최대 5MB)</span>
                </span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
          </div>

          <Presence show={state.kind === "error"} enter="anim-notice-in" exit="anim-fade-out" duration={160}>
            <p role="alert" className="rounded-tile bg-hot-soft px-3.5 py-2.5 text-[13px] text-hot">
              {state.kind === "error" ? state.message : ""}
            </p>
          </Presence>
        </div>

        <div className="flex flex-col-reverse gap-4 border-t border-line-soft bg-bg-sunk/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:bg-bg-muted/30">
          <p className="text-[12px] leading-relaxed text-ink-4 sm:max-w-[400px]">
            비밀번호, 개인 식별 정보 등 민감정보는 입력하지 마십시오. 제출 시 피드백 내용, 이메일, 접속 정보 및 스크린샷은{" "}
            <Link viewTransition to="/privacy" className="text-accent hover:underline">
              개인정보처리방침
            </Link>
            에 따라 처리됩니다.
          </p>
          <button
            type="submit"
            disabled={!canSend}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 self-start rounded-full bg-accent px-6 text-[14px] font-medium text-accent-contrast transition-[background-color,opacity] hover:bg-accent-ink disabled:bg-line-strong disabled:text-ink-4 sm:self-auto"
          >
            {state.kind === "sending" && <RingMark className="size-4" spinning />}
            피드백 제출
          </button>
        </div>
      </form>
    </ReadingLayout>
    </>
  );
}
