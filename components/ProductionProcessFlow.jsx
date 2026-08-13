"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Clock3, Factory, LockKeyhole, Pause, Play, Save, Square, X } from "lucide-react";
import { changeSubprocessState, ensureProductionSubprocesses, ROSCA_SUBPROCESSES, saveSubprocessRecord } from "@/lib/productionProcessPersistence";

const tones = { nao_iniciado: "border-gray-200 bg-gray-50", operando: "border-green-400 bg-green-50", pausado: "border-amber-400 bg-amber-50", parado: "border-red-400 bg-red-50", finalizado: "border-blue-300 bg-blue-50" };
const labels = { nao_iniciado: "Não iniciado", operando: "Operando", pausado: "Pausado", parado: "Parado", finalizado: "Finalizado" };
const formatTime = (value) => value ? new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";
function elapsed(start, now) { const seconds = start ? Math.max(0, Math.floor((now - new Date(start)) / 1000)) : 0; return [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60].map((v) => String(v).padStart(2, "0")).join(":"); }
function remaining(end, now) { if (!end) return "60:00"; const seconds = Math.max(0, Math.ceil((new Date(end) - now) / 1000)); return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; }
function localRows(cycleId) { return ROSCA_SUBPROCESSES.map((item, index) => ({ id: `${cycleId}-${item.code}`, ciclo_id: cycleId, codigo: item.code, nome: item.name, ordem: index + 1, equipamento: item.equipment, status: "nao_iniciado", versao: 1, subprocesso_eventos: [] })); }

export function ProductionProcessFlow({ cycle, operatorId }) {
  const storageKey = `carper-production-process-${cycle?.id}`;
  const [rows, setRows] = useState([]); const [records, setRecords] = useState([]); const [remote, setRemote] = useState(false);
  const [now, setNow] = useState(() => new Date()); const [selectedCode, setSelectedCode] = useState(""); const [reason, setReason] = useState("");
  const [values, setValues] = useState({}); const [saving, setSaving] = useState(false); const [message, setMessage] = useState("");
  const selected = rows.find((item) => item.codigo === selectedCode); const config = ROSCA_SUBPROCESSES.find((item) => item.code === selectedCode);
  const selectedRecords = useMemo(() => records.filter((item) => item.subprocesso_id === selected?.id).sort((a, b) => new Date(b.horario_referencia) - new Date(a.horario_referencia)), [records, selected?.id]);
  const currentRecord = selectedRecords[0];

  useEffect(() => {
    if (!cycle?.id) return; let active = true;
    ensureProductionSubprocesses(cycle.id, operatorId).then((result) => { if (!active) return; setRows(result.rows.length ? result.rows : localRows(cycle.id)); setRecords(result.records ?? []); setRemote(result.remote); }).catch(() => { if (active) { setRows(localRows(cycle.id)); setRemote(false); } });
    const timer = window.setInterval(() => setNow(new Date()), 1000); return () => { active = false; window.clearInterval(timer); };
  }, [cycle?.id, operatorId]);

  useEffect(() => {
    if (!currentRecord || !config) { setValues({}); return; }
    if (config.frequency === "production" || !currentRecord.janela_fim || new Date(currentRecord.janela_fim) > now) setValues(currentRecord.valores ?? {});
    else setValues({});
  }, [selectedCode]);

  const totals = useMemo(() => ({ operating: rows.filter((item) => item.status === "operando").length, stopped: rows.filter((item) => ["pausado", "parado"].includes(item.status)).length }), [rows]);
  function canStart(process) { const previous = rows.find((item) => item.ordem === process.ordem - 1); return Boolean(process.iniciado_em || process.status !== "nao_iniciado" || !previous || previous.iniciado_em); }
  async function setStatus(status) {
    if (!selected || saving) return; if (["pausado", "parado"].includes(status) && !reason.trim()) return setMessage("Informe o motivo da interrupção.");
    setSaving(true); setMessage(""); try { const updated = remote ? await changeSubprocessState({ process: selected, status, reason, operatorId }) : { ...selected, status, iniciado_em: status === "operando" ? selected.iniciado_em ?? new Date().toISOString() : selected.iniciado_em, estado_iniciado_em: new Date().toISOString(), versao: selected.versao + 1 }; setRows((all) => all.map((item) => item.id === selected.id ? { ...item, ...updated } : item)); setReason(""); } catch (error) { setMessage(error?.message ?? "Não foi possível alterar o estado."); } finally { setSaving(false); }
  }
  async function save() {
    if (config.parameters.some((item) => values[item.key] === undefined || values[item.key] === "")) return setMessage("Preencha todos os campos deste apontamento.");
    setSaving(true); setMessage(""); try {
      const saved = remote ? await saveSubprocessRecord({ process: selected, cycleId: cycle.id, values, operatorId, frequency: config.frequency }) : { id: Date.now(), subprocesso_id: selected.id, tipo: config.frequency === "production" ? "producao" : "horario", janela_indice: selectedRecords.length, horario_referencia: new Date().toISOString(), janela_inicio: new Date().toISOString(), janela_fim: new Date(Date.now() + 3600000).toISOString(), valores: values };
      setRecords((all) => [...all.filter((item) => !(item.subprocesso_id === selected.id && item.tipo === saved.tipo && item.janela_indice === saved.janela_indice)), saved]);
      setMessage(config.frequency === "production" ? "Lote vinculado a esta produção." : "Apontamento salvo na janela atual.");
    } catch (error) { setMessage(error?.message ?? "Não foi possível salvar."); } finally { setSaving(false); }
  }

  if (!cycle?.productionStartedAt) return <section className="border bg-gray-50 p-5 text-center"><Factory className="mx-auto text-gray-400" /><h3 className="mt-2 text-lg font-black">Processo produtivo complementar</h3><p className="font-semibold text-gray-500">Liberado após o start da produção.</p></section>;
  return <section className="border border-gray-300 bg-white p-4">
    <header className="flex flex-wrap justify-between gap-3"><div><p className="text-xs font-black uppercase text-cicopal-blue">RG.PROD.ROS.001 · parâmetros de teste</p><h2 className="text-2xl font-black">Fluxo produtivo</h2><p className="font-semibold text-gray-600">Lotes por produção e apontamentos em janelas móveis de 60 minutos.</p></div><div className="flex gap-2"><b className="bg-green-100 px-3 py-2 text-green-800">{totals.operating} operando</b><b className="bg-red-100 px-3 py-2 text-red-800">{totals.stopped} interrompido(s)</b></div></header>
    <div className="mt-6 overflow-x-auto pb-4"><div className="flex min-w-[940px] items-stretch">{rows.map((process, index) => { const cfg = ROSCA_SUBPROCESSES.find((item) => item.code === process.codigo); const processRecords = records.filter((item) => item.subprocesso_id === process.id); const latest = processRecords.at(-1); const unlocked = canStart(process); const active = process.status === "operando"; const complete = process.status === "finalizado"; return <div key={process.id} className="relative flex flex-1 items-stretch pr-5 last:pr-0">
      {index < rows.length - 1 ? <span className={`absolute left-1/2 right-0 top-6 h-1 ${process.iniciado_em ? "bg-cicopal-blue" : "bg-gray-200"}`} /> : null}
      <button onClick={() => { setSelectedCode(process.codigo); setMessage(""); }} className={`relative z-[1] w-full border p-3 pt-14 text-left transition ${tones[process.status]} ${active ? "-translate-y-1 border-cicopal-blue shadow-lg ring-2 ring-blue-100" : ""} ${!unlocked ? "opacity-55" : ""}`}>
        <span className={`absolute left-3 top-2 grid h-10 w-10 place-items-center border-4 border-white text-sm font-black shadow ${complete ? "bg-cicopal-blue text-white" : active ? "animate-pulse bg-green-600 text-white" : process.iniciado_em ? "bg-blue-100 text-cicopal-blue" : "bg-gray-200 text-gray-500"}`}>{complete ? <Check size={20} /> : !unlocked ? <LockKeyhole size={17} /> : index + 1}</span>
        <small className="font-black uppercase text-gray-500">{cfg?.frequency === "production" ? "Lote da produção" : "A cada 60 min"}</small><strong className="mt-1 block text-lg leading-tight">{process.nome}</strong><span className="mt-1 block text-xs font-bold text-gray-500">{process.equipamento}</span>
        <div className="mt-3 border-t pt-2"><b className={`block text-xs uppercase ${active ? "text-green-700" : "text-gray-600"}`}>{!unlocked ? "Aguardando etapa anterior" : labels[process.status]}</b>{process.iniciado_em ? <span className="font-mono text-base font-black">{elapsed(process.estado_iniciado_em, now)}</span> : <span className="text-xs font-semibold text-gray-400">Ainda não iniciada</span>}{latest ? <span className="mt-1 block text-[11px] font-bold text-green-700">{processRecords.length} apontamento(s) · {formatTime(latest.preenchido_em ?? latest.horario_referencia)}</span> : null}</div>
      </button></div>; })}</div></div>
    {selected && config ? <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-3"><article className="max-h-[94dvh] w-full max-w-3xl overflow-y-auto bg-white shadow-2xl"><header className="sticky top-0 z-10 flex justify-between border-b bg-white p-5"><div><p className="text-xs font-black uppercase text-cicopal-blue">{cycle.product} · {labels[selected.status]}</p><h3 className="text-2xl font-black">{selected.nome}</h3></div><button onClick={() => setSelectedCode("")}><X /></button></header><div className="p-5">
      <div className="grid grid-cols-4 gap-2"><button disabled={!canStart(selected) || saving} onClick={() => setStatus("operando")} className="min-h-14 bg-green-600 font-black text-white disabled:bg-gray-300"><Play className="mx-auto" size={19} />{selected.iniciado_em ? "Retomar" : "Iniciar"}</button><button disabled={selected.status !== "operando"} onClick={() => setStatus("pausado")} className="bg-amber-500 font-black text-white disabled:bg-gray-300"><Pause className="mx-auto" size={19} />Pausar</button><button disabled={selected.status !== "operando"} onClick={() => setStatus("parado")} className="bg-red-600 font-black text-white disabled:bg-gray-300"><Square className="mx-auto" size={18} />Parar</button><button disabled={!selected.iniciado_em} onClick={() => setStatus("finalizado")} className="bg-cicopal-blue font-black text-white disabled:bg-gray-300">Finalizar</button></div>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="mt-3 min-h-16 w-full border p-3" placeholder="Motivo obrigatório para pausa ou parada" />
      <section className="mt-5 border-t pt-5"><div className="flex items-start justify-between gap-3"><div className="flex gap-2"><Clock3 className="text-cicopal-blue" /><div><h4 className="font-black">{config.frequency === "production" ? "Lote desta produção" : "Janela produtiva atual"}</h4><p className="text-sm font-semibold text-gray-500">{config.frequency === "production" ? "Informação única, editável com rastreabilidade." : currentRecord?.janela_fim && new Date(currentRecord.janela_fim) > now ? `${formatTime(currentRecord.janela_inicio)}–${formatTime(currentRecord.janela_fim)}` : "O primeiro registro iniciará uma nova janela de 60 minutos."}</p></div></div>{config.frequency === "hourly" && currentRecord?.janela_fim && new Date(currentRecord.janela_fim) > now ? <b className="bg-blue-50 px-3 py-2 font-mono text-cicopal-blue">próxima em {remaining(currentRecord.janela_fim, now)}</b> : null}</div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">{config.parameters.map((parameter) => <label key={parameter.key} className={parameter.group ? "border-l-4 border-gray-200 pl-3" : ""}><span className="mb-1 block text-xs font-black uppercase text-gray-500">{parameter.label}</span><div className="flex border"><input type={parameter.type === "text" ? "text" : "number"} inputMode={parameter.type === "text" ? "text" : "decimal"} value={values[parameter.key] ?? ""} onChange={(e) => setValues((all) => ({ ...all, [parameter.key]: e.target.value }))} className="min-h-14 min-w-0 flex-1 px-3 text-lg font-bold" />{parameter.unit ? <span className="grid min-w-20 place-items-center bg-gray-100 px-2 text-sm font-black">{parameter.unit}</span> : null}</div></label>)}</div>
      {config.liveMetrics?.length && currentRecord ? <div className="mt-4 grid grid-cols-2 gap-2">{config.liveMetrics.map((metric) => <div key={metric.key} className="bg-slate-950 p-3 text-white"><small className="font-black uppercase text-slate-400">{metric.label}</small><strong className="block text-2xl">{((Number(values[metric.key] ?? currentRecord.valores?.[metric.key]) || 0) / (metric.divisor ?? 1)).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} <span className="text-sm">{metric.unit}</span></strong></div>)}</div> : null}
      <button disabled={saving || selected.status === "nao_iniciado"} onClick={save} className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 bg-cicopal-blue font-black text-white disabled:bg-gray-300"><Save size={20} />{config.frequency === "production" ? (currentRecord ? "Atualizar lote" : "Vincular lote") : (currentRecord?.janela_fim && new Date(currentRecord.janela_fim) > now ? "Atualizar janela atual" : "Iniciar janela de 60 minutos")}</button></section>
      {message ? <p className="mt-3 bg-blue-50 p-3 font-bold text-cicopal-blue"><AlertTriangle className="mr-2 inline" size={18} />{message}</p> : null}
    </div></article></div> : null}
  </section>;
}
