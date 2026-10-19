import { jsonOk } from "@/lib/api";
import { COLOR_OPTIONS, ICON_OPTIONS } from "@/lib/constants";

/** Pilihan ikon & warna untuk form kategori. */
export async function GET() {
  return jsonOk({ icons: ICON_OPTIONS, colors: COLOR_OPTIONS });
}
