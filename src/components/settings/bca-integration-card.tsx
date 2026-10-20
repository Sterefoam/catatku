"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Copy, Inbox, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface BcaIntegrationInfo {
  configured: boolean;
  email: string;
}

/** Ringkasan integrasi email BCA — sengaja ringkas; detail ada di dalam <details>. */
export function BcaIntegrationCard({ integration }: { integration: BcaIntegrationInfo }) {
  const [origin, setOrigin] = React.useState("");
  React.useEffect(() => setOrigin(window.location.origin), []);

  const webhook = `${origin || "https://catatku-dun.vercel.app"}/api/inbound/email`;

  async function copyWebhook() {
    try {
      await navigator.clipboard.writeText(webhook);
      toast.success("URL webhook disalin.");
    } catch {
      toast.error("Gagal menyalin.");
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-3 px-5 py-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Mail className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[14px] font-semibold">Integrasi BCA</p>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
                integration.configured
                  ? "bg-success-soft text-success"
                  : "bg-warning-soft text-warning",
              )}
            >
              {integration.configured ? "Aktif" : "Belum aktif"}
            </span>
          </div>
          <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
            {integration.configured
              ? `Email BCA yang diteruskan ke akun ${integration.email} otomatis masuk Kotak Masuk.`
              : "Email notifikasi BCA belum terhubung. Lihat cara mengaktifkan di bawah."}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border/60 px-5 py-3">
        <Link href="/inbox" className="flex-1">
          <Button variant="soft" size="sm" className="w-full">
            <Inbox className="size-4" /> Buka Kotak Masuk
          </Button>
        </Link>
      </div>

      <details className="group border-t border-border/60 px-5 py-3">
        <summary className="cursor-pointer list-none text-[12px] font-semibold text-muted-foreground transition-colors hover:text-foreground">
          Cara kerja &amp; pengaturan
        </summary>

        <div className="space-y-2.5 pt-3 text-[11.5px] leading-relaxed text-muted-foreground">
          <p>
            Transaksi dari email BCA (dari <code className="font-mono">bca@bca.co.id</code>) masuk
            ke Kotak Masuk untuk dikonfirmasi — tidak ada input manual.
          </p>

          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-2.5 py-1.5">
            <code className="min-w-0 flex-1 truncate text-[11px]">{webhook}</code>
            <Button
              type="button"
              size="iconSm"
              variant="ghost"
              onClick={copyWebhook}
              aria-label="Salin URL webhook"
            >
              <Copy className="size-3.5" />
            </Button>
          </div>

          <ol className="space-y-1.5 pl-1">
            <li>1. Isi <code className="font-mono">INBOUND_EMAIL_SECRET</code> di environment server.</li>
            <li>
              2. Teruskan email BCA dari Gmail akun <strong>{integration.email}</strong> memakai
              Google Apps Script (<code className="font-mono">scripts/gmail-bca-forwarder.gs</code>).
            </li>
            <li>3. Konfirmasi transaksi yang muncul di Kotak Masuk.</li>
          </ol>

          <p className="flex items-start gap-1.5 pt-1 text-[10.5px]">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" />
            MyBCA tidak punya API publik. Integrasi memakai email resmi BCA — tidak pernah meminta
            PIN/OTP.
          </p>
          {integration.configured ? (
            <p className="flex items-center gap-1.5 text-[10.5px] font-medium text-success">
              <Check className="size-3.5" /> Server siap menerima email.
            </p>
          ) : null}
        </div>
      </details>
    </Card>
  );
}
