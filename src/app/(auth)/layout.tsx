import { redirect } from "next/navigation";
import { Logo } from "@/components/brand";
import { getSessionUser } from "@/lib/auth";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (user) redirect("/");

  return (
    <div className="app-canvas min-h-dvh">
      <div className="mx-auto grid min-h-dvh w-full max-w-6xl items-center gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:px-8">
        <aside className="hidden lg:block">
          <div className="hero-card relative overflow-hidden rounded-[2rem] p-9 text-white">
            <span className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-white/10" />
            <span className="pointer-events-none absolute -bottom-28 -left-16 size-72 rounded-full bg-white/[0.06]" />
            <div className="relative">
              <div className="flex items-center gap-3">
                <Logo size={46} />
                <div className="leading-tight">
                  <p className="text-[17px] font-bold">Catatku</p>
                  <p className="text-[11px] text-white/70">Uang rapi, hati tenang</p>
                </div>
              </div>

              <h2 className="mt-10 text-[35px] font-bold leading-[1.12] tracking-tight">
                Setiap rupiah
                <br />
                punya cerita.
              </h2>
              <p className="mt-3 max-w-sm text-[13.5px] leading-relaxed text-white/75">
                Catat pemasukan dan pengeluaran tanpa ribet. Lihat sisa uang, arus kas, dan
                progres targetmu dalam satu tempat yang enak dipakai.
              </p>

              <div className="mt-8 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white/10 p-3.5">
                  <p className="text-[10.5px] font-medium text-white/65">Sisa uang sekarang</p>
                  <p className="money mt-1 text-[20px] font-bold">Rp12.480.000</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-3.5">
                  <p className="text-[10.5px] font-medium text-white/65">Arus kas bulan ini</p>
                  <p className="money mt-1 text-[20px] font-bold text-[#b9f2dc]">+Rp2.100.000</p>
                </div>
              </div>

              <ul className="mt-8 space-y-2.5 text-[12.5px] text-white/85">
                <li className="flex items-center gap-2.5">
                  <span className="size-1.5 rounded-full bg-[#b9f2dc]" />
                  Catat transaksi dalam hitungan detik
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="size-1.5 rounded-full bg-[#b9f2dc]" />
                  Grafik masuk–keluar & kategori otomatis
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="size-1.5 rounded-full bg-[#b9f2dc]" />
                  Target tabungan dan pengingat harian
                </li>
              </ul>
            </div>
          </div>
        </aside>

        <main className="mx-auto w-full max-w-md">{children}</main>
      </div>
    </div>
  );
}
