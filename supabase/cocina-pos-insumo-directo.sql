-- Cocina · Ítem del POS mapeado directo a un insumo (reventa)
-- ════════════════════════════════════════════════════════════════
-- Permite que un ítem del POS (una bebida, agua, refresco que se compra y se
-- revende tal cual) descuente stock SIN tener que crearle una receta 1:1.
-- Se clasifica como 'insumo_directo' y se vincula directamente a un insumo,
-- con una cantidad por unidad vendida (default 1).
--
-- Al vender: descuenta cantidad_por_unidad × unidades_vendidas del insumo.
-- Al borrar la venta: lo devuelve. Todo vía los triggers ya existentes, así
-- que queda registrado en la auditoría igual que cualquier movimiento.
--
-- Aditivo e idempotente.

-- 1) Catálogo de clasificación: insumo directo + cantidad por unidad
alter table public.pos_clasificacion
  add column if not exists insumo_id uuid references public.insumos(id) on delete set null,
  add column if not exists cantidad_por_unidad numeric(12, 4);

-- 2) Ventas: guardar el insumo directo y cuánto descontar por unidad
alter table public.ventas
  add column if not exists insumo_id uuid references public.insumos(id) on delete set null,
  add column if not exists insumo_cantidad numeric(12, 4);

create index if not exists idx_ventas_insumo on public.ventas(insumo_id);

-- 3) Descuento de stock: primero la rama de insumo directo, luego la de receta.
create or replace function public.descontar_stock_por_venta()
returns trigger language plpgsql as $$
declare
  r record;
begin
  -- Venta mapeada directo a un insumo (reventa)
  if new.insumo_id is not null then
    update public.insumos
       set stock_actual = greatest(0, stock_actual
             - coalesce(new.insumo_cantidad, 1) * new.cantidad)
     where id = new.insumo_id;
    return new;
  end if;

  -- Venta vía receta (descuenta los insumos de la receta, con subrecetas)
  if new.receta_id is null then return new; end if;
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

-- 4) Reversión (borrar venta → devolver stock), simétrica.
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
