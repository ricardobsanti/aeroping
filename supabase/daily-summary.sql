-- Applied schema snapshot: daily digest at 20:00 America/Sao_Paulo (23:00 UTC).
alter table private.seller_runtime add column household_id uuid references public.households(id);
create table private.seller_digest_days(household_id uuid references public.households(id),day date,primary key(household_id,day));
alter table private.seller_digest_days enable row level security;
create policy server_only_digest on private.seller_digest_days as restrictive for all to public using(false) with check(false);
revoke all on private.seller_digest_days from public,anon,authenticated;
grant select,insert on private.seller_digest_days to service_role;
create function private.daily_flight_digest() returns jsonb language plpgsql security invoker set search_path='' as $$
declare h uuid; day_br date:=(now() at time zone 'America/Sao_Paulo')::date; s jsonb; p jsonb; q jsonb; ev jsonb; body text:=''; price numeric; target numeric; delta numeric; n integer:=0; events jsonb;
begin
 select household_id into h from private.seller_runtime where id;
 if h is null then return '[]'; end if;
 select payload into s from public.radar_state where household_id=h for update;
 if s is null then return '[]'; end if;
 insert into private.seller_digest_days(household_id,day) values(h,day_br) on conflict do nothing;
 if not found then return '[]'; end if;
 for p in select value from jsonb_array_elements(s->'pings') where value->>'paused' is distinct from 'true' and value->>'demo' is distinct from 'true' loop
  n:=n+1; q:=p->'quotes'->-1; target:=(p->>'target')::numeric;
  body:=body||case when n>1 then E'\n' else '' end||left(p->>'city',80)||': ';
  if q is null then body:=body||'sem cotação disponível.';
  else
   price:=(q->>'price')::numeric; delta:=case when target>0 then round((price/target-1)*100,1) else null end;
   body:=body||'R$ '||replace(to_char(price,'FM99999990.00'),'.',',')||' por pessoa; meta R$ '||replace(to_char(target,'FM99999990.00'),'.',',')||case when price<=target then ' — na meta.' else ' — '||replace(delta::text,'.',',')||'% acima.' end;
   if (q->>'at')::timestamptz at time zone 'America/Sao_Paulo' < day_br::timestamp then body:=body||' Sem cotação nova hoje; valor anterior.'; end if;
  end if;
  if p->'lastScan'->>'status'='error' then body:=body||' Atualização pendente.'; end if;
 end loop;
 if n=0 then body:='Nenhum ping ativo hoje. Crie um ping para acompanhar preços e metas.'; end if;
 ev:=jsonb_build_object('id',gen_random_uuid(),'type','digest','title','Resumo diário · 20h','body',left(body,1000),'at',now(),'read',false);
 select coalesce(jsonb_agg(value order by ord),'[]') into events from jsonb_array_elements(jsonb_build_array(ev)||coalesce(s->'events','[]')) with ordinality a(value,ord) where ord<=500;
 update public.radar_state set payload=jsonb_set(s,'{events}',events),revision=revision+1,updated_at=now() where household_id=h;
 return jsonb_build_array(jsonb_build_object('household',h,'event',ev));
end $$;
create function public.daily_flight_digest() returns jsonb language sql security invoker set search_path='' as $$ select private.daily_flight_digest() $$;
revoke all on function private.daily_flight_digest(),public.daily_flight_digest() from public,anon,authenticated;
grant execute on function private.daily_flight_digest(),public.daily_flight_digest() to service_role;
create function private.dispatch_daily_flight_digest() returns void language plpgsql security definer set search_path='' as $$
declare secret text;
begin
 select cron_secret into secret from private.flight_runtime where id;
 perform net.http_post(url:='https://yaydshjqhfzrilxbdegv.supabase.co/functions/v1/flight-search',headers:=jsonb_build_object('Content-Type','application/json','x-aeroping-cron',secret),body:='{"mode":"digest"}'::jsonb,timeout_milliseconds:=120000);
end $$;
revoke all on function private.dispatch_daily_flight_digest() from public,anon,authenticated;
select cron.schedule('aeroping-daily-summary','0 23 * * *','select private.dispatch_daily_flight_digest()');
