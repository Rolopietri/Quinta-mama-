-- Cocina · POS: quitar un insumo de la receta SIN reemplazo
-- ════════════════════════════════════════════════════════════════
-- Amplía la sustitución existente: hasta ahora un ítem del POS podía cambiar un
-- insumo por OTRO (swap_from + swap_to). Faltaba el caso "sin X": quitar un
-- insumo sin poner nada en su lugar (ej. "Prosciutto Pesto sin pesto",
-- "Salmón sin alcaparras").
--
-- MODELO: se reutiliza swap_from_insumo_id. La regla es:
--   • swap_from + swap_to  → sustituir (descuenta swap_to en vez de swap_from).
--   • swap_from SIN swap_to → QUITAR (no descuenta ese insumo).
--
-- Solo aplica al descuento de stock (receta base y extra). La liberación de
-- comprometido sigue soltando el insumo original de la receta, que es lo
-- correcto (no se usó). Reverso simétrico. Aditivo e idempotente.

-- ─── descontar_stock_por_venta (con "quitar sin reemplazo") ──────────────
create or replace function public.descontar_stock_por_venta()
 returns trigger
 language plpgsql
as $function$
declare
  r record;
  v_qty numeric;
  v_target uuid;
begin
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

  if new.receta_id is not null then
    for r in (
      select insumo_id, sum(total_cantidad) as total
      from public.flatten_receta_insumos(new.receta_id, new.cantidad)
      group by insumo_id
    ) loop
      -- Quitar sin reemplazo: es el insumo swap_from y NO hay swap_to → saltar.
      if new.swap_from_insumo_id is not null
         and r.insumo_id = new.swap_from_insumo_id
         and new.swap_to_insumo_id is null then
        continue;
      end if;
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

  if new.extra_receta_id is not null then
    for r in (
      select insumo_id, sum(total_cantidad) as total
      from public.flatten_receta_insumos(
        new.extra_receta_id, new.cantidad * coalesce(new.extra_cantidad, 1))
      group by insumo_id
    ) loop
      if new.swap_from_insumo_id is not null
         and r.insumo_id = new.swap_from_insumo_id
         and new.swap_to_insumo_id is null then
        continue;
      end if;
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
$function$;

-- ─── revertir_stock_por_venta (reverso simétrico) ───────────────────────
create or replace function public.revertir_stock_por_venta()
 returns trigger
 language plpgsql
as $function$
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
      -- Se quitó sin reemplazo → nunca se descontó, así que NO reponer.
      if old.swap_from_insumo_id is not null
         and r.insumo_id = old.swap_from_insumo_id
         and old.swap_to_insumo_id is null then
        continue;
      end if;
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
      if old.swap_from_insumo_id is not null
         and r.insumo_id = old.swap_from_insumo_id
         and old.swap_to_insumo_id is null then
        continue;
      end if;
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
$function$;
