-- Limpieza de categorías de INSUMO (Fase A del reordenamiento de categorías).
-- Objetivo: el catálogo de Insumos (Cocina) usa ahora insumos.categoria_compra
-- (tipo de materia prima), separado de las categorías de venta de Administración.
-- Este SQL deja categoria_compra y la lista categoria_insumo limpias.
-- NO toca Administración (categoria_producto / admin_categoria).

-- 1) Remapear valores colados/duplicados a los tipos limpios.
update public.insumos set categoria_compra = 'Bebidas'
  where categoria_compra in ('Bebidas frías embotelladas/enlatadas',
                             'Smoothies y jugos naturales');  -- Smoothies es cat. de RECETA, no de insumo
update public.insumos set categoria_compra = 'Café & Té'
  where categoria_compra = 'Café y té';
update public.insumos set categoria_compra = 'Snacks'
  where categoria_compra = 'Postres';
update public.insumos set categoria_compra = 'Panadería'
  where categoria_compra = 'Panadería y harinas';
update public.insumos set categoria_compra = 'Proteínas'
  where categoria_compra = 'Adicionales/Extras';

-- 2) Clasificar los ex-"Otros" (los que la cascada mandó a "Alquileres fijos").
update public.insumos set categoria_compra = 'Granos y cereales'
  where nombre in ('ARROZ ARBORIO', 'ARROZ BASMATI');
update public.insumos set categoria_compra = 'Endulzantes'
  where nombre in ('AZUCAR BLANCA (EN SOBRE)', 'AZUCAR BLANCA (KG)', 'SPLENDA');
update public.insumos set categoria_compra = 'Condimentos & Especias'
  where nombre in ('SAL (FINA)', 'BICARBONATO');

-- 3) Dejar la lista de categorías de insumo limpia (opciones del catálogo y del
--    gestor "Clasificar insumos"). Se reconstruye para quitar las coladas/dups y
--    la basura de la semilla vieja. No hay FK: los insumos guardan el NOMBRE, así
--    que rehacer esta lista es seguro.
delete from public.categoria_insumo;
insert into public.categoria_insumo (nombre, orden) values
  ('Café & Té', 10),
  ('Lácteos', 20),
  ('Frutas & Vegetales', 30),
  ('Panadería', 40),
  ('Proteínas', 50),
  ('Salsas & Aderezos', 60),
  ('Bebidas', 70),
  ('Bebidas Alcohólicas', 80),
  ('Condimentos & Especias', 90),
  ('Endulzantes', 100),
  ('Granos y cereales', 110),
  ('Semillas y Nueces', 120),
  ('Congelados', 130),
  ('Desechables', 140),
  ('Snacks', 150)
on conflict do nothing;
