-- Cocina · FIX — consumo de SUBRECETAS por raciones (no por "batches")
-- ════════════════════════════════════════════════════════════════
-- BUG: al vender/mermar una receta que usa una subreceta, los disparadores
-- SQL calculaban el consumo de la subreceta dividiendo entre su rendimiento
-- TOTAL (ej. 500 g), tratándolo como si fuera "lo que rinde una ración". Eso
-- contaba en "fracción de batch" en vez de en raciones y subcontaba por el
-- factor de raciones-por-batch.
--
-- Ejemplo: Cesar Chicken usa 35 g de Aderezo Cesar; el Aderezo rinde 500 g
-- (= 14 raciones). Vender 11 Caesar usa 385 g:
--   ANTES: 385 / 500                    = 0.77   ✗ (fracción de batch)
--   AHORA: 385 / 500 * 14 raciones      = 10.78  ✓ (raciones reales)
--
-- El cálculo en la app (TypeScript, reserva de planes y pedido sugerido) YA
-- multiplicaba por las porciones de la subreceta; este fix pone los
-- disparadores SQL a la par, para que reserva, descuento y liberación cuadren.
--
-- Corrige flatten_receta_insumos (descuento de stock) y flatten_receta_planes
-- (liberación de comprometido). Aditivo e idempotente.

-- ─── Descuento de stock ──────────────────────────────────────────
create or replace function public.flatten_receta_insumos(
  p_receta_id uuid, p_factor numeric default 1, p_depth int default 0
)
returns table(insumo_id uuid, total_cantidad numeric)
language plpgsql as $$
declare
  r record; porciones_r int; sub_rend numeric;
  sub_rend_unidad text; sub_porciones numeric; sub_factor numeric; v_cant_conv numeric;
begin
  if p_depth > 5 then return; end if;
  select porciones into porciones_r from public.recetas where id = p_receta_id;
  if porciones_r is null or porciones_r = 0 then return; end if;
  for r in (
    select ri.insumo_id, ri.subreceta_id, ri.cantidad, ri.unidad
    from public.receta_ingredientes ri where ri.receta_id = p_receta_id
  ) loop
    if r.insumo_id is not null then
      return query
        select r.insumo_id,
               (public.convertir_para_costo(r.cantidad, r.unidad, ins.unidad_base)
                 * p_factor / porciones_r::numeric)::numeric
          from public.insumos ins where ins.id = r.insumo_id;
    elsif r.subreceta_id is not null then
      select rendimiento, rendimiento_unidad, porciones
        into sub_rend, sub_rend_unidad, sub_porciones
        from public.recetas where id = r.subreceta_id;
      if sub_rend is null or sub_rend = 0 then continue; end if;
      v_cant_conv := public.convertir_para_costo(r.cantidad, r.unidad, sub_rend_unidad);
      -- raciones de la subreceta consumidas = (cantidad usada / rendimiento total)
      --                                        * porciones de la subreceta
      sub_factor := (v_cant_conv * p_factor / porciones_r::numeric)
                    / sub_rend * coalesce(nullif(sub_porciones, 0), 1);
      return query
        select fi.insumo_id, fi.total_cantidad
          from public.flatten_receta_insumos(r.subreceta_id, sub_factor, p_depth + 1) fi;
    end if;
  end loop;
end;
$$;

-- ─── Liberación de comprometido (planes) ─────────────────────────
create or replace function public.flatten_receta_planes(
  p_receta_id uuid, p_factor numeric default 1, p_depth int default 0
)
returns table(receta_id uuid, factor numeric)
language plpgsql as $$
declare
  r record; porciones_r int; sub_rend numeric;
  sub_rend_unidad text; sub_porciones numeric; sub_factor numeric; v_cant_conv numeric;
begin
  if p_depth > 5 then return; end if;
  return query select p_receta_id, p_factor;
  select porciones into porciones_r from public.recetas where id = p_receta_id;
  if porciones_r is null or porciones_r = 0 then return; end if;
  for r in (
    select ri.subreceta_id, ri.cantidad, ri.unidad
    from public.receta_ingredientes ri
    where ri.receta_id = p_receta_id and ri.subreceta_id is not null
  ) loop
    select rendimiento, rendimiento_unidad, porciones
      into sub_rend, sub_rend_unidad, sub_porciones
      from public.recetas where id = r.subreceta_id;
    if sub_rend is null or sub_rend = 0 then continue; end if;
    v_cant_conv := public.convertir_para_costo(r.cantidad, r.unidad, sub_rend_unidad);
    sub_factor := (v_cant_conv * p_factor / porciones_r::numeric)
                  / sub_rend * coalesce(nullif(sub_porciones, 0), 1);
    return query
      select * from public.flatten_receta_planes(r.subreceta_id, sub_factor, p_depth + 1);
  end loop;
end;
$$;
