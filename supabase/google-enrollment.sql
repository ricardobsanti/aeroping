-- Google enrollment is permitted only for a verified provider identity whose
-- email already has an active private invitation. User metadata is not trusted.
create or replace function private.guard_enrollment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare actor record; invitation private.enrollment_invites%rowtype;
begin
  select lower(email) as email,raw_app_meta_data,email_confirmed_at
    into actor from auth.users where id=new.id;
  if coalesce(actor.raw_app_meta_data->>'aeroping_enrolled','')='true' then
    return new;
  end if;
  if actor.email_confirmed_at is null or not exists (
    select 1 from auth.identities i where i.user_id=new.id and i.provider='google'
      and i.identity_data->>'email_verified'='true'
      and lower(i.identity_data->>'email')=actor.email
  ) then raise exception 'AeroPing requires a private invitation'; end if;
  select * into invitation from private.enrollment_invites
    where email=actor.email and consumed_at is null and expires_at>now() for update;
  if not found then raise exception 'This Google account has not been invited to AeroPing'; end if;
  insert into public.members(user_id,household_id,seat)
    values(new.id,invitation.household_id,invitation.seat);
  update private.enrollment_invites set consumed_at=now()
    where household_id=invitation.household_id and seat=invitation.seat;
  return new;
end $$;
revoke all on function private.guard_enrollment() from public,anon,authenticated;
