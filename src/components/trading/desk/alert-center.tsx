"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellRing,
  Check,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { DataHint, Disclosure, SectionTitle } from "@/components/trading/ui";
import { apiDelete, apiErrorMessage, apiPatch, apiPost } from "@/lib/client-api";
import { fmtEtDateTime, fmtPrice } from "@/lib/trading/format";
import type {
  AlertDTO,
  AlertKind,
  MarketStatus,
  TradePlanDTO,
  TradingSettings,
} from "@/lib/trading/types";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "./confirm-dialog";
import {
  ALERT_KIND_LABELS,
  ALERT_KIND_OPTIONS,
  humaniseAlertLabel,
  parseDecimalInput,
  parsePriceInput,
} from "./desk-shared";

interface CheckResponse {
  triggered: AlertDTO[];
  checkedAt: string;
  prices: Record<string, number>;
}

const PRICE_KINDS: AlertKind[] = ["above", "below", "stop", "target"];

interface AlertFormState {
  symbol: string;
  kind: AlertKind;
  level: string;
  pct: string;
}

interface Preset {
  kind: Extract<AlertKind, "stop" | "target" | "flat-by">;
  label: string;
  value: string;
  hint: string;
}

const presetFor = (plan: TradePlanDTO): Preset[] => [
  {
    kind: "stop",
    label: "Batas rugi",
    value: fmtPrice(plan.stop),
    hint: "bunyi kalau harga turun ke sini",
  },
  {
    kind: "target",
    label: "Target untung",
    value: fmtPrice(plan.target),
    hint: "bunyi kalau target kena",
  },
  {
    kind: "flat-by",
    label: "Jam keluar",
    value: `${plan.flatBy} ET`,
    hint: "bunyi saat harus tutup posisi",
  },
];

/**
 * Pusat pengingat harga: tombol cepat dari rencana aktif (batas rugi, target,
 * jam keluar) di atas, daftar pengingat, form bebas & notifikasi di lipatan.
 */
export function AlertCenter({
  alerts,
  plans,
  settings,
  market,
  initialSymbol = "",
  initialKind = null,
}: {
  alerts: AlertDTO[];
  plans: TradePlanDTO[];
  settings: TradingSettings;
  market: MarketStatus;
  initialSymbol?: string;
  initialKind?: AlertKind | null;
}) {
  const router = useRouter();
  const [form, setForm] = React.useState<AlertFormState>(() => ({
    symbol: initialSymbol || plans[0]?.symbol || "",
    kind: initialKind ?? "above",
    level: "",
    pct: "3",
  }));
  const [formError, setFormError] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [busyPreset, setBusyPreset] = React.useState<string | null>(null);
  const [busyTriple, setBusyTriple] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<AlertDTO | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [lastCheck, setLastCheck] = React.useState<string | null>(null);
  const [prices, setPrices] = React.useState<Record<string, number>>({});
  const [permission, setPermission] = React.useState<
    NotificationPermission | "unsupported"
  >("default");

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof Notification === "undefined") {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
  }, []);

  const activeAlerts = alerts.filter((alert) => alert.isActive);
  const triggeredAlerts = alerts.filter((alert) => !alert.isActive);
  const selectedKindHint =
    ALERT_KIND_OPTIONS.find((option) => option.value === form.kind)?.hint ?? "";

  const orderedPlans = React.useMemo(() => {
    if (!initialSymbol) return plans;
    return [
      ...plans.filter((plan) => plan.symbol === initialSymbol),
      ...plans.filter((plan) => plan.symbol !== initialSymbol),
    ];
  }, [plans, initialSymbol]);

  const runCheck = React.useCallback(async () => {
    try {
      const data = await apiPost<CheckResponse>("/api/trading/alerts/check", {});
      setLastCheck(data.checkedAt);
      setPrices((current) => ({ ...current, ...data.prices }));
      if (!data.triggered.length) return;
      for (const alert of data.triggered) {
        toast.success(`Pengingat terpicu: ${humaniseAlertLabel(alert.label)}`);
      }
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        for (const alert of data.triggered) {
          try {
            new Notification("Catatku · Meja Trading", {
              body: humaniseAlertLabel(alert.label),
              tag: alert.id,
            });
          } catch {
            // Notifikasi bisa diblokir; toast sudah tampil.
          }
        }
      }
      router.refresh();
    } catch {
      // Polling tidak menampilkan error berulang; cek manual tetap tersedia.
    }
  }, [router]);

  React.useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      await runCheck();
    };
    void tick();
    const timer = setInterval(tick, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [runCheck]);

  async function enableNotifications() {
    if (typeof Notification === "undefined") {
      toast.error("Browser ini tidak mendukung notifikasi.");
      return;
    }
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === "granted") {
        toast.success("Notifikasi browser aktif. Pengingat muncul saat halaman terbuka.");
      } else if (result === "denied") {
        toast.error("Izin notifikasi ditolak. Pengingat tetap muncul sebagai pesan di halaman.");
      }
    } catch {
      toast.error("Tidak bisa meminta izin notifikasi.");
    }
  }

  async function createAlert() {
    setFormError(null);
    const symbol = form.symbol.trim().toUpperCase();
    if (form.kind !== "bell" && form.kind !== "flat-by") {
      if (!symbol) {
        setFormError("Kode saham wajib diisi.");
        return;
      }
      if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(symbol)) {
        setFormError("Kode saham tidak valid. Contoh: TSLA.");
        return;
      }
    }

    let level: number | null = null;
    let pct: number | null = null;
    if (PRICE_KINDS.includes(form.kind)) {
      level = parsePriceInput(form.level);
      if (!level) {
        setFormError("Level harga wajib diisi dalam $.");
        return;
      }
    }
    if (form.kind === "pct") {
      pct = parseDecimalInput(form.pct);
      if (pct === null || pct <= 0 || pct > 100) {
        setFormError("Persentase harus di antara 0 dan 100.");
        return;
      }
    }

    setCreating(true);
    try {
      await apiPost("/api/trading/alerts", {
        ...(symbol ? { symbol } : {}),
        kind: form.kind,
        ...(level !== null ? { level } : {}),
        ...(pct !== null ? { pct } : {}),
      });
      toast.success("Pengingat dibuat. Halaman ini mengecek harga tiap 30 detik.");
      setForm((current) => ({ ...current, level: "" }));
      router.refresh();
    } catch (error) {
      setFormError(apiErrorMessage(error));
    } finally {
      setCreating(false);
    }
  }

  async function createPreset(plan: TradePlanDTO, preset: Preset) {
    const key = `${plan.id}:${preset.kind}`;
    setBusyPreset(key);
    try {
      await apiPost("/api/trading/alerts", {
        symbol: plan.symbol,
        kind: preset.kind,
        ...(preset.kind === "stop" ? { level: plan.stop } : {}),
        ...(preset.kind === "target" ? { level: plan.target } : {}),
      });
      toast.success(`Pengingat ${preset.label.toLowerCase()} ${plan.symbol} dipasang.`);
      router.refresh();
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setBusyPreset(null);
    }
  }

  async function toggleAlert(alert: AlertDTO) {
    const nextActive = !alert.isActive;
    setBusyId(alert.id);
    try {
      await apiPatch(`/api/trading/alerts/${alert.id}`, {
        isActive: nextActive,
        ...(nextActive ? { triggeredAt: null } : {}),
      });
      toast.success(nextActive ? "Pengingat diaktifkan lagi." : "Pengingat dinonaktifkan.");
      router.refresh();
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiDelete(`/api/trading/alerts/${deleteTarget.id}`);
      toast.success("Pengingat dihapus.");
      setDeleteTarget(null);
      router.refresh();
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  }

  async function createTripleAlerts(plan: TradePlanDTO) {
    setBusyTriple(plan.id);
    try {
      await apiPost("/api/trading/alerts", {
        symbol: plan.symbol,
        kind: "stop",
        level: plan.stop,
      });
      await apiPost("/api/trading/alerts", {
        symbol: plan.symbol,
        kind: "target",
        level: plan.target,
      });
      await apiPost("/api/trading/alerts", { symbol: plan.symbol, kind: "flat-by" });
      toast.success(`3 pengingat ${plan.symbol} dipasang: batas rugi, target, jam keluar.`);
      router.refresh();
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setBusyTriple(null);
    }
  }

  return (
    <div className="space-y-5 pb-2">
      <section className="space-y-3" aria-labelledby="preset-pengingat">
        <SectionTitle
          title="Pengingat dari rencana"
          hint={`Satu klik untuk memasang pengingat. Sesi: ${market.label} · jam keluar ${settings.flatBy} ET.`}
        />
        {orderedPlans.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card/60 px-4 py-3 text-[12px] leading-relaxed text-muted-foreground">
            Belum ada rencana aktif.{" "}
            <Link href="/trading/rencana" className="font-semibold text-primary underline">
              Buat rencana dulu
            </Link>{" "}
            supaya batas rugi dan target untungnya bisa dipasangi pengingat.
          </p>
        ) : (
          <div className="space-y-2.5">
            {orderedPlans.slice(0, 3).map((plan) => (
              <Card key={plan.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold">
                      {plan.symbol}
                      <span className="ml-1.5 text-[11.5px] font-normal text-muted-foreground">
                        harga masuk {fmtPrice(plan.entry)}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">
                      batas rugi {fmtPrice(plan.stop)} · target {fmtPrice(plan.target)} · jam keluar{" "}
                      {plan.flatBy} ET
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0"
                    onClick={() => createTripleAlerts(plan)}
                    disabled={busyTriple !== null || busyPreset !== null}
                    aria-label={`Pasang 3 pengingat ${plan.symbol} sekaligus`}
                  >
                    {busyTriple === plan.id ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Zap className="size-3.5" aria-hidden="true" />
                    )}
                    3 sekaligus
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {presetFor(plan).map((preset) => {
                    const key = `${plan.id}:${preset.kind}`;
                    return (
                      <Button
                        key={preset.kind}
                        size="md"
                        variant="soft"
                        className="h-auto min-h-11 flex-col gap-0.5 px-2 py-2 text-[12px] leading-tight"
                        title={preset.hint}
                        onClick={() => createPreset(plan, preset)}
                        disabled={busyPreset !== null || busyTriple !== null}
                        aria-label={`Pasang pengingat ${preset.label} ${plan.symbol} di ${preset.value}`}
                      >
                        {busyPreset === key ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                        ) : null}
                        <span>{preset.label}</span>
                        <span className="text-[10.5px] font-medium opacity-80">{preset.value}</span>
                      </Button>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="daftar-alert">
        <SectionTitle
          title="Pengingat aktif"
          hint={
            activeAlerts.length
              ? `${activeAlerts.length} pengingat dicek tiap 30 detik selama halaman terbuka.`
              : "Belum ada pengingat aktif."
          }
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void runCheck();
                toast.success("Memeriksa harga sekarang...");
              }}
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
              Cek sekarang
            </Button>
          }
        />

        {activeAlerts.length === 0 ? (
          <EmptyState
            compact
            icon={<Bell className="size-5" aria-hidden="true" />}
            title="Belum ada pengingat aktif"
            description="Pasang pengingat batas rugi & target supaya tidak perlu menatap grafik terus-menerus."
          />
        ) : (
          <Card className="divide-y divide-border/70 overflow-hidden">
            {activeAlerts.map((alert) => (
              <div key={alert.id} className="flex items-center gap-2.5 px-4 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning">
                  <BellRing className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold leading-snug">
                    {humaniseAlertLabel(alert.label)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {ALERT_KIND_LABELS[alert.kind]}
                    {alert.symbol ? ` · ${alert.symbol}` : ""}
                    {prices[alert.symbol] ? ` · harga ${fmtPrice(prices[alert.symbol]!)}` : ""}
                  </p>
                </div>
                <Switch
                  checked={alert.isActive}
                  disabled={busyId === alert.id}
                  onCheckedChange={() => toggleAlert(alert)}
                  aria-label={`Aktifkan atau nonaktifkan pengingat ${humaniseAlertLabel(alert.label)}`}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="shrink-0 text-muted-foreground hover:text-danger"
                  onClick={() => setDeleteTarget(alert)}
                  aria-label={`Hapus pengingat ${humaniseAlertLabel(alert.label)}`}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            ))}
          </Card>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="alert-terpicu">
        <SectionTitle
          title="Sudah terpicu / nonaktif"
          hint={
            lastCheck
              ? `Terakhir dicek ${fmtEtDateTime(lastCheck)}.`
              : "Belum ada pengecekan pada halaman ini."
          }
        />
        {triggeredAlerts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card/60 px-4 py-3 text-[12px] leading-relaxed text-muted-foreground">
            Belum ada pengingat yang terpicu. Pengingat yang terpicu otomatis nonaktif supaya
            tidak berbunyi berulang.
          </p>
        ) : (
          <Card className="divide-y divide-border/70 overflow-hidden">
            {triggeredAlerts.slice(0, 20).map((alert) => (
              <div key={alert.id} className="flex items-center gap-2.5 px-4 py-3">
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-xl",
                    alert.triggeredAt
                      ? "bg-success-soft text-success"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {alert.triggeredAt ? (
                    <Check className="size-4" aria-hidden="true" />
                  ) : (
                    <Bell className="size-4" aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium leading-snug">
                    {humaniseAlertLabel(alert.label)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {alert.triggeredAt
                      ? `Terpicu ${fmtEtDateTime(alert.triggeredAt)}`
                      : "Dinonaktifkan manual"}
                    {alert.symbol ? ` · ${alert.symbol}` : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => toggleAlert(alert)}
                  disabled={busyId === alert.id}
                >
                  Aktifkan lagi
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="shrink-0 text-muted-foreground hover:text-danger"
                  onClick={() => setDeleteTarget(alert)}
                  aria-label={`Hapus pengingat ${humaniseAlertLabel(alert.label)}`}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            ))}
          </Card>
        )}
      </section>

      <Disclosure
        title="Pengingat khusus"
        hint="Level sendiri, perubahan persen, bel pembukaan, notifikasi browser"
        defaultOpen={Boolean(initialSymbol)}
      >
        <div className="space-y-4">
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            {initialSymbol
              ? `Kode saham ${initialSymbol} sudah diisi dari halaman sebelumnya.`
              : "Pakai form ini kalau pengingat cepat di atas belum cocok."}
          </p>

          <div className="grid grid-cols-1 gap-3">
            <Field
              label="Kode saham"
              htmlFor="alert-symbol"
              hint="Kosongkan hanya untuk bel pembukaan & jam keluar."
            >
              <Input
                id="alert-symbol"
                value={form.symbol}
                onChange={(event) => {
                  setForm((current) => ({ ...current, symbol: event.target.value.toUpperCase() }));
                  setFormError(null);
                }}
                placeholder="TSLA"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={10}
              />
            </Field>
            <Field label="Jenis pengingat" htmlFor="alert-kind" hint={selectedKindHint}>
              <Select
                id="alert-kind"
                value={form.kind}
                onChange={(event) => {
                  setForm((current) => ({ ...current, kind: event.target.value as AlertKind }));
                  setFormError(null);
                }}
              >
                {ALERT_KIND_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            {PRICE_KINDS.includes(form.kind) ? (
              <Field
                label="Level harga ($)"
                htmlFor="alert-level"
                hint="Contoh: 364.18 untuk level $364.18."
              >
                <Input
                  id="alert-level"
                  value={form.level}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, level: event.target.value }));
                    setFormError(null);
                  }}
                  placeholder="364.18"
                  inputMode="decimal"
                  autoComplete="off"
                />
              </Field>
            ) : form.kind === "pct" ? (
              <Field
                label="Perubahan harga (%)"
                htmlFor="alert-pct"
                hint="Berbunyi saat harga bergerak minimal sekian % dari penutupan sebelumnya."
              >
                <Input
                  id="alert-pct"
                  value={form.pct}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, pct: event.target.value }));
                    setFormError(null);
                  }}
                  placeholder="3"
                  inputMode="decimal"
                  autoComplete="off"
                />
              </Field>
            ) : (
              <p className="rounded-2xl bg-surface/70 px-3.5 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
                {form.kind === "bell"
                  ? "Pengingat bel berbunyi sekali saat pasar New York buka (09.30 ET) selama halaman ini terbuka."
                  : `Pengingat jam keluar berbunyi sekali setelah pukul ${settings.flatBy} ET pada hari bursa.`}
              </p>
            )}
          </div>

          {formError ? (
            <p className="rounded-2xl bg-danger-soft/60 px-3.5 py-2.5 text-[12.5px] font-medium text-danger">
              {formError}
            </p>
          ) : null}

          <Button size="lg" className="w-full" onClick={createAlert} disabled={creating}>
            {creating ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="size-4" aria-hidden="true" />
            )}
            {creating ? "Membuat..." : "Buat pengingat"}
          </Button>

          <div className="space-y-2 rounded-2xl border border-border/70 bg-surface/40 p-3.5">
            <p className="text-[12.5px] font-semibold">Notifikasi browser (opsional)</p>
            <p className="text-[11.5px] leading-relaxed text-muted-foreground">
              {permission === "granted"
                ? "Pengingat yang terpicu juga muncul sebagai notifikasi sistem selama halaman ini terbuka."
                : permission === "denied"
                  ? "Notifikasi diblokir browser. Buka pengaturan situs untuk mengizinkan."
                  : permission === "unsupported"
                    ? "Browser ini tidak mendukung notifikasi. Pengingat tetap muncul di halaman."
                    : "Tanpa notifikasi, pengingat tetap muncul sebagai pesan di halaman ini."}
            </p>
            {permission === "default" ? (
              <Button size="sm" variant="outline" onClick={enableNotifications}>
                <BellRing className="size-3.5" aria-hidden="true" />
                Aktifkan notifikasi
              </Button>
            ) : (
              <Badge tone={permission === "granted" ? "success" : "neutral"}>
                {permission === "granted"
                  ? "Aktif"
                  : permission === "denied"
                    ? "Diblokir"
                    : "Tidak tersedia"}
              </Badge>
            )}
          </div>
        </div>
      </Disclosure>

      <DataHint>
        Harga dari Yahoo Finance (gratis, bisa tertunda), jadi pengingat bisa terlambat beberapa
        menit. Pengingat hanya dicek saat halaman ini terbuka — bukan notifikasi latar belakang.
      </DataHint>

      {deleteTarget ? (
        <ConfirmDialog
          title="Hapus pengingat ini?"
          description={`Pengingat "${humaniseAlertLabel(deleteTarget.label)}" akan dihapus permanen.`}
          confirmLabel="Hapus pengingat"
          busy={deleting}
          onConfirm={confirmDelete}
          onClose={() => setDeleteTarget(null)}
        />
      ) : null}
    </div>
  );
}
