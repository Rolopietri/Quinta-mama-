-- Cocina · Sustitución de insumo en un ítem del POS
-- ════════════════════════════════════════════════════════════════
-- Permite que un ítem del POS use la MISMA receta base pero cambiando un
-- insumo por otro, en la misma cantidad. Ej.: "Latte leche de almendras"
-- usa la receta "Latte" pero descuenta leche de almendras en vez de leche
-- entera (por la cantidad que la receta ya especifica para la entera).
--
-- Sin duplicar recetas. Se aplica tanto a la receta base como a la extra.
-- Reverso simétrico al borrar. Aditivo e idempotente.

alter table public.pos_clasificacion
  add column if not exists swap_from_insumo_id uuid references public.insumos(id) on delete set null,
  add column if not exists swap_to_insumo_id uuid references public.insumos(id) on delete set null;

alter table public.ventas
  add column if not exists swap_from_insumo_id uuid references public.insumos(id) on delete set null,
  add column if not exists swap_to_insumo_id uuid references public.insumos(id) on delete set null;

-- Descuento de stock: insumo directo | receta base | receta extra, con
-- sustitución de insumo aplicada a las recetas.
create or replace function public.descontar_stock_por_venta()
returns trigger language plpgsql as $$
declare
  r record;
  v_target uuid;
begin
  -- 1) Insumo directo (reventa)
  if new.insumo_id is not null then
    update public.insumos
       set stock_actual = greatest(0, stock_actual
             - coalesce(new.insumo_cantidad, 1) * new.cantidad)
     where id = new.insumo_id;
    return new;
  end if;

  -- 2) Receta base (con sustitución de insumo si aplica)
  if new.receta_id is not null then
    for r in (
      select insumo_id, sum(total_cantidad) as total
      from public.flatten_receta_insumos(new.receta_id, new.cantidad)
      group by insumo_id
    ) loop
      v_target := case
        when new.swap_from_insumo_id is not null
         and r.insumo_id = new.swap_from_insumo_id
         and new.swap_to_insumo_id is not null
        then new.swap_to_insumo_id else r.insumo_id end;
      update public.insumos
      set stock_actual = greatest(0, stock_actual - r.total)
      where id = v_target;
    end loop;
  end if;

  -- 3) Receta extra (combos), misma sustitución por si aplica
  if new.extra_receta_id is not null then
    for r in (
      select insumo_id, sum(total_cantidad) as total
      from public.flatten_receta_insumos(
        new.extra_receta_id, new.cantidad * coalesce(new.extra_cantidad, 1))
      group by insumo_id
    ) loop
      v_target := case
        when new.swap_from_insumo_id is not null
         and r.insumo_id = new.swap_from_insumo_id
         and new.swap_to_insumo_id is not null
        then new.swap_to_insumo_id else r.insumo_id end;
      update public.insumos
      set stock_actual = greatest(0, stock_actual - r.total)
      where id = v_target;
    end loop;
  end if;

  return new;
end;
$$;

-- Reversión simétrica.
create or replace function public.revertir_stock_por_venta()
returns trigger language plpgsql as $$
declare
  r record;
  v_target uuid;
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
      v_target := case
        when old.swap_from_insumo_id is not null
         and r.insumo_id = old.swap_from_insumo_id
         and old.swap_to_insumo_id is not null
        then old.swap_to_insumo_id else r.insumo_id end;
      update public.insumos
      set stock_actual = stock_actual + r.total
      where id = v_target;
    end loop;
  end if;

  if old.extra_receta_id is not null then
    for r in (
      select insumo_id, sum(total_cantidad) as total
      from public.flatten_receta_insumos(
        old.extra_receta_id, old.cantidad * coalesce(old.extra_cantidad, 1))
      group by insumo_id
    ) loop
      v_target := case
        when old.swap_from_insumo_id is not null
         and r.insumo_id = old.swap_from_insumo_id
         and old.swap_to_insumo_id is not null
        then old.swap_to_insumo_id else r.insumo_id end;
      update public.insumos
      set stock_actual = stock_actual + r.total
      where id = v_target;
    end loop;
  end if;

  return old;
end;
$$;
