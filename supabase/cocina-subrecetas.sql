-- Sub-recetas (preparaciones): salsas, mezclas, componentes que entran en otras recetas.
-- Ejemplo: "Salsa pesto" es subreceta usada en "Sandwich de pesto".

-- 1) Marcar recetas como subreceta + rendimiento
alter table public.recetas
  add column if not exists es_subreceta boolean not null default false,
  add column if not exists rendimiento numeric(12, 4),
  add column if not exists rendimiento_unidad text;

-- 2) Permitir que receta_ingredientes referencie una subreceta en vez de un insumo
alter table public.receta_ingredientes
  add column if not exists subreceta_id uuid references public.recetas(id) on delete set null;

create index if not exists idx_ri_subreceta on public.receta_ingredientes(subreceta_id);

-- 3) Función recursiva: expande una receta a su consumo real de INSUMOS base.
--    Devuelve filas (insumo_id, total_cantidad_en_unidad_base).
--    p_factor multiplica todas las cantidades (ej: si se venden N unidades).
create or replace function public.flatten_receta_insumos(
  p_receta_id uuid,
  p_factor numeric default 1,
  p_depth int default 0
)
returns table(insumo_id uuid, total_cantidad numeric)
language plpgsql
as $$
declare
  r record;
  porciones_r int;
  sub_rend numeric;
  sub_factor numeric;
begin
  -- Tope de seguridad por si hay ciclos accidentales
  if p_depth > 5 then return; end if;

  select porciones into porciones_r from public.recetas where id = p_receta_id;
  if porciones_r is null or porciones_r = 0 then return; end if;

  for r in (
    select ri.insumo_id, ri.subreceta_id, ri.cantidad
    from public.receta_ingredientes ri
    where ri.receta_id = p_receta_id
  ) loop
    if r.insumo_id is not null then
      -- Ingrediente directo: emitir consumption
      return query
        select r.insumo_id, (r.cantidad * p_factor / porciones_r::numeric)::numeric;
    elsif r.subreceta_id is not null then
      -- Subreceta: calcular factor relativo y recursivar
      select rendimiento into sub_rend
      from public.recetas where id = r.subreceta_id;

      if sub_rend is null or sub_rend = 0 then continue; end if;

      -- ¿Cuántos "batches" de la subreceta necesitamos?
      -- cantidad usada / rendimiento por porción de la subreceta
      sub_factor := (r.cantidad * p_factor / porciones_r::numeric) / sub_rend;

      return query
        select fi.insumo_id, fi.total_cantidad
        from public.flatten_receta_insumos(r.subreceta_id, sub_factor, p_depth + 1) fi;
    end if;
  end loop;
end;
$$;

-- 4) Reemplazar el trigger de descuento de stock para usar la función recursiva
create or replace function public.descontar_stock_por_venta()
returns trigger language plpgsql as $$
declare
  r record;
begin
  if new.receta_id is null then return new; end if;

  -- new.cantidad es cuántas UNIDADES vendidas (no porciones)
  -- La función ya normaliza por porciones internamente, así que le pasamos new.cantidad como factor
  for r in (
    select insumo_id, sum(total_cantidad) as total
    from public.flatten_receta_insumos(new.receta_id, new.cantidad)
    group by insumo_id
  ) loop
    update public.insumos
    set stock_actual = greatest(0, stock_actual - r.total)
    where id = r.insumo_id;
  end loop;

  return new;
end;
$$;

-- 5) Reemplazar el trigger de reversión (eliminar venta → devolver stock)
create or replace function public.revertir_stock_por_venta()
returns trigger language plpgsql as $$
declare
  r record;
begin
  if old.receta_id is null then return old; end if;

  for r in (
    select insumo_id, sum(total_cantidad) as total
    from public.flatten_receta_insumos(old.receta_id, old.cantidad)
    group by insumo_id
  ) loop
    update public.insumos
    set stock_actual = stock_actual + r.total
    where id = r.insumo_id;
  end loop;

  return old;
end;
$$;
