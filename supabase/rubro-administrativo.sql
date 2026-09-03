-- Rollup administrativo: agrupar categorías en un "rubro" solo para el análisis
-- de Administración. En Recetas/Cocina cada categoría se sigue usando tal cual.
-- Primer rubro: Smoothies + Bebidas naturales → "Smoothies y Bebidas Naturales".

-- 1) Columna nueva (nullable). null = la categoría no se agrupa (se muestra sola).
alter table public.categoria_producto add column if not exists rubro text;

-- 2) Asegurar la categoría de VENTA "Bebidas naturales" (reventa: coco frío,
--    jugos naturales embotellados…). Es de venta, no de receta (aplica_receta=false).
insert into public.categoria_producto (nombre, orden, aplica_receta)
select 'Bebidas naturales', 120, false
where not exists (
  select 1 from public.categoria_producto where nombre = 'Bebidas naturales'
);

-- 3) Asignar el rubro a las dos categorías que se aglomeran en Admin.
update public.categoria_producto
set rubro = 'Smoothies y Bebidas Naturales'
where nombre in ('Smoothies', 'Bebidas naturales');

-- 4) Arreglo de dato: el coco frío es reventa "Bebidas naturales", no Smoothies.
--    (En Admin daba igual por el rollup, pero en Cocina/clasificador salía mal.)
update public.insumos set categoria = 'Bebidas naturales'
where categoria = 'Smoothies' and nombre ilike '%coco fr%';
update public.recetas set categoria = 'Bebidas naturales'
where categoria = 'Smoothies' and nombre ilike '%coco fr%';
