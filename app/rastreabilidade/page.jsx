"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { LoginScreen } from "@/components/LoginScreen";
import { TraceabilityLookup } from "@/components/TraceabilityLookup";
import { clearUserSession, loadUserSession, saveUserSession } from "@/lib/userSession";

export default function TraceabilityPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { const session = loadUserSession(); setUser(session); if (session?.perfil?.codigo !== "admin" && !session?.permissoes?.includes("admin:acessar")) router.replace("/"); setReady(true); }, [router]);
  if (!ready) return <main className="min-h-screen bg-[#f6f7fb]" />;
  if (!user) return <LoginScreen onLogin={(nextUser) => { saveUserSession(nextUser); setUser(nextUser); }} />;
  if (user.perfil?.codigo !== "admin" && !user.permissoes?.includes("admin:acessar")) return <main className="min-h-screen bg-[#f6f7fb]" />;
  return <main className="modern-ui min-h-screen"><AppHeader title="Rastreabilidade" subtitle="Consulta de lote e evidências fotográficas" user={user} canAccessConfigurator onLogout={() => { clearUserSession(); setUser(null); }} /><div className="px-4 py-5 sm:px-6"><TraceabilityLookup /></div></main>;
}
