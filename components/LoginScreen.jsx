"use client";

import { useState } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

const fallbackUsers = [
  {
    id: "demo-operador",
    nome: "Operador Demo",
    turno: "A",
    codigo_pin: "1111",
    perfis: [{ codigo: "operador", nome: "Operador", permissoes: ["operacao:acessar"] }]
  },
  {
    id: "demo-configurador",
    nome: "Configurador Demo",
    turno: "ADM",
    codigo_pin: "3333",
    perfis: [
      {
        codigo: "configurador",
        nome: "Configurador",
        permissoes: ["operacao:acessar", "configurador:acessar"]
      }
    ]
  }
];

function normalizeUser(user) {
  const perfis = Array.isArray(user.perfis) ? user.perfis : [];
  const permissoes = Array.from(
    new Set(
      perfis.reduce((acc, perfil) => {
        return acc.concat(perfil.permissoes ?? []);
      }, [])
    )
  );
  const perfilPrincipal = perfis.find((perfil) => perfil.principal) ?? perfis[0] ?? { codigo: "operador", nome: "Operador" };

  return {
    id: user.id,
    nome: user.nome,
    turno: user.turno ?? "",
    matricula: user.matricula ?? "",
    perfil: perfilPrincipal,
    perfis,
    permissoes
  };
}

export function LoginScreen({ onLogin }) {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function login(event) {
    event.preventDefault();
    const cleanPin = pin.trim();
    if (!cleanPin) {
      setError("Informe o PIN.");
      return;
    }

    setLoading(true);
    setError("");

    if (!isSupabaseConfigured || !supabase) {
      const fallbackUser = fallbackUsers.find((user) => user.codigo_pin === cleanPin);
      if (fallbackUser) {
        onLogin(normalizeUser(fallbackUser));
        setLoading(false);
        return;
      }

      setError("Supabase nao configurado no ambiente. Cadastre as variaveis na Vercel ou use PIN demo.");
      setLoading(false);
      return;
    }

    const { data, error: loginError } = await supabase
      .from("operadores_login")
      .select("id,nome,turno,matricula,codigo_pin,perfis")
      .eq("codigo_pin", cleanPin)
      .eq("ativo", true)
      .maybeSingle();

    if (loginError) {
      const fallbackUser = fallbackUsers.find((user) => user.codigo_pin === cleanPin);
      if (fallbackUser) {
        onLogin(normalizeUser(fallbackUser));
        setLoading(false);
        return;
      }

      setError("Nao foi possivel consultar o login. Confira se a migration de perfis foi executada.");
      setLoading(false);
      return;
    }

    if (!data) {
      setError("PIN nao encontrado ou usuario inativo.");
      setLoading(false);
      return;
    }

    await supabase.from("operadores").update({ ultimo_login_em: new Date().toISOString() }).eq("id", data.id);
    onLogin(normalizeUser(data));
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-cicopal-surface px-4 py-6">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl items-center">
        <div className="grid w-full overflow-hidden rounded-md border border-gray-200 bg-white shadow-soft md:grid-cols-[1fr_420px]">
          <div className="brand-header flex min-h-[360px] flex-col justify-between p-6 text-white">
            <div className="flex items-center gap-3">
              <ShieldCheck size={34} />
              <div>
                <h1 className="text-2xl font-black">CICOPAL</h1>
                <p className="text-sm font-semibold text-white/80">Sistema RG Qualidade</p>
              </div>
            </div>
            <div>
              <p className="text-sm font-bold uppercase text-white/70">Entrada controlada</p>
              <h2 className="mt-2 text-4xl font-black leading-tight">Identifique o operador antes do preenchimento.</h2>
              <p className="mt-3 max-w-xl text-base font-semibold text-white/85">
                O perfil define se a pessoa acessa somente a operacao ou tambem o configurador de RGs, processos e indices.
              </p>
            </div>
          </div>

          <form className="flex flex-col justify-center p-5" onSubmit={login}>
            <div className="mb-5 inline-flex size-14 items-center justify-center rounded-md bg-blue-50 text-cicopal-blue">
              <LockKeyhole size={28} />
            </div>
            <h2 className="text-2xl font-black text-gray-950">Login por PIN</h2>
            <p className="mt-1 text-sm font-semibold text-gray-500">Use o PIN do operador, qualidade ou configurador.</p>

            <label className="mt-5 block">
              <span className="mb-1 block text-xs font-bold uppercase text-gray-500">PIN</span>
              <input
                className="min-h-16 w-full rounded-md border border-gray-300 px-4 text-center text-3xl font-black tracking-[.35em] outline-none focus:border-cicopal-blue"
                inputMode="numeric"
                type="password"
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                autoFocus
              />
            </label>

            {error ? <p className="mt-3 rounded-md border border-red-100 bg-red-50 p-3 text-sm font-bold text-cicopal-red">{error}</p> : null}

            <button
              type="submit"
              className="mt-5 min-h-14 rounded-md bg-cicopal-blue px-4 text-lg font-black text-white disabled:bg-gray-300"
              disabled={loading}
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>

            <div className="mt-4 rounded-md bg-gray-50 p-3 text-xs font-semibold text-gray-500">
              Demo: operador `1111`, configurador `3333`. Troque esses PINs depois de validar o fluxo.
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
