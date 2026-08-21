"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Boxes, Image as ImageIcon } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { FactorySupervision } from "@/components/FactorySupervision";
import { LoginScreen } from "@/components/LoginScreen";
import {
  clearUserSession,
  loadUserSession,
  saveUserSession,
} from "@/lib/userSession";
import { accessFor } from "@/lib/profileAccess";

export default function SupervisaoPage() {
  const router = useRouter();
  const [loggedUser, setLoggedUser] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [view, setView] = useState("vector");
  useEffect(() => {
    const session = loadUserSession();
    setLoggedUser(session);
    if (session && !accessFor(session).supervision) router.replace("/");
    setView(window.localStorage.getItem("carper_supervision_view") ?? "vector");
    setSessionReady(true);
  }, [router]);
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
  if (!accessFor(loggedUser).supervision) return <main className="min-h-screen bg-[#f6f7fb]" />;
  const canAccessConfigurator =
    loggedUser?.permissoes?.includes("configurador:acessar") ||
    loggedUser?.permissoes?.includes("admin:acessar");
  return (
    <main className="modern-ui min-h-screen">
      <AppHeader
        title="Supervisão da Fábrica"
        subtitle="Acompanhamento operacional em tempo real"
        user={loggedUser}
        canAccessConfigurator={canAccessConfigurator}
        onLogout={handleLogout}
      />
      <div className="mx-auto max-w-[1500px] px-4 py-5">
        <section className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm" aria-labelledby="factory-view-title">
          <div>
            <p id="factory-view-title" className="text-sm font-black text-slate-900">Visualização da planta</p>
            <p className="mt-0.5 text-sm font-semibold text-gray-500">Alterne a representação sem perder os dados ou a seleção atual.</p>
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" role="group" aria-label="Visualização da planta">
            <button type="button" aria-pressed={view === "classic"} onClick={() => { setView("classic"); window.localStorage.setItem("carper_supervision_view", "classic"); }} className={`inline-flex min-h-11 items-center justify-center gap-2 px-4 text-sm font-black ${view === "classic" ? "bg-white text-cicopal-blue shadow-sm" : "text-gray-600"}`}>
              <ImageIcon size={19} /> Planta clássica
            </button>
            <button type="button" aria-pressed={view === "vector"} onClick={() => { setView("vector"); window.localStorage.setItem("carper_supervision_view", "vector"); }} className={`inline-flex min-h-11 items-center justify-center gap-2 px-4 text-sm font-black ${view === "vector" ? "bg-white text-cicopal-blue shadow-sm" : "text-gray-600"}`}>
              <Boxes size={19} /> Planta profissional
            </button>
          </div>
        </section>
        <FactorySupervision variant={view} />
      </div>
    </main>
  );
}
