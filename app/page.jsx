"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { HierarchyNavigator } from "@/components/HierarchyNavigator";
import { LoginScreen } from "@/components/LoginScreen";
import { Rg005SubregistroForm } from "@/components/Rg005SubregistroForm";
import { CicopalLogo } from "@/components/CicopalLogo";
import { BarChart3, Factory, FileCog } from "lucide-react";
import {
  findSelection,
  getInitialSelection,
  rastreabilidadeTree,
} from "@/lib/rastreabilidade";
import {
  clearUserSession,
  loadUserSession,
  saveUserSession,
} from "@/lib/userSession";
import { persistRg003Record } from "@/lib/rg003Persistence";

export default function HomePage() {
  const [loggedUser, setLoggedUser] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [operationTree, setOperationTree] = useState(rastreabilidadeTree);
  const [selection, setSelection] = useState(() => getInitialSelection());
  const [currentStep, setCurrentStep] = useState(1);
  const [databaseStatus, setDatabaseStatus] = useState("");
  const [databaseError, setDatabaseError] = useState("");
  const currentStepRef = useRef(currentStep);
  const saveInFlightRef = useRef(null);
  const selected = useMemo(
    () => findSelection(selection, operationTree),
    [selection, operationTree],
  );
  const canAccessConfigurator =
    loggedUser?.permissoes?.includes("configurador:acessar") ||
    loggedUser?.permissoes?.includes("admin:acessar");
  const isTechnicalProfile =
    loggedUser?.perfil?.codigo === "tecnico" ||
    loggedUser?.permissoes?.includes("operacao:dia_atual");

  useEffect(() => {
    currentStepRef.current = currentStep;
  }, [currentStep]);

  useEffect(() => {
    window.history.replaceState({ rgApp: true }, "");
    window.history.pushState({ rgApp: true }, "");

    function handlePopState() {
      if (currentStepRef.current > 1) {
        setCurrentStep((step) => Math.max(1, step - 1));
      }
      window.history.pushState({ rgApp: true }, "");
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

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
    setCurrentStep(1);
    setSelection(getInitialSelection(operationTree));
  }

  function saveRegistroSnapshot(snapshot) {
    if (saveInFlightRef.current) return saveInFlightRef.current;
    const task = performSaveRegistroSnapshot(snapshot).finally(() => {
      if (saveInFlightRef.current === task) saveInFlightRef.current = null;
    });
    saveInFlightRef.current = task;
    return task;
  }

  async function performSaveRegistroSnapshot(snapshot) {
    if (
      !selection.linhaId ||
      !selection.dataId ||
      !selection.documentoId ||
      !selection.loteId ||
      !selection.registroId
    )
      return;
    let activeCycle = null;
    try {
      activeCycle = JSON.parse(
        window.localStorage.getItem(
          `carper_rg003_cycle_${selection.linhaId}`,
        ) ?? "null",
      );
    } catch {
      activeCycle = null;
    }
    const activeCycleRef = activeCycle?.id ?? null;
    const cycleRegistro = activeCycle?.product
      ? {
          ...snapshot.registro,
          produto: activeCycle.product,
          sabor: activeCycle.product.replace(/^Rosca\s+/i, ""),
        }
      : snapshot.registro;

    setOperationTree((currentTree) =>
      currentTree.map((linha) => {
        if (linha.id !== selection.linhaId) return linha;

        const dataIndex = linha.datas.findIndex(
          (data) => data.id === selection.dataId,
        );
        const nextDatas = [...linha.datas];
        const dataAtual =
          dataIndex >= 0
            ? nextDatas[dataIndex]
            : {
                id: selection.dataId,
                documentos: [],
              };

        const documentoIndex = dataAtual.documentos.findIndex(
          (documento) => documento.id === selection.documentoId,
        );
        const nextDocumentos = [...dataAtual.documentos];
        const documentoAtual =
          documentoIndex >= 0
            ? nextDocumentos[documentoIndex]
            : {
                id: selection.documentoId,
                nome: selected.documento?.nome ?? selection.documentoId,
                lotes: [],
              };

        const loteIndex = documentoAtual.lotes.findIndex(
          (lote) => lote.id === selection.loteId,
        );
        const nextLotes = [...documentoAtual.lotes];
        const loteAtual =
          loteIndex >= 0
            ? nextLotes[loteIndex]
            : {
                id: selection.loteId,
                produto: cycleRegistro.produto ?? "Lote do dia",
                registros: [],
              };

        const registroIndex = loteAtual.registros.findIndex(
          (registro) => registro.id === selection.registroId,
        );
        const existingRegistro =
          registroIndex >= 0 ? loteAtual.registros[registroIndex] : null;
        const hygieneCycles = loteAtual.registros.filter(
          (registro) => registro.processoId === "higienizacao",
        );
        const latestCycleId = [...hygieneCycles]
          .reverse()
          .find((registro) => registro.cicloId)?.cicloId;
        const cycleNumber = String(hygieneCycles.length + 1).padStart(2, "0");
        const recordCycleId =
          existingRegistro?.cicloId ??
          activeCycleRef ??
          (selection.subregistroId === "higienizacao"
            ? `CICLO-${cycleNumber}`
            : (latestCycleId ?? "CICLO-01"));
        const registroBase =
          registroIndex >= 0
            ? loteAtual.registros[registroIndex]
            : {
                ...selected.registro,
                id: selection.registroId,
                processoId: selection.subregistroId,
                cicloId: recordCycleId,
                cicloIniciadoEm:
                  selection.subregistroId === "higienizacao"
                    ? new Date().toISOString()
                    : undefined,
                subregistros: [],
              };

        const subregistroIndex = (registroBase.subregistros ?? []).findIndex(
          (subregistro) => subregistro.id === selection.subregistroId,
        );
        const nextSubregistros = [...(registroBase.subregistros ?? [])];
        const nextSubregistro = {
          ...(selected.subregistro ?? {}),
          ...(nextSubregistros[subregistroIndex] ?? {}),
          ...snapshot.subregistro,
          id: selection.subregistroId,
        };

        if (subregistroIndex >= 0) {
          nextSubregistros[subregistroIndex] = nextSubregistro;
        } else {
          nextSubregistros.push(nextSubregistro);
        }

        const nextRegistro = {
          ...registroBase,
          ...cycleRegistro,
          id: selection.registroId,
          processoId: selection.subregistroId,
          cicloId: recordCycleId,
          eventoRegistradoEm: new Date().toISOString(),
          subregistros: nextSubregistros,
        };

        const nextRegistros = [...loteAtual.registros];
        if (registroIndex >= 0) {
          nextRegistros[registroIndex] = nextRegistro;
        } else {
          nextRegistros.push(nextRegistro);
        }

        const nextLote = { ...loteAtual, registros: nextRegistros };
        if (loteIndex >= 0) {
          nextLotes[loteIndex] = nextLote;
        } else {
          nextLotes.push(nextLote);
        }

        const nextDocumento = { ...documentoAtual, lotes: nextLotes };
        if (documentoIndex >= 0) {
          nextDocumentos[documentoIndex] = nextDocumento;
        } else {
          nextDocumentos.push(nextDocumento);
        }

        const nextData = { ...dataAtual, documentos: nextDocumentos };
        if (dataIndex >= 0) {
          nextDatas[dataIndex] = nextData;
        } else {
          nextDatas.push(nextData);
        }

        return { ...linha, datas: nextDatas };
      }),
    );

    if (
      selection.documentoId === "RG.QUA.BA.003" ||
      selection.documentoId === "RG.QUA.005" ||
      selection.documentoId === "RG.QUA.004"
    ) {
      setDatabaseStatus("saving");
      setDatabaseError("");
      try {
        const result = await persistRg003Record({
          documentCode: selection.documentoId,
          lineId: selection.linhaId,
          loteCode: activeCycle?.productionCode ?? selection.loteId,
          recordCode: selection.registroId,
          processType: selection.subregistroId,
          operatorId: loggedUser?.id,
          turno: loggedUser?.turno,
          registro: cycleRegistro,
          subregistro: snapshot.subregistro,
          cycleId: activeCycleRef,
          cycleStartedAt: activeCycle?.startedAt,
          productionCode: activeCycle?.productionCode,
        });
        setDatabaseStatus(result.remote ? "saved" : "local");
        return true;
      } catch (error) {
        setDatabaseStatus(
          error?.message?.includes("CONFLICT") ? "conflict" : "error",
        );
        setDatabaseError(
          error?.message ?? "Falha desconhecida ao gravar no Supabase.",
        );
        return false;
      }
    }
    return true;
  }

  if (!sessionReady) {
    return <main className="min-h-screen bg-[#f6f7fb]" />;
  }

  if (!loggedUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <main className="modern-ui min-h-screen">
      <header className="app-topbar sticky top-0 z-20 shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <CicopalLogo className="h-12 w-auto" priority />
            <div>
              <p className="text-xs font-semibold text-gray-500">
                Sistema RG Qualidade
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
            <span className="hidden rounded-full bg-gray-100 px-3 py-2 text-gray-700 sm:inline">
              Olá, {loggedUser.nome}
            </span>
            <span className="rounded-full bg-blue-50 px-3 py-2 text-cicopal-blue">
              {loggedUser.perfil?.nome ?? "Operador"}
            </span>
            <Link
              href="/supervisao"
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-700"
            >
              <Factory size={17} /> Supervisão
            </Link>
            <Link
              href="/relatorios"
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-700"
            >
              <BarChart3 size={17} /> Relatórios
            </Link>
            {canAccessConfigurator ? (
              <Link
                href="/configurador"
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-cicopal-blue px-3 py-2 text-white shadow-sm"
              >
                <FileCog size={17} /> Configurador
              </Link>
            ) : null}
            <button
              type="button"
              className="min-h-10 border border-gray-200 bg-white px-3 py-2 text-gray-600"
              onClick={handleLogout}
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-4 px-4 py-4">
        {databaseStatus ? (
          <div
            className={`rounded-md border px-4 py-2 text-sm font-bold ${["error", "conflict"].includes(databaseStatus) ? "border-red-200 bg-red-50 text-cicopal-red" : databaseStatus === "saving" ? "border-blue-200 bg-blue-50 text-cicopal-blue" : "border-green-200 bg-green-50 text-cicopal-green"}`}
          >
            {databaseStatus === "saving"
              ? "Gravando no banco..."
              : databaseStatus === "saved"
                ? "Dados sincronizados com o banco."
                : databaseStatus === "local"
                  ? "Supabase não configurado: dados mantidos neste tablet."
                  : databaseStatus === "conflict"
                    ? "Este preenchimento foi gravado ou alterado por outro técnico. Recarregue o registro antes de editar."
                    : `Não foi possível salvar: ${databaseError}`}
          </div>
        ) : null}
        <HierarchyNavigator
          tree={operationTree}
          selection={selection}
          selected={selected}
          onSelectionChange={setSelection}
          currentStep={currentStep}
          onStepChange={setCurrentStep}
          hideDates={isTechnicalProfile}
          operatorName={loggedUser.nome}
          operatorId={loggedUser.id}
          profileCode={loggedUser?.perfil?.codigo ?? ""}
        >
          {selected.registro ? (
            <Rg005SubregistroForm
              key={`${selection.linhaId}:${selection.documentoId}:${selected.registro.id}`}
              lineId={selection.linhaId}
              documentName={selected.documento?.nome}
              loteId={selected.lote?.id}
              registro={selected.registro}
              subregistro={selected.subregistro}
              loggedUser={loggedUser}
              onSave={saveRegistroSnapshot}
            />
          ) : null}
        </HierarchyNavigator>
      </div>
    </main>
  );
}
