"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Factory,
  FileText,
  Play,
  RefreshCw,
  Square,
  X,
} from "lucide-react";
import { checklistGroups, generateLoteId } from "@/lib/checklist";
import { formatDateLabel, rgCatalog } from "@/lib/rastreabilidade";
import {
  loadActiveRg003Cycle,
  loadRg003CyclesByDate,
  makeRg003ProductionCode,
  persistCycleNc,
  persistCycleTransition,
  resolveCycleNc,
  startCyclePause,
  finishCyclePause,
  startRg003Cycle,
} from "@/lib/rg003Persistence";
import { repairTextDeep } from "@/lib/textEncoding";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import { ProductionProcessFlow } from "@/components/ProductionProcessFlow";
import { finishCycleSubprocesses } from "@/lib/productionProcessPersistence";

const weekDays = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];

function isSequentialDocument(lineId, documentId) {
  return (
    (lineId === "ROS" && documentId === "RG.QUA.BA.003") ||
    (lineId === "PUR" && documentId === "RG.QUA.005") ||
    (lineId === "SAL" && documentId === "RG.QUA.004")
  );
}

const steps = [
  { id: 1, label: "Linha" },
  { id: 2, label: "Data" },
  { id: 3, label: "RG" },
  { id: 4, label: "Processo" },
  { id: 5, label: "Registros" },
  { id: 6, label: "Preenchimento" },
];

const processCatalog = [
  { id: "higienizacao", nome: "Higienizacao", frequencia: "Por registro" },
  {
    id: "produto_liberacao",
    nome: "Liberacao do Produto",
    frequencia: "Por horario liberado",
  },
  {
    id: "produto_avaliacao",
    nome: "Avaliacao do Produto",
    frequencia: "Hora em hora",
  },
  { id: "processo", nome: "RG - Processo", frequencia: "Hora em hora" },
  {
    id: "fotografico",
    nome: "Registro Fotografico",
    frequencia: "Hora em hora",
  },
  {
    id: "extrusora_clextral",
    nome: "Parametros Extrusora Clextral",
    frequencia: "Hora em hora",
  },
  {
    id: "batelada_milho",
    nome: "Controle de Batelada do Milho",
    frequencia: "Por batelada",
  },
];

function countRegistros(linha) {
  return linha.datas.reduce((total, data) => {
    return (
      total +
      data.documentos.reduce((docTotal, documento) => {
        return (
          docTotal +
          documento.lotes.reduce(
            (loteTotal, lote) => loteTotal + lote.registros.length,
            0,
          )
        );
      }, 0)
    );
  }, 0);
}

function dateHasNc(data) {
  return data.documentos.some((documento) =>
    documento.lotes.some((lote) =>
      lote.registros.some((registro) =>
        registro.subregistros?.some(
          (subregistro) => (subregistro.ncs ?? []).length > 0,
        ),
      ),
    ),
  );
}

function makeCalendarDays(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const totalDays = new Date(year, month + 1, 0).getDate();
  const days = [];

  for (let index = 0; index < firstDay.getDay(); index += 1) {
    days.push(null);
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const dateId = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    days.push({ day, dateId });
  }

  return days;
}

function getBaseMonth() {
  return new Date();
}

const processDisplayPrefixes = {
  higienizacao: "HIG",
  produto_liberacao: "LIBP",
  produto_avaliacao: "AVP",
  processo: "RGP",
  fotografico: "REGF",
  extrusora_clextral: "EXT",
  batelada_milho: "BAT",
};

function getShortRegistroId(registroId = "", processoId = "") {
  const idSemRg = registroId.replace(/^RG\d+-/, "");
  const parts = idSemRg.split("-");
  const suffix = parts[parts.length - 1] ?? "";
  const letters =
    suffix.match(/^[A-Z]+/)?.[0] ?? processDisplayPrefixes[processoId] ?? "REG";
  const number = suffix.match(/\d+$/)?.[0] ?? "01";
  const displayPrefix = letters === "HG" ? "HIG" : letters;
  const displayNumber =
    number.length > 2 ? number.slice(-2) : number.padStart(2, "0");

  if (parts.length >= 3) {
    return `${parts[0]}-${parts[1]}-${displayPrefix}${displayNumber}`;
  }

  return registroId;
}

function CardButton({
  selected,
  danger,
  title,
  meta,
  icon: Icon,
  onClick,
  onDoubleTap,
}) {
  const lastTapRef = useRef(0);
  const tone = selected
    ? danger
      ? "border-cicopal-red bg-cicopal-red text-white"
      : "border-cicopal-blue bg-cicopal-blue text-white"
    : danger
      ? "border-red-200 bg-red-50 text-cicopal-red"
      : "border-gray-200 bg-white text-gray-900";

  return (
    <button
      type="button"
      className={`flex min-h-24 w-full items-center gap-3 rounded-md border border-t-[5px] p-4 text-left shadow-soft ${tone}`}
      onClick={onClick}
      onDoubleClick={onDoubleTap}
      onPointerUp={() => {
        if (!onDoubleTap) return;
        const now = Date.now();
        if (now - lastTapRef.current < 320) {
          onDoubleTap();
        }
        lastTapRef.current = now;
      }}
    >
      {Icon ? <Icon size={26} className="shrink-0" /> : null}
      <span className="min-w-0">
        <span className="block truncate text-xl font-bold">{title}</span>
        {meta ? (
          <span className="block truncate text-sm font-semibold opacity-80">
            {meta}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function CalendarDateButton({
  day,
  tone,
  filledDate,
  hasNc,
  today,
  onClick,
  onDoubleTap,
}) {
  const lastTapRef = useRef(0);

  return (
    <button
      type="button"
      className={`flex min-h-20 flex-col items-center justify-center rounded-md border p-2 font-bold ${tone}`}
      onClick={onClick}
      onDoubleClick={onDoubleTap}
      onPointerUp={() => {
        const now = Date.now();
        if (now - lastTapRef.current < 320) {
          onDoubleTap();
        }
        lastTapRef.current = now;
      }}
    >
      <span className="text-lg">{day.day}</span>
      {filledDate ? (
        <span className="mt-1 flex items-center gap-1 text-[11px] font-bold">
          {hasNc ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />}
          {hasNc ? "NC" : "OK"}
        </span>
      ) : (
        <span className="mt-1 text-[11px] font-bold">
          {today ? "Hoje" : "Vazio"}
        </span>
      )}
    </button>
  );
}

function Stepper({ currentStep, hideDates = false }) {
  const visibleSteps = hideDates
    ? steps.filter((step) => ![2, 5].includes(step.id))
    : steps;
  return (
    <div
      className={`grid grid-cols-2 gap-2 ${hideDates ? "md:grid-cols-4" : "md:grid-cols-6"}`}
    >
      {visibleSteps.map((step) => {
        const active = step.id === currentStep;
        const done = step.id < currentStep;
        const tone = active
          ? "border-cicopal-blue bg-cicopal-blue text-white"
          : done
            ? "border-cicopal-green bg-white text-cicopal-green"
            : "border-gray-200 bg-white text-gray-500";

        return (
          <div
            key={step.id}
            className={`rounded-md border border-t-[5px] px-3 py-3 text-center text-sm font-bold shadow-soft ${tone}`}
          >
            {step.label}
          </div>
        );
      })}
    </div>
  );
}

function StageHeader({ title, meta }) {
  return (
    <div className="mb-4 flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3">
      <h2 className="text-2xl font-bold text-cicopal-blue">{title}</h2>
      {meta ? (
        <span className="rounded-md border border-cicopal-blue bg-blue-50 px-3 py-2 text-sm font-bold text-cicopal-blue">
          {meta}
        </span>
      ) : null}
    </div>
  );
}

function FlowProcessCard({ node, selected, step, onClick }) {
  const tone = !node.unlocked
    ? "border-gray-200 bg-gray-50 text-gray-400"
    : node.done
      ? "border-green-300 bg-green-50 text-cicopal-green"
      : selected
        ? "border-cicopal-blue bg-blue-50 text-cicopal-blue ring-4 ring-blue-100"
        : "border-gray-200 bg-white text-gray-900 hover:border-cicopal-blue";
  const state = !node.unlocked
    ? "Bloqueado"
    : node.done
      ? "Concluído"
      : node.count
        ? "Em andamento"
        : "Disponível";
  return (
    <button
      type="button"
      disabled={!node.unlocked}
      onClick={onClick}
      className={`flex min-h-24 w-full items-center gap-3 rounded-2xl border p-3 text-left shadow-sm transition ${tone}`}
    >
      <span
        className={`grid size-10 shrink-0 place-items-center rounded-full text-sm font-black ${node.done ? "bg-cicopal-green text-white" : node.unlocked ? "bg-cicopal-blue text-white" : "bg-gray-200 text-gray-500"}`}
      >
        {node.done ? <CheckCircle2 size={20} /> : step}
      </span>
      <span className="min-w-0">
        <span className="block text-base font-black">{node.nome}</span>
        <span className="mt-1 block text-xs font-bold opacity-70">{state}</span>
      </span>
    </button>
  );
}

function Rg003ProcessFlow({
  processos,
  lote,
  selectedProcessId,
  onSelect,
  onOpen,
}) {
  const order = [
    "higienizacao",
    "produto_liberacao",
    "produto_avaliacao",
    "processo",
    "fotografico",
  ];
  const records = lote?.registros ?? [];
  const hasSaved = (id) =>
    records.some(
      (record) =>
        record.processoId === id &&
        record.subregistros?.some(
          (item) => item.id === id && item.status !== "Novo",
        ),
    );
  const hygieneOk =
    hasSaved("higienizacao") &&
    !records.some(
      (record) =>
        record.processoId === "higienizacao" &&
        record.subregistros?.some((item) => (item.ncs ?? []).length > 0),
    );
  const releaseOk = hasSaved("produto_liberacao");
  const nodes = order.map((id, index) => ({
    ...processos.find((item) => item.id === id),
    id,
    unlocked: index === 0 || (index === 1 ? hygieneOk : releaseOk),
    count: records.filter((record) => record.processoId === id).length,
    done: hasSaved(id),
  }));
  const openNode = (node) => {
    if (node.unlocked) {
      onSelect(node.id);
      onOpen();
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-cicopal-blue">
              Ciclo operacional · RG 003
            </p>
            <h3 className="mt-1 text-xl font-black text-gray-950">
              Siga o processo na ordem em que ele acontece
            </h3>
            <p className="mt-1 text-sm font-semibold text-gray-600">
              Na troca de produto, inicie uma nova higienização no próximo
              horário.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-cicopal-blue bg-white px-4 font-bold text-cicopal-blue"
            onClick={() => openNode(nodes[0])}
          >
            <RefreshCw size={18} /> Troca de produto
          </button>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-[1fr_40px_1fr_40px_2fr] lg:items-center">
        <FlowProcessCard
          node={nodes[0]}
          selected={selectedProcessId === nodes[0].id}
          onClick={() => openNode(nodes[0])}
        />
        <div className="hidden text-center text-3xl font-black text-gray-300 lg:block">
          →
        </div>
        <FlowProcessCard
          node={nodes[1]}
          selected={selectedProcessId === nodes[1].id}
          onClick={() => openNode(nodes[1])}
        />
        <div className="hidden text-center text-3xl font-black text-gray-300 lg:block">
          →
        </div>
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase text-cicopal-blue">
                Ciclo hora a hora
              </p>
              <p className="text-xs font-semibold text-gray-600">
                Repita as três atividades a cada horário.
              </p>
            </div>
            <RefreshCw size={20} className="text-cicopal-blue" />
          </div>
          <div className="grid gap-2 xl:grid-cols-3">
            {nodes.slice(2).map((node) => (
              <FlowProcessCard
                key={node.id}
                node={node}
                selected={selectedProcessId === node.id}
                onClick={() => openNode(node)}
              />
            ))}
          </div>
        </div>
      </div>
      {!hygieneOk ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
          Conclua a higienização sem NC para liberar a próxima etapa.
        </p>
      ) : !releaseOk ? (
        <p className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-bold text-cicopal-blue">
          Higienização conforme. Agora realize a liberação do produto.
        </p>
      ) : null}
    </div>
  );
}

function getRgPrefix(documentoId = "") {
  const numbers = documentoId.match(/\d+/g) ?? [];
  const number = numbers[numbers.length - 1] ?? "000";
  return `RG${number.padStart(3, "0")}`;
}

function ProgressiveRg003Flow({
  processos,
  lote,
  selectedProcessId,
  onSelect,
  onOpen,
}) {
  const ids = [
    "higienizacao",
    "produto_liberacao",
    "produto_avaliacao",
    "processo",
    "fotografico",
  ];
  const records = lote?.registros ?? [];
  const hasSaved = (id) =>
    records.some(
      (record) =>
        record.processoId === id &&
        record.subregistros?.some(
          (item) => item.id === id && item.status !== "Novo",
        ),
    );
  const hygieneOk =
    hasSaved("higienizacao") &&
    !records.some(
      (record) =>
        record.processoId === "higienizacao" &&
        record.subregistros?.some((item) => (item.ncs ?? []).length),
    );
  const releaseOk = hasSaved("produto_liberacao");
  const nodes = ids.map((id, index) => ({
    ...processos.find((item) => item.id === id),
    id,
    unlocked: index === 0 || (index === 1 ? hygieneOk : releaseOk),
    count: records.filter((record) => record.processoId === id).length,
    done: hasSaved(id),
  }));
  const open = (node) => {
    if (node.unlocked) {
      onSelect(node.id);
      onOpen();
    }
  };
  return (
    <div className="mx-auto max-w-5xl rounded-3xl border border-gray-200 bg-white p-4 shadow-sm md:p-6">
      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-[.18em] text-cicopal-blue">
          RG.QUA.BA.003
        </p>
        <h3 className="mt-1 text-2xl font-black text-gray-950">
          Fluxo da produção
        </h3>
      </div>
      <div className="grid gap-0 lg:grid-cols-[1fr_56px_1fr_56px_1.4fr] lg:items-center">
        <FlowProcessCard
          step="1"
          node={nodes[0]}
          selected={selectedProcessId === nodes[0].id}
          onClick={() => open(nodes[0])}
        />
        <div className="grid h-12 place-items-center text-2xl font-black text-gray-300">
          →
        </div>
        <FlowProcessCard
          step="2"
          node={nodes[1]}
          selected={selectedProcessId === nodes[1].id}
          onClick={() => open(nodes[1])}
        />
        <div className="grid h-12 place-items-center text-2xl font-black text-gray-300">
          →
        </div>
        <div className="rounded-2xl border-2 border-blue-100 bg-blue-50/60 p-3">
          <div className="mb-3 flex items-center gap-2 text-cicopal-blue">
            <RefreshCw size={18} />
            <p className="text-sm font-black">3 · A cada hora</p>
          </div>
          <div className="space-y-2">
            {nodes.slice(2).map((node, index) => (
              <FlowProcessCard
                key={node.id}
                step={`3.${index + 1}`}
                node={node}
                selected={selectedProcessId === node.id}
                onClick={() => open(node)}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-5 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-amber-500 text-white">
              <RefreshCw size={19} />
            </span>
            <div>
              <p className="font-black text-amber-950">Troca de produto</p>
              <p className="text-xs font-semibold text-amber-800">
                No próximo horário, retorne para a higienização.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="min-h-11 rounded-xl bg-amber-500 px-4 font-black text-white"
            onClick={() => open(nodes[0])}
          >
            ↩ Voltar para a etapa 1
          </button>
        </div>
      </div>
      <div className="mt-4 text-center">
        {!hygieneOk ? (
          <p className="text-sm font-bold text-amber-800">
            Próxima ação: concluir a higienização sem NC.
          </p>
        ) : !releaseOk ? (
          <p className="text-sm font-bold text-cicopal-blue">
            Próxima ação: liberar o produto.
          </p>
        ) : (
          <p className="text-sm font-bold text-cicopal-green">
            Controles do horário liberados.
          </p>
        )}
      </div>
    </div>
  );
}

function formatElapsed(startedAt, now) {
  if (!startedAt) return "00:00:00";
  const seconds = Math.max(
    0,
    Math.floor((now.getTime() - new Date(startedAt).getTime()) / 1000),
  );
  const hoursValue = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const minutesValue = String(Math.floor((seconds % 3600) / 60)).padStart(
    2,
    "0",
  );
  const secondsValue = String(seconds % 60).padStart(2, "0");
  return `${hoursValue}:${minutesValue}:${secondsValue}`;
}

function TechnicalRg003StageNav({ lineId, currentProcessId, onOpenProcess }) {
  const [status, setStatus] = useState("hygiene");
  useEffect(() => {
    try {
      setStatus(
        JSON.parse(
          window.localStorage.getItem(`carper_rg003_cycle_${lineId}`) ?? "null",
        )?.status ?? "hygiene",
      );
    } catch {
      setStatus("hygiene");
    }
    const update = (event) => setStatus(event.detail?.status ?? "hygiene");
    window.addEventListener("rg003-cycle-updated", update);
    return () => window.removeEventListener("rg003-cycle-updated", update);
  }, [lineId]);
  const items = [
    {
      id: "higienizacao",
      label: "Higienização",
      enabled: status === "hygiene",
      done: status !== "hygiene",
    },
    {
      id: "produto_liberacao",
      label: "Liberar produto",
      enabled: status === "awaiting_release",
      done: ["ready", "producing", "blocked"].includes(status),
    },
    {
      id: "produto_avaliacao",
      label: "Produto",
      enabled: status === "producing",
    },
    { id: "processo", label: "Processo", enabled: status === "producing" },
    { id: "fotografico", label: "Foto", enabled: status === "producing" },
  ];
  const pending = items.filter(
    (item) => item.enabled && !item.done && item.id !== currentProcessId,
  ).length;
  return (
    <nav
      className="mb-4 rounded-lg border border-gray-300 bg-white p-3"
      aria-label="Etapas do RG 003"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase text-gray-500">
          Fluxo do ciclo
        </p>
        <span
          className={`text-xs font-bold ${pending ? "text-amber-700" : "text-cicopal-green"}`}
        >
          {pending
            ? `Você tem ${pending} tarefa(s) disponível(is)`
            : "Nenhuma tarefa liberada pendente"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            disabled={
              (!item.enabled && !item.done) || item.id === currentProcessId
            }
            onClick={() => onOpenProcess(item.id)}
            className={`min-h-14 rounded-md border px-2 text-sm font-bold ${item.id === currentProcessId ? "border-cicopal-blue bg-cicopal-blue text-white" : item.done ? "border-green-300 bg-green-50 text-cicopal-green" : item.enabled ? "border-cicopal-blue bg-white text-cicopal-blue" : "border-gray-200 bg-gray-100 text-gray-400"}`}
          >
            <span className="mr-1">{item.done ? "✓" : `${index + 1}.`}</span>
            {item.label}
            <span className="mt-0.5 block text-[10px]">
              {item.id === currentProcessId
                ? "Em preenchimento"
                : item.done
                  ? "Concluída · toque para visualizar"
                  : item.enabled
                    ? "Disponível"
                    : status === "blocked"
                      ? "Produção interrompida"
                      : "Bloqueada"}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
}

function Rg003CyclePanel({
  lineId,
  operatorId,
  operatorName,
  processos,
  onSelect,
  onOpen,
  onOpenProcess,
}) {
  const storageKey = `carper_rg003_cycle_${lineId}`;
  const historyKey = `carper_rg003_cycle_history_${lineId}`;
  const [now, setNow] = useState(() => new Date());
  const [product, setProduct] = useState("");
  const [cycle, setCycle] = useState(null);
  const [cycleHistory, setCycleHistory] = useState([]);
  const [ready, setReady] = useState(false);
  const [ncOpen, setNcOpen] = useState(false);
  const [ncData, setNcData] = useState({
    quantidade: "",
    descricao: "",
    causa: "",
    acao: "",
  });
  const [syncState, setSyncState] = useState("loading");

  useEffect(() => {
    let active = true;
    async function loadCycle() {
      try {
        const result = await loadActiveRg003Cycle(lineId);
        if (!active) return;
        if (result.remote) {
          setCycle(result.cycle);
          if (result.cycle?.product) setProduct(result.cycle.product);
          setSyncState("online");
        } else {
          const savedCycle = repairTextDeep(
            JSON.parse(window.localStorage.getItem(storageKey) ?? "null"),
          );
          setCycle(savedCycle);
          if (savedCycle?.product) setProduct(savedCycle.product);
          setSyncState("local");
        }
        setCycleHistory(
          repairTextDeep(
            JSON.parse(window.localStorage.getItem(historyKey) ?? "[]"),
          ),
        );
      } catch {
        const savedCycle = repairTextDeep(
          JSON.parse(window.localStorage.getItem(storageKey) ?? "null"),
        );
        if (active) {
          setCycle(savedCycle);
          setSyncState("error");
        }
      } finally {
        if (active) setReady(true);
      }
    }
    loadCycle();
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [historyKey, lineId, storageKey]);

  useEffect(() => {
    if (!ready) return;
    if (cycle) window.localStorage.setItem(storageKey, JSON.stringify(cycle));
    else window.localStorage.removeItem(storageKey);
  }, [cycle, ready, storageKey]);

  useEffect(() => {
    if (ready)
      window.localStorage.setItem(historyKey, JSON.stringify(cycleHistory));
  }, [cycleHistory, historyKey, ready]);

  function event(label, extra = {}) {
    return {
      id: `${Date.now()}-${label}`,
      label,
      at: new Date().toISOString(),
      operator: operatorName,
      ...extra,
    };
  }

  function openProcess(processId) {
    if (onOpenProcess) {
      onOpenProcess(processId);
      return;
    }
    onSelect(processId);
    onOpen();
  }

  async function startCycle(reason = "Início de produção") {
    const at = new Date().toISOString();
    const previousProduct = cycle?.product ?? "";
    if (cycle)
      setCycleHistory((current) => [
        ...current,
        {
          ...cycle,
          endedAt: at,
          events: [
            ...(cycle.events ?? []),
            event("Ciclo encerrado por troca de produto", {
              nextProduct: product,
            }),
          ],
        },
      ]);
    let next = {
      id: `CICLO-${Date.now()}`,
      product,
      previousProduct,
      reason,
      startedAt: at,
      stageStartedAt: at,
      status: "hygiene",
      activeAction: null,
      events: [
        event("Higienização iniciada", { reason, previousProduct, product }),
      ],
    };
    try {
      const remoteCycle = await startRg003Cycle({
        lineId,
        product,
        reason,
        operatorId,
      });
      if (remoteCycle) {
        next = remoteCycle;
        setSyncState("online");
      }
    } catch {
      setSyncState("error");
    }
    setCycle(next);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
    window.dispatchEvent(
      new CustomEvent("rg003-cycle-updated", { detail: next }),
    );
  }

  async function updateCycle(patchValue, eventLabel, processId) {
    const loggedEvent = event(eventLabel);
    setCycle((current) => ({
      ...current,
      ...patchValue,
      events: [...(current?.events ?? []), loggedEvent],
    }));
    try {
      await persistCycleTransition({
        cycle,
        status: patchValue.status ?? cycle?.status,
        description: eventLabel,
        operatorId,
        operatorName,
        activeAction: Object.hasOwn(patchValue, "activeAction")
          ? patchValue.activeAction
          : cycle?.activeAction,
      });
      if (cycle?.id?.length === 36) setSyncState("online");
    } catch {
      setSyncState("error");
    }
    if (processId) openProcess(processId);
  }

  function startHourlyAction(type, label, processId) {
    if (cycle?.status !== "producing") return;
    const at = new Date().toISOString();
    updateCycle(
      { activeAction: { type, label, startedAt: at }, stageStartedAt: at },
      `${label} iniciada`,
      processId,
    );
  }

  function finishAction() {
    if (!cycle?.activeAction) return;
    updateCycle(
      { activeAction: null },
      `${cycle.activeAction.label} concluída`,
    );
  }

  async function registerNc() {
    const stopProduction = ncData.acao === "Parar produção";
    const ncEvent = event("Não conformidade registrada", {
      product: cycle?.product,
      quantidade: ncData.quantidade,
      descricao: ncData.descricao,
      causa: ncData.causa,
      acao: ncData.acao,
      interruptedProduction: stopProduction,
    });
    setCycle((current) => ({
      ...current,
      status: stopProduction ? "blocked" : current.status,
      activeAction: stopProduction ? null : current.activeAction,
      events: [...(current.events ?? []), ncEvent],
    }));
    try {
      await persistCycleNc({ cycle, operatorId, operatorName, data: ncData });
      await persistCycleTransition({
        cycle,
        status: stopProduction ? "blocked" : cycle.status,
        description: "Não conformidade registrada",
        operatorId,
        operatorName,
        activeAction: stopProduction ? null : cycle.activeAction,
      });
      if (cycle?.id?.length === 36) setSyncState("online");
    } catch {
      setSyncState("error");
    }
    setNcOpen(false);
    setNcData({ quantidade: "", descricao: "", causa: "", acao: "" });
  }

  if (!ready)
    return <div className="min-h-64 animate-pulse rounded-3xl bg-gray-100" />;
  const processStatus = !cycle
    ? "Sem ciclo ativo"
    : cycle.status === "hygiene"
      ? "Em higienização"
      : cycle.status === "awaiting_release"
        ? "Aguardando liberação"
        : cycle.status === "blocked"
          ? "Produto bloqueado"
          : "Produto liberado";
  const statusLabel = `${processStatus} · ${syncState === "online" ? "Banco conectado" : syncState === "error" ? "Falha de sincronização" : syncState === "local" ? "Modo local" : "Conectando"}`;
  const hourlyEnabled = cycle?.status === "producing";
  const stages = cycle
    ? [
        {
          id: "higienizacao",
          label: "Higienização",
          state: cycle.status === "hygiene" ? "current" : "done",
          action: () => openProcess("higienizacao"),
        },
        {
          id: "produto_liberacao",
          label: "Liberação do produto",
          state:
            cycle.status === "hygiene"
              ? "locked"
              : ["producing", "blocked"].includes(cycle.status)
                ? "done"
                : "current",
          action: () => openProcess("produto_liberacao"),
        },
        {
          id: "produto_avaliacao",
          label: "Avaliação do produto",
          state: hourlyEnabled ? "available" : "locked",
          action: () =>
            startHourlyAction(
              "product",
              "Avaliação do produto",
              "produto_avaliacao",
            ),
        },
        {
          id: "processo",
          label: "Avaliação do processo",
          state: hourlyEnabled ? "available" : "locked",
          action: () =>
            startHourlyAction("process", "Avaliação do processo", "processo"),
        },
        {
          id: "fotografico",
          label: "Registro fotográfico",
          state: hourlyEnabled ? "available" : "locked",
          action: () =>
            startHourlyAction("photo", "Registro fotográfico", "fotografico"),
        },
      ]
    : [];

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <section className="rounded-3xl bg-gray-950 p-4 text-white shadow-xl md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.18em] text-blue-300">
              RG.QUA.BA.003 · ciclo contínuo
            </p>
            <h2 className="mt-1 text-2xl font-black">
              {cycle?.product ?? "Iniciar produção"}
            </h2>
            <p
              className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-black ${cycle?.status === "blocked" ? "bg-red-500" : "bg-white/10"}`}
            >
              {statusLabel}
            </p>
          </div>
          <div className="flex flex-wrap items-stretch justify-end gap-3">
            {cycle ? (
              <button
                type="button"
                className="inline-flex min-h-16 items-center gap-3 border-2 border-red-400 bg-red-500 px-4 text-left font-bold text-white shadow-lg transition hover:bg-red-600 active:scale-[.98]"
                onClick={() => setNcOpen(true)}
              >
                <AlertTriangle size={26} />
                <span>
                  Registrar NC
                  <small className="block text-xs font-semibold text-red-100">
                    Produto e horário automáticos
                  </small>
                </span>
              </button>
            ) : null}
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-2xl bg-white/10 p-3">
                <p className="text-[10px] font-bold uppercase text-white/60">
                  Tempo do ciclo
                </p>
                <p className="mt-1 text-xl font-black tabular-nums">
                  {formatElapsed(cycle?.startedAt, now)}
                </p>
              </div>
              <div className="rounded-2xl bg-white/10 p-3">
                <p className="text-[10px] font-bold uppercase text-white/60">
                  Atividade atual
                </p>
                <p className="mt-1 text-xl font-black tabular-nums">
                  {formatElapsed(
                    cycle?.activeAction?.startedAt ?? cycle?.stageStartedAt,
                    now,
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      {cycle ? (
        <section className="rounded-lg border border-gray-300 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase text-gray-500">
                Etapas do RG 003
              </p>
              <p className="text-sm font-semibold text-gray-600">
                Todas as etapas permanecem visíveis; as indisponíveis ficam
                bloqueadas.
              </p>
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            {stages.map((stage, index) => (
              <button
                key={stage.id}
                type="button"
                disabled={
                  stage.state === "locked" || Boolean(cycle.activeAction)
                }
                onClick={stage.action}
                className={`min-h-24 rounded-md border p-3 text-left ${stage.state === "done" ? "border-green-200 bg-green-50 text-cicopal-green" : stage.state === "current" ? "border-cicopal-blue bg-blue-50 text-cicopal-blue" : stage.state === "available" ? "border-gray-300 bg-white text-gray-900" : "border-gray-200 bg-gray-100 text-gray-400"}`}
              >
                <span className="text-xs font-bold">{index + 1}</span>
                <span className="mt-2 block font-bold">{stage.label}</span>
                <span className="mt-1 block text-xs font-semibold">
                  {stage.state === "done"
                    ? "Concluída"
                    : stage.state === "current"
                      ? "Etapa atual"
                      : stage.state === "available"
                        ? "Disponível"
                        : cycle.status === "blocked" && index > 1
                          ? "Produção interrompida"
                          : "Bloqueada"}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {!cycle ? (
        <section className="rounded-3xl border border-gray-200 bg-white p-5">
          <label className="block">
            <span className="mb-2 block text-sm font-black">
              Produto que será produzido
            </span>
            <select
              className="min-h-14 w-full rounded-xl border border-gray-300 bg-white px-4 text-lg font-bold"
              value={product}
              onChange={(e) => setProduct(e.target.value)}
            >
              <option>Rosca Leite</option>
              <option>Rosca Coco</option>
              <option>Rosca Chocolate</option>
              <option>Rosca Tradicional</option>
            </select>
          </label>
          <button
            type="button"
            className="mt-4 inline-flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-cicopal-blue text-lg font-black text-white"
            onClick={() => startCycle()}
          >
            <Play size={22} /> Iniciar higienização
          </button>
        </section>
      ) : (
        <section className="rounded-3xl border border-gray-200 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cycle.status === "hygiene" ? (
              <>
                <button
                  type="button"
                  className="min-h-16 rounded-2xl border border-cicopal-blue bg-blue-50 px-4 font-black text-cicopal-blue"
                  onClick={() => openProcess("higienizacao")}
                >
                  Abrir higienização
                </button>
                <button
                  type="button"
                  className="min-h-16 rounded-2xl bg-cicopal-green px-4 font-black text-white"
                  onClick={() =>
                    updateCycle(
                      {
                        status: "awaiting_release",
                        stageStartedAt: new Date().toISOString(),
                      },
                      "Higienização concluída conforme",
                    )
                  }
                >
                  Concluir higienização
                </button>
              </>
            ) : null}
            {cycle.status === "awaiting_release" ? (
              <button
                type="button"
                className="min-h-16 rounded-2xl bg-cicopal-green px-4 font-black text-white"
                onClick={() =>
                  updateCycle(
                    {
                      status: "producing",
                      stageStartedAt: new Date().toISOString(),
                    },
                    "Produto liberado",
                    "produto_liberacao",
                  )
                }
              >
                Liberar produto
              </button>
            ) : null}
            {["producing", "blocked"].includes(cycle.status) ? (
              <>
                <button
                  type="button"
                  disabled={Boolean(cycle.activeAction)}
                  className="min-h-16 rounded-2xl bg-cicopal-blue px-4 font-black text-white disabled:bg-gray-300"
                  onClick={() =>
                    startHourlyAction(
                      "product",
                      "Avaliação do produto",
                      "produto_avaliacao",
                    )
                  }
                >
                  Iniciar avaliação do produto
                </button>
                <button
                  type="button"
                  disabled={Boolean(cycle.activeAction)}
                  className="min-h-16 rounded-2xl bg-cicopal-blue px-4 font-black text-white disabled:bg-gray-300"
                  onClick={() =>
                    startHourlyAction(
                      "process",
                      "Avaliação do processo",
                      "processo",
                    )
                  }
                >
                  Iniciar avaliação do processo
                </button>
                <button
                  type="button"
                  disabled={Boolean(cycle.activeAction)}
                  className="min-h-16 rounded-2xl border border-cicopal-blue bg-white px-4 font-black text-cicopal-blue disabled:text-gray-300"
                  onClick={() =>
                    startHourlyAction(
                      "photo",
                      "Registro fotográfico",
                      "fotografico",
                    )
                  }
                >
                  Iniciar registro fotográfico
                </button>
                {cycle.activeAction ? (
                  <button
                    type="button"
                    className="inline-flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-cicopal-green px-4 font-black text-white"
                    onClick={finishAction}
                  >
                    <Square size={19} /> Concluir {cycle.activeAction.label}
                  </button>
                ) : null}
                <button
                  type="button"
                  className={`min-h-16 rounded-2xl px-4 font-black text-white ${cycle.status === "blocked" ? "bg-cicopal-green" : "bg-cicopal-red"}`}
                  onClick={() =>
                    updateCycle(
                      {
                        status:
                          cycle.status === "blocked" ? "producing" : "blocked",
                        activeAction: null,
                      },
                      cycle.status === "blocked"
                        ? "Produto desbloqueado"
                        : "Produto bloqueado",
                    )
                  }
                >
                  {cycle.status === "blocked"
                    ? "Desbloquear produto"
                    : "Bloquear produto"}
                </button>
              </>
            ) : null}
          </div>
          <div className="mt-5 border-t border-gray-200 pt-4">
            <p className="mb-2 text-xs font-black uppercase text-gray-500">
              Troca de produto
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                className="min-h-14 flex-1 rounded-xl border border-gray-300 bg-white px-4 font-bold"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
              >
                <option>Rosca Leite</option>
                <option>Rosca Coco</option>
                <option>Rosca Chocolate</option>
                <option>Rosca Tradicional</option>
              </select>
              <button
                type="button"
                disabled={product === cycle.product}
                className="min-h-14 rounded-xl bg-amber-500 px-5 font-black text-white disabled:bg-gray-300"
                onClick={() => startCycle("Troca de produto")}
              >
                <RefreshCw size={18} className="mr-2 inline" />
                Trocar e iniciar higienização
              </button>
            </div>
          </div>
        </section>
      )}

      {cycle?.events?.length ? (
        <section className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="mb-3 text-xs font-black uppercase text-gray-500">
            Linha do tempo do ciclo
          </p>
          <div className="space-y-2">
            {[...cycle.events]
              .reverse()
              .slice(0, 8)
              .map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 border-l-4 border-cicopal-blue bg-gray-50 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-black text-gray-900">
                      {item.label}
                    </p>
                    <p className="text-xs font-semibold text-gray-500">
                      {item.operator || "Operador"}
                    </p>
                  </div>
                  <time className="text-xs font-black text-gray-600">
                    {new Date(item.at).toLocaleString("pt-BR")}
                  </time>
                </div>
              ))}
          </div>
          {cycleHistory.length ? (
            <p className="mt-3 text-xs font-bold text-gray-500">
              {cycleHistory.length} ciclo(s) anterior(es) preservado(s) no
              histórico.
            </p>
          ) : null}
        </section>
      ) : null}
      {ncOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <section className="w-full max-w-2xl rounded-lg border-t-4 border-cicopal-red bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-gray-200 p-4">
              <div>
                <p className="text-xs font-bold uppercase text-cicopal-red">
                  Registro imediato
                </p>
                <h2 className="text-xl font-bold text-gray-950">
                  Não conformidade
                </h2>
              </div>
              <button
                type="button"
                className="size-11 border border-gray-200 bg-white"
                onClick={() => setNcOpen(false)}
              >
                <X size={20} className="mx-auto" />
              </button>
            </header>
            <div className="p-4">
              <div className="mb-4 grid grid-cols-2 gap-3">
                <div className="bg-gray-100 p-3">
                  <p className="text-xs font-bold uppercase text-gray-500">
                    Produto
                  </p>
                  <p className="font-bold text-gray-950">{cycle?.product}</p>
                </div>
                <div className="bg-gray-100 p-3">
                  <p className="text-xs font-bold uppercase text-gray-500">
                    Data e hora
                  </p>
                  <p className="font-bold text-gray-950">
                    {now.toLocaleString("pt-BR")}
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="mb-1 block text-xs font-bold uppercase text-gray-500">
                    Quantidade
                  </span>
                  <input
                    className="min-h-14 w-full rounded-md border border-gray-300 px-3 font-semibold"
                    value={ncData.quantidade}
                    onChange={(e) =>
                      setNcData((current) => ({
                        ...current,
                        quantidade: e.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  <span className="mb-1 block text-xs font-bold uppercase text-gray-500">
                    Ação tomada
                  </span>
                  <select
                    className="min-h-14 w-full rounded-md border border-gray-300 bg-white px-3 font-semibold"
                    value={ncData.acao}
                    onChange={(e) =>
                      setNcData((current) => ({
                        ...current,
                        acao: e.target.value,
                      }))
                    }
                  >
                    <option value="">Selecionar</option>
                    <option>Corrigir sem parar produção</option>
                    <option>Segregar produto</option>
                    <option>Parar produção</option>
                  </select>
                </label>
                <label className="sm:col-span-2">
                  <span className="mb-1 block text-xs font-bold uppercase text-gray-500">
                    Não conformidade
                  </span>
                  <textarea
                    className="min-h-24 w-full rounded-md border border-gray-300 p-3 font-semibold"
                    value={ncData.descricao}
                    onChange={(e) =>
                      setNcData((current) => ({
                        ...current,
                        descricao: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className="sm:col-span-2">
                  <span className="mb-1 block text-xs font-bold uppercase text-gray-500">
                    Causa
                  </span>
                  <textarea
                    className="min-h-24 w-full rounded-md border border-gray-300 p-3 font-semibold"
                    value={ncData.causa}
                    onChange={(e) =>
                      setNcData((current) => ({
                        ...current,
                        causa: e.target.value,
                      }))
                    }
                  />
                </label>
              </div>
            </div>
            <footer className="flex justify-end gap-3 border-t border-gray-200 p-4">
              <button
                type="button"
                className="min-h-14 border border-gray-300 bg-white px-5 font-bold"
                onClick={() => setNcOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  !ncData.quantidade ||
                  !ncData.descricao ||
                  !ncData.causa ||
                  !ncData.acao
                }
                className="min-h-14 bg-cicopal-red px-5 font-bold text-white disabled:bg-gray-300"
                onClick={registerNc}
              >
                Registrar NC
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function CycleReadOnlyField({ label, value }) {
  return (
    <div className="border-l-4 border-cicopal-blue bg-gray-50 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 font-black text-gray-900">{value}</p>
    </div>
  );
}

function Rg003ProductionControl({
  lineId,
  documentCode,
  dateId,
  operatorId,
  operatorName,
  onOpenProcess,
  operatorOnly = false,
  profileCode = "",
}) {
  const storageKey = `carper_rg003_cycle_${lineId}`;
  const [cycle, setCycle] = useState(null);
  const productOptions = {
    ROS: ["Rosca Leite", "Rosca Coco", "Rosca Chocolate", "Rosca Tradicional"],
    PUR: ["Pururuca Tradicional", "Pururuca Temperada"],
    SAL: [
      "Salgadinho Tradicional",
      "Salgadinho Queijo",
      "Salgadinho Churrasco",
    ],
  };
  const products = productOptions[lineId] ?? [];
  const [product, setProduct] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [ready, setReady] = useState(false);
  const [dayCycles, setDayCycles] = useState([]);
  const [viewedCycle, setViewedCycle] = useState(null);
  const [syncState, setSyncState] = useState("checking");
  const [stopOpen, setStopOpen] = useState(false);
  const [stopMode, setStopMode] = useState("finish");
  const [nextProduct, setNextProduct] = useState("");
  const [genericNcOpen, setGenericNcOpen] = useState(false);
  const [genericNc, setGenericNc] = useState({
    quantidade: "",
    descricao: "",
    causa: "",
    acao: "",
    fotoAntes: "",
  });
  const [resumeOpen, setResumeOpen] = useState(false);
  const [resumeData, setResumeData] = useState({ observacao: "", fotoDepois: "" });

  useEffect(() => {
    let active = true;
    loadActiveRg003Cycle(lineId)
      .then((result) => {
        if (!active) return;
        const saved = result.remote
          ? result.cycle
          : JSON.parse(window.localStorage.getItem(storageKey) ?? "null");
        store(saved);
        if (saved?.product) setProduct(saved.product);
        setSyncState(result.remote ? "online" : "local");
        setReady(true);
      })
      .catch(() => {
        if (active) {
          try {
            setCycle(
              JSON.parse(window.localStorage.getItem(storageKey) ?? "null"),
            );
          } catch {
            setCycle(null);
          }
          setSyncState("error");
          setReady(true);
        }
      });
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [lineId, storageKey]);

  useEffect(() => {
    let active = true;
    loadRg003CyclesByDate(lineId, dateId)
      .then((result) => {
        if (active) setDayCycles(result.cycles);
      })
      .catch(() => {
        if (active) setDayCycles([]);
      });
    return () => {
      active = false;
    };
  }, [dateId, lineId, cycle?.id, cycle?.status]);

  function store(next) {
    setCycle(next);
    if (next) window.localStorage.setItem(storageKey, JSON.stringify(next));
    else window.localStorage.removeItem(storageKey);
    window.dispatchEvent(
      new CustomEvent("rg003-cycle-updated", { detail: next }),
    );
  }
  function localEvent(label) {
    return {
      id: `${Date.now()}-${label}`,
      label,
      at: new Date().toISOString(),
      operator: operatorName,
    };
  }

  async function prepare(
    reason = "Início de produção",
    selectedProduct = product,
  ) {
    const at = new Date().toISOString();
    let next = {
      id: `CICLO-${Date.now()}`,
      productionCode: makeRg003ProductionCode(selectedProduct, at, 1, lineId),
      product: selectedProduct,
      previousProduct: cycle?.product ?? "",
      reason,
      status: "hygiene",
      startedAt: at,
      stageStartedAt: at,
      events: [localEvent("Preparação iniciada")],
    };
    setSyncState("saving");
    try {
      const remote = await startRg003Cycle({
        lineId,
        documentCode,
        product: selectedProduct,
        reason,
        operatorId,
      });
      if (remote) {
        next = remote;
        setSyncState("online");
      } else {
        setSyncState("local");
      }
    } catch {
      try {
        const currentRemote = await loadActiveRg003Cycle(lineId);
        if (currentRemote.cycle) {
          next = currentRemote.cycle;
          setProduct(currentRemote.cycle.product);
          setSyncState("online");
        } else {
          setSyncState("error");
          return false;
        }
      } catch {
        setSyncState("error");
        return false;
      }
    }
    store(next);
    return true;
  }

  async function transition(status, label, extra = {}) {
    const next = {
      ...cycle,
      ...extra,
      status,
      stageStartedAt: new Date().toISOString(),
      events: [...(cycle?.events ?? []), localEvent(label)],
    };
    store(next);
    setSyncState("saving");
    try {
      const remote = await persistCycleTransition({
        cycle: next,
        status,
        description: label,
        operatorId,
        operatorName,
        activeAction: next.activeAction ?? null,
      });
      setSyncState(remote ? "online" : "local");
      return true;
    } catch {
      setSyncState("error");
      return false;
    }
  }

  async function beginHourly(type, label, processId) {
    if (cycle?.status !== "producing") return;
    const activeAction = { type, label, startedAt: new Date().toISOString() };
    await transition("producing", `${label} iniciada`, { activeAction });
    onOpenProcess(processId);
  }

  async function stopProduction() {
    if (stopMode === "change") {
      const ended = await transition("ended", "Produção encerrada para troca de produto", {
        productionEndedAt: new Date().toISOString(), activeAction: null,
      });
      if (!ended) return;
      await finishCycleSubprocesses(cycle.id, operatorId);
      await prepare("Troca de produto", nextProduct);
    } else if (stopMode === "cancel") {
      const saved = await transition(
        "ended",
        "Preparação cancelada antes do início da produção",
        { productionEndedAt: null, activeAction: null },
      );
      if (!saved) return;
      store(null);
      setProduct("");
    } else {
      const saved = await transition("ended", "Produção encerrada", {
        productionEndedAt: new Date().toISOString(),
        activeAction: null,
      });
      if (!saved) return;
      await finishCycleSubprocesses(cycle.id, operatorId);
      store(null);
      setProduct("");
    }
    setStopOpen(false);
  }

  async function registerGenericNc() {
    if (!cycle) return;
    const pausesProduction = genericNc.acao === "Pausar produção";
    const stopsProduction = genericNc.acao === "Parar produção";
    try {
      setSyncState("saving");
      const persistedNc = await persistCycleNc({
        cycle,
        operatorId,
        operatorName,
        data: genericNc,
      });
      let activePause = null;
      if (pausesProduction) {
        activePause = await startCyclePause({
          cycleId: cycle.id,
          operatorId,
          reason: genericNc.descricao,
          photoBefore: genericNc.fotoAntes,
        });
        activePause = { ...activePause, ncId: persistedNc?.id ?? null };
      }
      await transition(
        stopsProduction ? "ended" : pausesProduction ? "blocked" : cycle.status,
        "Não conformidade genérica registrada",
        {
          activeAction:
            stopsProduction || pausesProduction ? null : cycle.activeAction,
          activePause,
          ...(stopsProduction
            ? {
                productionEndedAt: new Date().toISOString(),
                activePause: null,
              }
            : {}),
        },
      );
      setGenericNcOpen(false);
      setGenericNc({ quantidade: "", descricao: "", causa: "", acao: "", fotoAntes: "" });
      setSyncState("online");
    } catch {
      setSyncState("error");
    }
  }

  async function resumeProduction() {
    if (!resumeData.observacao.trim() || !resumeData.fotoDepois) return;
    try {
      if (cycle.activePause?.id) {
        await finishCyclePause({
          pauseId: cycle.activePause.id,
          operatorId,
          observation: resumeData.observacao,
          photoAfter: resumeData.fotoDepois,
        });
      }
      if (cycle.activePause?.ncId) {
        await resolveCycleNc({
          ncId: cycle.activePause.ncId,
          operatorId,
          resolution: resumeData.observacao,
          photoAfter: resumeData.fotoDepois,
        });
      }
      await transition("producing", "Produção retomada após pausa", {
        activeAction: null,
        activePause: null,
      });
      setResumeOpen(false);
      setResumeData({ observacao: "", fotoDepois: "" });
    } catch {
      setSyncState("error");
    }
  }

  if (!ready)
    return <div className="min-h-72 animate-pulse rounded-lg bg-gray-100" />;
  const hygieneDone = cycle && cycle.status !== "hygiene";
  const releaseDone =
    cycle && ["ready", "producing", "blocked"].includes(cycle.status);
  const producing = cycle?.status === "producing";
  const canCancelPreparation =
    Boolean(cycle) &&
    ["hygiene", "awaiting_release", "ready"].includes(cycle.status);
  const statusText = !cycle
    ? "Aguardando preparação"
    : cycle.status === "hygiene"
      ? "Higienização pendente"
      : cycle.status === "awaiting_release"
        ? "Liberação pendente"
        : cycle.status === "ready"
          ? "Pronto para iniciar"
          : cycle.status === "blocked"
            ? "Produção bloqueada"
            : cycle.status === "ended"
              ? "Produção encerrada"
              : "Produção em andamento";
  const productionClockRunning =
    ["producing", "blocked"].includes(cycle?.status) &&
    Boolean(cycle?.productionStartedAt);
  const clockStartedAt = cycle?.status === "hygiene"
    ? cycle?.stageStartedAt
    : cycle?.status === "awaiting_release"
      ? cycle?.stageStartedAt
      : productionClockRunning || cycle?.status === "ended"
        ? cycle?.productionStartedAt
        : null;
  const clockNow =
    cycle?.status === "ended" && (cycle?.productionEndedAt || cycle?.endedAt)
      ? new Date(cycle.productionEndedAt ?? cycle.endedAt)
      : now;
  const syncText =
    syncState === "online"
      ? cycle
        ? "Sincronizado com Supabase"
        : "Supabase conectado · nenhuma produção ativa"
      : syncState === "saving"
        ? "Salvando no Supabase..."
        : syncState === "error"
          ? "Falha de sincronização"
          : syncState === "local"
            ? "Supabase não configurado · dados somente neste tablet"
            : "Verificando conexão...";
  const selectedDayReference = dateId
    ? new Date(`${dateId}T12:00:00-03:00`)
    : new Date();

  if (operatorOnly && cycle) {
    return <div className="mx-auto max-w-3xl space-y-4"><section className="border-t-4 border-cicopal-blue bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase text-cicopal-blue">{documentCode} · higienização operacional</p><h2 className="mt-1 text-2xl font-black">{cycle.product}</h2><p className="font-mono text-sm font-bold text-gray-500">{cycle.productionCode}</p><div className="mt-5 border-l-4 border-cicopal-blue bg-blue-50 p-4"><p className="text-xs font-black uppercase text-gray-500">Etapa disponível para o operador</p><button type="button" onClick={() => onOpenProcess("higienizacao")} className={`mt-3 min-h-24 w-full border-2 p-4 text-left ${hygieneDone ? "border-green-400 bg-green-50 text-green-800" : "border-cicopal-blue bg-white text-cicopal-blue"}`}><b className="block text-xl">{hygieneDone ? "Higienização enviada" : "Realizar higienização"}</b><span className="mt-1 block font-semibold">{hygieneDone ? "Toque para visualizar o registro realizado." : "Preencha a execução e envie para inspeção da Qualidade."}</span></button></div><p className="mt-4 text-sm font-semibold text-gray-500">As etapas de inspeção, liberação e avaliação são visualizadas pelo perfil da Qualidade.</p></section></div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <section className="rounded-lg border border-gray-300 border-t-4 border-t-cicopal-blue bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase text-cicopal-blue">
              {documentCode} ·{" "}
              {lineId === "ROS"
                ? "Rosca"
                : lineId === "PUR"
                  ? "Pururuca"
                  : "Salgadinho"}
            </p>
            <h2 className="mt-1 text-2xl font-bold text-gray-950">
              {cycle?.product ?? "Nova produção"}
            </h2>
            {cycle ? (
              <p className="mt-1 font-mono text-sm font-bold text-gray-600">
                {cycle.productionCode ||
                  makeRg003ProductionCode(
                    cycle.product,
                    cycle.startedAt,
                    1,
                    lineId,
                  )}
              </p>
            ) : null}
            <p
              className={`mt-2 text-sm font-bold ${producing ? "text-cicopal-green" : cycle?.status === "blocked" ? "text-cicopal-red" : "text-amber-700"}`}
            >
              {statusText}
            </p>
            <p
              className={`mt-2 inline-flex items-center gap-2 text-xs font-bold ${syncState === "online" ? "text-cicopal-green" : syncState === "error" ? "text-cicopal-red" : "text-gray-500"}`}
            >
              <span
                className={`size-2 rounded-full ${syncState === "online" ? "bg-cicopal-green" : syncState === "saving" || syncState === "checking" ? "animate-pulse bg-amber-500" : syncState === "error" ? "bg-cicopal-red" : "bg-gray-400"}`}
              />
              {syncText}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase text-gray-400">
              {cycle?.status === "hygiene"
                ? "Tempo de higienização"
                : cycle?.status === "awaiting_release"
                  ? "Tempo de liberação"
                  : cycle?.status === "ready"
                    ? "Produção ainda não iniciada"
                    : "Tempo total de produção"}
            </p>
            <p className="text-3xl font-bold tabular-nums text-gray-950">
              {formatElapsed(clockStartedAt, clockNow)}
            </p>
            {cycle?.status === "blocked" && cycle?.activePause ? <p className="mt-1 text-xs font-black uppercase text-cicopal-red">Pausada há {formatElapsed(cycle.activePause.iniciada_em, now)}</p> : null}
          </div>
        </div>
      </section>

      <section className="border border-gray-300 bg-white">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-cicopal-blue">Histórico operacional</p>
            <h3 className="mt-1 text-xl font-bold text-gray-950">Produções deste dia</h3>
            <p className="mt-1 text-sm font-semibold text-gray-500">
              Consulte uma produção já iniciada sem alterar seus registros.
            </p>
          </div>
          <span className="border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-black text-gray-700">
            {dayCycles.length} produção(ões)
          </span>
        </header>
        {dayCycles.length ? (
          <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
            {[...dayCycles].reverse().map((entry) => {
              const isCurrent = cycle?.id === entry.id;
              const ended = entry.status === "ended";
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setViewedCycle(entry)}
                  className={`min-h-28 border-2 p-4 text-left transition active:scale-[.99] ${isCurrent ? "border-cicopal-blue bg-blue-50" : "border-gray-200 bg-white hover:border-blue-300"}`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span>
                      <strong className="block text-lg text-gray-950">{entry.product}</strong>
                      <span className="mt-1 block font-mono text-xs font-bold text-gray-500">{entry.productionCode}</span>
                    </span>
                    <ChevronRight className="shrink-0 text-cicopal-blue" />
                  </span>
                  <span className="mt-3 flex items-center justify-between gap-2 text-xs font-black">
                    <span className={ended ? "text-gray-500" : "text-cicopal-green"}>{ended ? "ENCERRADA" : isCurrent ? "ATUAL" : "EM ANDAMENTO"}</span>
                    <span className="text-gray-500">{new Date(entry.startedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="p-6 text-center font-semibold text-gray-500">Nenhuma produção iniciada nesta data.</p>
        )}
      </section>

      {!cycle ? (
        <section className="rounded-lg border border-gray-300 bg-white p-5">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase text-gray-500">
              Produtos do dia
            </p>
            <h3 className="mt-1 text-xl font-bold text-gray-950">
              Escolha o produto da nova produção
            </h3>
            <p className="mt-1 text-sm font-semibold text-gray-600">
              Nenhum produto vem pré-selecionado. Toque no cartão correto antes
              de continuar.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {products.map((item) => {
              const productions = dayCycles.filter(
                (entry) => entry.product === item,
              );
              const selectedProduct = product === item;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setProduct(item)}
                  className={`min-h-32 rounded-md border-2 p-4 text-left ${selectedProduct ? "border-cicopal-blue bg-blue-50 ring-2 ring-blue-100" : "border-gray-200 bg-white"}`}
                >
                  <span className="block text-lg font-bold text-gray-950">
                    {selectedProduct ? "✓ " : ""}
                    {item}
                  </span>
                  <span className="mt-1 block text-sm font-semibold text-gray-500">
                    {productions.length
                      ? `${productions.length} produção(ões) iniciada(s)`
                      : "Nenhuma produção neste dia"}
                  </span>
                  {productions.map((entry) => (
                    <span
                      key={entry.id}
                      className="mt-2 block rounded bg-white px-2 py-1 text-xs font-bold text-cicopal-blue"
                    >
                      {entry.productionCode ||
                        makeRg003ProductionCode(
                          entry.product,
                          entry.startedAt,
                          1,
                          lineId,
                        )}{" "}
                      ·{" "}
                      {entry.status === "ended" ? "Encerrada" : "Em andamento"}
                    </span>
                  ))}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4">
            <div>
              <p className="text-xs font-bold uppercase text-gray-500">
                Código previsto
              </p>
              <p className="font-bold text-gray-950">
                {product
                  ? makeRg003ProductionCode(
                      product,
                      selectedDayReference,
                      1,
                      lineId,
                    )
                  : "Selecione um produto"}
              </p>
            </div>
            <button
              type="button"
              disabled={!product}
              className="min-h-16 rounded-md bg-cicopal-blue px-6 text-lg font-bold text-white disabled:bg-gray-300 disabled:text-gray-600"
              onClick={() => prepare()}
            >
              {product
                ? `Criar produção de ${product.replace(/^Rosca /, "")}`
                : "Selecione um produto"}
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="rounded-lg border border-gray-300 bg-white p-4">
            <p className="mb-3 text-xs font-bold uppercase text-gray-500">
              1 · Pré-requisitos ·{" "}
              {cycle.productionCode ||
                makeRg003ProductionCode(
                  cycle.product,
                  cycle.startedAt,
                  1,
                  lineId,
                )}
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => onOpenProcess("higienizacao")}
                className={`min-h-24 rounded-md border-2 p-4 text-left ${hygieneDone ? "border-green-300 bg-green-50 text-cicopal-green" : "border-cicopal-blue bg-blue-50 text-cicopal-blue"}`}
              >
                <span className="block text-lg font-bold">
                  {hygieneDone ? "✓ Higienização confirmada" : "Higienização"}
                </span>
                <span className="mt-1 block text-sm font-semibold">
                  {hygieneDone
                    ? "Registro único · toque para visualizar"
                    : "Registro único obrigatório antes de iniciar"}
                </span>
              </button>
              <button
                type="button"
                disabled={!hygieneDone}
                onClick={() => onOpenProcess("produto_liberacao")}
                className={`min-h-24 rounded-md border-2 p-4 text-left ${releaseDone ? "border-green-300 bg-green-50 text-cicopal-green" : hygieneDone ? "border-cicopal-blue bg-blue-50 text-cicopal-blue" : "border-gray-200 bg-gray-100 text-gray-400"}`}
              >
                <span className="block text-lg font-bold">
                  {releaseDone ? "✓ Produto liberado" : "Liberação do produto"}
                </span>
                <span className="mt-1 block text-sm font-semibold">
                  {releaseDone
                    ? "Registro único · toque para visualizar"
                    : hygieneDone
                      ? "Um registro para toda a produção"
                      : "Aguardando higienização"}
                </span>
              </button>
            </div>
          </section>

          <section className="relative rounded-lg border border-gray-300 bg-white p-5">
            <button
              type="button"
              disabled={!cycle}
              aria-label="Registrar não conformidade genérica"
              title="Registrar não conformidade"
              onClick={() => setGenericNcOpen(true)}
              className="absolute right-4 top-4 grid size-14 place-items-center border-2 border-red-200 bg-red-50 text-cicopal-red shadow-sm transition hover:border-cicopal-red hover:bg-red-100 disabled:opacity-30"
            >
              <AlertTriangle size={28} strokeWidth={2.4} />
            </button>
            <p className="text-center text-xs font-bold uppercase text-gray-500">
              2 · Controle da produção
            </p>
            <div className="mt-4 flex items-center justify-center">
              <button
                type="button"
                disabled={!releaseDone && !producing}
                onClick={() =>
                  producing
                    ? setStopOpen(true)
                    : cycle?.status === "blocked" && cycle?.activePause
                      ? setResumeOpen(true)
                    : transition("producing", "Produção iniciada", {
                        productionStartedAt: new Date().toISOString(),
                        activeAction: null,
                      })
                }
                className={`grid size-28 place-items-center rounded-full border-8 text-white shadow-md transition ${producing ? "border-red-100 bg-cicopal-red" : releaseDone ? "border-blue-100 bg-cicopal-blue" : "border-gray-200 bg-gray-300"}`}
              >
                {producing ? (
                  <Square size={38} fill="currentColor" />
                ) : (
                  <Play size={42} fill="currentColor" className="ml-1" />
                )}
              </button>
            </div>
            <p className="mt-3 text-center text-lg font-bold text-gray-900">
              {producing
                ? "Parar produção"
                : cycle?.status === "blocked" && cycle?.activePause
                  ? "Retomar produção"
                : releaseDone
                  ? "Iniciar produção"
                  : "Aguardando pré-requisitos"}
            </p>
            {canCancelPreparation ? (
              <button
                type="button"
                className="mx-auto mt-4 flex min-h-12 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-5 font-bold text-gray-700"
                onClick={() => {
                  setStopMode("cancel");
                  setStopOpen(true);
                }}
              >
                <ArrowLeft size={18} /> Voltar aos produtos
              </button>
            ) : (
              <p className="mt-4 text-center text-xs font-semibold text-gray-500">
                Com a produção iniciada, utilize o botão vermelho para parar.
              </p>
            )}
          </section>

          {genericNcOpen ? (
            <div className="fixed inset-0 z-[100] grid place-items-center bg-black/65 p-4">
              <section className="w-full max-w-2xl border-t-8 border-cicopal-red bg-white shadow-2xl">
                <header className="flex items-start justify-between border-b border-gray-200 p-5">
                  <div>
                    <p className="text-xs font-bold uppercase text-cicopal-red">
                      NC genérica · {cycle.product}
                    </p>
                    <h2 className="mt-1 text-2xl font-bold">
                      Registrar não conformidade
                    </h2>
                    <p className="mt-1 text-sm font-semibold text-gray-500">
                      Linha, produto, técnico, data e hora serão automáticos.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGenericNcOpen(false)}
                    className="size-12 border border-gray-300"
                  >
                    <X size={22} className="mx-auto" />
                  </button>
                </header>
                <div className="grid gap-4 p-5 sm:grid-cols-2">
                  <label>
                    <span className="mb-1 block text-xs font-bold uppercase text-gray-500">
                      Quantidade
                    </span>
                    <input
                      className="min-h-14 w-full border border-gray-300 px-3"
                      value={genericNc.quantidade}
                      onChange={(event) =>
                        setGenericNc((current) => ({
                          ...current,
                          quantidade: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span className="mb-1 block text-xs font-bold uppercase text-gray-500">
                      Ação tomada
                    </span>
                    <select
                      className="min-h-14 w-full border border-gray-300 bg-white px-3"
                      value={genericNc.acao}
                      onChange={(event) =>
                        setGenericNc((current) => ({
                          ...current,
                          acao: event.target.value,
                        }))
                      }
                    >
                      <option value="">Selecionar</option>
                      <option>Corrigir sem parar produção</option>
                      <option>Segregar produto</option>
                      {producing ? <option>Pausar produção</option> : null}
                      {producing ? <option>Parar produção</option> : null}
                    </select>
                  </label>
                  <label className="sm:col-span-2">
                    <span className="mb-1 block text-xs font-bold uppercase text-gray-500">
                      Não conformidade
                    </span>
                    <textarea
                      className="min-h-24 w-full border border-gray-300 p-3"
                      value={genericNc.descricao}
                      onChange={(event) =>
                        setGenericNc((current) => ({
                          ...current,
                          descricao: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="sm:col-span-2">
                    <span className="mb-1 block text-xs font-bold uppercase text-gray-500">
                      Causa
                    </span>
                    <textarea
                      className="min-h-24 w-full border border-gray-300 p-3"
                      value={genericNc.causa}
                      onChange={(event) =>
                        setGenericNc((current) => ({
                          ...current,
                          causa: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="sm:col-span-2">
                    <span className="mb-1 block text-xs font-bold uppercase text-gray-500">Foto antes da ação</span>
                    <span className="flex min-h-16 cursor-pointer items-center justify-center gap-2 border-2 border-dashed border-cicopal-red bg-red-50 font-black text-cicopal-red"><Camera size={21} />{genericNc.fotoAntes ? "Foto registrada" : "Registrar evidência da NC"}<input type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setGenericNc((current) => ({ ...current, fotoAntes: reader.result })); reader.readAsDataURL(file); }} /></span>
                    {genericNc.fotoAntes ? <img src={genericNc.fotoAntes} alt="Evidência antes da ação" className="mt-2 max-h-48 w-full object-contain" /> : null}
                  </label>
                </div>
                <footer className="grid grid-cols-2 gap-3 border-t border-gray-200 p-4">
                  <button
                    type="button"
                    className="border border-gray-300 bg-white font-bold"
                    onClick={() => setGenericNcOpen(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={
                      !genericNc.quantidade ||
                      !genericNc.descricao ||
                      !genericNc.causa ||
                      !genericNc.acao ||
                      !genericNc.fotoAntes
                    }
                    className="bg-cicopal-red font-bold text-white disabled:bg-gray-300"
                    onClick={registerGenericNc}
                  >
                    Registrar NC
                  </button>
                </footer>
              </section>
            </div>
          ) : null}

          <section className="rounded-lg border border-gray-300 bg-white p-4">
            <p className="mb-3 text-xs font-bold uppercase text-gray-500">
              3 · Controles durante a produção
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                ["produto_avaliacao", "Avaliação do produto", "product"],
                ["processo", "Avaliação do processo", "process"],
                ["fotografico", "Registro fotográfico", "photo"],
              ].map(([id, label, type]) => (
                <button
                  key={id}
                  type="button"
                  disabled={!producing}
                  onClick={() => beginHourly(type, label, id)}
                  className={`min-h-20 rounded-md border-2 p-3 font-bold ${producing ? "border-cicopal-blue bg-white text-cicopal-blue" : "border-gray-200 bg-gray-100 text-gray-400"}`}
                >
                  {label}
                  <span className="mt-1 block text-xs font-semibold">
                    {producing
                      ? cycle.activeAction?.type === type
                        ? "Em andamento"
                        : "Disponível"
                      : "Liberado após iniciar"}
                  </span>
                </button>
              ))}
            </div>
          </section>
          {lineId === "ROS" ? (
            <ProductionProcessFlow cycle={cycle} operatorId={operatorId} profileCode={profileCode} />
          ) : null}
        </>
      )}

      {resumeOpen ? (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/65 p-4">
          <section className="w-full max-w-xl border-t-8 border-amber-500 bg-white shadow-2xl">
            <header className="border-b border-gray-200 p-5"><p className="text-xs font-black uppercase text-amber-700">Retomada controlada</p><h2 className="text-2xl font-black">Retomar produção</h2><p className="mt-1 font-semibold text-gray-500">A duração da pausa será calculada automaticamente.</p></header>
            <div className="p-5"><textarea className="min-h-28 w-full border border-gray-300 p-3" placeholder="O que foi feito durante a pausa?" value={resumeData.observacao} onChange={(event) => setResumeData((current) => ({ ...current, observacao: event.target.value }))} /><label className="mt-3 flex min-h-16 cursor-pointer items-center justify-center gap-2 border-2 border-dashed border-cicopal-blue bg-blue-50 font-black text-cicopal-blue"><Camera size={22} />{resumeData.fotoDepois ? "Foto posterior registrada" : "Registrar foto antes de retomar"}<input type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setResumeData((current) => ({ ...current, fotoDepois: reader.result })); reader.readAsDataURL(file); }} /></label>{resumeData.fotoDepois ? <img src={resumeData.fotoDepois} alt="Evidência da retomada" className="mt-3 max-h-52 w-full object-contain" /> : null}</div>
            <footer className="grid grid-cols-2 gap-3 border-t border-gray-200 p-4"><button type="button" className="border border-gray-300 font-bold" onClick={() => setResumeOpen(false)}>Cancelar</button><button type="button" disabled={!resumeData.observacao.trim() || !resumeData.fotoDepois} className="bg-cicopal-green font-black text-white disabled:bg-gray-300" onClick={resumeProduction}>Retomar produção</button></footer>
          </section>
        </div>
      ) : null}

      {viewedCycle ? (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-black/65 p-4">
          <section className="max-h-[92vh] w-full max-w-2xl overflow-y-auto border-t-8 border-cicopal-blue bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-gray-200 p-5">
              <div>
                <p className="text-xs font-black uppercase text-cicopal-blue">Visualização somente leitura</p>
                <h2 className="mt-1 text-2xl font-black text-gray-950">{viewedCycle.product}</h2>
                <p className="mt-1 font-mono text-sm font-bold text-gray-500">{viewedCycle.productionCode}</p>
              </div>
              <button type="button" onClick={() => setViewedCycle(null)} className="grid size-12 shrink-0 place-items-center border border-gray-300"><X size={22} /></button>
            </header>
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              <CycleReadOnlyField label="Situação" value={viewedCycle.status === "ended" ? "Produção encerrada" : viewedCycle.id === cycle?.id ? "Produção atual" : "Em andamento"} />
              <CycleReadOnlyField label="Motivo do início" value={viewedCycle.reason || "Início de produção"} />
              <CycleReadOnlyField label="Início da preparação" value={new Date(viewedCycle.startedAt).toLocaleString("pt-BR")} />
              <CycleReadOnlyField label="Início da produção" value={viewedCycle.productionStartedAt ? new Date(viewedCycle.productionStartedAt).toLocaleString("pt-BR") : "Ainda não iniciada"} />
              <CycleReadOnlyField label="Encerramento" value={viewedCycle.productionEndedAt || viewedCycle.endedAt ? new Date(viewedCycle.productionEndedAt ?? viewedCycle.endedAt).toLocaleString("pt-BR") : "Em andamento"} />
              <CycleReadOnlyField label="Tempo de produção" value={formatElapsed(viewedCycle.productionStartedAt, viewedCycle.productionEndedAt || viewedCycle.endedAt ? new Date(viewedCycle.productionEndedAt ?? viewedCycle.endedAt) : now)} />
            </div>
            <div className="border-t border-gray-200 p-5">
              <p className="mb-3 text-sm font-semibold text-gray-600">Para consultar lotes, bateladas, registros hora a hora, NCs e interrupções, abra o relatório completo.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => setViewedCycle(null)} className="min-h-14 border border-gray-300 bg-white font-bold text-gray-700">Fechar</button>
                <a href="/relatorios" className="flex min-h-14 items-center justify-center gap-2 bg-cicopal-blue px-4 text-center font-black text-white"><FileText size={19} /> Ver relatório completo</a>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {stopOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <section className="w-full max-w-xl overflow-hidden rounded-lg bg-white">
            <header className="brand-header p-4 text-white">
              <p className="text-xs font-bold uppercase text-white/70">
                RG 003 · Controle da produção
              </p>
              <h3 className="mt-1 text-xl font-bold">
                {stopMode === "cancel"
                  ? "Voltar aos produtos"
                  : "Parar produção"}
              </h3>
            </header>
            <div className="p-5">
              {stopMode === "cancel" ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
                  <p className="font-bold text-amber-950">
                    A preparação de {cycle.product} será cancelada.
                  </p>
                  <p className="mt-2 text-sm font-semibold text-amber-800">
                    Os checklists já preenchidos permanecerão no histórico.
                    Nenhuma produção será registrada como iniciada.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      className={`min-h-20 border-2 font-bold ${stopMode === "finish" ? "border-cicopal-blue bg-blue-50 text-cicopal-blue" : "border-gray-200"}`}
                      onClick={() => setStopMode("finish")}
                    >
                      Encerrar produção
                    </button>
                    <button
                      type="button"
                      className={`min-h-20 border-2 font-bold ${stopMode === "change" ? "border-amber-400 bg-amber-50 text-amber-900" : "border-gray-200"}`}
                      onClick={() => setStopMode("change")}
                    >
                      Trocar produto
                    </button>
                  </div>
                  {stopMode === "change" ? (
                    <label className="mt-4 block">
                      <span className="mb-1 block text-xs font-bold uppercase text-gray-500">
                        Próximo produto
                      </span>
                      <select
                        className="min-h-14 w-full border border-gray-300 bg-white px-3 font-bold"
                        value={nextProduct}
                        onChange={(event) => setNextProduct(event.target.value)}
                      >
                        {[
                          "Rosca Leite",
                          "Rosca Coco",
                          "Rosca Chocolate",
                          "Rosca Tradicional",
                        ]
                          .filter((item) => item !== cycle.product)
                          .map((item) => (
                            <option key={item}>{item}</option>
                          ))}
                      </select>
                    </label>
                  ) : null}
                </>
              )}
            </div>
            <footer className="grid grid-cols-2 gap-3 border-t border-gray-200 p-4">
              <button
                type="button"
                className="min-h-14 border border-gray-300 bg-white font-bold"
                onClick={() => setStopOpen(false)}
              >
                Não, continuar
              </button>
              <button
                type="button"
                className="min-h-14 bg-cicopal-red font-bold text-white"
                onClick={stopProduction}
              >
                {stopMode === "cancel"
                  ? "Cancelar preparação e voltar"
                  : stopMode === "change"
                    ? "Parar e preparar troca"
                    : "Confirmar encerramento"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}

export { getShortRegistroId };

function ChecklistMirrorModal({
  registro,
  processoId,
  onClose,
  onOpenRegistro,
}) {
  if (!registro) return null;

  const processo =
    registro.subregistros?.find(
      (subregistro) => subregistro.id === processoId,
    ) ?? registro.subregistros?.[0];
  const ncs = processo?.ncs ?? [];
  const avaliacoes = processo?.avaliacoes ?? [];
  const apontamentos = processo?.apontamentos ?? [];
  const isHigienizacao = processo?.id === "higienizacao";
  const isFotografico = processo?.id === "fotografico";
  const rows = isHigienizacao
    ? checklistGroups.reduce((acc, group) => {
        const groupRows = group.items.map((item) => {
          const nc = ncs.find((entry) => entry.item === item);
          const avaliacao = avaliacoes.find((entry) => entry.item === item);
          return {
            group: group.title,
            item,
            av1: avaliacao?.av1 ?? (nc ? "NC" : "-"),
            av2: avaliacao?.av2 || "-",
            nc,
          };
        });

        return acc.concat(groupRows);
      }, [])
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6">
      <section className="max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-md border-t-[5px] border-cicopal-blue bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4">
          <h2 className="text-2xl font-bold text-cicopal-blue">
            Detalhamento do Registro - RG.005
          </h2>
          <button
            type="button"
            className="inline-flex min-h-10 w-10 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={26} />
          </button>
        </div>

        <div className="max-h-[calc(88vh-80px)] overflow-y-auto bg-gray-50 p-4">
          <div className="mb-4 grid gap-3 rounded-md bg-white p-3 shadow-soft md:grid-cols-5">
            <div>
              <p className="text-xs font-medium uppercase text-gray-500">
                Processo
              </p>
              <p className="text-base font-bold text-gray-950">
                {processo?.nome ?? "Registro"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-gray-500">
                Motivo
              </p>
              <p className="text-base font-bold text-gray-950">
                {registro.motivo ?? registro.tipo}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-gray-500">
                Data/Hora
              </p>
              <p className="text-base font-bold text-gray-950">
                {registro.dataRegistro}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-gray-500">
                Produto
              </p>
              <p className="text-base font-bold text-gray-950">
                {registro.produto ?? "-"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-gray-500">
                {isFotografico ? "Contexto" : "Matriz"}
              </p>
              <p className="text-base font-bold text-gray-950">
                {registro.matriz}
              </p>
            </div>
          </div>

          {isHigienizacao ? (
            <div className="overflow-x-auto rounded-md bg-white p-2">
              <table className="audit-table min-w-[760px] text-left">
                <thead className="bg-gray-900 text-white">
                  <tr>
                    <th className="px-3 py-2">Equipamento / Area</th>
                    <th className="w-28 px-3 py-2 text-center">1 AV</th>
                    <th className="w-28 px-3 py-2 text-center">2 AV</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={`${row.group}-${row.item}`}
                      className={row.nc ? "bg-red-100" : "bg-white"}
                    >
                      <td className="px-3 py-2 font-medium text-gray-950">
                        {row.item}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`audit-badge justify-center ${
                            row.av1 === "NC"
                              ? "bg-cicopal-red text-white"
                              : row.av1 === "C"
                                ? "bg-cicopal-green text-white"
                                : "bg-gray-200 text-gray-600"
                          }`}
                        >
                          {row.av1}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {row.av2 === "-" ? (
                          <span className="font-bold text-gray-500">-</span>
                        ) : (
                          <span className="audit-badge justify-center bg-cicopal-green text-white">
                            {row.av2}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md bg-white p-2">
              <table className="audit-table min-w-[760px] text-left">
                <thead className="bg-gray-900 text-white">
                  <tr>
                    <th className="w-28 px-3 py-2">Horario</th>
                    <th className="px-3 py-2">
                      {isFotografico ? "Foto / Evidencia" : "Item / Controle"}
                    </th>
                    <th className="w-44 px-3 py-2">Operador</th>
                    <th className="w-32 px-3 py-2 text-center">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {apontamentos.length ? (
                    apontamentos.map((apontamento, index) => {
                      const nc = ncs.find(
                        (entry) =>
                          entry.horario === apontamento.horario ||
                          entry.item === apontamento.item,
                      );
                      const resultado =
                        apontamento.resultado ??
                        (apontamento.fotoPath ? "Anexado" : "Pendente");

                      return (
                        <tr
                          key={`${apontamento.horario ?? apontamento.item}-${index}`}
                          className={nc ? "bg-red-100" : "bg-white"}
                        >
                          <td className="px-3 py-2 font-bold text-gray-950">
                            {apontamento.horario ?? "-"}
                          </td>
                          <td className="px-3 py-2 font-medium text-gray-950">
                            {isFotografico
                              ? (apontamento.fotoPath ?? "Foto pendente")
                              : (apontamento.item ??
                                registro.produto ??
                                registro.matriz)}
                          </td>
                          <td className="px-3 py-2">
                            {apontamento.operador ?? registro.operador ?? "-"}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span
                              className={`audit-badge justify-center ${
                                resultado === "NC"
                                  ? "bg-cicopal-red text-white"
                                  : resultado === "Pendente"
                                    ? "bg-gray-200 text-gray-700"
                                    : "bg-cicopal-green text-white"
                              }`}
                            >
                              {resultado}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-8 text-center font-bold text-gray-500"
                      >
                        Nenhum apontamento salvo para este registro.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              className="inline-flex min-h-12 items-center justify-center rounded-md bg-cicopal-blue px-4 font-bold text-white"
              onClick={onOpenRegistro}
            >
              Abrir preenchimento
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function NcDetailModal({ nc, onClose }) {
  if (!nc) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/75 px-4 py-6 backdrop-blur-sm">
      <section className="max-h-[90vh] w-full max-w-4xl overflow-hidden border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b-4 border-cicopal-red bg-gray-950 px-5 py-5 text-white">
          <div><p className="text-xs font-black uppercase tracking-[.16em] text-red-300">Detalhe da não conformidade</p><h2 className="mt-1 text-2xl font-black">{nc.item ?? nc.descricao}</h2><p className="mt-1 font-mono text-xs text-gray-400">{nc.id}</p></div>
          <button
            type="button"
            className="inline-flex min-h-11 w-11 items-center justify-center bg-white/10 text-white hover:bg-white/20"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={26} />
          </button>
        </div>

        <div className="max-h-[calc(90vh-104px)] overflow-y-auto bg-[#f5f6fa] p-5">
          <div className="mb-4 flex flex-wrap gap-2"><span className="bg-red-100 px-3 py-2 text-xs font-black uppercase text-cicopal-red">{nc.status ?? "Aberta"}</span><span className="bg-blue-50 px-3 py-2 text-xs font-black text-cicopal-blue">{nc.linhaNome ?? nc.linhaId ?? "Linha"}</span><span className="bg-white px-3 py-2 text-xs font-black text-gray-600">{nc.dataLabel ?? nc.horario}</span></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Produto", nc.produto],
              ["Data e horário", nc.horario],
              ["Quantidade", nc.quantidade],
              ["Registro", nc.registroId],
              ["Etapa", nc.etapa],
              ["Aberta por", nc.operador],
            ].map(([label, value]) => (
              <div key={label} className="border border-gray-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-bold uppercase text-gray-500">
                  {label}
                </p>
                <p className="mt-1 font-black text-gray-950">{value ?? "—"}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[
              ["Descricao", nc.descricao],
              ["Causa raiz", nc.causa],
              ["Ação tomada", nc.acao_tomada ?? nc.acao],
              ["Disposicao imediata", nc.disposicaoImediata],
              ["Disposicao final", nc.disposicaoFinal],
              [
                "Assinatura supervisor",
                nc.assinaturaSupervisorAt ? "Assinada" : "Pendente",
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                className="border border-gray-200 bg-white p-4"
              >
                <p className="text-xs font-bold uppercase text-gray-500">
                  {label}
                </p>
                <p className="mt-2 font-semibold leading-relaxed text-gray-800">{value ?? "Não informado"}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 border-2 border-dashed border-gray-300 bg-white p-5 text-center">
            <p className="font-bold text-gray-700">Fotos / anexos</p>
            <p className="text-sm font-semibold text-gray-500">
              {nc.fotoPath ?? "Nenhuma foto anexada"}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function RegistroCard({ registro, danger, onPreview }) {
  const processId = getShortRegistroId(registro.id, registro.processoId);

  return (
    <button
      type="button"
      className={`w-full rounded-md border-0 border-t-[5px] bg-white text-left shadow-soft ${
        danger ? "border-cicopal-red" : "border-cicopal-blue"
      }`}
      onClick={onPreview}
    >
      <div className="grid min-h-20 items-center gap-3 px-4 py-3 md:grid-cols-[210px_1.3fr_120px_1.2fr_130px]">
        <div className="text-center">
          <span className="inline-flex min-h-8 items-center rounded-md bg-gray-900 px-3 text-xs font-bold text-white md:text-sm">
            {processId}
          </span>
          {registro.cicloId ? (
            <span className="mt-1 block text-xs font-black text-cicopal-blue">
              {registro.cicloId}
            </span>
          ) : null}
        </div>
        <div>
          <p className="text-lg font-bold text-gray-950">{registro.tipo}</p>
          <p className="text-xs font-semibold text-gray-500">
            {registro.motivo ?? "Motivo nao informado"} -{" "}
            {registro.produto ?? registro.operador ?? "Operador"}
          </p>
        </div>
        <div className="text-center">
          <span className="audit-badge bg-cicopal-blue text-white">
            Turno {registro.turno}
          </span>
        </div>
        <div className="font-bold text-gray-950">{registro.dataRegistro}</div>
        <div className="flex items-center justify-end gap-1 text-sm font-bold text-cicopal-blue">
          VER TUDO <ChevronRight size={18} />
        </div>
      </div>
    </button>
  );
}

function collectNcsFromLote(lote) {
  if (!lote) return [];

  return lote.registros.reduce((acc, registro) => {
    const registroNcs = (registro.subregistros ?? []).reduce(
      (subAcc, subregistro) => {
        const ncs = (subregistro.ncs ?? []).map((nc) => ({
          ...nc,
          registroId: registro.id,
          turno: registro.turno,
          etapa: subregistro.nome,
          subregistroId: subregistro.id,
        }));

        return subAcc.concat(ncs);
      },
      [],
    );

    return acc.concat(registroNcs);
  }, []);
}

function localDateId(value) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function CentralNc({ ncs, onDetail, contextLabel = "Todas as linhas", loading = false }) {
  const openNcs = ncs.filter((nc) =>
    !["fechada", "fechado", "resolvida", "resolvido", "concluida", "concluído"].includes(
      String(nc.status ?? "aberta").toLocaleLowerCase("pt-BR"),
    ),
  );
  if (loading) return <div className="grid min-h-[430px] place-items-center border border-gray-200 bg-white"><span className="inline-flex items-center gap-2 font-bold text-cicopal-blue"><RefreshCw className="animate-spin" /> Carregando não conformidades...</span></div>;
  if (!ncs.length) {
    return (
      <div className="min-h-[430px] rounded-md border border-t-[5px] border-t-cicopal-red bg-white p-4">
        <StageHeader title={`Central de NC · ${contextLabel}`} />
        <div className="rounded-md bg-gray-50 p-8 text-center">
          <CheckCircle2 size={40} className="mx-auto text-cicopal-green" />
          <p className="mt-3 text-xl font-bold text-gray-700">
            Nenhuma NC para o contexto selecionado.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[430px] overflow-hidden border border-t-[5px] border-t-cicopal-red bg-[#f6f7fb]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 bg-white p-5">
        <div><p className="text-xs font-black uppercase tracking-wider text-cicopal-red">Central de NC</p><h2 className="mt-1 text-2xl font-black text-gray-950">{contextLabel}</h2></div>
        <div className="flex gap-2">
          <span className="bg-red-100 px-3 py-2 text-sm font-black text-cicopal-red">{openNcs.length} em aberto</span>
          <span className="bg-gray-100 px-3 py-2 text-sm font-black text-gray-600">{ncs.length} no contexto</span>
        </div>
      </div>
      <div className="grid gap-3 p-4 lg:grid-cols-2">
        {ncs.map((nc) => {
          const open = openNcs.includes(nc);
          return <article key={nc.id} className={`border-l-4 bg-white p-4 shadow-sm ${open ? "border-l-cicopal-red" : "border-l-gray-300 opacity-70"}`}>
            <div className="flex items-start justify-between gap-3"><div className="flex flex-wrap gap-2"><span className={`px-2 py-1 text-xs font-black uppercase ${open ? "bg-red-100 text-cicopal-red" : "bg-gray-100 text-gray-600"}`}>{open ? "Em aberto" : nc.status}</span><span className="bg-blue-50 px-2 py-1 text-xs font-black text-cicopal-blue">{nc.linhaNome ?? nc.linhaId ?? "Linha"}</span><span className="bg-gray-100 px-2 py-1 text-xs font-bold text-gray-600">{nc.dataLabel ?? "Data não informada"}</span></div><button type="button" className="shrink-0 bg-cicopal-red px-3 py-2 text-xs font-black text-white" onClick={() => onDetail(nc)}>DETALHAR</button></div>
            <h3 className="mt-3 text-lg font-black text-gray-950">{nc.item ?? nc.descricao}</h3>
            <p className="mt-1 text-sm font-semibold text-gray-600">{nc.descricao}</p>
            <div className="mt-3 grid gap-2 border-t border-gray-100 pt-3 text-xs font-bold text-gray-500 sm:grid-cols-3"><span>Produto<br/><b className="text-gray-900">{nc.produto ?? "—"}</b></span><span>Etapa<br/><b className="text-gray-900">{nc.etapa ?? "Produção"}</b></span><span>Horário<br/><b className="text-gray-900">{nc.horario ?? "—"}</b></span></div>
          </article>;
        })}
      </div>
    </div>
  );
}

function ProductionOperationsRg({ operatorId, profileCode }) {
  const [cycle, setCycle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const load = () => loadActiveRg003Cycle("ROS").then((result) => { if (!active) return; const remoteCycle = result.cycle ?? JSON.parse(window.localStorage.getItem("carper_rg003_cycle_ROS") ?? "null"); setCycle(remoteCycle); setError(""); setLoading(false); }).catch(() => { if (active) { setError("Não foi possível localizar a produção ativa de Rosca."); setLoading(false); } });
    load();
    const sync = () => load();
    window.addEventListener("rg003-cycle-updated", sync);
    return () => { active = false; window.removeEventListener("rg003-cycle-updated", sync); };
  }, []);
  if (loading) return <div className="min-h-64 animate-pulse bg-gray-100" />;
  if (!cycle) return <section className="border-l-4 border-amber-500 bg-amber-50 p-6"><h2 className="text-xl font-black text-amber-950">Nenhuma produção de Rosca ativa</h2><p className="mt-1 font-semibold text-amber-800">O RG operacional é vinculado à produção iniciada no RG003. Inicie ou selecione uma produção para realizar os apontamentos.</p>{error ? <p className="mt-2 text-sm font-bold">{error}</p> : null}</section>;
  return <div className="space-y-3"><section className="border-l-4 border-cicopal-blue bg-blue-50 p-4"><p className="text-xs font-black uppercase text-cicopal-blue">RG.PROD.ROS.001 · produção vinculada</p><h2 className="text-2xl font-black">{cycle.product}</h2><p className="font-mono text-sm font-bold text-gray-600">{cycle.productionCode}</p></section><ProductionProcessFlow cycle={cycle} operatorId={operatorId} profileCode={profileCode} /></div>;
}

export function HierarchyNavigator({
  tree,
  selection,
  selected,
  onSelectionChange,
  currentStep,
  onStepChange,
  children,
  hideDates = false,
  operatorName = "",
  operatorId = "",
  profileCode = "",
}) {
  const sequentialFlow = isSequentialDocument(
    selection.linhaId,
    selection.documentoId,
  );
  const [monthDate, setMonthDate] = useState(() =>
    getBaseMonth(selection, selected.linha),
  );
  const [activeTab, setActiveTab] = useState("liberacoes");
  const [previewRegistro, setPreviewRegistro] = useState(null);
  const [selectedNc, setSelectedNc] = useState(null);
  const [rg003CycleStatus, setRg003CycleStatus] = useState("");
  const [databaseNcs, setDatabaseNcs] = useState([]);
  const [ncsLoading, setNcsLoading] = useState(false);

  useEffect(() => {
    function syncCycleStatus(event) {
      if (event?.detail !== undefined) {
        setRg003CycleStatus(event.detail?.status ?? "");
        return;
      }
      try {
        setRg003CycleStatus(
          JSON.parse(
            window.localStorage.getItem(
              `carper_rg003_cycle_${selection.linhaId}`,
            ) ?? "null",
          )?.status ?? "",
        );
      } catch {
        setRg003CycleStatus("");
      }
    }
    syncCycleStatus();
    window.addEventListener("rg003-cycle-updated", syncCycleStatus);
    return () =>
      window.removeEventListener("rg003-cycle-updated", syncCycleStatus);
  }, [selection.linhaId]);

  useEffect(() => {
    if (activeTab !== "nc" || !isSupabaseConfigured || !supabase) return;
    let active = true;
    setNcsLoading(true);
    Promise.all([
      supabase.from("ciclos_producao").select("id,linha_id,rg_id,produto,iniciado_em,metadata,rgs(codigo)"),
      supabase.from("ciclo_nao_conformidades").select("*").order("registrada_em", { ascending: false }),
      supabase.from("preenchimentos").select("id,ciclo_id,contexto_tipo,horario,valores,preenchido_em").order("preenchido_em", { ascending: false }),
    ]).then(([cyclesResult, genericResult, fillingsResult]) => {
      if (!active) return;
      const cycles = new Map((cyclesResult.data ?? []).map((cycle) => [cycle.id, cycle]));
      const decorate = (nc, cycle, extra = {}) => {
        const dateId = localDateId(nc.registrada_em ?? extra.preenchido_em ?? cycle?.iniciado_em);
        return {
          ...nc,
          ...extra,
          cycleId: cycle?.id,
          linhaId: cycle?.linha_id,
          linhaNome: { PUR: "Pururuca", SAL: "Salgadinho", ROS: "Rosca" }[cycle?.linha_id] ?? cycle?.linha_id,
          rgCode:
            cycle?.rgs?.codigo ??
            { PUR: "RG.QUA.005", SAL: "RG.QUA.004", ROS: "RG.QUA.BA.003" }[
              cycle?.linha_id
            ],
          produto: nc.produto ?? cycle?.produto,
          dataId: dateId,
          dataLabel: dateId ? formatDateLabel(dateId) : "",
          horario: nc.horario ?? new Date(nc.registrada_em ?? extra.preenchido_em).toLocaleString("pt-BR"),
        };
      };
      const generic = (genericResult.data ?? []).map((nc) => decorate(nc, cycles.get(nc.ciclo_id), { item: nc.descricao, etapa: "Produção" }));
      const embedded = (fillingsResult.data ?? []).flatMap((filling) => {
        const cycle = cycles.get(filling.ciclo_id);
        return (filling.valores?.ncs ?? []).map((nc, index) => decorate(nc, cycle, {
          id: `${filling.id}-${nc.id ?? index}`,
          etapa: filling.contexto_tipo,
          preenchido_em: filling.preenchido_em,
          horario: nc.horario ?? filling.horario,
        }));
      });
      setDatabaseNcs(repairTextDeep([...generic, ...embedded]));
      setNcsLoading(false);
    }).catch(() => {
      if (active) setNcsLoading(false);
    });
    return () => { active = false; };
  }, [activeTab]);

  const datesById = useMemo(() => {
    return new Map(selected.linha?.datas.map((data) => [data.id, data]) ?? []);
  }, [selected.linha]);

  const calendarDays = useMemo(() => makeCalendarDays(monthDate), [monthDate]);
  const monthTitle = monthDate.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  const todayDateId = useMemo(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  }, []);
  const selectedDateLabel = formatDateLabel(selection.dataId);
  const generatedLoteId =
    selected.linha && selection.dataId
      ? generateLoteId(selected.linha.id, selection.dataId)
      : "";
  const documentosDoDia = rgCatalog
    .filter(
      (documento) =>
        !documento.linkedLines?.length ||
        documento.linkedLines.includes(selection.linhaId),
    )
    .map((documento) => {
      const preenchido = selected.data?.documentos.find(
        (item) => item.id === documento.id,
      );
      const loteId = preenchido?.lotes[0]?.id ?? generatedLoteId;
      return { ...documento, loteId };
    });
  const processosDoDocumento = useMemo(() => {
    const processIds = selected.documento?.processos;
    if (!processIds?.length)
      return processCatalog.filter(
        (processo) =>
          !["extrusora_clextral", "batelada_milho"].includes(processo.id),
      );
    return processIds
      .map((processId) =>
        processCatalog.find((processo) => processo.id === processId),
      )
      .filter(Boolean);
  }, [selected.documento]);
  const registrosDoProcesso =
    selected.lote?.registros.filter(
      (registro) => registro.processoId === selection.subregistroId,
    ) ?? [];
  const ncsDoLote = useMemo(
    () => collectNcsFromLote(selected.lote),
    [selected.lote],
  );
  const contextualNcs = useMemo(() => {
    if (!databaseNcs.length) return ncsDoLote;
    return databaseNcs.filter((nc) => {
      if (currentStep >= 2 && selection.linhaId && nc.linhaId !== selection.linhaId) return false;
      if (currentStep >= 3 && selection.dataId && nc.dataId !== selection.dataId) return false;
      if (currentStep >= 4 && selection.documentoId && nc.rgCode && nc.rgCode !== selection.documentoId) return false;
      if (currentStep >= 5 && selection.subregistroId && nc.etapa && nc.etapa !== selection.subregistroId) return false;
      if (currentStep >= 6 && selected.registro?.cicloId && nc.cycleId !== selected.registro.cicloId) return false;
      return true;
    });
  }, [currentStep, databaseNcs, ncsDoLote, selection.dataId, selection.documentoId, selection.linhaId, selection.subregistroId, selected.registro?.cicloId]);
  const ncContextLabel = currentStep === 1
    ? "Todas as linhas"
    : currentStep === 2
      ? `Todas as datas · ${selected.linha?.nome ?? "Linha"}`
      : currentStep === 3
        ? `${selected.linha?.nome ?? "Linha"} · ${selectedDateLabel || "Todas as datas"}`
        : currentStep === 4
          ? `${selection.documentoId || "RG"} · ${selectedDateLabel}`
          : currentStep === 5
            ? `${selected.subregistro?.nome ?? "Processo"} · ${selection.documentoId}`
            : `Registro atual · ${selected.registro?.produto ?? selection.documentoId}`;
  const navigationLabel = {
    1: "Linhas",
    2: `Datas · ${selected.linha?.nome ?? "Linha"}`,
    3: `RGs · ${selectedDateLabel || selected.linha?.nome || "Linha"}`,
    4: `Fluxo · ${selection.documentoId || "RG"}`,
    5: `Registros · ${selected.subregistro?.nome ?? "Processo"}`,
    6: `Preenchimento · ${selected.subregistro?.nome ?? "Registro"}`,
  }[currentStep];

  const canAdvance =
    (currentStep === 1 && Boolean(selected.linha)) ||
    (currentStep === 2 && Boolean(selection.dataId)) ||
    (currentStep === 3 && Boolean(selected.documento)) ||
    (currentStep === 4 && Boolean(selected.subregistro));

  async function goBack() {
    if (currentStep === 6 && sequentialFlow) {
      onStepChange(4);
      return;
    }
    if (currentStep === 4 && sequentialFlow) {
      let activeCycle = null;
      try {
        activeCycle = JSON.parse(
          window.localStorage.getItem(
            `carper_rg003_cycle_${selection.linhaId}`,
          ) ?? "null",
        );
      } catch {
        activeCycle = null;
      }
      if (activeCycle?.status === "producing") return;
      if (activeCycle) {
        try {
          await persistCycleTransition({
            cycle: activeCycle,
            status: "ended",
            description: "Preparação cancelada ao voltar para os produtos",
            operatorId,
            operatorName,
            activeAction: null,
          });
          window.localStorage.removeItem(
            `carper_rg003_cycle_${selection.linhaId}`,
          );
          window.dispatchEvent(
            new CustomEvent("rg003-cycle-updated", { detail: null }),
          );
          return;
        } catch {
          setRg003CycleStatus("sync_error");
          return;
        }
      }
    }
    onStepChange(
      hideDates && currentStep === 3
        ? 1
        : hideDates && currentStep === 6
          ? 4
          : Math.max(1, currentStep - 1),
    );
  }

  function goForward() {
    if (canAdvance) {
      onStepChange(
        hideDates && currentStep === 1 ? 3 : Math.min(6, currentStep + 1),
      );
    }
  }

  function selectLinha(linha) {
    const baseMonth = getBaseMonth({ dataId: linha.datas[0]?.id }, linha);
    setMonthDate(baseMonth);
    const today = new Date();
    const operationalDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    onSelectionChange({
      linhaId: linha.id,
      dataId: hideDates ? operationalDate : "",
      documentoId: "",
      loteId: "",
      registroId: "",
      subregistroId: "",
    });
  }

  function selectDate(dateId) {
    onSelectionChange({
      linhaId: selected.linha?.id ?? "",
      dataId: dateId,
      documentoId: "",
      loteId: "",
      registroId: "",
      subregistroId: "",
    });
  }

  function selectDocumento(documento) {
    const documentoPreenchido = selected.data?.documentos.find(
      (item) => item.id === documento.id,
    );
    const lote = documentoPreenchido?.lotes?.[0];

    onSelectionChange({
      ...selection,
      documentoId: documento.id,
      loteId: lote?.id ?? generatedLoteId,
      registroId: "",
      subregistroId: "",
    });
  }

  function selectRegistro(registro) {
    const hasCurrentProcess = registro.subregistros?.some(
      (subregistro) => subregistro.id === selection.subregistroId,
    );

    onSelectionChange({
      ...selection,
      registroId: registro.id,
      subregistroId: hasCurrentProcess
        ? selection.subregistroId
        : (registro.subregistros?.[0]?.id ?? ""),
    });
  }

  function selectProcesso(processoId) {
    onSelectionChange({
      ...selection,
      subregistroId: processoId,
      registroId: "",
    });
  }

  function novoRegistroProcesso() {
    const prefix = processDisplayPrefixes[selection.subregistroId] ?? "REG";
    const nextNumber = String(registrosDoProcesso.length + 1).padStart(2, "0");
    const rgPrefix = getRgPrefix(selection.documentoId);

    onSelectionChange({
      ...selection,
      registroId: `${rgPrefix}-${selection.loteId}-${prefix}${nextNumber}`,
    });
    onStepChange(6);
  }

  function abrirRegistroTecnico(processoId) {
    const processRecords =
      selected.lote?.registros.filter(
        (registro) => registro.processoId === processoId,
      ) ?? [];
    const prefix = processDisplayPrefixes[processoId] ?? "REG";
    const rgPrefix = getRgPrefix(selection.documentoId);
    let activeCycleId = "CICLO-ATUAL";
    let productionCode = "";
    try {
      const activeCycle = JSON.parse(
        window.localStorage.getItem(
          `carper_rg003_cycle_${selection.linhaId}`,
        ) ?? "null",
      );
      activeCycleId = activeCycle?.id ?? activeCycleId;
      productionCode = activeCycle?.productionCode ?? "";
    } catch {
      /* usa identificador local */
    }
    const existing = processRecords.find(
      (registro) => registro.cicloId === activeCycleId,
    );
    const cycleSuffix = activeCycleId.replace(/[^a-zA-Z0-9]/g, "").slice(-8);
    onSelectionChange({
      ...selection,
      subregistroId: processoId,
      registroId:
        existing?.id ??
        (productionCode
          ? `${productionCode}-${prefix}`
          : `${rgPrefix}-${selection.loteId}-${cycleSuffix}-${prefix}`),
    });
    onStepChange(6);
  }

  function abrirRegistro(registro) {
    selectRegistro(registro);
    onStepChange(6);
  }

  function abrirPreenchimentoDoPreview() {
    if (previewRegistro) {
      selectRegistro(previewRegistro);
      setPreviewRegistro(null);
      onStepChange(6);
    }
  }

  useEffect(() => {
    if (currentStep !== 5 || !sequentialFlow) return;
    onStepChange(4);
  }, [currentStep, selection.documentoId, selection.subregistroId]);

  useEffect(() => {
    function advanceRg003(event) {
      const processId = event.detail?.processId;
      if (processId) abrirRegistroTecnico(processId);
      else onStepChange(4);
    }
    window.addEventListener("rg003-advance-process", advanceRg003);
    return () =>
      window.removeEventListener("rg003-advance-process", advanceRg003);
  });

  return (
    <section
      className={`audit-card p-4 ${currentStep === 6 && sequentialFlow ? "rg-tablet-app" : ""}`}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-l-4 border-cicopal-blue bg-white p-3 shadow-sm">
        <button
          type="button"
          onClick={goBack}
          disabled={currentStep === 1 || (currentStep === 4 && sequentialFlow && rg003CycleStatus === "producing")}
          className="inline-flex min-h-12 items-center gap-2 border border-gray-200 bg-gray-50 px-4 font-black text-gray-700 disabled:opacity-35"
        >
          <ArrowLeft size={19} /> Voltar
        </button>
        <div className="min-w-0 flex-1 text-center"><p className="text-[10px] font-black uppercase tracking-[.16em] text-gray-400">Navegação atual</p><p className="truncate text-lg font-black text-gray-950">{navigationLabel}</p></div>
        <button
          type="button"
          onClick={goForward}
          disabled={currentStep === 6 || !canAdvance}
          className="inline-flex min-h-12 items-center gap-2 bg-cicopal-blue px-4 font-black text-white disabled:bg-gray-300"
        >
          Avançar <ArrowRight size={19} />
        </button>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2 rounded-md bg-gray-100 p-1">
        <button
          type="button"
          className={`rounded-md px-4 py-3 text-base font-bold ${activeTab === "liberacoes" ? "bg-cicopal-blue text-white" : "bg-white text-cicopal-blue"}`}
          onClick={() => setActiveTab("liberacoes")}
        >
          LIBERACOES
        </button>
        <button
          type="button"
          className={`rounded-md px-4 py-3 text-base font-bold ${activeTab === "nc" ? "bg-cicopal-red text-white" : "bg-white text-cicopal-red"}`}
          onClick={() => setActiveTab("nc")}
        >
          CENTRAL DE NC {contextualNcs.length ? ` ${String(contextualNcs.length).padStart(2, "0")}` : ""}
        </button>
      </div>

      {activeTab === "nc" ? (
        <CentralNc
          ncs={contextualNcs}
          contextLabel={ncContextLabel}
          loading={ncsLoading}
          onDetail={setSelectedNc}
        />
      ) : (
        <>
          <Stepper currentStep={currentStep} hideDates={hideDates} />

          <div className="mt-4 min-h-[430px]">
            {currentStep === 1 ? (
              <>
                <StageHeader title="Linhas Disponiveis" />
                <div className="grid gap-3 md:grid-cols-3">
                  {tree.map((linha) => (
                    <CardButton
                      key={linha.id}
                      icon={Factory}
                      selected={linha.id === selected.linha?.id}
                      title={linha.nome}
                      meta={`${linha.datas.length} dias com preenchimento - ${countRegistros(linha)} registros`}
                      onClick={() => selectLinha(linha)}
                      onDoubleTap={() => {
                        selectLinha(linha);
                        onStepChange(hideDates ? 3 : 2);
                      }}
                    />
                  ))}
                </div>
              </>
            ) : null}

            {currentStep === 2 ? (
              <>
                <StageHeader
                  title={`Calendario da Linha ${selected.linha?.nome}`}
                />

                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    className="min-h-14 rounded-md border border-gray-300 bg-white px-4 font-bold text-gray-700"
                    onClick={() =>
                      setMonthDate(
                        new Date(
                          monthDate.getFullYear(),
                          monthDate.getMonth() - 1,
                          1,
                        ),
                      )
                    }
                  >
                    Mes anterior
                  </button>
                  <div className="flex items-center gap-2 text-lg font-bold capitalize text-gray-950">
                    <CalendarDays size={22} className="text-cicopal-blue" />
                    {monthTitle}
                  </div>
                  <button
                    type="button"
                    className="min-h-14 rounded-md border border-gray-300 bg-white px-4 font-bold text-gray-700"
                    onClick={() =>
                      setMonthDate(
                        new Date(
                          monthDate.getFullYear(),
                          monthDate.getMonth() + 1,
                          1,
                        ),
                      )
                    }
                  >
                    Proximo mes
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {weekDays.map((day) => (
                    <div
                      key={day}
                      className="rounded-md bg-gray-100 py-2 text-center text-xs font-bold text-gray-600"
                    >
                      {day}
                    </div>
                  ))}
                  {calendarDays.map((day, index) => {
                    if (!day)
                      return (
                        <div key={`empty-${index}`} className="min-h-16" />
                      );

                    const filledDate = datesById.get(day.dateId);
                    const hasNc = filledDate ? dateHasNc(filledDate) : false;
                    const selectedDay = selection.dataId === day.dateId;
                    const today = todayDateId === day.dateId;
                    const tone = selectedDay
                      ? "border-cicopal-blue bg-cicopal-blue text-white"
                      : hasNc
                        ? "border-cicopal-red bg-red-50 text-cicopal-red"
                        : filledDate
                          ? "border-cicopal-green bg-green-50 text-cicopal-green"
                          : today
                            ? "border-cicopal-blue bg-white text-cicopal-blue ring-2 ring-cicopal-red/30"
                            : "border-gray-200 bg-white text-gray-500";

                    return (
                      <CalendarDateButton
                        key={day.dateId}
                        day={day}
                        tone={tone}
                        filledDate={filledDate}
                        hasNc={hasNc}
                        today={today}
                        onClick={() => selectDate(day.dateId)}
                        onDoubleTap={() => {
                          selectDate(day.dateId);
                          onStepChange(3);
                        }}
                      />
                    );
                  })}
                </div>
              </>
            ) : null}

            {currentStep === 3 ? (
              <>
                <StageHeader title={`RGs do dia ${selectedDateLabel}`} />
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {documentosDoDia.map((documento) => (
                    <CardButton
                      key={documento.id}
                      icon={FileText}
                      selected={documento.id === selected.documento?.id}
                      title={documento.nome}
                      meta={`Lote automatico: ${documento.loteId}`}
                      onClick={() => selectDocumento(documento)}
                      onDoubleTap={() => {
                        selectDocumento(documento);
                        onStepChange(4);
                      }}
                    />
                  ))}
                </div>
              </>
            ) : null}

            {currentStep === 4 ? (
              <>
                <StageHeader
                  title={`Processos - ${selected.lote?.id ?? generatedLoteId}`}
                />
                {selection.documentoId === "RG.PROD.ROS.001" ? (
                  <ProductionOperationsRg operatorId={operatorId} profileCode={profileCode} />
                ) : sequentialFlow ? (
                  <Rg003ProductionControl
                    lineId={selection.linhaId}
                    documentCode={selection.documentoId}
                    dateId={selection.dataId}
                    operatorId={operatorId}
                    operatorName={operatorName}
                    onOpenProcess={abrirRegistroTecnico}
                    operatorOnly={profileCode === "operador"}
                    profileCode={profileCode}
                  />
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {processosDoDocumento.map((processo) => {
                      const registros =
                        selected.lote?.registros.filter(
                          (registro) => registro.processoId === processo.id,
                        ) ?? [];
                      return (
                        <CardButton
                          key={processo.id}
                          icon={ClipboardList}
                          selected={processo.id === selected.subregistro?.id}
                          danger={registros.some((registro) =>
                            registro.subregistros?.some(
                              (subregistro) =>
                                subregistro.id === processo.id &&
                                (subregistro.ncs ?? []).length > 0,
                            ),
                          )}
                          title={processo.nome}
                          meta={`${processo.frequencia} - ${registros.length} registro(s)`}
                          onClick={() => selectProcesso(processo.id)}
                          onDoubleTap={() => {
                            selectProcesso(processo.id);
                            onStepChange(5);
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </>
            ) : null}

            {currentStep === 5 && !sequentialFlow ? (
              <>
                <StageHeader
                  title={`Registros de ${selected.subregistro?.nome ?? "processo"}`}
                />
                {registrosDoProcesso.length ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xl font-bold text-gray-700">
                        <ClipboardList size={22} />
                        <span>REGISTROS</span>
                      </div>
                      <button
                        type="button"
                        className="inline-flex min-h-12 items-center justify-center rounded-md bg-cicopal-blue px-4 text-base font-bold text-white shadow-soft"
                        onClick={novoRegistroProcesso}
                      >
                        NOVO REGISTRO
                      </button>
                    </div>
                    {registrosDoProcesso.map((registro) => (
                      <RegistroCard
                        key={registro.id}
                        registro={registro}
                        danger={registro.subregistros?.some(
                          (subregistro) =>
                            subregistro.id === selection.subregistroId &&
                            (subregistro.ncs ?? []).length > 0,
                        )}
                        onPreview={() => abrirRegistro(registro)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-[1fr_280px]">
                    <div className="rounded-md border border-dashed border-gray-300 bg-white p-5">
                      <p className="text-xl font-bold text-gray-950">
                        Nenhum registro criado
                      </p>
                      <p className="mt-2 text-base font-semibold text-gray-600">
                        Crie um novo registro para este processo.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="inline-flex min-h-24 items-center justify-center rounded-md bg-cicopal-blue px-5 text-xl font-bold text-white shadow-soft"
                      onClick={novoRegistroProcesso}
                    >
                      NOVO REGISTRO
                    </button>
                  </div>
                )}
              </>
            ) : null}

            {currentStep === 6 ? (
              <>
                {hideDates && sequentialFlow ? (
                  <TechnicalRg003StageNav
                    lineId={selection.linhaId}
                    currentProcessId={selection.subregistroId}
                    onOpenProcess={abrirRegistroTecnico}
                  />
                ) : null}
                <StageHeader
                  title={selected.subregistro?.nome}
                  meta={
                    selected.registro
                      ? getShortRegistroId(
                          selected.registro.id,
                          selected.subregistro?.id,
                        )
                      : ""
                  }
                />
                <div className="rg-app-content">{children}</div>
              </>
            ) : null}
          </div>

        </>
      )}
      <ChecklistMirrorModal
        registro={previewRegistro}
        processoId={previewRegistro?.processoId ?? selection.subregistroId}
        onClose={() => setPreviewRegistro(null)}
        onOpenRegistro={abrirPreenchimentoDoPreview}
      />
      <NcDetailModal nc={selectedNc} onClose={() => setSelectedNc(null)} />
    </section>
  );
}
