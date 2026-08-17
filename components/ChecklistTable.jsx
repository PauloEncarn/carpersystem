"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  Circle,
  XCircle,
} from "lucide-react";
import { checklistGroups } from "@/lib/checklist";

function makeInitialState(groups = checklistGroups) {
  return groups.reduce((acc, group) => {
    const rows = group.items.map((item) => ({
      group: group.title,
      item,
      av1: "",
      av2: "",
      ncOpen: false,
      nc: {
        horario: "",
        quantidade: "",
        causa: "",
        acao: "",
        disposicaoImediata: "",
        disposicaoFinal: "",
        fotoAntes: "",
      },
    }));

    return acc.concat(rows);
  }, []);
}

function buildInitialRows(subregistro, groups) {
  const avaliacoes = subregistro?.avaliacoes ?? [];
  const ncs = subregistro?.ncs ?? [];

  return makeInitialState(groups).map((row) => {
    const avaliacao = avaliacoes.find((entry) => entry.item === row.item);
    const nc = ncs.find((entry) => entry.item === row.item);
    if (!avaliacao && !nc) return row;

    return {
      ...row,
      av1: avaliacao.av1 ?? "",
      av2: avaliacao.av2 ?? "",
      ncOpen: ["N", "NC"].includes(avaliacao.av1) || Boolean(nc),
      nc: {
        horario: nc?.horario ?? "",
        quantidade: nc?.quantidade ?? "",
        causa: nc?.causa ?? "",
        acao: nc?.acao ?? "",
        disposicaoImediata: nc?.disposicaoImediata ?? "",
        disposicaoFinal: nc?.disposicaoFinal ?? "",
      },
    };
  });
}

function StatusClickButton({ value, onChange }) {
  return (
    <div className="grid min-w-64 grid-cols-3 gap-2">
      <button
        type="button"
        className={`min-h-14 rounded-xl border-2 text-base font-black ${value === "C" ? "border-cicopal-green bg-cicopal-green text-white" : "border-green-200 bg-green-50 text-cicopal-green"}`}
        onClick={() => onChange("C")}
      >
        C
      </button>
      <button
        type="button"
        className={`min-h-14 rounded-xl border-2 text-base font-black ${value === "N" || value === "NC" ? "border-cicopal-red bg-cicopal-red text-white" : "border-red-200 bg-red-50 text-cicopal-red"}`}
        onClick={() => onChange("N")}
      >
        N
      </button>
      <button
        type="button"
        className={`min-h-14 rounded-xl border-2 text-base font-black ${value === "NA" ? "border-gray-500 bg-gray-600 text-white" : "border-gray-300 bg-gray-100 text-gray-600"}`}
        onClick={() => onChange("NA")}
      >
        NA
      </button>
    </div>
  );
}

function ChecklistGroupTable({ title, rows, onChange }) {
  function updateNc(index, field, value) {
    const row = rows.find((entry) => entry.index === index)?.row;
    onChange(index, { nc: { ...(row?.nc ?? {}), [field]: value } });
  }

  return (
    <section className="overflow-hidden rounded-md border border-gray-200 bg-white">
      <div className="border-t-[5px] border-cicopal-blue bg-white px-4 py-3">
        <h3 className="text-lg font-bold text-cicopal-blue">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="audit-table min-w-[560px] text-left">
          <thead>
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="w-40 px-4 py-3">1 AV</th>
              <th className="w-40 px-4 py-3">2 AV</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ row, index }) => (
              <Fragment key={`${row.group}-${row.item}`}>
                <tr
                  key={`${row.group}-${row.item}`}
                  className={
                    ["N", "NC"].includes(row.av1) ? "bg-red-50" : "bg-white"
                  }
                >
                  <td className="px-4 py-3 text-base font-semibold text-gray-950">
                    {row.item}
                  </td>
                  <td className="px-4 py-3">
                    <StatusClickButton
                      value={row.av1}
                      onChange={(value) => onChange(index, { av1: value })}
                    />
                  </td>
                  <td className="px-4 py-3">
                    {["N", "NC"].includes(row.av1) ? (
                      <StatusClickButton
                        value={row.av2}
                        onChange={(value) => onChange(index, { av2: value })}
                      />
                    ) : (
                      <span className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-gray-100 px-3 text-sm font-bold text-gray-500">
                        Bloqueada
                      </span>
                    )}
                  </td>
                </tr>
                {["N", "NC"].includes(row.av1) ? (
                  <tr key={`${row.group}-${row.item}-nc`} className="bg-red-50">
                    <td colSpan={3} className="px-4 pb-4">
                      <div className="rounded-md border border-red-200 bg-white p-3">
                        <div className="mb-3 flex items-center gap-2 font-bold text-cicopal-red">
                          <AlertTriangle size={18} />
                          Dados da nao conformidade
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="block">
                            <span className="mb-1 block text-xs font-bold uppercase text-gray-500">
                              Quantidade
                            </span>
                            <input
                              className="min-h-12 w-full rounded-md border border-gray-300 px-3 font-semibold"
                              value={row.nc.quantidade}
                              onChange={(event) =>
                                updateNc(
                                  index,
                                  "quantidade",
                                  event.target.value,
                                )
                              }
                            />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-xs font-bold uppercase text-gray-500">
                              Disposicao imediata
                            </span>
                            <select
                              className="min-h-12 w-full rounded-md border border-gray-300 bg-white px-3 font-semibold"
                              value={row.nc.disposicaoImediata}
                              onChange={(event) =>
                                updateNc(
                                  index,
                                  "disposicaoImediata",
                                  event.target.value,
                                )
                              }
                            >
                              <option value="">Selecionar</option>
                              <option>Bloqueado</option>
                              <option>Descarte</option>
                            </select>
                          </label>
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-3">
                          <label className="block">
                            <span className="mb-1 block text-xs font-bold uppercase text-gray-500">
                              Causa
                            </span>
                            <textarea
                              className="min-h-24 w-full rounded-md border border-gray-300 px-3 py-2 font-semibold"
                              value={row.nc.causa}
                              onChange={(event) =>
                                updateNc(index, "causa", event.target.value)
                              }
                            />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-xs font-bold uppercase text-gray-500">
                              Acao
                            </span>
                            <textarea
                              className="min-h-24 w-full rounded-md border border-gray-300 px-3 py-2 font-semibold"
                              value={row.nc.acao}
                              onChange={(event) =>
                                updateNc(index, "acao", event.target.value)
                              }
                            />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-xs font-bold uppercase text-gray-500">
                              Disposicao final
                            </span>
                            <textarea
                              className="min-h-24 w-full rounded-md border border-gray-300 px-3 py-2 font-semibold"
                              value={row.nc.disposicaoFinal}
                              onChange={(event) =>
                                updateNc(
                                  index,
                                  "disposicaoFinal",
                                  event.target.value,
                                )
                              }
                            />
                          </label>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ChecklistTable({
  documentName = "RG.QUA.005",
  loteId = "",
  registro,
  subregistro,
  groups = checklistGroups,
  onSave,
  onNextStep,
  nextStepLabel = "Ir para a próxima etapa",
  stepByStep = false,
  flowTitle = "Higienização · RG 003",
  successTitle = "Higienização gravada com sucesso",
  confirmationLabel = "Confirmar registro",
  referenceEvaluations = [],
  referenceLabel = "Resultado da operação",
}) {
  const [rows, setRows] = useState(() => buildInitialRows(subregistro, groups));
  const [savedAt, setSavedAt] = useState("");
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(
      0,
      buildInitialRows(subregistro, groups).findIndex((row) => !row.av1),
    ),
  );
  const choiceTapRef = useRef({ value: "", at: 0 });

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        if (row.av1 === "C") acc.conformes += 1;
        if (["N", "NC"].includes(row.av1)) acc.naoConformes += 1;
        return acc;
      },
      { conformes: 0, naoConformes: 0 },
    );
  }, [rows]);

  function updateRow(index, patch) {
    setRows((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        const next = { ...row, ...patch };
        if (["C", "NA"].includes(patch.av1)) {
          next.av2 = "";
          next.ncOpen = false;
          next.nc = {
            horario: "",
            quantidade: "",
            causa: "",
            acao: "",
            disposicaoImediata: "",
        disposicaoFinal: "",
        fotoAntes: "",
          };
        }
        if (["N", "NC"].includes(patch.av1)) {
          next.ncOpen = true;
        }
        return next;
      }),
    );
  }

  function isRowComplete(row) {
    if (!row?.av1) return false;
    if (!["N", "NC"].includes(row.av1)) return true;
    return Boolean(
      row.nc?.fotoAntes &&
        row.nc?.causa?.trim() &&
        row.nc?.acao?.trim() &&
        row.nc?.disposicaoImediata,
    );
  }

  async function saveChecklist() {
    if (rows.some((row) => !isRowComplete(row))) return;
    const avaliacoes = rows
      .filter((row) => row.av1 || row.av2)
      .map((row) => ({
        item: row.item,
        grupo: row.group,
        av1: row.av1,
        av2: row.av2,
      }));
    const ncs = rows
      .filter((row) => ["N", "NC"].includes(row.av1))
      .map((row, index) => ({
        id: `${registro?.id ?? loteId}-NC-${String(index + 1).padStart(2, "0")}`,
        item: row.item,
        grupo: row.group,
        status: row.av2 === "C" ? "Tratada" : "Aberta",
        horario: new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        quantidade: row.nc.quantidade || "-",
        descricao: `${row.item} marcado como N na 1 AV`,
        causa: row.nc.causa || "Nao informada",
        acao: row.nc.acao || "Nao informada",
        disposicaoImediata: row.nc.disposicaoImediata || "Nao informada",
        disposicaoFinal: row.nc.disposicaoFinal || "Nao informada",
        fotoAntes: row.nc.fotoAntes || null,
        operador: registro?.operador ?? "",
        produto: registro?.produto ?? "-",
        assinaturaSupervisorAt: null,
      }));

    const confirmed = await onSave?.({
      avaliacoes,
      ncs,
    });
    if (confirmed === false) return;
    setSavedAt(
      new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
  }

  if (stepByStep) {
    if (savedAt) {
      return (
        <section className="mx-auto max-w-5xl border border-green-200 bg-white p-6 text-center shadow-sm">
          <CheckCircle2 size={46} className="mx-auto text-cicopal-green" />
          <p className="mt-4 text-xs font-bold uppercase tracking-wider text-cicopal-green">
            Registro confirmado
          </p>
          <h2 className="mt-1 text-2xl font-bold text-gray-950">
            {successTitle}
          </h2>
          <p className="mt-2 font-semibold text-gray-500">
            Confirmada às {savedAt}. Para alterar as respostas, abra novamente o
            registro e escolha “Editar registro”.
          </p>
          {onNextStep ? (
            <button
              type="button"
              className="mt-6 inline-flex min-h-16 items-center justify-center gap-2 bg-cicopal-blue px-6 text-lg font-bold text-white"
              onClick={onNextStep}
            >
              {nextStepLabel}
              <ArrowRight size={22} />
            </button>
          ) : null}
        </section>
      );
    }
    const row = rows[activeIndex];
    const reference = referenceEvaluations.find(
      (item) => item.item === row?.item,
    );
    const progress = rows.length
      ? Math.round(((activeIndex + 1) / rows.length) * 100)
      : 0;
    const groupRows = rows.filter((item) => item.group === row?.group);
    const groupPosition =
      groupRows.findIndex((item) => item.item === row?.item) + 1;
    const updateNc = (field, value) =>
      updateRow(activeIndex, { nc: { ...(row?.nc ?? {}), [field]: value } });
    function choose(value) {
      const now = Date.now();
      const isSecondTap =
        choiceTapRef.current.value === value &&
        now - choiceTapRef.current.at < 900;
      updateRow(activeIndex, { av1: value });
      choiceTapRef.current = { value, at: now };
      if (isSecondTap && ["C", "NA"].includes(value)) {
        if (activeIndex < rows.length - 1) setActiveIndex((index) => index + 1);
      }
    }
    return (
      <section className="checklist-focus mx-auto max-w-5xl overflow-hidden border border-gray-300 bg-white">
        <header className="border-b border-gray-200 bg-white p-4 md:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase text-cicopal-blue">
                {row?.group}
              </p>
              <h2 className="mt-1 text-xl font-bold text-gray-950">
                {flowTitle}
              </h2>
            </div>
            <span className="border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-600">
              {activeIndex + 1}/{rows.length}
            </span>
          </div>
          <div className="mt-4 h-2 overflow-hidden bg-gray-200">
            <div
              className="h-full bg-cicopal-blue transition-all"
              style={{ height: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-xs font-semibold text-gray-500">
            Item {groupPosition} de {groupRows.length} nesta seção
          </p>
        </header>
        <div className="p-4 md:p-6">
          <p className="text-sm font-bold uppercase text-gray-400">
            Verifique o item
          </p>
          <h3 className="mt-2 min-h-20 text-2xl font-bold leading-tight text-gray-950 md:text-3xl">
            {row?.item}
          </h3>
          {reference ? (
            <div className="mb-4 flex items-center justify-between gap-3 border-l-4 border-cicopal-blue bg-blue-50 p-3">
              <span>
                <span className="block text-xs font-black uppercase text-gray-500">{referenceLabel}</span>
                <strong className="text-sm text-gray-900">Registrado antes da sua inspeção</strong>
              </span>
              <span className={`min-w-14 px-3 py-2 text-center text-lg font-black ${reference.av1 === "C" ? "bg-cicopal-green text-white" : ["N", "NC"].includes(reference.av1) ? "bg-cicopal-red text-white" : "bg-gray-600 text-white"}`}>
                {reference.av1 || "—"}
              </span>
            </div>
          ) : null}
          <p className="mb-3 text-sm font-semibold text-gray-500">
            Toque duas vezes para confirmar. Conforme avança automaticamente.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              className={`min-h-24 rounded-md border-2 p-3 text-lg font-bold ${row?.av1 === "C" ? "border-cicopal-green bg-cicopal-green text-white" : "border-green-200 bg-white text-cicopal-green"}`}
              onClick={() => choose("C")}
            >
              <CheckCircle2 size={28} className="mx-auto mb-2" />
              Conforme
            </button>
            <button
              type="button"
              className={`min-h-24 border-2 p-3 text-lg font-bold ${["N", "NC"].includes(row?.av1) ? "border-cicopal-red bg-cicopal-red text-white" : "border-red-200 bg-white text-cicopal-red"}`}
              onClick={() => choose("N")}
            >
              <XCircle size={28} className="mx-auto mb-2" />N · Não conforme
            </button>
            <button
              type="button"
              className={`min-h-24 border-2 p-3 text-lg font-bold ${row?.av1 === "NA" ? "border-gray-600 bg-gray-600 text-white" : "border-gray-300 bg-gray-100 text-gray-600"}`}
              onClick={() => choose("NA")}
            >
              <Circle size={28} className="mx-auto mb-2" />
              NA · Não se aplica
            </button>
          </div>
          {["N", "NC"].includes(row?.av1) ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
              <div className="mb-3 flex items-center gap-2 font-black text-cicopal-red">
                <AlertTriangle size={20} />
                Detalhes da não conformidade
              </div>
              <p className="mb-3 text-sm font-semibold text-red-800">
                Data e horário serão registrados automaticamente pelo sistema.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="mb-1 block text-xs font-black uppercase text-gray-600">
                    Disposição imediata
                  </span>
                  <select
                    className="min-h-14 w-full rounded-xl border border-red-200 bg-white px-3 font-bold"
                    value={row.nc.disposicaoImediata}
                    onChange={(e) =>
                      updateNc("disposicaoImediata", e.target.value)
                    }
                  >
                    <option value="">Selecionar</option>
                    <option>Bloqueado</option>
                    <option>Descarte</option>
                    <option>Corrigido no local</option>
                  </select>
                </label>
                <label className="sm:col-span-2">
                  <span className="mb-1 block text-xs font-black uppercase text-gray-600">
                    O que foi encontrado?
                  </span>
                  <textarea
                    className="min-h-24 w-full rounded-xl border border-red-200 bg-white p-3 font-semibold"
                    value={row.nc.causa}
                    onChange={(e) => updateNc("causa", e.target.value)}
                  />
                </label>
                <label className="sm:col-span-2">
                  <span className="mb-1 block text-xs font-black uppercase text-gray-600">Foto da NC encontrada</span>
                  <span className="flex min-h-16 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-red-300 bg-white px-4 font-black text-cicopal-red">
                    <Camera size={22} /> {row.nc.fotoAntes ? "Foto registrada · tocar para substituir" : "Registrar evidência fotográfica"}
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => updateNc("fotoAntes", reader.result);
                      reader.readAsDataURL(file);
                    }} />
                  </span>
                  {row.nc.fotoAntes ? <img src={row.nc.fotoAntes} alt="Evidência da não conformidade" className="mt-2 max-h-52 w-full rounded-xl object-contain" /> : null}
                </label>
                <label className="sm:col-span-2">
                  <span className="mb-1 block text-xs font-black uppercase text-gray-600">
                    Ação realizada
                  </span>
                  <textarea
                    className="min-h-24 w-full rounded-xl border border-red-200 bg-white p-3 font-semibold"
                    value={row.nc.acao}
                    onChange={(e) => updateNc("acao", e.target.value)}
                  />
                </label>
              </div>
            </div>
          ) : null}
        </div>
        <footer className="sticky bottom-0 grid grid-cols-2 gap-3 border-t border-gray-200 bg-white p-4">
          <button
            type="button"
            disabled={activeIndex === 0}
            className="inline-flex min-h-16 items-center justify-center gap-2 rounded-2xl border border-gray-300 bg-white text-lg font-black text-gray-700 disabled:opacity-30"
            onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}
          >
            <ArrowLeft size={22} />
            Voltar
          </button>
          {activeIndex === rows.length - 1 ? (
            <button
              type="button"
              disabled={!isRowComplete(row)}
              className="inline-flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-cicopal-green text-lg font-black text-white disabled:bg-gray-300"
              onClick={saveChecklist}
            >
              <CheckCircle2 size={22} />
              {confirmationLabel}
            </button>
          ) : (
            <button
              type="button"
              disabled={!isRowComplete(row)}
              className="inline-flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-cicopal-blue text-lg font-black text-white disabled:bg-gray-300"
              onClick={() =>
                setActiveIndex((index) => Math.min(rows.length - 1, index + 1))
              }
            >
              Próximo item
              <ArrowRight size={22} />
            </button>
          )}
        </footer>
        {savedAt ? (
          <p className="bg-green-50 p-3 text-center text-sm font-black text-cicopal-green">
            Checklist gravado às {savedAt}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="rounded-md border border-gray-200 bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-950">
            Checklist {documentName}
          </h2>
          <p className="text-sm font-medium text-gray-600">
            {loteId}{" "}
            {registro
              ? `- ${registro.id} - Turno ${registro.turno} - ${registro.operador ?? "Operador"}`
              : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <span className="rounded-md bg-cicopal-green px-3 py-2 text-sm font-bold text-white">
            C {totals.conformes}
          </span>
          <span className="rounded-md bg-cicopal-red px-3 py-2 text-sm font-bold text-white">
            NC {totals.naoConformes}
          </span>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {groups.map((group) => (
          <ChecklistGroupTable
            key={group.id}
            title={group.title}
            rows={rows
              .map((row, index) => ({ row, index }))
              .filter(({ row }) => row.group === group.title)}
            onChange={updateRow}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4">
        <span className="text-sm font-bold text-gray-500">
          {savedAt
            ? `Registro gravado as ${savedAt}`
            : "As NCs entram na Central de NC ao gravar."}
        </span>
        <button
          type="button"
          className="inline-flex min-h-14 items-center justify-center rounded-md bg-cicopal-blue px-5 text-base font-bold text-white shadow-soft"
          onClick={saveChecklist}
        >
          Gravar registro
        </button>
      </div>
    </section>
  );
}
