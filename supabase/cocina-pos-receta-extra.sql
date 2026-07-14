-- Cocina · Receta EXTRA en un ítem del POS (combos "… con papas fritas")
-- ════════════════════════════════════════════════════════════════
-- Permite que un ítem del POS descuente su receta base MÁS una receta extra,
-- sin duplicar la receta base. Ej.: "Prosciutto pesto con papas fritas" se
-- vincula a la receta "Prosciutto pesto" (base) + extra "Ración de papas
-- fritas" (×1). Así el sándwich solo y el combo comparten la misma receta
-- base, y el combo agrega las papas.
--
-- Descuento total al vender N unidades:
--   receta base (N)  +  receta extra (N × extra_cantidad)
-- Reverso simétrico al borrar. Todo vía los triggers existentes.
--
-- Aditivo e idempotente.

alter table public.pos_clasificacion
  add column if not exists extra_receta_id uuid references public.recetas(id) on delete set null,
  add column if not exists extra_cantidad numeric(12, 4);

alter table public.ventas
  add column if not exists extra_receta_id uuid references public.recetas(id) on delete set null,
  add column if not exists extra_cantidad numeric(12, 4);

-- Descuento de stock: insumo directo | receta base | receta extra.
create or replace function public.descontar_stock_por_venta()
returns trigger language plpgsql as $$
declare
  r record;
begin
  -- 1) Insumo directo (reventa)
  if new.insumo_id is not null then
    update public.insumos
       set stock_actual = greatest(0, stock_actual
             - coalesce(new.insumo_cantidad, 1) * new.cantidad)
     where id = new.insumo_id;
    return new;
  end if;

  -- 2) Receta base
  if new.receta_id is not null then
    for r in (
      select insumo_id, sum(total_cantidad) as total
      from public.flatten_receta_insumos(new.receta_id, new.cantidad)
      group by insumo_id
    ) loop
      update public.insumos
      set stock_actual = greatest(0, stock_actual - r.total)
      where id = r.insumo_id;
    end loop;
  end if;

  -- 3) Receta extra (ej. ración de papas del combo)
  if new.extra_receta_id is not null then
    for r in (
      select insumo_id, sum(total_cantidad) as total
      from public.flatten_receta_insumos(
        new.extra_receta_id, new.cantidad * coalesce(new.extra_cantidad, 1))
      group by insumo_id
    ) loop
      update public.insumos
      set stock_actual = greatest(0, stock_actual - r.total)
      where id = r.insumo_id;
    end loop;
  end if;

  return new;
end;
$$;

-- Reversión simétrica (borrar venta → devolver stock).
create or replace function public.revertir_stock_por_venta()
returns trigger language plpgsql as $$
declare
  r record;
begin
  if old.insumo_id is not null then
    update public.insumos
       set stock_actual = stock_actual
             + coalesce(old.insumo_cantidad, 1) * old.cantidad
     where id = old.insumo_id;
    return old;
  end if;

  if old.receta_id is not null then
    for r in (
      select insumo_id, sum(total_cantidad) as total
      from public.flatten_receta_insumos(old.receta_id, old.cantidad)
      group by insumo_id
    ) loop
      update public.insumos
      set stock_actual = stock_actual + r.total
      where id = r.insumo_id;
    end loop;
  end if;

  if old.extra_receta_id is not null then
    for r in (
      select insumo_id, sum(total_cantidad) as total
      from public.flatten_receta_insumos(
        old.extra_receta_id, old.cantidad * coalesce(old.extra_cantidad, 1))
      group by insumo_id
    ) loop
      update public.insumos
      set stock_actual = stock_actual + r.total
      where id = r.insumo_id;
    end loop;
  end if;

  return old;
end;
$$;
