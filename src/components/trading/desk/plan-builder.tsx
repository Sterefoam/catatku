"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Calculator,
  Crosshair,
  Loader2,
  Save,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import {
  DataHint,
  Disclosure,
  RiskCheckList,
  SectionTitle,
  StatTile,
} from "@/components/trading/ui";
import { ApiClientError, apiErrorMessage, apiGet, apiPost } from "@/lib/client-api";
import { fmtDate, fmtPct, fmtPrice, fmtQty, fmtR } from "@/lib/trading/format";
import type {
  MarketStatus,
  PlanPreview,
  SetupType,
  StopRule,
  TradePlanDTO,
  TradingSettings,
  TriggerState,
  TriggerStatus,
} from "@/lib/trading/types";
import { cn } from "@/lib/utils";
import { TimeMachinePanel } from "./time-machine-panel";
import {
  ADVANCED_STOP_OPTIONS,
  centsToPriceInput,
  humaniseCheck,
  humaniseRiskDetail,
  humaniseStopRuleLabel,
  humaniseTargetRuleLabel,
  parseDecimalInput,
  parsePriceInput,
  rMultipleText,
  SETUP_TYPE_HINTS,
  SETUP_TYPE_LABELS,
  SETUP_TYPE_OPTIONS,
  SIZE_LIMIT_LABELS,
  SYMBOL_PATTERN,
  encodeStopParam,
  normaliseSymbol,
  type PlanDraftBody,
} from "./desk-shared";

type QuickStop = "1" | "1.5" | "2" | "or-mid";
type StopPreset = QuickStop | "custom";
type QuickTarget = "1R" | "1.5R" | "2R";
type CustomStopRule = "pct" | "atr" | "price";

const QUICK_STOPS: { value: QuickStop; label: string; hint: string }[] = [
  { value: "1", label: "1%", hint: "di bawah harga masuk" },
  { value: "1.5", label: "1,5%", hint: "di bawah harga masuk" },
  { value: "2", label: "2%", hint: "di bawah harga masuk" },
  { value: "or-mid", label: "Rentang awal", hint: "titik tengah 15 menit" },
];

const QUICK_TARGETS: { value: QuickTarget; label: string }[] = [
  { value: "1R", label: "1R" },
  { value: "1.5R", label: "1,5R" },
  { value: "2R", label: "2R" },
];

interface PlanFormState {
  symbol: string;
  entryTrigger: string;
  stopPreset: StopPreset;
  customStopRule: CustomStopRule;
  stopPct: string;
  stopAtr: string;
  stopPrice: string;
  targetRule: QuickTarget;
  targetPrice: string;
  setupType: SetupType;
  note: string;
}

type Built =
  | { body: PlanDraftBody; error: null }
  | { body: null; error: string };

/** "2R"/"1,5R"/"1R" dari label server; null bila target memakai harga sendiri. */
function quickTargetFromPlanLabel(label: string): QuickTarget | null {
  const mapped = humaniseTargetRuleLabel(label);
  if (mapped.startsWith("1,5R")) return "1.5R";
  if (mapped.startsWith("1R")) return "1R";
  if (mapped.startsWith("2R")) return "2R";
  return null;
}

/** Salin aturan batas rugi dari rencana lama sedekat mungkin. */
function stopStateFromPlan(
  plan: TradePlanDTO,
): Pick<PlanFormState, "stopPreset" | "customStopRule" | "stopPct" | "stopPrice"> {
  const label = humaniseStopRuleLabel(plan.stopRuleLabel);
  if (label.startsWith("Titik tengah")) {
    return { stopPreset: "or-mid", customStopRule: "pct", stopPct: "1,5", stopPrice: "" };
  }
  if (/% di bawah harga masuk/.test(label) && plan.entry > 0) {
    const pct = Math.round(((plan.entry - plan.stop) / plan.entry) * 10000) / 100;
    if (Math.floor(plan.entry - (plan.entry * pct) / 100) === plan.stop) {
      return {
        stopPreset: "custom",
        customStopRule: "pct",
        stopPct: String(pct).replace(".", ","),
        stopPrice: "",
      };
    }
  }
  return {
    stopPreset: "custom",
    customStopRule: "price",
    stopPct: "1,5",
    stopPrice: centsToPriceInput(plan.stop),
  };
}

function initialFormState(
  initialSymbol: string,
  initialSetupType: SetupType,
  plan?: TradePlanDTO | null,
): PlanFormState {
  const base: PlanFormState = {
    symbol: initialSymbol,
    setupType: initialSetupType,
    entryTrigger: "",
    stopPreset: "1.5",
    customStopRule: "pct",
    stopPct: "1,5",
    stopAtr: "1,5",
    stopPrice: "",
    targetRule: "2R",
    targetPrice: "",
    note: "",
  };
  if (!plan) return base;
  const target = quickTargetFromPlanLabel(plan.targetRuleLabel);
  return {
    ...base,
    symbol: plan.symbol,
    setupType: plan.setupType,
    entryTrigger: centsToPriceInput(plan.entry),
    ...stopStateFromPlan(plan),
    targetRule: target ?? "2R",
    targetPrice: target ? "" : centsToPriceInput(plan.target),
    note: plan.note ?? "",
  };
}

const TRIGGER_PRESENTATION: Record<
  TriggerStatus,
  { label: string; tone: "success" | "warning" | "neutral" | "danger" }
> = {
  waiting: { label: "Harga masuk belum tersentuh", tone: "warning" },
  triggered: { label: "Harga masuk tersentuh", tone: "success" },
  expired: { label: "Kedaluwarsa", tone: "neutral" },
  "not-open": { label: "Pasar belum buka", tone: "neutral" },
  "no-data": { label: "Data belum tersedia", tone: "danger" },
};

function ChoiceChip({
  active,
  label,
  hint,
  onClick,
}: {
  active: boolean;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex min-h-11 flex-col items-start justify-center rounded-2xl border px-3 py-2 text-left transition-colors",
        active
          ? "border-primary bg-primary-soft text-primary"
          : "border-border/80 bg-surface/40 text-foreground hover:border-primary/40",
      )}
    >
      <span className="text-[13px] font-semibold leading-tight">{label}</span>
      {hint ? (
        <span
          className={cn(
            "text-[10.5px] leading-tight",
            active ? "text-primary/80" : "text-muted-foreground",
          )}
        >
          {hint}
        </span>
      ) : null}
    </button>
  );
}

/**
 * Form susun rencana sederhana: kode saham, harga masuk, batas rugi cepat,
 * target untung cepat → Hitung rencana → ringkasan bahasa manusia → simpan.
 * Aturan sendiri & uji peluang dilipat di "Aturan lanjutan".
 */
export function PlanBuilder({
  initialSymbol,
  initialSetupType,
  settings,
  market,
  existingPlan = null,
}: {
  initialSymbol: string;
  initialSetupType: SetupType;
  settings: TradingSettings;
  market: MarketStatus;
  existingPlan?: TradePlanDTO | null;
}) {
  const router = useRouter();
  const [form, setForm] = React.useState<PlanFormState>(() =>
    initialFormState(initialSymbol, initialSetupType, existingPlan),
  );
  const [trigger, setTrigger] = React.useState<TriggerState | null>(null);
  const [triggerError, setTriggerError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<PlanPreview | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [checking, setChecking] = React.useState(false);
  const [calculating, setCalculating] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  function update<K extends keyof PlanFormState>(key: K, value: PlanFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setPreview(null);
    setTrigger(null);
    setTriggerError(null);
    setFormError(null);
  }

  function chooseQuickStop(value: QuickStop) {
    update("stopPreset", value);
  }

  function chooseCustomStopRule(value: CustomStopRule) {
    setForm((current) => ({ ...current, customStopRule: value, stopPreset: "custom" }));
    setPreview(null);
    setTrigger(null);
    setTriggerError(null);
    setFormError(null);
  }

  function chooseQuickTarget(value: QuickTarget) {
    setForm((current) => ({ ...current, targetRule: value, targetPrice: "" }));
    setPreview(null);
    setTrigger(null);
    setTriggerError(null);
    setFormError(null);
  }

  function buildBody(): Built {
    const symbol = normaliseSymbol(form.symbol);
    if (!symbol) return { body: null, error: "Kode saham wajib diisi. Contoh: TSLA." };
    if (!SYMBOL_PATTERN.test(symbol)) {
      return { body: null, error: "Kode saham tidak valid. Contoh: TSLA, NVDA, BRK.B." };
    }
    const entryTrigger = parsePriceInput(form.entryTrigger);
    if (!entryTrigger) {
      return { body: null, error: "Harga masuk belum diisi dengan benar (dalam $)." };
    }

    let stopRule: StopRule = "pct";
    let stopPrice: number | null = null;

    if (form.stopPreset === "or-mid") {
      stopRule = "or-mid";
    } else if (form.stopPreset === "custom") {
      stopRule = form.customStopRule;
      if (stopRule === "price") {
        stopPrice = parsePriceInput(form.stopPrice);
        if (!stopPrice) {
          return { body: null, error: "Harga batas rugi sendiri belum diisi (dalam $)." };
        }
      } else if (stopRule === "pct") {
        const pct = parseDecimalInput(form.stopPct);
        if (pct === null || pct <= 0 || pct >= 50) {
          return { body: null, error: "Persen batas rugi harus di antara 0 dan 50." };
        }
        stopPrice = encodeStopParam(pct);
      } else {
        const multiple = parseDecimalInput(form.stopAtr);
        if (multiple === null || multiple <= 0 || multiple > 10) {
          return { body: null, error: "Kelipatan ayunan harga harus di antara 0 dan 10." };
        }
        stopPrice = encodeStopParam(multiple);
      }
    } else {
      stopRule = "pct";
      stopPrice = encodeStopParam(Number(form.stopPreset));
    }

    let targetPrice: number | null = null;
    if (form.targetPrice.trim()) {
      const parsed = parsePriceInput(form.targetPrice);
      if (!parsed) {
        return { body: null, error: "Harga target sendiri belum benar (dalam $)." };
      }
      targetPrice = parsed;
    }
    const targetRuleValue = targetPrice !== null ? "price" : form.targetRule;

    return {
      body: {
        symbol,
        setupType: form.setupType,
        entryTrigger,
        stopRule,
        stopPrice,
        targetRule: targetRuleValue,
        targetPrice,
        orHigh: null,
        orLow: null,
        orMinutes: 15,
        flatBy: settings.flatBy,
        note: form.note.trim() ? form.note.trim() : null,
      },
      error: null,
    };
  }

  async function handleCheckPrice() {
    const built = buildBody();
    if (!built.body) {
      toast.error(built.error);
      return;
    }
    setChecking(true);
    setTriggerError(null);
    try {
      const setupParam = form.setupType === "orb" ? "orb" : "level";
      const params = new URLSearchParams({
        symbol: built.body.symbol,
        setup: setupParam,
        minutes: "15",
      });
      if (setupParam === "level") params.set("level", String(built.body.entryTrigger));
      const data = await apiGet<{ trigger: TriggerState }>(
        `/api/trading/entry?${params.toString()}`,
      );
      setTrigger(data.trigger);
    } catch (error) {
      setTrigger(null);
      setTriggerError(apiErrorMessage(error));
    } finally {
      setChecking(false);
    }
  }

  async function handlePreview() {
    const built = buildBody();
    if (!built.body) {
      toast.error(built.error);
      return;
    }
    setCalculating(true);
    setFormError(null);
    try {
      const data = await apiPost<{ preview: PlanPreview }>(
        "/api/trading/plans/preview",
        built.body,
      );
      setPreview(data.preview);
      if (data.preview.ok) {
        toast.success("Rencana dihitung. Cek ringkasan di bawah, lalu simpan.");
      } else {
        toast.error(
          data.preview.errors[0] ?? "Ada aturan yang belum lolos. Cek daftar cek aturan.",
        );
      }
    } catch (error) {
      setPreview(null);
      setFormError(apiErrorMessage(error));
      toast.error(apiErrorMessage(error));
    } finally {
      setCalculating(false);
    }
  }

  async function handleSave() {
    if (!preview || !preview.ok) return;
    const built = buildBody();
    if (!built.body) {
      toast.error(built.error);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await apiPost("/api/trading/plans", built.body);
      toast.success("Rencana tersimpan. Buat order latihan dari daftar di bawah.");
      setPreview(null);
      router.refresh();
    } catch (error) {
      const message =
        error instanceof ApiClientError && error.details
          ? `${apiErrorMessage(error)} ${Object.values(error.details)[0] ?? ""}`.trim()
          : apiErrorMessage(error);
      setFormError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const checks = preview ? preview.checks.map(humaniseCheck) : [];
  const passedChecks = checks.filter((check) => check.status === "pass").length;
  const failedChecks = checks.filter((check) => check.status === "fail").length;
  const riskyChecks = checks.filter((check) => check.status === "warn").length;
  const customStopLabel = humaniseStopRuleLabel(form.customStopRule);

  return (
    <div className="space-y-5">
      <Card className="space-y-4 p-4 sm:p-5">
        <SectionTitle
          title="Buat rencana"
          hint={market.detail}
          action={<Badge tone="primary">Latihan</Badge>}
        />

        {existingPlan ? (
          <p className="rounded-2xl bg-primary-soft/60 px-3.5 py-2.5 text-[12px] leading-relaxed text-primary">
            Isian disalin dari rencana aktif {existingPlan.symbol} (
            {fmtDate(existingPlan.createdAt)}). Menyimpan akan membuat rencana baru — rencana lama
            tidak berubah.
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Kode saham" htmlFor="plan-symbol" hint="Contoh: TSLA.">
            <Input
              id="plan-symbol"
              value={form.symbol}
              onChange={(event) => update("symbol", event.target.value.toUpperCase())}
              placeholder="TSLA"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={10}
            />
          </Field>
          <Field
            label="Harga masuk ($)"
            htmlFor="plan-entry"
            hint="Harga yang harus ditembus."
          >
            <Input
              id="plan-entry"
              value={form.entryTrigger}
              onChange={(event) => update("entryTrigger", event.target.value)}
              placeholder="400.00"
              inputMode="decimal"
              autoComplete="off"
            />
          </Field>
        </div>

        <div className="space-y-1.5">
          <p className="text-[13px] font-semibold">Batas rugi (stop)</p>
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            Kalau harga turun sampai sini, posisi ditutup otomatis. Pilih cepat:
          </p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_STOPS.map((option) => (
              <ChoiceChip
                key={option.value}
                active={form.stopPreset === option.value}
                label={option.label}
                hint={option.hint}
                onClick={() => chooseQuickStop(option.value)}
              />
            ))}
          </div>
          {form.stopPreset === "custom" ? (
            <p className="text-[11.5px] text-primary">
              Memakai aturan lanjutan: {customStopLabel}.{" "}
              <button
                type="button"
                className="font-semibold underline"
                onClick={() => chooseQuickStop("1.5")}
              >
                Kembali ke 1,5%
              </button>
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              &ldquo;Rentang awal&rdquo; = titik tengah 15 menit pertama sesi (09.30–09.45 ET).
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <p className="text-[13px] font-semibold">Target untung</p>
          <Segmented<QuickTarget>
            value={form.targetRule}
            onChange={chooseQuickTarget}
            options={QUICK_TARGETS}
            ariaLabel="Target untung"
          />
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            2R = untung 2 kali kerugian. 1R = untung sama besar dengan kerugian.
            {form.targetPrice.trim()
              ? " Saat ini memakai harga target sendiri (atur di Aturan lanjutan)."
              : ""}
          </p>
        </div>

        {formError ? (
          <p className="rounded-2xl bg-danger-soft/60 px-3.5 py-2.5 text-[12.5px] font-medium text-danger">
            {formError}
          </p>
        ) : null}

        <Button
          size="lg"
          className="w-full"
          onClick={handlePreview}
          disabled={calculating || checking}
        >
          {calculating ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Calculator className="size-4" aria-hidden="true" />
          )}
          {calculating ? "Menghitung..." : "Hitung rencana"}
        </Button>

        <p className="text-[11.5px] leading-relaxed text-muted-foreground">
          Batas rugi maksimal per trade {fmtPrice(settings.maxLossPerTrade)} · jumlah trade
          maksimal {settings.maxTradesPerDay}/hari · jam keluar {settings.flatBy} ET.
        </p>
      </Card>

      <Disclosure
        title="Aturan lanjutan"
        hint="Jenis setup, batas rugi sendiri, target sendiri, catatan, cek harga"
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-[13px] font-semibold">Jenis setup</p>
            <Segmented<SetupType>
              value={form.setupType}
              onChange={(value) => update("setupType", value)}
              options={SETUP_TYPE_OPTIONS}
              ariaLabel="Jenis setup"
            />
            <p className="text-[11.5px] leading-relaxed text-muted-foreground">
              {SETUP_TYPE_HINTS[form.setupType]}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <Field
              label="Batas rugi sendiri"
              htmlFor="plan-stop-rule"
              hint="Pilih aturan ini kalau pilihan cepat di atas belum cocok."
            >
              <Select
                id="plan-stop-rule"
                value={form.stopPreset === "custom" ? form.customStopRule : ""}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === "pct" || value === "atr" || value === "price") {
                    chooseCustomStopRule(value);
                  }
                }}
              >
                <option value="">— ikut pilihan cepat di atas —</option>
                {ADVANCED_STOP_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            {form.stopPreset !== "custom" ? (
              <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                Saat ini memakai pilihan cepat batas rugi di atas. Pilih salah satu aturan di sini
                untuk menggantinya.
              </p>
            ) : form.customStopRule === "price" ? (
              <Field
                label="Harga batas rugi ($)"
                htmlFor="plan-stop-price"
                hint="Contoh: 394.05. Harus di bawah harga masuk."
              >
                <Input
                  id="plan-stop-price"
                  value={form.stopPrice}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      stopPrice: event.target.value,
                      stopPreset: "custom",
                    }))
                  }
                  placeholder="394.05"
                  inputMode="decimal"
                  autoComplete="off"
                />
              </Field>
            ) : form.customStopRule === "pct" ? (
              <Field
                label="Batas rugi di bawah harga masuk (%)"
                htmlFor="plan-stop-pct"
                hint="Contoh: 1,75 berarti 1,75% di bawah harga masuk."
              >
                <Input
                  id="plan-stop-pct"
                  value={form.stopPct}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      stopPct: event.target.value,
                      stopPreset: "custom",
                    }))
                  }
                  placeholder="1,5"
                  inputMode="decimal"
                  autoComplete="off"
                />
              </Field>
            ) : (
              <Field
                label="Kelipatan ayunan harga (ATR)"
                htmlFor="plan-stop-atr"
                hint="Contoh: 1,5 berarti 1,5 kali ayunan harga 14 hari."
              >
                <Input
                  id="plan-stop-atr"
                  value={form.stopAtr}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      stopAtr: event.target.value,
                      stopPreset: "custom",
                    }))
                  }
                  placeholder="1,5"
                  inputMode="decimal"
                  autoComplete="off"
                />
              </Field>
            )}

            <Field
              label="Target untung sendiri ($, opsional)"
              htmlFor="plan-target-price"
              hint="Contoh: 420. Kosongkan untuk memakai pilihan cepat 1R–2R."
            >
              <Input
                id="plan-target-price"
                value={form.targetPrice}
                onChange={(event) => update("targetPrice", event.target.value)}
                placeholder="Kosongkan = ikut 1R/1,5R/2R"
                inputMode="decimal"
                autoComplete="off"
              />
            </Field>

            <Field
              label="Catatan (opsional)"
              htmlFor="plan-note"
              hint="Alasan masuk atau catatan disiplin."
            >
              <Textarea
                id="plan-note"
                value={form.note}
                onChange={(event) => update("note", event.target.value)}
                placeholder="mis. Tembus rentang dengan volume, keluar bila gagal bertahan."
                maxLength={400}
              />
            </Field>
          </div>

          <Button
            size="lg"
            variant="outline"
            className="w-full"
            onClick={handleCheckPrice}
            disabled={checking || calculating}
          >
            {checking ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Crosshair className="size-4" aria-hidden="true" />
            )}
            {checking ? "Mengecek..." : "Cek harga sekarang"}
          </Button>

          {trigger ? (
            <div className="space-y-3 rounded-2xl border border-border/70 bg-surface/40 p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Cek harga
                  </p>
                  <h2 className="mt-0.5 text-[15px] font-bold">
                    {trigger.symbol} · {trigger.last ? fmtPrice(trigger.last) : "—"}
                  </h2>
                </div>
                <Badge tone={TRIGGER_PRESENTATION[trigger.status].tone}>
                  {TRIGGER_PRESENTATION[trigger.status].label}
                </Badge>
              </div>
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                {humaniseRiskDetail(trigger.message)}
              </p>
              <div className="grid grid-cols-3 gap-2">
                <StatTile
                  label="Harga masuk"
                  value={trigger.level ? fmtPrice(trigger.level) : "—"}
                />
                <StatTile
                  label="Harga terakhir"
                  value={trigger.last ? fmtPrice(trigger.last) : "—"}
                />
                <StatTile
                  label="Jarak"
                  value={trigger.distancePct === null ? "—" : fmtPct(trigger.distancePct)}
                />
              </div>
              {trigger.openingRange ? (
                <p className="text-[11.5px] text-muted-foreground">
                  Rentang awal {trigger.openingRange.minutes} menit:{" "}
                  {fmtPrice(trigger.openingRange.low)}–{fmtPrice(trigger.openingRange.high)}
                  {trigger.openingRange.complete ? "" : " (belum lengkap)"}.
                </p>
              ) : null}
              {trigger.barTime ? (
                <p className="text-[11.5px] text-muted-foreground">
                  Waktu sentuhan: {trigger.barTime}
                </p>
              ) : null}
            </div>
          ) : triggerError ? (
            <p className="rounded-2xl border border-dashed border-border bg-card/60 px-4 py-3 text-[12.5px] text-muted-foreground">
              Cek harga belum bisa dijalankan: {triggerError}
            </p>
          ) : null}
        </div>
      </Disclosure>

      {preview ? (
        <Card className="space-y-4 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Ringkasan rencana
              </p>
              <h2 className="mt-0.5 text-[16px] font-bold">
                {preview.symbol} · {SETUP_TYPE_LABELS[preview.setupType]}
              </h2>
            </div>
            <Badge tone={preview.ok ? "success" : "danger"}>
              {preview.ok ? "Siap disimpan" : "Belum bisa disimpan"}
            </Badge>
          </div>

          {preview.size.qty > 0 ? (
            <div className="space-y-2 rounded-2xl bg-surface/50 px-3.5 py-3">
              <p className="text-[14px] font-semibold leading-relaxed">
                Kalau kena batas rugi, kamu kehilangan{" "}
                <span className="text-danger">{fmtPrice(preview.size.riskAmount)}</span>{" "}
                <span className="font-normal text-muted-foreground">
                  ({fmtQty(preview.size.qty)} lembar × {fmtPrice(preview.riskPerShare)})
                </span>
                .
              </p>
              <p className="text-[13px] leading-relaxed">
                Kalau kena target, untung{" "}
                <span className="font-semibold text-success">
                  {fmtPrice(preview.rewardPerShare * preview.size.qty)}
                </span>{" "}
                — <span className="font-semibold">{fmtR(preview.rewardRisk)}</span>{" "}
                <span className="text-muted-foreground">
                  ({rMultipleText(preview.rewardRisk)})
                </span>
                .
              </p>
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                Jumlah lembar {fmtQty(preview.size.qty)} dengan nilai beli{" "}
                {fmtPrice(preview.size.notional)}. Sisa kas setelah order{" "}
                {fmtPrice(preview.size.cashAfter)}.
              </p>
            </div>
          ) : (
            <p className="rounded-2xl bg-warning-soft/60 px-3.5 py-2.5 text-[12.5px] leading-relaxed">
              Belum ada jumlah lembar yang muat dengan batas rugi sekarang. Rapatkan batas rugi
              atau kecilkan batas rugi per trade.
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <StatTile
              label="Harga masuk"
              value={fmtPrice(preview.entry)}
              hint={humaniseStopRuleLabel(preview.stopRuleLabel)}
            />
            <StatTile
              label="Batas rugi (stop)"
              value={fmtPrice(preview.stop)}
              tone="danger"
              hint={`rugi ${fmtPrice(preview.riskPerShare)}/lembar`}
            />
            <StatTile
              label="Target untung"
              value={fmtPrice(preview.target)}
              tone="success"
              hint={humaniseTargetRuleLabel(preview.targetRuleLabel)}
            />
            <StatTile
              label="Jumlah lembar"
              value={`${fmtQty(preview.size.qty)} lbr`}
              hint={SIZE_LIMIT_LABELS[preview.size.limitedBy]}
            />
            <StatTile
              label="Imbalan : risiko"
              value={fmtR(preview.rewardRisk)}
              hint="2R = untung 2 kali kerugian"
            />
            <StatTile
              label="Jam keluar"
              value={`${preview.flatBy} ET`}
              hint="semua posisi ditutup"
            />
          </div>

          <Disclosure
            title="Cek aturan"
            hint={
              failedChecks > 0
                ? `${passedChecks} lolos · ${failedChecks} perlu diperbaiki`
                : riskyChecks > 0
                  ? `${passedChecks} lolos · ${riskyChecks} catatan`
                  : `${passedChecks} aturan lolos semua`
            }
            defaultOpen={!preview.ok}
          >
            <div className="space-y-2">
              <RiskCheckList checks={checks} />
              {preview.rewardRisk > 0 ? (
                <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                  {fmtR(preview.rewardRisk)} artinya {rMultipleText(preview.rewardRisk)} dibanding
                  risikonya: risiko {fmtPrice(preview.riskPerShare)}/lembar untuk mengejar untung{" "}
                  {fmtPrice(preview.rewardPerShare)}/lembar.
                </p>
              ) : null}
            </div>
          </Disclosure>

          {preview.errors.length ? (
            <div className="space-y-1 rounded-2xl bg-danger-soft/60 px-3.5 py-2.5">
              {preview.errors.map((message) => (
                <p key={message} className="text-[12.5px] font-medium text-danger">
                  {humaniseRiskDetail(message)}
                </p>
              ))}
            </div>
          ) : null}

          <Button
            size="lg"
            className="w-full"
            onClick={handleSave}
            disabled={!preview.ok || saving}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="size-4" aria-hidden="true" />
            )}
            {saving ? "Menyimpan..." : "Simpan rencana"}
          </Button>
          {!preview.ok ? (
            <p className="text-[11.5px] text-muted-foreground">
              Perbaiki aturan yang gagal dulu, lalu hitung ulang sebelum menyimpan.
            </p>
          ) : null}
        </Card>
      ) : null}

      {preview?.ok ? (
        <Disclosure
          title="Uji peluang (lanjutan)"
          hint="2.000 simulasi dari data 5 menit historis — bukan prediksi"
        >
          <TimeMachinePanel
            key={`${preview.symbol}-${preview.entry}-${preview.stop}-${preview.target}`}
            symbol={preview.symbol}
            entry={preview.entry}
            stop={preview.stop}
            target={preview.target}
          />
        </Disclosure>
      ) : null}

      <Card className="space-y-3 bg-muted/40 p-4 sm:p-5">
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold">
          <Sparkles className="size-4 text-primary" aria-hidden="true" />
          Cara pakai
        </p>
        <ol className="list-inside list-decimal space-y-1 text-[12px] leading-relaxed text-muted-foreground">
          <li>Isi kode saham dan harga masuk — harga yang harus ditembus untuk mulai.</li>
          <li>Pilih batas rugi cepat (1–2% atau rentang awal) dan target untung 1R–2R.</li>
          <li>
            Tekan {"\u201c"}Hitung rencana{"\u201d"}, baca ringkasan, lalu {"\u201c"}Simpan
            rencana{"\u201d"}.
          </li>
          <li>Buat order latihan dari daftar rencana di bawah. Semua uang kertas.</li>
        </ol>
        <p className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden="true" />
          Rencana yang rapi tidak menghilangkan risiko. Modul ini untuk latihan (uang kertas),
          bukan saran finansial.
        </p>
        <DataHint />
      </Card>
    </div>
  );
}
