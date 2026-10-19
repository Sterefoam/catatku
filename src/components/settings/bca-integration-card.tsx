"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Copy, Inbox, Mail, ShieldCheck, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface BcaIntegrationInfo {
  configured: boolean;
  secretConfigured: boolean;
  boundEmail: string | null;
  currentUserEmail: string;
}

export function BcaIntegrationCard({ integration }: { integration: BcaIntegrationInfo }) {
  const [origin, setOrigin] = React.useState("");
  React.useEffect(() => setOrigin(window.location.origin), []);

  const webhook = `${origin || "https://domain-kamu"}/api/inbound/email`;
  const mismatch =
    integration.configured &&
    integration.boundEmail !== null &&
    integration.boundEmail.toLowerCase() !== integration.currentUserEmail.toLowerCase();

  async function copyWebhook() {
    try {
      await navigator.clipboard.writeText(webhook);
      toast.success("URL webhook disalin.");
    } catch {
      toast.error("Gagal menyalin. Salin manual dari kotak di atas.");
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-3 border-b border-border/60 px-5 py-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Mail className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[14px] font-semibold">Integrasi BCA (otomatis)</p>
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
            Transaksi dari email notifikasi BCA masuk ke Kotak Masuk untuk kamu konfirmasi —
            tanpa input manual.
          </p>
        </div>
      </div>

      <div className="space-y-3.5 px-5 py-4">
        <div className="grid gap-2 rounded-2xl bg-surface/60 p-3 text-[12px]">
          <div className="flex items-start justify-between gap-3">
            <span className="text-muted-foreground">Email akun terhubung</span>
            <span className="text-right font-semibold">
              {integration.boundEmail ?? "Belum diatur (INBOUND_EMAIL_USER)"}
            </span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-muted-foreground">Akun login saat ini</span>
            <span className="text-right font-semibold">{integration.currentUserEmail}</span>
          </div>
        </div>

        {mismatch ? (
          <p className="flex items-start gap-2 rounded-2xl bg-warning-soft/70 p-3 text-[11.5px] leading-relaxed text-warning">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            Email terhubung berbeda dengan akun login. Samakan nilai{" "}
            <code className="font-mono">INBOUND_EMAIL_USER</code> di Vercel dengan email akun ini
            (atau login memakai email yang terhubung).
          </p>
        ) : null}

        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            URL webhook
          </p>
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2">
            <code className="min-w-0 flex-1 truncate text-[11.5px]">{webhook}</code>
            <Button
              type="button"
              size="iconSm"
              variant="ghost"
              onClick={copyWebhook}
              aria-label="Salin URL webhook"
            >
              <Copy className="size-4" />
            </Button>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            Wajib ditambah <code className="font-mono">?secret=INBOUND_EMAIL_SECRET</code>. Secret
            hanya disimpan sebagai environment variable, tidak ditampilkan di sini.
          </p>
        </div>

        <ol className="space-y-2 text-[11.5px] leading-relaxed text-muted-foreground">
          <li className="flex gap-2">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[10.5px] font-bold text-primary">
              1
            </span>
            Di Vercel → Settings → Environment Variables, isi{" "}
            <code className="font-mono">INBOUND_EMAIL_SECRET</code> (acak) dan{" "}
            <code className="font-mono">INBOUND_EMAIL_USER</code> (email akun ini), lalu redeploy.
          </li>
          <li className="flex gap-2">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[10.5px] font-bold text-primary">
              2
            </span>
            Teruskan email BCA: paling mudah pakai Google Apps Script{" "}
            <code className="font-mono">scripts/gmail-bca-forwarder.gs</code> di Gmail yang
            menerima email BCA (panduan: docs/BCA-INTEGRATION.md).
          </li>
          <li className="flex gap-2">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[10.5px] font-bold text-primary">
              3
            </span>
            Email BCA berikutnya muncul di Kotak Masuk → cek nominal/kategori → konfirmasi.
          </li>
        </ol>

        <div className="flex flex-wrap gap-2">
          <Link href="/inbox" className="flex-1">
            <Button variant="soft" className="w-full">
              <Inbox className="size-4" /> Buka kotak masuk
            </Button>
          </Link>
        </div>

        <p className="flex items-start gap-1.5 text-[10.5px] leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" />
          MyBCA tidak punya API publik untuk rekening pribadi. Integrasi ini memakai email
          notifikasi resmi BCA — tidak pernah meminta PIN/OTP, dan hanya transaksi yang dikirim
          BCA lewat email yang tertangkap otomatis.
        </p>
        {integration.configured ? (
          <p className="flex items-center gap-1.5 text-[10.5px] font-medium text-success">
            <Check className="size-3.5" /> Konfigurasi server terdeteksi.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
