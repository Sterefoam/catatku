import { ICON_OPTIONS } from "@/lib/constants";

const ICON_NAMES = new Set<string>(ICON_OPTIONS.map((option) => option.name));
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export interface OptionFieldError {
  field: "icon" | "color";
  message: string;
}

/**
 * Validasi kolom pilihan (ikon & warna) sebelum zod.
 *
 * Skema zod memakai `.catch()` sehingga nilai asing diam-diam diganti dengan
 * bawaan. Di endpoint kami ingin nilai asing ditolak dengan pesan yang jelas
 * supaya UI bisa menampilkan kesalahannya.
 */
export function categoryOptionError(body: unknown): OptionFieldError | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;

  if (record.icon !== undefined && record.icon !== null) {
    if (typeof record.icon !== "string" || !ICON_NAMES.has(record.icon)) {
      return {
        field: "icon",
        message: "Ikon tidak dikenali. Pilih ikon dari daftar yang tersedia.",
      };
    }
  }

  if (record.color !== undefined && record.color !== null) {
    if (typeof record.color !== "string" || !HEX_COLOR.test(record.color)) {
      return {
        field: "color",
        message: "Warna tidak valid. Pilih warna dari daftar yang tersedia.",
      };
    }
  }

  return null;
}

/** Body harus berupa objek JSON, bukan null/array/string. */
export function isJsonObject(body: unknown): body is Record<string, unknown> {
  return Boolean(body) && typeof body === "object" && !Array.isArray(body);
}
