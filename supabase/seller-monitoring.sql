-- Schema snapshot for the seller comparison integration. No API key belongs here.
create table private.seller_runtime(id boolean primary key default true check(id),api_key text,enabled boolean not null default false);
insert into private.seller_runtime(id) values(true);
create table private.seller_usage(id bigint generated always as identity primary key,at timestamptz not null default now(),household_id uuid not null references public.households(id));
create index seller_usage_at on private.seller_usage(at);
alter table private.seller_runtime enable row level security;
alter table private.seller_usage enable row level security;
create policy server_only_runtime on private.seller_runtime as restrictive for all to public using(false) with check(false);
create policy server_only_usage on private.seller_usage as restrictive for all to public using(false) with check(false);
revoke all on private.seller_runtime,private.seller_usage from public,anon,authenticated;
grant select,update on private.seller_runtime to service_role;
grant select,insert,delete on private.seller_usage to service_role;
grant usage on sequence private.seller_usage_id_seq to service_role;
create function private.seller_worker(p_action text,p_data jsonb default '{}') returns jsonb language plpgsql security invoker set search_path='' as $$
declare runtime private.seller_runtime; used integer; today_used integer; hour_used integer; h uuid;
begin
 select * into runtime from private.seller_runtime where id=true for update;
 if p_action='runtime' then return jsonb_build_object('enabled',runtime.enabled,'apiKey',runtime.api_key); end if;
 if p_action='reserve' then
  h:=(p_data->>'household')::uuid;
  if h is null or h is distinct from runtime.household_id then return jsonb_build_object('ok',false); end if;
  if not runtime.enabled or runtime.api_key is null then return jsonb_build_object('ok',false); end if;
  select count(*),count(*) filter(where (at at time zone 'America/Sao_Paulo')::date=(now() at time zone 'America/Sao_Paulo')::date),count(*) filter(where at>now()-interval '1 hour') into used,today_used,hour_used from private.seller_usage where at>now()-interval '31 days';
  if used>=248 or today_used>=8 or hour_used>=15 then return jsonb_build_object('ok',false,'remaining',greatest(0,248-used)); end if;
  insert into private.seller_usage(household_id) values(h);
  delete from private.seller_usage where at<now()-interval '32 days';
  return jsonb_build_object('ok',true,'remaining',247-used);
 end if;
 raise exception 'Unknown seller operation';
end $$;
create function public.seller_worker(p_action text,p_data jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$ select private.seller_worker(p_action,p_data) $$;
revoke all on function private.seller_worker(text,jsonb),public.seller_worker(text,jsonb) from public,anon,authenticated;
grant execute on function private.seller_worker(text,jsonb),public.seller_worker(text,jsonb) to service_role;
