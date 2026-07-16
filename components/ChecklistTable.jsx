"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { checklistGroups } from "@/lib/checklist";

function makeInitialState(groups = checklistGroups) {
  return groups.flatMap((group) =>
    group.items.map((item) => ({
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
        disposicaoFinal: ""
      }
    }))
  );
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
      ncOpen: avaliacao.av1 === "NC" || Boolean(nc),
      nc: {
        horario: nc?.horario ?? "",
        quantidade: nc?.quantidade ?? "",
        causa: nc?.causa ?? "",
        acao: nc?.acao ?? "",
        disposicaoImediata: nc?.disposicaoImediata ?? "",
        disposicaoFinal: nc?.disposicaoFinal ?? ""
      }
    };
  });
}

function StatusClickButton({ value, onChange }) {
  const lastTapRef = useRef(0);

  function handlePointerUp() {
    const now = Date.now();
    if (now - lastTapRef.current < 340) {
      onChange("NC");
    } else {
      onChange("C");
    }
    lastTapRef.current = now;
  }

  return (
    <button
      type="button"
      className={`inline-flex min-h-12 w-full touch-manipulation items-center justify-center rounded-md border px-3 font-bold ${
        value === "NC"
          ? "border-cicopal-red bg-cicopal-red text-white"
          : value === "C"
            ? "border-cicopal-green bg-cicopal-green text-white"
            : "border-green-200 bg-green-50 text-cicopal-green"
      }`}
      onPointerUp={handlePointerUp}
      title="Um clique confirma C. Dois cliques marcam NC."
    >
      {value || "C"}
    </button>
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
                <tr key={`${row.group}-${row.item}`} className={row.av1 === "NC" ? "bg-red-50" : "bg-white"}>
                  <td className="px-4 py-3 text-base font-semibold text-gray-950">{row.item}</td>
                  <td className="px-4 py-3">
                    <StatusClickButton value={row.av1} onChange={(value) => onChange(index, { av1: value })} />
                  </td>
                  <td className="px-4 py-3">
                    {row.av1 === "NC" ? (
                      <StatusClickButton value={row.av2} onChange={(value) => onChange(index, { av2: value })} />
                    ) : (
                      <span className="inline-flex min-h-12 w-full items-center justify-center rounded-md bg-gray-100 px-3 text-sm font-bold text-gray-500">
                        Bloqueada
                      </span>
                    )}
                  </td>
                </tr>
                {row.av1 === "NC" ? (
                  <tr key={`${row.group}-${row.item}-nc`} className="bg-red-50">
                    <td colSpan={3} className="px-4 pb-4">
                      <div className="rounded-md border border-red-200 bg-white p-3">
                        <div className="mb-3 flex items-center gap-2 font-bold text-cicopal-red">
                          <AlertTriangle size={18} />
                          Dados da nao conformidade
                        </div>
                        <div className="grid gap-3 md:grid-cols-3">
                          <label className="block">
                            <span className="mb-1 block text-xs font-bold uppercase text-gray-500">Horario</span>
                            <input
                              type="time"
                              className="min-h-12 w-full rounded-md border border-gray-300 px-3 font-semibold"
                              value={row.nc.horario}
                              onChange={(event) => updateNc(index, "horario", event.target.value)}
                            />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-xs font-bold uppercase text-gray-500">Quantidade</span>
                            <input
                              className="min-h-12 w-full rounded-md border border-gray-300 px-3 font-semibold"
                              value={row.nc.quantidade}
                              onChange={(event) => updateNc(index, "quantidade", event.target.value)}
                            />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-xs font-bold uppercase text-gray-500">Disposicao imediata</span>
                            <select
                              className="min-h-12 w-full rounded-md border border-gray-300 bg-white px-3 font-semibold"
                              value={row.nc.disposicaoImediata}
                              onChange={(event) => updateNc(index, "disposicaoImediata", event.target.value)}
                            >
                              <option value="">Selecionar</option>
                              <option>Bloqueado</option>
                              <option>Descarte</option>
                            </select>
                          </label>
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-3">
                          <label className="block">
                            <span className="mb-1 block text-xs font-bold uppercase text-gray-500">Causa</span>
                            <textarea
                              className="min-h-24 w-full rounded-md border border-gray-300 px-3 py-2 font-semibold"
                              value={row.nc.causa}
                              onChange={(event) => updateNc(index, "causa", event.target.value)}
                            />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-xs font-bold uppercase text-gray-500">Acao</span>
                            <textarea
                              className="min-h-24 w-full rounded-md border border-gray-300 px-3 py-2 font-semibold"
                              value={row.nc.acao}
                              onChange={(event) => updateNc(index, "acao", event.target.value)}
                            />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-xs font-bold uppercase text-gray-500">Disposicao final</span>
                            <textarea
                              className="min-h-24 w-full rounded-md border border-gray-300 px-3 py-2 font-semibold"
                              value={row.nc.disposicaoFinal}
                              onChange={(event) => updateNc(index, "disposicaoFinal", event.target.value)}
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

export function ChecklistTable({ documentName = "RG.QUA.005", loteId = "", registro, subregistro, groups = checklistGroups, onSave }) {
  const [rows, setRows] = useState(() => buildInitialRows(subregistro, groups));
  const [savedAt, setSavedAt] = useState("");

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        if (row.av1 === "C") acc.conformes += 1;
        if (row.av1 === "NC") acc.naoConformes += 1;
        return acc;
      },
      { conformes: 0, naoConformes: 0 }
    );
  }, [rows]);

  function updateRow(index, patch) {
    setRows((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        const next = { ...row, ...patch };
        if (patch.av1 === "C") {
          next.av2 = "";
          next.ncOpen = false;
          next.nc = {
            horario: "",
            quantidade: "",
            causa: "",
            acao: "",
            disposicaoImediata: "",
            disposicaoFinal: ""
          };
        }
        if (patch.av1 === "NC") {
          next.ncOpen = true;
        }
        return next;
      })
    );
  }

  function saveChecklist() {
    const avaliacoes = rows
      .filter((row) => row.av1 || row.av2)
      .map((row) => ({
        item: row.item,
        grupo: row.group,
        av1: row.av1,
        av2: row.av2
      }));
    const ncs = rows
      .filter((row) => row.av1 === "NC")
      .map((row, index) => ({
        id: `${registro?.id ?? loteId}-NC-${String(index + 1).padStart(2, "0")}`,
        item: row.item,
        grupo: row.group,
        status: row.av2 === "C" ? "Tratada" : "Aberta",
        horario: row.nc.horario || new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        quantidade: row.nc.quantidade || "-",
        descricao: `${row.item} marcado como NC na 1 AV`,
        causa: row.nc.causa || "Nao informada",
        acao: row.nc.acao || "Nao informada",
        disposicaoImediata: row.nc.disposicaoImediata || "Nao informada",
        disposicaoFinal: row.nc.disposicaoFinal || "Nao informada",
        operador: registro?.operador ?? "Operador logado",
        produto: registro?.produto ?? "-",
        assinaturaSupervisorAt: null
      }));

    onSave?.({
      avaliacoes,
      ncs
    });
    setSavedAt(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
  }

  return (
    <section className="rounded-md border border-gray-200 bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-950">Checklist {documentName}</h2>
          <p className="text-sm font-medium text-gray-600">
            {loteId} {registro ? `- ${registro.id} - Turno ${registro.turno} - ${registro.operador ?? "Operador"}` : ""}
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
          {savedAt ? `Registro gravado as ${savedAt}` : "As NCs entram na Central de NC ao gravar."}
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
