"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Factory,
  Boxes,
  CookingPot,
  Flame,
  Scissors,
  Pause,
  Play,
  Save,
  Square,
  X,
} from "lucide-react";
import {
  changeSubprocessState,
  ensureProductionSubprocesses,
  ROSCA_SUBPROCESSES,
  saveSubprocessRecord,
} from "@/lib/productionProcessPersistence";
import { ProductionTraceabilitySetup } from "@/components/ProductionTraceabilitySetup";
import { CicopalLogo } from "@/components/CicopalLogo";
import {
  interruptWholeProduction,
  loadProductionTraceability,
  rectifyHourlyRecord,
  resumeWholeProduction,
  saveFixedHourlyRecord,
} from "@/lib/productionTraceabilityPersistence";

const labels = {
  nao_iniciado: "Aguardando",
  operando: "Operando",
  pausado: "Pausado",
  parado: "Parado",
  finalizado: "Finalizado",
};
const fmt = (value) =>
  value
    ? new Date(value).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
const validValue = (value) =>
  value !== undefined && value !== null && value !== "";
function remaining(end, now) {
  const seconds = Math.max(0, Math.ceil((new Date(end) - now) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
function localRows(cycleId) {
  return ROSCA_SUBPROCESSES.map((item, index) => ({
    id: `${cycleId}-${item.code}`,
    ciclo_id: cycleId,
    codigo: item.code,
    nome: item.name,
    ordem: index + 1,
    equipamento: item.equipment,
    status: "nao_iniciado",
    versao: 1,
  }));
}

export function ProductionProcessFlow({ cycle, operatorId, profileCode = "" }) {
  const [rows, setRows] = useState([]);
  const [traceability, setTraceability] = useState(null);
  const [records, setRecords] = useState([]);
  const [remote, setRemote] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [selectedCode, setSelectedCode] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [rectifying, setRectifying] = useState(false);
  const [correctionReason, setCorrectionReason] = useState("");
  const [values, setValues] = useState({});
  const [fieldIndex, setFieldIndex] = useState(0);
  const [review, setReview] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [viewOnly, setViewOnly] = useState(false);
  const [interruptOpen, setInterruptOpen] = useState(false);
  const [workspace, setWorkspace] = useState("overview");
  const selected = rows.find((item) => item.codigo === selectedCode);
  const config = ROSCA_SUBPROCESSES.find((item) => item.code === selectedCode);
  const parameter = config?.parameters[fieldIndex];
  const parameterContext =
    parameter?.group ??
    (parameter?.key?.match(/^maq_(\d+)_/)
      ? `Empacotadora ${parameter.key.match(/^maq_(\d+)_/)[1]}`
      : config?.equipment);
  const rowByCode = (code) => rows.find((item) => item.codigo === code);
  const recordsFor = (code) => {
    const row = rowByCode(code);
    return records
      .filter((item) => item.subprocesso_id === row?.id)
      .sort(
        (a, b) =>
          new Date(b.horario_referencia) - new Date(a.horario_referencia),
      );
  };
  const automationLots = [
    ...new Set(
      recordsFor("automacao")
        .map((item) => item.valores?.lote_acucar)
        .filter(Boolean),
    ),
  ];
  const automationLot = automationLots[0] ?? "";
  const mixerLot = recordsFor("masseira")[0]?.valores?.lote_automacao ?? "";
  const hourlyRecords = records
    .filter((item) => item.tipo === "horario" && item.janela_inicio)
    .sort((a, b) => new Date(b.janela_inicio) - new Date(a.janela_inicio));
  const activeWindow =
    hourlyRecords[0]?.janela_fim && new Date(hourlyRecords[0].janela_fim) > now
      ? hourlyRecords[0]
      : null;
  const lastWindow = hourlyRecords[0] ?? null;
  const windowSeconds = activeWindow
    ? Math.max(0, Math.ceil((new Date(activeWindow.janela_fim) - now) / 1000))
    : 0;
  const windowUrgency = !lastWindow
    ? "neutral"
    : !activeWindow
      ? "late"
      : windowSeconds <= 600
        ? "danger"
        : windowSeconds <= 1200
          ? "warning"
          : "ok";
  const latestSelected = selectedCode ? recordsFor(selectedCode)[0] : null;
  const activeBatch = traceability?.batches?.find(
    (batch) => batch.status === "em_consumo",
  );
  const stations = [
    { id: "prep", label: "Preparação", Icon: CookingPot },
    { id: "cut", label: "Corte a fio", Icon: Scissors },
    { id: "oven", label: "Forno", Icon: Flame },
    { id: "pack", label: "Empacotamento", Icon: Factory },
    { id: "box", label: "Encaixotamento", Icon: Boxes },
  ];
  const canInterrupt = ["qualidade", "admin"].includes(profileCode);
  const openInterruption = traceability?.interruptions?.find(
    (item) => !item.encerrada_em,
  );
  const fixedSlots = useMemo(() => {
    const start = new Date(cycle.productionStartedAt);
    start.setMinutes(0, 0, 0);
    if (start < new Date(cycle.productionStartedAt))
      start.setHours(start.getHours() + 1);
    const end = new Date(now);
    end.setMinutes(0, 0, 0);
    const slots = [];
    for (
      let cursor = new Date(start);
      cursor <= end;
      cursor = new Date(cursor.getTime() + 3600000)
    )
      slots.push(cursor.toISOString());
    return slots;
  }, [cycle.productionStartedAt, now.getHours()]);

  useEffect(() => {
    if (!cycle?.id) return;
    let active = true;
    ensureProductionSubprocesses(cycle.id, operatorId)
      .then((result) => {
        if (!active) return;
        setRows(result.rows.length ? result.rows : localRows(cycle.id));
        setRecords(result.records ?? []);
        setRemote(result.remote);
      })
      .catch(() => {
        if (active) {
          setRows(localRows(cycle.id));
          setRemote(false);
        }
      });
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [cycle?.id, operatorId]);

  useEffect(() => {
    if (!cycle?.id) return;
    loadProductionTraceability(cycle.id)
      .then(setTraceability)
      .catch(() => setTraceability(null));
  }, [cycle?.id]);

  function isUnlocked(code) {
    if (["automacao", "masseira"].includes(code)) return true;
    return Boolean(activeBatch);
  }
  function openProcess(code) {
    if (!isUnlocked(code)) return;
    const cfg = ROSCA_SUBPROCESSES.find((item) => item.code === code);
    const existing = recordsFor(code)[0];
    const processRecords = recordsFor(code);
    const pending = fixedSlots.find(
      (slot) =>
        !processRecords.some((record) => record.horario_previsto === slot),
    );
    const filledWindow =
      cfg?.frequency === "hourly" && !pending && Boolean(existing);
    const sameWindow = cfg?.frequency === "lot" || filledWindow;
    setSelectedCode(code);
    setScheduledAt(pending ?? existing?.horario_previsto ?? "");
    setValues(sameWindow ? (existing?.valores ?? {}) : {});
    setViewOnly(Boolean(filledWindow));
    setRectifying(false);
    setCorrectionReason("");
    setFieldIndex(0);
    setReview(false);
    setReason("");
    setMessage("");
  }
  function nextField() {
    if (!validValue(values[parameter.key]))
      return setMessage("Informe este valor para continuar.");
    setMessage("");
    if (fieldIndex < config.parameters.length - 1)
      setFieldIndex((value) => value + 1);
    else setReview(true);
  }
  async function setStatus(status) {
    if (!selected || saving) return;
    if (status === "operando" && openInterruption) {
      if (!canInterrupt)
        return setMessage("Somente a Qualidade pode retomar a produção.");
      setSaving(true);
      try {
        await resumeWholeProduction({
          cycleId: cycle.id,
          observation: reason || "Retomada confirmada pela Qualidade",
          userId: operatorId,
        });
        setRows((all) =>
          all.map((item) =>
            item.status === "pausado"
              ? {
                  ...item,
                  status: "operando",
                  estado_iniciado_em: new Date().toISOString(),
                }
              : item,
          ),
        );
        setTraceability((current) => ({
          ...current,
          interruptions: current.interruptions.map((item) =>
            item.id === openInterruption.id
              ? { ...item, encerrada_em: new Date().toISOString() }
              : item,
          ),
        }));
        setMessage("Produção e subprocessos retomados.");
      } catch (error) {
        setMessage(error?.message ?? "Não foi possível retomar.");
      } finally {
        setSaving(false);
      }
      return;
    }
    if (["pausado", "parado"].includes(status) && !reason.trim())
      return setMessage("Informe o motivo da interrupção.");
    setSaving(true);
    try {
      const updated = remote
        ? await changeSubprocessState({
            process: selected,
            status,
            reason,
            operatorId,
          })
        : {
            ...selected,
            status,
            iniciado_em:
              status === "operando"
                ? (selected.iniciado_em ?? new Date().toISOString())
                : selected.iniciado_em,
            estado_iniciado_em: new Date().toISOString(),
            versao: selected.versao + 1,
          };
      setRows((all) =>
        all.map((item) =>
          item.id === selected.id ? { ...item, ...updated } : item,
        ),
      );
      setReason("");
    } catch (error) {
      setMessage(error?.message ?? "Não foi possível alterar a operação.");
    } finally {
      setSaving(false);
    }
  }
  async function confirm() {
    if (config.parameters.some((item) => !validValue(values[item.key])))
      return setMessage("Há informações pendentes.");
    if (rectifying && correctionReason.trim().length < 5)
      return setMessage("Explique o motivo da retificação.");
    setSaving(true);
    setMessage("");
    try {
      let process = selected;
      if (config.frequency === "hourly" && selected.status === "nao_iniciado") {
        const started = remote
          ? await changeSubprocessState({
              process: selected,
              status: "operando",
              reason: "Primeiro apontamento horário",
              operatorId,
            })
          : {
              ...selected,
              status: "operando",
              iniciado_em: new Date().toISOString(),
              estado_iniciado_em: new Date().toISOString(),
              versao: selected.versao + 1,
            };
        process = { ...selected, ...started };
        setRows((all) =>
          all.map((item) => (item.id === selected.id ? process : item)),
        );
      }
      const saved = remote
        ? rectifying
          ? await rectifyHourlyRecord({
              recordId: latestSelected.id,
              values,
              reason: correctionReason,
              userId: operatorId,
            })
          : config.frequency === "hourly"
            ? await saveFixedHourlyRecord({
                processId: process.id,
                cycleId: cycle.id,
                scheduledAt,
                values,
                batchId: activeBatch?.id ?? null,
                userId: operatorId,
              })
            : await saveSubprocessRecord({
                process,
                cycleId: cycle.id,
                values,
                operatorId,
                frequency: config.frequency,
              })
        : {
            id: Date.now(),
            subprocesso_id: process.id,
            tipo: config.frequency === "lot" ? "lote" : "horario",
            janela_indice:
              config.frequency === "lot"
                ? recordsFor(config.code).length
                : (activeWindow?.janela_indice ?? 0),
            horario_referencia: new Date().toISOString(),
            janela_inicio: new Date().toISOString(),
            janela_fim:
              config.frequency === "lot"
                ? null
                : (activeWindow?.janela_fim ??
                  new Date(Date.now() + 3600000).toISOString()),
            valores: values,
            preenchido_em: new Date().toISOString(),
          };
      setRecords((all) => [
        ...all.filter(
          (item) =>
            !(
              item.subprocesso_id === saved.subprocesso_id &&
              item.tipo === saved.tipo &&
              item.janela_indice === saved.janela_indice
            ),
        ),
        saved,
      ]);
      setMessage("Apontamento confirmado e vinculado à produção.");
      setReview(false);
      setRectifying(false);
      setCorrectionReason("");
    } catch (error) {
      setMessage(error?.message ?? "Não foi possível confirmar.");
    } finally {
      setSaving(false);
    }
  }
  function projection(metric) {
    return (
      (Number(values[metric.key]) || 0) / (metric.divisor ?? 1)
    ).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  }

  function processButton(item, nested = false) {
    const row = rowByCode(item.code);
    const latest = recordsFor(item.code)[0];
    const pendingCount = fixedSlots.filter(
      (slot) =>
        !recordsFor(item.code).some(
          (record) => record.horario_previsto === slot,
        ),
    ).length;
    const filledCurrent =
      activeWindow && latest?.janela_indice === activeWindow.janela_indice;
    const unlocked = isUnlocked(item.code);
    const pendingTone =
      windowUrgency === "late" || windowUrgency === "danger"
        ? "border-red-600 bg-red-50"
        : windowUrgency === "warning"
          ? "border-amber-500 bg-amber-50"
          : "border-cicopal-blue bg-white";
    return (
      <button
        key={item.code}
        disabled={!unlocked}
        onClick={() => openProcess(item.code)}
        className={`min-h-28 border-l-4 p-4 text-left shadow-sm ${nested ? "bg-white" : ""} ${filledCurrent ? "border-green-500 bg-green-50" : unlocked ? pendingTone : "border-gray-200 bg-gray-50 opacity-50"}`}
      >
        <div className="flex justify-between gap-2">
          <span>
            <b className="block text-lg">{item.name}</b>
            <small className="font-bold text-gray-500">{item.equipment}</small>
          </span>
          <span
            className={`h-fit px-2 py-1 text-[10px] font-black uppercase ${filledCurrent ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600"}`}
          >
            {pendingCount ? `${pendingCount} pendente(s)` : "Em dia"}
          </span>
        </div>
        <p className="mt-2 text-sm font-semibold text-gray-500">
          {!unlocked
            ? "Finalize uma batelada na Masseira"
            : latest
              ? `Resultado anterior · ${fmt(latest.preenchido_em)}`
              : "Sem resultado anterior · início em zero"}
        </p>
        <small className="mt-2 block font-black uppercase text-gray-500">
          {labels[row?.status ?? "nao_iniciado"]}
        </small>
      </button>
    );
  }

  if (!cycle?.productionStartedAt)
    return (
      <section className="border bg-gray-50 p-6 text-center">
        <Factory className="mx-auto text-gray-400" />
        <h3 className="mt-2 text-lg font-black">Apontamentos da produção</h3>
        <p className="font-semibold text-gray-500">
          Disponíveis após iniciar a produção.
        </p>
      </section>
    );
  return (
    <div className="space-y-5 bg-slate-50 p-2 sm:p-4">
      <header className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <CicopalLogo className="h-10 w-auto" />
          <nav
            className="flex items-center gap-2 text-sm font-light text-slate-500"
            aria-label="Caminho de navegação"
          >
            <span>Processos</span>
            <ChevronRight size={16} />
            <strong className="font-bold text-slate-800">
              {cycle.productionCode}
            </strong>
          </nav>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-lg bg-slate-100 p-4">
          <div>
            <p className="text-sm font-light text-slate-500">
              Produto em produção
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">
              {cycle.product}
            </h1>
          </div>
          <div className="text-right">
            <p className="text-sm font-light text-slate-500">
              Batelada em consumo
            </p>
            <strong className="mt-1 block text-lg font-bold text-cicopal-blue">
              {activeBatch ? `Batelada ${activeBatch.numero}` : "Não iniciada"}
            </strong>
          </div>
        </div>
      </header>
      {workspace === "overview" ? (
        <section className="border border-gray-200 bg-white p-4 sm:p-5">
          <p className="text-sm font-light text-slate-500">
            Produção integrada
          </p>
          <h2 className="mt-1 text-2xl font-bold">Escolha sua área</h2>
          <p className="mt-1 font-light text-gray-500">
            Abra somente a estação que será preenchida agora.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {stations.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setWorkspace(id)}
                className="group min-h-32 rounded-lg border border-slate-200 bg-white p-4 text-left font-bold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-cicopal-blue hover:shadow-md active:scale-[.98]"
              >
                <span className="mb-4 grid size-11 place-items-center rounded-lg bg-blue-50 text-cicopal-blue transition group-hover:bg-cicopal-blue group-hover:text-white">
                  <Icon size={22} />
                </span>
                <span className="block leading-tight">{label}</span>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className="sticky top-2 z-30 flex min-h-16 items-center gap-3 border border-blue-100 bg-white p-3 shadow-lg">
          <button
            type="button"
            onClick={() => setWorkspace("overview")}
            className="grid size-12 shrink-0 place-items-center bg-cicopal-blue text-white"
          >
            <ChevronLeft />
          </button>
          <div>
            <p className="text-xs font-black uppercase text-cicopal-blue">
              Estação de trabalho
            </p>
            <h2 className="text-xl font-black">
              {workspace === "prep"
                ? "Preparação"
                : workspace === "cut"
                  ? "Corte a fio"
                  : workspace === "oven"
                    ? "Forno"
                    : workspace === "pack"
                      ? "Empacotamento"
                      : "Encaixotamento"}
            </h2>
          </div>
        </section>
      )}
      {workspace === "prep" ? (
        <ProductionTraceabilitySetup
          cycle={cycle}
          operatorId={operatorId}
          onChange={setTraceability}
          mode="prep"
        />
      ) : null}
      {workspace === "pack" ? (
        <ProductionTraceabilitySetup
          cycle={cycle}
          operatorId={operatorId}
          onChange={setTraceability}
          mode="pack"
        />
      ) : null}
      {workspace === "overview" ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <p className="text-sm font-light text-slate-500">
            Acompanhamento geral
          </p>
          <h3 className="mb-4 text-xl font-bold">Situação da produção</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <button
              type="button"
              onClick={() => setWorkspace("prep")}
              className="min-h-32 rounded-lg border border-violet-200 bg-white p-4 text-left shadow-sm transition hover:shadow-md"
            >
              <b className="block text-lg font-bold">Preparação</b>
              <span className="mt-1 block text-sm font-light text-slate-500">
                Automação · Masseira · Bateladas
              </span>
              <span
                className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold ${activeBatch ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}
              >
                {activeBatch
                  ? `Batelada ${activeBatch.numero} em consumo`
                  : "Sem batelada em consumo"}
              </span>
              <small className="mt-3 block font-light text-gray-500">
                Toque para visualizar
              </small>
            </button>
            {ROSCA_SUBPROCESSES.map((item) => {
              const row = rowByCode(item.code);
              const latest = recordsFor(item.code)[0];
              return (
                <button
                  type="button"
                  onClick={() =>
                    setWorkspace(
                      ["automacao", "masseira"].includes(item.code)
                        ? "prep"
                        : item.code === "corte_fio"
                          ? "cut"
                          : item.code === "forno"
                            ? "oven"
                            : ["detector_metal", "empacotamento"].includes(
                                  item.code,
                                )
                              ? "pack"
                              : "box",
                    )
                  }
                  key={item.code}
                  className="min-h-32 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md"
                >
                  <b className="block text-lg font-bold">{item.name}</b>
                  <span
                    className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold ${row?.status === "operando" ? "bg-green-100 text-green-800" : ["parado", "pausado"].includes(row?.status) ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-600"}`}
                  >
                    {labels[row?.status ?? "nao_iniciado"]}
                  </span>
                  <small className="mt-3 block font-light text-gray-500">
                    {latest
                      ? `Último registro ${fmt(latest.preenchido_em)}`
                      : "Sem registro"}
                  </small>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}
      {!["prep", "overview"].includes(workspace) ? (
        <section className="border border-gray-300 bg-white p-4 sm:p-5">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase text-cicopal-blue">
                RG.PROD.ROS.001 · produção interligada
              </p>
              <h2 className="text-2xl font-black">Apontamentos do processo</h2>
              <p className="mt-1 font-semibold text-gray-600">
                Informe leituras das máquinas. As projeções por minuto são
                calculadas pelo sistema.
              </p>
            </div>
            {activeWindow ? (
              <div
                className={`border-l-4 px-4 py-3 ${windowUrgency === "danger" ? "border-red-600 bg-red-50 text-red-700" : windowUrgency === "warning" ? "border-amber-500 bg-amber-50 text-amber-800" : "border-cicopal-blue bg-blue-50 text-cicopal-blue"}`}
              >
                <small className="block font-black uppercase">
                  Janela atual · {fmt(activeWindow.janela_inicio)}–
                  {fmt(activeWindow.janela_fim)}
                </small>
                <b className="font-mono text-xl">
                  {remaining(activeWindow.janela_fim, now)}
                </b>
                <span className="ml-2 text-xs font-bold">até a próxima</span>
              </div>
            ) : lastWindow ? (
              <div className="animate-pulse border-l-4 border-red-600 bg-red-50 px-4 py-3 text-red-700">
                <small className="block font-black uppercase">
                  Nova atualização disponível
                </small>
                <b>Apontamentos pendentes</b>
              </div>
            ) : (
              <div className="bg-gray-100 px-4 py-3 text-sm font-bold text-gray-600">
                O primeiro apontamento abrirá a janela de 60 min
              </div>
            )}
          </header>

          <div className="mt-6 grid gap-5">
            <section className="hidden">
              <p className="mb-2 text-xs font-black uppercase text-gray-500">
                1 · Preparação dos lotes
              </p>
              <div className="space-y-2">
                {ROSCA_SUBPROCESSES.slice(0, 2).map((item, index) => {
                  const done = index === 0 ? automationLot : mixerLot;
                  const unlocked = isUnlocked(item.code);
                  return (
                    <button
                      key={item.code}
                      disabled={!unlocked}
                      onClick={() => openProcess(item.code)}
                      className={`flex min-h-20 w-full items-center gap-3 border p-3 text-left ${done ? "border-green-400 bg-green-50" : unlocked ? "border-cicopal-blue bg-blue-50" : "border-gray-200 bg-gray-50 opacity-50"}`}
                    >
                      <span
                        className={`grid h-10 w-10 shrink-0 place-items-center font-black ${done ? "bg-green-600 text-white" : "bg-white text-cicopal-blue"}`}
                      >
                        {done ? <Check /> : index + 1}
                      </span>
                      <span>
                        <b className="block">{item.name}</b>
                        <small className="font-semibold text-gray-600">
                          {done
                            ? `Lote ${done}`
                            : unlocked
                              ? "Preencher lote"
                              : "Aguardando lote da Automação"}
                        </small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
            <section>
              <div className="mb-2 flex items-end justify-between">
                <p className="text-xs font-black uppercase text-gray-500">
                  2 · Leituras da janela de 60 minutos
                </p>
                <small className="font-bold text-gray-500">
                  Confirmados não podem ser alterados
                </small>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {["overview", "cut"].includes(workspace)
                  ? processButton(
                      ROSCA_SUBPROCESSES.find(
                        (item) => item.code === "corte_fio",
                      ),
                    )
                  : null}
                {["overview", "oven"].includes(workspace)
                  ? processButton(
                      ROSCA_SUBPROCESSES.find((item) => item.code === "forno"),
                    )
                  : null}
                {["overview", "pack"].includes(workspace) ? (
                  <section className="border border-blue-200 bg-blue-50 p-3 sm:col-span-2">
                    <div className="mb-3">
                      <p className="text-xs font-black uppercase text-cicopal-blue">
                        Processo
                      </p>
                      <h3 className="text-xl font-black">Empacotamento</h3>
                      <p className="text-sm font-semibold text-gray-600">
                        Detecção de metais e empacotadoras fazem parte deste
                        processo.
                      </p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {processButton(
                        ROSCA_SUBPROCESSES.find(
                          (item) => item.code === "detector_metal",
                        ),
                        true,
                      )}
                      {processButton(
                        ROSCA_SUBPROCESSES.find(
                          (item) => item.code === "empacotamento",
                        ),
                        true,
                      )}
                    </div>
                  </section>
                ) : null}
                {["overview", "box"].includes(workspace)
                  ? processButton(
                      ROSCA_SUBPROCESSES.find(
                        (item) => item.code === "encaixotamento",
                      ),
                    )
                  : null}
              </div>
            </section>
          </div>

          {selected && config ? (
            <div className="fixed inset-0 z-[100] bg-slate-950/70 p-0 sm:grid sm:place-items-center sm:p-3">
              <article className="flex h-dvh w-full flex-col bg-white sm:h-[94dvh] sm:max-w-3xl">
                <header className="shrink-0 border-b bg-white p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase text-cicopal-blue">
                        {config.frequency === "lot"
                          ? "Lote vigente na produção"
                          : `Horário de referência ${scheduledAt ? new Date(scheduledAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—"}`}
                      </p>
                      <h3 className="text-2xl font-black">{config.name}</h3>
                    </div>
                    <button
                      onClick={() => setSelectedCode("")}
                      className="grid h-11 w-11 place-items-center bg-gray-100"
                    >
                      <X />
                    </button>
                  </div>
                  {!viewOnly && !review ? (
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="bg-blue-50 px-3 py-2 text-xs font-black uppercase text-cicopal-blue">
                        {parameterContext}
                      </span>
                      <span className="text-sm font-black text-gray-500">
                        {fieldIndex + 1}/{config.parameters.length}
                      </span>
                    </div>
                  ) : null}
                  {selectedCode === "forno" && !viewOnly && !review ? (
                    <nav
                      className="mt-3 flex gap-2 overflow-x-auto pb-1"
                      aria-label="Áreas do forno"
                    >
                      {[
                        { label: "Geral", index: 0, active: fieldIndex < 3 },
                        ...Array.from({ length: 7 }, (_, index) => ({
                          label: `Zona ${index + 1}`,
                          index: 3 + index * 2,
                          active: parameter?.group === `Zona ${index + 1}`,
                        })),
                      ].map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => setFieldIndex(item.index)}
                          className={`min-h-11 shrink-0 px-4 text-sm font-bold ${item.active ? "bg-cicopal-blue text-white" : "bg-slate-100 text-slate-600"}`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </nav>
                  ) : null}
                  {selectedCode === "encaixotamento" && !viewOnly && !review ? (
                    <nav
                      className="mt-3 grid grid-cols-2 gap-2"
                      aria-label="Encaixotadeiras"
                    >
                      {[1, 2].map((machine, index) => (
                        <button
                          key={machine}
                          type="button"
                          onClick={() => setFieldIndex(index)}
                          className={`min-h-12 px-3 text-sm font-bold ${parameter?.group === `Encaixotadeira ${machine}` ? "bg-cicopal-blue text-white" : "bg-slate-100 text-slate-600"}`}
                        >
                          Encaixotadeira {machine}
                        </button>
                      ))}
                    </nav>
                  ) : null}
                </header>
                <div className="flex-1 overflow-y-auto overscroll-contain p-4 pb-8 sm:p-6">
                  {viewOnly ? (
                    <section>
                      <p className="text-xs font-black uppercase text-green-700">
                        Resultado confirmado · somente leitura
                      </p>
                      <h4 className="mt-1 text-2xl font-black">
                        Apontamento desta janela
                      </h4>
                      <div className="mt-5 divide-y border">
                        {config.parameters.map((item) => (
                          <div
                            key={item.key}
                            className="flex min-h-16 items-center justify-between gap-4 p-3"
                          >
                            <span className="font-bold text-gray-600">
                              {item.label}
                            </span>
                            <b>
                              {values[item.key]} {item.unit}
                            </b>
                          </div>
                        ))}
                      </div>
                      <p className="mt-4 border-l-4 border-cicopal-blue bg-blue-50 p-3 font-bold text-cicopal-blue">
                        O original está protegido. Para corrigir, faça uma
                        retificação auditada.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setViewOnly(false);
                          setRectifying(true);
                          setReview(false);
                        }}
                        className="mt-3 min-h-14 w-full border-2 border-amber-500 bg-amber-50 font-black text-amber-900"
                      >
                        Retificar este registro
                      </button>
                    </section>
                  ) : !review ? (
                    <>
                      <div className="mb-6 flex gap-1">
                        {config.parameters.map((item, index) => (
                          <span
                            key={item.key}
                            className={`h-1.5 flex-1 ${index <= fieldIndex ? "bg-cicopal-blue" : "bg-gray-200"}`}
                          />
                        ))}
                      </div>
                      <p className="text-xs font-black uppercase text-gray-500">
                        Informação {fieldIndex + 1} de{" "}
                        {config.parameters.length}
                      </p>
                      <h4 className="mt-2 text-2xl font-black">
                        {parameter.label}
                      </h4>
                      {parameter.hint ? (
                        <p className="mt-2 font-semibold text-gray-600">
                          {parameter.hint}
                        </p>
                      ) : null}
                      {latestSelected?.valores?.[parameter.key] !== undefined &&
                      !rectifying ? (
                        <div className="mt-4 flex items-center justify-between bg-gray-100 p-3">
                          <span className="text-xs font-black uppercase text-gray-500">
                            Resultado anterior
                          </span>
                          <b className="text-lg text-gray-800">
                            {latestSelected.valores[parameter.key]}{" "}
                            {parameter.unit}
                          </b>
                        </div>
                      ) : null}
                      <div className="mt-7">
                        {parameter.type === "options" ? (
                          <div className="grid grid-cols-3 gap-3">
                            {parameter.options.map((option) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() =>
                                  setValues((all) => ({
                                    ...all,
                                    [parameter.key]: option,
                                  }))
                                }
                                className={`min-h-20 border-2 text-2xl font-black ${values[parameter.key] === option ? (option === "NC" ? "border-red-600 bg-red-50 text-red-700" : option === "NA" ? "border-gray-500 bg-gray-100" : "border-green-600 bg-green-50 text-green-700") : "border-gray-200"}`}
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                        ) : parameter.type === "automation-lot" ? (
                          <div className="grid gap-2">
                            {automationLots.map((lot) => (
                              <button
                                key={lot}
                                onClick={() =>
                                  setValues((all) => ({
                                    ...all,
                                    [parameter.key]: lot,
                                  }))
                                }
                                className={`min-h-20 border-2 p-4 text-left ${values[parameter.key] === lot ? "border-cicopal-blue bg-blue-50" : "border-gray-300"}`}
                              >
                                <small className="font-black uppercase text-gray-500">
                                  Registrado na Automação
                                </small>
                                <b className="mt-1 block text-xl">{lot}</b>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="flex border-2 border-gray-300 focus-within:border-cicopal-blue">
                            {parameter.type !== "text" ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setValues((all) => ({
                                    ...all,
                                    [parameter.key]: Math.max(
                                      0,
                                      (Number(all[parameter.key]) || 0) - 1,
                                    ),
                                  }))
                                }
                                className="min-w-16 border-r bg-gray-100 text-3xl font-black"
                                aria-label={`Diminuir ${parameter.label}`}
                              >
                                −
                              </button>
                            ) : null}
                            <input
                              autoFocus
                              type={
                                parameter.type === "text" ? "text" : "number"
                              }
                              inputMode={
                                parameter.type === "text" ? "text" : "decimal"
                              }
                              value={values[parameter.key] ?? ""}
                              onChange={(event) =>
                                setValues((all) => ({
                                  ...all,
                                  [parameter.key]: event.target.value,
                                }))
                              }
                              className="min-h-24 min-w-0 flex-1 px-4 text-center text-4xl font-black outline-none"
                            />
                            {parameter.type !== "text" ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setValues((all) => ({
                                    ...all,
                                    [parameter.key]:
                                      (Number(all[parameter.key]) || 0) + 1,
                                  }))
                                }
                                className="min-w-16 border-l bg-gray-100 text-3xl font-black"
                                aria-label={`Aumentar ${parameter.label}`}
                              >
                                +
                              </button>
                            ) : null}
                            {parameter.unit ? (
                              <span className="grid min-w-28 place-items-center bg-gray-100 px-3 font-black text-gray-600">
                                {parameter.unit}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-xs font-black uppercase text-green-700">
                        Revisão antes de confirmar
                      </p>
                      <h4 className="mt-1 text-2xl font-black">
                        Confira as leituras
                      </h4>
                      <div className="mt-5 divide-y border">
                        {config.parameters.map((item) => (
                          <button
                            key={item.key}
                            onClick={() => {
                              setFieldIndex(config.parameters.indexOf(item));
                              setReview(false);
                            }}
                            className="flex min-h-16 w-full items-center justify-between gap-4 p-3 text-left"
                          >
                            <span className="font-bold text-gray-600">
                              {item.label}
                            </span>
                            <b>
                              {values[item.key]} {item.unit}
                            </b>
                          </button>
                        ))}
                      </div>
                      {rectifying ? (
                        <label className="mt-4 block">
                          <span className="mb-1 block text-xs font-black uppercase text-amber-800">
                            Justificativa obrigatória da retificação
                          </span>
                          <textarea
                            value={correctionReason}
                            onChange={(event) =>
                              setCorrectionReason(event.target.value)
                            }
                            className="min-h-24 w-full border-2 border-amber-400 p-3"
                            placeholder="Explique por que o valor original precisa ser corrigido"
                          />
                        </label>
                      ) : null}
                      {config.liveMetrics?.length ? (
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          {config.liveMetrics.map((metric) => (
                            <div
                              key={metric.key}
                              className="bg-slate-950 p-4 text-white"
                            >
                              <small className="font-black uppercase text-slate-400">
                                {metric.label}
                              </small>
                              <b className="mt-1 block text-2xl">
                                {projection(metric)}{" "}
                                <span className="text-sm">{metric.unit}</span>
                              </b>
                              {metric.divisor ? (
                                <small className="text-slate-400">
                                  Calculado automaticamente
                                </small>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </>
                  )}
                  {message ? (
                    <p className="mt-4 bg-amber-50 p-3 font-bold text-amber-900">
                      <AlertTriangle className="mr-2 inline" size={18} />
                      {message}
                    </p>
                  ) : null}
                  {config.frequency === "hourly" &&
                  selected.status !== "nao_iniciado" ? (
                    <div className="mt-5 border-t pt-4">
                      <p className="mb-2 text-xs font-black uppercase text-gray-500">
                        Estado desta área
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setStatus("operando")}
                          className="min-h-12 bg-green-600 font-black text-white"
                        >
                          <Play className="mx-auto" size={17} />
                          Operando
                        </button>
                        <button
                          disabled={!canInterrupt}
                          onClick={() => setInterruptOpen(true)}
                          className="min-h-12 bg-red-600 font-black text-white disabled:bg-gray-300"
                        >
                          <Pause className="mx-auto" size={17} />
                          {canInterrupt
                            ? "Interromper produção"
                            : "Interrupção · Qualidade"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
                <footer className="sticky bottom-0 grid shrink-0 grid-cols-[auto_1fr] gap-2 border-t bg-white p-3 shadow-[0_-8px_24px_rgba(15,23,42,.08)] sm:p-4">
                  <button
                    onClick={() =>
                      review
                        ? setReview(false)
                        : fieldIndex
                          ? setFieldIndex((value) => value - 1)
                          : setSelectedCode("")
                    }
                    className="flex min-h-16 items-center justify-center gap-2 border px-5 font-black"
                  >
                    <ChevronLeft />
                    Voltar
                  </button>
                  {viewOnly ? (
                    <button
                      onClick={() => setSelectedCode("")}
                      className="flex min-h-16 items-center justify-center bg-cicopal-blue px-5 font-black text-white"
                    >
                      Fechar resultado
                    </button>
                  ) : review ? (
                    <button
                      disabled={saving}
                      onClick={confirm}
                      className="flex min-h-16 items-center justify-center gap-2 bg-green-600 px-5 font-black text-white"
                    >
                      <Save />
                      Confirmar apontamento
                    </button>
                  ) : (
                    <button
                      onClick={nextField}
                      className="flex min-h-16 items-center justify-center gap-2 bg-cicopal-blue px-5 font-black text-white"
                    >
                      Continuar
                      <ChevronRight />
                    </button>
                  )}
                </footer>
              </article>
            </div>
          ) : null}
          {interruptOpen ? (
            <div className="fixed inset-0 z-[120] grid place-items-center bg-black/70 p-3">
              <section className="w-full max-w-lg border-t-8 border-red-600 bg-white shadow-2xl">
                <header className="flex items-start justify-between border-b p-5">
                  <div>
                    <p className="text-xs font-black uppercase text-red-600">
                      Interrupção · {config?.name}
                    </p>
                    <h3 className="text-2xl font-black">
                      Por que a operação foi interrompida?
                    </h3>
                  </div>
                  <button
                    onClick={() => setInterruptOpen(false)}
                    className="grid size-11 place-items-center bg-gray-100"
                  >
                    <X />
                  </button>
                </header>
                <div className="p-5">
                  <div className="grid gap-2">
                    {[
                      "Defeito identificado",
                      "Manutenção corretiva",
                      "Falta de matéria-prima",
                      "Ajuste de máquina",
                      "Falta de operador",
                      "Limpeza não programada",
                      "Outro motivo",
                    ].map((option) => (
                      <button
                        key={option}
                        onClick={() => setReason(option)}
                        className={`min-h-14 border-2 p-3 text-left font-black ${reason === option ? "border-red-600 bg-red-50 text-red-700" : "border-gray-200"}`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    className="mt-3 min-h-24 w-full border p-3"
                    placeholder="Descreva o motivo ou complemente a opção"
                  />
                  <p className="mt-2 text-sm font-semibold text-gray-500">
                    O tempo parado será contado até a retomada desta operação.
                  </p>
                </div>
                <footer className="grid grid-cols-2 gap-2 border-t p-4">
                  <button
                    onClick={() => setInterruptOpen(false)}
                    className="min-h-14 border font-black"
                  >
                    Cancelar
                  </button>
                  <button
                    disabled={!reason.trim() || saving}
                    onClick={async () => {
                      const interruption = await interruptWholeProduction({
                        cycleId: cycle.id,
                        originProcessId: selected?.id,
                        classification: reason.toLowerCase().includes("program")
                          ? "pausa"
                          : "parada",
                        reason,
                        userId: operatorId,
                      });
                      setTraceability((current) => ({
                        ...current,
                        interruptions: [
                          interruption,
                          ...(current?.interruptions ?? []),
                        ],
                      }));
                      setRows((all) =>
                        all.map((item) =>
                          ["nao_iniciado", "finalizado"].includes(item.status)
                            ? item
                            : {
                                ...item,
                                status: "pausado",
                                estado_iniciado_em: new Date().toISOString(),
                              },
                        ),
                      );
                      setInterruptOpen(false);
                    }}
                    className="min-h-14 bg-red-600 font-black text-white disabled:bg-gray-300"
                  >
                    Confirmar interrupção
                  </button>
                </footer>
              </section>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
