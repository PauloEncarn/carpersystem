"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { HierarchyNavigator } from "@/components/HierarchyNavigator";
import { RgConfigurator } from "@/components/RgConfigurator";
import { Rg005SubregistroForm } from "@/components/Rg005SubregistroForm";
import { FileCog, ShieldCheck } from "lucide-react";
import { findSelection, getInitialSelection, rastreabilidadeTree } from "@/lib/rastreabilidade";

export default function HomePage() {
  const [workspace, setWorkspace] = useState("operacao");
  const [selection, setSelection] = useState(() => getInitialSelection());
  const [currentStep, setCurrentStep] = useState(1);
  const currentStepRef = useRef(currentStep);
  const selected = useMemo(() => findSelection(selection), [selection]);

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
            <span className="rounded-md border border-white/40 px-3 py-2">Ola, Joao Silva</span>
            <span className="rounded-md bg-white px-3 py-2 text-cicopal-blue">OPERADOR</span>
            <button type="button" className="min-h-10 rounded-md border border-white/50 px-3 py-2 text-white">
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
            }`}
            onClick={() => setWorkspace("configurador")}
          >
            <FileCog size={20} />
            Configurador
          </button>
        </div>

        {workspace === "configurador" ? (
          <RgConfigurator lines={rastreabilidadeTree} />
        ) : (
          <HierarchyNavigator
            tree={rastreabilidadeTree}
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
              />
            ) : null}
          </HierarchyNavigator>
        )}
      </div>
    </main>
  );
}
