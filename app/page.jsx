"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { HierarchyNavigator } from "@/components/HierarchyNavigator";
import { LoginScreen } from "@/components/LoginScreen";
import { RgConfigurator } from "@/components/RgConfigurator";
import { Rg005SubregistroForm } from "@/components/Rg005SubregistroForm";
import { FileCog, ShieldCheck } from "lucide-react";
import { findSelection, getInitialSelection, rastreabilidadeTree } from "@/lib/rastreabilidade";

export default function HomePage() {
  const [workspace, setWorkspace] = useState("operacao");
  const [loggedUser, setLoggedUser] = useState(null);
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
    if (workspace === "configurador" && !canAccessConfigurator) {
      setWorkspace("operacao");
    }
  }, [workspace, canAccessConfigurator]);

  function handleLogout() {
    setWorkspace("operacao");
    setLoggedUser(null);
    setCurrentStep(1);
    setSelection(getInitialSelection(operationTree));
  }

  function openConfigurator() {
    if (!canAccessConfigurator) return;
    setWorkspace("configurador");
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

  if (!loggedUser) {
    return <LoginScreen onLogin={setLoggedUser} />;
  }

  return (
    <main className="min-h-screen bg-cicopal-surface">
      <header className="brand-header sticky top-0 z-10 text-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <ShieldCheck size={28} />
            <div>
              <h1 className="text-xl font-bold">CICOPAL</h1>
              <p className="text-xs font-semibold text-white/80">Produzindo sabor de felicidade</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
            <span className="rounded-md border border-white/40 px-3 py-2">Ola, {loggedUser.nome}</span>
            <span className="rounded-md bg-white px-3 py-2 text-cicopal-blue">{loggedUser.perfil?.nome ?? "Operador"}</span>
            <button type="button" className="min-h-10 rounded-md border border-white/50 px-3 py-2 text-white" onClick={handleLogout}>
              Sair
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-4 px-4 py-4">
        <div className="grid grid-cols-2 gap-2 rounded-md bg-gray-200 p-1">
          <button
            type="button"
            className={`inline-flex min-h-14 items-center justify-center gap-2 rounded-md px-4 text-base font-bold ${
              workspace === "operacao" ? "bg-cicopal-blue text-white" : "bg-white text-cicopal-blue"
            }`}
            onClick={() => setWorkspace("operacao")}
          >
            <ShieldCheck size={20} />
            Operacao
          </button>
          <button
            type="button"
            className={`inline-flex min-h-14 items-center justify-center gap-2 rounded-md px-4 text-base font-bold ${
              workspace === "configurador" ? "bg-cicopal-blue text-white" : "bg-white text-cicopal-blue"
            } disabled:bg-gray-100 disabled:text-gray-400`}
            onClick={openConfigurator}
            disabled={!canAccessConfigurator}
            title={canAccessConfigurator ? "Abrir configurador" : "Seu perfil nao acessa o configurador"}
          >
            <FileCog size={20} />
            Configurador
          </button>
        </div>

        {workspace === "configurador" ? (
          <RgConfigurator lines={rastreabilidadeTree} />
        ) : (
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
        )}
      </div>
    </main>
  );
}
