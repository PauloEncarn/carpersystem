import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

const lineInfo = {
  PUR: { name: "Pururuca", rg: "RG.QUA.005" },
  SAL: { name: "Salgadinho", rg: "RG.QUA.004" },
  ROS: { name: "Rosca", rg: "RG.QUA.BA.003" },
};
const processNames = {
  produto_avaliacao: "Avaliação do produto",
  processo: "Avaliação do processo",
  fotografico: "Registro fotográfico",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function reportWindow(now = new Date()) {
  const end = new Date(now);
  end.setUTCMinutes(0, 0, 0);
  const start = new Date(end.getTime() - 3_600_000);
  return { start, end, key: start.toISOString().slice(0, 13) };
}

function isInWindow(filling, start, end) {
  const slot = filling.chave_slot ?? filling.valores?._slotKey;
  const instant =
    slot && String(slot).includes("T")
      ? new Date(slot)
      : new Date(filling.preenchido_em);
  return instant >= start && instant < end;
}

function detailRows(filling) {
  const values = filling?.valores ?? {};
  return [
    ...(values.apontamentos ?? []),
    ...(values.avaliacoes ?? []).map((item) => ({
      ...item,
      resultado: item.resultado ?? item.av1,
    })),
  ];
}

function formatTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function cycleStatus(cycle) {
  const values = {
    higienizacao: ["Em higienização", "#0b74b8", "#e7f5ff"],
    aguardando_liberacao: ["Aguardando liberação", "#986500", "#fff3da"],
    pronto: ["Pronta para iniciar", "#202476", "#eef0ff"],
    produzindo: ["Em produção", "#087443", "#e8f6ee"],
    bloqueado: ["Produção bloqueada", "#c50d1d", "#feecee"],
    encerrado: ["Encerrada", "#596273", "#eef1f5"],
  };
  return values[cycle.status] ?? [cycle.status ?? "Sem status", "#596273", "#eef1f5"];
}

function processCard(type, filling) {
  if (!filling)
    return `<tr><td style="padding:11px 12px;border:1px solid #f1d59a;background:#fff9ec"><strong style="font-size:13px;color:#2b303b">${processNames[type]}</strong><div style="margin-top:3px;font-size:12px;color:#986500">Pendente no período</div></td></tr>`;
  const details = detailRows(filling);
  const rows = details.length
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:8px;border-collapse:collapse">${details
        .map((item) => {
          const result = item.resultado ?? item.valor ?? "—";
          const nonConforming = ["N", "NC"].includes(String(result).toUpperCase());
          return `<tr><td style="padding:6px 4px;border-top:1px solid #e5e8ee;font-size:12px;color:#4f5665">${escapeHtml(item.maquina ? `${item.maquina} · ${item.item}` : item.item)}</td><td align="right" style="padding:6px 4px;border-top:1px solid #e5e8ee;font-size:12px;font-weight:800;color:${nonConforming ? "#c50d1d" : "#202476"}">${escapeHtml(result)}${item.unidade ? ` ${escapeHtml(item.unidade)}` : ""}${item.gramatura ? ` · ${escapeHtml(item.gramatura)}` : ""}</td></tr>`;
        })
        .join("")}</table>`
    : `<div style="margin-top:4px;font-size:12px;color:#687080">Registro realizado sem parâmetros adicionais.</div>`;
  return `<tr><td style="padding:11px 12px;border:1px solid #dfe3eb;background:#fff"><table role="presentation" width="100%"><tr><td><strong style="font-size:13px;color:#202476">${processNames[type]}</strong></td><td align="right" style="font-size:11px;font-weight:800;color:#087443">PREENCHIDO · ${escapeHtml(filling.horario ?? formatTime(filling.preenchido_em))}</td></tr></table>${rows}</td></tr>`;
}

function productionBlock(cycle, fillings, ncs) {
  const line = lineInfo[cycle.linha_id] ?? { name: cycle.linha_id, rg: "—" };
  const current = fillings.filter((item) => item.ciclo_id === cycle.id);
  const cycleNcs = ncs.filter((item) => item.ciclo_id === cycle.id);
  const openNcs = cycleNcs.filter((item) => !item.resolvida_em);
  const photoCount = current.reduce(
    (total, item) => total + (item.valores?.fotografias?.length ?? 0),
    0,
  );
  const [statusLabel, statusColor, statusBackground] = cycleStatus(cycle);
  const latestPhoto = current.flatMap((item) => item.valores?.fotografias ?? []).at(-1)?.imagem;
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 18px;border:1px solid #d9dde6;background:#fff;box-shadow:0 3px 12px rgba(25,31,55,.08)">
    <tr><td style="padding:16px 18px;border-top:5px solid #e30613;background:#fff"><table role="presentation" width="100%"><tr><td><div style="font-size:10px;font-weight:800;letter-spacing:1.2px;color:#6a7180">${escapeHtml(line.rg)} · LINHA ${escapeHtml(line.name).toUpperCase()}</div><div style="margin-top:5px;font-size:21px;font-weight:800;color:#202476">${escapeHtml(cycle.produto)}</div><div style="margin-top:3px;font-size:12px;color:#687080">${escapeHtml(cycle.metadata?.productionCode ?? cycle.id)}</div></td><td align="right" valign="top"><span style="display:inline-block;padding:7px 10px;background:${statusBackground};color:${statusColor};font-size:11px;font-weight:800">${escapeHtml(statusLabel)}</span></td></tr></table></td></tr>
    <tr><td style="padding:0 18px 14px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td width="33%" style="padding:9px;background:#f5f6fa;border-right:4px solid #fff"><div style="font-size:10px;color:#777e8c">INÍCIO DO CICLO</div><strong style="font-size:14px;color:#2b303b">${formatTime(cycle.iniciado_em)}</strong></td><td width="33%" style="padding:9px;background:#f5f6fa;border-right:4px solid #fff"><div style="font-size:10px;color:#777e8c">INÍCIO PRODUÇÃO</div><strong style="font-size:14px;color:#2b303b">${formatTime(cycle.producao_iniciada_em)}</strong></td><td width="34%" style="padding:9px;background:${openNcs.length ? "#feecee" : "#e8f6ee"}"><div style="font-size:10px;color:${openNcs.length ? "#c50d1d" : "#087443"}">NÃO CONFORMIDADES</div><strong style="font-size:14px;color:${openNcs.length ? "#c50d1d" : "#087443"}">${openNcs.length} aberta(s)</strong></td></tr></table></td></tr>
    ${openNcs.length ? `<tr><td style="padding:0 18px 12px"><div style="padding:10px 12px;border-left:5px solid #e30613;background:#fff1f2"><strong style="font-size:12px;color:#c50d1d">Atenção necessária</strong>${openNcs.map((nc) => `<div style="margin-top:4px;font-size:12px;color:#5b2730">${escapeHtml(nc.item ?? nc.descricao)} · aberta às ${formatTime(nc.aberta_em)}</div>`).join("")}</div></td></tr>` : ""}
    <tr><td style="padding:0 18px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-spacing:0 7px">${["produto_avaliacao", "processo", "fotografico"].map((type) => processCard(type, current.find((item) => item.contexto_tipo === type))).join("")}</table>${latestPhoto ? `<div style="margin-top:10px"><div style="margin-bottom:6px;font-size:11px;font-weight:800;color:#687080">ÚLTIMO REGISTRO FOTOGRÁFICO · ${photoCount} FOTO(S) NO PERÍODO</div><img src="${escapeHtml(latestPhoto)}" alt="Último registro do produto" width="240" style="display:block;width:240px;max-width:100%;height:auto;border:1px solid #dfe3eb"></div>` : ""}</td></tr>
  </table>`;
}

export async function sendHourlyEmailReport(now = new Date()) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase não configurado no servidor.");
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD)
    throw new Error("SMTP não configurado no servidor.");
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { start, end } = reportWindow(now);
  const { data: cycles, error: cycleError } = await supabase
    .from("ciclos_producao")
    .select("*")
    .lte("iniciado_em", end.toISOString())
    .or(`encerrado_em.is.null,encerrado_em.gte.${start.toISOString()}`)
    .order("linha_id");
  if (cycleError) throw cycleError;
  const ids = (cycles ?? []).map((item) => item.id);
  let fillings = [];
  let ncs = [];
  if (ids.length) {
    const { data, error } = await supabase
      .from("preenchimentos")
      .select(
        "ciclo_id,contexto_tipo,horario,chave_slot,valores,status,preenchido_em",
      )
      .in("ciclo_id", ids);
    if (error) throw error;
    fillings = (data ?? []).filter((item) => isInWindow(item, start, end));
    const { data: ncRows, error: ncError } = await supabase
      .from("ciclo_nao_conformidades")
      .select("ciclo_id,item,descricao,status,aberta_em,resolvida_em")
      .in("ciclo_id", ids);
    if (ncError) throw ncError;
    ncs = ncRows ?? [];
  }
  const period = `${start.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} | ${start.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}-${end.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}`;
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://carpersystem.vercel.app";
  const activeCycles = (cycles ?? []).filter((cycle) => !cycle.encerrado_em).length;
  const openNcs = ncs.filter((item) => !item.resolvida_em).length;
  const hourlyFillings = fillings.filter((item) => processNames[item.contexto_tipo]);
  const producingInWindow = (cycles ?? []).filter((cycle) =>
    cycle.producao_iniciada_em &&
    new Date(cycle.producao_iniciada_em) < end &&
    (!cycle.producao_encerrada_em || new Date(cycle.producao_encerrada_em) >= start),
  );
  const expectedControls = producingInWindow.length * 3;
  const pendingControls = Math.max(0, expectedControls - hourlyFillings.length);
  const summary = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:18px;background:#fff;border:1px solid #dfe3eb"><tr><td colspan="4" style="padding:14px 16px;border-bottom:1px solid #e6e9ef"><strong style="font-size:15px;color:#202476">Visão geral do período</strong></td></tr><tr><td width="25%" align="center" style="padding:14px 5px;border-right:1px solid #e6e9ef"><strong style="display:block;font-size:24px;color:#202476">${activeCycles}</strong><span style="font-size:10px;color:#687080">PRODUÇÕES ATIVAS</span></td><td width="25%" align="center" style="padding:14px 5px;border-right:1px solid #e6e9ef"><strong style="display:block;font-size:24px;color:#087443">${hourlyFillings.length}</strong><span style="font-size:10px;color:#687080">REGISTROS NA HORA</span></td><td width="25%" align="center" style="padding:14px 5px;border-right:1px solid #e6e9ef"><strong style="display:block;font-size:24px;color:${pendingControls ? "#986500" : "#087443"}">${pendingControls}</strong><span style="font-size:10px;color:#687080">CONTROLES PENDENTES</span></td><td width="25%" align="center" style="padding:14px 5px"><strong style="display:block;font-size:24px;color:${openNcs ? "#c50d1d" : "#087443"}">${openNcs}</strong><span style="font-size:10px;color:#687080">NCS ABERTAS</span></td></tr></table>`;
  const body = (cycles ?? []).length
    ? summary + (cycles ?? []).map((cycle) => productionBlock(cycle, fillings, ncs)).join("")
    : `<div style="padding:24px;border:1px solid #dfe3eb;background:#fff;text-align:center;color:#687080">Nenhuma produção ocorreu no período.</div>`;
  const html = `<!doctype html><html><body style="margin:0;background:#edf0f4;font-family:Arial,Helvetica,sans-serif;color:#252a36"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:20px 8px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:760px"><tr><td style="padding:22px 20px;background:#202476;border-bottom:6px solid #e30613"><table role="presentation" width="100%"><tr><td><img src="${siteUrl}/images/logo-cicopal-white.png" alt="Cicopal" width="145" style="display:block;width:145px;max-width:100%"></td><td align="right" valign="top" style="color:#cfd2ff;font-size:11px;font-weight:700">RELATÓRIO AUTOMÁTICO<br>QUALIDADE & PRODUÇÃO</td></tr></table><div style="margin-top:18px;color:#fff;font-size:25px;font-weight:800">Resumo operacional da última hora</div><div style="margin-top:6px;color:#cfd2ff;font-size:14px">${period}</div></td></tr><tr><td style="padding:18px 14px;background:#f6f7fb">${body}<table role="presentation" width="100%" style="margin-top:6px"><tr><td align="center" style="padding:16px;font-size:11px;line-height:18px;color:#727887">Mensagem automática · CICOPAL Sistema RG<br><a href="${siteUrl}/relatorios" style="display:inline-block;margin-top:7px;padding:9px 14px;background:#202476;color:#fff;text-decoration:none;font-weight:800">ABRIR RELATÓRIOS COMPLETOS</a></td></tr></table></td></tr></table></td></tr></table></body></html>`;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
  const recipients =
    process.env.HOURLY_REPORT_RECIPIENTS ??
    "paulo.encarnacao@cicopal.com.br,suporte.ba@cicopal.com.br,adrisia.souza@cicopal.com.br,franclin.silva@cicopal.com.br,heloisa.alves@cicopal.com.br";
  const result = await transporter.sendMail({
    from: `CICOPAL Sistema RG <${process.env.SMTP_USER}>`,
    to: recipients,
    subject: `CICOPAL - Resumo operacional - ${period}`,
    html: html.replace("<body", '<head><meta charset="utf-8"></head><body'),
  });
  return {
    messageId: result.messageId,
    cycles: (cycles ?? []).length,
    fillings: fillings.length,
    period,
  };
}
