"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Factory, LogOut, ShieldCheck } from "lucide-react";
import { LoginScreen } from "@/components/LoginScreen";
import { CicopalLogo } from "@/components/CicopalLogo";
import { RgConfigurator } from "@/components/RgConfigurator";
import { rastreabilidadeTree } from "@/lib/rastreabilidade";
import {
  clearUserSession,
  loadUserSession,
  saveUserSession,
} from "@/lib/userSession";

export default function ConfiguradorPage() {
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

  const canAccess =
    loggedUser?.permissoes?.includes("configurador:acessar") ||
    loggedUser?.permissoes?.includes("admin:acessar");

  if (!sessionReady) {
    return <main className="min-h-screen bg-[#f6f7fb]" />;
  }

  if (!loggedUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (!canAccess) {
    return (
      <main className="modern-ui grid min-h-screen place-items-center px-4">
        <section className="modern-panel max-w-lg p-8 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-red-50 text-cicopal-red">
            <ShieldCheck size={30} />
          </span>
          <h1 className="mt-5 text-2xl font-black text-gray-950">
            Acesso não autorizado
          </h1>
          <p className="mt-2 font-semibold text-gray-500">
            Seu perfil não possui permissão para acessar o Configurador de RG.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-cicopal-blue px-5 font-bold text-white"
          >
            <ArrowLeft size={18} /> Voltar para operação
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="modern-ui min-h-screen">
      <header className="app-topbar sticky top-0 z-20 shadow-sm">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <CicopalLogo className="h-12 w-auto" priority />
            <div>
              <h1 className="text-lg font-black tracking-tight text-cicopal-blue">
                Configurador de RG
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden rounded-full bg-gray-100 px-3 py-2 text-sm font-bold text-gray-700 sm:inline">
              {loggedUser.nome}
            </span>
            <Link
              href="/"
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-gray-700"
            >
              <ArrowLeft size={17} /> Operação
            </Link>
            <Link
              href="/supervisao"
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-gray-700"
            >
              <Factory size={17} /> Supervisão
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
        <RgConfigurator lines={rastreabilidadeTree} loggedUser={loggedUser} />
      </div>
    </main>
  );
}
