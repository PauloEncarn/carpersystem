"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Factory, LogOut } from "lucide-react";
import { CicopalLogo } from "@/components/CicopalLogo";
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
  return (
    <main className="modern-ui min-h-screen">
      <header className="app-topbar sticky top-0 z-20 shadow-sm">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <CicopalLogo className="h-12 w-auto" priority />
            <div>
              <h1 className="text-lg font-bold text-cicopal-blue">
                Relatórios e indicadores
              </h1>
              <p className="text-xs font-semibold text-gray-500">
                Produção, rastreabilidade e conformidade
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden bg-gray-100 px-3 py-2 text-sm font-bold sm:inline">
              {loggedUser.nome}
            </span>
            <Link
              href="/supervisao"
              className="inline-flex min-h-10 items-center gap-2 border border-gray-200 bg-white px-3 text-sm font-bold"
            >
              <Factory size={17} />
              Supervisão
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-10 items-center gap-2 border border-gray-200 bg-white px-3 text-sm font-bold"
            >
              <ArrowLeft size={17} />
              Operação
            </Link>
            <button
              type="button"
              className="inline-flex min-h-10 items-center gap-2 border border-gray-200 bg-white px-3 text-sm font-bold"
              onClick={() => {
                clearUserSession();
                setLoggedUser(null);
              }}
            >
              <LogOut size={17} />
              Sair
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1500px] px-4 py-5">
        <ProductionReports />
      </div>
    </main>
  );
}
