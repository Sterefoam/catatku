"use client";

import * as React from "react";
import { currencyMeta, parseAmountToMinor } from "@/lib/money";
import { cn } from "@/lib/utils";

function separatorsFor(locale: string): { group: string; decimal: string } {
  const parts = new Intl.NumberFormat(locale).formatToParts(1234.5);
  return {
    group: parts.find((part) => part.type === "group")?.value ?? ",",
    decimal: parts.find((part) => part.type === "decimal")?.value ?? ".",
  };
}

function groupDigits(digits: string, group: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, group);
}

/** Format angka saat diketik: pemisah ribuan mengikuti mata uang. */
export function formatAmountTyping(raw: string, currency?: string | null): string {
  const meta = currencyMeta(currency);
  const { group, decimal } = separatorsFor(meta.locale);
  const cleaned = raw.replace(/[^\d.,]/g, "");

  if (meta.decimals === 0) {
    const digits = cleaned.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
    return digits ? groupDigits(digits, group) : "";
  }

  const normalized = cleaned.replaceAll(group, "").replaceAll(",", ".");
  const dotIndex = normalized.indexOf(".");
  let intDigits =
    dotIndex >= 0 ? normalized.slice(0, dotIndex).replace(/\D/g, "") : normalized.replace(/\D/g, "");
  const decDigits =
    dotIndex >= 0
      ? normalized.slice(dotIndex + 1).replace(/\D/g, "").slice(0, meta.decimals)
      : "";
  intDigits = intDigits.replace(/^0+(?=\d)/, "");

  const formattedInt = intDigits
    ? groupDigits(intDigits, group)
    : dotIndex >= 0
      ? "0"
      : "";

  return dotIndex >= 0 ? `${formattedInt}${decimal}${decDigits}` : formattedInt;
}

interface AmountInputProps {
  currency?: string | null;
  initialMinor?: number | null;
  onChange: (minor: number | null) => void;
  invalid?: boolean;
  autoFocus?: boolean;
  id?: string;
  onEnter?: () => void;
}

/**
 * Input nominal besar dengan simbol mata uang dan pemisah ribuan otomatis.
 */
export function AmountInput({
  currency,
  initialMinor,
  onChange,
  invalid,
  autoFocus,
  id = "amount",
  onEnter,
}: AmountInputProps) {
  const meta = currencyMeta(currency);
  const [text, setText] = React.useState(() =>
    initialMinor && initialMinor > 0
      ? formatAmountTyping(String(initialMinor / 10 ** meta.decimals), currency)
      : "",
  );
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div
      className={cn(
        "flex items-baseline gap-2 rounded-2xl border border-transparent px-1 py-1 transition-colors",
        invalid && "border-danger/40 bg-danger-soft/40",
      )}
    >
      <span className="text-xl font-semibold text-muted-foreground sm:text-2xl">
        {meta.symbol}
      </span>
      <input
        ref={inputRef}
        id={id}
        inputMode={meta.decimals > 0 ? "decimal" : "numeric"}
        autoComplete="off"
        autoFocus={autoFocus}
        aria-label="Nominal"
        aria-invalid={invalid || undefined}
        placeholder="0"
        value={text}
        onChange={(event) => {
          const next = formatAmountTyping(event.target.value, currency);
          setText(next);
          onChange(parseAmountToMinor(next, currency));
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && onEnter) {
            event.preventDefault();
            onEnter();
          }
        }}
        className="money w-full min-w-0 bg-transparent text-[34px] font-bold leading-tight tracking-tight text-foreground outline-none placeholder:text-muted-foreground/40 sm:text-[38px]"
      />
    </div>
  );
}
