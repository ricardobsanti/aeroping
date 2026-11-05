alter table private.flight_runtime add column vapid_public text, add column vapid_private text;
create table private.flight_push (user_id uuid references auth.users on delete cascade, endpoint text, subscription jsonb not null, at timestamptz not null default now(), primary key(user_id,endpoint));
alter table private.flight_push enable row level security;
revoke all on private.flight_push from public,anon,authenticated;
create function private.flight_push_worker(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid; r jsonb;
begin
 if p_action='register' then
  u:=(p_data->>'user')::uuid;
  if not exists(select 1 from public.members where user_id=u) then raise exception 'Membership required'; end if;
  if (select count(*) from private.flight_push where user_id=u)>=5 and not exists(select 1 from private.flight_push where user_id=u and endpoint=p_data->'subscription'->>'endpoint') then raise exception 'Device limit'; end if;
  insert into private.flight_push(user_id,endpoint,subscription) values(u,p_data->'subscription'->>'endpoint',p_data->'subscription') on conflict(user_id,endpoint) do update set subscription=excluded.subscription,at=now();return '{}'::jsonb;
 elsif p_action='remove' then delete from private.flight_push where user_id=(p_data->>'user')::uuid and endpoint=p_data->>'endpoint';return '{}'::jsonb;
 elsif p_action='list' then select coalesce(jsonb_agg(jsonb_build_object('user',p.user_id,'subscription',p.subscription)),'[]') into r from private.flight_push p join public.members m on p.user_id=m.user_id where m.household_id=(p_data->>'household')::uuid;return r;
 end if;
 raise exception 'Unknown operation';
end $$;
create function public.flight_push_worker(p_action text,p_data jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.flight_push_worker(p_action,p_data) $$;
revoke all on function private.flight_push_worker(text,jsonb),public.flight_push_worker(text,jsonb) from public,anon,authenticated;
grant execute on function private.flight_push_worker(text,jsonb),public.flight_push_worker(text,jsonb) to service_role;
