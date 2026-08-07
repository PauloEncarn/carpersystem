import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

const statusFromDb = {
  higienizacao: "hygiene",
  aguardando_liberacao: "awaiting_release",
  pronto: "ready",
  produzindo: "producing",
  bloqueado: "blocked",
  encerrado: "ended"
};

const statusToDb = Object.fromEntries(Object.entries(statusFromDb).map(([db, ui]) => [ui, db]));

function normalizeCycle(row, events = []) {
  if (!row) return null;
  return {
    id: row.id,
    productionCode: row.metadata?.productionCode || makeRg003ProductionCode(row.produto, row.iniciado_em),
    product: row.produto,
    previousProduct: row.produto_anterior ?? "",
    reason: row.motivo_inicio,
    status: statusFromDb[row.status] ?? row.status,
    startedAt: row.iniciado_em,
    stageStartedAt: row.etapa_iniciada_em,
    productionStartedAt: row.producao_iniciada_em,
    productionEndedAt: row.producao_encerrada_em,
    endedAt: row.encerrado_em,
    activeAction: row.metadata?.activeAction ?? null,
    events: events.map((item) => ({ id: item.id, label: item.descricao, at: item.ocorrido_em, operator: item.dados?.operador_nome ?? "", ...item.dados }))
  };
}

function saoPauloDateParts(value) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

function productToken(product) {
  return String(product ?? "PRODUTO").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/^ROSCA\s+/, "").replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "PRODUTO";
}

export function makeRg003ProductionCode(product, startedAt, sequence = 1) {
  const { day, month, year } = saoPauloDateParts(startedAt);
  const base = `ROS-${productToken(product)}-${day}${month}${year}`;
  return sequence > 1 ? `${base}-${String(sequence).padStart(2, "0")}` : base;
}

export async function loadActiveRg003Cycle(lineId) {
  if (!isSupabaseConfigured || !supabase) return { cycle: null, remote: false };
  const { data: cycle, error } = await supabase.from("ciclos_producao").select("*").eq("linha_id", lineId).is("encerrado_em", null).maybeSingle();
  if (error) throw error;
  if (!cycle) return { cycle: null, remote: true };
  const { data: events, error: eventsError } = await supabase.from("eventos_ciclo").select("*").eq("ciclo_id", cycle.id).order("ocorrido_em", { ascending: true });
  if (eventsError) throw eventsError;
  return { cycle: normalizeCycle(cycle, events ?? []), remote: true };
}

export async function loadRg003CyclesByDate(lineId, dateId) {
  if (!isSupabaseConfigured || !supabase || !lineId || !dateId) return { cycles: [], remote: false };
  const start = new Date(`${dateId}T00:00:00-03:00`).toISOString();
  const endDate = new Date(`${dateId}T00:00:00-03:00`);
  endDate.setDate(endDate.getDate() + 1);
  const { data, error } = await supabase.from("ciclos_producao").select("*").eq("linha_id", lineId).gte("iniciado_em", start).lt("iniciado_em", endDate.toISOString()).order("iniciado_em", { ascending: true });
  if (error) throw error;
  return { cycles: (data ?? []).map((cycle) => normalizeCycle(cycle)), remote: true };
}

export async function startRg003Cycle({ lineId, product, reason, operatorId }) {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.rpc("iniciar_ciclo_rg003", { p_linha_id: lineId, p_produto: product, p_motivo: reason, p_operador_id: operatorId || null });
  if (error) throw error;
  let normalized = normalizeCycle(data);
  const baseCode = makeRg003ProductionCode(product, data.iniciado_em);
  const { data: sameProductCycles, error: countError } = await supabase.from("ciclos_producao").select("metadata").eq("linha_id", lineId).eq("produto", product);
  if (countError) throw countError;
  const sequence = (sameProductCycles ?? []).filter((item) => item.metadata?.productionCode?.startsWith(baseCode)).length + 1;
  const productionCode = makeRg003ProductionCode(product, data.iniciado_em, sequence);
  const { data: coded, error: codeError } = await supabase.from("ciclos_producao").update({ metadata: { ...(data.metadata ?? {}), productionCode } }).eq("id", data.id).select().single();
  if (codeError) throw codeError;
  normalized = normalizeCycle(coded);
  return normalized;
}

export async function persistCycleTransition({ cycle, status, description, operatorId, operatorName, activeAction }) {
  if (!isSupabaseConfigured || !supabase || !cycle?.id || !/^[0-9a-f-]{36}$/i.test(cycle.id)) return null;
  const occurredAt = new Date().toISOString();
  const metadata = { activeAction: activeAction ?? null, productionCode: cycle.productionCode ?? null };
  const updatePayload = { status: statusToDb[status] ?? status, etapa_iniciada_em: occurredAt, metadata };
  if (status === "producing" && !cycle.productionStartedAt) updatePayload.producao_iniciada_em = occurredAt;
  if (status === "ended") {
    updatePayload.encerrado_em = occurredAt;
    if (cycle.productionStartedAt) updatePayload.producao_encerrada_em = occurredAt;
  }
  const { error: updateError } = await supabase.from("ciclos_producao").update(updatePayload).eq("id", cycle.id);
  if (updateError) throw updateError;
  const { data: event, error: eventError } = await supabase.from("eventos_ciclo").insert({ ciclo_id: cycle.id, tipo: description.toLowerCase().replace(/[^a-z0-9]+/g, "_"), descricao: description, operador_id: operatorId || null, ocorrido_em: occurredAt, dados: { operador_nome: operatorName, activeAction: activeAction ?? null } }).select().single();
  if (eventError) throw eventError;
  return event;
}

export async function persistCycleNc({ cycle, operatorId, operatorName, data }) {
  if (!isSupabaseConfigured || !supabase || !cycle?.id || !/^[0-9a-f-]{36}$/i.test(cycle.id)) return null;
  const interrupted = data.acao === "Parar produção";
  const { data: nc, error } = await supabase.from("ciclo_nao_conformidades").insert({ ciclo_id: cycle.id, operador_id: operatorId || null, produto: cycle.product, quantidade: data.quantidade, descricao: data.descricao, causa: data.causa, acao_tomada: data.acao, interrompeu_producao: interrupted, metadata: { operador_nome: operatorName } }).select().single();
  if (error) throw error;
  return nc;
}

export async function persistRg003Record({ lineId, loteCode, recordCode, processType, operatorId, turno, registro, subregistro, cycleId, cycleStartedAt, productionCode }) {
  if (!isSupabaseConfigured || !supabase) return { remote: false };
  const productionDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(cycleStartedAt ?? Date.now()));
  const [{ data: rg, error: rgError }, { data: process, error: processError }] = await Promise.all([
    supabase.from("rgs").select("id").eq("codigo", "RG.QUA.BA.003").single(),
    supabase.from("processos").select("id,rg_id").eq("tipo", processType).eq("rg_id", "00000000-0000-0000-0000-000000000303").single()
  ]);
  if (rgError) throw rgError;
  if (processError) throw processError;
  const { data: lote, error: loteError } = await supabase.from("lotes").upsert({ codigo: loteCode, linha_id: lineId, data_producao: productionDate, produto: registro.produto ?? null, metadata: { ciclo_id: cycleId ?? null, codigo_producao: productionCode ?? loteCode } }, { onConflict: "codigo" }).select().single();
  if (loteError) throw loteError;
  const { data: savedRecord, error: recordError } = await supabase.from("registros").upsert({ codigo: recordCode, lote_id: lote.id, rg_id: rg.id, processo_id: process.id, operador_id: operatorId || null, turno, motivo: registro.motivo ?? null, status: "gravado", data_registro: new Date().toISOString(), metadata: { ciclo_id: cycleId ?? null, produto: registro.produto ?? null, codigo_producao: productionCode ?? loteCode, producao_iniciada_em: cycleStartedAt ?? null } }, { onConflict: "codigo" }).select().single();
  if (recordError) throw recordError;
  const hour = new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const reportedHour = subregistro.apontamentos?.[0]?.horario ?? subregistro.avaliacoes?.[0]?.horario ?? hour.slice(0, 5);
  const slotKey = ["higienizacao", "produto_liberacao"].includes(processType) ? "ciclo" : `${productionDate}T${reportedHour}`;
  const fillingStatus = subregistro.ncs?.length ? "com_nc" : "gravado";
  const fillingPayload = { registro_id: savedRecord.id, processo_id: process.id, operador_id: operatorId || null, contexto_tipo: processType, horario: reportedHour, valores: subregistro, status: fillingStatus };
  if (cycleId && /^[0-9a-f-]{36}$/i.test(cycleId)) Object.assign(fillingPayload, { ciclo_id: cycleId, chave_slot: slotKey, atualizado_por: operatorId || null });
  const editing = subregistro._persistence;
  const fillingResult = editing
    ? await supabase.rpc("atualizar_preenchimento_rg003", { p_preenchimento_id: editing.id, p_versao_esperada: editing.version, p_valores: subregistro, p_status: fillingStatus, p_operador_id: operatorId || null })
    : await supabase.from("preenchimentos").insert(fillingPayload).select().single();
  const { data: filling, error: fillingError } = fillingResult;
  if (fillingError) {
    if (fillingError.code === "23505") throw new Error("CONFLICT: este ciclo e horário já foram gravados por outro técnico.");
    throw fillingError;
  }
  for (const [index, nc] of (subregistro.ncs ?? []).entries()) {
    const sourceCode = `${recordCode}-${nc.id ?? index + 1}`;
    const { error: ncError } = await supabase.from("nao_conformidades").upsert({ codigo_origem: sourceCode, lote_id: lote.id, registro_id: savedRecord.id, preenchimento_id: filling.id, processo_id: process.id, horario: nc.horario || hour, status: (nc.status ?? "aberta").toLowerCase(), produto_afetado: registro.produto ?? null, quantidade_impacto: nc.quantidade ?? null, descricao: nc.descricao ?? nc.item, causa: nc.causa ?? null, acao_corretiva: nc.acao ?? null, disposicao_imediata: nc.disposicaoImediata ?? null, disposicao_final: nc.disposicaoFinal ?? null, criado_por: operatorId || null }, { onConflict: "codigo_origem" });
    if (ncError) throw ncError;
  }
  return { remote: true, recordId: savedRecord.id, fillingId: filling.id };
}

export async function loadRg003Record(recordCode) {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data: record, error } = await supabase.from("registros").select("id,codigo,data_registro,operador_id,metadata,preenchimentos(id,valores,status,preenchido_em,versao,operador_id)").eq("codigo", recordCode).maybeSingle();
  if (error) throw error;
  if (!record?.preenchimentos?.length) return null;
  const latest = [...record.preenchimentos].sort((a, b) => new Date(b.preenchido_em) - new Date(a.preenchido_em))[0];
  return { record, fillingId: latest.id, subregistro: latest.valores, filledAt: latest.preenchido_em, version: latest.versao, operatorId: latest.operador_id };
}
