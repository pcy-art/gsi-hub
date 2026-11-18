import { ADMIN, SITE } from "@aihot/site";
import { useRef, useState } from "react";
import type { Route } from "./+types/settings";
import type { AdminSettings } from "@aihot/contracts/admin";
import { adminGet } from "../../lib/admin.server";
import { useAdminAction } from "../../features/admin/action";
import { bj, num } from "../../features/admin/format";
import { AdminPage, Badge, Button, Card, DataTable, Input, ReasonDialog } from "../../features/admin/ui";
import { toast } from "../../features/admin/toast";


export async function loader({ request }: Route.LoaderArgs) {
  return adminGet<AdminSettings>(request, "/api/admin/settings");
}

export const meta: Route.MetaFunction = () => [{ title: `시스템 설정 · ${SITE.name} 관리자` }];

function QrSlot({ slot, label, src }: { slot: "wechatQr" | "feishuQr"; label: string; src: string | null }) {
  const { run, pending } = useAdminAction();
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-4">
      {src ? <img src={src} alt={label} className="size-28 rounded-card bg-white object-contain p-1.5 ring-1 ring-line" /> : <div className="flex size-28 shrink-0 items-center justify-center rounded-card bg-surface text-sm text-ink-4 ring-1 ring-line">미설정</div>}
      <div>
        <div className="text-[14px] font-medium text-ink">{label}</div>
        <div className="mt-0.5 break-all font-mono text-[11.5px] text-ink-4">{src}</div>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            if (file.size > 2 * 1024 * 1024) return toast("이미지 최대 크기는 2MB입니다", "error");
            const image = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
            await run("POST", "/api/admin/settings/contact-qr", { slot, image }, { label: `qr-${slot}`, success: `${label}이(가) 변경되었습니다. 소개 페이지에 5분 내 반영됩니다` });
          }}
        />
        <Button className="mt-2" size="sm" busy={pending === `qr-${slot}`} onClick={() => input.current?.click()}>이미지 변경</Button>
      </div>
    </div>
  );
}

function BudgetRow({ b }: { b: AdminSettings["budgets"][number] }) {
  const { run, pending } = useAdminAction();
  const [v, setV] = useState({ perMinute: b.per_minute, perHour: b.per_hour, perDay: b.per_day });
  const [open, setOpen] = useState(false);
  const changed = v.perMinute !== b.per_minute || v.perHour !== b.per_hour || v.perDay !== b.per_day;
  return (
    <tr className="border-b border-line/70 last:border-0">
      <td className="px-3 py-2 font-mono text-[12.5px]">{b.service}</td>
      {(["perMinute", "perHour", "perDay"] as const).map((k) => (
        <td key={k} className="px-3 py-2">
          <Input type="number" min={0} className="!w-24 !py-1 text-right" value={v[k]} onChange={(e) => setV({ ...v, [k]: Number(e.target.value) })} />
        </td>
      ))}
      <td className="num px-3 py-2 text-right text-ink-3">{num(b.used_hour)} / {num(b.used_day)}</td>
      <td className="px-3 py-2 text-right">
        <Button size="sm" tone="primary" disabled={!changed} onClick={() => setOpen(true)}>저장</Button>
        <ReasonDialog
          open={open}
          title={`${b.service} 요청 한도 조정`}
          description={`유료 API 호출 서킷 브레이커: 한도 초과 시 요청이 일시 중지되고 윈도우 주기에 맞춰 재시도됩니다. 0을 입력하면 서비스를 즉시 비활성화합니다. ${ADMIN?.budgetNote ?? ""}`}
          confirmLabel="저장"
          busy={pending === "budget"}
          onClose={() => setOpen(false)}
          onSubmit={async (reason) => (await run("PUT", `/api/admin/budgets/${encodeURIComponent(b.service)}`, { ...v, reason }, { label: "budget", success: "한도가 갱신되었습니다" })) !== null}
        />
      </td>
    </tr>
  );
}

function TargetToggle({ t }: { t: AdminSettings["targets"][number] }) {
  const { run, pending } = useAdminAction();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" tone={t.enabled ? "danger" : "primary"} onClick={() => setOpen(true)}>{t.enabled ? "비활성화" : "활성화"}</Button>
      <ReasonDialog
        open={open}
        title={`${t.enabled ? "비활성화" : "활성화"}：${t.note ?? t.key}`}
        description={t.enabled ? "비활성화 후 새로운 알림이 이 채널로 발송되지 않습니다." : "활성화 시각이 기록되며, 활성화 이전 콘텐츠는 소급 발송되지 않습니다. 개발 환경에서는 실제 발송되지 않습니다."}
        danger={t.enabled}
        confirmLabel={t.enabled ? "비활성화" : "활성화"}
        busy={pending === "target"}
        onClose={() => setOpen(false)}
        onSubmit={async (reason) => (await run("POST", `/api/admin/notify-targets/${encodeURIComponent(t.key)}`, { enabled: !t.enabled, reason }, { label: "target", success: "설정이 갱신되었습니다" })) !== null}
      />
    </>
  );
}

export default function SettingsAdmin({ loaderData: s }: Route.ComponentProps) {
  return (
    <AdminPage title="시스템 설정" subtitle="코드 수정 없이 즉시 반영되는 운영 설정입니다. 모든 변경 사항은 감사 로그에 기록됩니다.">
      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="소개 페이지 QR 코드">
          <div className="space-y-5">
            <QrSlot slot="wechatQr" label="공식 안내 채널 QR 코드" src={s.contact.wechatQr} />
            <QrSlot slot="feishuQr" label="내부 알림 채널 QR 코드" src={s.contact.feishuQr} />
          </div>
        </Card>
        <Card title="알림 수신 채널" pad={false}>
          <DataTable
            rows={s.targets}
            rowKey={(t) => t.key}
            columns={[
              { key: "k", label: "수신 채널", render: (t) => <div><div className="font-medium text-ink">{t.note ?? t.key}</div><div className="font-mono text-[11.5px] text-ink-4">{t.key} · {t.config_ref}</div></div> },
              { key: "e", label: "상태", render: (t) => (t.enabled ? <Badge tone="ok">활성화됨 ({bj(t.enabled_at)})</Badge> : <Badge>비활성</Badge>) },
              { key: "d", label: "7일 발송건", align: "right", render: (t) => num(t.deliveries_7d) },
              { key: "a", label: "", align: "right", render: (t) => <TargetToggle t={t} /> },
            ]}
          />
        </Card>
      </div>
      <Card className="mt-5" title="API 호출 한도 (서킷 브레이커)" right={<span>사용량: 최근 1시간 / 최근 24시간</span>} pad={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-ink-3">
                <th className="px-3 py-2 font-medium">서비스</th>
                <th className="px-3 py-2 font-medium">분당 한도</th>
                <th className="px-3 py-2 font-medium">시간당 한도</th>
                <th className="px-3 py-2 font-medium">일일 한도</th>
                <th className="px-3 py-2 text-right font-medium">사용량</th>
                <th />
              </tr>
            </thead>
            <tbody>{s.budgets.map((b) => <BudgetRow key={`${b.service}-${b.updated_at}`} b={b} />)}</tbody>
          </table>
        </div>
      </Card>
    </AdminPage>
  );
}
