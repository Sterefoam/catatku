"use client";

import * as React from "react";
import { Bell, BellRing, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PermissionState = NotificationPermission | "unsupported";

type SwState = "unknown" | "registering" | "ready" | "fallback";

const PERMISSION_META: Record<
  PermissionState,
  { label: string; tone: "outline" | "neutral" | "success" | "danger" }
> = {
  unsupported: { label: "Tidak didukung", tone: "outline" },
  default: { label: "Belum diizinkan", tone: "neutral" },
  granted: { label: "Diizinkan", tone: "success" },
  denied: { label: "Diblokir", tone: "danger" },
};

const TEST_TITLE = "Catatku";
const TEST_BODY = "Waktunya mencatat pengeluaran hari ini 💸";

function testNotificationOptions(): NotificationOptions {
  return {
    body: TEST_BODY,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: "catatku-uji",
    data: { url: "/catat" },
  };
}

/** Tunggu service worker aktif, tapi jangan menggantung bila belum siap. */
function waitForActiveWorker(timeoutMs: number): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return Promise.resolve(false);
  const ready = navigator.serviceWorker.ready
    .then((registration) => Boolean(registration.active))
    .catch(() => false);
  const timeout = new Promise<boolean>((resolve) => {
    window.setTimeout(() => resolve(false), timeoutMs);
  });
  return Promise.race([ready, timeout]);
}

/**
 * Notifikasi browser (progressive enhancement): minta izin, kirim notifikasi
 * uji lewat service worker /sw.js, dan jelaskan batasannya.
 */
export function BrowserNotificationsCard() {
  const [permission, setPermission] = React.useState<PermissionState>("default");
  const [requesting, setRequesting] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [swState, setSwState] = React.useState<SwState>("unknown");

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }

    const sync = () => {
      if (typeof Notification !== "undefined") setPermission(Notification.permission);
    };
    sync();

    if (typeof navigator === "undefined" || !navigator.permissions?.query) return;
    let cancelled = false;
    let status: PermissionStatus | null = null;
    try {
      navigator.permissions
        .query({ name: "notifications" as PermissionName })
        .then((result) => {
          if (cancelled) return;
          status = result;
          sync();
          result.addEventListener?.("change", sync);
        })
        .catch(() => undefined);
    } catch {
      // Browser tanpa dukungan Permissions API: status izin tetap dibaca dari Notification.
    }

    return () => {
      cancelled = true;
      status?.removeEventListener?.("change", sync);
    };
  }, []);

  async function enableNotifications() {
    if (permission === "unsupported" || requesting) return;
    if (permission === "granted") {
      toast.success("Notifikasi browser sudah diizinkan.");
      return;
    }
    setRequesting(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === "granted") {
        toast.success("Notifikasi browser aktif.");
      } else if (result === "denied") {
        toast.error("Izin ditolak. Kamu bisa mengizinkannya dari pengaturan browser.");
      } else {
        toast("Izin belum diberikan.", {
          description: "Kamu bisa mengaktifkannya lagi kapan saja dari kartu ini.",
        });
      }
    } catch {
      toast.error("Browser ini tidak bisa meminta izin notifikasi.");
    } finally {
      setRequesting(false);
    }
  }

  async function showTestNotification(): Promise<boolean> {
    const options = testNotificationOptions();

    if ("serviceWorker" in navigator) {
      try {
        setSwState("registering");
        const registration = await navigator.serviceWorker.register("/sw.js");
        const active = await waitForActiveWorker(4000);
        if (active) {
          await registration.showNotification(TEST_TITLE, options);
          setSwState("ready");
          return true;
        }
      } catch {
        // lanjut ke notifikasi biasa di bawah
      }
      setSwState("fallback");
    }

    try {
      new Notification(TEST_TITLE, options);
      return true;
    } catch {
      return false;
    }
  }

  async function sendTest() {
    if (permission !== "granted") {
      toast.error("Aktifkan izin notifikasi dulu ya.");
      return;
    }
    if (testing) return;
    setTesting(true);
    try {
      const shown = await showTestNotification();
      if (shown) {
        toast.success("Notifikasi uji dikirim. Cek bilah notifikasi atau pojok layar.");
      } else {
        toast.error("Notifikasi uji gagal ditampilkan. Coba izinkan notifikasi di pengaturan browser.");
      }
    } catch {
      toast.error("Gagal mengirim notifikasi uji.");
    } finally {
      setTesting(false);
    }
  }

  const meta = PERMISSION_META[permission];
  const supported = permission !== "unsupported";

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-3 border-b border-border/60 px-5 py-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <BellRing className="size-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold">Notifikasi browser</p>
          <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
            Supaya pengingat juga muncul di luar halaman Catatku.
          </p>
        </div>
      </div>

      <div className="space-y-3 px-5 py-4">
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface/60 px-3.5 py-2.5">
          <span className="flex items-center gap-2 text-[12.5px] font-medium">
            <Bell className="size-4" /> Izin notifikasi browser
          </span>
          <Badge tone={meta.tone} className="shrink-0">
            {meta.label}
          </Badge>
        </div>

        {supported ? (
          <>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant={permission === "granted" ? "outline" : "primary"}
                className="flex-1"
                onClick={() => void enableNotifications()}
                disabled={requesting || permission === "granted" || permission === "denied"}
              >
                {requesting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <BellRing className="size-4" />
                )}
                {permission === "granted"
                  ? "Notifikasi sudah diizinkan"
                  : "Aktifkan notifikasi browser"}
              </Button>
              <Button
                variant="soft"
                className="flex-1"
                onClick={() => void sendTest()}
                disabled={permission !== "granted" || testing || requesting}
              >
                {testing ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                Kirim notifikasi uji
              </Button>
            </div>

            {permission === "denied" ? (
              <p className="rounded-2xl bg-danger-soft px-3.5 py-2.5 text-[11.5px] leading-relaxed text-danger">
                Izin diblokir. Buka pengaturan situs di browser (ikon gembok di bilah alamat) →
                Notifikasi → izinkan, lalu muat ulang halaman ini.
              </p>
            ) : null}

            {permission === "default" ? (
              <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                Tombol uji aktif setelah izin notifikasi diberikan.
              </p>
            ) : null}

            {swState === "fallback" ? (
              <p className="text-[11.5px] leading-relaxed text-warning">
                Service worker belum aktif, notifikasi uji dikirim lewat notifikasi browser biasa.
              </p>
            ) : null}
          </>
        ) : (
          <p className="rounded-2xl bg-muted/70 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
            Browser ini belum mendukung notifikasi. Pengingat tetap muncul sebagai notifikasi
            kecil di dalam aplikasi saat Catatku terbuka.
          </p>
        )}

        <div className="rounded-2xl border border-dashed border-border px-3.5 py-3">
          <p className="text-[12px] font-semibold">Cara kerja notifikasi</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
            Notifikasi browser berjalan selama aplikasi atau PWA Catatku aktif di perangkatmu.
            Catatku tidak memakai server push, jadi pengingat tidak bisa muncul saat aplikasi
            benar-benar ditutup.
          </p>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Notifikasi uji memakai service worker{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[10.5px]">/sw.js</code> dan ikon
            aplikasi.
          </p>
        </div>
      </div>
    </Card>
  );
}
