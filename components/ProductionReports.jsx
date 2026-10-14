"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock3,
  Download,
  LoaderCircle,
  Printer,
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

function summarize(
  cycle,
  fillings,
  genericNcs,
  events,
  hygieneRounds = [],
  subprocesses = [],
  automationLots = [],
  batches = [],
  batchInputs = [],
  processRecords = [],
  interruptions = [],
  inputs = [],
  operators = [],
) {
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
  const cycleHygieneRounds = hygieneRounds
    .filter((item) => item.ciclo_id === cycle.id)
    .map((round) => ({
      ...round,
      executorName: operators.find((operator) => operator.id === round.executada_por)?.nome,
      inspectorName: operators.find((operator) => operator.id === round.inspecionada_por)?.nome,
    }));
  const operator = [...cycleEvents]
    .reverse()
    .find((item) => item.dados?.operador_nome)?.dados?.operador_nome;
  const cycleBatches = batches
    .filter((item) => item.ciclo_id === cycle.id)
    .map((batch) => ({
      ...batch,
      inputs: batchInputs
        .filter((item) => item.batelada_id === batch.id)
        .map((item) => ({
          ...item,
          input: inputs.find((input) => input.id === item.insumo_id),
        })),
    }));
  return {
    ...cycle,
    line: lines[cycle.linha_id] ?? { name: cycle.linha_id, rg: "—" },
    fillings: cycleFillings,
    hygiene: cycleFillings.some(
      (item) => item.contexto_tipo === "higienizacao",
    ) || cycleHygieneRounds.some((item) => item.status === "aprovada"),
    hygieneRounds: cycleHygieneRounds,
    subprocesses: subprocesses.filter((item) => item.ciclo_id === cycle.id),
    automationLots: automationLots
      .filter((item) => item.ciclo_id === cycle.id)
      .map((item) => ({
        ...item,
        input: inputs.find((input) => input.id === item.insumo_id),
      })),
    batches: cycleBatches,
    processRecords: processRecords.filter((item) => item.ciclo_id === cycle.id),
    interruptions: interruptions.filter((item) => item.ciclo_id === cycle.id),
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

function fieldLabel(value) {
  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function processRecordGroups(cycle) {
  const processes = new Map(cycle.subprocesses.map((item) => [item.id, item.nome]));
  return [...cycle.processRecords.reduce((groups, record) => {
    const name = processes.get(record.subprocesso_id) ?? "Subprocesso";
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(record);
    return groups;
  }, new Map()).entries()];
}

function checklistEntries(payload = {}) {
  const evaluations = Array.isArray(payload?.avaliacoes)
    ? payload.avaliacoes
    : [];
  const notes = Array.isArray(payload?.apontamentos)
    ? payload.apontamentos
    : [];
  const entries = [...evaluations, ...notes].map((item, index) => ({
    id: `${item.grupo ?? "item"}-${item.item ?? index}`,
    group: item.grupo ?? item.group ?? "Avaliação geral",
    item: item.item ?? item.label ?? `Item ${index + 1}`,
    result: item.av1 ?? item.resultado ?? item.valor ?? "—",
    qualityResult: item.av2 ?? null,
    unit: item.unidade ?? item.unit ?? "",
    classification: item.classificacao ?? "",
  }));
  if (entries.length) return entries;
  return Object.entries(payload ?? {})
    .filter(
      ([key, value]) =>
        !["ncs", "fotografias", "assinatura", "status"].includes(key) &&
        !key.startsWith("_") &&
        ["string", "number", "boolean"].includes(typeof value),
    )
    .map(([key, value]) => ({
      id: key,
      group: "Resultado registrado",
      item: fieldLabel(key),
      result: String(value),
      qualityResult: null,
      unit: "",
      classification: "",
    }));
}

function hygieneReportRecords(cycle) {
  if (cycle.hygieneRounds?.length) {
    return cycle.hygieneRounds.flatMap((round) => [
      {
        id: `${round.id}-operation`,
        label: `Rodada ${round.numero} · execução da Operação`,
        at: round.enviada_inspecao_em ?? round.execucao_iniciada_em,
        operator: round.executada_por,
        status: round.status,
        payload: round.dados_operacao ?? {},
      },
      ...(round.dados_qualidade
        ? [{
            id: `${round.id}-quality`,
            label: `Rodada ${round.numero} · inspeção da Qualidade`,
            at: round.inspecao_encerrada_em ?? round.inspecao_iniciada_em,
            operator: round.inspecionada_por,
            status: round.status,
            payload: round.dados_qualidade,
          }]
        : []),
    ]);
  }
  return cycle.fillings
    .filter((item) => item.contexto_tipo === "higienizacao")
    .map((item) => ({
      id: item.id,
      label: "Checklist de higienização",
      at: item.preenchido_em,
      operator: item.operador_id,
      status: item.status,
      payload: item.valores ?? {},
    }));
}

function releaseReportRecords(cycle) {
  return cycle.fillings
    .filter((item) => ["produto_liberacao", "controle_liberacao"].includes(item.contexto_tipo))
    .map((item) => ({
      id: item.id,
      label: item.contexto_tipo === "controle_liberacao"
        ? "Controle de liberação por máquina"
        : "Liberação inicial do produto",
      kind: item.contexto_tipo === "controle_liberacao" ? "machine" : "product",
      at: item.preenchido_em,
      operator: item.operador_id,
      status: item.status,
      payload: item.valores ?? {},
    }));
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
      const [
        fillingsResult,
        ncsResult,
        eventsResult,
        hygieneResult,
        subprocessResult,
        automationResult,
        batchesResult,
        batchInputsResult,
        processRecordsResult,
        interruptionsResult,
        inputsResult,
        operatorsResult,
      ] = await Promise.all([
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
        supabase
          .from("higienizacao_rodadas")
          .select("*")
          .in("ciclo_id", ids)
          .order("numero"),
        supabase
          .from("producao_subprocessos")
          .select("id,ciclo_id,nome,status,iniciado_em,encerrado_em,estado_iniciado_em,subprocesso_eventos(*)")
          .in("ciclo_id", ids)
          .order("ordem"),
        supabase.from("automacao_lotes").select("*").in("ciclo_id", ids),
        supabase.from("bateladas").select("*").in("ciclo_id", ids).order("numero"),
        supabase.from("batelada_insumos").select("*"),
        supabase
          .from("subprocesso_registros")
          .select("id,subprocesso_id,ciclo_id,horario_previsto,preenchido_em,status_prazo,valores,retificado")
          .in("ciclo_id", ids)
          .not("horario_previsto", "is", null)
          .order("horario_previsto"),
        supabase.from("producao_interrupcoes").select("*").in("ciclo_id", ids).order("iniciada_em"),
        supabase.from("insumos").select("id,codigo,nome"),
        supabase.from("operadores").select("id,nome"),
      ]);
      if (fillingsResult.error) throw fillingsResult.error;
      if (ncsResult.error) throw ncsResult.error;
      if (eventsResult.error) throw eventsResult.error;
      if (hygieneResult.error && !["42P01", "PGRST205"].includes(hygieneResult.error.code)) throw hygieneResult.error;
      if (subprocessResult.error && !["42P01", "PGRST205"].includes(subprocessResult.error.code)) throw subprocessResult.error;
      for (const result of [automationResult, batchesResult, batchInputsResult, processRecordsResult, interruptionsResult, inputsResult, operatorsResult]) {
        if (result.error && !["42P01", "PGRST205"].includes(result.error.code)) throw result.error;
      }
      setData(
        repairTextDeep(
          (cycles ?? []).map((cycle) =>
            summarize(
              cycle,
              fillingsResult.data ?? [],
              ncsResult.data ?? [],
              eventsResult.data ?? [],
              hygieneResult.data ?? [],
              subprocessResult.data ?? [],
              automationResult.data ?? [],
              batchesResult.data ?? [],
              batchInputsResult.data ?? [],
              processRecordsResult.data ?? [],
              interruptionsResult.data ?? [],
              inputsResult.data ?? [],
              operatorsResult.data ?? [],
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

  function exportPdf() {
    const previousTitle = document.title;
    const documentScope = lineId === "ALL" ? "consolidado" : lines[lineId]?.name?.toLowerCase() ?? "producao";
    const restoreTitle = () => {
      document.title = previousTitle;
      window.removeEventListener("afterprint", restoreTitle);
    };
    document.title = `registro-geral-${documentScope}-${startDate}-${endDate}`;
    window.addEventListener("afterprint", restoreTitle);
    window.print();
  }

  if (process.env.NEXT_PUBLIC_LEGACY_REPORT_LAYOUT !== "true") return (
    <ExecutiveProductionReport
      startDate={startDate}
      endDate={endDate}
      setStartDate={setStartDate}
      setEndDate={setEndDate}
      lineId={lineId}
      setLineId={setLineId}
      product={product}
      setProduct={setProduct}
      productOptions={productOptions}
      status={status}
      setStatus={setStatus}
      ncFilter={ncFilter}
      setNcFilter={setNcFilter}
      search={search}
      setSearch={setSearch}
      filteredData={filteredData}
      totals={totals}
      loading={loading}
      error={error}
      onLoad={load}
      onExportCsv={exportCsv}
      onExportPdf={exportPdf}
    />
  );

  return (
    <div className="production-report space-y-5">
      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 11mm; }
          body { background: #fff !important; }
          body > * { visibility: hidden; }
          .production-report, .production-report * { visibility: visible; }
          .production-report { position: absolute; inset: 0; width: 100%; }
          .report-controls { display: none !important; }
          .report-cycle { break-inside: avoid; page-break-inside: avoid; margin-bottom: 10mm; }
          .production-report details > * { display: block !important; }
          .production-report details > summary { list-style: none; }
          .production-report .shadow-sm { box-shadow: none !important; }
        }
      `}</style>
      <section className="report-controls border border-gray-200 bg-white p-5 shadow-sm">
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
          <div className="report-actions flex flex-wrap gap-3">
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
          <button
            type="button"
            disabled={!filteredData.length}
            onClick={exportPdf}
            className="inline-flex min-h-12 items-center gap-2 bg-gray-950 px-5 font-bold text-white disabled:opacity-40"
          >
            <Printer size={18} />
            Exportar PDF
          </button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden border border-blue-200 bg-white shadow-sm">
        <header className="bg-cicopal-blue p-5 text-white">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-blue-200">CICOPAL · Controle industrial</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div><h2 className="text-3xl font-bold text-white">Relatório consolidado de produção</h2><p className="mt-1 text-sm font-semibold text-blue-100">Período de {new Date(`${startDate}T12:00:00`).toLocaleDateString("pt-BR")} a {new Date(`${endDate}T12:00:00`).toLocaleDateString("pt-BR")}</p></div>
            <p className="text-sm font-bold text-blue-100">Emitido em {new Date().toLocaleString("pt-BR")}</p>
          </div>
        </header>
        <div className="grid gap-px bg-gray-200 sm:grid-cols-2 xl:grid-cols-5">
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
        </div>
        <div className="border-t border-gray-200 p-5">
          <div className="flex items-center justify-between text-sm font-bold"><span>Cumprimento geral dos controles</span><span className={totals.compliance < 90 ? "text-amber-700" : "text-cicopal-green"}>{totals.compliance}%</span></div>
          <div className="mt-2 h-3 overflow-hidden bg-gray-200"><div className={`h-full ${totals.compliance < 90 ? "bg-amber-500" : "bg-cicopal-green"}`} style={{ width: `${totals.compliance}%` }} /></div>
        </div>
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
                              className="report-cycle border border-gray-200 bg-white"
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
                                <div className="hidden">
                                  {[
                                    ["Higienização", cycle.hygiene],
                                    ["Liberação", cycle.release],
                                    ["Produção", Boolean(cycle.producao_iniciada_em)],
                                    [cycle.encerrado_em ? "Encerrada" : "Em andamento", true],
                                  ].map(([label, ok], index) => (
                                    <article key={label} className="bg-white p-4">
                                      <span className={`grid size-8 place-items-center text-sm font-bold text-white ${ok ? "bg-cicopal-green" : "bg-amber-500"}`}>{index + 1}</span>
                                      <strong className="mt-3 block text-sm text-gray-950">{label}</strong>
                                      <span className={`mt-1 block text-xs font-bold ${ok ? "text-cicopal-green" : "text-amber-700"}`}>{ok ? "CONFIRMADO" : "PENDENTE"}</span>
                                    </article>
                                  ))}
                                </div>
                                <div className="hidden">
                                  <Status
                                    ok={cycle.hygiene}
                                    text="Higienização confirmada"
                                  />
                                  <Status
                                    ok={cycle.release}
                                    text="Liberação confirmada"
                                  />
                                </div>
                                <ChecklistTechnicalReport
                                  title="Higienização · resultados completos"
                                  records={hygieneReportRecords(cycle)}
                                  emptyText="Nenhuma avaliação de higienização foi registrada nesta produção."
                                />
                                <ChecklistTechnicalReport
                                  title="Liberação do produto · resultados completos"
                                  records={releaseReportRecords(cycle)}
                                  emptyText="Nenhuma liberação do produto foi registrada nesta produção."
                                />
                                {cycle.hygieneRounds?.length ? (
                                  <details className="mb-4 border border-blue-200 bg-blue-50">
                                    <summary className="cursor-pointer p-4 font-black text-cicopal-blue">Histórico da higienização · {cycle.hygieneRounds.length} rodada(s)</summary>
                                    <div className="grid gap-2 border-t border-blue-200 p-3 sm:grid-cols-2 lg:grid-cols-3">
                                      {cycle.hygieneRounds.map((round) => (
                                        <article key={round.id} className="border-l-4 border-cicopal-blue bg-white p-3">
                                          <strong>Rodada {round.numero}</strong>
                                          <span className="mt-1 block text-xs font-black uppercase text-gray-500">{round.status.replaceAll("_", " ")}</span>
                                          <p className="mt-2 text-xs font-semibold text-gray-600">Operação: {duration(round.execucao_iniciada_em, round.enviada_inspecao_em)}</p>
                                          <p className="text-xs font-semibold text-gray-600">Espera/inspeção: {round.inspecao_encerrada_em ? duration(round.enviada_inspecao_em, round.inspecao_encerrada_em) : "em andamento"}</p>
                                        </article>
                                      ))}
                                    </div>
                                  </details>
                                ) : null}
                                {cycle.subprocesses?.length ? (
                                  <details className="mb-4 border border-gray-200 bg-gray-50">
                                    <summary className="cursor-pointer p-4 font-black text-gray-800">Processo produtivo · {cycle.subprocesses.length} subprocessos</summary>
                                    <div className="grid gap-2 border-t border-gray-200 p-3 sm:grid-cols-2 lg:grid-cols-3">
                                      {cycle.subprocesses.map((process) => {
                                        const events = process.subprocesso_eventos ?? [];
                                        const resolutions = new Map(events.filter((event) => event.tipo === "problema_resolvido").map((event) => [event.dados?.problema_id, event]));
                                        const problems = events.filter((event) => event.tipo === "problema_reportado");
                                        return <article key={process.id} className={`border-l-4 bg-white p-3 ${problems.some((problem) => !resolutions.has(problem.id)) ? "border-red-600" : "border-cicopal-blue"}`}>
                                          <strong>{process.nome}</strong>
                                          <span className="mt-1 block text-xs font-black uppercase text-gray-500">{process.status.replaceAll("_", " ")}</span>
                                          <p className="mt-2 text-xs font-semibold text-gray-600">Tempo no estado: {duration(process.estado_iniciado_em, process.encerrado_em)}</p>
                                          {problems.length ? <details className="mt-3 border-t pt-3"><summary className="cursor-pointer text-sm font-black text-red-700">Problemas operacionais · {problems.length}</summary><div className="mt-3 space-y-3">{problems.map((problem) => { const resolution = resolutions.get(problem.id); const minutes = resolution?.dados?.duracao_minutos ?? (resolution ? Math.max(0, Math.ceil((new Date(resolution.ocorrido_em) - new Date(problem.ocorrido_em)) / 60_000)) : null); return <section key={problem.id} className={`p-3 ${resolution ? "bg-green-50" : "bg-red-50"}`}><b>{problem.dados?.equipamento ?? process.nome}</b><p className="text-sm font-semibold">{problem.dados?.causa ?? problem.motivo}</p><p className="mt-1 text-xs text-gray-600">Aberto em {new Date(problem.ocorrido_em).toLocaleString("pt-BR")}</p>{resolution ? <><p className="mt-2 font-black text-green-800">Resolvido em {minutes} minuto(s)</p><p className="text-sm font-semibold text-gray-700">Solução: {resolution.dados?.solucao ?? resolution.motivo}</p></> : <p className="mt-2 font-black text-red-700">Ainda ativo</p>}<div className="mt-3 grid grid-cols-2 gap-2">{problem.dados?.foto_antes ? <figure><img src={problem.dados.foto_antes} alt="Antes do problema" className="h-32 w-full bg-white object-cover"/><figcaption className="text-center text-[10px] font-black uppercase text-red-700">Antes</figcaption></figure> : null}{resolution?.dados?.foto_depois ? <figure><img src={resolution.dados.foto_depois} alt="Depois da solução" className="h-32 w-full bg-white object-cover"/><figcaption className="text-center text-[10px] font-black uppercase text-green-700">Depois</figcaption></figure> : null}</div></section>; })}</div></details> : null}
                                        </article>;
                                      })}
                                    </div>
                                  </details>
                                ) : null}
                                {(cycle.automationLots.length || cycle.batches.length) ? (
                                  <details open className="mb-4 border border-blue-200 bg-blue-50">
                                    <summary className="cursor-pointer p-4 font-black text-cicopal-blue">
                                      Rastreabilidade de insumos e bateladas
                                    </summary>
                                    <div className="grid gap-4 border-t border-blue-200 p-4 lg:grid-cols-2">
                                      <section>
                                        <h5 className="mb-2 text-xs font-black uppercase tracking-wider text-gray-500">Lotes definidos na automação</h5>
                                        <div className="space-y-2">
                                          {cycle.automationLots.map((lot) => (
                                            <article key={lot.id} className="border-l-4 border-cicopal-blue bg-white p-3">
                                              <strong>{lot.input?.nome ?? "Insumo"}</strong>
                                              <p className="text-sm font-semibold text-gray-600">Lote {lot.lote_fornecedor} · {lot.fornecedor}</p>
                                              <p className="text-xs font-bold text-gray-500">Validade: {new Date(`${lot.validade}T12:00:00`).toLocaleDateString("pt-BR")}</p>
                                            </article>
                                          ))}
                                        </div>
                                      </section>
                                      <section>
                                        <h5 className="mb-2 text-xs font-black uppercase tracking-wider text-gray-500">Controle de bateladas</h5>
                                        <div className="space-y-2">
                                          {cycle.batches.map((batch) => (
                                            <details key={batch.id} className="border border-gray-200 bg-white">
                                              <summary className="cursor-pointer p-3 font-black">Batelada {batch.numero} · {batch.status.replaceAll("_", " ")}</summary>
                                              <div className="border-t border-gray-100 p-3 text-sm">
                                                <p className="mb-2 font-semibold text-gray-600">{new Date(batch.iniciada_em).toLocaleString("pt-BR")} — {batch.finalizada_em ? new Date(batch.finalizada_em).toLocaleString("pt-BR") : "em andamento"}</p>
                                                {batch.inputs.map((item) => <p key={item.id}><strong>{item.input?.nome ?? "Insumo"}:</strong> lote {item.lote_fornecedor} · {item.quantidade_utilizada ?? "—"} {item.unidade}</p>)}
                                              </div>
                                            </details>
                                          ))}
                                        </div>
                                      </section>
                                    </div>
                                  </details>
                                ) : null}
                                {cycle.processRecords.length ? (
                                  <details open className="mb-4 border border-gray-300 bg-white">
                                    <summary className="cursor-pointer bg-gray-950 p-4 font-black text-white">
                                      Apontamentos dos subprocessos · {cycle.processRecords.length} registros
                                    </summary>
                                    <div className="space-y-3 bg-gray-100 p-3">
                                      {processRecordGroups(cycle).map(([name, records]) => (
                                        <details key={name} className="border border-gray-200 bg-white">
                                          <summary className="flex cursor-pointer items-center justify-between p-4 font-black">
                                            <span>{name}</span><span className="text-sm text-gray-500">{records.length} horário(s)</span>
                                          </summary>
                                          <div className="grid gap-3 border-t border-gray-200 p-3 lg:grid-cols-3">
                                            {records.map((record) => (
                                              <article key={record.id} className="border-l-4 border-cicopal-blue bg-gray-50 p-3">
                                                <div className="flex items-center justify-between gap-2">
                                                  <strong className="tabular-nums">{new Date(record.horario_previsto).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</strong>
                                                  <span className={record.status_prazo === "atrasado" ? "text-xs font-black text-cicopal-red" : "text-xs font-black text-cicopal-green"}>{record.status_prazo === "atrasado" ? "ATRASADO" : "NO PRAZO"}</span>
                                                </div>
                                                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                                                  {Object.entries(record.valores ?? {}).map(([key, value]) => <div key={key}><dt className="text-xs font-bold text-gray-400">{fieldLabel(key)}</dt><dd className="font-black text-gray-800">{String(value)}</dd></div>)}
                                                </dl>
                                                <p className="mt-3 border-t border-gray-200 pt-2 text-xs font-semibold text-gray-500">Preenchido em {new Date(record.preenchido_em).toLocaleString("pt-BR")}{record.retificado ? " · retificado" : ""}</p>
                                              </article>
                                            ))}
                                          </div>
                                        </details>
                                      ))}
                                    </div>
                                  </details>
                                ) : null}
                                {cycle.interruptions.length ? (
                                  <details className="mb-4 border border-amber-300 bg-amber-50">
                                    <summary className="cursor-pointer p-4 font-black text-amber-900">Interrupções · {cycle.interruptions.length}</summary>
                                    <div className="space-y-2 border-t border-amber-200 p-3">
                                      {cycle.interruptions.map((item) => <article key={item.id} className="bg-white p-3"><strong className="uppercase text-amber-800">{item.classificacao}</strong><p className="font-bold">{item.motivo}</p><p className="text-sm text-gray-600">{new Date(item.iniciada_em).toLocaleString("pt-BR")} · duração {duration(item.iniciada_em, item.encerrada_em)}</p>{item.observacao_retomada ? <p className="mt-1 text-sm font-semibold text-gray-600">Retomada: {item.observacao_retomada}</p> : null}</article>)}
                                    </div>
                                  </details>
                                ) : null}
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

function resultPresentation(value) {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "C" || normalized === "CONFORME")
    return { label: "C · Conforme", className: "border-green-300 bg-green-50 text-green-800" };
  if (["N", "NC", "NÃO CONFORME", "NAO CONFORME"].includes(normalized))
    return { label: "N · Não conforme", className: "border-red-300 bg-red-50 text-red-800" };
  if (normalized === "NA" || normalized === "N/A")
    return { label: "NA · Não se aplica", className: "border-gray-300 bg-gray-100 text-gray-700" };
  return { label: value || "Não informado", className: "border-blue-200 bg-blue-50 text-blue-800" };
}

function ChecklistTechnicalReport({ title, records, emptyText }) {
  const entries = records.flatMap((record) => checklistEntries(record.payload));
  const counts = entries.reduce(
    (total, entry) => {
      const value = String(entry.result ?? "").toUpperCase();
      if (value === "C" || value === "CONFORME") total.conforme += 1;
      else if (["N", "NC", "NÃO CONFORME", "NAO CONFORME"].includes(value)) total.nc += 1;
      else if (["NA", "N/A"].includes(value)) total.na += 1;
      return total;
    },
    { conforme: 0, nc: 0, na: 0 },
  );
  return (
    <section className="mb-4 overflow-hidden border border-gray-300 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 bg-gray-950 p-4 text-white">
        <div><p className="text-xs font-bold uppercase tracking-wider text-blue-200">Controle da Qualidade</p><h4 className="mt-1 text-lg font-bold text-white">{title}</h4></div>
        <div className="flex flex-wrap gap-2 text-xs font-bold">
          <span className="bg-green-600 px-3 py-2">{counts.conforme} conformes</span>
          <span className="bg-red-600 px-3 py-2">{counts.nc} não conformes</span>
          <span className="bg-gray-600 px-3 py-2">{counts.na} não aplicáveis</span>
        </div>
      </header>
      {!records.length ? <p className="p-5 font-semibold text-gray-500">{emptyText}</p> : (
        <div className="divide-y divide-gray-200">
          {records.map((record) => {
            const recordEntries = checklistEntries(record.payload);
            const ncs = record.payload?.ncs ?? [];
            return (
              <article key={record.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 pb-3">
                  <div><strong className="text-gray-950">{record.label}</strong><p className="mt-1 text-xs font-semibold text-gray-500">{record.at ? new Date(record.at).toLocaleString("pt-BR") : "Horário não informado"}{record.operator ? ` · responsável ${record.operator}` : ""}</p></div>
                  <span className="border border-gray-300 bg-gray-50 px-3 py-1 text-xs font-bold uppercase text-gray-600">{String(record.status ?? "registrado").replaceAll("_", " ")}</span>
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-[680px] text-left">
                    <thead><tr><th className="px-3 py-2">Seção</th><th className="px-3 py-2">Item verificado</th><th className="px-3 py-2">Resultado</th><th className="px-3 py-2">2ª avaliação</th></tr></thead>
                    <tbody>{recordEntries.map((entry) => { const presentation = resultPresentation(entry.result); const qualityPresentation = entry.qualityResult ? resultPresentation(entry.qualityResult) : null; return <tr key={entry.id} className="border-t border-gray-100"><td className="px-3 py-3 text-xs font-bold text-gray-500">{entry.group}</td><td className="px-3 py-3 font-bold text-gray-900">{entry.item}</td><td className="px-3 py-3"><span className={`inline-block border px-2 py-1 text-xs font-bold ${presentation.className}`}>{presentation.label}{entry.unit ? ` ${entry.unit}` : ""}</span></td><td className="px-3 py-3">{qualityPresentation ? <span className={`inline-block border px-2 py-1 text-xs font-bold ${qualityPresentation.className}`}>{qualityPresentation.label}</span> : <span className="text-gray-400">—</span>}</td></tr>; })}</tbody>
                  </table>
                </div>
                {ncs.length ? <div className="mt-4 grid gap-2 sm:grid-cols-2">{ncs.map((nc, index) => <div key={nc.id ?? index} className="border-l-4 border-red-600 bg-red-50 p-3"><strong className="text-red-900">NC · {nc.item ?? nc.descricao}</strong><p className="mt-1 text-sm text-red-800">{nc.causa ?? nc.descricao ?? "Causa não informada"}</p><p className="mt-1 text-xs font-bold text-red-700">Ação: {nc.acao ?? nc.acao_tomada ?? "não informada"}</p></div>)}</div> : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
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

function ExecutiveProductionReport({
  startDate,
  endDate,
  setStartDate,
  setEndDate,
  lineId,
  setLineId,
  product,
  setProduct,
  productOptions,
  status,
  setStatus,
  ncFilter,
  setNcFilter,
  search,
  setSearch,
  filteredData,
  totals,
  loading,
  error,
  onLoad,
  onExportCsv,
  onExportPdf,
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedProcess, setSelectedProcess] = useState(null);
  const interruptionCount = filteredData.reduce(
    (total, cycle) => total + cycle.interruptions.length,
    0,
  );
  const productionDays = Object.values(
    filteredData.reduce((result, cycle) => {
      const key = inputDate(new Date(cycle.iniciado_em));
      (result[key] ??= []).push(cycle);
      return result;
    }, {}),
  ).sort((first, second) =>
    new Date(second[0].iniciado_em) - new Date(first[0].iniciado_em),
  );
  const hasFilters =
    lineId !== "ALL" ||
    product !== "ALL" ||
    status !== "ALL" ||
    ncFilter !== "ALL" ||
    search;
  const resetFilters = () => {
    setLineId("ALL");
    setProduct("ALL");
    setStatus("ALL");
    setNcFilter("ALL");
    setSearch("");
  };

  return (
    <div className="production-report w-full space-y-8 pb-10">
      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 8mm; }
          body { background: #fff !important; }
          body > * { visibility: hidden !important; }
          .production-report, .production-report * { visibility: visible !important; }
          .production-report { position: absolute; inset: 0; width: 100%; padding: 0 !important; }
          .report-toolbar, .report-filters, .report-attention { display: none !important; }
          body[data-report-export="process"] .production-report > :not(.process-report-modal) { display: none !important; }
          body[data-report-export="process"] .process-report-modal { position: static !important; display: block !important; background: #fff !important; padding: 0 !important; }
          body[data-report-export="process"] .process-report-modal > section { max-height: none !important; max-width: none !important; overflow: visible !important; border-radius: 0 !important; box-shadow: none !important; }
          body[data-report-export="process"] .process-report-modal > section > header { display: none !important; }
          body[data-report-export="process"] .process-report-actions { display: none !important; }
          body[data-report-export="process"] .hourly-matrix { break-inside: avoid; page-break-inside: avoid; }
          body[data-report-export="process"] .hourly-matrix table { min-width: 0 !important; font-size: 7px !important; }
          body[data-report-export="process"] .hourly-matrix th,
          body[data-report-export="process"] .hourly-matrix td { min-width: 0 !important; padding: 3px 1px !important; }
          body[data-report-export="process"] .hourly-matrix th:first-child { width: 7rem; }
          body[data-report-export="process"] .product-release-table { break-inside: avoid; page-break-inside: avoid; }
          body[data-report-export="process"] .product-release-table table { min-width: 0 !important; font-size: 7px !important; }
          body[data-report-export="process"] .product-release-table th,
          body[data-report-export="process"] .product-release-table td { min-width: 0 !important; padding: 3px 1px !important; }
          .report-document-header { border-radius: 0 !important; box-shadow: none !important; }
          .report-document-header__caption { display: none !important; }
          .report-summary { border-radius: 0 !important; box-shadow: none !important; }
          .report-results { border-radius: 0 !important; box-shadow: none !important; }
          .report-row details { display: block !important; }
          .report-row { break-inside: avoid; page-break-inside: avoid; }
          .production-report details > * { display: block !important; }
          .production-report details > summary { list-style: none; }
        }
        .report-input {
          min-height: 3rem;
          width: 100%;
          border: 1px solid #cbd5e1;
          background: #fff;
          padding: 0 0.75rem;
          font-size: 0.875rem;
          font-weight: 600;
          color: #0f172a;
          outline: none;
        }
        .report-input:focus { border-color: #2622b5; box-shadow: 0 0 0 2px rgba(38, 34, 181, .12); }
      `}</style>

      <section className="overflow-hidden rounded-[2rem] border border-blue-100 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        <div className="border-l-8 border-cicopal-blue px-6 py-7 sm:px-9">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cicopal-blue">Inteligência de produção</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Visão operacional do período</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-slate-600">Acompanhe o que exige decisão agora e abra somente a produção que precisa de investigação.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-600">
              <span className="border border-slate-200 bg-slate-50 px-3 py-2">{new Date(`${startDate}T12:00:00`).toLocaleDateString("pt-BR")} — {new Date(`${endDate}T12:00:00`).toLocaleDateString("pt-BR")}</span>
              <span className="border border-blue-100 bg-blue-50 px-3 py-2 text-cicopal-blue">{filteredData.length} produção(ões)</span>
            </div>
          </div>
        </div>
      </section>

      <section className="report-summary overflow-hidden rounded-[1.25rem] border border-slate-300 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div className="border-b border-slate-300 bg-[#d6d6d6] px-5 py-2 text-center text-xs font-black uppercase tracking-[0.14em] text-slate-800">
          Resumo do período
        </div>
        <div className="grid divide-y divide-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
          <ExecutiveMetric label="Produções" value={totals.cycles} note="no período" />
          <ExecutiveMetric label="Controles" value={`${totals.compliance}%`} note="cumprimento médio" accent={totals.compliance < 90 ? "amber" : "green"} />
          <ExecutiveMetric label="Não conformidades" value={totals.ncs} note="ocorrências registradas" accent={totals.ncs ? "red" : "green"} />
          <ExecutiveMetric label="Interrupções" value={interruptionCount} note="paradas apontadas" accent={interruptionCount ? "amber" : "blue"} />
        </div>
      </section>

      <section className="report-toolbar rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="flex min-h-12 max-w-xl flex-1 items-center border border-slate-300 bg-slate-50 px-3 focus-within:border-cicopal-blue focus-within:bg-white">
            <Search size={18} className="shrink-0 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="min-w-0 flex-1 border-0 bg-transparent px-2 text-sm font-semibold outline-none"
              placeholder="Buscar por código, produto, operador ou linha"
              aria-label="Buscar produção"
            />
          </label>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button type="button" onClick={() => setFiltersOpen((open) => !open)} className="min-h-12 border border-slate-300 px-4 text-sm font-black text-slate-700">
              {filtersOpen ? "Ocultar filtros" : "Filtros"}
            </button>
            <button type="button" onClick={onLoad} className="inline-flex min-h-12 items-center justify-center gap-2 bg-cicopal-blue px-4 text-sm font-black text-white">
              <RefreshCw size={17} /> Atualizar
            </button>
            <button type="button" onClick={onExportCsv} disabled={!filteredData.length} className="inline-flex min-h-12 items-center justify-center gap-2 border border-slate-300 px-4 text-sm font-black text-slate-700 disabled:opacity-40">
              <Download size={17} /> CSV
            </button>
            <button type="button" onClick={onExportPdf} disabled={!filteredData.length} className="inline-flex min-h-12 items-center justify-center gap-2 bg-slate-950 px-4 text-sm font-black text-white disabled:opacity-40">
              <Printer size={17} /> Resumo PDF
            </button>
          </div>
        </div>

        {filtersOpen ? (
          <div className="report-filters mt-4 grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2 xl:grid-cols-5">
            <ReportField label="Período inicial"><input type="date" className="report-input" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></ReportField>
            <ReportField label="Período final"><input type="date" className="report-input" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></ReportField>
            <ReportField label="Linha"><select className="report-input" value={lineId} onChange={(event) => { setLineId(event.target.value); setProduct("ALL"); }}><option value="ALL">Todas as linhas</option>{Object.entries(lines).map(([id, item]) => <option key={id} value={id}>{item.name}</option>)}</select></ReportField>
            <ReportField label="Produto"><select className="report-input" value={product} onChange={(event) => setProduct(event.target.value)}><option value="ALL">Todos os produtos</option>{productOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></ReportField>
            <div className="grid grid-cols-2 gap-3">
              <ReportField label="Situação"><select className="report-input" value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">Todas</option><option value="ACTIVE">Em andamento</option><option value="FINISHED">Encerradas</option></select></ReportField>
              <ReportField label="NC"><select className="report-input" value={ncFilter} onChange={(event) => setNcFilter(event.target.value)}><option value="ALL">Todas</option><option value="WITH">Com NC</option><option value="WITHOUT">Sem NC</option></select></ReportField>
            </div>
            {hasFilters ? <button type="button" onClick={resetFilters} className="min-h-12 self-end text-sm font-black text-cicopal-blue">Limpar filtros</button> : null}
          </div>
        ) : null}
      </section>

      <section className="report-results overflow-hidden rounded-[1.25rem] border border-slate-300 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 px-5 py-5 sm:px-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Produções encontradas</p>
            <h3 className="mt-1 text-xl font-black text-slate-950">Produções por dia</h3>
          </div>
          <p className="text-sm font-semibold text-slate-500">Abra o dia, a produção e então o processo desejado.</p>
        </header>

        {loading ? <div className="flex min-h-72 items-center justify-center gap-3 font-bold text-cicopal-blue"><LoaderCircle className="animate-spin" /> Atualizando indicadores...</div> : null}
        {!loading && error ? <div className="m-5 border-l-4 border-cicopal-red bg-red-50 p-4 font-bold text-cicopal-red">{error}</div> : null}
        {!loading && !error && !filteredData.length ? <div className="p-12 text-center"><p className="font-black text-slate-900">Nenhuma produção encontrada.</p><p className="mt-1 text-sm font-medium text-slate-500">Ajuste os filtros ou escolha outro período.</p></div> : null}
        {!loading && !error && filteredData.length ? <div className="divide-y divide-slate-200">{productionDays.map((cycles) => <ProductionDayGroup key={inputDate(new Date(cycles[0].iniciado_em))} cycles={cycles} onOpenProcess={setSelectedProcess} />)}</div> : null}
      </section>
      <ProcessModal selection={selectedProcess} onClose={() => setSelectedProcess(null)} />
    </div>
  );
}

function ReportField({ label, children }) {
  return <label className="block"><span className="mb-1 block text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</span>{children}</label>;
}

function ControlledDocumentHeader({ cycle, reportTitle, reportType }) {
  const line = cycle.line;
  const productionDate = new Date(cycle.iniciado_em).toLocaleDateString("pt-BR");
  const isOperation = reportType === "operation";
  const identification = isOperation
    ? `RG.PROD.${cycle.linha_id}.001`
    : line.rg;
  const title = `${reportTitle.toUpperCase()} — ${line.name.toUpperCase()}`;

  return (
    <section className="report-document-header overflow-hidden rounded-[1.25rem] border border-slate-400 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.06)]">
      <div className="grid md:grid-cols-[10.5rem_1fr]">
        <div className="flex min-h-36 items-center justify-center border-b border-slate-400 p-6 md:border-b-0 md:border-r">
          <img
            src="/images/logo-cicopal.png"
            alt="Cicopal"
            className="h-auto w-32 object-contain"
          />
        </div>
        <div>
          <div className="border-b border-slate-400 px-5 py-3 text-center sm:px-7">
            <p className="text-sm font-black tracking-tight text-slate-950 sm:text-base">SISTEMA DE GESTÃO DA QUALIDADE</p>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-600">Registro geral digital</p>
          </div>
          <div className="grid border-b border-slate-400 sm:grid-cols-2">
            <DocumentDatum label="Identificação" value={identification} bordered />
            <DocumentDatum label="Revisão" value="03" />
            <DocumentDatum label="Data de produção" value={productionDate} bordered />
            <DocumentDatum label="Folha" value="Consulta digital / PDF" />
          </div>
        </div>
      </div>
      <div className="border-b border-slate-400 px-5 py-3 sm:px-7">
        <span className="mr-1 text-xs font-black uppercase tracking-wide text-slate-500">Título:</span>
        <span className="text-sm font-black text-slate-950 sm:text-base">{title}</span>
      </div>
      <div className="grid lg:grid-cols-[1fr_17rem]">
        <div className="border-b border-slate-400 lg:border-b-0 lg:border-r">
          <div className="bg-[#c9c9c9] px-5 py-2 text-center text-xs font-black uppercase tracking-[0.14em] text-slate-900">Escopo do registro</div>
          <div className="grid gap-3 px-5 py-4 sm:grid-cols-3">
            <DocumentContext label="Linha" value={line.name} />
            <DocumentContext label="Produto" value={cycle.produto ?? "Não informado"} />
            <DocumentContext label="Lote da produção" value={cycle.metadata?.productionCode ?? cycle.id} />
          </div>
        </div>
        <div>
          <div className="bg-[#c9c9c9] px-5 py-2 text-center text-xs font-black uppercase tracking-[0.14em] text-slate-900">Legenda</div>
          <div className="grid grid-cols-[3.25rem_1fr] divide-x divide-slate-300 px-5 py-3 text-xs font-bold">
            <div className="space-y-1 pr-3"><span className="block bg-emerald-500 px-2 py-1 text-center text-emerald-950">C</span><span className="block bg-red-500 px-2 py-1 text-center text-red-950">NC</span><span className="block bg-slate-300 px-2 py-1 text-center text-slate-800">NA</span></div>
            <div className="space-y-1 pl-3 text-slate-700"><span className="block py-1">Conforme</span><span className="block py-1">Não conforme</span><span className="block py-1">Não se aplica</span></div>
          </div>
        </div>
      </div>
      <p className="report-document-header__caption border-t border-slate-200 bg-slate-50 px-5 py-2 text-xs font-medium text-slate-500 sm:px-7">Registro emitido a partir dos apontamentos do ciclo. Para gerar o arquivo, use “PDF” e escolha “Salvar como PDF” no navegador.</p>
    </section>
  );
}

function DocumentDatum({ label, value, bordered = false }) {
  return <div className={`flex min-h-11 items-center gap-1 px-4 py-2 text-sm ${bordered ? "border-b border-slate-300 sm:border-b-0 sm:border-r" : ""}`}><span className="font-black text-slate-900">{label}:</span><span className="font-semibold text-slate-700">{value}</span></div>;
}

function DocumentContext({ label, value }) {
  return <div><p className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-500">{label}</p><p className="mt-1 text-sm font-bold text-slate-900">{value}</p></div>;
}

function ExecutiveMetric({ label, value, note, accent = "blue" }) {
  const colors = {
    blue: "border-cicopal-blue text-cicopal-blue",
    green: "border-cicopal-green text-cicopal-green",
    amber: "border-amber-500 text-amber-700",
    red: "border-cicopal-red text-cicopal-red",
  };
  return <article className="border-l-4 border-transparent bg-white px-5 py-4"><p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p><strong className={`mt-2 block text-3xl font-black tracking-tight ${colors[accent]}`}>{value}</strong><span className="mt-1 block text-xs font-semibold text-slate-500">{note}</span></article>;
}

function ProductionDayGroup({ cycles, onOpenProcess }) {
  const day = new Date(cycles[0].iniciado_em);
  const ncCount = cycles.reduce((total, cycle) => total + cycle.ncCount, 0);
  return (
    <details className="group/day" open>
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 border-l-4 border-cicopal-blue bg-slate-50 px-6 py-5 sm:px-8">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-cicopal-blue">Dia de produção</p>
          <h4 className="mt-1 text-lg font-black capitalize text-slate-950">{day.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</h4>
        </div>
        <div className="flex items-center gap-2 text-xs font-black">
          <span className="border border-slate-200 bg-white px-3 py-2 text-slate-700">{cycles.length} produção(ões)</span>
          {ncCount ? <span className="bg-red-50 px-3 py-2 text-cicopal-red">{ncCount} NC</span> : null}
          <span className="text-cicopal-blue group-open/day:hidden">Abrir</span>
          <span className="hidden text-cicopal-blue group-open/day:inline">Fechar</span>
        </div>
      </summary>
      <div className="divide-y divide-slate-200">{cycles.map((cycle) => <ExecutiveCycle key={cycle.id} cycle={cycle} onOpenProcess={onOpenProcess} />)}</div>
    </details>
  );
}

function ExecutiveCycle({ cycle, onOpenProcess }) {
  const needsAttention = cycle.ncCount > 0 || cycle.compliance < 100 || cycle.interruptions.some((item) => !item.encerrada_em);
  return (
    <details className={`report-row group border-l-4 ${needsAttention ? "border-amber-500" : "border-transparent"}`}>
      <summary className="grid cursor-pointer list-none gap-4 px-6 py-6 transition hover:bg-slate-50 sm:px-8 lg:grid-cols-[1.4fr_1fr_1fr_auto] lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-black text-cicopal-blue">{cycle.metadata?.productionCode ?? cycle.id}</span>
            <span className={cycle.encerrado_em ? "border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-black uppercase text-slate-600" : "bg-cicopal-blue px-2 py-1 text-[10px] font-black uppercase text-white"}>{cycle.encerrado_em ? "Encerrada" : "Em andamento"}</span>
          </div>
          <h4 className="mt-2 text-lg font-black text-slate-950">{cycle.line.name} <span className="font-medium text-slate-400">/</span> {cycle.produto ?? "Produto não informado"}</h4>
          <p className="mt-1 text-sm font-medium text-slate-500">{new Date(cycle.iniciado_em).toLocaleString("pt-BR")} · {cycle.operator}</p>
        </div>
        <CycleDatum label="Duração" value={duration(cycle.producao_iniciada_em, cycle.producao_encerrada_em ?? cycle.encerrado_em)} />
        <CycleDatum label="Controles" value={`${cycle.compliance}%`} note={`${cycle.completedControls}/${cycle.expectedControls} concluídos`} tone={cycle.compliance < 100 ? "amber" : "green"} />
        <div className="flex items-center gap-2 lg:justify-end">
          {cycle.ncCount ? <span className="bg-red-50 px-3 py-2 text-xs font-black text-cicopal-red">{cycle.ncCount} NC</span> : <span className="bg-green-50 px-3 py-2 text-xs font-black text-cicopal-green">Sem NC</span>}
          <span className="border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 group-open:hidden">Detalhar</span>
          <span className="border border-cicopal-blue bg-blue-50 px-3 py-2 text-xs font-black text-cicopal-blue hidden group-open:inline">Fechar</span>
        </div>
      </summary>
      <div className="border-t border-slate-200 bg-slate-50/70 px-6 py-5 sm:px-8">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Consultar processo</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <ProcessButton label="Higienização" note={cycle.hygiene ? "Concluída" : "Pendente"} onClick={() => onOpenProcess({ cycle, type: "hygiene" })} />
          <ProcessButton label="Relatório completo" note="Todos os registros desta produção" onClick={() => onOpenProcess({ cycle, type: "full" })} />
          <ProcessButton label="Liberação do produto" note={cycle.release ? "Registrada" : "Pendente"} onClick={() => onOpenProcess({ cycle, type: "release" })} />
          <ProcessButton label="Qualidade hora a hora" note={`${hourGroups(cycle).length} horário(s)`} onClick={() => onOpenProcess({ cycle, type: "hourly" })} />
          <ProcessButton label="Operação" note={`${cycle.processRecords.length} apontamento(s)`} onClick={() => onOpenProcess({ cycle, type: "operation" })} />
          <ProcessButton label="Rastreabilidade" note={`${cycle.automationLots.length} lotes`} onClick={() => onOpenProcess({ cycle, type: "traceability" })} />
          <ProcessButton label="Ocorrências" note={`${cycle.ncCount} NC · ${cycle.interruptions.length} parada(s)`} alert={Boolean(cycle.ncCount || cycle.interruptions.length)} onClick={() => onOpenProcess({ cycle, type: "occurrences" })} />
        </div>
      </div>
    </details>
  );
}

function ProcessButton({ label, note, alert = false, onClick }) {
  return <button type="button" onClick={onClick} className={`flex min-h-20 items-center justify-between gap-4 border-l-4 bg-white px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${alert ? "border-cicopal-red" : "border-cicopal-blue"}`}><span><strong className="block text-sm text-slate-950">{label}</strong><span className="mt-1 block text-xs font-semibold text-slate-500">{note}</span></span><span className="text-lg font-black text-cicopal-blue">→</span></button>;
}

function ProcessModal({ selection, onClose }) {
  if (!selection) return null;
  const { cycle, type } = selection;
  const titles = {
    full: "Registro geral da produção",
    hygiene: "Higienização",
    release: "Liberação do produto",
    hourly: "Qualidade hora a hora",
    operation: "Apontamentos operacionais",
    traceability: "Rastreabilidade",
    occurrences: "Ocorrências",
  };
  const exportReport = () => {
    const previousTitle = document.title;
    const code = cycle.metadata?.productionCode ?? cycle.id;
    const restore = () => {
      document.title = previousTitle;
      delete document.body.dataset.reportExport;
      window.removeEventListener("afterprint", restore);
    };
    document.title = `${titles[type].toLowerCase().replaceAll(" ", "-")}-${code}`;
    document.body.dataset.reportExport = "process";
    window.addEventListener("afterprint", restore);
    window.print();
  };
  return (
    <div className="process-report-modal fixed inset-0 z-[250] grid place-items-center bg-slate-950/45 p-3 backdrop-blur-sm" role="presentation" onMouseDown={onClose}>
      <section role="dialog" aria-modal="true" aria-label={titles[type]} onMouseDown={(event) => event.stopPropagation()} className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-[2rem] bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 px-6 py-5 backdrop-blur sm:px-8">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-cicopal-blue">{cycle.metadata?.productionCode ?? cycle.id}</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">{titles[type]}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">{cycle.line.name} · {cycle.produto ?? "Produto não informado"} · {new Date(cycle.iniciado_em).toLocaleDateString("pt-BR")}</p>
          </div>
          <div className="process-report-actions flex shrink-0 gap-2"><button type="button" onClick={exportReport} className="inline-flex min-h-11 items-center gap-2 border border-slate-300 px-3 text-sm font-black text-slate-800 hover:border-cicopal-blue hover:text-cicopal-blue"><Printer size={17} /> PDF</button><button type="button" onClick={onClose} className="grid size-11 place-items-center rounded-full border border-slate-200 text-slate-700 hover:border-cicopal-blue hover:text-cicopal-blue" aria-label="Fechar detalhes"><X size={20} /></button></div>
        </header>
        <div className="px-6 py-6 sm:px-8"><ControlledDocumentHeader cycle={cycle} reportTitle={titles[type]} reportType={type} /><div className="mt-7"><ProcessModalContent cycle={cycle} type={type} /></div></div>
      </section>
    </div>
  );
}

function ProcessModalContent({ cycle, type }) {
  if (type === "full") return <FullProductionReport cycle={cycle} />;
  if (type === "hygiene") return <><HygieneTimeline cycle={cycle} /><div className="mt-7"><HygieneEvaluationTable records={hygieneReportRecords(cycle)} emptyText="Nenhum checklist de higienização neste dia." /></div></>;
  if (type === "release") return <ProductReleaseReport records={releaseReportRecords(cycle)} emptyText="Nenhuma liberação registrada nesta produção." />;
  if (type === "hourly") return <HourlyQualityDetails hours={hourGroups(cycle)} />;
  if (type === "operation") return <OperationalProcessDetails groups={processRecordGroups(cycle)} />;
  if (type === "traceability") return <TraceabilitySummary cycle={cycle} />;
  return <OccurrenceSummary cycle={cycle} />;
}

function FullProductionReport({ cycle }) {
  return <div className="space-y-8"><section><ReportSectionTitle>Higienização</ReportSectionTitle><HygieneTimeline cycle={cycle} /><div className="mt-6"><HygieneEvaluationTable records={hygieneReportRecords(cycle)} emptyText="Nenhum checklist de higienização nesta produção." /></div></section><section><ReportSectionTitle>Liberação do produto</ReportSectionTitle><ProductReleaseReport records={releaseReportRecords(cycle)} emptyText="Nenhuma liberação registrada nesta produção." /></section><section><ReportSectionTitle>Qualidade hora a hora</ReportSectionTitle><HourlyQualityDetails hours={hourGroups(cycle)} /></section><section><ReportSectionTitle>Apontamentos operacionais</ReportSectionTitle><OperationalProcessDetails groups={processRecordGroups(cycle)} /></section><section><ReportSectionTitle>Rastreabilidade</ReportSectionTitle><TraceabilitySummary cycle={cycle} /></section><section><ReportSectionTitle>Ocorrências</ReportSectionTitle><OccurrenceSummary cycle={cycle} /></section></div>;
}

function ReportSectionTitle({ children }) {
  return <h3 className="mb-4 border-y border-slate-400 bg-[#c9c9c9] px-4 py-2 text-center text-xs font-black uppercase tracking-[0.14em] text-slate-900">{children}</h3>;
}

function HygieneTimeline({ cycle }) {
  if (!cycle.hygieneRounds?.length) return <EmptyDetail text="Não há uma rodada detalhada de higienização para esta produção." />;
  return (
    <section>
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Histórico da higienização</p>
      <div className="mt-3 divide-y divide-slate-200 border-y border-slate-200">
        {cycle.hygieneRounds.map((round) => {
          const approved = round.status === "aprovada";
          const refused = ["reprovada", "em_correcao"].includes(round.status);
          return <article key={round.id} className="grid gap-4 py-4 md:grid-cols-[1fr_1fr_auto] md:items-center">
            <div><p className="text-xs font-black uppercase text-slate-400">Operação</p><strong className="mt-1 block text-slate-950">{round.executorName || "Responsável não identificado"}</strong><p className="mt-1 text-sm text-slate-600">Abriu às {round.execucao_iniciada_em ? new Date(round.execucao_iniciada_em).toLocaleString("pt-BR") : "—"} · finalizou às {round.enviada_inspecao_em ? new Date(round.enviada_inspecao_em).toLocaleString("pt-BR") : "—"}</p></div>
            <div><p className="text-xs font-black uppercase text-slate-400">Qualidade</p><strong className="mt-1 block text-slate-950">{round.inspectorName || "Aguardando avaliação"}</strong><p className="mt-1 text-sm text-slate-600">{round.inspecao_encerrada_em ? `Decisão em ${new Date(round.inspecao_encerrada_em).toLocaleString("pt-BR")}` : "Inspeção ainda não finalizada"}</p></div>
            <span className={approved ? "justify-self-start bg-green-50 px-3 py-2 text-xs font-black text-cicopal-green md:justify-self-end" : refused ? "justify-self-start bg-red-50 px-3 py-2 text-xs font-black text-cicopal-red md:justify-self-end" : "justify-self-start bg-amber-50 px-3 py-2 text-xs font-black text-amber-800 md:justify-self-end"}>{approved ? "APROVADA" : refused ? "RECUSADA" : "EM AVALIAÇÃO"}</span>
          </article>;
        })}
      </div>
    </section>
  );
}

function TraceabilitySummary({ cycle }) {
  return <div className="grid gap-7 md:grid-cols-2"><section><p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Lotes de insumo</p><div className="mt-3 divide-y divide-slate-200 border-y border-slate-200">{cycle.automationLots.length ? cycle.automationLots.map((lot) => <article key={lot.id} className="py-3"><strong>{lot.input?.nome ?? "Insumo"}</strong><p className="mt-1 text-sm text-slate-600">Lote {lot.lote_fornecedor} · {lot.fornecedor}</p></article>) : <EmptyDetail text="Nenhum lote informado." />}</div></section><section><p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Bateladas</p><div className="mt-3 divide-y divide-slate-200 border-y border-slate-200">{cycle.batches.length ? cycle.batches.map((batch) => <article key={batch.id} className="py-3"><strong>Batelada {batch.numero}</strong><p className="mt-1 text-sm text-slate-600">{batch.status.replaceAll("_", " ")} · {duration(batch.iniciada_em, batch.finalizada_em)}</p></article>) : <EmptyDetail text="Nenhuma batelada registrada." />}</div></section></div>;
}

function OccurrenceSummary({ cycle }) {
  if (!cycle.ncs.length && !cycle.interruptions.length) return <EmptyDetail text="Nenhuma ocorrência registrada." />;
  return <div className="space-y-3">{cycle.ncs.map((nc, index) => <article key={nc.id ?? index} className="border-l-4 border-cicopal-red bg-red-50 p-4"><strong className="text-red-900">NC · {nc.item ?? nc.descricao}</strong><p className="mt-1 text-sm text-red-800">{nc.causa ?? nc.descricao ?? "Causa não informada"}</p></article>)}{cycle.interruptions.map((item) => <article key={item.id} className="border-l-4 border-amber-500 bg-amber-50 p-4"><strong className="uppercase text-amber-900">{item.classificacao}</strong><p className="mt-1 font-semibold text-slate-800">{item.motivo}</p><p className="mt-1 text-sm text-amber-900">Duração {duration(item.iniciada_em, item.encerrada_em)}</p></article>)}</div>;
}

function CycleDatum({ label, value, note, tone = "slate" }) {
  const colors = { slate: "text-slate-950", green: "text-cicopal-green", amber: "text-amber-700", red: "text-cicopal-red" };
  return <div><p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p><strong className={`mt-1 block text-sm font-black ${colors[tone]}`}>{value}</strong>{note ? <span className="mt-1 block text-xs font-medium text-slate-500">{note}</span> : null}</div>;
}

function operationalReadingLabel(key) {
  const labels = {
    umidade: "Umidade",
    velocidade_esteira: "Velocidade da esteira",
    velocidade_linha: "Velocidade da linha",
    velocidade_linha_kg_h: "Velocidade da linha",
  };
  if (labels[key]) return labels[key];
  const zone = key.match(/^zona_(\d+)_(setpoint|real)$/);
  if (zone) return `Zona ${zone[1]} · ${zone[2] === "setpoint" ? "Set point" : "Temperatura real"}`;
  const machine = key.match(/^maq_(\d+)_(.+)$/);
  if (machine) return `Máquina ${machine[1]} · ${fieldLabel(machine[2])}`;
  return fieldLabel(key);
}

function operationalReadingUnit(key) {
  if (key === "umidade") return "%";
  if (key.includes("zona_")) return "°C";
  if (key.includes("peso") || key.includes("sobrepeso")) return "g";
  if (key.includes("velocidade")) return "m/min";
  if (key.includes("velocidade_linha_kg_h")) return "kg/h";
  if (key.includes("pacotes_min")) return "pacotes/min";
  if (key.includes("caixas_min")) return "caixas/min";
  return "";
}

function HourlyQualityDetails({ hours }) {
  if (!hours.length) return <EmptyDetail text="Nenhuma avaliação hora a hora registrada." />;
  const matrices = hourlyControlMatrices(hours);
  return (
    <div className="space-y-7">
      <p className="text-sm font-medium leading-6 text-slate-600">Consolidação dos controles por janela horária. C = conforme, NC = não conforme e — = sem registro.</p>
      {matrices.map((matrix) => <HourlyControlMatrix key={matrix.machine} matrix={matrix} />)}
    </div>
  );
}

function hourlyControlMatrices(hours) {
  const hourColumns = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, "0")}:00`);
  const matrices = new Map();
  const matrixFor = (machine) => {
    if (!matrices.has(machine)) matrices.set(machine, { machine, values: new Map() });
    return matrices.get(machine);
  };

  hours.forEach((hour) => {
    const time = hour.label.match(/(\d{2}:\d{2})$/)?.[1];
    if (!time) return;
    hour.items.forEach((record) => {
      const source = record.contexto_tipo === "produto_avaliacao" ? "Produto" : "Processo";
      fillingDetails(record).forEach((entry) => {
        const raw = entry.resultado ?? entry.valor ?? entry.av1;
        if (raw === undefined || raw === null || raw === "") return;
        const machineMatch = String(entry.maquina ?? "").match(/(\d+)/);
        const machine = machineMatch ? `MÁQUINA: ${machineMatch[1].padStart(2, "0")}` : "CONTROLE GERAL";
        const item = entry.item ?? "Leitura";
        const rowKey = `${source}:${item}`;
        const matrix = matrixFor(machine);
        if (!matrix.values.has(rowKey)) matrix.values.set(rowKey, { label: item, source, readings: {} });
        matrix.values.get(rowKey).readings[time] = { raw, unit: entry.unidade };
      });
    });
  });

  return [...matrices.values()].map((matrix) => ({
    ...matrix,
    hours: hourColumns,
    rows: [...matrix.values.values()],
  })).sort((first, second) => first.machine.localeCompare(second.machine, "pt-BR"));
}

function HourlyControlMatrix({ matrix }) {
  return (
    <section className="hourly-matrix overflow-hidden border border-slate-400 bg-white">
      <header className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-slate-400 bg-[#c9c9c9] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-900">
        <span>{matrix.machine}</span><span>Controle hora a hora</span>
      </header>
      <div className="overflow-x-auto">
        <table className="min-w-[58rem] w-full border-collapse text-center text-[11px]">
          <thead className="bg-[#e2e2e2] text-slate-900">
            <tr><th scope="col" className="sticky left-0 z-[1] min-w-36 border-b border-r border-slate-400 bg-[#d2d2d2] px-3 py-2 text-left">Item avaliado</th>{matrix.hours.map((hour) => <th key={hour} scope="col" className="min-w-9 border-b border-r border-slate-400 px-1 py-2 font-black tabular-nums">{hour}</th>)}</tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => <tr key={`${row.source}-${row.label}`}><th scope="row" className="sticky left-0 z-[1] border-b border-r border-slate-400 bg-white px-3 py-2 text-left text-[11px] font-bold text-slate-800"><span className="block">{row.label}</span><span className="mt-0.5 block text-[9px] font-medium uppercase tracking-wide text-slate-400">{row.source}</span></th>{matrix.hours.map((hour) => <HourlyMatrixCell key={hour} reading={row.readings[hour]} />)}</tr>)}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function HourlyMatrixCell({ reading }) {
  if (!reading) return <td className="border-b border-r border-slate-300 px-1 py-2 text-slate-300">—</td>;
  const normalized = String(reading.raw).trim().toUpperCase();
  const nc = ["N", "NC", "NÃO CONFORME", "NAO CONFORME"].includes(normalized);
  const conforming = ["C", "CONFORME"].includes(normalized);
  const value = conforming ? "C" : nc ? "NC" : `${reading.raw}${reading.unit ? ` ${reading.unit}` : ""}`;
  return <td className={nc ? "border-b border-r border-slate-300 bg-red-100 px-1 py-2 font-black text-cicopal-red" : conforming ? "border-b border-r border-slate-300 bg-emerald-100 px-1 py-2 font-black text-cicopal-green" : "border-b border-r border-slate-300 px-1 py-2 font-bold text-slate-900"}>{value}</td>;
}

function OperationalProcessDetails({ groups }) {
  if (!groups.length) return <EmptyDetail text="Nenhum apontamento operacional." />;
  return (
    <div className="divide-y divide-slate-200">
      {groups.map(([name, records]) => (
        <details key={name} className="group/process" open>
          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Processo</p>
              <strong className="mt-1 block text-lg text-slate-950">{name}</strong>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-black text-slate-500">{records.length} leitura(s)</span>
              <span className="text-xs font-black text-cicopal-blue group-open/process:hidden">Abrir</span>
              <span className="hidden text-xs font-black text-cicopal-blue group-open/process:inline">Fechar</span>
            </div>
          </summary>
          <div className="space-y-3 pb-5">
            {records.map((record) => {
              const readings = Object.entries(record.valores ?? {})
                .filter(([key, value]) => !key.startsWith("_") && value !== null && value !== "" && ["string", "number", "boolean"].includes(typeof value))
                .map(([key, value]) => ({ key, value }));
              return (
                <article key={record.id} className="border-l-4 border-cicopal-blue bg-white py-4 pl-4 pr-3">
                  <header className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <strong className="tabular-nums text-slate-950">{new Date(record.horario_previsto ?? record.preenchido_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</strong>
                      <span className="ml-2 text-xs font-bold text-slate-500">registro operacional</span>
                    </div>
                    <span className={record.status_prazo === "atrasado" ? "text-xs font-black text-cicopal-red" : "text-xs font-black text-cicopal-green"}>{record.status_prazo === "atrasado" ? "ATRASADO" : "NO PRAZO"}</span>
                  </header>
                  {readings.length ? <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">{readings.map((reading) => <div key={reading.key} className="border-b border-slate-100 pb-3"><dt className="text-[11px] font-black uppercase tracking-wide text-slate-400">{operationalReadingLabel(reading.key)}</dt><dd className="mt-1 text-lg font-black text-slate-900">{String(reading.value)} {operationalReadingUnit(reading.key)}</dd></div>)}</dl> : <p className="mt-3 text-sm font-medium text-slate-500">Não há leituras numéricas neste apontamento.</p>}
                </article>
              );
            })}
          </div>
        </details>
      ))}
    </div>
  );
}

function ReportDisclosure({ title, children, alert = false }) {
  return <details className={`border-t-2 bg-transparent ${alert ? "border-amber-300" : "border-slate-200"}`}><summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-4 font-black text-slate-900"><span>{title}</span><span className="text-xs text-cicopal-blue">Abrir</span></summary><div className="border-t border-slate-200 pb-4 pt-4">{children}</div></details>;
}

function HygieneEvaluationTable({ records, emptyText }) {
  const groups = new Map();
  records.forEach((record) => {
    const isQuality = /qualidade/i.test(record.label);
    checklistEntries(record.payload).forEach((entry) => {
      const group = entry.group || "Itens avaliados";
      if (!groups.has(group)) groups.set(group, new Map());
      const items = groups.get(group);
      if (!items.has(entry.item)) items.set(entry.item, { item: entry.item, first: "", second: "" });
      const row = items.get(entry.item);
      if (isQuality) row.second = entry.qualityResult ?? entry.result;
      else {
        row.first = entry.result;
        if (entry.qualityResult) row.second = entry.qualityResult;
      }
    });
  });
  if (!groups.size) return <EmptyDetail text={emptyText} />;

  return <div className="space-y-6">{[...groups.entries()].map(([group, entries]) => <section key={group} className="report-checklist-table overflow-hidden border border-slate-400 bg-white"><table className="w-full border-collapse text-sm"><thead><tr className="bg-[#c9c9c9] text-slate-950"><th scope="col" className="border-b border-r border-slate-400 px-4 py-3 text-left font-black">{group}</th><th scope="col" className="w-28 border-b border-r border-slate-400 px-2 py-3 text-center text-xs font-black">1ª Avaliação</th><th scope="col" className="w-28 border-b border-slate-400 px-2 py-3 text-center text-xs font-black">2ª Avaliação</th></tr></thead><tbody>{[...entries.values()].map((entry) => <tr key={entry.item}><th scope="row" className="border-b border-r border-slate-300 px-4 py-2 text-left font-semibold text-slate-800">{entry.item}</th><ResultTableCell value={entry.first} /><ResultTableCell value={entry.second} /></tr>)}</tbody></table></section>)}</div>;
}

const productReleaseGroups = [
  {
    title: "LIBERAÇÃO DO PRODUTO",
    fields: ["Sabor e odor", "Textura", "Aspecto visual", "Peso do pacote (g)", "Selagem", "Datador", "Impressão", "Micro furo · máquina 1", "Micro furo · máquina 2", "Micro furo · máquina 3", "Micro furo · máquina 4"],
  },
  {
    title: "PARÂMETROS DO PROCESSO",
    fields: ["Ponto de massa", "Peso corte a fio lado operacional", "Peso corte a fio lado não operacional", "Peso 10 biscoitos lado operacional", "Peso 10 biscoitos lado não operacional"],
  },
];

function normalizedReportField(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function ProductReleaseReport({ records, emptyText }) {
  const productRecords = records.filter((record) => record.kind !== "machine");
  if (!productRecords.length) return <EmptyDetail text={emptyText} />;
  const readings = productRecords.map((record) => ({
    ...record,
    byField: new Map(checklistEntries(record.payload).map((entry) => [normalizedReportField(entry.item), entry.result])),
  }));
  return <div className="space-y-6">{productReleaseGroups.map((group) => <section key={group.title} className="product-release-table overflow-hidden border border-slate-400 bg-white"><div className="border-b border-slate-400 bg-[#c9c9c9] px-4 py-2 text-center text-xs font-black uppercase tracking-[0.14em] text-slate-900">{group.title}</div><div className="overflow-x-auto"><table className="min-w-[58rem] w-full border-collapse text-center text-xs"><thead><tr className="bg-white text-slate-950"><th scope="col" className="min-w-16 border-b border-r border-slate-400 px-2 py-3 font-black">Hora</th>{group.fields.map((field) => <th key={field} scope="col" className="min-w-24 border-b border-r border-slate-400 px-2 py-3 font-black leading-tight">{field}</th>)}</tr></thead><tbody>{readings.map((record) => <tr key={record.id}><th scope="row" className="border-b border-r border-slate-300 px-2 py-3 font-black tabular-nums text-slate-800">{releaseDecisionTime(record.at)}</th>{group.fields.map((field) => <ResultTableCell key={field} value={record.byField.get(normalizedReportField(field))} />)}</tr>)}</tbody></table></div></section>)}</div>;
}

function releaseDecisionTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function ResultTableCell({ value }) {
  if (value === undefined || value === null || value === "") return <td className="border-b border-r border-slate-300 px-2 py-2 text-slate-300">—</td>;
  const normalized = String(value).trim().toUpperCase();
  const nc = ["N", "NC", "NÃO CONFORME", "NAO CONFORME"].includes(normalized);
  const conforming = ["C", "CONFORME"].includes(normalized);
  return <td className={nc ? "border-b border-r border-slate-300 bg-red-100 px-2 py-2 font-black text-cicopal-red" : conforming ? "border-b border-r border-slate-300 bg-emerald-100 px-2 py-2 font-black text-cicopal-green" : "border-b border-r border-slate-300 px-2 py-2 font-bold text-slate-900"}>{conforming ? "C" : nc ? "NC" : String(value)}</td>;
}

function SimplifiedChecklistByContact({ records, emptyText }) {
  if (!records.length) return <EmptyDetail text={emptyText} />;

  return (
    <div className="space-y-4">
      {records.map((record) => {
        const entries = checklistEntries(record.payload)
          .map((entry) => ({
            ...entry,
            result: String(entry.qualityResult ?? entry.result ?? "").toUpperCase(),
          }))
          .filter((entry) => entry.result && !["NA", "N/A", "—"].includes(entry.result));
        const groups = [
          {
            title: "Sem contato com o produto",
            entries: entries.filter((entry) => String(entry.group).toUpperCase().includes("SEM CONTATO")),
          },
          {
            title: "Com contato com o produto",
            entries: entries.filter((entry) => !String(entry.group).toUpperCase().includes("SEM CONTATO")),
          },
        ];
        return (
          <article key={record.id} className="border-t-2 border-slate-200 py-4">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <strong className="text-sm text-slate-950">{record.label}</strong>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {record.at ? new Date(record.at).toLocaleString("pt-BR") : "Data não informada"}
                </p>
              </div>
              <span className="border border-slate-200 bg-white px-2 py-1 text-[10px] font-black uppercase text-slate-600">
                {String(record.status ?? "registrado").replaceAll("_", " ")}
              </span>
            </header>
            {!entries.length ? <p className="pt-3 text-sm font-medium text-slate-500">Sem itens com resultado para exibir.</p> : (
              <div className="mt-3 grid gap-4 lg:grid-cols-2">
                {groups.map((group) => (
                  <section key={group.title}>
                    <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{group.title}</p>
                    <div className="mt-2 divide-y divide-slate-200 border-y border-slate-200 bg-white">
                      {group.entries.length ? group.entries.map((entry) => {
                        const nc = ["N", "NC", "NÃO CONFORME", "NAO CONFORME"].includes(entry.result);
                        return (
                          <div key={entry.id} className="flex items-center justify-between gap-3 px-3 py-2">
                            <span className="text-sm font-semibold text-slate-700">{entry.item}</span>
                            <span className={nc ? "shrink-0 bg-red-50 px-2 py-1 text-xs font-black text-cicopal-red" : "shrink-0 bg-green-50 px-2 py-1 text-xs font-black text-cicopal-green"}>{nc ? "NC" : "C"}</span>
                          </div>
                        );
                      }) : <p className="px-3 py-3 text-sm font-medium text-slate-500">Sem itens registrados.</p>}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function EmptyDetail({ text }) {
  return <p className="border border-dashed border-slate-300 bg-slate-50 p-3 text-sm font-medium text-slate-500">{text}</p>;
}
