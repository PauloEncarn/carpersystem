"use client";

import { useState } from "react";
import { LockKeyhole } from "lucide-react";
import { CicopalLogo } from "@/components/CicopalLogo";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import { repairText } from "@/lib/textEncoding";

const fallbackUsers = [
  {
    id: "demo-operador",
    nome: "Operador",
    turno: "A",
    codigo_pin: "1111",
    perfis: [
      {
        codigo: "operador",
        nome: "Operador",
        permissoes: ["operacao:acessar"],
      },
    ],
  },
  {
    id: "demo-configurador",
    nome: "Configurador",
    turno: "ADM",
    codigo_pin: "3333",
    perfis: [
      {
        codigo: "configurador",
        nome: "Configurador",
        permissoes: ["operacao:acessar", "configurador:acessar"],
      },
    ],
  },
  {
    id: "00000000-0000-0000-0000-000000000205",
    nome: "Técnico",
    turno: "A",
    codigo_pin: "4444",
    perfis: [
      {
        codigo: "tecnico",
        nome: "Técnico",
        permissoes: ["operacao:acessar", "operacao:dia_atual"],
      },
    ],
  },
];

function normalizeUser(user) {
  const perfis = Array.isArray(user.perfis) ? user.perfis : [];
  const permissoes = Array.from(
    new Set(
      perfis.reduce((acc, perfil) => {
        return acc.concat(perfil.permissoes ?? []);
      }, []),
    ),
  );
  const perfilPrincipal = perfis.find((perfil) => perfil.principal) ??
    perfis[0] ?? { codigo: "operador", nome: "Operador" };

  return {
    id: user.id,
    nome: repairText(String(user.nome ?? "Usuário")).replace(/\s+Demo$/i, ""),
    turno: user.turno ?? "",
    matricula: user.matricula ?? "",
    perfil: perfilPrincipal,
    perfis,
    permissoes,
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
      const fallbackUser = fallbackUsers.find(
        (user) => user.codigo_pin === cleanPin,
      );
      if (fallbackUser) {
        onLogin(normalizeUser(fallbackUser));
        setLoading(false);
        return;
      }

      setError("O serviço de dados não está configurado neste ambiente.");
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
      const fallbackUser = fallbackUsers.find(
        (user) => user.codigo_pin === cleanPin,
      );
      if (fallbackUser) {
        onLogin(normalizeUser(fallbackUser));
        setLoading(false);
        return;
      }

      setError(
        "Nao foi possivel consultar o login. Confira se a migration de perfis foi executada.",
      );
      setLoading(false);
      return;
    }

    if (!data) {
      const fallbackUser = fallbackUsers.find(
        (user) => user.codigo_pin === cleanPin,
      );
      if (fallbackUser) {
        onLogin(normalizeUser(fallbackUser));
        setLoading(false);
        return;
      }

      setError("PIN nao encontrado ou usuario inativo.");
      setLoading(false);
      return;
    }

    await supabase
      .from("operadores")
      .update({ ultimo_login_em: new Date().toISOString() })
      .eq("id", data.id);
    onLogin(normalizeUser(data));
    setLoading(false);
  }

  return (
    <main className="modern-login min-h-screen px-4 py-6">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl items-center">
        <div className="modern-login-shell grid w-full md:grid-cols-[1fr_420px]">
          <div className="modern-login-visual flex min-h-[390px] flex-col justify-between p-8 text-white">
            <div className="flex items-center gap-3">
              <CicopalLogo className="h-16 w-auto" light priority />
              <div>
                <p className="text-sm font-semibold text-white/75">
                  Sistema RG Qualidade
                </p>
              </div>
            </div>
            <div>
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white/80">
                Entrada segura
              </span>
              <h2 className="mt-4 text-4xl font-black leading-[1.08] tracking-tight">
                Produzindo sabor de{" "}
                <span className="text-white underline decoration-cicopal-red decoration-4 underline-offset-8">
                  felicidade.
                </span>
              </h2>
              <p className="mt-3 max-w-xl text-base font-semibold text-white/85">
                Identifique-se para acessar seus processos, preenchimentos e
                configurações.
              </p>
            </div>
          </div>

          <form className="flex flex-col justify-center p-7" onSubmit={login}>
            <div className="mb-5 inline-flex size-14 items-center justify-center rounded-2xl bg-blue-50 text-cicopal-blue shadow-sm">
              <LockKeyhole size={28} />
            </div>
            <h2 className="text-2xl font-black tracking-tight text-gray-950">
              Bem-vindo
            </h2>
            <p className="mt-1 text-sm font-semibold text-gray-500">
              Digite seu PIN para continuar.
            </p>

            <label className="mt-5 block">
              <span className="mb-1 block text-xs font-bold uppercase text-gray-500">
                PIN
              </span>
              <input
                className="min-h-16 w-full border border-gray-300 bg-gray-50 px-4 text-center text-3xl font-black tracking-[.35em] outline-none focus:bg-white focus:border-cicopal-blue"
                inputMode="numeric"
                type="password"
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                autoFocus
              />
            </label>

            {error ? (
              <p className="mt-3 rounded-md border border-red-100 bg-red-50 p-3 text-sm font-bold text-cicopal-red">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              className="mt-5 min-h-14 bg-cicopal-blue px-4 text-lg font-black text-white shadow-lg shadow-blue-900/15 disabled:bg-gray-300"
              disabled={loading}
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
