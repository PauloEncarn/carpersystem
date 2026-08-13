import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import { repairTextDeep } from "@/lib/textEncoding";

const statusFromDb = {
  higienizacao: "hygiene",
  aguardando_liberacao: "awaiting_release",
  pronto: "ready",
  produzindo: "producing",
  bloqueado: "blocked",
  encerrado: "ended",
};

const statusToDb = Object.fromEntries(
  Object.entries(statusFromDb).map(([db, ui]) => [ui, db]),
);

async function resolveOperatorId(operatorId) {
  if (!operatorId || !/^[0-9a-f-]{36}$/i.test(operatorId)) return null;
  const { data, error } = await supabase
    .from("operadores")
    .select("id")
    .eq("id", operatorId)
    .maybeSingle();
  if (error || !data?.id) return null;
  return data.id;
}

function normalizeCycle(row, events = []) {
  if (!row) return null;
  return repairTextDeep({
    id: row.id,
    productionCode:
      row.metadata?.productionCode ||
      makeRg003ProductionCode(row.produto, row.iniciado_em, 1, row.linha_id),
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
    activePause: row.metadata?.activePause ?? null,
    timings: row.metadata?.timings ?? {},
    metadata: row.metadata ?? {},
    events: events.map((item) => ({
      id: item.id,
      label: item.descricao,
      at: item.ocorrido_em,
      operator: item.dados?.operador_nome ?? "",
      ...item.dados,
    })),
  });
}

function saoPauloDateParts(value) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  return Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
}

function productToken(product) {
  return (
    String(product ?? "PRODUTO")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/^ROSCA\s+/, "")
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "PRODUTO"
  );
}

function storageToken(value, fallback = "nao-identificado") {
  return String(value ?? fallback).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;
}

function dataUrlToBlob(dataUrl) {
  const [header, encoded] = String(dataUrl).split(",", 2);
  const mime = header.match(/^data:([^;]+);base64$/)?.[1] ?? "image/jpeg";
  const bytes = atob(encoded);
  const buffer = new Uint8Array(bytes.length);
  for (let index = 0; index < bytes.length; index += 1) buffer[index] = bytes.charCodeAt(index);
  return new Blob([buffer], { type: mime });
}

async function loadCycleStorageContext(cycleOrId) {
  if (typeof cycleOrId === "object" && cycleOrId?.id) return cycleOrId;
  const { data, error } = await supabase.from("ciclos_producao")
    .select("id,linha_id,produto,iniciado_em,metadata").eq("id", cycleOrId).single();
  if (error) throw error;
  return data;
}

async function uploadOperationalPhoto({ image, cycle, category, hour = "", fileName = "evidencia.jpg" }) {
  if (!image || !String(image).startsWith("data:")) return image ?? null;
  const context = await loadCycleStorageContext(cycle);
  const { year, month, day } = saoPauloDateParts(context.startedAt ?? context.iniciado_em ?? new Date());
  const line = storageToken(context.lineId ?? context.linha_id, "linha");
  const production = storageToken(context.productionCode ?? context.metadata?.productionCode ?? context.id, "producao");
  const safeHour = hour ? `${storageToken(hour.replace(":", "h"))}_` : "";
  const originalBase = storageToken(fileName.replace(/\.[^.]+$/, ""), "foto");
  const extension = image.startsWith("data:image/png") ? "png" : "jpg";
  const uniqueId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const path = ["linhas", line, year, month, day, "producoes", production, storageToken(category), `${safeHour}${originalBase}_${uniqueId}.${extension}`].join("/");
  const { error } = await supabase.storage.from("rg-fotos").upload(path, dataUrlToBlob(image), {
    contentType: extension === "png" ? "image/png" : "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from("rg-fotos").getPublicUrl(path).data.publicUrl;
}

async function uploadSubrecordPhotos(subregistro, cycle) {
  const fotografias = await Promise.all((subregistro.fotografias ?? []).map(async (photo) => ({
    ...photo,
    imagem: await uploadOperationalPhoto({ image: photo.imagem, cycle, category: "producao", hour: photo.horario, fileName: photo.nome }),
  })));
  return fotografias.length ? { ...subregistro, fotografias } : subregistro;
}

export function makeRg003ProductionCode(
  product,
  startedAt,
  sequence = 1,
  lineId = "ROS",
) {
  const { day, month, year } = saoPauloDateParts(startedAt);
  const prefix = { ROS: "ROS", PUR: "PUR", SAL: "SAL" }[lineId] ?? lineId;
  const base = `${prefix}-${productToken(product)}-${day}${month}${year}`;
  return sequence > 1 ? `${base}-${String(sequence).padStart(2, "0")}` : base;
}

export async function loadActiveRg003Cycle(lineId) {
  if (!isSupabaseConfigured || !supabase) return { cycle: null, remote: false };
  const { data: cycle, error } = await supabase
    .from("ciclos_producao")
    .select("*")
    .eq("linha_id", lineId)
    .is("encerrado_em", null)
    .maybeSingle();
  if (error) throw error;
  if (!cycle) return { cycle: null, remote: true };
  const { data: events, error: eventsError } = await supabase
    .from("eventos_ciclo")
    .select("*")
    .eq("ciclo_id", cycle.id)
    .order("ocorrido_em", { ascending: true });
  if (eventsError) throw eventsError;
  return { cycle: normalizeCycle(cycle, events ?? []), remote: true };
}

export async function loadRg003CyclesByDate(lineId, dateId) {
  if (!isSupabaseConfigured || !supabase || !lineId || !dateId)
    return { cycles: [], remote: false };
  const start = new Date(`${dateId}T00:00:00-03:00`).toISOString();
  const endDate = new Date(`${dateId}T00:00:00-03:00`);
  endDate.setDate(endDate.getDate() + 1);
  const { data, error } = await supabase
    .from("ciclos_producao")
    .select("*")
    .eq("linha_id", lineId)
    .gte("iniciado_em", start)
    .lt("iniciado_em", endDate.toISOString())
    .order("iniciado_em", { ascending: true });
  if (error) throw error;
  return {
    cycles: (data ?? []).map((cycle) => normalizeCycle(cycle)),
    remote: true,
  };
}

export async function startRg003Cycle({
  lineId,
  documentCode = "RG.QUA.BA.003",
  product,
  reason,
  operatorId,
}) {
  if (!isSupabaseConfigured || !supabase) return null;
  const safeOperatorId = await resolveOperatorId(operatorId);
  const { data, error } = await supabase.rpc("iniciar_ciclo_rg003", {
    p_linha_id: lineId,
    p_produto: product,
    p_motivo: reason,
    p_operador_id: safeOperatorId,
  });
  if (error) throw error;
  let { data: cycleRg } = await supabase
    .from("rgs")
    .select("id")
    .eq("codigo", documentCode)
    .maybeSingle();
  if (!cycleRg && documentCode === "RG.QUA.004") {
    const legacyRg = await supabase
      .from("rgs")
      .select("id")
      .eq("codigo", "RG.QUA.BA.004")
      .maybeSingle();
    cycleRg = legacyRg.data;
  }
  let normalized = normalizeCycle(data);
  const baseCode = makeRg003ProductionCode(
    product,
    data.iniciado_em,
    1,
    lineId,
  );
  const { data: sameProductCycles, error: countError } = await supabase
    .from("ciclos_producao")
    .select("metadata")
    .eq("linha_id", lineId)
    .eq("produto", product);
  if (countError) throw countError;
  const sequence =
    (sameProductCycles ?? []).filter((item) =>
      item.metadata?.productionCode?.startsWith(baseCode),
    ).length + 1;
  const productionCode = makeRg003ProductionCode(
    product,
    data.iniciado_em,
    sequence,
    lineId,
  );
  const { data: coded, error: codeError } = await supabase
    .from("ciclos_producao")
    .update({
      ...(cycleRg?.id ? { rg_id: cycleRg.id } : {}),
      metadata: { ...(data.metadata ?? {}), productionCode },
    })
    .eq("id", data.id)
    .select()
    .single();
  if (codeError) throw codeError;
  normalized = normalizeCycle(coded);
  return normalized;
}

export async function persistCycleTransition({
  cycle,
  status,
  description,
  operatorId,
  operatorName,
  activeAction,
}) {
  if (
    !isSupabaseConfigured ||
    !supabase ||
    !cycle?.id ||
    !/^[0-9a-f-]{36}$/i.test(cycle.id)
  )
    return null;
  const safeOperatorId = await resolveOperatorId(operatorId);
  const occurredAt = new Date().toISOString();
  const metadata = {
    ...(cycle.metadata ?? {}),
    activeAction: activeAction ?? null,
    productionCode: cycle.productionCode ?? null,
    activePause: cycle.activePause ?? null,
    timings: cycle.timings ?? {},
  };
  const updatePayload = {
    status: statusToDb[status] ?? status,
    etapa_iniciada_em: occurredAt,
    metadata,
  };
  if (status === "producing")
    updatePayload.producao_iniciada_em = cycle.productionStartedAt ?? occurredAt;
  if (status === "ended") {
    updatePayload.encerrado_em = occurredAt;
    if (cycle.productionStartedAt)
      updatePayload.producao_encerrada_em = occurredAt;
  }
  const { error: updateError } = await supabase
    .from("ciclos_producao")
    .update(updatePayload)
    .eq("id", cycle.id);
  if (updateError) throw updateError;
  const { data: event, error: eventError } = await supabase
    .from("eventos_ciclo")
    .insert({
      ciclo_id: cycle.id,
      tipo: description.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      descricao: description,
      operador_id: safeOperatorId,
      ocorrido_em: occurredAt,
      dados: {
        operador_nome: operatorName,
        activeAction: activeAction ?? null,
      },
    })
    .select()
    .single();
  if (eventError) throw eventError;
  return event;
}

export async function persistCycleNc({
  cycle,
  operatorId,
  operatorName,
  data,
}) {
  if (
    !isSupabaseConfigured ||
    !supabase ||
    !cycle?.id ||
    !/^[0-9a-f-]{36}$/i.test(cycle.id)
  )
    return null;
  const safeOperatorId = await resolveOperatorId(operatorId);
  const interrupted = ["Parar produção", "Pausar produção"].includes(data.acao);
  const photoBefore = await uploadOperationalPhoto({ image: data.fotoAntes, cycle, category: "nc_antes" });
  const { data: nc, error } = await supabase
    .from("ciclo_nao_conformidades")
    .insert({
      ciclo_id: cycle.id,
      operador_id: safeOperatorId,
      produto: cycle.product,
      quantidade: data.quantidade,
      descricao: data.descricao,
      causa: data.causa,
      acao_tomada: data.acao,
      interrompeu_producao: interrupted,
      foto_antes: photoBefore,
      aberta_em: new Date().toISOString(),
      metadata: { operador_nome: operatorName, tipo_interrupcao: data.acao },
    })
    .select()
    .single();
  if (error) throw error;
  return nc;
}

export async function persistChecklistCycleNcs({ cycle, operatorId, operatorName, processType, ncs }) {
  if (!isSupabaseConfigured || !supabase || !cycle?.id || !/^[0-9a-f-]{36}$/i.test(cycle.id) || !ncs?.length) return [];
  const safeOperatorId = await resolveOperatorId(operatorId);
  const { data: existing, error: existingError } = await supabase
    .from("ciclo_nao_conformidades")
    .select("id,item,metadata")
    .eq("ciclo_id", cycle.id)
    .eq("contexto_tipo", processType)
    .is("resolvida_em", null);
  if (existingError) throw existingError;
  const freshNcs = ncs.filter((nc) =>
    !(existing ?? []).some((item) =>
      item.item === nc.item &&
      String(item.metadata?.horario ?? "") === String(nc.horario ?? ""),
    ),
  );
  if (!freshNcs.length) return existing ?? [];
  const rows = await Promise.all(freshNcs.map(async (nc) => ({
    ciclo_id: cycle.id,
    operador_id: safeOperatorId,
    produto: cycle.product,
    quantidade: nc.quantidade ?? "-",
    descricao: nc.descricao ?? nc.item,
    causa: nc.causa ?? "Não informada",
    acao_tomada: nc.acao ?? "Aguardando resolução",
    status: "aberta",
    contexto_tipo: processType,
    item: nc.item,
    foto_antes: await uploadOperationalPhoto({ image: nc.fotoAntes, cycle, category: "nc_antes" }),
    aberta_em: new Date().toISOString(),
    metadata: { operador_nome: operatorName, grupo: nc.grupo ?? null, horario: nc.horario ?? "", rodada_id: nc.rodadaId ?? null, numero_rodada: nc.rodada ?? null },
  })));
  const { data, error } = await supabase.from("ciclo_nao_conformidades").insert(rows).select();
  if (error) throw error;
  return data ?? [];
}

export async function resolveCycleNc({ ncId, operatorId, resolution, photoAfter }) {
  if (!isSupabaseConfigured || !supabase || !ncId) return null;
  const safeOperatorId = await resolveOperatorId(operatorId);
  const { data: currentNc, error: currentNcError } = await supabase
    .from("ciclo_nao_conformidades").select("ciclo_id").eq("id", ncId).single();
  if (currentNcError) throw currentNcError;
  const uploadedPhoto = await uploadOperationalPhoto({ image: photoAfter, cycle: currentNc.ciclo_id, category: "nc_depois" });
  const { data, error } = await supabase.from("ciclo_nao_conformidades").update({
    status: "resolvida",
    resolvida_em: new Date().toISOString(),
    resolvida_por: safeOperatorId,
    resolucao: resolution,
    foto_depois: uploadedPhoto,
  }).eq("id", ncId).select().single();
  if (error) throw error;
  return data;
}

export async function loadOpenCycleNcs(cycleId, processType) {
  if (!isSupabaseConfigured || !supabase || !cycleId || !/^[0-9a-f-]{36}$/i.test(cycleId)) return [];
  let query = supabase.from("ciclo_nao_conformidades").select("*").eq("ciclo_id", cycleId).is("resolvida_em", null).order("aberta_em");
  if (processType) query = query.eq("contexto_tipo", processType);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function loadHygieneRounds(cycleId) {
  if (!isSupabaseConfigured || !supabase || !cycleId || !/^[0-9a-f-]{36}$/i.test(cycleId)) return [];
  const { data, error } = await supabase.from("higienizacao_rodadas").select("*")
    .eq("ciclo_id", cycleId).order("numero", { ascending: true });
  if (error) {
    if (["42P01", "PGRST205"].includes(error.code)) return [];
    throw error;
  }
  return data ?? [];
}

export async function submitOperationalHygieneRound({ cycle, operatorId, payload, previousRoundId = null }) {
  if (!isSupabaseConfigured || !supabase || !cycle?.id || !/^[0-9a-f-]{36}$/i.test(cycle.id)) return null;
  const safeOperatorId = await resolveOperatorId(operatorId);
  const existing = await loadHygieneRounds(cycle.id);
  const { data, error } = await supabase.from("higienizacao_rodadas").insert({
    ciclo_id: cycle.id,
    numero: existing.length + 1,
    rodada_anterior_id: previousRoundId,
    status: "aguardando_qualidade",
    dados_operacao: payload,
    executada_por: safeOperatorId,
    execucao_iniciada_em: cycle.stageStartedAt ?? cycle.startedAt ?? new Date().toISOString(),
    enviada_inspecao_em: new Date().toISOString(),
  }).select().single();
  if (error) throw error;
  await supabase.from("eventos_ciclo").insert({
    ciclo_id: cycle.id,
    tipo: "higienizacao_enviada_qualidade",
    descricao: `Higienização enviada para inspeção · rodada ${data.numero}`,
    operador_id: safeOperatorId,
    dados: { rodada_id: data.id, numero_rodada: data.numero },
  });
  return data;
}

export async function inspectHygieneRound({ round, operatorId, payload }) {
  if (!isSupabaseConfigured || !supabase || !round?.id) return null;
  const safeOperatorId = await resolveOperatorId(operatorId);
  const hasNc = (payload.ncs ?? []).length > 0;
  const { data, error } = await supabase.rpc("inspecionar_higienizacao", {
    p_rodada_id: round.id,
    p_versao_esperada: round.versao,
    p_dados_qualidade: payload,
    p_status: hasNc ? "em_correcao" : "aprovada",
    p_operador_id: safeOperatorId,
  });
  if (error) throw error;
  await supabase.from("eventos_ciclo").insert({
    ciclo_id: round.ciclo_id,
    tipo: hasNc ? "higienizacao_reprovada" : "higienizacao_aprovada",
    descricao: `${hasNc ? "Higienização reprovada" : "Higienização aprovada"} pela Qualidade · rodada ${round.numero}`,
    operador_id: safeOperatorId,
    dados: { rodada_id: round.id, numero_rodada: round.numero, nao_conformidades: payload.ncs?.length ?? 0 },
  });
  return data;
}

export async function startCyclePause({ cycleId, operatorId, reason, photoBefore }) {
  if (!isSupabaseConfigured || !supabase || !cycleId || !/^[0-9a-f-]{36}$/i.test(cycleId)) return { id: `local-pause-${Date.now()}`, iniciada_em: new Date().toISOString() };
  const safeOperatorId = await resolveOperatorId(operatorId);
  const uploadedPhoto = await uploadOperationalPhoto({ image: photoBefore, cycle: cycleId, category: "pausa_antes" });
  const { data, error } = await supabase.from("ciclo_pausas").insert({ ciclo_id: cycleId, motivo: reason, iniciada_por: safeOperatorId, foto_antes: uploadedPhoto }).select().single();
  if (error) throw error;
  return data;
}

export async function finishCyclePause({ pauseId, operatorId, observation, photoAfter }) {
  if (!isSupabaseConfigured || !supabase || !pauseId || !/^[0-9a-f-]{36}$/i.test(pauseId)) return null;
  const safeOperatorId = await resolveOperatorId(operatorId);
  const { data: pause, error: pauseError } = await supabase.from("ciclo_pausas").select("ciclo_id").eq("id", pauseId).single();
  if (pauseError) throw pauseError;
  const uploadedPhoto = await uploadOperationalPhoto({ image: photoAfter, cycle: pause.ciclo_id, category: "pausa_depois" });
  const { data, error } = await supabase.from("ciclo_pausas").update({ encerrada_em: new Date().toISOString(), encerrada_por: safeOperatorId, observacao_retomada: observation, foto_depois: uploadedPhoto }).eq("id", pauseId).select().single();
  if (error) throw error;
  return data;
}

export async function persistRg003Record({
  documentCode = "RG.QUA.BA.003",
  lineId,
  loteCode,
  recordCode,
  processType,
  operatorId,
  turno,
  registro,
  subregistro,
  cycleId,
  cycleStartedAt,
  productionCode,
}) {
  if (!isSupabaseConfigured || !supabase) return { remote: false };
  const safeOperatorId = await resolveOperatorId(operatorId);
  const storageCycle = cycleId && /^[0-9a-f-]{36}$/i.test(cycleId)
    ? await loadCycleStorageContext(cycleId)
    : { id: recordCode, lineId, startedAt: cycleStartedAt, productionCode };
  const storedSubrecord = await uploadSubrecordPhotos(subregistro, storageCycle);
  const productionDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date(cycleStartedAt ?? Date.now()));
  let { data: rg, error: rgError } = await supabase
    .from("rgs")
    .select("id")
    .eq("codigo", documentCode)
    .single();
  if (rgError && documentCode === "RG.QUA.004") {
    const legacyResult = await supabase
      .from("rgs")
      .select("id")
      .eq("codigo", "RG.QUA.BA.004")
      .single();
    rg = legacyResult.data;
    rgError = legacyResult.error;
  }
  if (rgError) throw rgError;
  const { data: process, error: processError } = await supabase
    .from("processos")
    .select("id,rg_id")
    .eq("tipo", processType)
    .eq("rg_id", rg.id)
    .single();
  if (processError) throw processError;
  const { data: existingLote, error: existingLoteError } = await supabase
    .from("lotes")
    .select("*")
    .eq("linha_id", lineId)
    .eq("data_producao", productionDate)
    .maybeSingle();
  if (existingLoteError) throw existingLoteError;
  let lote = existingLote;
  if (!lote) {
    const dailyCode = `${lineId}-${productionDate.replaceAll("-", "")}`;
    const { data: createdLote, error: loteError } = await supabase
      .from("lotes")
      .insert({
        codigo: dailyCode,
        linha_id: lineId,
        data_producao: productionDate,
        produto: "Produções do dia",
        metadata: { container_dia: true },
      })
      .select()
      .single();
    if (loteError) throw loteError;
    lote = createdLote;
  }
  const { data: savedRecord, error: recordError } = await supabase
    .from("registros")
    .upsert(
      {
        codigo: recordCode,
        lote_id: lote.id,
        rg_id: rg.id,
        processo_id: process.id,
        operador_id: safeOperatorId,
        turno,
        motivo: registro.motivo ?? null,
        status: "gravado",
        data_registro: new Date().toISOString(),
        metadata: {
          ciclo_id: cycleId ?? null,
          produto: registro.produto ?? null,
          codigo_producao: productionCode ?? loteCode,
          producao_iniciada_em: cycleStartedAt ?? null,
        },
      },
      { onConflict: "codigo" },
    )
    .select()
    .single();
  if (recordError) throw recordError;
  const hour = new Date().toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const requestedHour =
    storedSubrecord.apontamentos?.[0]?.horario ??
    storedSubrecord.avaliacoes?.[0]?.horario ??
    "";
  const reportedHour = /^([01]\d|2[0-3]):[0-5]\d$/.test(requestedHour)
    ? requestedHour
    : hour.slice(0, 5);
  const slotKey = ["higienizacao", "produto_liberacao"].includes(processType)
    ? "ciclo"
    : (subregistro._slotKey ?? `${productionDate}T${reportedHour}`);
  const fillingStatus = storedSubrecord.ncs?.length ? "com_nc" : "gravado";
  const fillingPayload = {
    registro_id: savedRecord.id,
    processo_id: process.id,
    operador_id: safeOperatorId,
    contexto_tipo: processType,
    horario: reportedHour,
    valores: storedSubrecord,
    status: fillingStatus,
  };
  if (cycleId && /^[0-9a-f-]{36}$/i.test(cycleId))
    Object.assign(fillingPayload, {
      ciclo_id: cycleId,
      chave_slot: slotKey,
      atualizado_por: safeOperatorId,
    });
  const editing = subregistro._persistence;
  const fillingResult = editing
    ? await supabase.rpc("atualizar_preenchimento_rg003", {
        p_preenchimento_id: editing.id,
        p_versao_esperada: editing.version,
        p_valores: storedSubrecord,
        p_status: fillingStatus,
        p_operador_id: safeOperatorId,
      })
    : await supabase
        .from("preenchimentos")
        .insert(fillingPayload)
        .select()
        .single();
  const { data: filling, error: fillingError } = fillingResult;
  if (fillingError) {
    if (fillingError.code === "23505")
      throw new Error(
        "CONFLICT: este ciclo e horário já foram gravados por outro técnico.",
      );
    throw fillingError;
  }
  for (const [index, nc] of (storedSubrecord.ncs ?? []).entries()) {
    const sourceCode = `${recordCode}-${nc.id ?? index + 1}`;
    const { error: ncError } = await supabase.from("nao_conformidades").upsert(
      {
        codigo_origem: sourceCode,
        lote_id: lote.id,
        registro_id: savedRecord.id,
        preenchimento_id: filling.id,
        processo_id: process.id,
        horario: hour,
        status: (nc.status ?? "aberta").toLowerCase(),
        produto_afetado: registro.produto ?? null,
        quantidade_impacto: nc.quantidade ?? null,
        descricao: nc.descricao ?? nc.item,
        causa: nc.causa ?? null,
        acao_corretiva: nc.acao ?? null,
        disposicao_imediata: nc.disposicaoImediata ?? null,
        disposicao_final: nc.disposicaoFinal ?? null,
        criado_por: safeOperatorId,
      },
      { onConflict: "codigo_origem" },
    );
    if (ncError) throw ncError;
  }
  return { remote: true, recordId: savedRecord.id, fillingId: filling.id };
}

export async function loadRg003Record(recordCode) {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data: record, error } = await supabase
    .from("registros")
    .select(
      "id,codigo,data_registro,operador_id,metadata,preenchimentos(id,valores,status,preenchido_em,versao,operador_id)",
    )
    .eq("codigo", recordCode)
    .maybeSingle();
  if (error) throw error;
  if (!record?.preenchimentos?.length) return null;
  const fillings = [...record.preenchimentos]
    .sort((a, b) => new Date(a.preenchido_em) - new Date(b.preenchido_em))
    .map((item) => ({
      fillingId: item.id,
      subregistro: item.valores,
      filledAt: item.preenchido_em,
      version: item.versao,
      operatorId: item.operador_id,
    }));
  const latest = fillings[fillings.length - 1];
  return repairTextDeep({ record, fillings, ...latest });
}
