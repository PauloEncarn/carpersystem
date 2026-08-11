create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create table if not exists public.hourly_email_dispatches (
  report_key text primary key,
  status text not null check (status in ('sending', 'sent', 'failed')),
  attempted_at timestamptz not null default now(),
  sent_at timestamptz,
  error text,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.hourly_email_dispatches enable row level security;
drop policy if exists hourly_dispatch_read on public.hourly_email_dispatches;
create policy hourly_dispatch_read on public.hourly_email_dispatches for select to anon, authenticated using (true);
drop policy if exists hourly_dispatch_write on public.hourly_email_dispatches;
create policy hourly_dispatch_write on public.hourly_email_dispatches for all to anon, authenticated using (true) with check (true);

select vault.create_secret(
  'https://carpersystem.vercel.app',
  'carper_system_url',
  'URL pública do Carper System'
)
where not exists (select 1 from vault.secrets where name = 'carper_system_url');

select vault.create_secret(
  'sb_publishable__3nITiZNffRe2WLp9gLnog_9VM5fb6X',
  'carper_publishable_key',
  'Chave pública usada para autenticar o job horário'
)
where not exists (select 1 from vault.secrets where name = 'carper_publishable_key');

select cron.unschedule(jobid)
from cron.job
where jobname = 'carper-hourly-production-email';

select cron.schedule(
  'carper-hourly-production-email',
  '5 * * * *',
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
