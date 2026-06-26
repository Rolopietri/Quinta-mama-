-- Cocina · Fix completar_plan_produccion
-- "Completar" es un milestone de producción — NO toca el stock.
-- El ingrediente sigue comprometido hasta que se venda (Xetux futuro) o se
-- borre/cancele el plan. Esto evita adelantarse a los hechos: completar la
-- producción no es lo mismo que vender el producto terminado.
--
-- También: borrar un plan completado libera el comprometido (asumimos que el
-- registro deja de existir, los ingredientes deben volver al pool libre).
--
-- Idempotente. CREATE OR REPLACE.

create or replace function public.completar_plan_produccion(p_plan_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
  v_estado text;
begin
  select estado into v_estado
    from public.cocina_planes_produccion where id = p_plan_id;
  if v_estado is null then
    raise exception 'Plan no encontrado';
  end if;
  if v_estado <> 'pendiente' then
    raise exception 'Solo planes pendientes pueden completarse (actual: %)', v_estado;
  end if;

  -- Solo cambiar el estado. NO se toca el stock — el ingrediente sigue
  -- comprometido. La venta (futuro Xetux) lo liberará y descontará del total.
  update public.cocina_planes_produccion
     set estado = 'completado', completado_at = now()
   where id = p_plan_id;
end;
$$;

create or replace function public.delete_plan_produccion(p_plan_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
  v_estado text;
  v_nombre text;
  v_comp record;
begin
  select estado, receta_nombre into v_estado, v_nombre
    from public.cocina_planes_produccion where id = p_plan_id;
  if v_estado is null then return; end if;

  -- Si el plan tenía compromisos activos (pendiente O completado pero no
  -- vendido), liberar el comprometido antes de borrar.
  if v_estado in ('pendiente', 'completado') then
    for v_comp in
      select insumo_id, cantidad
        from public.cocina_plan_compromisos where plan_id = p_plan_id
    loop
      update public.insumos
         set stock_comprometido = greatest(
           0,
           coalesce(stock_comprometido, 0) - v_comp.cantidad
         )
       where id = v_comp.insumo_id;

      insert into public.stock_movimientos
        (insumo_id, tipo, capa, cantidad, motivo, fecha, nota)
      values
        (v_comp.insumo_id, 'comprometido_out', 'comprometido', -v_comp.cantidad,
         'Plan borrado: ' || v_nombre, current_date,
         'Plan ' || p_plan_id::text);
    end loop;
  end if;

  delete from public.cocina_planes_produccion where id = p_plan_id;
end;
$$;
