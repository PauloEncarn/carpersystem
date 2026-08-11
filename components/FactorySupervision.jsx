"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock3,
  Gauge,
  LoaderCircle,
  Radio,
  RefreshCw,
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
  return ["produzindo", "producing"].includes(status)
    ? "Produzindo"
    : ["bloqueado", "blocked"].includes(status)
      ? "Bloqueada"
      : ["encerrado", "ended"].includes(status)
        ? "Encerrada"
        : status
          ? "Preparação"
          : "Inativa";
}

async function loadLiveFactory() {
  if (!isSupabaseConfigured || !supabase) return [];
  const start = localDayStart();
  const { data: cycles, error: cycleError } = await supabase
    .from("ciclos_producao")
    .select("*")
    .gte("iniciado_em", start)
    .order("iniciado_em", { ascending: false });
  if (cycleError) throw cycleError;
  const cycleIds = (cycles ?? []).map((item) => item.id);
  if (!cycleIds.length) return [];
  const [
    { data: fillings, error: fillingError },
    { data: ncs, error: ncError },
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
  ]);
  if (fillingError) throw fillingError;
  if (ncError) throw ncError;
  const { data: specificationRows } = await supabase
    .from("configuracoes_produto")
    .select("linha_id,produto,parametros");
  return repairTextDeep(
    (cycles ?? []).map((cycle) => {
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
      return { ...cycle, records, ncs: cycleNcs, photos, specifications };
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
  async function refresh() {
    setLoading(true);
    setError("");
    try {
      setCycles(await loadLiveFactory());
    } catch (problem) {
      setError(problem?.message ?? "Não foi possível consultar a fábrica.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
    const clock = window.setInterval(() => setNow(new Date()), 1000);
    const sync = window.setInterval(refresh, 30_000);
    return () => {
      window.clearInterval(clock);
      window.clearInterval(sync);
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
          ncs: latest?.ncs ?? [],
          photos: latest?.photos ?? [],
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

  return (
    <section className="relative min-h-[calc(100vh-112px)] overflow-hidden rounded-[28px] border border-gray-200 bg-[#e8edf1] shadow-xl">
      <div className="absolute left-5 top-5 z-20 flex items-center gap-3 rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-lg backdrop-blur">
        <span className="grid size-10 place-items-center rounded-xl bg-cicopal-blue text-white">
          <Radio size={20} />
        </span>
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-gray-400">
            Planta Cicopal · dados do dia
          </p>
          <p className="font-black tabular-nums text-gray-950">
            {now.toLocaleTimeString("pt-BR")}{" "}
            <span className="ml-2 text-xs text-gray-500">
              atualização automática
            </span>
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={refresh}
        className="absolute right-5 top-5 z-20 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white bg-white/90 px-4 font-bold text-gray-700 shadow-lg"
      >
        <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
        Atualizar
      </button>
      <div className="relative min-h-[calc(100vh-112px)] overflow-x-auto p-2 pt-24 md:p-5 md:pt-24">
        {variant === "vector" ? (
          <VectorFactoryScene
            lines={lines}
            selectedId={selectedId}
            hoveredId={hoveredId}
            onSelect={setSelectedId}
            onHover={setHoveredId}
          />
        ) : (
        <div className="relative mx-auto min-w-[820px] overflow-hidden rounded-2xl shadow-2xl">
          <img
            src="/images/fabrica-isometrica-cicopal.png"
            alt="Planta da fábrica Cicopal"
            className="block h-auto w-full"
          />
          {lines.map((line) => {
            const focused = selectedId === line.id || hoveredId === line.id;
            return (
              <button
                key={line.id}
                type="button"
                style={line.area}
                onMouseEnter={() => setHoveredId(line.id)}
                onMouseLeave={() => setHoveredId("")}
                onClick={() => setSelectedId(line.id)}
                className={`absolute rounded-[28px] border-2 transition ${focused ? "border-white bg-white/10 shadow-[0_0_0_5px_rgba(30,34,168,.45)]" : "border-transparent"} ${!line.active ? "factory-inactive-hotspot" : ""}`}
              >
                <span
                  className={`absolute left-3 top-3 rounded-full px-3 py-2 text-xs font-black shadow-lg ${line.active ? "bg-white text-cicopal-blue" : "bg-gray-700 text-white"}`}
                >
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
              <span
                className={`rounded-full px-3 py-1 text-xs font-black ${hovered.active ? "bg-green-100 text-cicopal-green" : "bg-gray-100 text-gray-600"}`}
              >
                {statusLabel(hovered.cycle?.status)}
              </span>
            </div>
            <p className="mt-2 font-bold text-gray-600">
              {hovered.cycle?.produto ?? "Sem produção registrada hoje"}
            </p>
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
            <p className="mt-3 text-xs font-bold text-cicopal-blue">
              Clique para ver registros e fotos
            </p>
          </div>
        ) : null}
        {selected ? (
          <aside className="absolute bottom-5 left-5 z-30 max-h-[82%] w-[min(620px,calc(100%-2.5rem))] overflow-y-auto rounded-3xl border border-gray-200 bg-white/95 shadow-2xl backdrop-blur">
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
              {selectedProductValues.length ? (
                <section>
                  <Title
                    icon={<Gauge size={17} />}
                    text="Últimos parâmetros do produto"
                  />
                  <p className="mt-1 text-xs font-bold text-gray-500">
                    Registro das {time(selectedProductRecord?.preenchido_em)}
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {selectedProductValues.map((item, index) => {
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

function Metric({ label, value, alert }) {
  return (
    <div
      className={`rounded-2xl p-3 text-center ${alert ? "bg-red-50" : "bg-gray-50"}`}
    >
      <p className="text-[10px] font-black uppercase text-gray-400">{label}</p>
      <p
        className={`mt-1 text-xl font-black ${alert ? "text-cicopal-red" : "text-gray-950"}`}
      >
        {value}
      </p>
    </div>
  );
}
function Title({ icon, text }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-gray-600">
      {icon}
      {text}
    </h3>
  );
}

function VectorFactoryScene({ lines, selectedId, hoveredId, onSelect, onHover }) {
  const positions = {
    PUR: { left: "8%", top: "15%", width: "42%", height: "27%" },
    SAL: { left: "50%", top: "34%", width: "42%", height: "27%" },
    ROS: { left: "12%", top: "59%", width: "46%", height: "27%" },
  };
  return (
    <div className="vector-factory-scene relative mx-auto min-h-[690px] min-w-[920px] overflow-hidden border border-[#54717c] shadow-2xl">
      <svg className="absolute inset-0 size-full" viewBox="0 0 1200 720" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="factory-floor" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#163f4b" /><stop offset="1" stopColor="#0a2733" /></linearGradient>
          <pattern id="floor-grid" width="55" height="55" patternUnits="userSpaceOnUse"><path d="M55 0H0v55" fill="none" stroke="#82aab3" strokeOpacity=".2" strokeWidth="2" /></pattern>
        </defs>
        <path d="M0 0h1200v720H0z" fill="#18869a" />
        <path d="M0 112 240 0h960v128L0 362z" fill="#f4d39a" />
        <path d="M0 112v250l1200-234V0H240z" fill="none" stroke="#e9f0e9" strokeWidth="16" />
        {[180, 390, 600, 810, 1020].map((x) => <path key={x} d={`M${x} 30v250`} stroke="#e9f0e9" strokeWidth="10" opacity=".85" />)}
        <path d="M0 362 1200 128v592H0z" fill="url(#factory-floor)" />
        <path d="M0 362 1200 128v592H0z" fill="url(#floor-grid)" />
        <path d="m90 590 820-164 220 90-820 164z" fill="none" stroke="#f2b721" strokeWidth="9" strokeDasharray="22 14" opacity=".75" />
        <path d="M870 720v-98h330v98" fill="#dfe7e8" stroke="#46636c" strokeWidth="10" />
        <path d="M900 690h260" stroke="#e45b66" strokeWidth="28" />
        <rect x="925" y="625" width="76" height="44" fill="#244e64" stroke="#132f3c" strokeWidth="5" />
        <rect x="1020" y="625" width="76" height="44" fill="#244e64" stroke="#132f3c" strokeWidth="5" />
      </svg>
      <div className="absolute left-6 top-5 border-l-4 border-cicopal-red bg-white/90 px-4 py-3 shadow-lg">
        <p className="text-xs font-black uppercase tracking-[.18em] text-cicopal-blue">Planta vetorial</p>
        <strong className="text-xl text-gray-950">Área de produção Cicopal</strong>
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
            className={`vector-line-station absolute border-2 bg-[#102f3a]/75 transition ${focused ? "border-white shadow-[0_0_0_5px_rgba(32,36,118,.55)]" : "border-white/15"}`}
          >
            <AnimatedLineActivity status={line.cycle?.status} active={line.active} lineName={line.name} />
            <span className={`absolute left-3 top-3 px-3 py-2 text-xs font-black shadow-lg ${line.active ? "bg-white text-cicopal-blue" : "bg-gray-700 text-white"}`}>
              {line.name} · {statusLabel(line.cycle?.status)}
            </span>
            {line.ncs.length ? <span className="absolute right-3 top-3 bg-cicopal-red px-3 py-2 text-xs font-black text-white shadow-lg">{line.ncs.length} NC</span> : null}
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
      : ["aguardando_liberacao", "awaiting_release", "pronto", "ready"].includes(status)
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
          <rect className="factory-window" x="148" y="47" width="62" height="22" />
          <circle className="factory-gear" cx="222" cy="58" r="13" />
          <path className="factory-gear-mark" d="M222 48v20M212 58h20M215 51l14 14M229 51l-14 14" />
          <rect className="factory-status-light" x="236" y="42" width="8" height="19" />
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
          <path className="factory-spray" d="m151 48 18-10M154 54l23-2M151 60l18 9" />
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
