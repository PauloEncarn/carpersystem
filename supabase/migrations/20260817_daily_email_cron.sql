-- Substitui o envio horário por um resumo diário às 15h (Brasília).
-- O pg_cron opera em UTC: 18:00 UTC corresponde a 15:00 em São Paulo.

select cron.unschedule(jobid)
from cron.job
where jobname in (
  'carper-hourly-production-email',
  'carper-daily-production-email'
);

select cron.schedule(
  'carper-daily-production-email',
  '0 18 * * *',
  $$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'carper_system_url') || '/api/cron/hourly-report',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'carper_publishable_key')
    ),
    timeout_milliseconds := 55000
  );
  $$
);
