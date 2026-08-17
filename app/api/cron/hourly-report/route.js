import { sendDailyEmailReport } from "@/lib/hourlyEmailReport";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request) {
  const expected =
    process.env.CRON_SECRET ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (
    !expected ||
    request.headers.get("authorization") !== `Bearer ${expected}`
  ) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const saoPauloHour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );
  // Proteção adicional: mesmo que o cron antigo ainda dispare a cada hora,
  // nenhuma consulta ao banco ou envio ocorre fora da janela diária das 15h.
  if (saoPauloHour !== 15) {
    return Response.json({
      ok: true,
      skipped: true,
      reason: "outside_daily_window",
      scheduledHour: "15:00 America/Sao_Paulo",
    });
  }
  const reportKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false } },
  );
  try {
    const { data: previous } = await supabase
      .from("hourly_email_dispatches")
      .select("status")
      .eq("report_key", reportKey)
      .maybeSingle();
    if (previous?.status === "sent") {
      return Response.json({
        ok: true,
        skipped: true,
        reason: "already_sent",
        reportKey,
      });
    }
    await supabase
      .from("hourly_email_dispatches")
      .upsert(
        {
          report_key: reportKey,
          status: "sending",
          attempted_at: new Date().toISOString(),
          error: null,
        },
        { onConflict: "report_key" },
      );
    const result = await sendDailyEmailReport(now);
    await supabase
      .from("hourly_email_dispatches")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        metadata: result,
      })
      .eq("report_key", reportKey);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    await supabase
      .from("hourly_email_dispatches")
      .upsert(
        {
          report_key: reportKey,
          status: "failed",
          attempted_at: new Date().toISOString(),
          error: error?.message ?? "Falha no envio",
        },
        { onConflict: "report_key" },
      );
    return Response.json(
      { ok: false, error: error?.message ?? "Falha no envio" },
      { status: 500 },
    );
  }
}
