"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Check,
  CloudDownload,
  Download,
  FileJson,
  FileSpreadsheet,
  Loader2,
  LogOut,
  Moon,
  Smartphone,
  Sun,
  Upload,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { CURRENCY_LIST } from "@/lib/constants";
import { apiPatch, apiPost, apiErrorMessage } from "@/lib/client-api";
import { formatDateLong } from "@/lib/date";
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

export function SettingsView({ user }: { user: SessionUser }) {
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
  const [installPrompt, setInstallPrompt] = React.useState<
    (Event & { prompt: () => Promise<void>; userChoice?: Promise<unknown> }) | null
  >(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    function handler(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as Event & { prompt: () => Promise<void> });
    }
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

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
      setImportProgress(`${result.imported} transaksi berhasil dipulihkan.`);
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

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setInstallPrompt(null);
  }

  return (
    <div className="space-y-4">
      <SectionCard
        title="Profil & mata uang"
        description="Nama dan mata uang dipakai di seluruh catatanmu."
        icon={<UserRound className="size-[18px]" />}
      >
        <div className="mb-4 flex items-center gap-3">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-[linear-gradient(140deg,#129168,#0a4a37)] text-[17px] font-bold text-white shadow-sm">
            {initials(name || user.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold">{name || user.name}</p>
            <p className="truncate text-[12px] text-muted-foreground">{user.email}</p>
            <p className="text-[11px] text-muted-foreground">
              Bergabung {formatDateLong(user.createdAt.slice(0, 10))}
            </p>
          </div>
        </div>

        <form onSubmit={saveProfile} className="space-y-3">
          <Field label="Nama tampilan" htmlFor="profile-name">
            <Input
              id="profile-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={60}
              autoComplete="name"
            />
          </Field>
          <Field
            label="Mata uang"
            htmlFor="profile-currency"
            hint={`Semua nominal akan tampil dalam ${currencyMeta(currency).label} (${currencyMeta(currency).symbol}).`}
          >
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
          {profileError ? (
            <p className="text-[12px] font-medium text-danger">{profileError}</p>
          ) : null}
          <Button type="submit" disabled={!profileDirty || savingProfile} className="w-full">
            {savingProfile ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Simpan profil
          </Button>
        </form>
      </SectionCard>

      <SectionCard
        title="Tampilan aplikasi"
        description="Pilih mode yang nyaman untuk matamu."
        icon={<Moon className="size-[18px]" />}
      >
        <Segmented
          ariaLabel="Mode tampilan"
          value={(mounted ? theme : user.theme) === "dark" ? "dark" : "light"}
          onChange={(value) => changeTheme(value)}
          options={[
            { value: "light", label: "Terang", icon: <Sun className="size-4" /> },
            { value: "dark", label: "Gelap", icon: <Moon className="size-4" /> },
          ]}
        />
        <p className="mt-2 text-[11.5px] text-muted-foreground">
          Pilihan tersimpan di perangkat ini dan akunmu.
        </p>
      </SectionCard>

      <SectionCard
        title="Cadangkan & ekspor data"
        description="Unduh salinan semua transaksi, atau pulihkan dari file cadangan."
        icon={<CloudDownload className="size-[18px]" />}
      >
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

        <div className="mt-3 rounded-2xl bg-surface/60 p-3.5">
          <p className="text-[12.5px] font-semibold">Pulihkan dari cadangan JSON</p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
            Transaksi dari file cadangan akan ditambahkan ke akun ini. Kategori yang belum ada
            dibuat otomatis.
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
            className="mt-2.5"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
          >
            {importing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Pilih file cadangan
          </Button>
          {importProgress ? (
            <p className="mt-2 flex items-center gap-1.5 text-[11.5px] font-medium text-success">
              <Check className="size-3.5" /> {importProgress}
            </p>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        title="Pasang aplikasi"
        description="Tambahkan Catatku ke layar utama HP seperti aplikasi biasa."
        icon={<Smartphone className="size-[18px]" />}
      >
        {installPrompt ? (
          <Button variant="soft" onClick={installApp} className="w-full">
            <Download className="size-4" /> Pasang Catatku
          </Button>
        ) : (
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            Di Chrome/Edge HP: buka menu browser, lalu pilih{" "}
            <span className="font-semibold text-foreground">&ldquo;Tambahkan ke layar utama&rdquo;</span>{" "}
            atau &ldquo;Instal aplikasi&rdquo;. Di iPhone: tombol Bagikan → &ldquo;Tambah ke Layar
            Utama&rdquo;.
          </p>
        )}
      </SectionCard>

      <SectionCard
        title="Akun"
        description={`Masuk sebagai ${user.email}.`}
        icon={<LogOut className="size-[18px]" />}
      >
        <Button
          variant="outline"
          className="w-full justify-start text-danger hover:bg-danger-soft/60"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
          Keluar dari akun ini
        </Button>
        <div className="mt-4 flex items-center justify-between text-[11.5px] text-muted-foreground">
          <span>Catatku versi 1.0.0</span>
          <span>{currencyMeta(user.currency).code} · PWA</span>
        </div>
      </SectionCard>
    </div>
  );
}
