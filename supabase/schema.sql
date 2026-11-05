-- AeroPing: a private household with at most two members.
-- Public app code contains only the publishable key. No enrollment email/token is seeded here.
create schema if not exists private;
create extension if not exists pgcrypto with schema extensions;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;

create table public.households (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);
create table public.members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  seat smallint not null check (seat in (1,2)),
  unique (household_id,seat)
);
create table public.radar_state (
  household_id uuid primary key references public.households(id) on delete cascade,
  payload jsonb,
  revision bigint not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now(),
  constraint valid_payload check (payload is null or (
    jsonb_typeof(payload) = 'object' and payload->>'version' = '1'
    and jsonb_typeof(payload->'pings') = 'array'
    and jsonb_typeof(payload->'events') = 'array'
    and jsonb_typeof(payload->'settings') = 'object'
    and octet_length(payload::text) <= 5000000
  ))
);
create table private.enrollment_invites (
  household_id uuid not null references public.households(id) on delete cascade,
  seat smallint not null check (seat in (1,2)),
  email text not null check (email = lower(email)),
  token_hash text not null unique check (length(token_hash) = 64),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  primary key (household_id,seat)
);

alter table public.households enable row level security;
alter table public.members enable row level security;
alter table public.radar_state enable row level security;
alter table private.enrollment_invites enable row level security;
create policy no_client_enrollment_access on private.enrollment_invites
  for all to anon,authenticated using (false) with check (false);
revoke all on public.households, public.members, public.radar_state from public, anon, authenticated;
revoke all on private.enrollment_invites from public, anon, authenticated;
grant select on public.households, public.members, public.radar_state to authenticated;
grant update (payload,revision,updated_at) on public.radar_state to authenticated;
create policy own_membership on public.members for select to authenticated
  using (user_id = (select auth.uid()));
create policy household_read on public.households for select to authenticated
  using (id in (select household_id from public.members where user_id = (select auth.uid())));
create policy radar_read on public.radar_state for select to authenticated
  using (household_id in (select household_id from public.members where user_id = (select auth.uid())));
create policy radar_update on public.radar_state for update to authenticated
  using (household_id in (select household_id from public.members where user_id = (select auth.uid())))
  with check (household_id in (select household_id from public.members where user_id = (select auth.uid())));

create function public.save_radar(p_household uuid,p_payload jsonb,p_revision bigint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_revision bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_payload is null then raise exception 'Payload required'; end if;
  update public.radar_state set payload=p_payload,revision=revision+1,updated_at=now()
    where household_id=p_household and revision=p_revision returning revision into v_revision;
  if found then return jsonb_build_object('ok',true,'revision',v_revision); end if;
  return jsonb_build_object('ok',false);
end $$;
revoke all on function public.save_radar(uuid,jsonb,bigint) from public,anon;
grant execute on function public.save_radar(uuid,jsonb,bigint) to authenticated;

-- Account creation is performed only by the invite-verifying Edge Function.
-- Supabase's admin API sets app_metadata; browser sign-up cannot set it.
create function private.guard_enrollment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce((select u.raw_app_meta_data->>'aeroping_enrolled' from auth.users u where u.id=new.id),'') <> 'true' then
    raise exception 'AeroPing requires a private invitation';
  end if;
  return new;
end $$;
revoke all on function private.guard_enrollment() from public,anon,authenticated;
create constraint trigger aeroping_invite_only after insert on auth.users
  deferrable initially deferred
  for each row execute function private.guard_enrollment();

-- These privileged enrollment helpers are callable only by the server role.
create function private.check_enrollment(p_token text) returns jsonb
language sql security definer set search_path = '' as $$
  select jsonb_build_object('email',i.email)
  from private.enrollment_invites i
  where i.token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
    and i.consumed_at is null and i.expires_at>now()
    and not exists(select 1 from public.members m where m.household_id=i.household_id and m.seat=i.seat)
$$;
create function private.complete_enrollment(p_token text,p_user_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare i private.enrollment_invites%rowtype; actual_email text;
begin
  select * into i from private.enrollment_invites
    where token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
      and consumed_at is null and expires_at>now() for update;
  if not found then raise exception 'Invalid or expired invitation'; end if;
  select lower(email) into actual_email from auth.users where id=p_user_id and email_confirmed_at is not null;
  if actual_email is distinct from i.email then raise exception 'Invitation account mismatch'; end if;
  insert into public.members(user_id,household_id,seat) values(p_user_id,i.household_id,i.seat);
  update private.enrollment_invites set consumed_at=now() where household_id=i.household_id and seat=i.seat;
  return true;
end $$;
create function public.check_enrollment(p_token text) returns jsonb
language sql security invoker set search_path = '' as $$ select private.check_enrollment(p_token) $$;
create function public.complete_enrollment(p_token text,p_user_id uuid) returns boolean
language sql security invoker set search_path = '' as $$ select private.complete_enrollment(p_token,p_user_id) $$;
revoke all on function private.check_enrollment(text),private.complete_enrollment(text,uuid),
  public.check_enrollment(text),public.complete_enrollment(text,uuid) from public,anon,authenticated;
grant execute on function private.check_enrollment(text),private.complete_enrollment(text,uuid),
  public.check_enrollment(text),public.complete_enrollment(text,uuid) to service_role;

create function private.invite_partner(p_email text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare h uuid; t text; normalized text := lower(trim(p_email));
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select household_id into h from public.members where user_id=auth.uid() and seat=1;
  if h is null then raise exception 'Only the first traveler can invite'; end if;
  if normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(normalized)>254 then raise exception 'Invalid email'; end if;
  if exists(select 1 from public.members where household_id=h and seat=2) then raise exception 'The second traveler already has access'; end if;
  if exists(select 1 from auth.users where lower(email)=normalized) then raise exception 'An account with this email already exists'; end if;
  t := encode(extensions.gen_random_bytes(32),'hex');
  insert into private.enrollment_invites(household_id,seat,email,token_hash,expires_at)
    values(h,2,normalized,encode(extensions.digest(t,'sha256'),'hex'),now()+interval '7 days')
    on conflict(household_id,seat) do update set email=excluded.email,token_hash=excluded.token_hash,
      expires_at=excluded.expires_at,consumed_at=null;
  return jsonb_build_object('token',t,'email',normalized,'expires_in_days',7);
end $$;
create function public.invite_partner(p_email text) returns jsonb
language sql security invoker set search_path = '' as $$ select private.invite_partner(p_email) $$;
revoke all on function private.invite_partner(text),public.invite_partner(text) from public,anon;
grant execute on function private.invite_partner(text),public.invite_partner(text) to authenticated;
