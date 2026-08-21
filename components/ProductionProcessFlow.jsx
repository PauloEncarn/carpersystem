"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Factory,
  Lock,
  Cog,
  Power,
  Boxes,
  CookingPot,
  Flame,
  Scissors,
  Save,
  Square,
  X,
} from "lucide-react";
import {
  changeSubprocessState,
  ensureProductionSubprocesses,
  reportSubprocessProblem,
  resolveSubprocessProblem,
  ROSCA_SUBPROCESSES,
  saveSubprocessRecord,
} from "@/lib/productionProcessPersistence";
import { ProductionTraceabilitySetup } from "@/components/ProductionTraceabilitySetup";
import { CicopalLogo } from "@/components/CicopalLogo";
import {
  interruptWholeProduction,
  loadProductionTraceability,
  loadPackerConfigurations,
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
const sameInstant = (left, right) =>
  Boolean(left && right) && new Date(left).getTime() === new Date(right).getTime();
const validValue = (value) =>
  value !== undefined && value !== null && value !== "";
const stationProcessCodes = {
  prep: ["automacao", "masseira"],
  cut: ["corte_fio"],
  oven: ["forno"],
  pack: ["empacotamento"],
  box: ["encaixotamento"],
};
const problemOptions = {
  automacao: { equipment: ["Refinador de açúcar", "Alimentação de farinha", "Tombador"], causes: ["Falta de insumo", "Falha no equipamento", "Lote divergente", "Acúmulo de massa"] },
  masseira: { equipment: ["Masseira", "Dosagem de insumos", "Tombador"], causes: ["Massa fora do padrão", "Atraso no processo seguinte", "Falha na masseira", "Acúmulo de massa"] },
  corte_fio: { equipment: ["Cortadora", "Lado operacional", "Lado não operacional"], causes: ["Corte irregular", "Peso fora do padrão", "Massa acumulada", "Falha mecânica"] },
  forno: { equipment: ["Forno", ...Array.from({ length: 7 }, (_, index) => `Zona ${index + 1}`)], causes: ["Temperatura fora do padrão", "Falha de aquecimento", "Esteira parada", "Produto retido"] },
  empacotamento: { equipment: Array.from({ length: 4 }, (_, index) => `Máquina ${index + 1}`), causes: ["Máquina parada", "Falha de selagem", "Peso fora do padrão", "Falta de embalagem"] },
  encaixotamento: { equipment: ["Encaixotadeira 1", "Encaixotadeira 2"], causes: ["Equipamento parado", "Falta de caixas", "Acúmulo de pacotes", "Contagem divergente"] },
};
function remaining(end, now) {
  const seconds = Math.max(0, Math.ceil((new Date(end) - now) / 1000));
  const totalMinutes = Math.ceil(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}min`;
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
  const [saveFeedback, setSaveFeedback] = useState("");
  const [message, setMessage] = useState("");
  const [viewOnly, setViewOnly] = useState(false);
  const [interruptOpen, setInterruptOpen] = useState(false);
  const [problemModal, setProblemModal] = useState(null);
  const [problemResolution, setProblemResolution] = useState(null);
  const [workspace, setWorkspace] = useState("overview");
  const selected = rows.find((item) => item.codigo === selectedCode);
  const config = ROSCA_SUBPROCESSES.find((item) => item.code === selectedCode);
  const parameter = config?.parameters[fieldIndex];
  const groupedParameters =
    ["forno", "empacotamento"].includes(selectedCode) && parameter?.group
      ? config.parameters.filter((item) => item.group === parameter.group)
      : [];
  const selectedMachineNumber = parameter?.group?.match(/^Máquina (\d+)$/)?.[1];
  const selectedMachineAvailability = selectedMachineNumber
    ? packerAvailability(Number(selectedMachineNumber), scheduledAt)
    : { state: "available" };
  const selectedMachineRunning = ![
    "unavailable",
    "not_started",
    "inactive",
  ].includes(selectedMachineAvailability.state);
  const parameterContext =
    parameter?.group ??
    (parameter?.key?.match(/^maq_(\d+)_/)
      ? `Empacotadora ${parameter.key.match(/^maq_(\d+)_/)[1]}`
      : config?.equipment);
  const rowByCode = (code) => rows.find((item) => item.codigo === code);
  const openProblemsForCodes = (codes = []) => {
    const events = rows
      .filter((row) => codes.includes(row.codigo))
      .flatMap((row) =>
        (row.subprocesso_eventos ?? []).map((event) => ({ ...event, process: row })),
      );
    const resolved = new Set(
      events
        .filter((event) => event.tipo === "problema_resolvido")
        .map((event) => event.dados?.problema_id)
        .filter(Boolean),
    );
    return events.filter(
      (event) => event.tipo === "problema_reportado" && !resolved.has(event.id),
    );
  };
  const workspaceProblems = openProblemsForCodes(stationProcessCodes[workspace] ?? []);
  const recordsFor = (code) => {
    const row = rowByCode(code);
    return records
      .filter((item) => item.subprocesso_id === row?.id)
      .sort(
        (a, b) =>
          new Date(b.horario_referencia) - new Date(a.horario_referencia),
      );
  };
  function packerAvailability(machine, slot) {
    if (!slot) return { state: "available" };
    const history = (traceability?.packers ?? [])
      .filter((item) => item.maquina === machine)
      .sort(
        (a, b) => new Date(a.vigente_desde) - new Date(b.vigente_desde),
      );
    if (!history.length) return { state: "available" };
    const slotTime = new Date(slot).getTime();
    const stopEvents = history.filter(
      (item, index) => !item.ativa && index > 0 && history[index - 1].ativa,
    );
    const finalEvent = stopEvents.find((event) => {
      const finalSlot = new Date(event.vigente_desde);
      if (
        finalSlot.getMinutes() ||
        finalSlot.getSeconds() ||
        finalSlot.getMilliseconds()
      )
        finalSlot.setHours(finalSlot.getHours() + 1, 0, 0, 0);
      return finalSlot.getTime() === slotTime;
    });
    if (finalEvent)
      return {
        state: "final",
        stoppedAt: finalEvent.vigente_desde,
      };
    const effective = history
      .filter((item) => new Date(item.vigente_desde).getTime() <= slotTime)
      .at(-1);
    const laterActivation = history.find(
      (item, index) =>
        item.ativa &&
        index > 0 &&
        !history[index - 1].ativa &&
        new Date(item.vigente_desde).getTime() > slotTime,
    );
    if (!effective || (effective.ativa === false && laterActivation))
      return {
        state: "not_started",
        startsAt: laterActivation?.vigente_desde ?? history[0]?.vigente_desde,
      };
    return effective?.ativa === false
      ? { state: "inactive", stoppedAt: effective.vigente_desde }
      : { state: "available" };
  }
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
  const displayedBatch =
    activeBatch ??
    traceability?.batches?.find((batch) => batch.status === "pronta") ??
    traceability?.batches?.find((batch) => batch.status === "em_preparacao") ??
    traceability?.batches?.[0];
  const displayedBatchText = displayedBatch
    ? displayedBatch.status === "em_consumo"
      ? `Batelada ${displayedBatch.numero} está sendo utilizada`
      : displayedBatch.status === "pronta"
        ? `Batelada ${displayedBatch.numero} está pronta`
        : displayedBatch.status === "em_preparacao"
          ? `Batelada ${displayedBatch.numero} está em preparação`
          : `Batelada ${displayedBatch.numero} finalizou`
    : "Nenhuma batelada iniciada";
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
  const firstBatchStartedAt = traceability?.batches?.length
    ? traceability.batches.reduce((earliest, batch) => {
        if (!earliest) return batch.iniciada_em;
        return new Date(batch.iniciada_em) < new Date(earliest)
          ? batch.iniciada_em
          : earliest;
      }, null)
    : null;
  const fixedSlots = useMemo(() => {
    if (!firstBatchStartedAt) return [];
    const start = new Date(firstBatchStartedAt);
    start.setMinutes(0, 0, 0);
    if (start < new Date(firstBatchStartedAt))
      start.setHours(start.getHours() + 1);
    const end = new Date(
      cycle.productionEndedAt ?? cycle.endedAt ?? now,
    );
    end.setMinutes(0, 0, 0);
    if (!cycle.productionEndedAt && !cycle.endedAt) {
      const minimumEnd = new Date(start.getTime() + 3_600_000);
      const nextCurrentHour = new Date(now);
      nextCurrentHour.setMinutes(0, 0, 0);
      nextCurrentHour.setHours(nextCurrentHour.getHours() + 1);
      end.setTime(Math.max(end.getTime(), minimumEnd.getTime(), nextCurrentHour.getTime()));
    }
    const slots = [];
    for (
      let cursor = new Date(start);
      cursor <= end;
      cursor = new Date(cursor.getTime() + 3600000)
    )
      slots.push(cursor.toISOString());
    return slots;
  }, [
    firstBatchStartedAt,
    cycle.productionEndedAt,
    cycle.endedAt,
    now.getHours(),
  ]);
  // Mantém todo o histórico da produção acessível, inclusive pendências antigas.
  const visibleSlots = fixedSlots;
  const isSlotReleased = (slot) =>
    Boolean(slot) && new Date(slot).getTime() <= now.getTime();

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

  useEffect(() => {
    if (!cycle?.id) return undefined;
    function refreshPackers(event) {
      if (event.detail?.cycleId && event.detail.cycleId !== cycle.id) return;
      loadPackerConfigurations(cycle.id)
        .then((packers) =>
          setTraceability((current) => ({ ...(current ?? {}), packers })),
        )
        .catch(() => {});
    }
    function refreshWhenVisible() {
      if (document.visibilityState === "visible") refreshPackers({ detail: {} });
    }
    window.addEventListener("production-packers-updated", refreshPackers);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    const timer = window.setInterval(refreshWhenVisible, 60_000);
    return () => {
      window.removeEventListener("production-packers-updated", refreshPackers);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.clearInterval(timer);
    };
  }, [cycle?.id]);

  function isUnlocked(code) {
    if (cycle?.status === "blocked") return false;
    if (["automacao", "masseira"].includes(code)) return true;
    return Boolean(activeBatch);
  }
  function openProcess(code, requestedSlot = null) {
    if (!isUnlocked(code)) return;
    if (requestedSlot && !isSlotReleased(requestedSlot)) {
      setMessage("Este horário ainda não foi liberado.");
      return;
    }
    const cfg = ROSCA_SUBPROCESSES.find((item) => item.code === code);
    const processRecords = recordsFor(code);
    const requestedRecord = requestedSlot
      ? processRecords.find(
          (record) => sameInstant(record.horario_previsto, requestedSlot),
        )
      : null;
    const existing = requestedRecord ?? processRecords[0];
    const pending = requestedSlot
      ? requestedRecord
        ? null
        : requestedSlot
      : fixedSlots.find(
          (slot) =>
            isSlotReleased(slot) &&
            !processRecords.some((record) =>
              sameInstant(record.horario_previsto, slot),
            ),
        );
    const filledWindow =
      cfg?.frequency === "hourly" && !pending && Boolean(existing);
    const sameWindow = cfg?.frequency === "lot" || filledWindow;
    let fallbackSlot = "";
    if (cfg?.frequency === "hourly") {
      const reference = new Date(
        firstBatchStartedAt ?? cycle.productionStartedAt ?? Date.now(),
      );
      if (Number.isFinite(reference.getTime())) {
        reference.setMinutes(0, 0, 0);
        const original = new Date(
          firstBatchStartedAt ?? cycle.productionStartedAt ?? Date.now(),
        );
        if (reference < original) reference.setHours(reference.getHours() + 1);
        fallbackSlot = reference.toISOString();
      }
    }
    const targetSlot =
      pending ?? existing?.horario_previsto ?? fallbackSlot;
    const firstVisibleMachine =
      code === "empacotamento"
        ? [1, 2, 3, 4].find(
            (machine) =>
              !["not_started", "inactive"].includes(
                packerAvailability(machine, targetSlot).state,
              ),
          )
        : null;
    setSelectedCode(code);
    setScheduledAt(targetSlot);
    setValues(sameWindow ? (existing?.valores ?? {}) : {});
    setViewOnly(Boolean(filledWindow));
    setRectifying(false);
    setCorrectionReason("");
    setFieldIndex(
      code === "empacotamento" && firstVisibleMachine
        ? (firstVisibleMachine - 1) * 3
        : 0,
    );
    setReview(false);
    setReason("");
    setMessage("");
  }
  function nextField() {
    const currentParameters = groupedParameters.length
      ? groupedParameters
      : [parameter];
    if (
      selectedMachineRunning !== false &&
      currentParameters.some((item) => !validValue(values[item.key]))
    )
      return setMessage("Informe este valor para continuar.");
    setMessage("");
    const step = groupedParameters.length ? groupedParameters.length : 1;
    let nextIndex = fieldIndex + step;
    if (selectedCode === "empacotamento") {
      while (
        nextIndex < config.parameters.length &&
        ["not_started", "inactive"].includes(
          packerAvailability(Math.floor(nextIndex / 3) + 1, scheduledAt).state,
        )
      )
        nextIndex += 3;
    }
    if (nextIndex < config.parameters.length) setFieldIndex(nextIndex);
    else setReview(true);
  }
  function previousField() {
    const step = groupedParameters.length ? groupedParameters.length : 1;
    let previousIndex = fieldIndex - step;
    if (selectedCode === "empacotamento") {
      while (
        previousIndex >= 0 &&
        ["not_started", "inactive"].includes(
          packerAvailability(
            Math.floor(previousIndex / 3) + 1,
            scheduledAt,
          ).state,
        )
      )
        previousIndex -= 3;
    }
    if (previousIndex >= 0) setFieldIndex(previousIndex);
    else setSelectedCode("");
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
    if (
      config.frequency === "hourly" &&
      (!scheduledAt || !Number.isFinite(new Date(scheduledAt).getTime()))
    )
      return setMessage(
        "O horário deste controle ainda não foi liberado. Volte aos horários e abra novamente o próximo controle.",
      );
    const requiredParameters = config.parameters.filter((item) => {
      if (config.code !== "empacotamento") return true;
      const machine = Number(item.key.match(/^maq_(\d+)_/)?.[1]);
      return !["unavailable", "not_started", "inactive"].includes(
        packerAvailability(machine, scheduledAt).state,
      );
    });
    if (requiredParameters.some((item) => !validValue(values[item.key])))
      return setMessage("Há informações pendentes.");
    if (rectifying && correctionReason.trim().length < 5)
      return setMessage("Explique o motivo da retificação.");
    setSaving(true);
    setSaveFeedback("saving");
    setMessage("");
    try {
      const valuesToSave = { ...values };
      if (config.code === "empacotamento") {
        [1, 2, 3, 4].forEach((machine) => {
          const availability = packerAvailability(machine, scheduledAt);
          if (availability.state === "final")
            valuesToSave[`maq_${machine}_observacao_parada`] =
              `Resultado obtido anteriormente devido à parada da máquina em ${new Date(availability.stoppedAt).toLocaleString("pt-BR")}`;
        });
      }
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
              values: valuesToSave,
              reason: correctionReason,
              userId: operatorId,
            })
          : config.frequency === "hourly"
            ? await saveFixedHourlyRecord({
                processId: process.id,
                cycleId: cycle.id,
                scheduledAt,
                values: valuesToSave,
                batchId: activeBatch?.id ?? null,
                userId: operatorId,
              })
            : await saveSubprocessRecord({
                process,
                cycleId: cycle.id,
                values: valuesToSave,
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
            valores: valuesToSave,
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
      if (saved._alreadyConfirmed) {
        setValues(saved.valores ?? {});
        setViewOnly(true);
        setMessage(
          "Este horário já estava confirmado. O registro original foi carregado para visualização.",
        );
      } else {
        setMessage("Apontamento confirmado e vinculado à produção.");
      }
      setReview(false);
      setRectifying(false);
      setCorrectionReason("");
      setSaveFeedback("success");
      window.setTimeout(() => {
        setSelectedCode("");
        setSaveFeedback("");
        setMessage("");
      }, 850);
    } catch (error) {
      setSaveFeedback("");
      setMessage(error?.message ?? "Não foi possível confirmar.");
    } finally {
      setSaving(false);
    }
  }
  function openProblemReporter(preferredCode) {
    const code = preferredCode ?? stationProcessCodes[workspace]?.[0];
    const options = problemOptions[code];
    setProblemModal({
      processCode: code,
      equipment: options?.equipment?.[0] ?? "",
      cause: options?.causes?.[0] ?? "Outro",
      description: "",
    });
  }
  async function submitProblem() {
    const process = rowByCode(problemModal?.processCode);
    if (!process || !problemModal?.equipment || !problemModal?.cause) return;
    setSaving(true);
    try {
      const event = remote
        ? await reportSubprocessProblem({
            processId: process.id,
            equipment: problemModal.equipment,
            cause: problemModal.cause,
            description: problemModal.description,
            operatorId,
          })
        : {
            id: `problem-${Date.now()}`,
            subprocesso_id: process.id,
            tipo: "problema_reportado",
            ocorrido_em: new Date().toISOString(),
            motivo: problemModal.description || problemModal.cause,
            dados: {
              equipamento: problemModal.equipment,
              causa: problemModal.cause,
              descricao: problemModal.description,
              status: "aberto",
            },
          };
      setRows((current) =>
        current.map((row) =>
          row.id === process.id
            ? {
                ...row,
                subprocesso_eventos: [...(row.subprocesso_eventos ?? []), event],
              }
            : row,
        ),
      );
      setProblemModal(null);
      setMessage("Problema operacional sinalizado. A produção não foi interrompida.");
    } catch (error) {
      setMessage(error?.message ?? "Não foi possível registrar o problema.");
    } finally {
      setSaving(false);
    }
  }
  async function submitProblemResolution() {
    const problem = problemResolution?.problem;
    const resolution = problemResolution?.resolution?.trim();
    if (!problem || !resolution) return;
    setSaving(true);
    try {
      const event = remote
        ? await resolveSubprocessProblem({
            processId: problem.process.id,
            problemId: problem.id,
            resolution,
            operatorId,
          })
        : {
            id: `resolution-${Date.now()}`,
            subprocesso_id: problem.process.id,
            tipo: "problema_resolvido",
            ocorrido_em: new Date().toISOString(),
            motivo: resolution,
            dados: { problema_id: problem.id, solucao: resolution },
          };
      setRows((current) =>
        current.map((row) =>
          row.id === problem.process.id
            ? {
                ...row,
                subprocesso_eventos: [...(row.subprocesso_eventos ?? []), event],
              }
            : row,
        ),
      );
      setProblemResolution(null);
      setMessage("Problema operacional marcado como resolvido.");
    } catch (error) {
      setMessage(error?.message ?? "Não foi possível resolver o problema.");
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
        isSlotReleased(slot) &&
        !recordsFor(item.code).some(
          (record) => sameInstant(record.horario_previsto, slot),
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

  if (cycle?.status === "hygiene")
    return (
      <section className="border bg-gray-50 p-6 text-center">
        <Factory className="mx-auto text-gray-400" />
        <h3 className="mt-2 text-lg font-black">Apontamentos da produção</h3>
        <p className="font-semibold text-gray-500">
          Disponíveis após a aprovação da higienização.
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
          <div
            className={`mt-4 flex min-h-14 items-center justify-between gap-4 border-l-4 px-4 py-3 ${displayedBatch?.status === "consumida" ? "border-red-500 bg-red-50 text-red-800" : displayedBatch?.status === "pronta" ? "border-green-500 bg-green-50 text-green-800" : displayedBatch ? "border-cicopal-blue bg-blue-50 text-cicopal-blue" : "border-slate-300 bg-slate-50 text-slate-500"}`}
          >
            <div>
              <small className="block text-[10px] font-bold uppercase tracking-wide opacity-70">
                Batelada atual
              </small>
              <b className="text-sm sm:text-base">{displayedBatchText}</b>
            </div>
            {displayedBatch?.status === "em_consumo" ? (
              <span className="size-3 shrink-0 animate-pulse rounded-full bg-green-500" />
            ) : null}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {stations.map(({ id, label, Icon }, stationIndex) => {
              const problems = openProblemsForCodes(stationProcessCodes[id]);
              return (
              <button
                key={id}
                type="button"
                onClick={() => setWorkspace(id)}
                className={`group relative min-h-32 overflow-hidden rounded-lg border p-4 text-left font-bold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[.98] ${problems.length ? "animate-pulse border-red-500 bg-red-50 text-red-950 ring-4 ring-red-100" : "border-slate-200 bg-white text-slate-800 hover:border-cicopal-blue"}`}
              >
                {problems.length ? (
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1 bg-red-600 px-2 py-1 text-[10px] font-black uppercase text-white">
                    <AlertTriangle size={12} /> {problems.length} alerta(s)
                  </span>
                ) : displayedBatch && displayedBatch.status !== "consumida" ? (
                  <span
                    className="batch-station-pulse absolute inset-x-0 top-0 h-1 bg-cicopal-blue"
                    style={{ animationDelay: `${stationIndex * 0.45}s` }}
                  />
                ) : null}
                <span className={`mb-4 grid size-11 place-items-center rounded-lg transition ${problems.length ? "bg-red-100 text-red-700" : "bg-blue-50 text-cicopal-blue group-hover:bg-cicopal-blue group-hover:text-white"}`}>
                  <Icon size={22} />
                </span>
                <span className="block leading-tight">{label}</span>
              </button>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="sticky top-2 z-30 flex min-h-16 items-center gap-3 border border-blue-100 bg-white p-3 shadow-lg">
          <button
            type="button"
            aria-label="Voltar à visão geral da produção"
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
          <button
            type="button"
            onClick={() => openProblemReporter()}
            className="ml-auto inline-flex min-h-12 items-center gap-2 bg-red-600 px-4 font-black text-white shadow-sm"
          >
            <AlertTriangle size={20} />
            <span className="hidden sm:inline">Relatar problema</span>
          </button>
        </section>
      )}
      {workspace !== "overview" && workspaceProblems.length ? (
        <section className="animate-pulse border-l-8 border-red-600 bg-red-50 p-4 text-red-950 shadow-sm">
          <p className="text-xs font-black uppercase text-red-700">Alerta operacional ativo</p>
          <div className="mt-2 space-y-2">
            {workspaceProblems.map((problem) => (
              <div key={problem.id} className="flex flex-wrap items-center justify-between gap-3 bg-white/80 p-3">
                <div>
                  <b>{problem.dados?.equipamento ?? problem.process.nome}</b>
                  <p className="text-sm font-semibold">{problem.dados?.causa ?? problem.motivo}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setProblemResolution({ problem, resolution: "" })}
                  className="min-h-11 border border-red-300 bg-white px-3 font-black text-red-700"
                >
                  Resolver problema
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {workspace === "prep" ? (
        <ProductionTraceabilitySetup
          cycle={cycle}
          operatorId={operatorId}
          onChange={setTraceability}
          mode="prep"
          hasOpenOperationalProblem={workspaceProblems.length > 0}
        />
      ) : null}
      {!["prep", "overview"].includes(workspace) ? (
        <section className="border border-gray-300 bg-white p-4 sm:p-5">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase text-cicopal-blue">
                RG.PROD.ROS.001 · produção interligada
              </p>
              <h2 className="text-2xl font-black">
                {workspace === "cut"
                  ? "Corte a fio"
                  : workspace === "oven"
                    ? "Forno"
                  : workspace === "pack"
                      ? "Empacotamento"
                      : "Encaixotamento"}
              </h2>
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

          {["cut", "oven", "pack", "box"].includes(workspace) ? (
            <section className="sticky top-[72px] z-20 mt-5 border-y border-cicopal-blue bg-white p-3 shadow-md">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-bold">Horários da produção</h3>
                <span className="text-sm font-bold text-red-700">
                  {fixedSlots.filter(
                    (slot) =>
                      isSlotReleased(slot) &&
                      !recordsFor(
                        workspace === "cut"
                          ? "corte_fio"
                          : workspace === "oven"
                            ? "forno"
                            : workspace === "pack"
                              ? "empacotamento"
                              : "encaixotamento",
                      ).some(
                        (record) => sameInstant(record.horario_previsto, slot),
                      ),
                  ).length} pendente(s)
                </span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {visibleSlots.map((slot) => {
                  const processCode =
                    workspace === "cut"
                      ? "corte_fio"
                      : workspace === "oven"
                        ? "forno"
                        : workspace === "pack"
                          ? "empacotamento"
                          : "encaixotamento";
                  const record = recordsFor(processCode).find(
                    (item) => sameInstant(item.horario_previsto, slot),
                  );
                  const released = isSlotReleased(slot);
                  const slotTime = new Date(slot);
                  const currentHour = new Date(now);
                  currentHour.setMinutes(0, 0, 0);
                  const isCurrent =
                    released && slotTime.getTime() === currentHour.getTime();
                  const isNext =
                    slotTime.getTime() === currentHour.getTime() + 3_600_000;
                  const isPast = slotTime.getTime() < currentHour.getTime();
                  return (
                    <button
                      key={slot}
                      type="button"
                      disabled={!released}
                      onClick={() => openProcess(processCode, slot)}
                      className={`relative min-h-20 min-w-36 shrink-0 border px-3 py-2 text-left text-sm font-bold transition ${isCurrent ? "scale-[1.02] border-cicopal-blue bg-cicopal-blue text-white shadow-lg" : isNext ? "cursor-not-allowed border-2 border-dashed border-amber-400 bg-amber-50 text-amber-900" : record ? "border-green-100 bg-green-50/60 text-green-700 opacity-60" : isPast ? "border-red-200 bg-red-50 text-red-700" : "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"}`}
                    >
                      <span className="block text-[10px] uppercase opacity-70">
                        {isCurrent
                          ? "Em preenchimento"
                          : isNext
                            ? "Próximo controle"
                            : isPast
                              ? "Anterior"
                              : "Programado"}
                      </span>
                      <b className="mt-1 block text-lg tabular-nums">
                        {new Date(slot).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </b>
                      <span className="block text-[11px] opacity-75">
                        {new Date(slot).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </span>
                      <small className="flex items-center justify-center gap-1 font-bold uppercase">
                        {!released ? <Lock size={12} /> : null}
                        {record
                          ? "Preenchido"
                          : !released
                            ? "Ainda não liberado"
                            : isCurrent
                              ? "Atual"
                              : "Pendente"}
                      </small>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {workspace === "pack" ? (
            <ProductionTraceabilitySetup
              cycle={cycle}
              operatorId={operatorId}
              onChange={setTraceability}
              mode="pack"
            />
          ) : null}

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
              <div
                className={`mb-2 items-end justify-between ${["cut", "oven", "pack"].includes(workspace) ? "hidden" : "flex"}`}
              >
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
                {["overview", "pack"].includes(workspace)
                  ? processButton(
                      ROSCA_SUBPROCESSES.find(
                        (item) => item.code === "empacotamento",
                      ),
                    )
                  : null}
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
              {saveFeedback ? (
                <div className="fixed inset-0 z-[180] grid place-items-center bg-white/95 p-6 text-center">
                  {saveFeedback === "saving" ? (
                    <>
                      <span className="size-14 animate-spin rounded-full border-4 border-blue-100 border-t-cicopal-blue" />
                      <h3 className="mt-5 text-2xl font-bold text-slate-950">
                        Salvando registro
                      </h3>
                      <p className="mt-1 text-slate-500">
                        Aguarde a confirmação do banco.
                      </p>
                    </>
                  ) : (
                    <>
                      <span className="grid size-16 place-items-center rounded-full bg-green-600 text-white">
                        <Check size={34} strokeWidth={3} />
                      </span>
                      <h3 className="mt-5 text-2xl font-bold text-green-800">
                        Registro confirmado
                      </h3>
                      <p className="mt-1 text-slate-500">
                        Retornando aos horários.
                      </p>
                    </>
                  )}
                </div>
              ) : null}
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
                      type="button"
                      aria-label={`Fechar ${config.name}`}
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
                  {selectedCode === "empacotamento" &&
                  !viewOnly &&
                  !review ? (
                    <nav
                      className="mt-3 grid grid-cols-2 grid-rows-2 gap-2"
                      aria-label="Empacotadoras"
                    >
                      {[1, 3, 4, 2]
                        .filter(
                          (machine) =>
                            !["not_started", "inactive"].includes(
                              packerAvailability(machine, scheduledAt).state,
                            ),
                        )
                        .map((machine) => {
                        const availability = packerAvailability(
                          machine,
                          scheduledAt,
                        );
                        const running = ![
                          "unavailable",
                          "inactive",
                        ].includes(availability.state);
                        const active = parameter?.group === `Máquina ${machine}`;
                        const position = {
                          1: "col-start-1 row-start-1",
                          2: "col-start-2 row-start-2",
                          3: "col-start-2 row-start-1",
                          4: "col-start-1 row-start-2",
                        }[machine];
                        return (
                          <button
                            key={machine}
                            type="button"
                            onClick={() => setFieldIndex((machine - 1) * 3)}
                            className={`${position} group relative min-h-28 overflow-hidden rounded-xl border p-3 text-left shadow-sm transition ${active ? "border-cicopal-blue bg-gradient-to-br from-white to-blue-50 ring-4 ring-blue-100" : availability.state === "final" ? "border-amber-300 bg-amber-50" : running ? "border-emerald-300 bg-gradient-to-br from-white to-emerald-50" : "border-slate-200 bg-gradient-to-br from-white to-slate-100 text-slate-400"}`}
                          >
                            <span className={`absolute inset-x-0 top-0 h-1 ${active ? "bg-cicopal-blue" : availability.state === "final" ? "bg-amber-500" : running ? "bg-emerald-500" : "bg-slate-300"}`} />
                            <span className="flex items-start justify-between gap-2">
                              <span className={`grid size-9 place-items-center rounded-lg ${running ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
                                <Cog size={19} className={running ? "motion-safe:animate-[spin_6s_linear_infinite]" : ""} />
                              </span>
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-black uppercase ${running ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}>
                                <Power size={10} /> {running ? "Operando" : "Parada"}
                              </span>
                            </span>
                            <span className="mt-3 block text-[9px] font-black uppercase tracking-wider text-slate-400">Empacotadeira</span>
                            <b className="block text-xl text-slate-950">Máquina {String(machine).padStart(2, "0")}</b>
                          </button>
                        );
                      })}
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
                        {groupedParameters.length
                          ? parameter.group
                          : parameter.label}
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
                        {selectedCode === "empacotamento" &&
                        selectedMachineAvailability.state === "final" ? (
                          <div className="border-l-4 border-amber-500 bg-amber-50 p-5 text-amber-900">
                            <b className="block text-lg">
                              Última leitura da máquina
                            </b>
                            <p className="mt-1 text-sm">
                              Preencha com o resultado obtido anteriormente. A
                              máquina parou em{" "}
                              {new Date(
                                selectedMachineAvailability.stoppedAt,
                              ).toLocaleString("pt-BR")}. A observação será
                              anexada automaticamente ao registro.
                            </p>
                          </div>
                        ) : selectedCode === "empacotamento" &&
                          selectedMachineRunning === false ? (
                          <div className="border border-slate-300 bg-slate-100 p-6 text-center text-slate-600">
                            <b className="block text-xl">
                              {selectedMachineAvailability.state === "locked"
                                ? "Horário bloqueado"
                                : "Máquina parada"}
                            </b>
                            <p className="mt-1 text-sm">
                              {selectedMachineAvailability.state === "locked"
                                ? "Uma parada posterior já foi confirmada. Não é permitido incluir informações retroativas para esta máquina."
                                : "Não há leitura para registrar neste horário."}
                            </p>
                          </div>
                        ) : groupedParameters.length ? (
                          <div
                            className={`grid gap-4 ${selectedCode === "forno" ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}
                          >
                            {groupedParameters.map((groupParameter) => (
                              <label
                                key={groupParameter.key}
                                className="border-2 border-slate-300 bg-white p-4 focus-within:border-cicopal-blue"
                              >
                                <span className="block text-sm font-bold uppercase text-slate-500">
                                  {selectedCode === "forno"
                                    ? groupParameter.key.endsWith("_setpoint")
                                      ? "Setpoint"
                                      : "Temperatura real"
                                    : groupParameter.label.replace(
                                        /^Máquina \d+ · /,
                                        "",
                                      )}
                                </span>
                                <div className="mt-3 flex items-center">
                                  <input
                                    autoFocus={
                                      groupParameter === groupedParameters[0]
                                    }
                                    type="number"
                                    inputMode="decimal"
                                    value={values[groupParameter.key] ?? ""}
                                    onChange={(event) =>
                                      setValues((all) => ({
                                        ...all,
                                        [groupParameter.key]: event.target.value,
                                      }))
                                    }
                                    className="min-h-20 min-w-0 flex-1 text-center text-4xl font-black outline-none"
                                  />
                                  <b className="px-3 text-lg text-slate-500">
                                    {groupParameter.unit}
                                  </b>
                                </div>
                              </label>
                            ))}
                          </div>
                        ) : parameter.type === "options" ? (
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
                    <div className="mt-5 flex items-center justify-between border-t pt-4 text-sm">
                      <span className="text-slate-500">Estado da área</span>
                      <b
                        className={
                          selected.status === "operando"
                            ? "text-green-700"
                            : "text-red-700"
                        }
                      >
                        {labels[selected.status]}
                      </b>
                    </div>
                  ) : null}
                </div>
                <footer className="sticky bottom-0 grid shrink-0 grid-cols-[auto_1fr] gap-2 border-t bg-white p-3 shadow-[0_-8px_24px_rgba(15,23,42,.08)] sm:p-4">
                  <button
                    type="button"
                    onClick={() =>
                      review ? setReview(false) : previousField()
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
                    type="button"
                    aria-label="Fechar interrupção"
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
      {problemModal ? (
        <div className="fixed inset-0 z-[170] grid place-items-center overflow-y-auto bg-slate-950/70 p-3">
          <section className="w-full max-w-xl border-t-8 border-red-600 bg-white shadow-2xl">
            <header className="flex items-start justify-between border-b p-5">
              <div>
                <p className="text-xs font-black uppercase text-red-600">Ocorrência operacional</p>
                <h3 className="text-2xl font-black">Relatar problema</h3>
                <p className="mt-1 text-sm font-semibold text-gray-500">O registro sinaliza a área, mas não interrompe a produção.</p>
              </div>
              <button type="button" onClick={() => setProblemModal(null)} className="grid size-11 place-items-center bg-gray-100"><X /></button>
            </header>
            <div className="space-y-4 p-5">
              {(stationProcessCodes[workspace]?.length ?? 0) > 1 ? (
                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase text-gray-500">Subprocesso</span>
                  <select
                    value={problemModal.processCode}
                    onChange={(event) => {
                      const code = event.target.value;
                      setProblemModal((current) => ({ ...current, processCode: code, equipment: problemOptions[code].equipment[0], cause: problemOptions[code].causes[0] }));
                    }}
                    className="min-h-14 w-full border-2 border-gray-300 bg-white px-3 text-lg font-black"
                  >
                    {stationProcessCodes[workspace].map((code) => <option key={code} value={code}>{rowByCode(code)?.nome ?? code}</option>)}
                  </select>
                </label>
              ) : null}
              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase text-gray-500">Onde ocorreu?</span>
                <select value={problemModal.equipment} onChange={(event) => setProblemModal((current) => ({ ...current, equipment: event.target.value }))} className="min-h-14 w-full border-2 border-gray-300 bg-white px-3 text-lg font-black">
                  {(problemOptions[problemModal.processCode]?.equipment ?? []).map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase text-gray-500">Possível causa</span>
                <select value={problemModal.cause} onChange={(event) => setProblemModal((current) => ({ ...current, cause: event.target.value }))} className="min-h-14 w-full border-2 border-gray-300 bg-white px-3 text-lg font-black">
                  {(problemOptions[problemModal.processCode]?.causes ?? []).map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase text-gray-500">Detalhes (opcional)</span>
                <textarea value={problemModal.description} onChange={(event) => setProblemModal((current) => ({ ...current, description: event.target.value }))} className="min-h-24 w-full border-2 border-gray-300 p-3" placeholder="Descreva o que foi observado" />
              </label>
            </div>
            <footer className="grid grid-cols-2 gap-2 border-t p-4">
              <button type="button" onClick={() => setProblemModal(null)} className="min-h-14 border font-black">Cancelar</button>
              <button type="button" disabled={saving} onClick={submitProblem} className="min-h-14 bg-red-600 font-black text-white disabled:bg-gray-300">Confirmar alerta</button>
            </footer>
          </section>
        </div>
      ) : null}
      {problemResolution ? (
        <div className="fixed inset-0 z-[175] grid place-items-center bg-slate-950/70 p-3">
          <section className="w-full max-w-lg border-t-8 border-green-600 bg-white shadow-2xl">
            <header className="border-b p-5"><p className="text-xs font-black uppercase text-green-700">Encerrar alerta operacional</p><h3 className="text-2xl font-black">O que foi feito?</h3></header>
            <div className="p-5"><textarea autoFocus value={problemResolution.resolution} onChange={(event) => setProblemResolution((current) => ({ ...current, resolution: event.target.value }))} className="min-h-28 w-full border-2 border-gray-300 p-3" placeholder="Descreva a solução aplicada" /></div>
            <footer className="grid grid-cols-2 gap-2 border-t p-4"><button type="button" onClick={() => setProblemResolution(null)} className="min-h-14 border font-black">Cancelar</button><button type="button" disabled={saving || !problemResolution.resolution.trim()} onClick={submitProblemResolution} className="min-h-14 bg-green-600 font-black text-white disabled:bg-gray-300">Marcar resolvido</button></footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}
