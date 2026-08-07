"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Camera, CheckCircle2, Clock3, LoaderCircle, Radio, RefreshCw, X } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

const lineLayout = [
  { id: "PUR", name: "Pururuca", area: { left: "17%", top: "7%", width: "69%", height: "26%" } },
  { id: "SAL", name: "Salgadinho", area: { left: "13%", top: "31%", width: "73%", height: "27%" } },
  { id: "ROS", name: "Rosca", area: { left: "16%", top: "57%", width: "70%", height: "27%" } }
];
const processLabels = { higienizacao: "Higienização", produto_liberacao: "Liberação do produto", produto_avaliacao: "Avaliação do produto", processo: "Avaliação do processo", fotografico: "Registro fotográfico" };
const activeStatuses = new Set(["higienizacao", "aguardando_liberacao", "pronto", "produzindo", "bloqueado"]);
function localDayStart() { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(); }
function time(value) { return value ? new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"; }
function statusLabel(status) { return status === "produzindo" ? "Produzindo" : status === "bloqueado" ? "Bloqueada" : status === "encerrado" ? "Encerrada" : status ? "Preparação" : "Inativa"; }

async function loadLiveFactory() {
  if (!isSupabaseConfigured || !supabase) return [];
  const start = localDayStart();
  const { data: cycles, error: cycleError } = await supabase.from("ciclos_producao").select("*").gte("iniciado_em", start).order("iniciado_em", { ascending: false });
  if (cycleError) throw cycleError;
  const cycleIds = (cycles ?? []).map((item) => item.id);
  if (!cycleIds.length) return [];
  const [{ data: fillings, error: fillingError }, { data: ncs, error: ncError }] = await Promise.all([
    supabase.from("preenchimentos").select("id,ciclo_id,contexto_tipo,horario,valores,status,preenchido_em").in("ciclo_id", cycleIds).gte("preenchido_em", start).order("preenchido_em", { ascending: false }),
    supabase.from("ciclo_nao_conformidades").select("*").in("ciclo_id", cycleIds).gte("registrada_em", start).order("registrada_em", { ascending: false })
  ]);
  if (fillingError) throw fillingError;
  if (ncError) throw ncError;
  return (cycles ?? []).map((cycle) => {
    const records = (fillings ?? []).filter((item) => item.ciclo_id === cycle.id);
    const cycleNcs = (ncs ?? []).filter((item) => item.ciclo_id === cycle.id);
    const photos = records.flatMap((item) => (item.valores?.fotografias ?? []).map((photo) => ({ ...photo, filledAt: item.preenchido_em })));
    return { ...cycle, records, ncs: cycleNcs, photos };
  });
}

export function FactorySupervision() {
  const [now, setNow] = useState(() => new Date());
  const [cycles, setCycles] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [hoveredId, setHoveredId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  async function refresh() { setLoading(true); setError(""); try { setCycles(await loadLiveFactory()); } catch (problem) { setError(problem?.message ?? "Não foi possível consultar a fábrica."); } finally { setLoading(false); } }
  useEffect(() => { refresh(); const clock = window.setInterval(() => setNow(new Date()), 1000); const sync = window.setInterval(refresh, 30_000); return () => { window.clearInterval(clock); window.clearInterval(sync); }; }, []);
  const lines = useMemo(() => lineLayout.map((layout) => {
    const history = cycles.filter((cycle) => cycle.linha_id === layout.id);
    const active = history.find((cycle) => activeStatuses.has(cycle.status) && !cycle.encerrado_em);
    const latest = active ?? history[0];
    return { ...layout, cycle: latest, active: Boolean(active), records: latest?.records ?? [], ncs: latest?.ncs ?? [], photos: latest?.photos ?? [] };
  }), [cycles]);
  const selected = lines.find((line) => line.id === selectedId);
  const hovered = lines.find((line) => line.id === hoveredId);

  return <section className="relative min-h-[calc(100vh-112px)] overflow-hidden rounded-[28px] border border-gray-200 bg-[#e8edf1] shadow-xl">
    <div className="absolute left-5 top-5 z-20 flex items-center gap-3 rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-lg backdrop-blur"><span className="grid size-10 place-items-center rounded-xl bg-cicopal-blue text-white"><Radio size={20} /></span><div><p className="text-xs font-black uppercase tracking-wider text-gray-400">Planta Cicopal · dados do dia</p><p className="font-black tabular-nums text-gray-950">{now.toLocaleTimeString("pt-BR")} <span className="ml-2 text-xs text-gray-500">atualização automática</span></p></div></div>
    <button type="button" onClick={refresh} className="absolute right-5 top-5 z-20 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white bg-white/90 px-4 font-bold text-gray-700 shadow-lg"><RefreshCw size={17} className={loading ? "animate-spin" : ""} />Atualizar</button>
    <div className="relative min-h-[calc(100vh-112px)] overflow-x-auto p-2 pt-24 md:p-5 md:pt-24"><div className="relative mx-auto min-w-[820px] overflow-hidden rounded-2xl shadow-2xl"><img src="/images/fabrica-isometrica-cicopal.png" alt="Planta da fábrica Cicopal" className="block h-auto w-full" />{lines.map((line) => { const focused = selectedId === line.id || hoveredId === line.id; return <button key={line.id} type="button" style={line.area} onMouseEnter={() => setHoveredId(line.id)} onMouseLeave={() => setHoveredId("")} onClick={() => setSelectedId(line.id)} className={`absolute rounded-[28px] border-2 transition ${focused ? "border-white bg-white/10 shadow-[0_0_0_5px_rgba(30,34,168,.45)]" : "border-transparent"} ${!line.active ? "factory-inactive-hotspot" : ""}`}><span className={`absolute left-3 top-3 rounded-full px-3 py-2 text-xs font-black shadow-lg ${line.active ? "bg-white text-cicopal-blue" : "bg-gray-700 text-white"}`}>{line.name} · {statusLabel(line.cycle?.status)}</span>{line.ncs.length ? <span className="absolute right-3 top-3 rounded-full bg-cicopal-red px-3 py-2 text-xs font-black text-white shadow-lg">{line.ncs.length} NC</span> : null}</button>; })}</div>
      {loading ? <div className="absolute inset-0 z-30 grid place-items-center bg-white/55 backdrop-blur-sm"><span className="inline-flex items-center gap-3 rounded-2xl bg-white px-5 py-4 font-black text-cicopal-blue shadow-xl"><LoaderCircle className="animate-spin" />Consultando registros...</span></div> : null}
      {error ? <div className="absolute bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-xl bg-red-600 px-5 py-3 font-bold text-white shadow-xl">{error}</div> : null}
      {hovered ? <div className="pointer-events-none absolute right-6 top-24 z-20 hidden w-80 rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-2xl backdrop-blur md:block"><div className="flex items-start justify-between"><div><p className="text-xs font-black uppercase text-cicopal-blue">RG.QUA.BA.003</p><h3 className="text-xl font-black">Linha {hovered.name}</h3></div><span className={`rounded-full px-3 py-1 text-xs font-black ${hovered.active ? "bg-green-100 text-cicopal-green" : "bg-gray-100 text-gray-600"}`}>{statusLabel(hovered.cycle?.status)}</span></div><p className="mt-2 font-bold text-gray-600">{hovered.cycle?.produto ?? "Sem produção registrada hoje"}</p>{hovered.ncs.length ? <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 p-3 font-black text-cicopal-red"><AlertTriangle />{hovered.ncs.length} NC do dia</div> : <div className="mt-3 flex items-center gap-2 rounded-xl bg-green-50 p-3 font-black text-cicopal-green"><CheckCircle2 />Sem NC no ciclo</div>}<p className="mt-3 text-xs font-bold text-cicopal-blue">Clique para ver registros e fotos</p></div> : null}
      {selected ? <aside className="absolute bottom-5 left-5 z-30 max-h-[82%] w-[min(620px,calc(100%-2.5rem))] overflow-y-auto rounded-3xl border border-gray-200 bg-white/95 shadow-2xl backdrop-blur"><header className="sticky top-0 z-10 flex items-start justify-between border-b border-gray-200 bg-white/95 p-5"><div><p className="text-xs font-black uppercase tracking-wider text-cicopal-blue">Linha {selected.name} · {statusLabel(selected.cycle?.status)}</p><h2 className="mt-1 text-2xl font-black">{selected.cycle?.produto ?? "Sem produção hoje"}</h2><p className="mt-1 text-sm font-semibold text-gray-500">{selected.cycle?.metadata?.productionCode ?? "Nenhum ciclo encontrado"}</p></div><button type="button" className="grid size-11 place-items-center rounded-full bg-gray-100" onClick={() => setSelectedId("")}><X size={20} /></button></header><div className="space-y-5 p-5"><div className="grid grid-cols-3 gap-3"><Metric label="Último registro" value={time(selected.records[0]?.preenchido_em)} /><Metric label="Registros hoje" value={selected.records.length} /><Metric label="NCs hoje" value={selected.ncs.length} alert={selected.ncs.length > 0} /></div>{selected.photos[0] ? <section><Title icon={<Camera size={17} />} text="Último registro fotográfico" /><figure className="mt-2 overflow-hidden rounded-2xl border border-gray-200 bg-gray-100"><img src={selected.photos[0].imagem} alt="Último registro fotográfico" className="max-h-80 w-full object-contain" /><figcaption className="p-3 text-sm font-bold text-gray-700">{selected.photos[0].horario} {selected.photos[0].observacao ? `· ${selected.photos[0].observacao}` : ""}</figcaption></figure></section> : null}<section><Title icon={<Clock3 size={17} />} text="Últimos preenchimentos" /><div className="mt-2 space-y-2">{selected.records.slice(0, 8).map((record) => <article key={record.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 p-3"><div><p className="font-black text-gray-900">{processLabels[record.contexto_tipo] ?? record.contexto_tipo}</p><p className="text-xs font-semibold text-gray-500">{time(record.preenchido_em)}</p></div><span className={`rounded-full px-3 py-1 text-xs font-black ${record.status === "com_nc" ? "bg-red-100 text-cicopal-red" : "bg-green-100 text-cicopal-green"}`}>{record.status === "com_nc" ? "NC" : "Conforme"}</span></article>)}{!selected.records.length ? <p className="rounded-xl bg-gray-50 p-4 font-semibold text-gray-500">Nenhum preenchimento registrado hoje.</p> : null}</div></section>{selected.ncs.length ? <section><Title icon={<AlertTriangle size={17} />} text="Não conformidades do dia" /><div className="mt-2 space-y-2">{selected.ncs.map((nc) => <article key={nc.id} className="rounded-xl border border-red-100 bg-red-50 p-4"><div className="flex justify-between gap-3"><strong className="text-cicopal-red">{nc.descricao}</strong><span className="text-xs font-black uppercase text-red-700">{nc.status}</span></div><p className="mt-2 text-sm font-semibold text-red-900">Causa: {nc.causa}</p><p className="mt-1 text-sm font-semibold text-red-900">Ação: {nc.acao_tomada}</p></article>)}</div></section> : null}</div></aside> : null}
    </div>
  </section>;
}

function Metric({ label, value, alert }) { return <div className={`rounded-2xl p-3 text-center ${alert ? "bg-red-50" : "bg-gray-50"}`}><p className="text-[10px] font-black uppercase text-gray-400">{label}</p><p className={`mt-1 text-xl font-black ${alert ? "text-cicopal-red" : "text-gray-950"}`}>{value}</p></div>; }
function Title({ icon, text }) { return <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-gray-600">{icon}{text}</h3>; }
