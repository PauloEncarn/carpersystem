"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock3,
  Gauge,
  LoaderCircle,
  Radio,
  RefreshCw,
  Signal,
  Sparkle,
  X,
} from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import { repairTextDeep } from "@/lib/textEncoding";
import {
  classifyProductValue,
  makeTestSpecifications,
  matchSpecification,
  specificationTone,
} from "@/lib/productSpecifications";

const lineLayout = [
  {
    id: "PUR",
    name: "Pururuca",
    area: { left: "17%", top: "7%", width: "69%", height: "26%" },
  },
  {
    id: "SAL",
    name: "Salgadinho",
    area: { left: "13%", top: "31%", width: "73%", height: "27%" },
  },
  {
    id: "ROS",
    name: "Rosca",
    area: { left: "16%", top: "57%", width: "70%", height: "27%" },
  },
];
const rgByLine = {
  PUR: "RG.QUA.005",
  SAL: "RG.QUA.004",
  ROS: "RG.QUA.BA.003",
};
const processLabels = {
  higienizacao: "Higienização",
  produto_liberacao: "Liberação do produto",
  produto_avaliacao: "Avaliação do produto",
  processo: "Avaliação do processo",
  fotografico: "Registro fotográfico",
};
const activeStatuses = new Set([
  "higienizacao",
  "hygiene",
  "aguardando_liberacao",
  "awaiting_release",
  "pronto",
  "ready",
  "produzindo",
  "producing",
  "bloqueado",
  "blocked",
]);
const STATUS_VISUAL = {
  producing: {
    label: "Produzindo",
    dot: "bg-emerald-400",
    badge: "bg-emerald-500 text-white",
    glow: "shadow-[0_0_0_1px_rgba(16,185,129,.35),0_0_28px_-4px_rgba(16,185,129,.65)]",
    Icon: Gauge,
  },
  blocked: {
    label: "Bloqueada",
    dot: "bg-rose-400",
    badge: "bg-rose-500 text-white",
    glow: "shadow-[0_0_0_1px_rgba(244,63,94,.4),0_0_28px_-4px_rgba(244,63,94,.75)]",
    Icon: AlertTriangle,
  },
  ended: {
    label: "Encerrada",
    dot: "bg-slate-400",
    badge: "bg-slate-600 text-white",
    glow: "shadow-[0_0_0_1px_rgba(100,116,139,.3)]",
    Icon: CheckCircle2,
  },
  prep: {
    label: "Preparação",
    dot: "bg-cicopal-blue",
    badge: "bg-cicopal-blue text-white",
    glow: "shadow-[0_0_0_1px_rgba(30,34,168,.35),0_0_24px_-6px_rgba(30,34,168,.55)]",
    Icon: Clock3,
  },
  inactive: {
    label: "Inativa",
    dot: "bg-slate-300",
    badge: "bg-slate-200 text-slate-600",
    glow: "shadow-none",
    Icon: Radio,
  },
};
function statusVisual(status) {
  if (["produzindo", "producing"].includes(status))
    return STATUS_VISUAL.producing;
  if (["bloqueado", "blocked"].includes(status)) return STATUS_VISUAL.blocked;
  if (["encerrado", "ended"].includes(status)) return STATUS_VISUAL.ended;
  if (status) return STATUS_VISUAL.prep;
  return STATUS_VISUAL.inactive;
}
function localDayStart() {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).toISOString();
}
function time(value) {
  return value
    ? new Date(value).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
}
function statusLabel(status) {
  return statusVisual(status).label;
}
function processLiveValue(process) {
  const values = process?.latestRecord?.valores ?? {};
  if (process?.codigo === "corte_fio")
    return `${(Number(values.cortes_hora || 0) / 60).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} cortes/min`;
  if (process?.codigo === "empacotamento")
    return `${[1, 2, 3, 4].reduce((total, index) => total + Number(values[`maq_${index}_pacotes_min`] || 0), 0).toLocaleString("pt-BR")} pacotes/min`;
  if (process?.codigo === "encaixotamento")
    return `${Number(values.caixas_min || 0).toLocaleString("pt-BR")} caixas/min`;
  if (process?.codigo === "forno")
    return `Umidade ${values.umidade ?? "—"}% · ${values.zona_1_real ?? "—"}°C na Z1`;
  return Object.values(values)[0]
    ? `Lote ${Object.values(values)[0]}`
    : "Sem apontamento";
}
const controlMetric = {
  corte_fio: {
    key: "cortes_hora",
    label: "Cortes projetados",
    unit: "cortes/min",
    divisor: 60,
    ranges: [60, 80, 120, 140],
  },
  forno: { key: "umidade", label: "Umidade", unit: "%", divisor: 1, ranges: [1.5, 2, 4, 4.5] },
  empacotamento: {
    key: "maq_1_pacotes_min",
    label: "Pacotes · máquina 1",
    unit: "pacotes/min",
    divisor: 1,
    ranges: [25, 35, 55, 65],
  },
  encaixotamento: {
    key: "caixas_min",
    label: "Caixas",
    unit: "caixas/min",
    divisor: 1,
    ranges: [3, 4, 8, 9],
  },
};
function ControlChart({ process, now, metricOverride = null }) {
  const metric = metricOverride ?? controlMetric[process.codigo];
  if (!metric) return null;
  const history = [...(process.recordHistory ?? [])].sort(
    (a, b) => new Date(a.horario_referencia) - new Date(b.horario_referencia),
  );
  const samples = [
    { label: "Início", value: 0 },
    ...history.map((record) => ({
      label: time(record.horario_referencia),
      value: (Number(record.valores?.[metric.key]) || 0) / metric.divisor,
    })),
  ];
  const max = Math.max(
    1,
    ...(metric.ranges ?? []),
    ...samples.map((item) => item.value),
  ) * 1.08;
  const yFor = (value) => 155 - (value / max) * 120;
  const points = samples
    .map(
      (item, index) =>
        `${30 + (index * 500) / Math.max(1, samples.length - 1)},${yFor(item.value)}`,
    )
    .join(" ");
  const latest = history.at(-1);
  const rate = samples.at(-1)?.value ?? 0;
  const elapsedMinutes = latest
    ? Math.max(
        0,
        Math.min(
          60,
          (now - new Date(latest.janela_inicio ?? latest.horario_referencia)) /
            60000,
        ),
      )
    : 0;
  return (
    <article className="border bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase text-gray-500">
            {process.nome}
          </p>
          <h4 className="font-black text-cicopal-blue">{metric.label}</h4>
        </div>
        <b className="text-xl">
          {rate.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}{" "}
          <small>{metric.unit}</small>
        </b>
      </div>
      <svg
        viewBox="0 0 560 185"
        className="mt-2 w-full"
        role="img"
        aria-label={`Gráfico de ${metric.label}`}
      >
        {metric.ranges ? (
          <>
            <rect x="30" y="25" width="500" height={Math.max(0, yFor(metric.ranges[3]) - 25)} fill="#fee2e2" />
            <rect x="30" y={yFor(metric.ranges[3])} width="500" height={Math.max(0, yFor(metric.ranges[2]) - yFor(metric.ranges[3]))} fill="#fef3c7" />
            <rect x="30" y={yFor(metric.ranges[2])} width="500" height={Math.max(0, yFor(metric.ranges[1]) - yFor(metric.ranges[2]))} fill="#dcfce7" />
            <rect x="30" y={yFor(metric.ranges[1])} width="500" height={Math.max(0, yFor(metric.ranges[0]) - yFor(metric.ranges[1]))} fill="#fef3c7" />
            <rect x="30" y={yFor(metric.ranges[0])} width="500" height={Math.max(0, 155 - yFor(metric.ranges[0]))} fill="#fee2e2" />
          </>
        ) : null}
        <line x1="30" y1="155" x2="530" y2="155" stroke="#cbd5e1" />
        <line x1="30" y1="25" x2="30" y2="155" stroke="#cbd5e1" />
        <polyline
          points={points}
          fill="none"
          stroke="#202476"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        {samples.map((item, index) => {
          const x = 30 + (index * 500) / Math.max(1, samples.length - 1);
          const y = yFor(item.value);
          return (
            <g key={`${item.label}-${index}`}>
              <circle cx={x} cy={y} r="5" fill="#e30613" />
              <text
                x={x}
                y="178"
                textAnchor="middle"
                fontSize="10"
                fill="#64748b"
              >
                {item.label}
              </text>
              <text
                x={x}
                y={Math.max(15, y - 9)}
                textAnchor="middle"
                fontSize="10"
                fontWeight="700"
              >
                {item.value.toLocaleString("pt-BR", {
                  maximumFractionDigits: 1,
                })}
              </text>
            </g>
          );
        })}
      </svg>
      {metric.ranges ? (
        <div className="mb-2 grid grid-cols-3 gap-1 text-center text-[10px] font-black uppercase">
          <span className="bg-red-100 px-2 py-1 text-red-800">Fora do limite</span>
          <span className="bg-amber-100 px-2 py-1 text-amber-800">Atenção</span>
          <span className="bg-green-100 px-2 py-1 text-green-800">Faixa ideal</span>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2 bg-slate-950 p-3 text-white">
        <span>
          <small className="block text-slate-400">ESTIMADO DESDE ZERO</small>
          <b>
            {(rate * elapsedMinutes).toLocaleString("pt-BR", {
              maximumFractionDigits: 1,
            })}{" "}
            {metric.unit.replace("/min", "")}
          </b>
        </span>
        <span>
          <small className="block text-slate-400">MINUTOS DECORRIDOS</small>
          <b>{Math.floor(elapsedMinutes)} min</b>
        </span>
      </div>
    </article>
  );
}
function qualityControlSeries(records = []) {
  const groups = new Map();
  [...records]
    .filter((record) => record.contexto_tipo === "produto_avaliacao")
    .reverse()
    .forEach((record) => {
      (record.valores?.apontamentos ?? []).forEach((item) => {
        const value = Number(item.resultado ?? item.valor);
        if (!Number.isFinite(value)) return;
        const label = item.item ?? "Parâmetro da Qualidade";
        const normalized = label.toLocaleLowerCase("pt-BR");
        if (!/(umidade|ph|temperatura)/i.test(normalized)) return;
        if (!groups.has(label)) groups.set(label, []);
        groups.get(label).push({
          horario_referencia: record.preenchido_em,
          janela_inicio: record.preenchido_em,
          valores: { quality_value: value },
        });
      });
    });
  return [...groups.entries()].slice(0, 3).map(([label, recordHistory]) => {
    const normalized = label.toLocaleLowerCase("pt-BR");
    const ranges = normalized.includes("umidade")
      ? [1.5, 2, 4, 4.5]
      : normalized.includes("ph")
        ? [6, 6.5, 7.5, 8]
        : [25, 30, 40, 45];
    return {
      process: { id: `quality-${label}`, nome: `Qualidade · ${label}`, recordHistory },
      metric: { key: "quality_value", label, unit: normalized.includes("ph") ? "pH" : normalized.includes("umidade") ? "%" : "°C", divisor: 1, ranges },
    };
  });
}
function isOpenNc(nc) {
  return ![
    "fechada",
    "fechado",
    "resolvida",
    "resolvido",
    "concluida",
    "concluído",
  ].includes(String(nc?.status ?? "aberta").toLocaleLowerCase("pt-BR"));
}
function productAttention(records, specifications) {
  const record = records.find(
    (item) => item.contexto_tipo === "produto_avaliacao",
  );
  const values = [
    ...(record?.valores?.apontamentos ?? []),
    ...(record?.valores?.avaliacoes ?? []),
  ];
  const effectiveSpecifications = specifications?.length
    ? specifications
    : makeTestSpecifications(
        values.map((item) => ({ name: item.item, unit: item.unidade })),
      );
  return values
    .map((item) => {
      const specification = matchSpecification(
        effectiveSpecifications,
        item.item,
      );
      const classification =
        item.classificacao ??
        classifyProductValue(specification, item.resultado ?? item.valor);
      return { ...item, specification, classification };
    })
    .filter((item) => ["yellow", "red"].includes(item.classification));
}

async function loadLiveFactory() {
  if (!isSupabaseConfigured || !supabase) return [];
  const start = localDayStart();
  const lookback = new Date(new Date(start).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: cycles, error: cycleError } = await supabase
    .from("ciclos_producao")
    .select("*")
    .gte("iniciado_em", lookback)
    .order("iniciado_em", { ascending: false });
  if (cycleError) throw cycleError;
  const relevantCycles = (cycles ?? []).filter((cycle) => !cycle.encerrado_em || new Date(cycle.iniciado_em) >= new Date(start));
  const cycleIds = relevantCycles.map((item) => item.id);
  if (!cycleIds.length) return [];
  const [
    { data: fillings, error: fillingError },
    { data: ncs, error: ncError },
    { data: hygieneRounds, error: hygieneError },
    { data: subprocesses, error: subprocessError },
    { data: subprocessRecords, error: subprocessRecordError },
  ] = await Promise.all([
    supabase
      .from("preenchimentos")
      .select("id,ciclo_id,contexto_tipo,horario,valores,status,preenchido_em")
      .in("ciclo_id", cycleIds)
      .gte("preenchido_em", start)
      .order("preenchido_em", { ascending: false }),
    supabase
      .from("ciclo_nao_conformidades")
      .select("*")
      .in("ciclo_id", cycleIds)
      .gte("registrada_em", start)
      .order("registrada_em", { ascending: false }),
    supabase
      .from("higienizacao_rodadas")
      .select(
        "ciclo_id,numero,status,enviada_inspecao_em,inspecao_encerrada_em",
      )
      .in("ciclo_id", cycleIds)
      .order("numero", { ascending: false }),
    supabase
      .from("producao_subprocessos")
      .select("id,ciclo_id,codigo,nome,status,estado_iniciado_em")
      .in("ciclo_id", cycleIds)
      .order("ordem"),
    supabase
      .from("subprocesso_registros")
      .select(
        "subprocesso_id,ciclo_id,horario_referencia,janela_inicio,janela_fim,valores,preenchido_em",
      )
      .in("ciclo_id", cycleIds)
      .order("horario_referencia", { ascending: false }),
  ]);
  if (fillingError) throw fillingError;
  if (ncError) throw ncError;
  if (hygieneError && !["42P01", "PGRST205"].includes(hygieneError.code))
    throw hygieneError;
  if (subprocessError && !["42P01", "PGRST205"].includes(subprocessError.code))
    throw subprocessError;
  if (
    subprocessRecordError &&
    !["42P01", "42703", "PGRST205"].includes(subprocessRecordError.code)
  )
    throw subprocessRecordError;
  const { data: specificationRows } = await supabase
    .from("configuracoes_produto")
    .select("linha_id,produto,parametros");
  return repairTextDeep(
    relevantCycles.map((cycle) => {
      const records = (fillings ?? []).filter(
        (item) => item.ciclo_id === cycle.id,
      );
      const cycleNcs = (ncs ?? []).filter((item) => item.ciclo_id === cycle.id);
      const photos = records.flatMap((item) =>
        (item.valores?.fotografias ?? []).map((photo) => ({
          ...photo,
          filledAt: item.preenchido_em,
        })),
      );
      const specifications =
        specificationRows?.find(
          (item) =>
            item.linha_id === cycle.linha_id && item.produto === cycle.produto,
        )?.parametros ?? [];
      const hygieneRound =
        (hygieneRounds ?? []).find((item) => item.ciclo_id === cycle.id) ??
        null;
      const productionProcesses = (subprocesses ?? [])
        .filter((item) => item.ciclo_id === cycle.id)
        .map((process) => {
          const recordHistory = (subprocessRecords ?? []).filter(
            (record) => record.subprocesso_id === process.id,
          );
          return {
            ...process,
            recordHistory,
            latestRecord: recordHistory[0] ?? null,
          };
        });
      return {
        ...cycle,
        records,
        ncs: cycleNcs,
        photos,
        specifications,
        hygieneRound,
        productionProcesses,
      };
    }),
  );
}

export function FactorySupervision({ variant = "classic" }) {
  const [now, setNow] = useState(() => new Date());
  const [cycles, setCycles] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [hoveredId, setHoveredId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refreshingRef = useRef(false);
  async function refresh() {
    if (refreshingRef.current || document.visibilityState === "hidden") return;
    refreshingRef.current = true;
    setLoading(true);
    setError("");
    try {
      setCycles(await loadLiveFactory());
    } catch (problem) {
      setError(problem?.message ?? "Não foi possível consultar a fábrica.");
    } finally {
      setLoading(false);
      refreshingRef.current = false;
    }
  }
  useEffect(() => {
    refresh();
    const clock = window.setInterval(() => setNow(new Date()), 1000);
    const sync = window.setInterval(refresh, 60_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(clock);
      window.clearInterval(sync);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);
  const lines = useMemo(
    () =>
      lineLayout.map((layout) => {
        const history = cycles.filter((cycle) => cycle.linha_id === layout.id);
        const active = history.find(
          (cycle) => activeStatuses.has(cycle.status) && !cycle.encerrado_em,
        );
        const latest = active ?? history[0];
        return {
          ...layout,
          cycle: latest,
          active: Boolean(active),
          records: latest?.records ?? [],
          ncs: (latest?.ncs ?? []).filter(isOpenNc),
          photos: latest?.photos ?? [],
          attentionParameters: productAttention(
            latest?.records ?? [],
            latest?.specifications ?? [],
          ),
        };
      }),
    [cycles],
  );
  const selected = lines.find((line) => line.id === selectedId);
  const hovered = lines.find((line) => line.id === hoveredId);
  const selectedProductRecord = selected?.records.find(
    (record) => record.contexto_tipo === "produto_avaliacao",
  );
  const selectedProductValues = [
    ...(selectedProductRecord?.valores?.apontamentos ?? []),
    ...(selectedProductRecord?.valores?.avaliacoes ?? []),
  ];
  const selectedSpecifications = selected?.cycle?.specifications?.length
    ? selected.cycle.specifications
    : makeTestSpecifications(
        selectedProductValues.map((item) => ({
          name: item.item,
          unit: item.unidade ?? "",
        })),
      );
  const openNcTotal = lines.reduce((total, line) => total + line.ncs.length, 0);

  return (
    <section className="relative min-h-[calc(100vh-112px)] overflow-hidden rounded-[28px] border border-slate-300/60 bg-[radial-gradient(120%_90%_at_15%_0%,#f3f6f9_0%,#e6ebf0_42%,#d7dfe6_100%)] shadow-[0_50px_90px_-30px_rgba(15,23,42,.45)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(15,23,42,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,.05)_1px,transparent_1px)] [background-size:36px_36px]"
      />
      <div className="absolute left-2 top-3 z-20 flex items-center gap-2 rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-800 px-3 py-2 text-white shadow-xl md:left-5 md:top-5 md:gap-3 md:px-4 md:py-3">
        <span className="relative grid size-10 place-items-center rounded-xl bg-gradient-to-br from-cicopal-blue to-[#141670] text-white">
          <Radio size={19} />
          <span className="absolute -right-1 -top-1 size-3.5 rounded-full border-2 border-slate-900 bg-emerald-400" />
        </span>
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.16em] text-slate-400">
            <Signal size={11} className="text-emerald-400" /> Planta Cicopal ·
            ao vivo
          </p>
          <p className="font-black tabular-nums text-white">
            {now.toLocaleTimeString("pt-BR")}{" "}
            <span className="ml-2 text-xs text-gray-500">
              atualização automática
            </span>
          </p>
        </div>
      </div>
      {openNcTotal ? (
        <div className="absolute left-1/2 top-5 z-20 hidden -translate-x-1/2 items-center gap-2 rounded-2xl bg-gradient-to-br from-rose-600 to-rose-700 px-4 py-3 font-black text-white shadow-xl lg:flex">
          <AlertTriangle size={17} />
          {openNcTotal} NC{openNcTotal > 1 ? "s" : ""} em aberto
        </div>
      ) : null}
      <button
        type="button"
        onClick={refresh}
        className="absolute right-2 top-3 z-20 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white bg-white/90 px-3 font-bold text-gray-700 shadow-lg md:right-5 md:top-5 md:px-4"
      >
        <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
        <span className="hidden sm:inline">Atualizar</span>
      </button>
      <div className="relative min-h-[calc(100vh-112px)] overflow-x-auto p-2 pt-24 md:p-5 md:pt-24">
        <MobileFactoryCards lines={lines} onSelect={setSelectedId} />
        <div className="hidden sm:block">
          {variant === "vector" ? (
            <VectorFactoryScene
              lines={lines}
              selectedId={selectedId}
              hoveredId={hoveredId}
              onSelect={setSelectedId}
              onHover={setHoveredId}
            />
          ) : (
            <div className="relative mx-auto w-full overflow-hidden rounded-2xl shadow-2xl">
              <img
                src="/images/fabrica-isometrica-cicopal.png"
                alt="Planta da fábrica Cicopal"
                className="block h-auto w-full"
              />
              {lines.map((line) => {
                const focused = selectedId === line.id || hoveredId === line.id;
                const visual = statusVisual(line.cycle?.status);
                return (
                  <button
                    key={line.id}
                    type="button"
                    style={line.area}
                    onMouseEnter={() => setHoveredId(line.id)}
                    onMouseLeave={() => setHoveredId("")}
                    onClick={() => setSelectedId(line.id)}
                    className={`absolute rounded-[28px] border-2 transition-all duration-300 motion-safe:hover:-translate-y-1 ${focused ? `border-white bg-white/10 ${visual.glow}` : "border-transparent hover:border-white/40"} ${!line.active ? "factory-inactive-hotspot" : ""}`}
                  >
                    <span
                      className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-black shadow-lg ${line.active ? "bg-white text-cicopal-blue" : "bg-slate-700 text-white"}`}
                    >
                      <span
                        className={`size-2 rounded-full ${visual.dot} ${line.active ? "animate-pulse motion-reduce:animate-none" : ""}`}
                      />
                      {line.name} · {statusLabel(line.cycle?.status)}
                    </span>
                    {line.ncs.length ? (
                      <span className="absolute right-3 top-3 rounded-full bg-cicopal-red px-3 py-2 text-xs font-black text-white shadow-lg">
                        {line.ncs.length} NC
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {loading ? (
          <div className="absolute inset-0 z-30 grid place-items-center bg-white/55 backdrop-blur-sm">
            <span className="inline-flex items-center gap-3 rounded-2xl bg-white px-5 py-4 font-black text-cicopal-blue shadow-xl">
              <LoaderCircle className="animate-spin" />
              Consultando registros...
            </span>
          </div>
        ) : null}
        {error ? (
          <div className="absolute bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-xl bg-red-600 px-5 py-3 font-bold text-white shadow-xl">
            {error}
          </div>
        ) : null}
        {hovered ? (
          <div className="pointer-events-none absolute right-6 top-24 z-20 hidden w-80 rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-2xl backdrop-blur md:block">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-black uppercase text-cicopal-blue">
                  {rgByLine[hovered.id]}
                </p>
                <h3 className="text-xl font-black">Linha {hovered.name}</h3>
              </div>
              <StatusPill status={hovered.cycle?.status} />
            </div>
            <p className="mt-2 font-bold text-gray-600">
              {hovered.cycle?.produto ?? "Sem produção registrada hoje"}
            </p>
            {hovered.cycle?.hygieneRound ? (
              <div className="mt-3 border-l-4 border-cicopal-blue bg-blue-50 p-3 text-sm font-black text-cicopal-blue">
                Higienização · rodada {hovered.cycle.hygieneRound.numero} ·{" "}
                {hovered.cycle.hygieneRound.status.replaceAll("_", " ")}
              </div>
            ) : null}
            {hovered.cycle?.productionProcesses?.length ? (
              <div className="mt-3 grid grid-cols-2 gap-1">
                {hovered.cycle.productionProcesses.map((process) => (
                  <span
                    key={process.nome}
                    className={`px-2 py-2 text-[10px] font-black uppercase ${process.status === "operando" ? "bg-green-100 text-green-800" : ["parado", "pausado"].includes(process.status) ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-600"}`}
                  >
                    <b className="block">
                      {process.nome} · {process.status.replaceAll("_", " ")}
                    </b>
                    <small className="mt-1 block normal-case">
                      {processLiveValue(process)}
                    </small>
                  </span>
                ))}
              </div>
            ) : null}
            {hovered.attentionParameters.length ? (
              <div className="mt-3 border-l-4 border-amber-400 bg-amber-50 p-3 font-black text-amber-900">
                {hovered.attentionParameters.length} parâmetro(s) em atenção
              </div>
            ) : null}
            {hovered.ncs.length ? (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 p-3 font-black text-cicopal-red">
                <AlertTriangle />
                {hovered.ncs.length} NC do dia
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-green-50 p-3 font-black text-cicopal-green">
                <CheckCircle2 />
                Sem NC no ciclo
              </div>
            )}
            <p className="mt-3 flex items-center gap-1 text-xs font-bold text-cicopal-blue">
              <Sparkle size={13} /> Clique para ver registros e fotos
            </p>
          </div>
        ) : null}
        {selected ? (
          <aside className="fixed inset-x-2 bottom-2 z-30 max-h-[88dvh] overflow-y-auto rounded-3xl border border-gray-200 bg-white/95 shadow-2xl backdrop-blur sm:absolute sm:inset-x-auto sm:bottom-5 sm:left-5 sm:max-h-[82%] sm:w-[min(620px,calc(100%-2.5rem))]">
            <header className="sticky top-0 z-10 flex items-start justify-between border-b border-gray-200 bg-white/95 p-5">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-cicopal-blue">
                  {rgByLine[selected.id]} · Linha {selected.name} ·{" "}
                  {statusLabel(selected.cycle?.status)}
                </p>
                <h2 className="mt-1 text-2xl font-black">
                  {selected.cycle?.produto ?? "Sem produção hoje"}
                </h2>
                <p className="mt-1 text-sm font-semibold text-gray-500">
                  {selected.cycle?.metadata?.productionCode ??
                    "Nenhum ciclo encontrado"}
                </p>
              </div>
              <button
                type="button"
                aria-label="Fechar detalhes da linha"
                className="grid size-11 place-items-center rounded-full bg-gray-100"
                onClick={() => setSelectedId("")}
              >
                <X size={20} />
              </button>
            </header>
            <div className="space-y-5 p-5">
              <div className="grid grid-cols-3 gap-3">
                <Metric
                  label="Último registro"
                  value={time(selected.records[0]?.preenchido_em)}
                />
                <Metric
                  label="Registros hoje"
                  value={selected.records.length}
                />
                <Metric
                  label="NCs hoje"
                  value={selected.ncs.length}
                  alert={selected.ncs.length > 0}
                />
              </div>
              {selected.cycle?.productionProcesses?.some(
                (process) => controlMetric[process.codigo],
              ) ? (
                <section>
                  <Title
                    icon={<Gauge size={17} />}
                    text="Gráficos de controle da produção"
                  />
                  <p className="mt-1 text-xs font-bold text-gray-500">
                    Cada série começa em zero e evolui conforme os apontamentos
                    confirmados.
                  </p>
                  <div className="mt-3 space-y-3">
                    {selected.cycle.productionProcesses.map((process) => (
                      <ControlChart
                        key={process.id}
                        process={process}
                        now={now}
                      />
                    ))}
                  </div>
                </section>
              ) : null}
              {qualityControlSeries(selected.records).length ? (
                <section>
                  <Title
                    icon={<Gauge size={17} />}
                    text="Gráficos de controle da Qualidade"
                  />
                  <p className="mt-1 text-xs font-bold text-gray-500">
                    Faixas provisórias para visualização. Os limites definitivos poderão ser configurados por produto.
                  </p>
                  <div className="mt-3 space-y-3">
                    {qualityControlSeries(selected.records).map(({ process, metric }) => (
                      <ControlChart
                        key={process.id}
                        process={process}
                        metricOverride={metric}
                        now={now}
                      />
                    ))}
                  </div>
                </section>
              ) : null}
              {selected.photos[0] ? (
                <section>
                  <Title
                    icon={<Camera size={17} />}
                    text="Último registro fotográfico"
                  />
                  <figure className="mt-2 overflow-hidden rounded-2xl border border-gray-200 bg-gray-100">
                    <img
                      src={selected.photos[0].imagem}
                      alt="Último registro fotográfico"
                      className="max-h-80 w-full object-contain"
                    />
                    <figcaption className="p-3 text-sm font-bold text-gray-700">
                      {selected.photos[0].horario}{" "}
                      {selected.photos[0].observacao
                        ? `· ${selected.photos[0].observacao}`
                        : ""}
                    </figcaption>
                  </figure>
                </section>
              ) : null}
              {selected.attentionParameters.length ? (
                <section>
                  <Title
                    icon={<Gauge size={17} />}
                    text="Parâmetros abaixo ou fora da faixa"
                  />
                  <p className="mt-1 text-xs font-bold text-gray-500">
                    Registro das {time(selectedProductRecord?.preenchido_em)}
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {selected.attentionParameters.map((item, index) => {
                      const specification = matchSpecification(
                        selectedSpecifications,
                        item.item,
                      );
                      const classification =
                        item.classificacao ??
                        classifyProductValue(
                          specification,
                          item.resultado ?? item.valor,
                        );
                      const tone = specificationTone[classification];
                      return (
                        <article
                          key={`${item.item}-${index}`}
                          className={`border-l-4 p-3 ${tone.className}`}
                        >
                          <p className="text-xs font-black uppercase opacity-70">
                            {tone.label}
                          </p>
                          <strong className="mt-1 block text-gray-950">
                            {item.item}
                          </strong>
                          <span className="text-lg font-black">
                            {item.resultado ?? item.valor ?? "—"}{" "}
                            {item.unidade ?? specification?.unit ?? ""}
                          </span>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ) : null}
              <section>
                <Title
                  icon={<Clock3 size={17} />}
                  text="Últimos preenchimentos"
                />
                <div className="mt-2 space-y-2">
                  {selected.records.slice(0, 8).map((record) => (
                    <article
                      key={record.id}
                      className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 p-3"
                    >
                      <div>
                        <p className="font-black text-gray-900">
                          {processLabels[record.contexto_tipo] ??
                            record.contexto_tipo}
                        </p>
                        <p className="text-xs font-semibold text-gray-500">
                          {time(record.preenchido_em)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${record.status === "com_nc" ? "bg-red-100 text-cicopal-red" : "bg-green-100 text-cicopal-green"}`}
                      >
                        {record.status === "com_nc" ? "NC" : "Conforme"}
                      </span>
                    </article>
                  ))}
                  {!selected.records.length ? (
                    <p className="rounded-xl bg-gray-50 p-4 font-semibold text-gray-500">
                      Nenhum preenchimento registrado hoje.
                    </p>
                  ) : null}
                </div>
              </section>
              {selected.ncs.length ? (
                <section>
                  <Title
                    icon={<AlertTriangle size={17} />}
                    text="Não conformidades do dia"
                  />
                  <div className="mt-2 space-y-2">
                    {selected.ncs.map((nc) => (
                      <article
                        key={nc.id}
                        className="rounded-xl border border-red-100 bg-red-50 p-4"
                      >
                        <div className="flex justify-between gap-3">
                          <strong className="text-cicopal-red">
                            {nc.descricao}
                          </strong>
                          <span className="text-xs font-black uppercase text-red-700">
                            {nc.status}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-semibold text-red-900">
                          Causa: {nc.causa}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-red-900">
                          Ação: {nc.acao_tomada}
                        </p>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
}

function MobileFactoryCards({ lines, onSelect }) {
  return (
    <div className="space-y-3 sm:hidden">
      <div className="mb-4 px-1">
        <p className="text-xs font-black uppercase tracking-wider text-slate-500">
          Resumo das linhas
        </p>
        <p className="text-sm font-semibold text-slate-600">
          Toque em uma linha para abrir os detalhes.
        </p>
      </div>
      {lines.map((line) => {
        const visual = statusVisual(line.cycle?.status);
        return (
          <button
            key={line.id}
            type="button"
            onClick={() => onSelect(line.id)}
            className={`w-full overflow-hidden rounded-2xl border bg-white text-left shadow-lg ${line.ncs.length ? "border-rose-200" : "border-slate-200"}`}
          >
            <div className={`h-1.5 w-full ${visual.badge}`} />
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase text-cicopal-blue">
                    {rgByLine[line.id]}
                  </p>
                  <h3 className="text-xl font-black text-slate-950">
                    {line.name}
                  </h3>
                </div>
                <StatusPill status={line.cycle?.status} />
              </div>
              <p className="mt-2 font-bold text-slate-600">
                {line.cycle?.produto ?? "Sem produção registrada hoje"}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-50 p-2">
                  <small className="block font-bold text-slate-400">
                    Último
                  </small>
                  <b>{time(line.records[0]?.preenchido_em)}</b>
                </div>
                <div className="bg-amber-50 p-2 text-amber-900">
                  <small className="block font-bold opacity-60">Atenção</small>
                  <b>{line.attentionParameters.length}</b>
                </div>
                <div
                  className={`p-2 ${line.ncs.length ? "bg-rose-50 text-cicopal-red" : "bg-emerald-50 text-cicopal-green"}`}
                >
                  <small className="block font-bold opacity-60">
                    NC aberta
                  </small>
                  <b>{line.ncs.length}</b>
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function StatusPill({ status }) {
  const visual = statusVisual(status);
  const Icon = visual.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black shadow-sm ${visual.badge}`}
    >
      <Icon size={12} />
      {visual.label}
    </span>
  );
}

function Metric({ label, value, alert }) {
  return (
    <div
      className={`rounded-2xl border p-3 text-center shadow-sm ${alert ? "border-rose-100 bg-rose-50" : "border-slate-100 bg-slate-50"}`}
    >
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p
        className={`mt-1 text-xl font-black tabular-nums ${alert ? "text-cicopal-red" : "text-slate-950"}`}
      >
        {value}
      </p>
    </div>
  );
}
function Title({ icon, text }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-600">
      <span className="grid size-7 place-items-center rounded-lg bg-slate-100 text-slate-500">
        {icon}
      </span>
      {text}
    </h3>
  );
}

function FactorySceneMetric({ label, value, tone = "slate" }) {
  const color = tone === "green" ? "text-emerald-300" : tone === "cyan" ? "text-cyan-300" : "text-white";
  return (
    <span className="min-w-24 border-r border-white/10 px-4 py-3 text-center last:border-r-0">
      <small className="block text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</small>
      <b className={`mt-0.5 block text-xl tabular-nums ${color}`}>{value}</b>
    </span>
  );
}

const fallbackStages = {
  PUR: ["Preparação", "Fritura", "Tempero", "Empacotamento"],
  SAL: ["Extrusão", "Forno", "Aplicação", "Empacotamento"],
  ROS: ["Masseira", "Formação", "Forno", "Empacotamento"],
};

function humanizeProductionKey(value) {
  return String(value ?? "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toLocaleUpperCase("pt-BR"));
}

function formatProductionValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "number") return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  if (typeof value === "object") {
    if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`;
    return Object.entries(value)
      .map(([key, item]) => `${humanizeProductionKey(key)}: ${formatProductionValue(item)}`)
      .join(" · ");
  }
  return String(value);
}

function productionTelemetry(line) {
  const telemetry = [
    { label: "Produto", value: line.cycle?.produto ?? "Sem produção" },
    { label: "Status", value: statusLabel(line.cycle?.status) },
    { label: "Registros hoje", value: line.records.length },
    { label: "NCs abertas", value: line.ncs.length },
    { label: "Qualidade em atenção", value: line.attentionParameters.length },
  ];
  if (line.cycle?.metadata?.productionCode)
    telemetry.push({ label: "Código de produção", value: line.cycle.metadata.productionCode });
  if (line.cycle?.hygieneRound)
    telemetry.push({
      label: `Higienização R${line.cycle.hygieneRound.numero}`,
      value: humanizeProductionKey(line.cycle.hygieneRound.status),
    });
  (line.cycle?.productionProcesses ?? []).forEach((process) => {
    telemetry.push({ label: process.nome, value: humanizeProductionKey(process.status) });
    Object.entries(process.latestRecord?.valores ?? {}).forEach(([key, value]) => {
      telemetry.push({
        label: `${process.nome} · ${humanizeProductionKey(key)}`,
        value: formatProductionValue(value),
      });
    });
  });
  const seenRecordMetrics = new Set();
  line.records.forEach((record) => {
    Object.entries(record.valores ?? {}).forEach(([key, value]) => {
      const identity = `${record.contexto_tipo}:${key}`;
      if (seenRecordMetrics.has(identity)) return;
      seenRecordMetrics.add(identity);
      telemetry.push({
        label: `${humanizeProductionKey(record.contexto_tipo)} · ${humanizeProductionKey(key)}`,
        value: formatProductionValue(value),
      });
    });
  });
  const productRecord = line.records.find((record) => record.contexto_tipo === "produto_avaliacao");
  [...(productRecord?.valores?.apontamentos ?? []), ...(productRecord?.valores?.avaliacoes ?? [])].forEach((item) => {
    telemetry.push({
      label: `Qualidade · ${item.item ?? "Parâmetro"}`,
      value: `${formatProductionValue(item.resultado ?? item.valor)}${item.unidade ? ` ${item.unidade}` : ""}`,
    });
  });
  return telemetry;
}

function ProfessionalProductionLine({ line, index, focused, onSelect, onHover }) {
  const visual = statusVisual(line.cycle?.status);
  const processes = line.cycle?.productionProcesses?.length
    ? line.cycle.productionProcesses
    : fallbackStages[line.id].map((name, stageIndex) => ({ id: `${line.id}-${stageIndex}`, nome: name, status: "nao_iniciado" }));
  const stages = processes.slice(0, 5);
  const telemetry = productionTelemetry(line);
  const isRunning = ["produzindo", "producing"].includes(line.cycle?.status);
  const isBlocked = ["bloqueado", "blocked"].includes(line.cycle?.status);
  return (
    <button
      type="button"
      onMouseEnter={() => onHover(line.id)}
      onMouseLeave={() => onHover("")}
      onFocus={() => onHover(line.id)}
      onBlur={() => onHover("")}
      onClick={() => onSelect(line.id)}
      className={`professional-line group relative grid min-h-0 grid-cols-[190px_1fr] overflow-hidden rounded-2xl border text-left text-white transition duration-300 ${focused ? "-translate-y-1 border-cyan-300/80 shadow-[0_20px_48px_rgba(6,182,212,.22)]" : "border-white/10 shadow-[0_16px_36px_rgba(2,6,23,.34)]"} ${isBlocked ? "professional-line--blocked" : ""}`}
      style={{ "--line-delay": `${index * -1.15}s` }}
      aria-label={`Linha ${line.name}, ${statusLabel(line.cycle?.status)}. Abrir detalhes.`}
    >
      <span className="relative z-10 flex flex-col justify-between border-r border-white/10 bg-slate-950/90 p-4 backdrop-blur-xl">
        <span>
          <span className="flex items-center justify-between gap-2">
            <small className="font-black uppercase tracking-[.18em] text-cyan-300">{rgByLine[line.id]}</small>
            <i className={`size-2.5 rounded-full ${visual.dot} ${line.active ? "animate-pulse motion-reduce:animate-none" : ""}`} />
          </span>
          <strong className="mt-1 block text-xl">{line.name}</strong>
          <span className="mt-1 block truncate text-xs font-bold text-slate-400">{line.cycle?.produto ?? "Sem produção programada"}</span>
        </span>
        <span className="flex items-end justify-between gap-2">
          <span className="rounded-lg bg-white/5 px-2 py-1 text-[10px] font-black uppercase text-slate-300">{statusLabel(line.cycle?.status)}</span>
          {line.ncs.length ? <b className="rounded-lg bg-rose-500 px-2 py-1 text-[10px]">{line.ncs.length} NC</b> : null}
        </span>
      </span>
      <span className="relative min-w-0 bg-slate-900/[.78] backdrop-blur-md">
        <span className="absolute inset-x-0 top-0 flex h-[calc(100%-42px)] items-center px-5">
          <svg viewBox="0 0 820 122" className="h-full w-full overflow-visible" aria-hidden="true">
            <defs>
              <linearGradient id={`steel-${line.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#f8fafc" />
                <stop offset=".48" stopColor="#94a3b8" />
                <stop offset="1" stopColor="#334155" />
              </linearGradient>
            </defs>
            <path d="M35 82H785" stroke="#0f172a" strokeWidth="18" />
            <path className={isRunning ? "professional-belt" : ""} d="M35 76H785" stroke="#64748b" strokeWidth="9" strokeDasharray="13 10" />
            <g className={isRunning ? "professional-product-flow" : ""} fill="#f7b928">
              {[70, 205, 340, 475, 610].map((x) => <rect key={x} x={x} y="67" width="18" height="13" rx="4" />)}
            </g>
            {stages.map((process, stageIndex) => {
              const x = 55 + stageIndex * (690 / Math.max(1, stages.length - 1));
              const processRunning = process.status === "operando";
              const processStopped = ["parado", "pausado", "bloqueado"].includes(process.status);
              return (
                <g key={process.id ?? process.nome} transform={`translate(${x} 0)`}>
                  <ellipse cx="0" cy="101" rx="52" ry="9" fill="#020617" opacity=".45" />
                  <path d="M-43 32h75l15 13v39h-90z" fill={`url(#steel-${line.id})`} stroke="#cbd5e1" strokeWidth="2" />
                  <path d="m-43 32 17-12h74L32 32z" fill="#e2e8f0" stroke="#f8fafc" strokeWidth="2" />
                  <rect x="-29" y="43" width="39" height="25" rx="4" fill="#15233a" stroke="#38bdf8" strokeOpacity=".5" />
                  <circle className={processRunning ? "professional-machine-gear" : ""} cx="25" cy="55" r="11" fill="#334155" stroke="#e2e8f0" strokeWidth="3" strokeDasharray="4 3" />
                  <circle cx="36" cy="31" r="5" fill={processStopped ? "#f43f5e" : processRunning ? "#34d399" : "#94a3b8"} className={processStopped || processRunning ? "professional-signal" : ""} />
                  {processRunning ? <path className="professional-steam" d="M-17 18c-13-10 10-13-2-26M7 18C-6 8 17 5 5-8" fill="none" stroke="#bae6fd" strokeWidth="3" strokeLinecap="round" /> : null}
                  <text x="0" y="116" textAnchor="middle" fill="#e2e8f0" fontSize="10" fontWeight="800">{process.nome.length > 18 ? `${process.nome.slice(0, 16)}…` : process.nome}</text>
                </g>
              );
            })}
          </svg>
        </span>
        <span className="professional-telemetry absolute inset-x-0 bottom-0 h-[42px] overflow-hidden border-t border-white/10 bg-slate-950/[.88]">
          <span className="professional-telemetry-track">
            {[...telemetry, ...telemetry].map((metric, metricIndex) => (
              <span data-copy={metricIndex >= telemetry.length ? "true" : undefined} key={`${metric.label}-${metricIndex}`} className="inline-flex h-[42px] shrink-0 items-center gap-2 border-r border-white/10 px-4 text-[10px]">
                <b className="uppercase tracking-wider text-slate-500">{metric.label}</b>
                <strong className="max-w-48 truncate text-slate-100">{metric.value}</strong>
              </span>
            ))}
          </span>
        </span>
      </span>
    </button>
  );
}

function VectorFactoryScene({ lines, selectedId, hoveredId, onSelect, onHover }) {
  const activeLines = lines.filter((line) => line.active).length;
  const processTotal = lines.reduce((total, line) => total + (line.cycle?.productionProcesses?.length ?? 0), 0);
  const operatingTotal = lines.reduce((total, line) => total + (line.cycle?.productionProcesses ?? []).filter((process) => process.status === "operando").length, 0);
  return (
    <div className="professional-factory relative mx-auto min-h-[760px] w-full overflow-hidden rounded-[26px] border border-slate-700/70 shadow-2xl lg:min-h-[850px]">
      <svg className="absolute inset-0 size-full" viewBox="0 0 1200 820" preserveAspectRatio="none" role="img" aria-labelledby="professional-factory-title professional-factory-description">
        <title id="professional-factory-title">Planta industrial Cicopal em tempo real</title>
        <desc id="professional-factory-description">Visão operacional das linhas Pururuca, Salgadinho e Rosca, com fluxo, máquinas, estados, alertas e variáveis de produção.</desc>
        <defs>
          <linearGradient id="pro-floor" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#17233a" /><stop offset="1" stopColor="#07101f" /></linearGradient>
          <linearGradient id="pro-wall" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#dbe7f4" /><stop offset="1" stopColor="#708098" /></linearGradient>
          <pattern id="pro-grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0v48" fill="none" stroke="#5d7391" strokeOpacity=".14" /></pattern>
        </defs>
        <rect width="1200" height="820" fill="#07101f" />
        <path d="M0 0h1200v165L0 310z" fill="url(#pro-wall)" opacity=".34" />
        <path d="M0 310 1200 165v655H0z" fill="url(#pro-floor)" />
        <path d="M0 310 1200 165v655H0z" fill="url(#pro-grid)" />
        <g opacity=".56"><path d="M0 98 1200 12" stroke="#e2e8f0" strokeWidth="8" /><path d="M0 124 1200 38" stroke="#2563eb" strokeWidth="5" /><path d="M0 151 1200 65" stroke="#dc2626" strokeWidth="5" />{[120, 340, 560, 780, 1000].map((x) => <path key={x} d={`M${x} 0v178`} stroke="#9aa9bc" strokeWidth="7" />)}</g>
        <g fill="none" stroke="#f7b928" strokeWidth="3" opacity=".45" strokeDasharray="16 12"><path d="m35 374 1080-133 50 104L90 478z" /><path d="m35 536 1080-105 50 104L90 640z" /><path d="m35 694 1080-72 50 104L90 798z" /></g>
      </svg>
      <div className="absolute inset-x-5 top-5 z-10 flex items-start justify-between gap-4">
        <div className="rounded-2xl border border-white/10 bg-slate-950/[.85] px-5 py-4 text-white shadow-2xl backdrop-blur-xl"><p className="text-[10px] font-black uppercase tracking-[.22em] text-cyan-300">Digital twin · operação em tempo real</p><strong className="mt-1 block text-xl">Chão de fábrica Cicopal</strong></div>
        <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/[.85] text-white shadow-2xl backdrop-blur-xl"><FactorySceneMetric label="Linhas ativas" value={`${activeLines}/3`} tone="cyan" /><FactorySceneMetric label="Processos" value={processTotal} /><FactorySceneMetric label="Operando" value={operatingTotal} tone="green" /></div>
      </div>
      <div className="absolute inset-x-[3%] bottom-[3%] top-[15%] grid grid-rows-3 gap-3">
        {lines.map((line, index) => <ProfessionalProductionLine key={line.id} line={line} index={index} focused={selectedId === line.id || hoveredId === line.id} onSelect={onSelect} onHover={onHover} />)}
      </div>
    </div>
  );
}

function LegacyVectorFactoryScene({
  lines,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
}) {
  const positions = {
    PUR: { left: "5%", top: "17%", width: "43%", height: "27%" },
    SAL: { left: "52%", top: "37%", width: "43%", height: "27%" },
    ROS: { left: "8%", top: "66%", width: "46%", height: "27%" },
  };
  return (
    <div className="vector-factory-scene vector-factory-scene--bright relative mx-auto min-h-[650px] w-full overflow-hidden border border-slate-200 shadow-2xl lg:min-h-[760px]">
      <svg
        className="absolute inset-0 size-full"
        viewBox="0 0 1200 720"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="factory-floor" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#163f4b" />
            <stop offset="1" stopColor="#0a2733" />
          </linearGradient>
          <pattern
            id="floor-grid"
            width="55"
            height="55"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M55 0H0v55"
              fill="none"
              stroke="#82aab3"
              strokeOpacity=".2"
              strokeWidth="2"
            />
          </pattern>
        </defs>
        <path d="M0 0h1200v720H0z" fill="#18869a" />
        <path d="M0 112 240 0h960v128L0 362z" fill="#f4d39a" />
        <path
          d="M0 112v250l1200-234V0H240z"
          fill="none"
          stroke="#e9f0e9"
          strokeWidth="16"
        />
        {[180, 390, 600, 810, 1020].map((x) => (
          <path
            key={x}
            d={`M${x} 30v250`}
            stroke="#e9f0e9"
            strokeWidth="10"
            opacity=".85"
          />
        ))}
        <path d="M0 362 1200 128v592H0z" fill="url(#factory-floor)" />
        <path d="M0 362 1200 128v592H0z" fill="url(#floor-grid)" />
        <path
          d="m90 590 820-164 220 90-820 164z"
          fill="none"
          stroke="#f2b721"
          strokeWidth="9"
          strokeDasharray="22 14"
          opacity=".75"
        />
        <path
          d="M870 720v-98h330v98"
          fill="#dfe7e8"
          stroke="#46636c"
          strokeWidth="10"
        />
        <path d="M900 690h260" stroke="#e45b66" strokeWidth="28" />
        <rect
          x="925"
          y="625"
          width="76"
          height="44"
          fill="#244e64"
          stroke="#132f3c"
          strokeWidth="5"
        />
        <rect
          x="1020"
          y="625"
          width="76"
          height="44"
          fill="#244e64"
          stroke="#132f3c"
          strokeWidth="5"
        />
      </svg>
      <div className="absolute left-6 top-5 border-l-4 border-cicopal-red bg-white/90 px-4 py-3 shadow-lg">
        <p className="text-xs font-black uppercase tracking-[.18em] text-cicopal-blue">
          Planta vetorial
        </p>
        <strong className="text-xl text-gray-950">
          Área de produção Cicopal
        </strong>
      </div>
      {lines.map((line) => {
        const focused = selectedId === line.id || hoveredId === line.id;
        return (
          <button
            key={line.id}
            type="button"
            style={positions[line.id]}
            onMouseEnter={() => onHover(line.id)}
            onMouseLeave={() => onHover("")}
            onClick={() => onSelect(line.id)}
            className={`vector-line-station absolute border bg-white/90 transition duration-300 ${focused ? "-translate-y-1 border-cicopal-blue shadow-[0_22px_45px_rgba(15,23,42,.28)]" : "border-white/80 shadow-[0_14px_30px_rgba(15,23,42,.18)]"}`}
          >
            <AnimatedLineActivity
              status={line.cycle?.status}
              active={line.active}
              lineName={line.name}
            />
            <span
              className={`absolute left-3 top-3 px-3 py-2 text-xs font-black shadow-lg ${line.active ? "bg-white text-cicopal-blue" : "bg-gray-700 text-white"}`}
            >
              {line.name} · {statusLabel(line.cycle?.status)}
            </span>
            {line.ncs.length ? (
              <span className="absolute right-3 top-3 bg-cicopal-red px-3 py-2 text-xs font-black text-white shadow-lg">
                {line.ncs.length} NC
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function AnimatedLineActivity({ status, active, lineName }) {
  const mode = !active
    ? "inactive"
    : ["higienizacao", "hygiene"].includes(status)
      ? "cleaning"
      : [
            "aguardando_liberacao",
            "awaiting_release",
            "pronto",
            "ready",
          ].includes(status)
        ? "inspection"
        : ["produzindo", "producing"].includes(status)
          ? "production"
          : ["bloqueado", "blocked"].includes(status)
            ? "blocked"
            : "inactive";
  const labels = {
    cleaning: "Máquinas em higienização",
    inspection: "Equipe realizando liberação",
    production: "Linha em produção",
    blocked: "Linha bloqueada",
    inactive: "Linha inativa",
  };
  return (
    <span
      aria-label={`${lineName}: ${labels[mode]}`}
      className={`factory-motion factory-motion--${mode}`}
    >
      <svg viewBox="0 0 360 130" role="img" aria-hidden="true">
        <g className="factory-machine">
          <path className="factory-conveyor-frame" d="M62 88H300v15H62z" />
          <path className="factory-belt" d="M67 80H295v13H67z" />
          {[82, 118, 154, 190, 226, 262].map((x) => (
            <circle key={x} className="factory-roller" cx={x} cy="99" r="7" />
          ))}
          <path className="factory-machine-body" d="M128 34h104v48H128z" />
          <path className="factory-machine-top" d="m128 34 18-14h104l-18 14z" />
          <rect
            className="factory-window"
            x="148"
            y="47"
            width="62"
            height="22"
          />
          <circle className="factory-gear" cx="222" cy="58" r="13" />
          <path
            className="factory-gear-mark"
            d="M222 48v20M212 58h20M215 51l14 14M229 51l-14 14"
          />
          <rect
            className="factory-status-light"
            x="236"
            y="42"
            width="8"
            height="19"
          />
        </g>

        <g className="factory-products">
          <rect x="78" y="69" width="22" height="16" rx="2" />
          <rect x="113" y="69" width="22" height="16" rx="2" />
          <rect x="252" y="69" width="22" height="16" rx="2" />
        </g>

        <g className="factory-worker factory-worker--left">
          <circle cx="82" cy="38" r="9" />
          <path d="M73 49h18l5 32H68z" />
          <path className="factory-worker-arm" d="m89 54 24 13" />
          <path d="m74 78-7 25M89 78l7 25" />
        </g>
        <g className="factory-worker factory-worker--right">
          <circle cx="278" cy="38" r="9" />
          <path d="M269 49h18l5 32h-28z" />
          <path className="factory-worker-arm" d="m271 54-24 13" />
          <path d="m270 78-7 25M285 78l7 25" />
        </g>

        <g className="factory-water">
          <path className="factory-hose" d="M91 59c31-16 44-16 65-7" />
          <path
            className="factory-spray"
            d="m151 48 18-10M154 54l23-2M151 60l18 9"
          />
          <circle cx="177" cy="38" r="3" />
          <circle cx="184" cy="52" r="3" />
          <circle cx="177" cy="69" r="3" />
        </g>

        <g className="factory-steam">
          <path d="M160 27c-12-12 10-15-1-27" />
          <path d="M185 25c-12-12 10-15-1-27" />
          <path d="M210 27c-12-12 10-15-1-27" />
        </g>
        <g className="factory-lock">
          <rect x="166" y="43" width="30" height="28" rx="3" />
          <path d="M173 43v-7a8 8 0 0 1 16 0v7" />
        </g>
      </svg>
      <span className="factory-motion-label">{labels[mode]}</span>
    </span>
  );
}
