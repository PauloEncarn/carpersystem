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
  const match = String(value).match(/^(\d{1,2}):/);
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

function BiscuitTimeline({ entry }) {
  const { trace } = entry;
  const batches = trace.bateladas ?? [];
  return (
    <article className="overflow-hidden border border-slate-200 bg-white shadow-sm">
      <div className="grid lg:grid-cols-[260px_minmax(0,1fr)]">
        <figure className="border-b border-slate-200 bg-slate-100 lg:border-b-0 lg:border-r">
          <img src={entry.photo.imagem} alt={`Evidência do lote ${trace.lote}`} className="h-52 w-full object-cover lg:h-full lg:min-h-[340px]" />
          <figcaption className="border-t border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-600">
            Evidência fotográfica · janela {entry.windowHour || "—"}
          </figcaption>
        </figure>
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.16em] text-cicopal-blue">Linha do tempo do biscoito</p>
              <h2 className="mt-1 text-3xl font-black text-slate-950">{trace.lote}</h2>
            </div>
            <div className="flex gap-2 text-xs font-black">
              <span className="border border-blue-200 bg-blue-50 px-3 py-2 text-cicopal-blue">MÁQUINA {trace.maquina ?? "—"}</span>
              <span className="border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">TURNO {trace.turno ?? "—"}</span>
            </div>
          </div>
          <ol className="mt-6">
            <TimelinePoint icon={PackageCheck} title="Produto acabado" tone="green">
              <p className="font-bold text-slate-900">Produzido em {trace.data_producao ?? "—"} · validade {trace.validade ?? "—"}</p>
              <p className="mt-1 text-sm font-semibold text-slate-600">Janela de produção {entry.windowHour || "—"} · foto registrada por {trace.responsavel || "Não informado"}.</p>
            </TimelinePoint>
            {batches.length ? batches.map((batch, batchIndex) => (
              <TimelinePoint key={batch.id ?? batch.numero} icon={Factory} title={`Massa · batelada ${batch.numero}`} tone="blue" last={batchIndex === batches.length - 1}>
                <p className="font-bold text-slate-900">Em consumo: {formatDateTime(batch.consumo_iniciado_em)}{batch.consumida_em ? ` até ${formatDateTime(batch.consumida_em)}` : ""}</p>
                <div className="mt-3 divide-y divide-blue-100 border-y border-blue-100 bg-blue-50/60">
                  {(batch.insumos ?? []).map((input, index) => (
                    <div key={`${input.insumo}-${input.lote}-${index}`} className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1 px-3 py-2 text-sm">
                      <strong className="text-slate-900">{input.insumo}</strong>
                      <span className="font-bold text-slate-700">Lote {input.lote ?? "—"} · {input.fornecedor ?? "—"}</span>
                    </div>
                  ))}
                </div>
              </TimelinePoint>
            )) : (
              <TimelinePoint icon={Clock3} title="Massa não vinculada" tone="slate" last>
                <p className="text-sm font-semibold text-slate-600">Este é um registro anterior à vinculação automática da batelada.</p>
              </TimelinePoint>
            )}
          </ol>
        </div>
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

  const candidateHours = useMemo(() => possibleHours(time), [time]);
  const lotMatches = useMemo(() => {
    const term = normalize(query);
    return term ? records.filter((entry) => normalize(entry.trace.lote).includes(term)) : [];
  }, [query, records]);

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
        {normalize(query) && candidateHours.length ? <div className="mt-4 border-t border-slate-200 pt-4"><p className="text-xs font-black uppercase tracking-[.14em] text-slate-500">Horários possíveis para consulta</p><div className="mt-2 flex flex-wrap gap-2">{candidateHours.map((hour) => <button type="button" key={hour} onClick={() => setSelectedHour(hour)} className={`min-h-11 border px-4 text-sm font-black transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cicopal-blue ${selectedHour === hour ? "border-cicopal-blue bg-cicopal-blue text-white" : "border-slate-300 bg-white text-slate-700 hover:border-cicopal-blue hover:text-cicopal-blue"}`}>{hour}</button>)}</div></div> : null}
      </header>
      <div className="mt-5">
        {loading ? <p className="border border-slate-200 bg-white p-6 font-bold text-slate-500">Carregando registros...</p> : null}
        {error ? <p role="alert" className="border-l-4 border-red-600 bg-red-50 p-4 font-bold text-red-800">{error}</p> : null}
        {!loading && !error && (!normalize(query) || !time) ? <div className="border border-dashed border-slate-300 bg-white p-10 text-center"><Tag className="mx-auto text-slate-400" /><h2 className="mt-3 text-xl font-black text-slate-800">Consulta pronta para iniciar</h2><p className="mt-1 font-semibold text-slate-500">Informe o lote e o horário impresso no produto.</p></div> : null}
        {!loading && !error && normalize(query) && time && !selectedHour ? <div className="border border-dashed border-slate-300 bg-white p-10 text-center"><Clock3 className="mx-auto text-slate-400" /><h2 className="mt-3 text-xl font-black text-slate-800">Escolha a janela horária</h2><p className="mt-1 font-semibold text-slate-500">Selecione um dos horários possíveis acima para ver a rastreabilidade.</p></div> : null}
        {!loading && !error && selectedHour && !filtered.length ? <div className="border border-dashed border-slate-300 bg-white p-10 text-center"><Tag className="mx-auto text-slate-400" /><h2 className="mt-3 text-xl font-black text-slate-800">Nenhum registro nessa janela</h2><p className="mt-1 font-semibold text-slate-500">Verifique o lote ou selecione o outro horário sugerido.</p></div> : null}
        <div className="space-y-5">
          {filtered.map((entry) => <BiscuitTimeline key={entry.id} entry={entry} />)}
        </div>
      </div>
    </section>
  );
}
