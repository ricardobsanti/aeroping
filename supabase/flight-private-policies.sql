-- Explicit deny policies document the server-only boundary.
create policy server_only on private.flight_cache for all to anon,authenticated using(false) with check(false);
create policy server_only on private.flight_budget for all to anon,authenticated using(false) with check(false);
create policy server_only on private.flight_jobs for all to anon,authenticated using(false) with check(false);
create policy server_only on private.flight_runtime for all to anon,authenticated using(false) with check(false);
create policy server_only on private.flight_push for all to anon,authenticated using(false) with check(false);
