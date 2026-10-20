"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Sparkles,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { BrandLockup } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { apiErrorMessage, apiPost } from "@/lib/client-api";
import type { SessionUser } from "@/lib/types";

function InputWithIcon({
  id,
  icon,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
        {icon}
      </span>
      <input
        id={id}
        className="h-12 w-full rounded-2xl border border-border bg-surface/40 pl-10 pr-10 text-[14.5px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus-visible:border-primary/60 focus-visible:bg-card"
        {...props}
      />
    </div>
  );
}

export function AuthForm({
  mode,
  demoEnabled = false,
}: {
  mode: "login" | "register";
  demoEnabled?: boolean;
}) {
  const router = useRouter();
  const isLogin = mode === "login";

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [demoLoading, setDemoLoading] = React.useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = isLogin ? { email, password } : { name, email, password };
      await apiPost<{ user: SessionUser }>(
        isLogin ? "/api/auth/login" : "/api/auth/register",
        payload,
      );
      toast.success(isLogin ? "Selamat datang kembali!" : "Akun berhasil dibuat. Selamat bergabung!");
      router.replace("/");
      router.refresh();
    } catch (submitError) {
      setError(apiErrorMessage(submitError));
    } finally {
      setLoading(false);
    }
  }

  async function handleDemo() {
    setDemoLoading(true);
    setError(null);
    try {
      await apiPost<{ user: SessionUser }>("/api/auth/demo", {});
      toast.success("Masuk ke akun demo dengan data contoh.");
      router.replace("/");
      router.refresh();
    } catch (demoError) {
      setError(apiErrorMessage(demoError));
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <div className="w-full">
      <div className="mb-6 flex justify-center lg:hidden">
        <BrandLockup />
      </div>

      <div className="rounded-[1.75rem] border border-border/80 bg-card p-6 shadow-[0_1px_2px_rgba(16,32,26,0.04),0_28px_60px_-30px_rgba(16,32,26,0.32)] sm:p-7">
        <h1 className="text-[24px] font-bold tracking-tight">
          {isLogin ? "Selamat datang kembali" : "Buat akun Catatku"}
        </h1>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          {isLogin
            ? "Masuk untuk melanjutkan mencatat uangmu."
            : "Cukup satu menit, lalu mulai catat transaksi pertamamu."}
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3.5" noValidate>
          {!isLogin ? (
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-[12.5px] font-semibold text-muted-foreground">
                Nama
              </label>
              <InputWithIcon
                id="name"
                type="text"
                autoComplete="name"
                placeholder="Nama kamu"
                value={name}
                onChange={(event) => setName(event.target.value)}
                icon={<UserRound className="size-4" />}
                required
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-[12.5px] font-semibold text-muted-foreground">
              Email
            </label>
            <InputWithIcon
              id="email"
              type="email"
              autoComplete="email"
              placeholder="nama@email.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              icon={<Mail className="size-4" />}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="text-[12.5px] font-semibold text-muted-foreground"
            >
              Kata sandi
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                <Lock className="size-4" />
              </span>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete={isLogin ? "current-password" : "new-password"}
                placeholder={isLogin ? "Kata sandi" : "Minimal 8 karakter"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="h-12 w-full rounded-2xl border border-border bg-surface/40 pl-10 pr-11 text-[14.5px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus-visible:border-primary/60 focus-visible:bg-card"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                className="absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-xl bg-danger-soft px-3 py-2.5 text-[12.5px] font-medium leading-snug text-danger"
            >
              {error}
            </p>
          ) : null}

          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            {isLogin ? "Masuk" : "Daftar & mulai"}
            {loading ? null : <ArrowRight className="size-4" />}
          </Button>
        </form>

        {isLogin && demoEnabled ? (
          <>
            <div className="my-4 flex items-center gap-3 text-[11px] font-medium text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              atau
              <span className="h-px flex-1 bg-border" />
            </div>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full"
              onClick={handleDemo}
              disabled={demoLoading}
            >
              {demoLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4 text-primary" />
              )}
              Coba akun demo
            </Button>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Data contoh sudah terisi — cocok untuk melihat seluruh fitur.
            </p>
          </>
        ) : null}
      </div>

      <p className="mt-4 text-center text-[13px] text-muted-foreground">
        {isLogin ? (
          <>
            Belum punya akun?{" "}
            <Link href="/register" className="font-semibold text-primary hover:underline">
              Daftar gratis
            </Link>
          </>
        ) : (
          <>
            Sudah punya akun?{" "}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Masuk di sini
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
