"use client";

import * as React from "react";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { apiErrorMessage, apiPost } from "@/lib/client-api";
import { cn } from "@/lib/utils";

interface ImportResult {
  imported: number;
  skipped: number;
}

function resultMessage(result: ImportResult): string {
  if (result.imported > 0) {
    const skippedPart =
      result.skipped > 0 ? `, ${result.skipped} dilewati (duplikat/tidak valid)` : "";
    return `${result.imported} transaksi diimpor${skippedPart}.`;
  }
  if (result.skipped > 0) {
    return `Tidak ada transaksi baru; ${result.skipped} baris dilewati (duplikat/tidak valid).`;
  }
  return "Tidak ada transaksi yang bisa diimpor. Periksa format kolom CSV.";
}

/**
 * Seksi impor mutasi/e-Statement CSV: pilih file atau tempel isi CSV,
 * lalu kirim ke POST /api/inbox/import. Hasil impor ditampilkan di kartu.
 */
export function ImportStatementCard({ onImported }: { onImported: () => void }) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [csv, setCsv] = React.useState("");
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [importing, setImporting] = React.useState(false);
  const [result, setResult] = React.useState<ImportResult | null>(null);

  const lineCount = csv.trim() ? csv.trim().split(/\r?\n/).length : 0;

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setCsv(text);
      setFileName(file.name);
      setResult(null);
    };
    reader.onerror = () => {
      setFileName(null);
      toast.error("File gagal dibaca. Coba file CSV lain.");
    };
    reader.readAsText(file);
  }

  function handleCsvChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    setCsv(event.target.value);
    setFileName(null);
    setResult(null);
  }

  async function handleImport() {
    const payload = csv.trim();
    if (!payload) {
      toast.error("Pilih file CSV atau tempel isinya dulu.");
      return;
    }

    setImporting(true);
    try {
      const response = await apiPost<ImportResult>("/api/inbox/import", { csv: payload });
      setResult({ imported: response.imported, skipped: response.skipped });

      if (response.imported > 0) {
        toast.success(`${response.imported} transaksi masuk Kotak Masuk.`, {
          description:
            response.skipped > 0
              ? `${response.skipped} baris dilewati (duplikat/tidak valid).`
              : undefined,
        });
      } else {
        toast.info("Tidak ada transaksi baru yang diimpor.", {
          description:
            response.skipped > 0
              ? `${response.skipped} baris dilewati (duplikat/tidak valid).`
              : "Pastikan format kolom CSV sudah benar.",
        });
      }

      setCsv("");
      setFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onImported();
    } catch (error) {
      toast.error(apiErrorMessage(error) || "Impor mutasi gagal. Coba lagi.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <section aria-labelledby="inbox-import-heading" className="scroll-mt-4">
      <Card className="overflow-hidden">
        <div className="flex items-start gap-2.5 border-b border-border/60 bg-muted/30 px-4 py-3.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <FileSpreadsheet className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="inbox-import-heading" className="text-[14px] font-semibold leading-snug">
              Impor mutasi / e-Statement (CSV)
            </h2>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
              Unggah file CSV dari m-banking atau tempel isinya. Transaksi baru masuk sebagai
              tertunda supaya bisa kamu konfirmasi dulu.
            </p>
          </div>
        </div>

        <div className="space-y-3.5 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="inbox-csv-file">File CSV</Label>
            <Input
              ref={fileInputRef}
              id="inbox-csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              aria-describedby="inbox-csv-format"
              className="h-11 cursor-pointer px-2 py-0 text-[12.5px] file:mr-2.5 file:h-8 file:rounded-xl file:border-0 file:bg-primary-soft file:px-3 file:text-[12px] file:font-semibold file:text-primary"
            />
            {fileName ? (
              <p className="flex items-center gap-1 text-[11.5px] text-muted-foreground">
                <FileSpreadsheet className="size-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{fileName}</span>
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <span className="h-px flex-1 bg-border" aria-hidden="true" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              atau tempel CSV
            </span>
            <span className="h-px flex-1 bg-border" aria-hidden="true" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="inbox-csv-text">Teks CSV</Label>
            <Textarea
              id="inbox-csv-text"
              value={csv}
              onChange={handleCsvChange}
              spellCheck={false}
              placeholder={
                "tanggal,keterangan,nominal\n20/10/2026,Transfer masuk,1500000\n21/10/2026,Kopi Kenangan,-35000"
              }
              aria-describedby="inbox-csv-format"
              className="min-h-28 font-mono text-[12.5px] leading-relaxed"
            />
          </div>

          <div
            id="inbox-csv-format"
            className="rounded-xl border border-border/70 bg-muted/40 px-3 py-2.5 text-[11.5px] leading-relaxed text-muted-foreground"
          >
            Kolom yang didukung:{" "}
            <code className="font-semibold text-foreground">tanggal, keterangan, nominal</code>{" "}
            (nominal negatif otomatis dianggap pengeluaran), atau{" "}
            <code className="font-semibold text-foreground">tanggal, keterangan, debit, kredit</code>
            . Baris duplikat dan tidak valid dilewati otomatis.
          </div>

          {result ? (
            <div
              role="status"
              aria-live="polite"
              className={cn(
                "rounded-xl px-3.5 py-2.5 text-[12.5px] font-medium leading-relaxed",
                result.imported > 0 ? "bg-success-soft text-success" : "bg-muted text-foreground",
              )}
            >
              {resultMessage(result)}
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <Button
              onClick={handleImport}
              disabled={importing || lineCount === 0}
              aria-busy={importing || undefined}
              className="h-11 flex-1 px-4 sm:flex-none"
            >
              {importing ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Upload className="size-4" aria-hidden="true" />
              )}
              {importing ? "Mengimpor…" : "Impor mutasi"}
            </Button>
            {lineCount > 0 ? (
              <p className="text-[11.5px] text-muted-foreground" aria-live="polite">
                {lineCount} baris siap diimpor
              </p>
            ) : null}
          </div>
        </div>
      </Card>
    </section>
  );
}
