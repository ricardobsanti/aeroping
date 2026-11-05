-- Server-only fare cache, quotas and scheduled monitors. No travel API subscription.
create table private.flight_cache (key text primary key, result jsonb not null, at timestamptz not null default now());
create table private.flight_budget (household_id uuid references public.households on delete cascade, day date, count int not null default 0, last_at timestamptz, primary key(household_id,day));
create table private.flight_jobs (household_id uuid references public.households on delete cascade, ping_id text, query jsonb not null, next_at timestamptz not null default now(), lease_until timestamptz, primary key(household_id,ping_id));
create index flight_jobs_due on private.flight_jobs(next_at);
create table private.flight_runtime (id boolean primary key default true check(id), cron_secret text not null default encode(extensions.gen_random_bytes(32),'hex'));
insert into private.flight_runtime(id) values(true);
alter table private.flight_cache enable row level security;
alter table private.flight_budget enable row level security;
alter table private.flight_jobs enable row level security;
alter table private.flight_runtime enable row level security;
revoke all on private.flight_cache,private.flight_budget,private.flight_jobs,private.flight_runtime from public,anon,authenticated;

create function private.flight_query(p jsonb) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('origin',p->>'origin','destination',p->>'destination','depart',p->>'depart','return',p->>'return','stops',p->>'stops','adults',2)
$$;
revoke all on function private.flight_query(jsonb) from public,anon,authenticated;

create function private.sync_flight_jobs() returns trigger language plpgsql security definer set search_path='' as $$
declare p jsonb; q jsonb; n int:=0; ids text[]:='{}';
begin
 for p in select value from jsonb_array_elements(coalesce(new.payload->'pings','[]')) loop
  if p->>'demo'='true' or p->>'paused'='true' or coalesce(p->>'depart','') < current_date::text or coalesce(p->>'depart','') > (current_date+330)::text or n>=8 then continue; end if;
  if coalesce(p->>'origin','') !~ '^[A-Z]{3}$' or coalesce(p->>'destination','') !~ '^[A-Z]{3}$' then continue; end if;
  n:=n+1; ids:=array_append(ids,p->>'id'); q:=private.flight_query(p);
  insert into private.flight_jobs(household_id,ping_id,query) values(new.household_id,p->>'id',q)
   on conflict(household_id,ping_id) do update set query=excluded.query,next_at=case when flight_jobs.query=excluded.query then flight_jobs.next_at else now() end;
 end loop;
 delete from private.flight_jobs where household_id=new.household_id and not(ping_id=any(ids));
 return new;
end $$;
revoke all on function private.sync_flight_jobs() from public,anon,authenticated;
create trigger sync_flight_jobs after insert or update of payload on public.radar_state for each row execute function private.sync_flight_jobs();

-- Explicit service-role API. The Edge Function verifies the caller's user and household.
create function private.flight_worker(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare h uuid; r jsonb; s jsonb; p jsonb; offers jsonb; best jsonb; quote jsonb; ev jsonb; items jsonb:='[]'; events jsonb; old_price numeric; price numeric; target numeric; tolerance numeric; typ text; msg text; budget int; job record; next_time timestamptz; k text;
begin
 if p_action='runtime' then select to_jsonb(t) into r from private.flight_runtime t; return r; end if;
 if p_action='cache_get' then select result||jsonb_build_object('cached',true) into r from private.flight_cache where key=p_data->>'key' and at>now()-interval '15 minutes'; return r; end if;
 if p_action='cache_put' then
  if octet_length((p_data->'result')::text)>350000 then raise exception 'Result too large'; end if;
  insert into private.flight_cache(key,result) values(p_data->>'key',p_data->'result') on conflict(key) do update set result=excluded.result,at=now();
  delete from private.flight_cache where at<now()-interval '2 days'; return '{}'::jsonb;
 end if;
 if p_action='budget' then
  h:=(p_data->>'household')::uuid;
  insert into private.flight_budget(household_id,day) values(h,current_date) on conflict do nothing;
  select count into budget from private.flight_budget where household_id=h and day=current_date for update;
  if budget>=80 then return jsonb_build_object('ok',false,'reason','Limite de 80 consultas novas por dia atingido. Tente amanhã.'); end if;
  if coalesce(p_data->>'background','false')<>'true' and exists(select 1 from private.flight_budget where household_id=h and day=current_date and last_at>now()-interval '15 seconds') then return jsonb_build_object('ok',false,'reason','Aguarde 15 segundos antes de uma nova consulta.'); end if;
  update private.flight_budget set count=count+1,last_at=now() where household_id=h and day=current_date;
  delete from private.flight_budget where day<current_date-7; return jsonb_build_object('ok',true,'remaining',79-budget);
 end if;
 if p_action='claim' then
  r:='[]';
  for job in select * from private.flight_jobs where next_at<=now() and coalesce(lease_until,'epoch')<now() order by next_at limit 2 for update skip locked loop
   update private.flight_jobs set lease_until=now()+interval '3 minutes' where household_id=job.household_id and ping_id=job.ping_id;
   r:=r||jsonb_build_array(jsonb_build_object('household',job.household_id,'pingId',job.ping_id,'query',job.query));
  end loop; return r;
 end if;
 if p_action='commit' then
  h:=(p_data->>'household')::uuid; k:=p_data->>'pingId';
  select payload into s from public.radar_state where household_id=h for update;
  if s is null then return jsonb_build_object('ok',false); end if;
  events:=s->'events'; next_time:=now()+case when p_data->>'error' is null then interval '6 hours' else interval '2 hours' end;
  for p in select value from jsonb_array_elements(s->'pings') loop
   if p->>'id'=k and p->>'paused' is distinct from 'true' and private.flight_query(p)=p_data->'query' then
    offers:=coalesce(p_data->'result'->'offers','[]'); best:=offers->0;
    msg:=case when p_data->>'error' is not null then p_data->>'error' when best is null then 'Nenhuma opção encontrada nesta consulta.' when p->>'baggage'='true' then 'Preço encontrado; bagagem despachada precisa ser conferida na companhia.' else 'Consulta concluída.' end;
    p:=p||jsonb_build_object('lastScan',jsonb_build_object('at',now(),'nextAt',next_time,'status',case when p_data->>'error' is not null then 'error' when best is null then 'empty' when p->>'baggage'='true' then 'baggage' else 'ok' end,'message',msg));
    if best is not null then p:=p||jsonb_build_object('bestOffer',best); end if;
    if best is not null and p->>'baggage' is distinct from 'true' then
     price:=(best->>'perPerson')::numeric; target:=(p->>'target')::numeric; tolerance:=(p->>'tolerance')::numeric;
     old_price:=(p->'quotes'->-1->>'price')::numeric;
     quote:=jsonb_build_object('price',price,'at',now(),'source','Google Voos · consulta automática','url',best->>'bookingUrl','automatic',true,'total',best->'total');
     select coalesce(jsonb_agg(value order by ord),'[]') into offers from jsonb_array_elements((coalesce(p->'quotes','[]')||jsonb_build_array(quote))) with ordinality a(value,ord) where ord>jsonb_array_length(coalesce(p->'quotes','[]'))-364;
     p:=jsonb_set(p,'{quotes}',offers);
     typ:=null;
     if price<=target and (old_price is null or old_price>target or price<old_price*.95) then typ:='hit';
     elsif price<=target*(1+tolerance/100) and (old_price is null or old_price>target*(1+tolerance/100)) then typ:='warm';
     elsif old_price is not null and price<=old_price*.7 then typ:='drop'; end if;
     if typ is not null then
      ev:=jsonb_build_object('id',gen_random_uuid(),'type',typ,'title',left((p->>'city')||case typ when 'hit' then ': preço-alvo atingido!' when 'warm' then ': perto da nossa meta' else ': o preço caiu!' end,300),'body','R$ '||price||' por pessoa, ida e volta para 2 adultos. Confirme preço, taxas e bagagem antes de reservar.','at',now(),'read',false,'pingId',k);
      events:=jsonb_build_array(ev)||events;
     end if;
    end if;
   end if;
   items:=items||jsonb_build_array(p);
  end loop;
  select coalesce(jsonb_agg(value order by ord),'[]') into events from jsonb_array_elements(events) with ordinality a(value,ord) where ord<=500;
  update public.radar_state set payload=s||jsonb_build_object('pings',items,'events',events),revision=revision+1,updated_at=now() where household_id=h;
  update private.flight_jobs set next_at=next_time,lease_until=null where household_id=h and ping_id=k and query=p_data->'query';
  return jsonb_build_object('ok',true,'event',ev);
 end if;
 raise exception 'Unknown operation';
end $$;
create function public.flight_worker(p_action text,p_data jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$ select private.flight_worker(p_action,p_data) $$;
revoke all on function private.flight_worker(text,jsonb),public.flight_worker(text,jsonb) from public,anon,authenticated;
grant execute on function private.flight_worker(text,jsonb),public.flight_worker(text,jsonb) to service_role;
-- Initialize schedules without modifying a single plan or quote.
update public.radar_state set payload=payload where payload is not null;
