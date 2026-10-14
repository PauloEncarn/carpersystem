"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, Factory, PackageCheck, Search, Tag } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

function normalize(value = "") {
  return String(value).replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

function formatDateTime(value) {
  if (!value) return "Em consumo";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";
}

function hourLabel(value = "") {
  const match = String(value).trim().match(/^(\d{1,2})(?::|h\b|$)/i);
  return match ? `${String(Number(match[1])).padStart(2, "0")}:00` : "";
}

function possibleHours(value = "") {
  const match = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return [];
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return [];
  const first = `${String(hour).padStart(2, "0")}:00`;
  if (minute === 0 || hour === 23) return [first];
  return [first, `${String(hour + 1).padStart(2, "0")}:00`];
}

function traceWindowHour(photo, trace, recordHour) {
  return photo?.horario_referencia
    ?? trace?.horario_referencia
    ?? photo?.slot_referencia
    ?? trace?.slot_referencia
    ?? recordHour
    ?? "";
}

function inputSignature(input = {}) {
  return [input.lote, input.fornecedor, input.validade].map((value) => String(value ?? "").trim()).join("|");
}

function buildIngredientTimeline(records, entry) {
  const currentBatch = Math.max(...(entry.trace.bateladas ?? []).map((batch) => Number(batch.numero) || 0), 0);
  const batchMap = new Map();
  records
    .filter((item) => item.cycleId === entry.cycleId)
    .flatMap((item) => item.trace.bateladas ?? [])
    .forEach((batch) => {
      const key = batch.id ?? `numero-${batch.numero}`;
      const existing = batchMap.get(key);
      if (!existing || (batch.insumos?.length ?? 0) > (existing.insumos?.length ?? 0)) batchMap.set(key, batch);
    });
  const batches = [...batchMap.values()]
    .filter((batch) => !currentBatch || Number(batch.numero) <= currentBatch)
    .sort((first, second) => Number(first.numero) - Number(second.numero));
  const previousInputs = new Map();
  return batches.flatMap((batch, batchIndex) => {
    const changes = (batch.insumos ?? []).flatMap((input) => {
      const key = String(input.insumo ?? "Insumo");
      const previous = previousInputs.get(key);
      previousInputs.set(key, input);
      if (!previous || inputSignature(previous) !== inputSignature(input)) return [{ input, previous }];
      return [];
    });
    return changes.length ? [{ batch, initial: batchIndex === 0, changes }] : [];
  });
}

function TimelinePoint({ icon: Icon, tone = "blue", title, children, last = false }) {
  const tones = {
    blue: "border-cicopal-blue bg-blue-50 text-cicopal-blue",
    green: "border-emerald-600 bg-emerald-50 text-emerald-700",
    slate: "border-slate-400 bg-slate-50 text-slate-600",
  };
  return (
    <li className={`relative pl-12 ${last ? "" : "pb-7"}`}>
      {!last ? <span className="absolute left-[19px] top-10 h-[calc(100%-1.3rem)] w-px bg-slate-200" /> : null}
      <span className={`absolute left-0 top-0 grid size-10 place-items-center rounded-full border-2 ${tones[tone]}`}>
        <Icon size={18} strokeWidth={2.5} />
      </span>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.16em] text-slate-500">{title}</p>
        <div className="mt-1">{children}</div>
      </div>
    </li>
  );
}

function BiscuitTimeline({ entry, records }) {
  const { trace } = entry;
  const ingredientTimeline = buildIngredientTimeline(records, entry);
  return (
    <article className="overflow-hidden border border-slate-200 bg-white shadow-sm">
      <figure className="relative bg-slate-950">
        <img src={entry.photo.imagem} alt={`Evidência do lote ${trace.lote}`} className="h-72 w-full object-cover sm:h-96" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/75 to-transparent px-5 pb-5 pt-20 text-white sm:px-7">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-blue-200">Registro fotográfico · janela {entry.windowHour || "—"}</p>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-3xl font-black">{trace.lote}</h2><p className="mt-1 text-sm font-bold text-slate-200">Produzido em {trace.data_producao ?? "—"} · validade {trace.validade ?? "—"}</p></div><div className="flex gap-2 text-xs font-black"><span className="border border-white/40 bg-white/10 px-3 py-2">MÁQUINA {trace.maquina ?? "—"}</span><span className="border border-white/30 bg-slate-950/30 px-3 py-2">TURNO {trace.turno ?? "—"}</span></div></div>
        </div>
      </figure>
      <div className="p-5 sm:p-7">
        <div className="border-b border-slate-100 pb-5"><p className="text-[10px] font-black uppercase tracking-[.16em] text-cicopal-blue">Linha do tempo dos insumos</p><p className="mt-1 font-semibold text-slate-600">Apenas a composição inicial e as alterações de lote são exibidas.</p></div>
        <ol className="mt-6">
          <TimelinePoint icon={PackageCheck} title="Produto acabado" tone="green">
            <p className="font-bold text-slate-900">Foto registrada por {trace.responsavel || "Não informado"}.</p>
          </TimelinePoint>
          {ingredientTimeline.length ? ingredientTimeline.map((event, eventIndex) => (
            <TimelinePoint key={event.batch.id ?? event.batch.numero} icon={Factory} title={event.initial ? `Composição inicial · batelada ${event.batch.numero}` : `Alteração de insumo · batelada ${event.batch.numero}`} tone="blue" last={eventIndex === ingredientTimeline.length - 1}>
              <p className="font-bold text-slate-900">Em consumo: {formatDateTime(event.batch.consumo_iniciado_em)}{event.batch.consumida_em ? ` até ${formatDateTime(event.batch.consumida_em)}` : ""}</p>
              <div className="mt-3 divide-y divide-blue-100 border-y border-blue-100 bg-blue-50/60">
                {event.changes.map(({ input, previous }, index) => <div key={`${input.insumo}-${input.lote}-${index}`} className="px-3 py-2 text-sm"><strong className="text-slate-900">{input.insumo}</strong>{previous ? <p className="mt-1 font-semibold text-slate-600">Lote alterado de <span className="line-through">{previous.lote ?? "—"}</span> para <span className="font-black text-cicopal-blue">{input.lote ?? "—"}</span> · {input.fornecedor ?? "—"}</p> : <p className="mt-1 font-semibold text-slate-600">Lote inicial: <span className="font-black text-cicopal-blue">{input.lote ?? "—"}</span> · {input.fornecedor ?? "—"}</p>}</div>)}
              </div>
            </TimelinePoint>
          )) : <TimelinePoint icon={Clock3} title="Sem alterações de lote registradas" tone="slate" last><p className="text-sm font-semibold text-slate-600">Não há mudança de insumo vinculada às bateladas deste biscoito.</p></TimelinePoint>}
        </ol>
      </div>
    </article>
  );
}

export function TraceabilityLookup() {
  const [records, setRecords] = useState([]);
  const [query, setQuery] = useState("");
  const [time, setTime] = useState("");
  const [selectedHour, setSelectedHour] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      if (!isSupabaseConfigured || !supabase) {
        if (active) { setError("Supabase não configurado."); setLoading(false); }
        return;
      }
      try {
        const { data, error: queryError } = await supabase
          .from("preenchimentos")
          .select("id,ciclo_id,horario,preenchido_em,valores")
          .eq("contexto_tipo", "fotografico")
          .order("preenchido_em", { ascending: false })
          .limit(500);
        if (queryError) throw queryError;
        const entries = (data ?? []).flatMap((record) =>
          (record.valores?.fotografias ?? []).flatMap((photo, photoIndex) => {
            const traces = photo.rastreabilidades?.length
              ? photo.rastreabilidades
              : photo.rastreabilidade
                ? [photo.rastreabilidade]
                : [];
            return traces.map((trace, traceIndex) => ({
              id: `${record.id}-${photoIndex}-${traceIndex}`,
              cycleId: record.ciclo_id,
              photo,
              savedAt: record.preenchido_em,
              windowHour: traceWindowHour(photo, trace, record.horario),
              trace,
            }));
          }),
        ).filter((entry) => entry.trace.lote);
        if (active) setRecords(entries);
      } catch (loadError) {
        if (active) setError(loadError.message ?? "Não foi possível carregar a rastreabilidade.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  const lotMatches = useMemo(() => {
    const term = normalize(query);
    return term ? records.filter((entry) => normalize(entry.trace.lote).includes(term)) : [];
  }, [query, records]);

  const candidateHours = useMemo(() =>
    possibleHours(time).filter((hour) =>
      lotMatches.some((entry) => hourLabel(entry.windowHour) === hour),
    ),
  [time, lotMatches]);

  const filtered = useMemo(() => {
    if (!selectedHour) return [];
    return lotMatches.filter((entry) => hourLabel(entry.windowHour) === selectedHour);
  }, [lotMatches, selectedHour]);

  function updateLot(value) {
    setQuery(value);
    setSelectedHour("");
  }

  function updateTime(value) {
    setTime(value);
    setSelectedHour("");
  }

  return (
    <section className="mx-auto max-w-7xl">
      <header className="border-l-8 border-cicopal-blue bg-white px-5 py-6 shadow-sm sm:px-7">
        <p className="text-xs font-black uppercase tracking-[.16em] text-cicopal-blue">Consulta administrativa</p>
        <h1 className="mt-1 text-3xl font-black text-slate-950">Rastreabilidade por lote</h1>
        <p className="mt-2 max-w-3xl font-semibold text-slate-600">Informe o lote e o horário impresso. O sistema indicará a janela horária correspondente para reconstruir a origem do biscoito.</p>
        <div className="mt-5 grid max-w-2xl gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
          <label className="flex min-h-14 items-center gap-3 border border-slate-300 bg-slate-50 px-4 focus-within:border-cicopal-blue focus-within:bg-white">
            <Search className="text-cicopal-blue" size={21} />
            <input value={query} onChange={(event) => updateLot(event.target.value)} placeholder="Lote, por exemplo: D071001" className="min-w-0 flex-1 bg-transparent font-bold outline-none" />
          </label>
          <label className="flex min-h-14 items-center gap-3 border border-slate-300 bg-slate-50 px-4 focus-within:border-cicopal-blue focus-within:bg-white">
            <Clock3 className="text-cicopal-blue" size={20} />
            <input type="time" value={time} onChange={(event) => updateTime(event.target.value)} aria-label="Horário impresso" className="min-w-0 flex-1 bg-transparent font-bold outline-none" />
          </label>
        </div>
        {normalize(query) && time && candidateHours.length ? <div className="mt-4 border-t border-slate-200 pt-4"><p className="text-xs font-black uppercase tracking-[.14em] text-slate-500">Janelas com registro para este lote</p><div className="mt-2 flex flex-wrap gap-2">{candidateHours.map((hour) => <button type="button" key={hour} onClick={() => setSelectedHour(hour)} className={`min-h-11 border px-4 text-sm font-black transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cicopal-blue ${selectedHour === hour ? "border-cicopal-blue bg-cicopal-blue text-white" : "border-slate-300 bg-white text-slate-700 hover:border-cicopal-blue hover:text-cicopal-blue"}`}>{hour}</button>)}</div></div> : null}
      </header>
      <div className="mt-5">
        {loading ? <p className="border border-slate-200 bg-white p-6 font-bold text-slate-500">Carregando registros...</p> : null}
        {error ? <p role="alert" className="border-l-4 border-red-600 bg-red-50 p-4 font-bold text-red-800">{error}</p> : null}
        {!loading && !error && (!normalize(query) || !time) ? <div className="border border-dashed border-slate-300 bg-white p-10 text-center"><Tag className="mx-auto text-slate-400" /><h2 className="mt-3 text-xl font-black text-slate-800">Consulta pronta para iniciar</h2><p className="mt-1 font-semibold text-slate-500">Informe o lote e o horário impresso no produto.</p></div> : null}
        {!loading && !error && normalize(query) && time && !selectedHour && candidateHours.length ? <div className="border border-dashed border-slate-300 bg-white p-10 text-center"><Clock3 className="mx-auto text-slate-400" /><h2 className="mt-3 text-xl font-black text-slate-800">Escolha a janela horária</h2><p className="mt-1 font-semibold text-slate-500">Selecione uma das janelas com registro acima para ver a rastreabilidade.</p></div> : null}
        {!loading && !error && normalize(query) && time && !selectedHour && !candidateHours.length ? <div className="border border-dashed border-slate-300 bg-white p-10 text-center"><Tag className="mx-auto text-slate-400" /><h2 className="mt-3 text-xl font-black text-slate-800">Nenhuma janela encontrada</h2><p className="mt-1 font-semibold text-slate-500">Não há registro desse lote nos horários próximos ao horário informado.</p></div> : null}
        {!loading && !error && selectedHour && !filtered.length ? <div className="border border-dashed border-slate-300 bg-white p-10 text-center"><Tag className="mx-auto text-slate-400" /><h2 className="mt-3 text-xl font-black text-slate-800">Nenhum registro nessa janela</h2><p className="mt-1 font-semibold text-slate-500">Verifique o lote ou selecione o outro horário sugerido.</p></div> : null}
        <div className="space-y-5">
          {filtered.map((entry) => <BiscuitTimeline key={entry.id} entry={entry} records={records} />)}
        </div>
      </div>
    </section>
  );
}
