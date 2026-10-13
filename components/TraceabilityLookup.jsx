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
            Evidência fotográfica · {trace.horario ?? entry.slot ?? "—"}
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
              <p className="mt-1 text-sm font-semibold text-slate-600">Foto e rastreabilidade registradas às {trace.horario ?? entry.slot ?? "—"} por {trace.responsavel || "Não informado"}.</p>
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
              slot: record.horario,
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

  const filtered = useMemo(() => {
    const term = normalize(query);
    return term ? records.filter((entry) => normalize(entry.trace.lote).includes(term)) : records;
  }, [query, records]);

  return (
    <section className="mx-auto max-w-7xl">
      <header className="border-l-8 border-cicopal-blue bg-white px-5 py-6 shadow-sm sm:px-7">
        <p className="text-xs font-black uppercase tracking-[.16em] text-cicopal-blue">Consulta administrativa</p>
        <h1 className="mt-1 text-3xl font-black text-slate-950">Rastreabilidade por lote</h1>
        <p className="mt-2 max-w-3xl font-semibold text-slate-600">Localize o biscoito e acompanhe, em sequência, o registro fotográfico, a batelada em consumo e os lotes de insumos usados.</p>
        <label className="mt-5 flex min-h-14 max-w-xl items-center gap-3 border border-slate-300 bg-slate-50 px-4 focus-within:border-cicopal-blue focus-within:bg-white">
          <Search className="text-cicopal-blue" size={21} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Informe o lote, por exemplo: D071001" className="min-w-0 flex-1 bg-transparent font-bold outline-none" />
        </label>
      </header>
      <div className="mt-5">
        {loading ? <p className="border border-slate-200 bg-white p-6 font-bold text-slate-500">Carregando registros...</p> : null}
        {error ? <p role="alert" className="border-l-4 border-red-600 bg-red-50 p-4 font-bold text-red-800">{error}</p> : null}
        {!loading && !error && !filtered.length ? <div className="border border-dashed border-slate-300 bg-white p-10 text-center"><Tag className="mx-auto text-slate-400" /><h2 className="mt-3 text-xl font-black text-slate-800">Nenhum lote localizado</h2><p className="mt-1 font-semibold text-slate-500">Pesquise pelo lote completo ou por parte dele.</p></div> : null}
        <div className="space-y-5">
          {filtered.map((entry) => <BiscuitTimeline key={entry.id} entry={entry} />)}
        </div>
      </div>
    </section>
  );
}
