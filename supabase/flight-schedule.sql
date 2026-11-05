create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
-- The random credential is generated inside Postgres, never placed in public code.
create function private.dispatch_flight_monitor() returns void language plpgsql security definer set search_path='' as $$
declare secret text;
begin
 if not exists(select 1 from private.flight_jobs where next_at<=now() and coalesce(lease_until,'epoch')<now()) then return; end if;
 select cron_secret into secret from private.flight_runtime where id;
 perform net.http_post(url:='https://yaydshjqhfzrilxbdegv.supabase.co/functions/v1/flight-search',headers:=jsonb_build_object('Content-Type','application/json','x-aeroping-cron',secret),body:='{"mode":"cron"}'::jsonb,timeout_milliseconds:=120000);
end $$;
revoke all on function private.dispatch_flight_monitor() from public,anon,authenticated;
select cron.schedule('aeroping-flight-monitor','*/15 * * * *','select private.dispatch_flight_monitor()');
-- Re-enroll plans as their dates enter the source's booking window; keep storage bounded.
select cron.schedule('aeroping-flight-housekeeping','8 3 * * *',$job$
 update public.radar_state set payload=payload where payload is not null;
 delete from private.flight_cache where at<now()-interval '2 days';
 delete from private.flight_budget where day<current_date-7;
 delete from cron.job_run_details where end_time<now()-interval '7 days' and jobid in (select jobid from cron.job where jobname like 'aeroping-%');
$job$);
