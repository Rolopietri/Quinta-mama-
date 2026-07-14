-- Cocina · Modificador de sustitución (ej. "(+) leche de almendras")
-- ════════════════════════════════════════════════════════════════
-- Un ítem del POS mapeado a un insumo directo (que descuenta un insumo) ahora
-- puede además DEVOLVER otro insumo, en la misma cantidad. Modela los
-- modificadores del POS tipo "+X en vez de Y":
--   "(+) leche de almendras"  →  descuenta leche de almendras
--                                 y devuelve la leche completa que la receta
--                                 del smoothie ya había descontado de más.
--
-- Reutiliza columnas existentes (no agrega ninguna):
--   ventas.insumo_id           = insumo que se DESCUENTA (leche de almendras)
--   ventas.insumo_cantidad     = cantidad por unidad vendida
--   ventas.swap_from_insumo_id = insumo que se DEVUELVE (leche completa)
--
-- Reverso simétrico al borrar. Aditivo e idempotente. Solo redefine los
-- triggers de descuento/reversión.

create or replace function public.descontar_stock_por_venta()
returns trigger language plpgsql as $$
declare
  r record;
  v_qty numeric;
  v_target uuid;
begin
  -- 1) Insumo directo (reventa) — y, opcional, devolución de otro insumo
  if new.insumo_id is not null then
    v_qty := coalesce(new.insumo_cantidad, 1) * new.cantidad;
    update public.insumos
       set stock_actual = greatest(0, stock_actual - v_qty)
     where id = new.insumo_id;
    if new.swap_from_insumo_id is not null then
      update public.insumos
         set stock_actual = stock_actual + v_qty
       where id = new.swap_from_insumo_id;
    end if;
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

create or replace function public.revertir_stock_por_venta()
returns trigger language plpgsql as $$
declare
  r record;
  v_qty numeric;
  v_target uuid;
begin
  if old.insumo_id is not null then
    v_qty := coalesce(old.insumo_cantidad, 1) * old.cantidad;
    update public.insumos
       set stock_actual = stock_actual + v_qty
     where id = old.insumo_id;
    if old.swap_from_insumo_id is not null then
      update public.insumos
         set stock_actual = greatest(0, stock_actual - v_qty)
       where id = old.swap_from_insumo_id;
    end if;
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
