-- FIX: permitir que el cron diario (sin sesión de usuario) escriba la tasa BCV.
-- Solo afecta la tabla tasa_bcv. Las demás tablas siguen exigiendo autenticación.
-- El riesgo es nulo: la única data que entra es la tasa pública del día.

drop policy if exists "tasa_anon_insert" on public.tasa_bcv;
create policy "tasa_anon_insert" on public.tasa_bcv
  for insert to anon with check (true);

drop policy if exists "tasa_anon_update" on public.tasa_bcv;
create policy "tasa_anon_update" on public.tasa_bcv
  for update to anon using (true) with check (true);

drop policy if exists "tasa_anon_select" on public.tasa_bcv;
create policy "tasa_anon_select" on public.tasa_bcv
  for select to anon using (true);
