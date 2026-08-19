"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { LoginScreen } from "@/components/LoginScreen";
import { ProductionReports } from "@/components/ProductionReports";
import {
  clearUserSession,
  loadUserSession,
  saveUserSession,
} from "@/lib/userSession";

export default function ReportsPage() {
  const [loggedUser, setLoggedUser] = useState(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setLoggedUser(loadUserSession());
    setReady(true);
  }, []);
  if (!ready) return <main className="min-h-screen bg-[#f6f7fb]" />;
  if (!loggedUser)
    return (
      <LoginScreen
        onLogin={(user) => {
          saveUserSession(user);
          setLoggedUser(user);
        }}
      />
    );
  const canAccessConfigurator =
    loggedUser?.permissoes?.includes("configurador:acessar") ||
    loggedUser?.permissoes?.includes("admin:acessar");
  return (
    <main className="modern-ui min-h-screen">
      <AppHeader
        title="Relatórios e Indicadores"
        subtitle="Produção, rastreabilidade e conformidade"
        user={loggedUser}
        canAccessConfigurator={canAccessConfigurator}
        onLogout={() => {
          clearUserSession();
          setLoggedUser(null);
        }}
      />
      <div className="mx-auto max-w-[1500px] px-4 py-5">
        <ProductionReports />
      </div>
    </main>
  );
}
