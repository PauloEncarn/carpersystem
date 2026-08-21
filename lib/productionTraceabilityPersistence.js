import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

const uuid = (value) => /^[0-9a-f-]{36}$/i.test(value ?? "");
async function operatorId(value) {
  if (!uuid(value) || !supabase) return null;
  const { data } = await supabase
    .from("operadores")
    .select("id")
    .eq("id", value)
    .maybeSingle();
  return data?.id ?? null;
}
export async function loadProductionTraceability(cycleId) {
  if (!isSupabaseConfigured || !supabase || !uuid(cycleId))
    return {
      remote: false,
      supplies: [],
      recipes: [],
      lots: [],
      batches: [],
      packers: [],
      metalTests: [],
      interruptions: [],
    };
  const [supplies, recipes, lots, batches, packers, metalTests, interruptions] =
    await Promise.all([
      supabase.from("insumos").select("*").eq("ativo", true).order("nome"),
      supabase
        .from("receitas")
        .select("*,receita_insumos(*,insumos(*))")
        .eq("ativa", true),
      supabase
        .from("automacao_lotes")
        .select("*,insumos(*)")
        .eq("ciclo_id", cycleId)
        .order("iniciado_em", { ascending: false }),
      supabase
        .from("bateladas")
        .select("*,receitas(*),batelada_insumos(*,insumos(*))")
        .eq("ciclo_id", cycleId)
        .order("numero", { ascending: false }),
      supabase
        .from("empacotamento_configuracoes")
        .select("*")
        .eq("ciclo_id", cycleId)
        .order("vigente_desde", { ascending: false }),
      supabase
        .from("deteccao_metal_testes")
        .select("*")
        .eq("ciclo_id", cycleId)
        .order("horario_referencia", { ascending: false }),
      supabase
        .from("producao_interrupcoes")
        .select("*")
        .eq("ciclo_id", cycleId)
        .order("iniciada_em", { ascending: false }),
    ]);
  const error = [
    supplies,
    recipes,
    lots,
    batches,
    packers,
    metalTests,
    interruptions,
  ].find((result) => result.error)?.error;
  if (error) {
    if (["42P01", "PGRST205"].includes(error.code))
      return {
        remote: false,
        supplies: [],
        recipes: [],
        lots: [],
        batches: [],
        packers: [],
        metalTests: [],
        interruptions: [],
      };
    throw error;
  }
  return {
    remote: true,
    supplies: supplies.data ?? [],
    recipes: recipes.data ?? [],
    lots: lots.data ?? [],
    batches: batches.data ?? [],
    packers: packers.data ?? [],
    metalTests: metalTests.data ?? [],
    interruptions: interruptions.data ?? [],
  };
}

export async function loadPackerConfigurations(cycleId) {
  if (!isSupabaseConfigured || !supabase || !uuid(cycleId)) return [];
  const { data, error } = await supabase
    .from("empacotamento_configuracoes")
    .select("*")
    .eq("ciclo_id", cycleId)
    .order("vigente_desde", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
export async function replaceAutomationLot({
  cycleId,
  supplyId,
  supplierLot,
  supplier,
  expiry,
  userId,
  closureOutcome = "finalizado",
  closureProblem = "",
}) {
  const user = await operatorId(userId);
  const now = new Date().toISOString();
  let closeResult = await supabase
    .from("automacao_lotes")
    .update({ encerrado_em: now, motivo_encerramento: closureOutcome, problema_encerramento: closureProblem || null })
    .eq("ciclo_id", cycleId)
    .eq("insumo_id", supplyId)
    .is("encerrado_em", null);
  if (["42703", "PGRST204"].includes(closeResult.error?.code)) {
    closeResult = await supabase.from("automacao_lotes").update({ encerrado_em: now }).eq("ciclo_id", cycleId).eq("insumo_id", supplyId).is("encerrado_em", null);
  }
  if (closeResult.error) throw closeResult.error;
  const { data, error } = await supabase
    .from("automacao_lotes")
    .insert({
      ciclo_id: cycleId,
      insumo_id: supplyId,
      lote_fornecedor: supplierLot,
      fornecedor: supplier,
      validade: expiry,
      iniciado_em: now,
      operador_id: user,
    })
    .select("*,insumos(*)")
    .single();
  if (error) throw error;
  return data;
}
export async function createBatch({ cycleId, recipeId, inputs, userId, observation = "" }) {
  const { data, error } = await supabase.rpc("criar_batelada_com_insumos", {
    p_ciclo_id: cycleId,
    p_receita_id: recipeId,
    p_insumos: inputs,
    p_observacao: observation || "",
    p_operador_id: await operatorId(userId),
  });
  if (error) throw error;
  return data;
}
export async function finishBatch(batchId, userId) {
  const { data, error } = await supabase.rpc("marcar_batelada_pronta", {
    p_batelada_id: batchId,
    p_operador_id: await operatorId(userId),
  });
  if (error) throw error;
  return data;
}
export async function startBatchConsumption(batchId, cycleId, userId) {
  const { data, error } = await supabase.rpc("enviar_batelada_tombador", {
    p_batelada_id: batchId,
    p_ciclo_id: cycleId,
    p_operador_id: await operatorId(userId),
  });
  if (error) throw error;
  return data;
}
export async function finishActiveBatch(cycleId, userId) {
  if (!isSupabaseConfigured || !supabase || !uuid(cycleId)) return null;
  const now = new Date().toISOString();
  const user = await operatorId(userId);
  const { data, error } = await supabase.from("bateladas").update({ status: "enviada_tombador", consumida_em: now, consumida_por: user }).eq("ciclo_id", cycleId).in("status", ["em_preparacao", "pronta", "em_consumo"]).select();
  if (error) throw error;
  return data ?? [];
}
export async function savePackerConfiguration(cycleId, configurations, userId, changeReason = null) {
  const user = await operatorId(userId);
  const now = new Date().toISOString();
  await supabase
    .from("empacotamento_configuracoes")
    .update({ vigente_ate: now })
    .eq("ciclo_id", cycleId)
    .is("vigente_ate", null);
  const { data, error } = await supabase
    .from("empacotamento_configuracoes")
    .insert(
      configurations.map((item) => ({
        ciclo_id: cycleId,
        maquina: item.machine,
        ativa: item.active,
        gramatura: item.grammage || null,
        pacotes_por_caixa: item.packagesPerBox || null,
        motivo_alteracao: changeReason || null,
        vigente_desde: now,
        operador_id: user,
      })),
    )
    .select();
  if (error) throw error;
  return data;
}
export async function saveFixedHourlyRecord({
  processId,
  cycleId,
  scheduledAt,
  values,
  batchId,
  userId,
}) {
  const { data, error } = await supabase.rpc(
    "registrar_horario_fixo_subprocesso",
    {
      p_subprocesso_id: processId,
      p_ciclo_id: cycleId,
      p_horario_previsto: scheduledAt,
      p_valores: values,
      p_batelada_id: batchId || null,
      p_operador_id: await operatorId(userId),
    },
  );
  if (
    error &&
    (error.code === "23505" ||
      error.message?.includes("Horário já confirmado"))
  ) {
    const { data: existing, error: existingError } = await supabase
      .from("subprocesso_registros")
      .select("*")
      .eq("subprocesso_id", processId)
      .eq("tipo", "horario")
      .eq("horario_previsto", scheduledAt)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) return { ...existing, _alreadyConfirmed: true };
  }
  if (error) throw error;
  return data;
}
export async function rectifyHourlyRecord({
  recordId,
  values,
  reason,
  userId,
}) {
  const { data, error } = await supabase.rpc("retificar_registro_subprocesso", {
    p_registro_id: recordId,
    p_valores: values,
    p_motivo: reason,
    p_operador_id: await operatorId(userId),
  });
  if (error) throw error;
  return data;
}
export async function saveMetalTest({ cycleId, scheduledAt, values, userId }) {
  const { data, error } = await supabase
    .from("deteccao_metal_testes")
    .insert({
      ciclo_id: cycleId,
      horario_referencia: scheduledAt,
      ferroso: values.ferroso,
      nao_ferroso: values.nao_ferroso,
      inox: values.inox,
      resultado: values.resultado,
      observacao: values.observacao || null,
      operador_id: await operatorId(userId),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
export async function interruptWholeProduction({
  cycleId,
  originProcessId,
  classification,
  reason,
  userId,
}) {
  const { data, error } = await supabase.rpc("interromper_producao_global", {
    p_ciclo_id: cycleId,
    p_subprocesso_origem_id: originProcessId,
    p_classificacao: classification,
    p_motivo: reason,
    p_operador_id: await operatorId(userId),
  });
  if (error) throw error;
  return data;
}
export async function resumeWholeProduction({ cycleId, observation, userId }) {
  const { data, error } = await supabase.rpc("retomar_producao_global", {
    p_ciclo_id: cycleId,
    p_observacao: observation,
    p_operador_id: await operatorId(userId),
  });
  if (error) throw error;
  return data;
}
