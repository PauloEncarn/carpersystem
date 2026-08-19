"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { LoginScreen } from "@/components/LoginScreen";
import { ProductSpecificationsConfigurator } from "@/components/ProductSpecificationsConfigurator";
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
      <AppHeader
        title="Configuração de Qualidade"
        subtitle="Produtos, parâmetros e especificações dos RGs"
        user={loggedUser}
        canAccessConfigurator
        onLogout={handleLogout}
      />
      <div className="mx-auto max-w-[1500px] px-4 py-5">
        <ProductSpecificationsConfigurator />
      </div>
    </main>
  );
}
