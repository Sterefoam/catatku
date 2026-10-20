"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Check,
  CloudDownload,
  FileJson,
  FileSpreadsheet,
  Loader2,
  LogOut,
  Moon,
  Sun,
  Upload,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import {
  BcaIntegrationCard,
  type BcaIntegrationInfo,
} from "@/components/settings/bca-integration-card";
import { CURRENCY_LIST } from "@/lib/constants";
import { apiErrorMessage, apiPatch, apiPost } from "@/lib/client-api";
import { currencyMeta } from "@/lib/money";
import type { SessionUser } from "@/lib/types";
import { cn, initials } from "@/lib/utils";

function SectionCard({
  title,
  description,
  icon,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="flex items-start gap-3 border-b border-border/60 px-5 py-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold">{title}</p>
          {description ? (
            <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="px-5 py-4">{children}</div>
    </Card>
  );
}

export function SettingsView({
  user,
  bcaIntegration,
}: {
  user: SessionUser;
  bcaIntegration: BcaIntegrationInfo;
}) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const [mounted, setMounted] = React.useState(false);
  const [name, setName] = React.useState(user.name);
  const [currency, setCurrency] = React.useState(user.currency);
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [profileError, setProfileError] = React.useState<string | null>(null);
  const [importing, setImporting] = React.useState(false);
  const [importProgress, setImportProgress] = React.useState<string | null>(null);
  const [loggingOut, setLoggingOut] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => setMounted(true), []);

  const profileDirty = name.trim() !== user.name || currency !== user.currency;

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || name.trim().length < 2) {
      setProfileError("Nama minimal 2 karakter.");
      return;
    }
    setSavingProfile(true);
    setProfileError(null);
    try {
      await apiPatch("/api/settings/profile", { name: name.trim(), currency });
      toast.success("Profil tersimpan.");
      router.refresh();
    } catch (error) {
      setProfileError(apiErrorMessage(error));
    } finally {
      setSavingProfile(false);
    }
  }

  async function changeTheme(next: "light" | "dark") {
    setTheme(next);
    try {
      await apiPatch("/api/settings/theme", { theme: next });
    } catch {
      // preferensi lokal tetap dipakai
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await apiPost("/api/auth/logout", {});
      toast.success("Kamu sudah keluar.");
      router.replace("/login");
      router.refresh();
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setLoggingOut(false);
    }
  }

  async function handleImport(file: File) {
    setImporting(true);
    setImportProgress(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const body = Array.isArray(parsed)
        ? { transactions: parsed }
        : (parsed as { transactions?: unknown });

      if (!body || !Array.isArray((body as { transactions?: unknown[] }).transactions)) {
        throw new Error("File tidak dikenali. Gunakan file cadangan JSON dari Catatku.");
      }

      const result = await apiPost<{ imported: number }>("/api/import", body);
      setImportProgress(`${result.imported} transaksi dipulihkan.`);
      toast.success(`${result.imported} transaksi dipulihkan.`);
      router.refresh();
    } catch (error) {
      const message = apiErrorMessage(error);
      setImportProgress(null);
      toast.error(
        message.includes("JSON") || error instanceof SyntaxError
          ? "File tidak valid. Pastikan file JSON hasil ekspor Catatku."
          : message,
      );
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <SectionCard title="Profil & tampilan" icon={<UserRound className="size-[18px]" />}>
        <div className="mb-4 flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-[linear-gradient(140deg,#129168,#0a4a37)] text-[15px] font-bold text-white shadow-sm">
            {initials(name || user.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold">{name || user.name}</p>
            <p className="truncate text-[11.5px] text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <form onSubmit={saveProfile} className="space-y-3">
          <Field label="Nama" htmlFor="profile-name">
            <Input
              id="profile-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={60}
              autoComplete="name"
            />
          </Field>
          <Field label="Mata uang" htmlFor="profile-currency">
            <Select
              id="profile-currency"
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
            >
              {CURRENCY_LIST.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.code} — {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <div className="space-y-1.5">
            <p className="text-[13px] font-semibold text-muted-foreground">Mode tampilan</p>
            <Segmented
              ariaLabel="Mode tampilan"
              value={(mounted ? theme : user.theme) === "dark" ? "dark" : "light"}
              onChange={(value) => changeTheme(value)}
              options={[
                { value: "light", label: "Terang", icon: <Sun className="size-4" /> },
                { value: "dark", label: "Gelap", icon: <Moon className="size-4" /> },
              ]}
            />
          </div>

          {profileError ? (
            <p className="text-[12px] font-medium text-danger">{profileError}</p>
          ) : null}

          <Button type="submit" disabled={!profileDirty || savingProfile} className="w-full">
            {savingProfile ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            Simpan
          </Button>
        </form>
      </SectionCard>

      <SectionCard title="Data & cadangan" icon={<CloudDownload className="size-[18px]" />}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <a
            href="/api/export?format=csv"
            download
            className={cn(buttonVariants({ variant: "outline" }), "justify-start")}
          >
            <FileSpreadsheet className="size-4 text-primary" /> Unduh CSV
          </a>
          <a
            href="/api/export?format=json"
            download
            className={cn(buttonVariants({ variant: "outline" }), "justify-start")}
          >
            <FileJson className="size-4 text-primary" /> Unduh JSON
          </a>
        </div>

        <details className="mt-3 rounded-2xl bg-surface/60 px-3.5 py-2.5">
          <summary className="cursor-pointer text-[12.5px] font-semibold">
            Pulihkan dari cadangan JSON
          </summary>
          <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
            Transaksi dari file cadangan ditambahkan ke akun ini.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleImport(file);
            }}
          />
          <Button
            variant="soft"
            size="sm"
            className="mt-2"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
          >
            {importing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            Pilih file cadangan
          </Button>
          {importProgress ? (
            <p className="mt-2 flex items-center gap-1.5 text-[11.5px] font-medium text-success">
              <Check className="size-3.5" /> {importProgress}
            </p>
          ) : null}
        </details>
      </SectionCard>

      <BcaIntegrationCard integration={bcaIntegration} />

      <SectionCard title="Akun" icon={<LogOut className="size-[18px]" />}>
        <p className="text-[12px] text-muted-foreground">
          Masuk sebagai <span className="font-semibold text-foreground">{user.email}</span>
        </p>
        <Button
          variant="outline"
          className="mt-3 w-full justify-start text-danger hover:bg-danger-soft/60"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <LogOut className="size-4" />
          )}
          Keluar
        </Button>
        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Catatku v1.0.0</span>
          <span>{currencyMeta(user.currency).code}</span>
        </div>
      </SectionCard>
    </div>
  );
}
