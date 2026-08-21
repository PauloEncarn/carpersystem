import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

const zones = Array.from({ length: 7 }, (_, index) => [
  {
    key: `zona_${index + 1}_setpoint`,
    label: `Zona ${index + 1} · Set point`,
    unit: "°C",
    group: `Zona ${index + 1}`,
  },
  {
    key: `zona_${index + 1}_real`,
    label: `Zona ${index + 1} · Real`,
    unit: "°C",
    group: `Zona ${index + 1}`,
  },
]).flat();
const sampleWeights = [
  {
    key: "peso_10_lado_operacional",
    label: "Peso de 10 unidades · lado operacional",
    unit: "g",
    hint: "Junte 10 unidades retiradas do lado operacional e informe o peso total.",
  },
  {
    key: "peso_10_lado_nao_operacional",
    label: "Peso de 10 unidades · lado não operacional",
    unit: "g",
    hint: "Junte 10 unidades retiradas do lado não operacional e informe o peso total.",
  },
];
const packerReadings = Array.from({ length: 4 }, (_, index) => [
  {
    key: `maq_${index + 1}_velocidade_esteira`,
    label: `Máquina ${index + 1} · Velocidade esteira`,
    unit: "m/min",
    group: `Máquina ${index + 1}`,
  },
  {
    key: `maq_${index + 1}_pacotes_min`,
    label: `Máquina ${index + 1} · Pacotes`,
    unit: "pacotes/min",
    group: `Máquina ${index + 1}`,
  },
  {
    key: `maq_${index + 1}_sobrepeso`,
    label: `Máquina ${index + 1} · Sobrepeso`,
    unit: "g",
    group: `Máquina ${index + 1}`,
  },
]).flat();

export const ROSCA_SUBPROCESSES = [
  {
    code: "automacao",
    name: "Automação",
    equipment: "Refinador de açúcar",
    frequency: "lot",
    parameters: [
      {
        key: "lote_acucar",
        label: "Lote refinado na automação",
        type: "text",
        hint: "O lote permanecerá vigente até que uma troca seja registrada.",
      },
    ],
  },
  {
    code: "masseira",
    name: "Masseira",
    equipment: "Masseira",
    frequency: "lot",
    parameters: [
      {
        key: "lote_automacao",
        label: "Lote recebido da automação",
        type: "automation-lot",
        hint: "Selecione um dos lotes registrados na Automação.",
      },
    ],
  },
  {
    code: "corte_fio",
    name: "Corte a fio",
    equipment: "Cortadora",
    frequency: "hourly",
    parameters: [
      ...sampleWeights,
      { key: "umidade", label: "Umidade", unit: "%" },
      { key: "cortes_hora", label: "Cortes por hora", unit: "cortes/h" },
    ],
    liveMetrics: [
      {
        key: "cortes_hora",
        label: "Cortes projetados",
        unit: "cortes/min",
        divisor: 60,
      },
    ],
  },
  {
    code: "forno",
    name: "Forno",
    equipment: "Forno · 7 zonas",
    frequency: "hourly",
    parameters: [
      {
        key: "velocidade_esteira",
        label: "Velocidade da esteira",
        unit: "m/min",
      },
      { key: "velocidade_linha", label: "Velocidade da linha", unit: "m/min" },
      { key: "umidade", label: "Umidade", unit: "%" },
      ...zones,
    ],
    liveMetrics: [
      { key: "umidade", label: "Umidade", unit: "%" },
      { key: "velocidade_linha", label: "Velocidade da linha", unit: "m/min" },
    ],
  },
  {
    code: "empacotamento",
    name: "Empacotamento",
    equipment: "4 empacotadoras",
    frequency: "hourly",
    parameters: packerReadings,
    liveMetrics: [
      { key: "maq_1_pacotes_min", label: "Máquina 1", unit: "pacotes/min" },
      { key: "maq_2_pacotes_min", label: "Máquina 2", unit: "pacotes/min" },
    ],
  },
  {
    code: "encaixotamento",
    name: "Encaixotamento",
    equipment: "2 encaixotadeiras",
    frequency: "hourly",
    parameters: [
      {
        key: "maq_1_caixas_min",
        label: "Caixas por minuto",
        unit: "caixas/min",
        group: "Encaixotadeira 1",
      },
      {
        key: "maq_2_caixas_min",
        label: "Caixas por minuto",
        unit: "caixas/min",
        group: "Encaixotadeira 2",
      },
    ],
    liveMetrics: [
      {
        key: "maq_1_caixas_min",
        label: "Encaixotadeira 1",
        unit: "caixas/min",
      },
      {
        key: "maq_2_caixas_min",
        label: "Encaixotadeira 2",
        unit: "caixas/min",
      },
    ],
  },
];

const validUuid = (value) => /^[0-9a-f-]{36}$/i.test(value ?? "");
async function safeOperator(operatorId) {
  if (!validUuid(operatorId) || !supabase) return null;
  const { data, error } = await supabase
    .from("operadores")
    .select("id")
    .eq("id", operatorId)
    .maybeSingle();
  return error || !data?.id ? null : data.id;
}

export async function loadProductionSubprocesses(cycleId) {
  if (!isSupabaseConfigured || !supabase || !validUuid(cycleId))
    return { rows: [], records: [], remote: false };
  const [{ data, error }, records] = await Promise.all([
    supabase
      .from("producao_subprocessos")
      .select("*,subprocesso_eventos(*)")
      .eq("ciclo_id", cycleId)
      .order("ordem"),
    loadSubprocessRecords(cycleId),
  ]);
  if (error) {
    if (["42P01", "PGRST205"].includes(error.code))
      return { rows: [], records: [], remote: false };
    throw error;
  }
  return { rows: data ?? [], records, remote: true };
}

export async function loadSubprocessRecords(cycleId) {
  if (!isSupabaseConfigured || !supabase || !validUuid(cycleId)) return [];
  const { data, error } = await supabase
    .from("subprocesso_registros")
    .select("*")
    .eq("ciclo_id", cycleId)
    .order("horario_referencia", { ascending: true });
  if (error) {
    if (["42P01", "42703", "PGRST205"].includes(error.code)) return [];
    throw error;
  }
  return data ?? [];
}

export async function ensureProductionSubprocesses(cycleId, operatorId) {
  const loaded = await loadProductionSubprocesses(cycleId);
  if (!loaded.remote) return loaded;
  const operator = await safeOperator(operatorId);
  const { error } = await supabase.from("producao_subprocessos").upsert(
    ROSCA_SUBPROCESSES.map((item, index) => ({
      ciclo_id: cycleId,
      codigo: item.code,
      nome: item.name,
      ordem: index + 1,
      equipamento: item.equipment,
      atualizado_por: operator,
    })),
    { onConflict: "ciclo_id,codigo", ignoreDuplicates: true },
  );
  if (error) throw error;
  return loadProductionSubprocesses(cycleId);
}

export async function changeSubprocessState({
  process,
  status,
  reason,
  operatorId,
}) {
  const operator = await safeOperator(operatorId);
  const execute = (version) =>
    supabase.rpc("alterar_estado_subprocesso", {
      p_subprocesso_id: process.id,
      p_versao_esperada: version,
      p_status: status,
      p_motivo: reason || null,
      p_operador_id: operator,
    });
  let result = await execute(process.versao);
  if (
    result.error &&
    (result.error.code === "40001" ||
      result.error.message?.includes("CONFLICT"))
  ) {
    const { data: fresh, error: reloadError } = await supabase
      .from("producao_subprocessos")
      .select("versao")
      .eq("id", process.id)
      .single();
    if (reloadError) throw reloadError;
    result = await execute(fresh.versao);
  }
  if (result.error) throw result.error;
  return result.data;
}

export async function saveSubprocessRecord({
  process,
  cycleId,
  values,
  operatorId,
  frequency,
}) {
  const { data, error } = await supabase.rpc(
    "registrar_apontamento_subprocesso",
    {
      p_subprocesso_id: process.id,
      p_ciclo_id: cycleId,
      p_valores: values,
      p_operador_id: await safeOperator(operatorId),
      p_tipo: frequency === "lot" ? "lote" : "horario",
    },
  );
  if (error) throw error;
  return data;
}
export const saveSubprocessHourlyRecord = saveSubprocessRecord;

export async function reportSubprocessProblem({
  processId,
  equipment,
  cause,
  description,
  operatorId,
}) {
  const { data, error } = await supabase
    .from("subprocesso_eventos")
    .insert({
      subprocesso_id: processId,
      tipo: "problema_reportado",
      motivo: description || cause,
      operador_id: await safeOperator(operatorId),
      dados: {
        equipamento: equipment,
        causa: cause,
        descricao: description,
        status: "aberto",
      },
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function resolveSubprocessProblem({
  processId,
  problemId,
  resolution,
  operatorId,
}) {
  const { data, error } = await supabase
    .from("subprocesso_eventos")
    .insert({
      subprocesso_id: processId,
      tipo: "problema_resolvido",
      motivo: resolution,
      operador_id: await safeOperator(operatorId),
      dados: { problema_id: problemId, solucao: resolution },
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function finishCycleSubprocesses(cycleId, operatorId) {
  if (!isSupabaseConfigured || !supabase || !validUuid(cycleId)) return;
  const { error } = await supabase.rpc("encerrar_subprocessos_ciclo", {
    p_ciclo_id: cycleId,
    p_operador_id: await safeOperator(operatorId),
  });
  if (error && !["42883", "PGRST202"].includes(error.code)) throw error;
}
