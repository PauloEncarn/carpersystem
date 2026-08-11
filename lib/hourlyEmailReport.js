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

function statusBadge(ok, label) {
  return `<span style="display:inline-block;margin:2px;padding:5px 8px;background:${ok ? "#e8f6ee" : "#fff3da"};color:${ok ? "#198754" : "#986500"};font-size:12px;font-weight:700">${ok ? "✓" : "PENDENTE"} ${escapeHtml(label)}</span>`;
}

function productionBlock(cycle, fillings) {
  const line = lineInfo[cycle.linha_id] ?? { name: cycle.linha_id, rg: "—" };
  const current = fillings.filter((item) => item.ciclo_id === cycle.id);
  const ncCount = current.reduce(
    (total, item) => total + (item.valores?.ncs?.length ?? 0),
    0,
  );
  const photoCount = current.reduce(
    (total, item) => total + (item.valores?.fotografias?.length ?? 0),
    0,
  );
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 16px;border:1px solid #dfe3eb;background:#fff">
    <tr><td style="padding:16px;background:#202476;color:#fff"><div style="font-size:11px;font-weight:700;letter-spacing:1px">${escapeHtml(line.rg)} · LINHA ${escapeHtml(line.name).toUpperCase()}</div><div style="margin-top:4px;font-size:22px;font-weight:800">${escapeHtml(cycle.produto)}</div><div style="margin-top:4px;font-size:12px;color:#cfd2ff">${escapeHtml(cycle.metadata?.productionCode ?? cycle.id)}</div></td></tr>
    <tr><td style="padding:14px"><div style="margin-bottom:12px">${statusBadge(
      current.some((item) => item.contexto_tipo === "produto_avaliacao"),
      "Produto",
    )}${statusBadge(
      current.some((item) => item.contexto_tipo === "processo"),
      "Processo",
    )}${statusBadge(
      current.some((item) => item.contexto_tipo === "fotografico"),
      "Foto",
    )}<span style="display:inline-block;margin:2px;padding:5px 8px;background:${ncCount ? "#feecee" : "#f2f4f7"};color:${ncCount ? "#d80b1b" : "#606775"};font-size:12px;font-weight:700">${ncCount} NC · ${photoCount} foto(s)</span></div>
      ${["produto_avaliacao", "processo", "fotografico"]
        .map((type) => {
          const filling = current.find((item) => item.contexto_tipo === type);
          if (!filling)
            return `<div style="margin-top:8px;padding:10px;border-left:4px solid #e0a100;background:#fff8e8"><strong>${processNames[type]}</strong><div style="font-size:12px;color:#805d00">Sem preenchimento para a hora</div></div>`;
          const details = detailRows(filling);
          return `<div style="margin-top:8px;padding:10px;border-left:4px solid #202476;background:#f6f7fb"><strong>${processNames[type]}</strong>${details.length ? `<table width="100%" style="margin-top:6px;border-collapse:collapse">${details.map((item) => `<tr><td style="padding:4px;border-bottom:1px solid #e5e7ec;font-size:12px">${escapeHtml(item.maquina ? `${item.maquina} · ${item.item}` : item.item)}</td><td style="padding:4px;border-bottom:1px solid #e5e7ec;text-align:right;font-size:12px;font-weight:700">${escapeHtml(item.resultado ?? item.valor ?? "—")} ${escapeHtml(item.unidade ?? "")} ${escapeHtml(item.gramatura ?? "")}</td></tr>`).join("")}</table>` : `<div style="font-size:12px;color:#687080">Registro realizado</div>`}</div>`;
        })
        .join("")}
    </td></tr></table>`;
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
  if (ids.length) {
    const { data, error } = await supabase
      .from("preenchimentos")
      .select(
        "ciclo_id,contexto_tipo,horario,chave_slot,valores,status,preenchido_em",
      )
      .in("ciclo_id", ids);
    if (error) throw error;
    fillings = (data ?? []).filter((item) => isInWindow(item, start, end));
  }
  const period = `${start.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} | ${start.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}-${end.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}`;
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://carpersystem.vercel.app";
  const body = (cycles ?? []).length
    ? (cycles ?? []).map((cycle) => productionBlock(cycle, fillings)).join("")
    : `<div style="padding:24px;border:1px solid #dfe3eb;background:#fff;text-align:center;color:#687080">Nenhuma produção ocorreu no período.</div>`;
  const html = `<!doctype html><html><body style="margin:0;background:#eef0f4;font-family:Arial,sans-serif;color:#252a36"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 10px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:760px"><tr><td style="padding:20px;background:#202476;border-bottom:6px solid #e30613"><img src="${siteUrl}/images/logo-cicopal-white.png" alt="Cicopal" width="150" style="display:block;max-width:150px"><div style="margin-top:14px;color:#fff;font-size:24px;font-weight:800">Resumo operacional por hora</div><div style="margin-top:5px;color:#cfd2ff;font-size:14px">${period}</div></td></tr><tr><td style="padding:18px;background:#f6f7fb">${body}<div style="padding:12px;text-align:center;font-size:11px;color:#727887">Mensagem automática · CICOPAL Sistema RG · <a href="${siteUrl}/relatorios" style="color:#202476">Abrir relatórios</a></div></td></tr></table></td></tr></table></body></html>`;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
  const recipients =
    process.env.HOURLY_REPORT_RECIPIENTS ??
    "paulo.encarnacao@cicopal.com.br,suporte.ba@cicopal.com.br";
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
