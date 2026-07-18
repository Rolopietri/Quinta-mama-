-- Cocina · Recalcular stock_comprometido desde compromisos de planes activos
-- Útil para fixear el estado si por algún motivo el UPDATE atómico del RPC
-- create_plan_produccion no se reflejó (RLS, caching, lo que sea).
--
-- Lógica:
--   1. Suma cantidad de TODOS los compromisos de planes pendientes o completados
--      por insumo
--   2. Escribe ese valor en insumos.stock_comprometido
--   3. Para insumos sin compromisos activos, setea 0
--
-- Idempotente — se puede correr cuantas veces sea necesario.

create or replace function public.recalcular_stock_comprometido()
returns table (insumo_id uuid, stock_comprometido_anterior numeric, stock_comprometido_nuevo numeric)
language plpgsql
security invoker
as $$
begin
  -- Subquery: total comprometido por insumo. SOLO planes PENDIENTES: un plan
  -- completado ya consumió sus ingredientes (los descontó del stock al
  -- completarse), así que no debe seguir reservándolos — si no, el "libre" de
  -- ingredientes de cosas ya producidas se ve negativo/cero por reserva fantasma.
  return query
  with totales as (
    select
      c.insumo_id,
      sum(c.cantidad) as total_comprometido
    from public.cocina_plan_compromisos c
    join public.cocina_planes_produccion p on p.id = c.plan_id
    where p.estado = 'pendiente'
    group by c.insumo_id
  ),
  updates as (
    update public.insumos i
       set stock_comprometido = coalesce(t.total_comprometido, 0)
      from totales t
     where i.id = t.insumo_id
    returning i.id, 0::numeric as anterior, i.stock_comprometido as nuevo
  ),
  resets as (
    update public.insumos i
       set stock_comprometido = 0
     where not exists (
       select 1 from public.cocina_plan_compromisos c
         join public.cocina_planes_produccion p on p.id = c.plan_id
        where c.insumo_id = i.id and p.estado = 'pendiente'
     )
       and coalesce(i.stock_comprometido, 0) <> 0
    returning i.id, 0::numeric as anterior, 0::numeric as nuevo
  )
  select * from updates
  union all
  select * from resets;
end;
$$;
