// Admin sign-in: the admin password (ADMIN_PASSWORD), and Feishu when it is configured. The form posts
// straight to the API, which sets the session cookie and sends the browser on.
import { redirect, useLoaderData } from "react-router";
import type { Route } from "./+types/admin-login";
import { SITE } from "@aihot/site";
import { safeReturn, SIGN_IN_HOME } from "@aihot/contracts/admin";
import { apiGet } from "../lib/api.server";
import { adminSignedIn } from "../lib/admin.server";
import { Wordmark } from "@aihot/site/brand/Logo.tsx";
import { buttonClass } from "../components/ui/Controls";

const ERRORS: Record<string, string> = {
  wrong: "비밀번호가 올바르지 않습니다. 다시 입력해 주십시오.",
  unset: "관리자 비밀번호가 설정되지 않았습니다: .env 파일에 ADMIN_PASSWORD(최소 12자 이상)를 지정하고 서비스를 재시작하십시오.",
  "too-many": "로그인 시도 횟수를 초과했습니다. 15분 후 다시 시도하십시오.",
};

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const target = safeReturn(url.searchParams.get("return") ?? SIGN_IN_HOME);
  // Already signed in: the sign-in page has nothing to offer; go where the visitor was headed.
  if (await adminSignedIn(request).catch(() => false)) throw redirect(target);
  const options = await apiGet<{ password: boolean; feishu: boolean }>("/api/auth/options", { signal: request.signal }).catch(() => ({ password: true, feishu: false }));
  return { returnTo: target, error: url.searchParams.get("error"), ...options };
}

export const meta: Route.MetaFunction = () => [{ title: `로그인 · ${SITE.name} 관리자` }, { name: "robots", content: "noindex, nofollow" }];

export const headers: Route.HeadersFunction = () => ({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" });

export default function AdminLogin() {
  const { returnTo, error, password, feishu } = useLoaderData<typeof loader>();
  const message = error ? (ERRORS[error] ?? ERRORS.wrong) : !password ? ERRORS.unset : null;
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4">
      <div className="w-full max-w-[360px]">
        <div className="flex items-center justify-center gap-2">
          <Wordmark size={28} className="text-ink" />
          <span className="text-[15px] font-semibold text-ink-3">관리자</span>
        </div>
        <form method="post" action="/api/auth/password" className="card mt-8 p-6">
          <input type="hidden" name="return" value={returnTo} />
          <label htmlFor="password" className="block text-[13px] font-medium text-ink-2">
            관리자 비밀번호
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            autoFocus
            className="mt-2 h-10 w-full rounded-full border border-line-strong bg-surface px-4 text-[14px] text-ink outline-none transition-colors focus:border-accent"
          />
          {message && (
            <p role="alert" className="mt-3 text-[12.5px] leading-relaxed text-hot">
              {message}
            </p>
          )}
          <button type="submit" className={`${buttonClass("primary", "lg")} mt-5 w-full`}>
            로그인
          </button>
          {feishu && (
            <a href={`/api/auth/feishu?${new URLSearchParams({ return: returnTo })}`} className={`${buttonClass("secondary", "lg")} mt-3 w-full`}>
              SSO 로그인
            </a>
          )}
        </form>
        <p className="mt-6 text-center text-[12px] text-ink-4">
          <a href="/" className="hover:text-ink-2">
            {SITE.name} 메인으로 이동
          </a>
        </p>
      </div>
    </div>
  );
}
