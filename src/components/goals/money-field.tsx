"use client";

import * as React from "react";
import { formatAmountTyping } from "@/components/ui/amount-input";
import { Input } from "@/components/ui/input";
import { currencyMeta, parseAmountToMinor } from "@/lib/money";

/**
 * Input nominal ringkas dengan pemisah ribuan otomatis (mengikuti mata uang
 * pengguna). Cocok untuk nominal sekunder di dalam form, bukan input besar.
 */
export function MoneyField({
  id,
  currency,
  initialMinor,
  onChange,
  invalid,
  placeholder,
}: {
  id: string;
  currency: string;
  initialMinor?: number | null;
  onChange: (minor: number | null) => void;
  invalid?: boolean;
  placeholder?: string;
}) {
  const meta = currencyMeta(currency);
  const [text, setText] = React.useState(() =>
    initialMinor && initialMinor > 0
      ? formatAmountTyping(String(initialMinor / 10 ** meta.decimals), currency)
      : "",
  );

  return (
    <Input
      id={id}
      inputMode={meta.decimals > 0 ? "decimal" : "numeric"}
      autoComplete="off"
      value={text}
      placeholder={placeholder ?? "0"}
      aria-invalid={invalid || undefined}
      onChange={(event) => {
        const next = formatAmountTyping(event.target.value, currency);
        setText(next);
        onChange(parseAmountToMinor(next, currency));
      }}
      className="money"
    />
  );
}
