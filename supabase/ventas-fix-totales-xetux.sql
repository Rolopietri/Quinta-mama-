-- Corrige las ventas importadas de Xetux cuyo total quedó inflado.
--
-- El bug: la columna VENTA NETA del reporte (que YA es el total del renglón) se
-- guardó como precio_unitario_usd y el total se calculó como cantidad × venta
-- neta → inflado. Ej.: Agua Mineral, cantidad 25, venta neta 53,97 →
-- total_usd se guardó como 25 × 53,97 = 1349,25.
--
-- La corrección deja:
--   total_usd            = la venta neta real (lo que hoy está en precio_unitario_usd)
--   precio_unitario_usd  = venta neta ÷ cantidad (el precio de una unidad)
--
-- Solo toca dinero. NO toca stock: el inventario se descontó por CANTIDAD, que
-- siempre estuvo bien. Es idempotente: marca las filas corregidas en notas para
-- no volver a dividir si se corre dos veces.

-- 1) VISTA PREVIA (no cambia nada). Revisa que "total_correcto" tenga sentido.
select
  fecha,
  receta_nombre,
  cantidad,
  precio_unitario_usd            as venta_neta_guardada,
  total_usd                      as total_inflado_actual,
  precio_unitario_usd            as total_correcto,
  round((precio_unitario_usd / cantidad)::numeric, 4) as precio_unitario_correcto
from ventas
where fuente = 'xetux_csv'
  and cantidad > 1
  and precio_unitario_usd is not null
  and coalesce(notas, '') not like '%[total corregido]%'
order by total_usd desc;

-- 2) CORRECCIÓN. Córrela UNA vez (el marcador en notas la hace segura de repetir).
update ventas
set
  total_usd           = precio_unitario_usd,
  precio_unitario_usd = round((precio_unitario_usd / cantidad)::numeric, 4),
  notas               = trim(coalesce(notas, '') || ' [total corregido]')
where fuente = 'xetux_csv'
  and cantidad > 1
  and precio_unitario_usd is not null
  and coalesce(notas, '') not like '%[total corregido]%';
