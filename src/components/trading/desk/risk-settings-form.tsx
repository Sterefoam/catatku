"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, ShieldCheck, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { DataHint, Disclosure, SectionTitle, StatTile } from "@/components/trading/ui";
import { apiErrorMessage, apiPut } from "@/lib/client-api";
import { hhmmToMinutes } from "@/lib/trading/market-clock";
import { fmtPrice, fmtR } from "@/lib/trading/format";
import type { TradingSettings } from "@/lib/trading/types";
import { universeLabel } from "@/lib/trading/universe";
import {
  centsToPriceInput,
  decimalToInput,
  parseDecimalInput,
  parseMoneyInput,
} from "./desk-shared";

interface SettingsFormState {
  budget: string;
  maxLossPerTrade: string;
  maxPosition: string;
  maxOrder: string;
  cashBuffer: string;
  maxTradesPerDay: string;
  dailyLossLimit: string;
  entryFrom: string;
  entryTo: string;
  flatBy: string;
  minRewardRisk: string;
  universe: "sp100" | "mega";
}

function toFormState(settings: TradingSettings): SettingsFormState {
  return {
    budget: centsToPriceInput(settings.budget),
    maxLossPerTrade: centsToPriceInput(settings.maxLossPerTrade),
    maxPosition: centsToPriceInput(settings.maxPosition),
    maxOrder: centsToPriceInput(settings.maxOrder),
    cashBuffer: centsToPriceInput(settings.cashBuffer),
    maxTradesPerDay: String(settings.maxTradesPerDay),
    dailyLossLimit: centsToPriceInput(settings.dailyLossLimit),
    entryFrom: settings.entryFrom,
    entryTo: settings.entryTo,
    flatBy: settings.flatBy,
    minRewardRisk: decimalToInput(settings.minRewardRisk),
    universe: settings.universe === "mega" ? "mega" : "sp100",
  };
}

function FieldMoney({
  id,
  label,
  hint,
  placeholder,
  value,
  error,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  placeholder?: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error}>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder ?? "0.00"}
        inputMode="decimal"
        autoComplete="off"
      />
    </Field>
  );
}

/**
 * Form pengaturan risiko & jam sesi. Bagian "Penting" selalu terlihat,
 * sisanya (batas posisi, kas, R:R, daftar saham) dilipat di "Lanjutan".
 * Semua nominal diketik dalam dolar AS, dikirim ke server dalam sen.
 */
export function RiskSettingsForm({ settings }: { settings: TradingSettings }) {
  const router = useRouter();
  const [form, setForm] = React.useState<SettingsFormState>(() => toFormState(settings));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  function update<K extends keyof SettingsFormState>(key: K, value: SettingsFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  }

  const budgetCents = parseMoneyInput(form.budget) ?? 0;
  const maxLossCents = parseMoneyInput(form.maxLossPerTrade) ?? 0;
  const maxTrades = Math.max(0, Number.parseInt(form.maxTradesPerDay, 10) || 0);
  const dailyLimitCents = parseMoneyInput(form.dailyLossLimit) ?? 0;
  const maxDailyRisk = Math.min(dailyLimitCents, maxLossCents * maxTrades);
  const cashBufferCents = parseMoneyInput(form.cashBuffer, true) ?? 0;
  const minRr = parseDecimalInput(form.minRewardRisk) ?? 0;

  function validate(): {
    patch: Record<string, number | string> | null;
  } {
    const nextErrors: Record<string, string> = {};

    const budget = parseMoneyInput(form.budget);
    if (!budget) nextErrors.budget = "Modal latihan wajib diisi lebih dari nol.";

    const maxLoss = parseMoneyInput(form.maxLossPerTrade);
    if (!maxLoss) nextErrors.maxLossPerTrade = "Batas rugi per trade wajib diisi.";

    const maxPosition = parseMoneyInput(form.maxPosition);
    if (!maxPosition) nextErrors.maxPosition = "Ukuran posisi maksimal wajib diisi.";

    const maxOrder = parseMoneyInput(form.maxOrder);
    if (!maxOrder) nextErrors.maxOrder = "Nilai order maksimal wajib diisi.";

    const cashBuffer = parseMoneyInput(form.cashBuffer, true);
    if (cashBuffer === null) nextErrors.cashBuffer = "Kas yang disisakan tidak valid.";
    else if (budget !== null && cashBuffer !== null && cashBuffer >= budget) {
      nextErrors.cashBuffer = "Kas yang disisakan harus lebih kecil dari modal latihan.";
    }

    const dailyLoss = parseMoneyInput(form.dailyLossLimit);
    if (!dailyLoss) nextErrors.dailyLossLimit = "Batas rugi harian wajib diisi.";

    if (budget && maxPosition && maxPosition > budget) {
      nextErrors.maxPosition = "Ukuran posisi tidak boleh melebihi modal latihan.";
    }
    if (maxPosition && maxOrder && maxOrder > maxPosition) {
      nextErrors.maxOrder = "Nilai order tidak boleh melebihi ukuran posisi.";
    }
    if (dailyLoss && maxLoss && dailyLoss < maxLoss) {
      nextErrors.dailyLossLimit = "Batas rugi harian minimal sama dengan rugi per trade.";
    }
    if (maxLoss && budget && maxLoss > budget) {
      nextErrors.maxLossPerTrade = "Batas rugi per trade tidak boleh melebihi modal.";
    }

    const trades = Number.parseInt(form.maxTradesPerDay, 10);
    if (!Number.isFinite(trades) || trades < 1 || trades > 20) {
      nextErrors.maxTradesPerDay = "Jumlah trade per hari harus 1 sampai 20.";
    }

    const rewardRisk = parseDecimalInput(form.minRewardRisk);
    if (rewardRisk === null || rewardRisk < 0 || rewardRisk > 10) {
      nextErrors.minRewardRisk = "Imbalan : risiko minimal harus di antara 0 dan 10.";
    }

    for (const key of ["entryFrom", "entryTo", "flatBy"] as const) {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form[key])) {
        nextErrors[key] = "Jam harus berformat JJ:mm, contoh 15:55.";
      }
    }

    const from = hhmmToMinutes(form.entryFrom);
    const to = hhmmToMinutes(form.entryTo);
    const flatByMinutes = hhmmToMinutes(form.flatBy);
    if (!nextErrors.entryFrom && !nextErrors.entryTo && from >= to) {
      nextErrors.entryTo = "Jam selesai masuk harus setelah jam mulai masuk.";
    }
    if (!nextErrors.entryTo && !nextErrors.flatBy && to >= flatByMinutes) {
      nextErrors.flatBy = "Jam keluar harus setelah jam selesai masuk.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return { patch: null };

    return {
      patch: {
        budget: budget!,
        maxLossPerTrade: maxLoss!,
        maxPosition: maxPosition!,
        maxOrder: maxOrder!,
        cashBuffer: cashBuffer!,
        maxTradesPerDay: trades,
        dailyLossLimit: dailyLoss!,
        entryFrom: form.entryFrom,
        entryTo: form.entryTo,
        flatBy: form.flatBy,
        minRewardRisk: rewardRisk!,
        universe: form.universe,
      },
    };
  }

  async function save() {
    const result = validate();
    if (!result.patch) {
      toast.error("Periksa kembali isian pengaturan.");
      return;
    }
    setSaving(true);
    try {
      await apiPut<{ settings: TradingSettings }>("/api/trading/settings", result.patch);
      toast.success("Pengaturan trading disimpan.");
      router.refresh();
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="space-y-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Cara kerja
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[14px] font-semibold">
              <Wallet className="size-4 text-primary" aria-hidden="true" />
              Latihan (uang kertas)
            </p>
          </div>
          <Badge tone="primary">Latihan</Badge>
        </div>
        <p className="text-[11.5px] leading-relaxed text-muted-foreground">
          Catatku tidak terhubung ke broker mana pun. Semua order hanya dicatat sebagai latihan,
          tanpa uang sungguhan dan tanpa kunci API.
        </p>
      </Card>

      <section className="space-y-3" aria-labelledby="pengaturan-penting">
        <SectionTitle
          title="Penting"
          hint="Empat angka ini yang paling menentukan seberapa besar risiko kamu per hari."
        />
        <div className="grid grid-cols-3 gap-2.5">
          <StatTile label="Modal latihan" value={fmtPrice(budgetCents)} />
          <StatTile label="Rugi / trade" value={fmtPrice(maxLossCents)} />
          <StatTile
            label="Rugi maks / hari"
            value={fmtPrice(maxDailyRisk)}
            tone={maxDailyRisk > 0 ? "warning" : "default"}
            hint={`dari batas ${fmtPrice(dailyLimitCents)}`}
          />
        </div>

        <Card className="space-y-4 p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldMoney
              id="settings-budget"
              label="Modal latihan ($)"
              hint="Contoh: 5000 berarti akun latihan $5,000."
              placeholder="5000.00"
              value={form.budget}
              error={errors.budget}
              onChange={(value) => update("budget", value)}
            />
            <FieldMoney
              id="settings-max-loss"
              label="Batas rugi per trade ($)"
              hint="Contoh: 50 berarti satu trade boleh rugi sampai $50."
              placeholder="50.00"
              value={form.maxLossPerTrade}
              error={errors.maxLossPerTrade}
              onChange={(value) => update("maxLossPerTrade", value)}
            />
            <Field
              label="Trade maksimal per hari"
              htmlFor="settings-max-trades"
              error={errors.maxTradesPerDay}
              hint="Contoh: 3 berarti maksimal 3 trade per hari."
            >
              <Input
                id="settings-max-trades"
                value={form.maxTradesPerDay}
                onChange={(event) => update("maxTradesPerDay", event.target.value)}
                inputMode="numeric"
                autoComplete="off"
              />
            </Field>
            <Field
              label="Jam keluar"
              htmlFor="settings-flat-by"
              error={errors.flatBy}
              hint="Semua posisi ditutup pukul ini. Contoh: 15:55 ET."
            >
              <Input
                id="settings-flat-by"
                type="time"
                value={form.flatBy}
                onChange={(event) => update("flatBy", event.target.value)}
              />
            </Field>
          </div>

          <div className="space-y-2 rounded-2xl bg-surface/50 px-3.5 py-3">
            <p className="text-[12.5px] font-semibold">Jam masuk (waktu New York/ET)</p>
            <p className="text-[11.5px] leading-relaxed text-muted-foreground">
              Order baru hanya boleh diisi di antara dua jam ini. Contoh: 09:45–15:30 ET.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mulai" htmlFor="settings-entry-from" error={errors.entryFrom}>
                <Input
                  id="settings-entry-from"
                  type="time"
                  value={form.entryFrom}
                  onChange={(event) => update("entryFrom", event.target.value)}
                />
              </Field>
              <Field label="Selesai" htmlFor="settings-entry-to" error={errors.entryTo}>
                <Input
                  id="settings-entry-to"
                  type="time"
                  value={form.entryTo}
                  onChange={(event) => update("entryTo", event.target.value)}
                />
              </Field>
            </div>
          </div>

          <p className="rounded-2xl bg-surface/70 px-3.5 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
            Dengan pengaturan ini, kerugian maksimum per hari dibatasi{" "}
            <span className="font-semibold text-foreground">{fmtPrice(maxDailyRisk)}</span> — ambil
            yang lebih kecil antara batas rugi harian ({fmtPrice(dailyLimitCents)}) dan{" "}
            {maxTrades} trade × {fmtPrice(maxLossCents)}. Imbalan : risiko minimal {fmtR(minRr)}{" "}
            (2R = untung 2 kali kerugian).
          </p>
        </Card>
      </section>

      <Disclosure
        title="Lanjutan"
        hint="Ukuran posisi, nilai order, kas disisakan, batas harian, R:R, daftar saham"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldMoney
              id="settings-max-position"
              label="Ukuran posisi maksimal ($)"
              hint="Contoh: 2000 berarti nilai satu posisi maksimal $2,000."
              placeholder="2000.00"
              value={form.maxPosition}
              error={errors.maxPosition}
              onChange={(value) => update("maxPosition", value)}
            />
            <FieldMoney
              id="settings-max-order"
              label="Nilai order maksimal ($)"
              hint="Contoh: 1500 berarti satu order maksimal $1,500."
              placeholder="1500.00"
              value={form.maxOrder}
              error={errors.maxOrder}
              onChange={(value) => update("maxOrder", value)}
            />
            <FieldMoney
              id="settings-cash-buffer"
              label="Kas yang disisakan ($)"
              hint="Contoh: 500 berarti kas $500 tidak boleh dipakai."
              placeholder="500.00"
              value={form.cashBuffer}
              error={errors.cashBuffer}
              onChange={(value) => update("cashBuffer", value)}
            />
            <FieldMoney
              id="settings-daily-loss"
              label="Batas rugi harian ($)"
              hint="Berhenti trading kalau rugi hari ini mencapai angka ini."
              placeholder="150.00"
              value={form.dailyLossLimit}
              error={errors.dailyLossLimit}
              onChange={(value) => update("dailyLossLimit", value)}
            />
            <Field
              label="Imbalan : risiko minimal"
              htmlFor="settings-min-rr"
              error={errors.minRewardRisk}
              hint="Contoh: 1,5 berarti target minimal 1,5 kali kerugian (1,5R)."
            >
              <Input
                id="settings-min-rr"
                value={form.minRewardRisk}
                onChange={(event) => update("minRewardRisk", event.target.value)}
                inputMode="decimal"
                autoComplete="off"
              />
            </Field>
            <Field
              label="Daftar saham untuk pemindai"
              htmlFor="settings-universe"
              hint={`Dipakai saat mencari setup. Sekarang: ${universeLabel(form.universe)}.`}
            >
              <Select
                id="settings-universe"
                value={form.universe}
                onChange={(event) =>
                  update("universe", event.target.value === "mega" ? "mega" : "sp100")
                }
              >
                <option value="sp100">{universeLabel("sp100")}</option>
                <option value="mega">{universeLabel("mega")}</option>
              </Select>
            </Field>
          </div>
        </div>
      </Disclosure>

      <div className="flex items-center gap-2">
        <Button size="lg" className="w-full" onClick={save} disabled={saving}>
          {saving ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-4" aria-hidden="true" />
          )}
          {saving ? "Menyimpan..." : "Simpan pengaturan"}
        </Button>
      </div>

      <p className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
        Pengaturan ini dipakai saat menghitung rencana dan menolak order yang melewati batas.
        Mengubahnya tidak mengubah order yang sudah tercatat.
      </p>

      <DataHint />
    </div>
  );
}
