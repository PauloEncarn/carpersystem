"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock3, Factory, Pause, Play, Save, Square, X } from "lucide-react";
import { changeSubprocessState, ensureProductionSubprocesses, loadProductionSubprocesses, ROSCA_SUBPROCESSES, saveSubprocessHourlyRecord } from "@/lib/productionProcessPersistence";

const tones = {
  nao_iniciado: "border-gray-200 bg-gray-50 text-gray-500",
  operando: "border-green-300 bg-green-50 text-green-800",
  pausado: "border-amber-300 bg-amber-50 text-amber-900",
  parado: "border-red-300 bg-red-50 text-red-800",
  finalizado: "border-blue-200 bg-blue-50 text-cicopal-blue",
};
const labels = { nao_iniciado: "Não iniciado", operando: "Operando", pausado: "Pausado", parado: "Parado", finalizado: "Finalizado" };

function elapsed(start, now) {
  if (!start) return "00:00:00";
  const seconds = Math.max(0, Math.floor((now - new Date(start)) / 1000));
  return [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60].map((item) => String(item).padStart(2, "0")).join(":");
}

function localRows(cycleId) {
  return ROSCA_SUBPROCESSES.map((item, index) => ({ id: `${cycleId}-${item.code}`, ciclo_id: cycleId, codigo: item.code, nome: item.name, ordem: index + 1, equipamento: item.equipment, status: "nao_iniciado", estado_iniciado_em: new Date().toISOString(), versao: 1, subprocesso_eventos: [] }));
}

export function ProductionProcessFlow({ cycle, operatorId }) {
  const storageKey = `carper-production-process-${cycle?.id}`;
  const [rows, setRows] = useState([]);
  const [remote, setRemote] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [selectedCode, setSelectedCode] = useState("");
  const [reason, setReason] = useState("");
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const selected = rows.find((item) => item.codigo === selectedCode);
  const config = ROSCA_SUBPROCESSES.find((item) => item.code === selectedCode);

  useEffect(() => {
    if (!cycle?.id) return;
    let active = true;
    ensureProductionSubprocesses(cycle.id, operatorId).then((result) => {
      if (!active) return;
      const fallback = JSON.parse(window.localStorage.getItem(storageKey) ?? "null") ?? localRows(cycle.id);
      setRows(result.rows.length ? result.rows : fallback);
      setRemote(result.remote);
    }).catch(() => {
      if (!active) return;
      setRows(JSON.parse(window.localStorage.getItem(storageKey) ?? "null") ?? localRows(cycle.id));
      setRemote(false);
    });
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => { active = false; window.clearInterval(timer); };
  }, [cycle?.id, operatorId, storageKey]);

  useEffect(() => { if (rows.length && !remote) window.localStorage.setItem(storageKey, JSON.stringify(rows)); }, [remote, rows, storageKey]);

  const totals = useMemo(() => ({ operating: rows.filter((item) => item.status === "operando").length, stopped: rows.filter((item) => ["pausado", "parado"].includes(item.status)).length }), [rows]);

  function canFirstStart(process) {
    if (process.iniciado_em || process.status !== "nao_iniciado") return true;
    const previous = rows.find((item) => item.ordem === process.ordem - 1);
    return !previous || Boolean(previous.iniciado_em || previous.status === "finalizado");
  }

  async function setStatus(status) {
    if (!selected || saving) return;
    if (["pausado", "parado"].includes(status) && !reason.trim()) { setMessage("Informe o motivo da interrupção."); return; }
    setSaving(true); setMessage("");
    try {
      let updated;
      if (remote) updated = await changeSubprocessState({ process: selected, status, reason, operatorId });
      else updated = { ...selected, status, estado_iniciado_em: new Date().toISOString(), iniciado_em: status === "operando" ? (selected.iniciado_em ?? new Date().toISOString()) : selected.iniciado_em, encerrado_em: status === "finalizado" ? new Date().toISOString() : selected.encerrado_em, versao: selected.versao + 1, subprocesso_eventos: [...(selected.subprocesso_eventos ?? []), { id: Date.now(), status_anterior: selected.status, status_novo: status, motivo: reason, ocorrido_em: new Date().toISOString() }] };
      setRows((current) => current.map((item) => item.id === selected.id ? { ...item, ...updated } : item));
      setReason("");
    } catch (error) { setMessage(error?.message ?? "Não foi possível alterar o estado."); }
    finally { setSaving(false); }
  }

  async function saveHour() {
    if (!selected || config.parameters.some((item) => values[item.key] === undefined || values[item.key] === "")) { setMessage("Preencha todos os parâmetros do horário."); return; }
    setSaving(true); setMessage("");
    try {
      if (remote) await saveSubprocessHourlyRecord({ process: selected, cycleId: cycle.id, values, operatorId });
      else {
        const records = JSON.parse(window.localStorage.getItem(`${storageKey}-records`) ?? "[]");
        records.push({ subprocesso: selected.codigo, horario: new Date().toISOString(), valores: values });
        window.localStorage.setItem(`${storageKey}-records`, JSON.stringify(records));
      }
      setValues({}); setMessage("Registro horário salvo.");
    } catch (error) { setMessage(error?.message ?? "Falha ao salvar o horário."); }
    finally { setSaving(false); }
  }

  if (!cycle?.productionStartedAt) return <section className="border border-gray-200 bg-gray-50 p-5 text-center"><Factory className="mx-auto text-gray-400" /><h3 className="mt-2 text-lg font-black">Processo produtivo complementar</h3><p className="mt-1 font-semibold text-gray-500">Os subprocessos serão liberados após o start da produção.</p></section>;

  return <section className="border border-gray-300 bg-white p-4">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-cicopal-blue">RG.PROD.ROS.001 · dados iniciais fictícios</p><h2 className="mt-1 text-2xl font-black">Fluxo do processo produtivo</h2><p className="mt-1 font-semibold text-gray-600">Cada área possui estado, relógio, paradas e controles independentes.</p></div><div className="flex gap-2"><span className="bg-green-100 px-3 py-2 text-sm font-black text-green-800">{totals.operating} operando</span><span className="bg-red-100 px-3 py-2 text-sm font-black text-red-800">{totals.stopped} interrompido(s)</span></div></header>
    <div className="mt-5 flex gap-3 overflow-x-auto pb-3">{rows.map((process, index) => <div key={process.id} className="flex min-w-[230px] items-center gap-3"><button type="button" onClick={() => { setSelectedCode(process.codigo); setMessage(""); }} className={`min-h-40 w-full border-2 p-4 text-left ${tones[process.status]}`}><span className="text-xs font-black uppercase">Etapa {index + 1}</span><strong className="mt-2 block text-xl text-gray-950">{process.nome}</strong><span className="mt-1 block text-sm font-bold">{process.equipamento}</span><span className="mt-4 block text-xs font-black uppercase">{labels[process.status]}</span><span className="mt-1 block font-mono text-lg font-black">{elapsed(process.estado_iniciado_em, now)}</span></button>{index < rows.length - 1 ? <span className="text-2xl font-black text-gray-300">→</span> : null}</div>)}</div>
    {selected && config ? <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-3"><article className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto bg-white shadow-2xl"><header className="flex items-start justify-between border-b p-5"><div><p className="text-xs font-black uppercase text-cicopal-blue">{cycle.product} · {labels[selected.status]}</p><h3 className="text-2xl font-black">{selected.nome}</h3><p className="font-semibold text-gray-500">{selected.equipamento}</p></div><button type="button" onClick={() => setSelectedCode("")}><X /></button></header><div className="p-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><button disabled={!canFirstStart(selected) || saving} onClick={() => setStatus("operando")} className="min-h-14 bg-green-600 font-black text-white disabled:bg-gray-300"><Play className="mx-auto" size={20} />{selected.iniciado_em ? "Retomar" : "Iniciar"}</button><button disabled={selected.status !== "operando" || saving} onClick={() => setStatus("pausado")} className="min-h-14 bg-amber-500 font-black text-white disabled:bg-gray-300"><Pause className="mx-auto" size={20} />Pausar</button><button disabled={selected.status !== "operando" || saving} onClick={() => setStatus("parado")} className="min-h-14 bg-cicopal-red font-black text-white disabled:bg-gray-300"><Square className="mx-auto" size={18} />Parar</button><button disabled={!selected.iniciado_em || selected.status === "finalizado" || saving} onClick={() => setStatus("finalizado")} className="min-h-14 bg-cicopal-blue font-black text-white disabled:bg-gray-300">Finalizar</button></div>
      {!canFirstStart(selected) ? <p className="mt-3 border-l-4 border-amber-500 bg-amber-50 p-3 font-bold text-amber-900">Primeiro início bloqueado: a etapa anterior ainda não foi iniciada.</p> : null}
      <label className="mt-4 block"><span className="mb-1 block text-xs font-black uppercase text-gray-500">Motivo da pausa/parada</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} className="min-h-20 w-full border border-gray-300 p-3" placeholder="Obrigatório para pausar ou parar" /></label>
      <section className="mt-5 border-t pt-5"><div className="flex items-center gap-2"><Clock3 className="text-cicopal-blue" /><div><h4 className="font-black">Registro do horário atual</h4><p className="text-xs font-semibold text-gray-500">Parâmetros provisórios para validação do fluxo</p></div></div><div className="mt-3 grid gap-3 sm:grid-cols-2">{config.parameters.map((parameter) => <label key={parameter.key}><span className="mb-1 block text-xs font-black uppercase text-gray-500">{parameter.label}</span><div className="flex border border-gray-300"><input type="number" inputMode="decimal" value={values[parameter.key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [parameter.key]: event.target.value }))} className="min-h-14 min-w-0 flex-1 px-3 text-lg font-bold" /><span className="grid min-w-16 place-items-center bg-gray-100 font-black text-gray-600">{parameter.unit}</span></div></label>)}</div><button type="button" disabled={saving || selected.status === "nao_iniciado"} onClick={saveHour} className="mt-4 inline-flex min-h-14 w-full items-center justify-center gap-2 bg-cicopal-blue font-black text-white disabled:bg-gray-300"><Save size={20} />Salvar registro hora a hora</button></section>
      {message ? <p className={`mt-3 p-3 font-bold ${message.includes("salvo") ? "bg-green-50 text-green-800" : "bg-red-50 text-cicopal-red"}`}><AlertTriangle className="mr-2 inline" size={18} />{message}</p> : null}
    </div></article></div> : null}
  </section>;
}

