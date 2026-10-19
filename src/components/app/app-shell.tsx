"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Bell,
  ChevronRight,
  History,
  Home,
  Inbox,
  LayoutGrid,
  Plus,
  Settings,
  Tag,
  Target,
} from "lucide-react";
import { BrandLockup } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QuickAddFab } from "@/components/transactions/quick-add-button";
import { useApp } from "./app-context";
import { cn, initials } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Beranda", icon: Home },
  { href: "/riwayat", label: "Riwayat", icon: History },
  { href: "/grafik", label: "Grafik", icon: BarChart3 },
  { href: "/kategori", label: "Kategori", icon: Tag },
  { href: "/target", label: "Target", icon: Target },
  { href: "/inbox", label: "Kotak masuk", icon: Inbox },
  { href: "/pengingat", label: "Pengingat", icon: Bell },
  { href: "/pengaturan", label: "Pengaturan", icon: Settings },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function MobileTab({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium transition-colors",
        active ? "text-primary" : "text-muted-foreground",
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="size-[21px]" strokeWidth={active ? 2.3 : 1.9} />
      {label}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, openCreate } = useApp();
  const [menuOpen, setMenuOpen] = React.useState(false);

  React.useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const secondary = NAV.filter((item) =>
    ["/inbox", "/kategori", "/target", "/pengingat", "/pengaturan"].includes(item.href),
  );

  return (
    <div className="app-canvas min-h-dvh">
      <div className="mx-auto flex w-full max-w-[1440px]">
        <aside className="sticky top-0 hidden h-dvh w-[264px] shrink-0 flex-col border-r border-border/70 px-5 py-6 lg:flex">
          <BrandLockup size={42} />

          <div className="mt-6">
            <Button
              size="lg"
              className="w-full justify-start"
              onClick={() => openCreate("expense")}
            >
              <Plus className="size-5" /> Catat transaksi
            </Button>
          </div>

          <nav className="mt-5 flex flex-col gap-0.5" aria-label="Navigasi utama">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[14px] transition-colors",
                    active
                      ? "bg-primary-soft font-semibold text-primary"
                      : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-[18px]" strokeWidth={active ? 2.2 : 1.9} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto space-y-2.5">
            <div className="rounded-2xl border border-border/70 bg-card p-3">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[12px] font-bold text-primary">
                  {initials(user.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">{user.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {user.currency} · {user.email}
                  </p>
                </div>
                <Link
                  href="/pengaturan"
                  aria-label="Buka pengaturan"
                  className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Settings className="size-4" />
                </Link>
              </div>
            </div>
            <div className="flex items-center justify-between px-1">
              <p className="text-[11px] font-medium text-muted-foreground">Mode tampilan</p>
              <ThemeToggle className="size-9" />
            </div>
          </div>
        </aside>

        <div className="relative flex min-h-dvh w-full min-w-0 flex-col">
          <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-28 pt-5 sm:px-6 lg:max-w-3xl lg:pb-10 lg:pt-8">
            {children}
          </main>

          <nav
            className="fixed inset-x-0 bottom-0 z-40 lg:hidden"
            aria-label="Navigasi bawah"
          >
            <div className="mx-auto w-full max-w-md px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
              <div className="glass-bar flex items-end justify-between rounded-[1.6rem] border border-border/70 px-1.5 pb-1.5 pt-1 shadow-[0_-10px_40px_-18px_rgba(8,35,25,0.45)]">
                <MobileTab href="/" label="Beranda" icon={Home} active={isActive(pathname, "/")} />
                <MobileTab
                  href="/riwayat"
                  label="Riwayat"
                  icon={History}
                  active={isActive(pathname, "/riwayat")}
                />
                <div className="-mt-7 flex flex-1 flex-col items-center">
                  <QuickAddFab />
                  <span className="mt-0.5 text-[9.5px] font-semibold text-muted-foreground">
                    Catat
                  </span>
                </div>
                <MobileTab
                  href="/grafik"
                  label="Grafik"
                  icon={BarChart3}
                  active={isActive(pathname, "/grafik")}
                />
                <button
                  type="button"
                  onClick={() => setMenuOpen(true)}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium transition-colors",
                    secondary.some((item) => isActive(pathname, item.href))
                      ? "text-primary"
                      : "text-muted-foreground",
                  )}
                  aria-haspopup="dialog"
                >
                  <LayoutGrid className="size-[21px]" strokeWidth={1.9} />
                  Lainnya
                </button>
              </div>
            </div>
          </nav>
        </div>
      </div>

      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Menu lainnya</DialogTitle>
            <DialogDescription>Semua yang kamu butuhkan untuk merapikan uang.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4 pb-6">
            <div className="grid grid-cols-2 gap-2">
              {secondary.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-2.5 rounded-2xl border border-border/70 bg-surface/50 px-3.5 py-3 text-[13px] font-semibold transition-colors hover:bg-muted"
                  >
                    <span className="flex size-8 items-center justify-center rounded-xl bg-primary-soft text-primary">
                      <Icon className="size-4" />
                    </span>
                    {item.label}
                    <ChevronRight className="ml-auto size-3.5 text-muted-foreground" />
                  </Link>
                );
              })}
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Catat cepat
              </p>
              <div className="flex gap-2">
                <Button
                  variant="soft"
                  className="flex-1"
                  onClick={() => {
                    setMenuOpen(false);
                    openCreate("expense");
                  }}
                >
                  <ArrowUpRight className="size-4" /> Pengeluaran
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setMenuOpen(false);
                    openCreate("income");
                  }}
                >
                  <ArrowDownLeft className="size-4" /> Pemasukan
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-2xl bg-muted/60 px-3.5 py-2.5">
              <p className="text-[13px] font-medium">Mode terang / gelap</p>
              <ThemeToggle className="size-9" />
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
}
