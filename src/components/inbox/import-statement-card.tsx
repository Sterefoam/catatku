"use client";

import * as React from "react";
import { FileText, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiErrorMessage, apiPost } from "@/lib/client-api";

interface ImportResult {
  imported: number;
  skipped: number;
  parsed?: number;
  pages?: number;
}

const MAX_FILE_BYTES = 3 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function resultMessage(result: ImportResult): string {
  if (result.imported > 0) {
    const skippedPart =
      result.skipped > 0 ? `, ${result.skipped} dilewati (duplikat/tidak terbaca)` : "";
    return `${result.imported} transaksi masuk Kotak Masuk${skippedPart}.`;
  }
  if (result.skipped > 0) {
    return `Tidak ada transaksi baru; ${result.skipped} baris dilewati (duplikat/tidak terbaca).`;
  }
  return "Tidak ada transaksi yang bisa diimpor dari PDF ini.";
}

/**
 * Impor mutasi/e-Statement **PDF** (hasil unduhan mBCA/KlikBCA) ke Kotak Masuk.
 * File dikirim sebagai base64 ke POST /api/inbox/import untuk diekstrak di server.
 */
export function ImportStatementCard({ onImported }: { onImported: () => void }) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [importing, setImporting] = React.useState(false);
  const [result, setResult] = React.useState<ImportResult | null>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (!/\.pdf$/i.test(selected.name) && selected.type !== "application/pdf") {
      toast.error("Format harus PDF.");
      event.target.value = "";
      return;
    }
    if (selected.size > MAX_FILE_BYTES) {
      toast.error("PDF maksimal 3 MB. Kompres atau pecah filenya dulu.");
      event.target.value = "";
      return;
    }
    setFile(selected);
    setResult(null);
  }

  async function handleImport() {
    if (!file) {
      toast.error("Pilih file PDF mutasi dulu.");
      return;
    }

    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const pdfBase64 = arrayBufferToBase64(buffer);
      const response = await apiPost<ImportResult>("/api/inbox/import", {
        pdfBase64,
        fileName: file.name,
      });
      setResult(response);

      if (response.imported > 0) {
        toast.success(`${response.imported} transaksi masuk Kotak Masuk.`, {
          description:
            response.skipped > 0
              ? `${response.skipped} baris dilewati (duplikat/tidak terbaca).`
              : undefined,
        });
      } else {
        toast.info("Tidak ada transaksi baru yang diimpor.", {
          description:
            response.skipped > 0
              ? `${response.skipped} baris dilewati (duplikat/tidak terbaca).`
              : undefined,
        });
      }

      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onImported();
    } catch (error) {
      toast.error(apiErrorMessage(error) || "Impor PDF gagal. Coba lagi.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <section aria-labelledby="inbox-impor-pdf">
      <Card className="overflow-hidden">
        <div className="flex items-start gap-3 border-b border-border/60 px-5 py-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <FileText className="size-[18px]" />
          </span>
          <div className="min-w-0">
            <h2 id="inbox-impor-pdf" className="text-[14px] font-semibold">
              Impor mutasi PDF
            </h2>
            <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
              Unggah e-Statement/mutasi PDF dari mBCA atau KlikBCA. Baris transaksi masuk sebagai
              transaksi tertunda untuk kamu cek.
            </p>
          </div>
        </div>

        <div className="space-y-3 px-5 py-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full justify-start"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            <Upload className="size-4 text-primary" />
            {file ? file.name : "Pilih file PDF mutasi"}
          </Button>

          {file ? (
            <p className="text-[11.5px] text-muted-foreground">
              {formatSize(file.size)} · siap diimpor
            </p>
          ) : (
            <p className="text-[11.5px] leading-relaxed text-muted-foreground">
              Maks 3 MB. PDF hasil scan gambar belum didukung (harus PDF berteks). Hasil ekstraksi
              perlu dikonfirmasi di Kotak Masuk.
            </p>
          )}

          {result ? (
            <p className="rounded-xl bg-success-soft px-3 py-2 text-[12px] font-medium text-success">
              {resultMessage(result)}
              {result.pages ? ` (${result.pages} halaman)` : ""}
            </p>
          ) : null}

          <div className="flex items-center gap-2">
            <Button
              onClick={handleImport}
              disabled={importing || !file}
              aria-busy={importing || undefined}
              className="h-11 flex-1 px-4 sm:flex-none"
            >
              {importing ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Upload className="size-4" aria-hidden="true" />
              )}
              {importing ? "Mengimpor…" : "Impor PDF"}
            </Button>
          </div>
        </div>
      </Card>
    </section>
  );
}
