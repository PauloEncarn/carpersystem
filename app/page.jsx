"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { HierarchyNavigator } from "@/components/HierarchyNavigator";
import { LoginScreen } from "@/components/LoginScreen";
import { Rg005SubregistroForm } from "@/components/Rg005SubregistroForm";
import { FileCog, ShieldCheck } from "lucide-react";
import { findSelection, getInitialSelection, rastreabilidadeTree } from "@/lib/rastreabilidade";
import { clearUserSession, loadUserSession, saveUserSession } from "@/lib/userSession";

export default function HomePage() {
  const [loggedUser, setLoggedUser] = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [operationTree, setOperationTree] = useState(rastreabilidadeTree);
  const [selection, setSelection] = useState(() => getInitialSelection());
  const [currentStep, setCurrentStep] = useState(1);
  const currentStepRef = useRef(currentStep);
  const selected = useMemo(() => findSelection(selection, operationTree), [selection, operationTree]);
  const canAccessConfigurator = loggedUser?.permissoes?.includes("configurador:acessar") || loggedUser?.permissoes?.includes("admin:acessar");

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
    if (!selection.linhaId || !selection.dataId || !selection.documentoId || !selection.loteId || !selection.registroId) return;

    setOperationTree((currentTree) =>
      currentTree.map((linha) => {
        if (linha.id !== selection.linhaId) return linha;

        const dataIndex = linha.datas.findIndex((data) => data.id === selection.dataId);
        const nextDatas = [...linha.datas];
        const dataAtual =
          dataIndex >= 0
            ? nextDatas[dataIndex]
            : {
                id: selection.dataId,
                documentos: []
              };

        const documentoIndex = dataAtual.documentos.findIndex((documento) => documento.id === selection.documentoId);
        const nextDocumentos = [...dataAtual.documentos];
        const documentoAtual =
          documentoIndex >= 0
            ? nextDocumentos[documentoIndex]
            : {
                id: selection.documentoId,
                nome: selected.documento?.nome ?? selection.documentoId,
                lotes: []
              };

        const loteIndex = documentoAtual.lotes.findIndex((lote) => lote.id === selection.loteId);
        const nextLotes = [...documentoAtual.lotes];
        const loteAtual =
          loteIndex >= 0
            ? nextLotes[loteIndex]
            : {
                id: selection.loteId,
                produto: snapshot.registro.produto ?? "Lote do dia",
                registros: []
              };

        const registroIndex = loteAtual.registros.findIndex((registro) => registro.id === selection.registroId);
        const registroBase =
          registroIndex >= 0
            ? loteAtual.registros[registroIndex]
            : {
                ...selected.registro,
                id: selection.registroId,
                processoId: selection.subregistroId,
                subregistros: []
              };

        const subregistroIndex = (registroBase.subregistros ?? []).findIndex((subregistro) => subregistro.id === selection.subregistroId);
        const nextSubregistros = [...(registroBase.subregistros ?? [])];
        const nextSubregistro = {
          ...(selected.subregistro ?? {}),
          ...(nextSubregistros[subregistroIndex] ?? {}),
          ...snapshot.subregistro,
          id: selection.subregistroId
        };

        if (subregistroIndex >= 0) {
          nextSubregistros[subregistroIndex] = nextSubregistro;
        } else {
          nextSubregistros.push(nextSubregistro);
        }

        const nextRegistro = {
          ...registroBase,
          ...snapshot.registro,
          id: selection.registroId,
          processoId: selection.subregistroId,
          subregistros: nextSubregistros
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
      })
    );
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
            <span className="app-brand-mark"><ShieldCheck size={24} /></span>
            <div>
              <h1 className="text-lg font-black tracking-tight text-cicopal-blue">CICOPAL</h1>
              <p className="text-xs font-semibold text-gray-500">Produzindo sabor de <strong className="text-cicopal-red">felicidade.</strong></p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
            <span className="hidden rounded-full bg-gray-100 px-3 py-2 text-gray-700 sm:inline">Olá, {loggedUser.nome}</span>
            <span className="rounded-full bg-blue-50 px-3 py-2 text-cicopal-blue">{loggedUser.perfil?.nome ?? "Operador"}</span>
            {canAccessConfigurator ? <Link href="/configurador" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-cicopal-blue px-3 py-2 text-white shadow-sm"><FileCog size={17} /> Configurador</Link> : null}
            <button type="button" className="min-h-10 border border-gray-200 bg-white px-3 py-2 text-gray-600" onClick={handleLogout}>
              Sair
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-4 px-4 py-4">
        <HierarchyNavigator
            tree={operationTree}
            selection={selection}
            selected={selected}
            onSelectionChange={setSelection}
            currentStep={currentStep}
            onStepChange={setCurrentStep}
          >
            {selected.registro ? (
              <Rg005SubregistroForm
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
