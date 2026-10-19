"use client";

import * as React from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import type { SessionUser } from "@/lib/types";

const SessionContext = React.createContext<SessionUser | null>(null);

export function useSessionUser(): SessionUser | null {
  return React.useContext(SessionContext);
}

export function Providers({
  user,
  children,
}: {
  user: SessionUser | null;
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme={user?.theme ?? "system"}
      enableSystem
      disableTransitionOnChange
    >
      <SessionContext.Provider value={user}>{children}</SessionContext.Provider>
      <Toaster
        position="top-center"
        offset={16}
        toastOptions={{
          className:
            "!rounded-2xl !border !border-border !bg-card !text-card-foreground !shadow-lg",
        }}
      />
    </ThemeProvider>
  );
}
