"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, Search, Tag } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

function normalize(value = "") {
  return String(value).replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
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
          (record.valores?.fotografias ?? []).map((photo, index) => ({
            id: `${record.id}-${index}`,
            photo,
            savedAt: record.preenchido_em,
            slot: record.horario,
            trace: photo.rastreabilidade ?? {},
          })),
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
    <section className="mx-auto max-w-6xl">
      <header className="border-l-8 border-cicopal-blue bg-white px-5 py-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[.16em] text-cicopal-blue">Consulta administrativa</p>
        <h1 className="mt-1 text-3xl font-black text-slate-950">Rastreabilidade por lote</h1>
        <p className="mt-2 max-w-2xl font-semibold text-slate-600">Localize a evidência fotográfica e os dados gerados no registro horário da Rosca.</p>
        <label className="mt-5 flex min-h-14 max-w-xl items-center gap-3 border border-slate-300 bg-slate-50 px-4 focus-within:border-cicopal-blue focus-within:bg-white">
          <Search className="text-cicopal-blue" size={21} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Informe o lote, por exemplo: 20261009-01" className="min-w-0 flex-1 bg-transparent font-bold outline-none" />
        </label>
      </header>
      <div className="mt-5">
        {loading ? <p className="border border-slate-200 bg-white p-6 font-bold text-slate-500">Carregando registros...</p> : null}
        {error ? <p role="alert" className="border-l-4 border-red-600 bg-red-50 p-4 font-bold text-red-800">{error}</p> : null}
        {!loading && !error && !filtered.length ? <div className="border border-dashed border-slate-300 bg-white p-10 text-center"><Tag className="mx-auto text-slate-400" /><h2 className="mt-3 text-xl font-black text-slate-800">Nenhum lote localizado</h2><p className="mt-1 font-semibold text-slate-500">Pesquise pelo lote completo ou por parte dele.</p></div> : null}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((entry) => <article key={entry.id} className="overflow-hidden border border-slate-200 bg-white shadow-sm"><img src={entry.photo.imagem} alt={`Evidência do lote ${entry.trace.lote}`} className="h-56 w-full bg-slate-100 object-cover" /><div className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-slate-500">Lote</p><h2 className="mt-1 text-xl font-black text-cicopal-blue">{entry.trace.lote}</h2></div><Camera size={21} className="text-slate-400" /></div><dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 pt-4 text-sm"><div><dt className="text-xs font-bold uppercase text-slate-400">Produção</dt><dd className="font-black text-slate-800">{entry.trace.data_producao ?? "—"}</dd></div><div><dt className="text-xs font-bold uppercase text-slate-400">Validade</dt><dd className="font-black text-slate-800">{entry.trace.validade ?? "—"}</dd></div><div><dt className="text-xs font-bold uppercase text-slate-400">Máquina / turno</dt><dd className="font-black text-slate-800">{entry.trace.maquina ?? "—"} · {entry.trace.turno ?? "—"}</dd></div><div><dt className="text-xs font-bold uppercase text-slate-400">Horário</dt><dd className="font-black text-slate-800">{entry.trace.horario ?? entry.slot ?? "—"}</dd></div></dl><p className="mt-4 border-t border-slate-100 pt-3 text-xs font-bold text-slate-500">Registrado por {entry.trace.responsavel || "Não informado"}</p></div></article>)}
        </div>
      </div>
    </section>
  );
}
