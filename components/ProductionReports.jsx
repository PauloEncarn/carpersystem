"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock3,
  Download,
  LoaderCircle,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import { repairTextDeep } from "@/lib/textEncoding";

const lines = {
  PUR: { name: "Pururuca", rg: "RG.QUA.005" },
  SAL: { name: "Salgadinho", rg: "RG.QUA.004" },
  ROS: { name: "Rosca", rg: "RG.QUA.BA.003" },
};
const hourlyTypes = new Set(["produto_avaliacao", "processo", "fotografico"]);

function inputDate(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function periodBoundary(date, end = false) {
  return new Date(
    `${date}T${end ? "23:59:59.999" : "00:00:00"}-03:00`,
  ).toISOString();
}

function duration(start, end) {
  if (!start) return "—";
  const milliseconds = Math.max(
    0,
    new Date(end ?? Date.now()) - new Date(start),
  );
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  return `${hours}h ${String(minutes).padStart(2, "0")}min`;
}

function expectedHourCount(cycle) {
  if (!cycle.producao_iniciada_em) return 0;
  const start = new Date(cycle.producao_iniciada_em);
  const end = new Date(
    cycle.producao_encerrada_em ?? cycle.encerrado_em ?? Date.now(),
  );
  start.setMinutes(0, 0, 0);
  end.setMinutes(0, 0, 0);
  return Math.max(1, Math.floor((end - start) / 3_600_000) + 1);
}

function fillingSlot(filling) {
  return (
    filling.chave_slot ??
    filling.valores?._slotKey ??
    `${filling.preenchido_em?.slice(0, 10)}T${filling.horario}`
  );
}

function hourGroups(cycle) {
  const groups = new Map();
  for (const filling of cycle.fillings.filter((item) =>
    hourlyTypes.has(item.contexto_tipo),
  )) {
    const slot = fillingSlot(filling);
    const key = String(slot).includes("T")
      ? String(slot).slice(0, 13)
      : filling.horario?.slice(0, 2);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(filling);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, items]) => ({
      key,
      label: String(key).includes("T")
        ? new Date(`${key}:00:00`).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })
        : `${key}:00`,
      items,
    }));
}

function fillingDetails(filling) {
  const values = filling.valores ?? {};
  return [
    ...(values.apontamentos ?? []),
    ...(values.avaliacoes ?? []).map((item) => ({
      ...item,
      resultado: item.resultado ?? item.av1,
    })),
  ];
}

function summarize(cycle, fillings, genericNcs, events) {
  const cycleFillings = fillings.filter((item) => item.ciclo_id === cycle.id);
  const expectedHours = expectedHourCount(cycle);
  const expectedControls = expectedHours * hourlyTypes.size;
  const completedControls = new Set(
    cycleFillings
      .filter((item) => hourlyTypes.has(item.contexto_tipo))
      .map((item) => `${item.contexto_tipo}:${fillingSlot(item)}`),
  ).size;
  const embeddedNcs = cycleFillings.reduce(
    (total, item) => total + (item.valores?.ncs?.length ?? 0),
    0,
  );
  const cycleGenericNcs = genericNcs.filter(
    (item) => item.ciclo_id === cycle.id,
  );
  const embeddedNcItems = cycleFillings.flatMap((item) =>
    (item.valores?.ncs ?? []).map((nc) => ({
      ...nc,
      origem: item.contexto_tipo,
      horario: nc.horario ?? item.horario,
      registrada_em: item.preenchido_em,
    })),
  );
  const photos = cycleFillings.reduce(
    (total, item) => total + (item.valores?.fotografias?.length ?? 0),
    0,
  );
  const cycleEvents = events.filter((item) => item.ciclo_id === cycle.id);
  const operator = [...cycleEvents]
    .reverse()
    .find((item) => item.dados?.operador_nome)?.dados?.operador_nome;
  return {
    ...cycle,
    line: lines[cycle.linha_id] ?? { name: cycle.linha_id, rg: "—" },
    fillings: cycleFillings,
    hygiene: cycleFillings.some(
      (item) => item.contexto_tipo === "higienizacao",
    ),
    release: cycleFillings.some(
      (item) => item.contexto_tipo === "produto_liberacao",
    ),
    expectedHours,
    expectedControls,
    completedControls,
    compliance: expectedControls
      ? Math.min(100, Math.round((completedControls / expectedControls) * 100))
      : 0,
    ncCount: embeddedNcs + cycleGenericNcs.length,
    ncs: [...cycleGenericNcs, ...embeddedNcItems],
    photos,
    operator: operator ?? "Não identificado",
  };
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export function ProductionReports() {
  const initialStart = new Date();
  initialStart.setDate(initialStart.getDate() - 6);
  const [startDate, setStartDate] = useState(() => inputDate(initialStart));
  const [endDate, setEndDate] = useState(() => inputDate(new Date()));
  const [lineId, setLineId] = useState("ALL");
  const [product, setProduct] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [ncFilter, setNcFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase não configurado.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      let cycleQuery = supabase
        .from("ciclos_producao")
        .select("*")
        .gte("iniciado_em", periodBoundary(startDate))
        .lte("iniciado_em", periodBoundary(endDate, true))
        .order("iniciado_em", { ascending: false });
      const { data: cycles, error: cycleError } = await cycleQuery;
      if (cycleError) throw cycleError;
      const ids = (cycles ?? []).map((item) => item.id);
      if (!ids.length) {
        setData([]);
        return;
      }
      const [fillingsResult, ncsResult, eventsResult] = await Promise.all([
        supabase
          .from("preenchimentos")
          .select(
            "id,ciclo_id,contexto_tipo,horario,chave_slot,valores,status,preenchido_em,operador_id",
          )
          .in("ciclo_id", ids),
        supabase
          .from("ciclo_nao_conformidades")
          .select("*")
          .in("ciclo_id", ids),
        supabase
          .from("eventos_ciclo")
          .select("ciclo_id,tipo,descricao,ocorrido_em,operador_id,dados")
          .in("ciclo_id", ids),
      ]);
      if (fillingsResult.error) throw fillingsResult.error;
      if (ncsResult.error) throw ncsResult.error;
      if (eventsResult.error) throw eventsResult.error;
      setData(
        repairTextDeep(
          (cycles ?? []).map((cycle) =>
            summarize(
              cycle,
              fillingsResult.data ?? [],
              ncsResult.data ?? [],
              eventsResult.data ?? [],
            ),
          ),
        ),
      );
    } catch (problem) {
      setError(problem?.message ?? "Não foi possível gerar o relatório.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const productOptions = useMemo(
    () =>
      [
        ...new Set(
          data
            .filter((item) => lineId === "ALL" || item.linha_id === lineId)
            .map((item) => item.produto)
            .filter(Boolean),
        ),
      ].sort(
        (a, b) => a.localeCompare(b, "pt-BR"),
      ),
    [data, lineId],
  );
  const filteredData = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return data.filter((item) => {
      if (lineId !== "ALL" && item.linha_id !== lineId) return false;
      if (product !== "ALL" && item.produto !== product) return false;
      if (status === "ACTIVE" && item.encerrado_em) return false;
      if (status === "FINISHED" && !item.encerrado_em) return false;
      if (ncFilter === "WITH" && !item.ncCount) return false;
      if (ncFilter === "WITHOUT" && item.ncCount) return false;
      if (!term) return true;
      return [
        item.produto,
        item.metadata?.productionCode,
        item.operator,
        item.line.name,
        item.line.rg,
      ].some((value) =>
        String(value ?? "")
          .toLocaleLowerCase("pt-BR")
          .includes(term),
      );
    });
  }, [data, lineId, product, status, ncFilter, search]);

  const totals = useMemo(
    () => ({
      cycles: filteredData.length,
      active: filteredData.filter((item) => !item.encerrado_em).length,
      ncs: filteredData.reduce((total, item) => total + item.ncCount, 0),
      photos: filteredData.reduce((total, item) => total + item.photos, 0),
      compliance: filteredData.length
        ? Math.round(
            filteredData.reduce((total, item) => total + item.compliance, 0) /
              filteredData.length,
          )
        : 0,
    }),
    [filteredData],
  );
  const groupedData = useMemo(
    () =>
      Object.entries(lines).map(([id, line]) => ({
        id,
        ...line,
        products: Object.entries(
          filteredData
            .filter((cycle) => cycle.linha_id === id)
            .reduce((result, cycle) => {
              (result[cycle.produto] ??= []).push(cycle);
              return result;
            }, {}),
        ).map(([product, cycles]) => ({ product, cycles })),
      })),
    [filteredData],
  );

  function exportCsv() {
    const headers = [
      "Linha",
      "RG",
      "Código",
      "Produto",
      "Início do ciclo",
      "Início da produção",
      "Fim da produção",
      "Status",
      "Operador",
      "Higienização",
      "Liberação",
      "Controles esperados",
      "Controles preenchidos",
      "Cumprimento (%)",
      "NCs",
      "Fotos",
    ];
    const rows = filteredData.map((item) => [
      item.line.name,
      item.line.rg,
      item.metadata?.productionCode,
      item.produto,
      new Date(item.iniciado_em).toLocaleString("pt-BR"),
      item.producao_iniciada_em
        ? new Date(item.producao_iniciada_em).toLocaleString("pt-BR")
        : "",
      item.producao_encerrada_em
        ? new Date(item.producao_encerrada_em).toLocaleString("pt-BR")
        : "",
      item.status,
      item.operator,
      item.hygiene ? "Sim" : "Não",
      item.release ? "Sim" : "Não",
      item.expectedControls,
      item.completedControls,
      item.compliance,
      item.ncCount,
      item.photos,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map(csvCell).join(";"))
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `relatorio-producao-${startDate}-${endDate}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <section className="border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-cicopal-blue">
              Rastreabilidade por ciclo
            </p>
            <h2 className="mt-1 text-2xl font-bold text-gray-950">
              Relatório de produção
            </h2>
            <p className="mt-1 font-semibold text-gray-500">
              Cada linha é calculada separadamente pelo ciclo oficial do
              Supabase.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <label>
              <span className="mb-1 block text-xs font-bold uppercase text-gray-500">
                De
              </span>
              <input
                type="date"
                className="min-h-12 border border-gray-300 px-3"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold uppercase text-gray-500">
                Até
              </span>
              <input
                type="date"
                className="min-h-12 border border-gray-300 px-3"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold uppercase text-gray-500">
                Linha
              </span>
              <select
                className="min-h-12 border border-gray-300 bg-white px-3"
                value={lineId}
                onChange={(event) => {
                  setLineId(event.target.value);
                  setProduct("ALL");
                }}
              >
                <option value="ALL">Todas</option>
                {Object.entries(lines).map(([id, item]) => (
                  <option key={id} value={id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="mt-4 grid gap-3 border-t border-gray-200 pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <label>
            <span className="mb-1 block text-xs font-bold uppercase text-gray-500">
              Produto
            </span>
            <select
              className="min-h-12 w-full border border-gray-300 bg-white px-3"
              value={product}
              onChange={(event) => setProduct(event.target.value)}
            >
              <option value="ALL">Todos os produtos</option>
              {productOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-bold uppercase text-gray-500">
              Situação da produção
            </span>
            <select
              className="min-h-12 w-full border border-gray-300 bg-white px-3"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="ALL">Todas</option>
              <option value="ACTIVE">Em andamento</option>
              <option value="FINISHED">Encerradas</option>
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-bold uppercase text-gray-500">
              Não conformidade
            </span>
            <select
              className="min-h-12 w-full border border-gray-300 bg-white px-3"
              value={ncFilter}
              onChange={(event) => setNcFilter(event.target.value)}
            >
              <option value="ALL">Com ou sem NC</option>
              <option value="WITH">Somente com NC</option>
              <option value="WITHOUT">Somente sem NC</option>
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-bold uppercase text-gray-500">
              Buscar produção
            </span>
            <span className="flex min-h-12 items-center border border-gray-300 bg-white px-3 focus-within:border-cicopal-blue">
              <Search size={18} className="shrink-0 text-gray-400" />
              <input
                type="search"
                className="min-w-0 flex-1 border-0 bg-transparent px-2 outline-none"
                placeholder="Código, operador..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </span>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4">
          <div className="flex items-center gap-3">
            <strong className="text-sm text-gray-700">
              {filteredData.length} produção(ões) encontrada(s)
            </strong>
            {(lineId !== "ALL" ||
              product !== "ALL" ||
              status !== "ALL" ||
              ncFilter !== "ALL" ||
              search) && (
              <button
                type="button"
                onClick={() => {
                  setLineId("ALL");
                  setProduct("ALL");
                  setStatus("ALL");
                  setNcFilter("ALL");
                  setSearch("");
                }}
                className="inline-flex min-h-10 items-center gap-1 px-2 font-bold text-cicopal-blue"
              >
                <X size={17} /> Limpar filtros
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 bg-cicopal-blue px-5 font-bold text-white"
          >
            <RefreshCw size={18} />
            Atualizar relatório
          </button>
          <button
            type="button"
            disabled={!filteredData.length}
            onClick={exportCsv}
            className="inline-flex items-center gap-2 border border-gray-300 bg-white px-5 font-bold text-gray-700 disabled:opacity-40"
          >
            <Download size={18} />
            Exportar CSV
          </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric icon={<Clock3 />} label="Produções" value={totals.cycles} />
        <Metric icon={<CheckCircle2 />} label="Ativas" value={totals.active} />
        <Metric
          icon={<CheckCircle2 />}
          label="Cumprimento médio"
          value={`${totals.compliance}%`}
        />
        <Metric
          icon={<AlertTriangle />}
          label="Não conformidades"
          value={totals.ncs}
          alert={totals.ncs > 0}
        />
        <Metric icon={<Camera />} label="Fotos" value={totals.photos} />
      </section>

      <section className="overflow-hidden border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-64 items-center justify-center gap-3 font-bold text-cicopal-blue">
            <LoaderCircle className="animate-spin" />
            Calculando indicadores...
          </div>
        ) : error ? (
          <div className="m-5 border border-red-200 bg-red-50 p-4 font-bold text-cicopal-red">
            {error}
          </div>
        ) : !filteredData.length ? (
          <div className="p-10 text-center font-semibold text-gray-500">
            Nenhuma produção encontrada com os filtros selecionados.
          </div>
        ) : (
          <div className="space-y-4 bg-gray-100 p-4">
            {groupedData
              .filter((line) => line.products.length)
              .map((line) => (
                <section
                  key={line.id}
                  className="border border-gray-200 bg-white"
                >
                  <header className="flex items-center justify-between bg-gray-950 p-4 text-white">
                    <div>
                      <p className="text-xs font-bold uppercase text-blue-200">
                        {line.rg}
                      </p>
                      <h3 className="text-2xl font-bold">Linha {line.name}</h3>
                    </div>
                    <span className="bg-white/10 px-3 py-2 text-sm font-bold">
                      {line.products.reduce(
                        (total, product) => total + product.cycles.length,
                        0,
                      )}{" "}
                      produção(ões)
                    </span>
                  </header>
                  <div className="space-y-3 p-3">
                    {line.products.map((product) => (
                      <details
                        key={product.product}
                        open
                        className="border border-gray-200 bg-gray-50"
                      >
                        <summary className="flex cursor-pointer list-none items-center justify-between p-4">
                          <span>
                            <small className="block font-bold uppercase text-cicopal-blue">
                              Produto
                            </small>
                            <strong className="text-xl text-gray-950">
                              {product.product}
                            </strong>
                          </span>
                          <span className="font-bold text-gray-500">
                            {product.cycles.length} produção(ões)
                          </span>
                        </summary>
                        <div className="space-y-3 border-t border-gray-200 p-3">
                          {product.cycles.map((cycle) => (
                            <details
                              key={cycle.id}
                              className="border border-gray-200 bg-white"
                            >
                              <summary className="grid cursor-pointer list-none gap-3 p-4 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
                                <div>
                                  <small className="font-bold uppercase text-gray-400">
                                    Produção
                                  </small>
                                  <strong className="block font-mono text-cicopal-blue">
                                    {cycle.metadata?.productionCode ?? cycle.id}
                                  </strong>
                                  <span className="text-sm font-semibold text-gray-500">
                                    {new Date(cycle.iniciado_em).toLocaleString(
                                      "pt-BR",
                                    )}
                                  </span>
                                </div>
                                <div>
                                  <small className="font-bold uppercase text-gray-400">
                                    Duração
                                  </small>
                                  <strong className="block">
                                    {duration(
                                      cycle.producao_iniciada_em,
                                      cycle.producao_encerrada_em ??
                                        cycle.encerrado_em,
                                    )}
                                  </strong>
                                  <span className="text-sm text-gray-500">
                                    {cycle.operator}
                                  </span>
                                </div>
                                <div>
                                  <small className="font-bold uppercase text-gray-400">
                                    Cumprimento
                                  </small>
                                  <strong
                                    className={
                                      cycle.compliance < 100
                                        ? "block text-amber-700"
                                        : "block text-cicopal-green"
                                    }
                                  >
                                    {cycle.compliance}% ·{" "}
                                    {cycle.completedControls}/
                                    {cycle.expectedControls}
                                  </strong>
                                  <span className="text-sm text-gray-500">
                                    {cycle.expectedHours} horário(s)
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={
                                      cycle.ncCount
                                        ? "bg-red-100 px-2 py-1 text-sm font-bold text-cicopal-red"
                                        : "bg-green-100 px-2 py-1 text-sm font-bold text-cicopal-green"
                                    }
                                  >
                                    {cycle.ncCount} NC
                                  </span>
                                  <span className="bg-blue-50 px-2 py-1 text-sm font-bold text-cicopal-blue">
                                    {cycle.photos} foto(s)
                                  </span>
                                </div>
                              </summary>
                              <div className="border-t border-gray-200 p-4">
                                <div className="mb-4 grid gap-2 sm:grid-cols-2">
                                  <Status
                                    ok={cycle.hygiene}
                                    text="Higienização confirmada"
                                  />
                                  <Status
                                    ok={cycle.release}
                                    text="Liberação confirmada"
                                  />
                                </div>
                                {cycle.ncs.length ? (
                                  <details className="mb-4 border border-red-200 bg-red-50">
                                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
                                      <span className="inline-flex items-center gap-2 font-black text-cicopal-red">
                                        <AlertTriangle size={19} /> Não conformidades da produção
                                      </span>
                                      <span className="bg-cicopal-red px-3 py-1 text-xs font-black text-white">
                                        {cycle.ncs.length} ocorrência(s) · expandir
                                      </span>
                                    </summary>
                                    <div className="grid gap-3 border-t border-red-200 p-3 lg:grid-cols-2">
                                      {cycle.ncs.map((nc, index) => (
                                        <article key={nc.id ?? index} className="border-l-4 border-cicopal-red bg-white p-4 shadow-sm">
                                          <div className="flex flex-wrap items-center justify-between gap-2">
                                            <span className="bg-red-100 px-2 py-1 text-xs font-black uppercase text-cicopal-red">{nc.status ?? "Aberta"}</span>
                                            <span className="text-xs font-bold text-gray-500">{nc.registrada_em ? new Date(nc.registrada_em).toLocaleString("pt-BR") : nc.horario}</span>
                                          </div>
                                          <h5 className="mt-3 font-black text-gray-950">{nc.item ?? nc.descricao}</h5>
                                          <p className="mt-1 text-sm font-semibold text-gray-600">{nc.descricao}</p>
                                          <dl className="mt-3 grid gap-2 border-t border-gray-100 pt-3 text-sm sm:grid-cols-2">
                                            <div><dt className="text-xs font-bold uppercase text-gray-400">Quantidade</dt><dd className="font-bold">{nc.quantidade ?? "—"}</dd></div>
                                            <div><dt className="text-xs font-bold uppercase text-gray-400">Contexto</dt><dd className="font-bold">{nc.origem ?? "Produção"}</dd></div>
                                            <div><dt className="text-xs font-bold uppercase text-gray-400">Causa</dt><dd className="font-bold">{nc.causa ?? "Não informada"}</dd></div>
                                            <div><dt className="text-xs font-bold uppercase text-gray-400">Ação tomada</dt><dd className="font-bold">{nc.acao_tomada ?? nc.acao ?? "Não informada"}</dd></div>
                                          </dl>
                                        </article>
                                      ))}
                                    </div>
                                  </details>
                                ) : null}
                                <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-500">
                                  Especificações hora a hora
                                </h4>
                                <div className="space-y-2">
                                  {hourGroups(cycle).map((hour) => (
                                    <details
                                      key={hour.key}
                                      className="border border-gray-200 bg-gray-50"
                                    >
                                      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-3">
                                        <strong className="text-lg tabular-nums text-gray-950">
                                          {hour.label}
                                        </strong>
                                        <span className="text-sm font-bold text-gray-500">
                                          {hour.items.length}/3 controles ·
                                          toque para detalhes
                                        </span>
                                      </summary>
                                      <div className="grid gap-3 border-t border-gray-200 p-3 lg:grid-cols-3">
                                        {[
                                          "produto_avaliacao",
                                          "processo",
                                          "fotografico",
                                        ].map((type) => {
                                          const filling = hour.items.find(
                                            (item) =>
                                              item.contexto_tipo === type,
                                          );
                                          const label = {
                                            produto_avaliacao:
                                              "Avaliação do produto",
                                            processo: "Avaliação do processo",
                                            fotografico: "Registro fotográfico",
                                          }[type];
                                          return (
                                            <article
                                              key={type}
                                              className={`border p-3 ${filling ? "border-green-200 bg-white" : "border-amber-200 bg-amber-50"}`}
                                            >
                                              <div className="flex items-center justify-between">
                                                <strong>{label}</strong>
                                                <span
                                                  className={`text-xs font-bold ${filling ? "text-cicopal-green" : "text-amber-700"}`}
                                                >
                                                  {filling
                                                    ? "PREENCHIDO"
                                                    : "PENDENTE"}
                                                </span>
                                              </div>
                                              {filling ? (
                                                <div className="mt-3 space-y-2">
                                                  {fillingDetails(filling).map(
                                                    (detail, index) => (
                                                      <div
                                                        key={`${detail.item}-${index}`}
                                                        className="border-l-4 border-cicopal-blue bg-gray-50 p-2 text-sm"
                                                      >
                                                        <strong className="block">
                                                          {detail.maquina
                                                            ? `${detail.maquina} · `
                                                            : ""}
                                                          {detail.item}
                                                        </strong>
                                                        <span className="text-gray-600">
                                                          {detail.resultado ??
                                                            detail.valor ??
                                                            "—"}
                                                          {detail.unidade
                                                            ? ` ${detail.unidade}`
                                                            : ""}
                                                          {detail.gramatura
                                                            ? ` · ${detail.gramatura}`
                                                            : ""}
                                                        </span>
                                                      </div>
                                                    ),
                                                  )}
                                                  {(
                                                    filling.valores
                                                      ?.fotografias ?? []
                                                  ).map((photo, index) => (
                                                    <img
                                                      key={index}
                                                      src={photo.imagem}
                                                      alt={`Registro de ${hour.label}`}
                                                      className="max-h-48 w-full border border-gray-200 object-contain"
                                                    />
                                                  ))}
                                                </div>
                                              ) : (
                                                <p className="mt-3 text-sm font-semibold text-amber-800">
                                                  Nenhum registro neste horário.
                                                </p>
                                              )}
                                            </article>
                                          );
                                        })}
                                      </div>
                                    </details>
                                  ))}
                                  {!hourGroups(cycle).length ? (
                                    <p className="border border-dashed border-gray-300 p-4 text-center font-semibold text-gray-500">
                                      Nenhum preenchimento hora a hora nesta
                                      produção.
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            </details>
                          ))}
                        </div>
                      </details>
                    ))}
                  </div>
                </section>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ icon, label, value, alert = false }) {
  return (
    <article
      className={`border bg-white p-4 shadow-sm ${alert ? "border-red-200" : "border-gray-200"}`}
    >
      <span className={alert ? "text-cicopal-red" : "text-cicopal-blue"}>
        {icon}
      </span>
      <p className="mt-4 text-xs font-bold uppercase text-gray-500">{label}</p>
      <strong
        className={`mt-1 block text-3xl ${alert ? "text-cicopal-red" : "text-gray-950"}`}
      >
        {value}
      </strong>
    </article>
  );
}

function Status({ ok, text }) {
  return (
    <span
      className={`mb-1 flex items-center gap-1 font-bold ${ok ? "text-cicopal-green" : "text-cicopal-red"}`}
    >
      {ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
      {text}
    </span>
  );
}
