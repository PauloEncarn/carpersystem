import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

export const ROSCA_SUBPROCESSES = [
  { code: "automacao", name: "Automação", equipment: "Refinador de açúcar", parameters: [{ key: "acucar_refinado", label: "Açúcar refinado", unit: "kg" }, { key: "corrente", label: "Corrente do refinador", unit: "A" }] },
  { code: "masseira", name: "Masseira", equipment: "Masseira 01", parameters: [{ key: "massa", label: "Massa preparada", unit: "kg" }, { key: "aroma", label: "Aroma", unit: "kg" }, { key: "temperatura_massa", label: "Temperatura da massa", unit: "°C" }] },
  { code: "corte_fio", name: "Corte a fio", equipment: "Cortadora 01", parameters: [{ key: "gramatura", label: "Gramatura configurada", unit: "g" }, { key: "velocidade", label: "Velocidade da máquina", unit: "un/min" }, { key: "perdas", label: "Perdas", unit: "kg" }] },
  { code: "forno", name: "Forno", equipment: "Forno 01", parameters: [{ key: "temperatura_z1", label: "Temperatura zona 1", unit: "°C" }, { key: "temperatura_z2", label: "Temperatura zona 2", unit: "°C" }, { key: "velocidade_esteira", label: "Velocidade da esteira", unit: "m/min" }] },
  { code: "empacotamento", name: "Empacotamento", equipment: "Empacotadora 01", parameters: [{ key: "pacotes", label: "Pacotes produzidos", unit: "un" }, { key: "peso_medio", label: "Peso médio", unit: "g" }, { key: "perdas_filme", label: "Perda de filme", unit: "m" }] },
  { code: "encaixotamento", name: "Encaixotamento", equipment: "Final de linha", parameters: [{ key: "caixas", label: "Caixas montadas", unit: "un" }, { key: "pacotes_caixa", label: "Pacotes por caixa", unit: "un" }, { key: "paletes", label: "Paletes finalizados", unit: "un" }] },
];

async function safeOperator(operatorId) {
  return /^[0-9a-f-]{36}$/i.test(operatorId ?? "") ? operatorId : null;
}

export async function loadProductionSubprocesses(cycleId) {
  if (!isSupabaseConfigured || !supabase || !/^[0-9a-f-]{36}$/i.test(cycleId ?? "")) return { rows: [], remote: false };
  const { data, error } = await supabase.from("producao_subprocessos").select("*,subprocesso_eventos(*)").eq("ciclo_id", cycleId).order("ordem");
  if (error) {
    if (["42P01", "PGRST205"].includes(error.code)) return { rows: [], remote: false };
    throw error;
  }
  return { rows: data ?? [], remote: true };
}

export async function ensureProductionSubprocesses(cycleId, operatorId) {
  const loaded = await loadProductionSubprocesses(cycleId);
  if (!loaded.remote || loaded.rows.length) return loaded;
  const operator = await safeOperator(operatorId);
  const { error } = await supabase.from("producao_subprocessos").upsert(
    ROSCA_SUBPROCESSES.map((item, index) => ({ ciclo_id: cycleId, codigo: item.code, nome: item.name, ordem: index + 1, equipamento: item.equipment, atualizado_por: operator })),
    { onConflict: "ciclo_id,codigo", ignoreDuplicates: true },
  );
  if (error) throw error;
  return loadProductionSubprocesses(cycleId);
}

export async function changeSubprocessState({ process, status, reason, operatorId }) {
  const operator = await safeOperator(operatorId);
  const { data, error } = await supabase.rpc("alterar_estado_subprocesso", {
    p_subprocesso_id: process.id, p_versao_esperada: process.versao,
    p_status: status, p_motivo: reason || null, p_operador_id: operator,
  });
  if (error) throw error;
  return data;
}

export async function saveSubprocessHourlyRecord({ process, cycleId, values, operatorId }) {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  const slot = now.toISOString();
  const operator = await safeOperator(operatorId);
  const { data, error } = await supabase.from("subprocesso_registros").upsert({
    subprocesso_id: process.id, ciclo_id: cycleId, chave_slot: slot,
    horario_referencia: slot, valores: values, operador_id: operator, preenchido_em: new Date().toISOString(),
  }, { onConflict: "subprocesso_id,chave_slot" }).select().single();
  if (error) throw error;
  return data;
}

export async function finishCycleSubprocesses(cycleId, operatorId) {
  if (!isSupabaseConfigured || !supabase || !/^[0-9a-f-]{36}$/i.test(cycleId ?? "")) return;
  const { error } = await supabase.rpc("encerrar_subprocessos_ciclo", {
    p_ciclo_id: cycleId,
    p_operador_id: await safeOperator(operatorId),
  });
  if (error && !["42883", "PGRST202"].includes(error.code)) throw error;
}
