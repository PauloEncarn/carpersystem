"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, LogOut } from "lucide-react";
import { FactorySupervision } from "@/components/FactorySupervision";
import { CicopalLogo } from "@/components/CicopalLogo";
import { LoginScreen } from "@/components/LoginScreen";
import {
  clearUserSession,
  loadUserSession,
  saveUserSession,
} from "@/lib/userSession";

export default function SupervisaoPage() {
  const [loggedUser, setLoggedUser] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  useEffect(() => {
    setLoggedUser(loadUserSession());
    setSessionReady(true);
  }, []);
  function handleLogin(user) {
    saveUserSession(user);
    setLoggedUser(user);
  }
  function handleLogout() {
    clearUserSession();
    setLoggedUser(null);
  }
  if (!sessionReady) return <main className="min-h-screen bg-[#f6f7fb]" />;
  if (!loggedUser) return <LoginScreen onLogin={handleLogin} />;
  return (
    <main className="modern-ui min-h-screen">
      <header className="app-topbar sticky top-0 z-20 shadow-sm">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <CicopalLogo className="h-12 w-auto" priority />
            <div>
              <h1 className="text-lg font-black tracking-tight text-cicopal-blue">
                Supervisão da fábrica
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-gray-100 px-3 py-2 text-sm font-bold text-gray-700 sm:inline">
              {loggedUser.nome}
            </span>
            <Link
              href="/"
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-gray-700"
            >
              <ArrowLeft size={17} /> Operação
            </Link>
            <button
              type="button"
              className="inline-flex min-h-10 items-center gap-2 border border-gray-200 bg-white px-3 text-sm font-bold text-gray-600"
              onClick={handleLogout}
            >
              <LogOut size={17} /> Sair
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1500px] px-4 py-5">
        <FactorySupervision />
      </div>
    </main>
  );
}
