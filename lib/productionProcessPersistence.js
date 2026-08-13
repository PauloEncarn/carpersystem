import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

const zones = Array.from({ length: 7 }, (_, index) => [
  { key: `zona_${index + 1}_setpoint`, label: `Zona ${index + 1} · Set point`, unit: "°C", group: `Zona ${index + 1}` },
  { key: `zona_${index + 1}_real`, label: `Zona ${index + 1} · Real`, unit: "°C", group: `Zona ${index + 1}` },
]).flat();

export const ROSCA_SUBPROCESSES = [
  { code: "automacao", name: "Automação", equipment: "Refinador de açúcar", frequency: "production", parameters: [{ key: "lote_acucar", label: "Lote utilizado", type: "text" }] },
  { code: "masseira", name: "Masseira", equipment: "Masseira", frequency: "production", parameters: [{ key: "lote_massa", label: "Lote utilizado", type: "text" }] },
  { code: "corte_fio", name: "Corte a fio", equipment: "Cortadora", frequency: "hourly", parameters: [{ key: "cortes_minuto", label: "Cortes por minuto", unit: "cortes/min" }, { key: "kg_hora", label: "Produção", unit: "kg/h" }, { key: "peso_biscoito", label: "Peso do biscoito", unit: "g" }], liveMetrics: [{ key: "cortes_minuto", label: "Ritmo", unit: "cortes/min" }, { key: "kg_hora", label: "Estimativa", unit: "kg/min", divisor: 60 }] },
  { code: "forno", name: "Forno", equipment: "Forno · 7 zonas", frequency: "hourly", parameters: [{ key: "umidade", label: "Umidade", unit: "%" }, { key: "peso", label: "Peso do biscoito", unit: "g" }, ...zones], liveMetrics: [{ key: "umidade", label: "Umidade", unit: "%" }, { key: "peso", label: "Peso", unit: "g" }] },
  { code: "empacotamento", name: "Empacotamento", equipment: "Empacotadora", frequency: "hourly", parameters: [{ key: "pacotes_hora", label: "Pacotes por hora", unit: "pacotes/h" }, { key: "peso_pacote", label: "Peso do pacote", unit: "g" }], liveMetrics: [{ key: "pacotes_hora", label: "Estimativa", unit: "pacotes/min", divisor: 60 }, { key: "peso_pacote", label: "Peso", unit: "g" }] },
  { code: "encaixotamento", name: "Encaixotamento", equipment: "Final de linha", frequency: "hourly", parameters: [{ key: "total_hora", label: "Total encaixotado por hora", unit: "caixas/h" }], liveMetrics: [{ key: "total_hora", label: "Estimativa", unit: "caixas/min", divisor: 60 }] },
];

const validUuid = (value) => /^[0-9a-f-]{36}$/i.test(value ?? "");
async function safeOperator(operatorId) { return validUuid(operatorId) ? operatorId : null; }

export async function loadProductionSubprocesses(cycleId) {
  if (!isSupabaseConfigured || !supabase || !validUuid(cycleId)) return { rows: [], records: [], remote: false };
  const [{ data, error }, records] = await Promise.all([
    supabase.from("producao_subprocessos").select("*,subprocesso_eventos(*)").eq("ciclo_id", cycleId).order("ordem"),
    loadSubprocessRecords(cycleId),
  ]);
  if (error) {
    if (["42P01", "PGRST205"].includes(error.code)) return { rows: [], records: [], remote: false };
    throw error;
  }
  return { rows: data ?? [], records, remote: true };
}

export async function loadSubprocessRecords(cycleId) {
  if (!isSupabaseConfigured || !supabase || !validUuid(cycleId)) return [];
  const { data, error } = await supabase.from("subprocesso_registros").select("*").eq("ciclo_id", cycleId).order("horario_referencia", { ascending: true });
  if (error) {
    if (["42P01", "42703", "PGRST205"].includes(error.code)) return [];
    throw error;
  }
  return data ?? [];
}

export async function ensureProductionSubprocesses(cycleId, operatorId) {
  const loaded = await loadProductionSubprocesses(cycleId);
  if (!loaded.remote || loaded.rows.length) return loaded;
  const operator = await safeOperator(operatorId);
  const { error } = await supabase.from("producao_subprocessos").upsert(ROSCA_SUBPROCESSES.map((item, index) => ({ ciclo_id: cycleId, codigo: item.code, nome: item.name, ordem: index + 1, equipamento: item.equipment, atualizado_por: operator })), { onConflict: "ciclo_id,codigo", ignoreDuplicates: true });
  if (error) throw error;
  return loadProductionSubprocesses(cycleId);
}

export async function changeSubprocessState({ process, status, reason, operatorId }) {
  const { data, error } = await supabase.rpc("alterar_estado_subprocesso", { p_subprocesso_id: process.id, p_versao_esperada: process.versao, p_status: status, p_motivo: reason || null, p_operador_id: await safeOperator(operatorId) });
  if (error) throw error;
  return data;
}

export async function saveSubprocessRecord({ process, cycleId, values, operatorId, frequency }) {
  const { data, error } = await supabase.rpc("registrar_apontamento_subprocesso", { p_subprocesso_id: process.id, p_ciclo_id: cycleId, p_valores: values, p_operador_id: await safeOperator(operatorId), p_tipo: frequency === "production" ? "producao" : "horario" });
  if (error) throw error;
  return data;
}
export const saveSubprocessHourlyRecord = saveSubprocessRecord;

export async function finishCycleSubprocesses(cycleId, operatorId) {
  if (!isSupabaseConfigured || !supabase || !validUuid(cycleId)) return;
  const { error } = await supabase.rpc("encerrar_subprocessos_ciclo", { p_ciclo_id: cycleId, p_operador_id: await safeOperator(operatorId) });
  if (error && !["42883", "PGRST202"].includes(error.code)) throw error;
}
