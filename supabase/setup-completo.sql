-- ============================================================================
-- SETUP COMPLETO — recrea TODA la base de datos en un proyecto Supabase NUEVO.
-- Generado y VERIFICADO aplicándolo en una base PostgreSQL vacía (orden correcto,
-- con el motor canónico de cocina al final). Idempotente: seguro re-ejecutar.
--
-- Uso:
--   1) Crea un proyecto NUEVO en Supabase (aparte del de Quinta Mamá).
--   2) SQL Editor -> New query -> pega TODO este archivo -> Run.
--
-- Nota: los bloques '*-seed.sql' cargan datos de EJEMPLO (equipo, plantillas,
-- mobiliario) que puedes borrar luego en un proyecto distinto.
-- ============================================================================

-- ############################################################################
-- ## schema.sql
-- ############################################################################
-- Schema para Quinta Mamá
-- Ejecuta este SQL en: Supabase → SQL Editor → New query
--
-- Crea las tablas para tareas y eventos, con seguridad fila-por-fila (RLS).
-- Solo los usuarios logueados pueden ver/modificar datos.
-- La whitelist de emails se hace en el código de la app.

-- ============================================================
-- TAREAS
-- ============================================================
create table if not exists public.tareas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  estado text not null default 'pendiente',
  area text,
  prioridad text,
  asignado_a text,
  fecha_limite date,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table public.tareas enable row level security;

drop policy if exists "tareas_select_authenticated" on public.tareas;
create policy "tareas_select_authenticated"
  on public.tareas for select
  to authenticated
  using (true);

drop policy if exists "tareas_insert_authenticated" on public.tareas;
create policy "tareas_insert_authenticated"
  on public.tareas for insert
  to authenticated
  with check (true);

drop policy if exists "tareas_update_authenticated" on public.tareas;
create policy "tareas_update_authenticated"
  on public.tareas for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "tareas_delete_authenticated" on public.tareas;
create policy "tareas_delete_authenticated"
  on public.tareas for delete
  to authenticated
  using (true);

-- ============================================================
-- EVENTOS
-- ============================================================
create table if not exists public.eventos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  fecha date not null,
  estado text not null default 'por_confirmar',
  ubicacion text,
  cliente text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table public.eventos enable row level security;

drop policy if exists "eventos_select_authenticated" on public.eventos;
create policy "eventos_select_authenticated"
  on public.eventos for select
  to authenticated
  using (true);

drop policy if exists "eventos_insert_authenticated" on public.eventos;
create policy "eventos_insert_authenticated"
  on public.eventos for insert
  to authenticated
  with check (true);

drop policy if exists "eventos_update_authenticated" on public.eventos;
create policy "eventos_update_authenticated"
  on public.eventos for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "eventos_delete_authenticated" on public.eventos;
create policy "eventos_delete_authenticated"
  on public.eventos for delete
  to authenticated
  using (true);

-- ============================================================
-- TRIGGER: actualizar updated_at automáticamente
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tareas_set_updated_at on public.tareas;
create trigger tareas_set_updated_at
  before update on public.tareas
  for each row execute function public.set_updated_at();

drop trigger if exists eventos_set_updated_at on public.eventos;
create trigger eventos_set_updated_at
  before update on public.eventos
  for each row execute function public.set_updated_at();

-- ============================================================
-- DATOS DE EJEMPLO (puedes borrarlos después)
-- ============================================================
insert into public.tareas (titulo, estado, area, prioridad, asignado_a) values
  ('Entrega de contratos a inquilinos', 'en_proceso', 'Legal', 'alta', 'Beatriz'),
  ('Coordinar Pop Up Cocol''s Choices + Port de Bras', 'pendiente', 'Eventos', 'media', 'Equipo'),
  ('Revisar pago Corpoelect', 'urgente', 'Finanzas', 'alta', 'Beatriz + Norberto')
on conflict do nothing;

insert into public.eventos (titulo, fecha, estado, notas) values
  ('🛍️ Pop Up Cocol''s Choices + Port de Bras', '2026-05-29', 'por_confirmar', null),
  ('🛍️ Pop Up Costaiia', '2026-05-09', 'por_confirmar', null),
  ('🎉 Evento del 30 de mayo', '2026-05-30', 'confirmado', 'Evento más importante del mes')
on conflict do nothing;


-- ############################################################################
-- ## admin-cliente-alias.sql
-- ############################################################################
-- Administración · CXC: unificar clientes (alias)
-- Zetux a veces reporta a la misma persona con nombres distintos
-- (p. ej. "Marianela" y "Marianella Carrillo"). Aquí guardamos que un nombre
-- alterno (alias) corresponde a un cliente canónico, para agrupar su saldo e
-- historial bajo un solo cliente. Solo afecta cómo se AGRUPA/MUESTRA; no cambia
-- las cuentas ni los pagos ya guardados.
create table if not exists public.admin_cliente_alias (
  id uuid primary key default gen_random_uuid(),
  alias_key text not null unique,   -- nombre alterno, normalizado (sin acentos/mayúsculas)
  canonico text not null,           -- nombre a mostrar y bajo el cual se agrupa
  created_at timestamptz not null default now()
);
alter table public.admin_cliente_alias enable row level security;


-- ############################################################################
-- ## admin-config.sql
-- ############################################################################
-- Administración · Ajustes del panel (clave/valor)
-- Guarda configuraciones simples que tú controlas, ej. la devaluación
-- mensual estimada del bolívar. Tabla CERRADA (RLS activo sin políticas).
create table if not exists public.admin_config (
  clave text primary key,
  valor text,
  updated_at timestamptz not null default now()
);
alter table public.admin_config enable row level security;


-- ############################################################################
-- ## admin-ingresos.sql
-- ############################################################################
-- Administración · Ingresos y sus categorías
-- Tablas CERRADAS (RLS activo sin políticas): solo el servidor con la
-- contraseña de administración. Un ingreso es dinero que ENTRA; se clasifica
-- por categoría y, para alquileres, se anota el pagador (inquilino/cliente).

create table if not exists public.admin_categoria_ingreso (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_admin_cati_nombre on public.admin_categoria_ingreso (lower(nombre));

create table if not exists public.admin_ingreso (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  concepto text,
  categoria_id uuid references public.admin_categoria_ingreso(id) on delete set null,
  categoria_nombre text,                 -- snapshot del nombre de categoría
  pagador text,                          -- quién pagó (inquilino/cliente)
  monto numeric(16,2),                   -- en moneda original
  moneda text,                           -- Bs | USD | EUR
  tasa numeric(16,4),
  monto_usd numeric(16,2),               -- equivalente calculado al registrar
  metodo text,
  factura text,                          -- factura/recibo
  nota text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_admin_ingreso_fecha on public.admin_ingreso (fecha);

alter table public.admin_categoria_ingreso enable row level security;
alter table public.admin_ingreso enable row level security;

drop trigger if exists admin_ingreso_set_updated on public.admin_ingreso;
create trigger admin_ingreso_set_updated
  before update on public.admin_ingreso
  for each row execute function public.set_updated_at();

-- Categorías de ingreso iniciales (se pueden editar/agregar después).
insert into public.admin_categoria_ingreso (nombre) values
  ('Alquiler'),
  ('Eventos'),
  ('Talleres'),
  ('Cafetería'),
  ('Donaciones'),
  ('Ventas'),
  ('Otros')
on conflict do nothing;


-- ############################################################################
-- ## admin-iva.sql
-- ############################################################################
-- Administración · IVA en ingresos
-- Las ventas facturadas traen IVA incluido; el IVA no es ingreso. Se guarda el
-- neto en monto y el IVA aparte en la columna iva.
alter table public.admin_ingreso add column if not exists iva numeric(16,2);

-- Ajustes: % de IVA y métodos exentos (sin factura → sin IVA).
insert into public.admin_config (clave, valor) values
  ('iva_pct', '16'),
  ('metodos_sin_iva', 'Zelle, Dólar')
on conflict (clave) do nothing;


-- ############################################################################
-- ## admin-propinas.sql
-- ############################################################################
-- Administración · Propinas (tips)
-- La propina NO es ingreso, pero se registra aparte para saber cuánto entró.
-- Se llena al importar Setux (una fila por día/reporte). Tabla CERRADA (RLS).
create table if not exists public.admin_propina (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  monto numeric(16,2),          -- total de propina del reporte (moneda EUR)
  moneda text default 'EUR',
  fuente text,                  -- 'setux'
  nota text,
  created_at timestamptz not null default now()
);
create index if not exists idx_admin_propina_fecha on public.admin_propina (fecha);
create index if not exists idx_admin_propina_fuente on public.admin_propina (fuente, fecha);
alter table public.admin_propina enable row level security;


-- ############################################################################
-- ## admin-proveedores.sql
-- ############################################################################
-- Administración · Proveedores (base de datos)
-- Tabla CERRADA (RLS activo sin políticas): solo el servidor con la contraseña
-- de administración la lee/escribe, igual que el resto de admin_*.

create table if not exists public.admin_proveedor (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  concepto text,               -- producto o servicio que ofrece
  cedula text,
  rif text,
  numero_cuenta text,
  banco text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_admin_prov_nombre on public.admin_proveedor (lower(nombre));

alter table public.admin_proveedor enable row level security;

drop trigger if exists admin_prov_set_updated on public.admin_proveedor;
create trigger admin_prov_set_updated
  before update on public.admin_proveedor
  for each row execute function public.set_updated_at();


-- ############################################################################
-- ## admin-solicitudes.sql
-- ############################################################################
-- Administración · Solicitudes de pago (y sus líneas)
-- Tablas CERRADAS (RLS activo sin políticas): solo el servidor con la
-- contraseña de administración. Una solicitud = "hay que pagar esto";
-- NO es un egreso hasta que se confirme el pago (fase posterior).

create table if not exists public.admin_solicitud (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  estado text not null default 'pendiente',   -- pendiente | procesada
  nota text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_solicitud_linea (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references public.admin_solicitud(id) on delete cascade,
  orden int not null default 0,
  tipo text not null default 'proveedor',      -- proveedor | adicional
  proveedor_id uuid references public.admin_proveedor(id) on delete set null,
  proveedor_nombre text,                        -- snapshot del nombre
  datos_registrados boolean not null default false,
  concepto text,
  monto numeric(16,2),
  moneda text,                                  -- Bs | USD | EUR
  metodo text,                                  -- Transferencia | Zelle | Efectivo | USDT | ...
  tasa numeric(16,4),
  tasa_tipo text,                               -- dólar | del día | promedio | VNC | USDT | otra
  factura text,
  nota text
);
create index if not exists idx_admin_sol_linea on public.admin_solicitud_linea (solicitud_id);

alter table public.admin_solicitud enable row level security;
alter table public.admin_solicitud_linea enable row level security;

drop trigger if exists admin_sol_set_updated on public.admin_solicitud;
create trigger admin_sol_set_updated
  before update on public.admin_solicitud
  for each row execute function public.set_updated_at();


-- ############################################################################
-- ## admin-ticket-dia.sql
-- ############################################################################
-- Administración · Tickets por día (del "Reporte Detallado por Factura")
-- Guarda, por día, cuántas facturas (tickets) hubo y su total, para el ticket
-- promedio. Se llena al cargar el reporte por factura. Tabla CERRADA (RLS).
create table if not exists public.admin_ticket_dia (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  tickets int not null default 0,
  total_bruto numeric(16,2) not null default 0,  -- Total Venta (con IVA), sin propina
  total_neto numeric(16,2) not null default 0,   -- Venta Neta (sin IVA)
  propina numeric(16,2) not null default 0,
  moneda text default 'EUR',
  fuente text,                                    -- 'factura'
  created_at timestamptz not null default now()
);
create unique index if not exists idx_admin_ticket_dia_fecha on public.admin_ticket_dia (fecha);
alter table public.admin_ticket_dia enable row level security;


-- ############################################################################
-- ## calendario.sql
-- ############################################################################
-- Calendario — Agenda unificada de Quinta Mamá
-- Ejecuta este SQL en: Supabase → SQL Editor → New query
--
-- Una sola tabla para todo lo que va al calendario compartido:
--   eventos, reuniones, objetivos/metas y tareas.
-- Cada fila lleva su `tipo` (para diferenciar por color) y un `responsable`
-- (nombre de la persona) para saber "qué le toca a cada quien".
-- Seguridad fila-por-fila (RLS): cualquier usuario logueado puede ver y editar,
-- igual que las tablas `tareas` y `eventos`.

create table if not exists public.calendario_items (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'evento',          -- evento | reunion | objetivo | tarea
  titulo text not null,
  fecha date not null,                          -- fecha de inicio (YYYY-MM-DD)
  fecha_fin date,                               -- opcional: último día (rango)
  hora text,                                    -- opcional: "HH:MM"
  responsable text,                             -- nombre de la persona (texto libre)
  area text,                                    -- área (texto libre)
  estado text not null default 'pendiente',     -- pendiente | en_proceso | completado | cancelado
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table public.calendario_items enable row level security;

drop policy if exists "calendario_select_authenticated" on public.calendario_items;
create policy "calendario_select_authenticated"
  on public.calendario_items for select
  to authenticated
  using (true);

drop policy if exists "calendario_insert_authenticated" on public.calendario_items;
create policy "calendario_insert_authenticated"
  on public.calendario_items for insert
  to authenticated
  with check (true);

drop policy if exists "calendario_update_authenticated" on public.calendario_items;
create policy "calendario_update_authenticated"
  on public.calendario_items for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "calendario_delete_authenticated" on public.calendario_items;
create policy "calendario_delete_authenticated"
  on public.calendario_items for delete
  to authenticated
  using (true);

-- Índice para leer rápido por fecha (el calendario ordena/filtra por fecha).
create index if not exists calendario_items_fecha_idx
  on public.calendario_items (fecha);

-- Trigger: mantener updated_at al día. Definimos la función junto al trigger
-- (create or replace, idempotente) para que este archivo funcione también en
-- una base nueva desde cero, sin depender del orden con schema.sql.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists calendario_items_set_updated_at on public.calendario_items;
create trigger calendario_items_set_updated_at
  before update on public.calendario_items
  for each row execute function public.set_updated_at();


-- ############################################################################
-- ## categoria-por-nombre.sql
-- ############################################################################
-- Categoría de venta ASIGNADA POR NOMBRE del ítem del POS.
-- Sirve para clasificar en el análisis los ítems que NO son receta ni insumo de
-- reventa (consignación, servicios, "sin clasificar") — que no tienen dónde
-- guardar su categoría. Se matchea por el nombre normalizado del ítem tal como
-- llega del reporte (misma normalización que pos_clasificacion). La categoría
-- guardada es el NOMBRE de una categoria_producto.
create table if not exists public.categoria_por_nombre (
  id uuid primary key default gen_random_uuid(),
  nombre_norm text not null,
  nombre_original text not null,
  categoria text not null,
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_categoria_por_nombre_norm
  on public.categoria_por_nombre (nombre_norm);

alter table public.categoria_por_nombre enable row level security;
drop policy if exists "catnombre_select" on public.categoria_por_nombre;
create policy "catnombre_select" on public.categoria_por_nombre for select to authenticated using (true);
drop policy if exists "catnombre_insert" on public.categoria_por_nombre;
create policy "catnombre_insert" on public.categoria_por_nombre for insert to authenticated with check (true);
drop policy if exists "catnombre_update" on public.categoria_por_nombre;
create policy "catnombre_update" on public.categoria_por_nombre for update to authenticated using (true) with check (true);
drop policy if exists "catnombre_delete" on public.categoria_por_nombre;
create policy "catnombre_delete" on public.categoria_por_nombre for delete to authenticated using (true);


-- ############################################################################
-- ## categoria-producto.sql
-- ############################################################################
-- Categorías de producto DEFINIDAS POR EL USUARIO (para el análisis de ventas).
-- Antes eran una lista fija en el código; ahora se gestionan desde la página
-- (Administración → Análisis de ventas → Clasificar productos) y se comparten
-- con los demás módulos (el formulario de receta usa la misma lista). El
-- producto guarda el NOMBRE de la categoría en recetas.categoria / insumos.categoria.
create table if not exists public.categoria_producto (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  orden int not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_categoria_producto_nombre
  on public.categoria_producto (lower(nombre));

-- Categorías excluidas de los rankings (más vendido, mayor facturación, tops):
-- p.ej. alquileres fijos, eventos, alquileres por bloque — que por su valor
-- dominarían el análisis. Siguen sumando en totales y en "por categoría".
alter table public.categoria_producto
  add column if not exists excluir_ranking boolean not null default false;

alter table public.categoria_producto enable row level security;
drop policy if exists "catprod_select" on public.categoria_producto;
create policy "catprod_select" on public.categoria_producto for select to authenticated using (true);
drop policy if exists "catprod_insert" on public.categoria_producto;
create policy "catprod_insert" on public.categoria_producto for insert to authenticated with check (true);
drop policy if exists "catprod_update" on public.categoria_producto;
create policy "catprod_update" on public.categoria_producto for update to authenticated using (true) with check (true);
drop policy if exists "catprod_delete" on public.categoria_producto;
create policy "catprod_delete" on public.categoria_producto for delete to authenticated using (true);

-- Semilla inicial (puedes editarlas/borrarlas/agregar las tuyas desde la página).
insert into public.categoria_producto (nombre, orden) values
  ('Café espresso', 10),
  ('Café con leche', 20),
  ('Té e infusiones', 30),
  ('Limonadas', 40),
  ('Jugos y frutales', 50),
  ('Refrescos y sodas', 60),
  ('Smoothies', 70),
  ('Desayunos', 80),
  ('Sándwiches', 90),
  ('Bowls', 100),
  ('Platos fuertes', 110),
  ('Pasapalos / Tequeños', 120),
  ('Postres', 130),
  ('Repostería', 140),
  ('Otros', 999)
on conflict do nothing;


-- ############################################################################
-- ## cocina-config.sql
-- ############################################################################
-- Fase 3 — Configuración de rentabilidad
-- Tabla singleton (siempre id=1) con parámetros del cálculo:
--   • Food cost objetivo (ej: 30% — para sugerir precio = costo / 0.30)
--   • Gastos operativos % (para utilidad neta = bruta - gastos)
--   • Umbrales del semáforo (margen >= verde → 🟢; >= amarillo → 🟡; < → 🔴)

create table if not exists public.cocina_config (
  id int primary key default 1 check (id = 1),
  food_cost_objetivo_porc numeric(5, 2) not null default 30,
  gastos_operativos_porc numeric(5, 2) not null default 0,
  margen_verde_min numeric(5, 2) not null default 70,
  margen_amarillo_min numeric(5, 2) not null default 60,
  updated_at timestamptz not null default now()
);

insert into public.cocina_config (id) values (1) on conflict do nothing;

alter table public.cocina_config enable row level security;

drop policy if exists "cfg_select" on public.cocina_config;
create policy "cfg_select" on public.cocina_config
  for select to authenticated using (true);

drop policy if exists "cfg_update" on public.cocina_config;
create policy "cfg_update" on public.cocina_config
  for update to authenticated using (true) with check (true);

drop policy if exists "cfg_insert" on public.cocina_config;
create policy "cfg_insert" on public.cocina_config
  for insert to authenticated with check (true);


-- ############################################################################
-- ## cocina-conteo-fisico.sql
-- ############################################################################
-- Conteo físico (reconciliación de inventario).
-- Setea el stock_actual de un insumo a un valor ABSOLUTO (lo que se contó
-- físicamente) y registra el ajuste en el libro de movimientos. Atómico y con
-- lock de fila para no perder cambios concurrentes (ventas/compras entre medias).
--
-- Es distinto de registrar_perdida_stock (que RESTA una cantidad relativa):
-- aquí el usuario dice "tengo 47 de esto" y el sistema calcula la diferencia.
--
-- Aditivo e idempotente.
create or replace function public.ajustar_stock_conteo(
  p_insumo_id uuid,
  p_nuevo numeric,
  p_nota text default null
) returns numeric
language plpgsql
security invoker
as $$
declare
  v_viejo numeric;
  v_delta numeric;
begin
  if p_nuevo is null or p_nuevo < 0 then
    raise exception 'El conteo debe ser un número mayor o igual a 0';
  end if;

  select stock_actual into v_viejo
    from public.insumos where id = p_insumo_id
    for update;
  if not found then
    raise exception 'Insumo no encontrado';
  end if;

  v_delta := p_nuevo - coalesce(v_viejo, 0);
  if v_delta = 0 then
    return p_nuevo;  -- sin cambios: no ensucia el historial
  end if;

  update public.insumos set stock_actual = p_nuevo where id = p_insumo_id;

  insert into public.stock_movimientos
    (insumo_id, tipo, capa, cantidad, motivo, fecha, nota)
  values
    (p_insumo_id, 'ajuste', 'total', v_delta, 'Conteo físico', current_date,
     nullif(btrim(coalesce(p_nota, '')), ''));

  return p_nuevo;
end;
$$;


-- ############################################################################
-- ## cocina-fix-conversion-descuento-stock.sql
-- ############################################################################
-- Cocina · FIX — conversión de unidades al descontar stock por venta/merma
-- ════════════════════════════════════════════════════════════════
-- BUG: la función recursiva flatten_receta_insumos (usada por el trigger que
-- descuenta stock en cada venta/merma) restaba la cantidad del ingrediente TAL
-- CUAL, sin convertir su unidad a la unidad base del insumo. Si una receta
-- declara el aceite en "ml" pero el insumo está en "L", restaba (p.ej.) 30 L
-- en vez de 30 ml → vaciaba el stock (y greatest(0, …) lo dejaba en 0).
--
-- El resto de la app (pedido sugerido, planes de producción) ya convertía
-- unidades (ver src/lib/units.ts). Este fix lleva la MISMA conversión a la
-- base de datos, para que el descuento cuadre.
--
-- Reglas (idénticas a units.ts):
--   • peso  → base g   (kg=1000, g=1, mg=0.001)
--   • vol   → base ml  (L=1000, ml=1, cc=1)
--   • conteo→ base unidad
--   • unidades desconocidas o iguales → se restan tal cual (sin conversión).
--
-- Aditivo e idempotente. NO cambia datos ya guardados; solo corrige el cálculo
-- de aquí en adelante.

-- ─── Helpers de unidades ─────────────────────────────────────────

-- Normaliza: minúsculas, sin espacios extra, sin acentos.
create or replace function public.unidad_norm(u text)
returns text language sql immutable as $$
  select lower(btrim(translate(coalesce(u, ''),
    'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')));
$$;

-- Dimensión de la unidad (peso | volumen | conteo | desconocida).
create or replace function public.unidad_dim(u text)
returns text language sql immutable as $$
  select case public.unidad_norm(u)
    when 'g' then 'peso' when 'gr' then 'peso' when 'grs' then 'peso'
    when 'gramo' then 'peso' when 'gramos' then 'peso'
    when 'kg' then 'peso' when 'kgs' then 'peso' when 'kilo' then 'peso'
    when 'kilos' then 'peso' when 'kilogramo' then 'peso' when 'kilogramos' then 'peso'
    when 'mg' then 'peso' when 'miligramo' then 'peso' when 'miligramos' then 'peso'
    when 'ml' then 'volumen' when 'mililitro' then 'volumen' when 'mililitros' then 'volumen'
    when 'cc' then 'volumen'
    when 'l' then 'volumen' when 'lt' then 'volumen' when 'lts' then 'volumen'
    when 'litro' then 'volumen' when 'litros' then 'volumen'
    when 'unidad' then 'conteo' when 'unidades' then 'conteo' when 'u' then 'conteo'
    when 'und' then 'conteo' when 'pza' then 'conteo' when 'pzas' then 'conteo'
    when 'pieza' then 'conteo' when 'piezas' then 'conteo'
    when 'porcion' then 'conteo' when 'porciones' then 'conteo'
    else 'desconocida'
  end;
$$;

-- Factor hacia la unidad base de su dimensión (g o ml). null = desconocida.
create or replace function public.unidad_factor(u text)
returns numeric language sql immutable as $$
  select case public.unidad_norm(u)
    when 'g' then 1 when 'gr' then 1 when 'grs' then 1
    when 'gramo' then 1 when 'gramos' then 1
    when 'kg' then 1000 when 'kgs' then 1000 when 'kilo' then 1000
    when 'kilos' then 1000 when 'kilogramo' then 1000 when 'kilogramos' then 1000
    when 'mg' then 0.001 when 'miligramo' then 0.001 when 'miligramos' then 0.001
    when 'ml' then 1 when 'mililitro' then 1 when 'mililitros' then 1 when 'cc' then 1
    when 'l' then 1000 when 'lt' then 1000 when 'lts' then 1000
    when 'litro' then 1000 when 'litros' then 1000
    when 'unidad' then 1 when 'unidades' then 1 when 'u' then 1 when 'und' then 1
    when 'pza' then 1 when 'pzas' then 1 when 'pieza' then 1 when 'piezas' then 1
    when 'porcion' then 1 when 'porciones' then 1
    else null
  end;
$$;

-- Convierte `cantidad` de u_from a u_to. Si son la misma unidad literal, o si
-- alguna es desconocida, o si son de dimensiones distintas → devuelve la
-- cantidad sin tocar (mismo fallback que convertirParaCosto en units.ts).
create or replace function public.convertir_para_costo(
  cantidad numeric, u_from text, u_to text
)
returns numeric language sql immutable as $$
  select case
    when public.unidad_norm(u_from) = public.unidad_norm(u_to) then cantidad
    when public.unidad_factor(u_from) is not null
     and public.unidad_factor(u_to) is not null
     and public.unidad_dim(u_from) = public.unidad_dim(u_to)
      then cantidad * public.unidad_factor(u_from) / public.unidad_factor(u_to)
    else cantidad
  end;
$$;

-- ─── flatten_receta_insumos  →  MOVIDA (A5, dedupe) ───────────────
-- Esta era una versión anterior (con conversión pero SIN el factor de
-- porciones de subreceta). La canónica está en cocina-zzz-motor-canonico.sql.
-- Las funciones de unidades de ARRIBA (unidad_norm/dim/factor/convertir_para_costo)
-- sí son canónicas y se quedan aquí (no están duplicadas).


-- ############################################################################
-- ## cocina-iva.sql
-- ############################################################################
-- Cocina · IVA configurable (M4 Rentabilidad)
-- Agrega el porcentaje de IVA aplicable a precios de carta. Default 16%
-- (Venezuela). Editable desde la pantalla de Rentabilidad.
--
-- Aditivo, idempotente — corre seguro varias veces.

alter table public.cocina_config
  add column if not exists iva_porc numeric(5, 2) not null default 16;

-- Asegurar que la fila singleton (id=1) tenga el valor por defecto si ya existía
update public.cocina_config
   set iva_porc = 16
 where id = 1 and iva_porc is null;


-- ############################################################################
-- ## cocina-menaje.sql
-- ############################################################################
-- Cocina · M6 Menaje
-- Vajilla, cristalería, cubiertos, bandejas, utensilios, textiles — todo
-- material durable que no se vende pero hay que inventariar y gestionar
-- (roturas, deterioro, manchas, pérdidas, robo) + reposiciones por compra.
--
-- Idempotente. Aditivo — no toca tablas existentes.

-- ════════════════════════════════════════════════════════════════
-- 1. ITEMS del menaje
-- ════════════════════════════════════════════════════════════════
create table if not exists public.menaje_items (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  categoria text not null default 'Otros',        -- texto libre (Vajilla, Cristalería, Cubiertos...)
  descripcion text,
  cantidad_actual numeric(10, 2) not null default 0,
  cantidad_inicial numeric(10, 2),                -- referencia para saber cuánto entró originalmente
  precio_reposicion_usd numeric(10, 2),           -- opcional — para presupuestar reposiciones
  foto_url text,
  notas text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_menaje_categoria on public.menaje_items(categoria);

alter table public.menaje_items enable row level security;

drop policy if exists "menaje_select" on public.menaje_items;
create policy "menaje_select" on public.menaje_items
  for select to authenticated using (true);
drop policy if exists "menaje_insert" on public.menaje_items;
create policy "menaje_insert" on public.menaje_items
  for insert to authenticated with check (true);
drop policy if exists "menaje_update" on public.menaje_items;
create policy "menaje_update" on public.menaje_items
  for update to authenticated using (true) with check (true);
drop policy if exists "menaje_delete" on public.menaje_items;
create policy "menaje_delete" on public.menaje_items
  for delete to authenticated using (true);

drop trigger if exists menaje_set_updated on public.menaje_items;
create trigger menaje_set_updated
  before update on public.menaje_items
  for each row execute function public.set_updated_at();

-- ════════════════════════════════════════════════════════════════
-- 2. MOVIMIENTOS del menaje (bajas y compras)
-- ════════════════════════════════════════════════════════════════
-- Tipos canónicos:
--   Bajas (cantidad negativa): rotura | deterioro | mancha | perdida | robo | otro | ajuste
--   Entradas (cantidad positiva): compra | reposicion | ajuste
create table if not exists public.menaje_movimientos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.menaje_items(id) on delete cascade,
  tipo text not null,
  cantidad numeric(10, 2) not null,             -- positivo=entra, negativo=sale
  motivo text,
  fecha date not null default current_date,
  factura_url text,                              -- enlace al archivo de factura en Storage
  factura_nombre text,                           -- nombre original del archivo para mostrar
  precio_unitario_usd numeric(10, 2),
  precio_total_usd numeric(10, 2),
  nota text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_menaje_mov_item on public.menaje_movimientos(item_id);
create index if not exists idx_menaje_mov_fecha on public.menaje_movimientos(fecha desc);
create index if not exists idx_menaje_mov_tipo on public.menaje_movimientos(tipo);

alter table public.menaje_movimientos enable row level security;

drop policy if exists "mmov_select" on public.menaje_movimientos;
create policy "mmov_select" on public.menaje_movimientos
  for select to authenticated using (true);
drop policy if exists "mmov_insert" on public.menaje_movimientos;
create policy "mmov_insert" on public.menaje_movimientos
  for insert to authenticated with check (true);
drop policy if exists "mmov_update" on public.menaje_movimientos;
create policy "mmov_update" on public.menaje_movimientos
  for update to authenticated using (true) with check (true);
drop policy if exists "mmov_delete" on public.menaje_movimientos;
create policy "mmov_delete" on public.menaje_movimientos
  for delete to authenticated using (true);

-- ════════════════════════════════════════════════════════════════
-- 3. STORAGE BUCKET para facturas (PDF/imagen)
-- ════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public, file_size_limit)
values ('menaje-facturas', 'menaje-facturas', false, 10485760)  -- 10 MB max
on conflict (id) do nothing;

-- Policies: usuarios autenticados pueden subir, leer y borrar archivos del bucket
drop policy if exists "menaje_facturas_select" on storage.objects;
create policy "menaje_facturas_select" on storage.objects
  for select to authenticated using (bucket_id = 'menaje-facturas');

drop policy if exists "menaje_facturas_insert" on storage.objects;
create policy "menaje_facturas_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'menaje-facturas');

drop policy if exists "menaje_facturas_update" on storage.objects;
create policy "menaje_facturas_update" on storage.objects
  for update to authenticated using (bucket_id = 'menaje-facturas');

drop policy if exists "menaje_facturas_delete" on storage.objects;
create policy "menaje_facturas_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'menaje-facturas');


-- ############################################################################
-- ## cocina-planes-ajustar-completado.sql
-- ############################################################################
-- Cocina · Ajustar un plan de producción COMPLETADO
-- ════════════════════════════════════════════════════════════════
-- Permite corregir un plan ya completado cuando cambia el rendimiento de la
-- receta (ej. bajas el tamaño de porción → el mismo lote rinde más) o cuando
-- hay que emparejar cuántas porciones ya se consumieron.
--
-- Ajusta las 3 capas para que quede real, no cosmético:
--   • raciones y raciones_consumidas del plan.
--   • stock físico: la fracción consumida pasa de C/R (vieja, ya descontada por
--     ventas) a C'/R' (nueva) → se descuenta/devuelve la diferencia por insumo.
--   • stock comprometido: se recalcula (queda reservado (R'-C')/R' del lote).
--
-- El compromiso por insumo (cantidad de crudo del lote) NO cambia: el lote
-- físico es el mismo, solo cambia en cuántas porciones se divide.
--
-- Idempotente en el sentido de que puedes correrlo varias veces con distintos
-- valores; cada llamada ajusta desde el estado actual.

create or replace function public.ajustar_plan_completado(
  p_plan_id uuid,
  p_raciones numeric,
  p_raciones_consumidas numeric
) returns void
language plpgsql
security invoker
as $$
declare
  v_estado   text;
  v_r_old    numeric;
  v_c_old    numeric;
  v_delta    numeric;
  v_comp     record;
  v_estado_nuevo text;
begin
  select estado, raciones, coalesce(raciones_consumidas, 0)
    into v_estado, v_r_old, v_c_old
    from public.cocina_planes_produccion
   where id = p_plan_id;

  if v_estado is null then
    raise exception 'Plan no encontrado';
  end if;
  if v_estado not in ('completado', 'vendido') then
    raise exception 'Solo se ajustan planes completados (actual: %)', v_estado;
  end if;
  if p_raciones is null or p_raciones <= 0 then
    raise exception 'Las raciones deben ser mayores a 0.';
  end if;
  if p_raciones_consumidas is null
     or p_raciones_consumidas < 0
     or p_raciones_consumidas > p_raciones then
    raise exception 'Las consumidas deben estar entre 0 y las raciones.';
  end if;

  -- Diferencia de fracción consumida: lo ya servido pasa de C/R a C'/R'.
  v_delta := (p_raciones_consumidas / p_raciones)
             - (v_c_old / nullif(v_r_old, 0));

  if v_delta is not null and v_delta <> 0 then
    for v_comp in
      select insumo_id, cantidad
        from public.cocina_plan_compromisos
       where plan_id = p_plan_id
    loop
      update public.insumos
         set stock_actual = greatest(0, stock_actual - v_comp.cantidad * v_delta)
       where id = v_comp.insumo_id;
    end loop;
  end if;

  v_estado_nuevo := case
                      when p_raciones_consumidas >= p_raciones then 'vendido'
                      else 'completado'
                    end;

  update public.cocina_planes_produccion
     set raciones            = p_raciones,
         raciones_consumidas = p_raciones_consumidas,
         estado              = v_estado_nuevo
   where id = p_plan_id;

  -- Recalcular el comprometido de todos los insumos afectados.
  perform * from public.recalcular_stock_comprometido();
end;
$$;


-- ############################################################################
-- ## cocina-planes-fix-completar.sql
-- ############################################################################
-- Cocina · Fix completar_plan_produccion
-- "Completar" es un milestone de producción — NO toca el stock.
-- El ingrediente sigue comprometido hasta que se venda (Xetux) o se
-- borre/cancele el plan. Esto evita adelantarse a los hechos: completar la
-- producción no es lo mismo que vender el producto terminado.
--
-- NOTA (A5, dedupe): la definición canónica de delete_plan_produccion vive en
-- cocina-planes-venta-libera.sql (libera solo la FRACCIÓN no vendida). Antes
-- este archivo tenía otra versión de delete_plan que liberaba la cantidad
-- COMPLETA (bug A3); se eliminó de aquí para no pisar la buena.
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
  -- comprometido. La venta lo liberará y descontará del total.
  update public.cocina_planes_produccion
     set estado = 'completado', completado_at = now()
   where id = p_plan_id;
end;
$$;


-- ############################################################################
-- ## cocina-pos-quitar-insumo.sql
-- ############################################################################
-- Cocina · POS: quitar un insumo de la receta SIN reemplazo ("sin X")
-- ════════════════════════════════════════════════════════════════
-- MOVIDA (dedupe): la lógica de "sin X" (swap_from sin swap_to → se quita ese
-- insumo del descuento) ahora vive en las funciones canónicas
-- descontar_stock_por_venta y revertir_stock_por_venta de
-- cocina-zzz-motor-canonico.sql (que se aplica de último y manda).
--
-- Modelo: un ítem del POS que trae swap_from PERO swap_to = null salta ese
-- insumo en el descuento (receta base y extra), con reverso simétrico al
-- borrar la venta. Ver el motor canónico.
--
-- Este archivo se deja como marcador histórico; no crea nada.


-- ############################################################################
-- ## cocina-recalcular-comprometido.sql
-- ############################################################################
-- Cocina · Recalcular stock_comprometido desde compromisos de planes activos
-- Útil para fixear el estado si por algún motivo el comprometido se desincronizó
-- (RLS, caching, un fix a medias, lo que sea).
--
-- MODELO (confirmado con el motor real):
--   • Pendiente  → reserva la receta COMPLETA (aún no se produjo; se puede cancelar).
--   • Completado → ya se produjo; NO se puede cancelar. Sigue reservando lo que
--                  falta por vender/perder, y baja solo con ventas o mermas.
--   • Vendido    → ya se consumió del todo; no reserva nada.
--
-- Por eso la reserva viva de un plan = cantidad * (raciones - raciones_consumidas)
-- / raciones, contando planes 'pendiente' Y 'completado'. Esto reconstruye
-- EXACTAMENTE lo que mantiene el trigger liberar_comprometido_por_venta de forma
-- incremental (que también avanza raciones_consumidas por ventas y por mermas).
--
-- Idempotente — se puede correr cuantas veces sea necesario.
--
-- EFICIENCIA: solo ESCRIBE los insumos cuyo comprometido de verdad cambia. En
-- el caso normal (todo ya sincronizado) no toca ninguna fila. Así la llamada
-- automática al abrir el M5 deja de reescribir la base en cada visita.

create or replace function public.recalcular_stock_comprometido()
returns table (insumo_id uuid, stock_comprometido_anterior numeric, stock_comprometido_nuevo numeric)
language plpgsql
security invoker
as $$
begin
  return query
  with totales as (
    -- Reserva viva por insumo: solo lo que falta por vender/perder de cada plan
    -- pendiente o completado. Un plan completado sigue reservando hasta que su
    -- producto se venda o se registre como pérdida (sube raciones_consumidas).
    -- BLINDAJE: se convierte el compromiso (snapshot de unidad) a la unidad
    -- ACTUAL del insumo, para que aunque cambie la unidad base del insumo el
    -- total se calcule bien (ver cocina-fix-compromisos-unidad.sql).
    select
      c.insumo_id,
      sum(
        public.convertir_para_costo(c.cantidad, c.unidad_base, i.unidad_base)
        * (p.raciones - coalesce(p.raciones_consumidas, 0))::numeric
        / nullif(p.raciones, 0)
      ) as total_comprometido
    from public.cocina_plan_compromisos c
    join public.cocina_planes_produccion p on p.id = c.plan_id
    join public.insumos i on i.id = c.insumo_id
    where p.estado in ('pendiente', 'completado')
      and coalesce(p.raciones_consumidas, 0) < p.raciones
    group by c.insumo_id
  ),
  updates as (
    update public.insumos i
       set stock_comprometido = coalesce(t.total_comprometido, 0)
      from totales t
     where i.id = t.insumo_id
       -- Solo escribir si la diferencia es REAL. La columna guarda 4 decimales;
       -- comparar decimal por decimal reescribía siempre los valores con
       -- decimales de división (ej. guardado 42.8571 vs calculado 42.857142…).
       -- Por eso comparamos por diferencia significativa, no exacta.
       and abs(coalesce(i.stock_comprometido, 0) - coalesce(t.total_comprometido, 0)) > 0.00005
    returning i.id, 0::numeric as anterior, i.stock_comprometido as nuevo
  ),
  resets as (
    -- Insumos sin ninguna reserva viva → 0.
    update public.insumos i
       set stock_comprometido = 0
     where not exists (
       select 1 from public.cocina_plan_compromisos c
         join public.cocina_planes_produccion p on p.id = c.plan_id
        where c.insumo_id = i.id
          and p.estado in ('pendiente', 'completado')
          and coalesce(p.raciones_consumidas, 0) < p.raciones
     )
       and coalesce(i.stock_comprometido, 0) <> 0
    returning i.id, 0::numeric as anterior, 0::numeric as nuevo
  )
  select * from updates
  union all
  select * from resets;
end;
$$;


-- ############################################################################
-- ## cocina.sql
-- ############################################################################
-- Schema Sistema de Cocina — La Quinta Mamá
-- Fase 1: M1 (Materias Primas) + proveedores + compras + tasa BCV
-- Aditivo. No toca las tablas existentes.

-- ============================================================
-- TASAS DE CAMBIO BCV (auto-actualizado por cron diario)
-- ============================================================
create table if not exists public.tasa_bcv (
  fecha date primary key,
  usd_bs numeric(20, 4) not null,
  eur_bs numeric(20, 4),
  paralela_bs numeric(20, 4),
  fuente text default 'bcv',
  created_at timestamptz not null default now()
);

alter table public.tasa_bcv enable row level security;

drop policy if exists "tasa_select" on public.tasa_bcv;
create policy "tasa_select" on public.tasa_bcv
  for select to authenticated using (true);
drop policy if exists "tasa_insert" on public.tasa_bcv;
create policy "tasa_insert" on public.tasa_bcv
  for insert to authenticated with check (true);
drop policy if exists "tasa_update" on public.tasa_bcv;
create policy "tasa_update" on public.tasa_bcv
  for update to authenticated using (true) with check (true);

-- Permitir que el cron diario (sin sesión) escriba la tasa.
-- Sin riesgo: solo la tasa pública oficial del BCV entra acá.
drop policy if exists "tasa_anon_insert" on public.tasa_bcv;
create policy "tasa_anon_insert" on public.tasa_bcv
  for insert to anon with check (true);
drop policy if exists "tasa_anon_update" on public.tasa_bcv;
create policy "tasa_anon_update" on public.tasa_bcv
  for update to anon using (true) with check (true);
drop policy if exists "tasa_anon_select" on public.tasa_bcv;
create policy "tasa_anon_select" on public.tasa_bcv
  for select to anon using (true);

-- ============================================================
-- PROVEEDORES
-- ============================================================
create table if not exists public.proveedores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  contacto_nombre text,
  contacto_telefono text,
  contacto_email text,
  -- Modalidad de pago (multi-select inline)
  acepta_bs_bcv_dolar boolean not null default false,
  acepta_bs_bcv_euro boolean not null default false,
  acepta_bs_paralela boolean not null default false,
  acepta_usd_efectivo boolean not null default false,
  acepta_usd_divisa boolean not null default false,
  notas text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table public.proveedores enable row level security;

drop policy if exists "prov_select" on public.proveedores;
create policy "prov_select" on public.proveedores
  for select to authenticated using (true);
drop policy if exists "prov_insert" on public.proveedores;
create policy "prov_insert" on public.proveedores
  for insert to authenticated with check (true);
drop policy if exists "prov_update" on public.proveedores;
create policy "prov_update" on public.proveedores
  for update to authenticated using (true) with check (true);
drop policy if exists "prov_delete" on public.proveedores;
create policy "prov_delete" on public.proveedores
  for delete to authenticated using (true);

-- ============================================================
-- INSUMOS (materias primas / ingredientes)
-- ============================================================
create table if not exists public.insumos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  categoria text not null default 'otros',
  -- 'cafe', 'lacteos', 'frutas', 'panaderia', 'proteinas', 'salsas',
  -- 'bebidas', 'desechables', 'condimentos', 'snacks', 'otros'

  seccion text not null default 'ambos',  -- 'cafetin' | 'comedor' | 'ambos'

  -- Empaque de compra y unidad base de uso en recetas
  -- ej: compra 1 paquete de 900g, en receta usa gramos
  unidad_compra text not null,           -- 'kg', 'L', 'paq 12 unid', '900g', etc. (texto libre)
  cantidad_por_compra numeric(12, 4) not null default 1,  -- cuántas unidades base trae un empaque
  unidad_base text not null,             -- 'g', 'ml', 'unidad'

  -- Precios en USD (referencia)
  precio_compra_usd numeric(10, 4),      -- precio del empaque de compra
  precio_base_usd numeric(12, 6),        -- precio por unidad base (derivado)
  precio_actualizado date,               -- última confirmación del precio (compra o refresco manual)

  -- Stock
  stock_actual numeric(12, 4) not null default 0,  -- en unidad_base
  stock_minimo numeric(12, 4),                      -- umbral de alerta

  -- Proveedor preferido
  proveedor_id uuid references public.proveedores(id) on delete set null,

  -- Últimas compras (rotativas, las 2 más recientes)
  ultima_fecha date,
  ultima_cantidad numeric(12, 4),
  ultima_precio_usd numeric(10, 4),
  ultima_precio_bs numeric(15, 2),
  penultima_fecha date,
  penultima_cantidad numeric(12, 4),
  penultima_precio_usd numeric(10, 4),
  penultima_precio_bs numeric(15, 2),

  notas text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_insumos_categoria on public.insumos(categoria);
create index if not exists idx_insumos_seccion on public.insumos(seccion);
create index if not exists idx_insumos_proveedor on public.insumos(proveedor_id);

alter table public.insumos enable row level security;

drop policy if exists "ins_select" on public.insumos;
create policy "ins_select" on public.insumos
  for select to authenticated using (true);
drop policy if exists "ins_insert" on public.insumos;
create policy "ins_insert" on public.insumos
  for insert to authenticated with check (true);
drop policy if exists "ins_update" on public.insumos;
create policy "ins_update" on public.insumos
  for update to authenticated using (true) with check (true);
drop policy if exists "ins_delete" on public.insumos;
create policy "ins_delete" on public.insumos
  for delete to authenticated using (true);

-- ============================================================
-- HISTORIAL DE PRECIOS (para Fase 5 — se llena desde día 1)
-- ============================================================
create table if not exists public.insumo_precio_historico (
  id uuid primary key default gen_random_uuid(),
  insumo_id uuid not null references public.insumos(id) on delete cascade,
  fecha timestamptz not null default now(),
  precio_compra_anterior_usd numeric(10, 4),
  precio_compra_nuevo_usd numeric(10, 4) not null,
  proveedor_id uuid references public.proveedores(id) on delete set null,
  motivo text,
  tasa_bcv_usada numeric(20, 4),
  usuario_id uuid references auth.users(id) on delete set null
);

create index if not exists idx_iph_insumo on public.insumo_precio_historico(insumo_id, fecha desc);

alter table public.insumo_precio_historico enable row level security;

drop policy if exists "iph_select" on public.insumo_precio_historico;
create policy "iph_select" on public.insumo_precio_historico
  for select to authenticated using (true);
drop policy if exists "iph_insert" on public.insumo_precio_historico;
create policy "iph_insert" on public.insumo_precio_historico
  for insert to authenticated with check (true);

-- ============================================================
-- COMPRAS (cada compra registrada — actualiza stock + precio)
-- ============================================================
create table if not exists public.compras (
  id uuid primary key default gen_random_uuid(),
  insumo_id uuid not null references public.insumos(id) on delete cascade,
  proveedor_id uuid references public.proveedores(id) on delete set null,
  fecha date not null default current_date,
  cantidad numeric(12, 4) not null,             -- en unidad_compra
  precio_total_usd numeric(15, 4) not null,
  precio_total_bs numeric(15, 2),
  tasa_bcv_usada numeric(20, 4),
  modalidad_pago text,
  -- 'bcv_dolar' | 'bcv_euro' | 'paralela' | 'efectivo' | 'divisa'
  notas text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_compras_insumo on public.compras(insumo_id, fecha desc);
create index if not exists idx_compras_fecha on public.compras(fecha desc);

alter table public.compras enable row level security;

drop policy if exists "comp_select" on public.compras;
create policy "comp_select" on public.compras
  for select to authenticated using (true);
drop policy if exists "comp_insert" on public.compras;
create policy "comp_insert" on public.compras
  for insert to authenticated with check (true);
drop policy if exists "comp_update" on public.compras;
create policy "comp_update" on public.compras
  for update to authenticated using (true) with check (true);
drop policy if exists "comp_delete" on public.compras;
create policy "comp_delete" on public.compras
  for delete to authenticated using (true);

-- ============================================================
-- TRIGGERS
-- ============================================================
drop trigger if exists prov_set_updated on public.proveedores;
create trigger prov_set_updated
  before update on public.proveedores
  for each row execute function public.set_updated_at();

drop trigger if exists ins_set_updated on public.insumos;
create trigger ins_set_updated
  before update on public.insumos
  for each row execute function public.set_updated_at();

-- Trigger: cuando cambia precio_compra_usd en insumos, registrar en historial
create or replace function public.log_insumo_price_change()
returns trigger language plpgsql as $$
begin
  if (TG_OP = 'UPDATE'
      and new.precio_compra_usd is not null
      and (old.precio_compra_usd is null or old.precio_compra_usd <> new.precio_compra_usd)) then
    insert into public.insumo_precio_historico
      (insumo_id, precio_compra_anterior_usd, precio_compra_nuevo_usd, proveedor_id, usuario_id)
    values
      (new.id, old.precio_compra_usd, new.precio_compra_usd, new.proveedor_id, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists ins_price_history on public.insumos;
create trigger ins_price_history
  after update on public.insumos
  for each row execute function public.log_insumo_price_change();

-- Trigger: al registrar una compra, actualizar stock + últimas 2 compras del insumo
create or replace function public.apply_compra_to_insumo()
returns trigger language plpgsql as $$
declare
  v_unidad_base text;
  v_cantidad_por_compra numeric;
  v_stock_add numeric;
  v_precio_compra_unit numeric;
begin
  -- Traer unidad_base y cantidad_por_compra del insumo
  select unidad_base, cantidad_por_compra into v_unidad_base, v_cantidad_por_compra
  from public.insumos where id = new.insumo_id;

  -- Sumar al stock (cantidad comprada × cantidad_por_compra)
  v_stock_add := new.cantidad * coalesce(v_cantidad_por_compra, 1);

  -- Precio unitario de esta compra
  if new.cantidad > 0 then
    v_precio_compra_unit := new.precio_total_usd / new.cantidad;
  else
    v_precio_compra_unit := new.precio_total_usd;
  end if;

  -- Rotar última → penúltima, y registrar nueva
  update public.insumos set
    stock_actual = coalesce(stock_actual, 0) + v_stock_add,

    penultima_fecha = ultima_fecha,
    penultima_cantidad = ultima_cantidad,
    penultima_precio_usd = ultima_precio_usd,
    penultima_precio_bs = ultima_precio_bs,

    ultima_fecha = new.fecha,
    ultima_cantidad = new.cantidad,
    ultima_precio_usd = v_precio_compra_unit,
    ultima_precio_bs = case
      when new.cantidad > 0 and new.precio_total_bs is not null
        then new.precio_total_bs / new.cantidad
      else null
    end,

    precio_compra_usd = v_precio_compra_unit,
    precio_base_usd = case
      when v_cantidad_por_compra > 0 then v_precio_compra_unit / v_cantidad_por_compra
      else v_precio_compra_unit
    end,
    -- El precio queda "fresco" a la fecha de la compra (frescura del costeo)
    precio_actualizado = new.fecha,

    proveedor_id = coalesce(new.proveedor_id, proveedor_id)
  where id = new.insumo_id;

  return new;
end;
$$;

drop trigger if exists compra_apply_to_insumo on public.compras;
create trigger compra_apply_to_insumo
  after insert on public.compras
  for each row execute function public.apply_compra_to_insumo();

-- ============================================================
-- VIEW: insumos con tasa BCV vigente para conveniencia
-- ============================================================
create or replace view public.v_tasa_bcv_actual as
  select * from public.tasa_bcv order by fecha desc limit 1;

-- ============================================================
-- SEED: proveedores de ejemplo
-- ============================================================
insert into public.proveedores (nombre, contacto_nombre, contacto_telefono, acepta_usd_efectivo, acepta_usd_divisa, acepta_bs_bcv_dolar)
values
  ('Por definir', null, null, true, true, true)
on conflict do nothing;

-- ============================================================
-- SEED: INSUMOS — extraído del Excel "Costos cafetería QM"
-- Precios en USD, cantidades en unidad base
-- Lucía revisa y ajusta lo que esté distinto.
-- ============================================================
insert into public.insumos
  (nombre, categoria, seccion, unidad_compra, cantidad_por_compra, unidad_base,
   precio_compra_usd, precio_base_usd, stock_minimo, notas)
values
  -- CAFÉ Y LÁCTEOS
  ('Café en grano', 'cafe', 'cafetin', 'kg', 1000, 'g', 23.20, 0.02320, 200, null),
  ('Leche completa', 'lacteos', 'ambos', 'L', 1000, 'ml', 3.77, 0.003770, 500, null),
  ('Leche de almendras', 'lacteos', 'ambos', 'L', 1000, 'ml', 5.22, 0.005220, 200, null),
  ('Cacao en polvo', 'cafe', 'cafetin', 'kg', 1000, 'g', 8.56, 0.008560, 100, null),

  -- FRUTAS Y SMOOTHIES
  ('Hielo', 'otros', 'ambos', 'kg', 1000, 'g', 1.20, 0.001200, 2000, null),
  ('Guayaba', 'frutas', 'cafetin', 'kg', 1000, 'g', 5.75, 0.005750, 500, null),
  ('Mango', 'frutas', 'cafetin', 'kg', 1000, 'g', 5.75, 0.005750, 500, 'Precio aprox. — ajustar'),
  ('Agua de coco', 'bebidas', 'cafetin', 'L', 1000, 'ml', 5.75, 0.005750, 1000, null),
  ('Cambur', 'frutas', 'cafetin', 'kg', 1000, 'g', 3.00, 0.003000, 500, 'Precio aprox.'),
  ('Papelón pulverizado', 'otros', 'cafetin', '900g', 900, 'g', 6.43, 0.007144, 200, null),
  ('Pulpa de parchita', 'frutas', 'cafetin', 'kg', 1000, 'g', 7.00, 0.007000, 500, 'Precio aprox.'),
  ('Piña', 'frutas', 'cafetin', 'kg', 1000, 'g', 4.00, 0.004000, 500, 'Precio aprox.'),
  ('Hierbabuena', 'condimentos', 'cafetin', '100g', 100, 'g', 1.50, 0.015000, 50, null),
  ('Espinaca', 'frutas', 'cafetin', 'ramillete', 1, 'unidad', 2.00, 2.000000, 5, null),
  ('Celery', 'frutas', 'cafetin', 'kg', 1000, 'g', 4.50, 0.004500, 200, null),
  ('Aguacate', 'frutas', 'ambos', 'kg', 1000, 'g', 6.00, 0.006000, 500, null),
  ('Jengibre', 'condimentos', 'cafetin', 'kg', 1000, 'g', 12.00, 0.012000, 100, null),
  ('Fresa', 'frutas', 'cafetin', 'kg', 1000, 'g', 8.00, 0.008000, 500, null),
  ('Mora', 'frutas', 'cafetin', 'kg', 1000, 'g', 12.00, 0.012000, 200, null),
  ('Crema de coco', 'lacteos', 'cafetin', '350ml', 350, 'ml', 4.50, 0.012857, 1000, null),
  ('Mantequilla de maní', 'condimentos', 'cafetin', '500g', 500, 'g', 8.00, 0.016000, 200, null),
  ('Jugo de naranja', 'bebidas', 'cafetin', 'galón', 3785, 'ml', 12.00, 0.003171, 3000, null),
  ('Vainilla', 'condimentos', 'cafetin', '250g', 250, 'ml', 8.00, 0.032000, 100, null),
  ('Canela', 'condimentos', 'ambos', '500g', 500, 'g', 6.00, 0.012000, 100, null),

  -- BEBIDAS EMBOTELLADAS
  ('Cerveza (botella)', 'bebidas', 'cafetin', 'paq 36 unid', 36, 'unidad', 19.80, 0.550000, 36, null),
  ('Malta', 'bebidas', 'cafetin', 'paq 24 unid', 24, 'unidad', 20.80, 0.866667, 24, null),
  ('Refresco 7up/Pepsi', 'bebidas', 'cafetin', 'paq 48 unid', 48, 'unidad', 44.00, 0.916667, 48, null),
  ('Rockstar', 'bebidas', 'cafetin', 'paq 24 unid', 24, 'unidad', 21.20, 0.883333, 24, null),
  ('Agua mineral', 'bebidas', 'ambos', 'paq 24 unid', 24, 'unidad', 21.20, 0.883333, 48, null),
  ('Agua con gas', 'bebidas', 'ambos', 'paq 24 unid', 24, 'unidad', 23.40, 0.975000, 24, null),
  ('Lipton', 'bebidas', 'cafetin', 'paq 12 unid', 12, 'unidad', 18.30, 1.525000, 24, null),
  ('Gatorade', 'bebidas', 'cafetin', 'paq 12 unid', 12, 'unidad', 18.30, 1.525000, 24, null),

  -- DESECHABLES
  ('Envase take-away', 'desechables', 'cafetin', 'paq 1000 unid', 1000, 'unidad', 340.00, 0.340000, 200, null),
  ('Servilletas napkin', 'desechables', 'ambos', 'paq 12×120 unid', 1440, 'unidad', 28.10, 0.019514, 500, null),
  ('Pitillos', 'desechables', 'cafetin', 'paq 500 unid', 500, 'unidad', 3.65, 0.007300, 200, null),

  -- COCINA / SANDWICHES
  ('Pan de sandwich (barra)', 'panaderia', 'cafetin', 'barra (8 sandwich)', 8, 'unidad', 6.00, 0.750000, 16, null),
  ('Pechuga de pollo', 'proteinas', 'ambos', 'kg', 1000, 'g', 8.00, 0.008000, 1000, null),
  ('Queso feta', 'lacteos', 'ambos', 'kg', 1000, 'g', 18.00, 0.018000, 500, null),
  ('Queso ricotta', 'lacteos', 'ambos', 'kg', 1000, 'g', 12.00, 0.012000, 500, null),
  ('Prosciutto', 'proteinas', 'cafetin', 'kg', 1000, 'g', 45.00, 0.045000, 500, null),
  ('Salmón ahumado', 'proteinas', 'cafetin', 'kg', 1000, 'g', 60.00, 0.060000, 500, null),
  ('Aceite de oliva', 'condimentos', 'ambos', 'L', 1000, 'ml', 12.00, 0.012000, 1000, null),

  -- DESAYUNOS COMEDOR
  ('Harina PAN', 'panaderia', 'comedor', 'kg', 1000, 'g', 1.50, 0.001500, 500, null),
  ('Huevos', 'proteinas', 'ambos', 'docena', 12, 'unidad', 3.50, 0.291667, 24, null),
  ('Queso arepero', 'lacteos', 'comedor', 'kg', 1000, 'g', 12.00, 0.012000, 500, null),
  ('Yogurt griego', 'lacteos', 'comedor', 'kg', 1000, 'g', 8.00, 0.008000, 500, null),
  ('Granola', 'panaderia', 'comedor', 'kg', 1000, 'g', 8.00, 0.008000, 500, null),
  ('Garbanzo (crudo)', 'otros', 'comedor', 'kg', 1000, 'g', 4.00, 0.004000, 500, null),

  -- AZÚCARES & EXTRAS
  ('Azúcar blanca en sobre', 'otros', 'ambos', 'paq 200 unid', 200, 'unidad', 5.00, 0.025000, 200, null),
  ('Alulosa', 'otros', 'ambos', '350g', 350, 'g', 10.90, 0.031143, 100, null),
  ('Proteína en polvo', 'otros', 'cafetin', '76 scoops', 76, 'unidad', 140.00, 1.842105, 76, null)
on conflict do nothing;


-- ############################################################################
-- ## eventos-campos-extras.sql
-- ############################################################################
-- Eventos · Campos extra para el formulario completo
-- Agrega: descripción, horario libre, fecha de fin (multi-día), cantidad de personas.
-- Aditivo, idempotente — se puede correr varias veces sin romper nada.

alter table public.eventos
  add column if not exists descripcion text;

alter table public.eventos
  add column if not exists horario text;

-- fecha_fin: si es null, el evento es de un solo día (= fecha).
-- Si tiene valor, el evento va desde `fecha` hasta `fecha_fin` inclusive.
alter table public.eventos
  add column if not exists fecha_fin date;

alter table public.eventos
  add column if not exists cantidad_personas int;


-- ############################################################################
-- ## eventos-checklist-cronograma.sql
-- ############################################################################
-- Eventos · Checklist + Cronograma + Plantillas
-- Replica el flujo del spreadsheet de Beatriz: tareas por fase del evento +
-- run-of-show del día + plantillas reutilizables para no empezar de cero.
-- Aditivo, no toca la tabla `eventos` existente.

-- ════════════════════════════════════════════════════════════════
-- 1. TAREAS POR EVENTO (checklist de planificación)
-- ════════════════════════════════════════════════════════════════
create table if not exists public.evento_tareas (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  fase text not null default 'pre-pro',  -- pre-pro | montaje | ejecucion | desmontaje | cierre (texto libre)
  titulo text not null,
  responsable text,                       -- texto libre: "Quinta Mamá", "Aurora", "Evenseg", etc.
  notas text,
  fecha_limite date,
  completada boolean not null default false,
  orden int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_evento_tareas_evento
  on public.evento_tareas(evento_id);
create index if not exists idx_evento_tareas_fase
  on public.evento_tareas(fase);

alter table public.evento_tareas enable row level security;

drop policy if exists "evt_tareas_select" on public.evento_tareas;
create policy "evt_tareas_select" on public.evento_tareas
  for select to authenticated using (true);
drop policy if exists "evt_tareas_insert" on public.evento_tareas;
create policy "evt_tareas_insert" on public.evento_tareas
  for insert to authenticated with check (true);
drop policy if exists "evt_tareas_update" on public.evento_tareas;
create policy "evt_tareas_update" on public.evento_tareas
  for update to authenticated using (true) with check (true);
drop policy if exists "evt_tareas_delete" on public.evento_tareas;
create policy "evt_tareas_delete" on public.evento_tareas
  for delete to authenticated using (true);

drop trigger if exists evt_tareas_set_updated on public.evento_tareas;
create trigger evt_tareas_set_updated
  before update on public.evento_tareas
  for each row execute function public.set_updated_at();

-- ════════════════════════════════════════════════════════════════
-- 2. ACTIVIDADES POR EVENTO (cronograma minuto-a-minuto del día)
-- ════════════════════════════════════════════════════════════════
create table if not exists public.evento_actividades (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  hora time,                              -- ej. 09:00, 18:30
  actividad text not null,
  responsable text,
  ubicacion text,
  observaciones text,
  critica boolean not null default false,  -- tarea crítica (ej. Ready for Guest)
  estatus text not null default 'pendiente',  -- pendiente | hecho | omitido
  orden int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_evento_actividades_evento
  on public.evento_actividades(evento_id);

alter table public.evento_actividades enable row level security;

drop policy if exists "evt_act_select" on public.evento_actividades;
create policy "evt_act_select" on public.evento_actividades
  for select to authenticated using (true);
drop policy if exists "evt_act_insert" on public.evento_actividades;
create policy "evt_act_insert" on public.evento_actividades
  for insert to authenticated with check (true);
drop policy if exists "evt_act_update" on public.evento_actividades;
create policy "evt_act_update" on public.evento_actividades
  for update to authenticated using (true) with check (true);
drop policy if exists "evt_act_delete" on public.evento_actividades;
create policy "evt_act_delete" on public.evento_actividades
  for delete to authenticated using (true);

drop trigger if exists evt_act_set_updated on public.evento_actividades;
create trigger evt_act_set_updated
  before update on public.evento_actividades
  for each row execute function public.set_updated_at();

-- ════════════════════════════════════════════════════════════════
-- 3. PLANTILLAS (cabecera) — reutilizables entre eventos
-- ════════════════════════════════════════════════════════════════
create table if not exists public.evento_plantillas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table public.evento_plantillas enable row level security;

drop policy if exists "evt_pl_select" on public.evento_plantillas;
create policy "evt_pl_select" on public.evento_plantillas
  for select to authenticated using (true);
drop policy if exists "evt_pl_insert" on public.evento_plantillas;
create policy "evt_pl_insert" on public.evento_plantillas
  for insert to authenticated with check (true);
drop policy if exists "evt_pl_update" on public.evento_plantillas;
create policy "evt_pl_update" on public.evento_plantillas
  for update to authenticated using (true) with check (true);
drop policy if exists "evt_pl_delete" on public.evento_plantillas;
create policy "evt_pl_delete" on public.evento_plantillas
  for delete to authenticated using (true);

drop trigger if exists evt_pl_set_updated on public.evento_plantillas;
create trigger evt_pl_set_updated
  before update on public.evento_plantillas
  for each row execute function public.set_updated_at();

-- ════════════════════════════════════════════════════════════════
-- 4. PLANTILLA · TAREAS (líneas reutilizables del checklist)
-- ════════════════════════════════════════════════════════════════
create table if not exists public.evento_plantilla_tareas (
  id uuid primary key default gen_random_uuid(),
  plantilla_id uuid not null references public.evento_plantillas(id) on delete cascade,
  fase text not null default 'pre-pro',
  titulo text not null,
  responsable text,
  notas text,
  -- dias_offset: cómo calcular la fecha límite al aplicar la plantilla.
  --   null    → sin fecha
  --   N > 0   → N días ANTES del evento (ej. 5 = 5 días antes)
  --   0       → el día del evento
  --   N < 0   → N días DESPUÉS del evento (ej. -3 = 3 días después)
  dias_offset int,
  orden int not null default 0
);

create index if not exists idx_evt_pl_tareas_plantilla
  on public.evento_plantilla_tareas(plantilla_id);

alter table public.evento_plantilla_tareas enable row level security;

drop policy if exists "evt_pl_t_select" on public.evento_plantilla_tareas;
create policy "evt_pl_t_select" on public.evento_plantilla_tareas
  for select to authenticated using (true);
drop policy if exists "evt_pl_t_insert" on public.evento_plantilla_tareas;
create policy "evt_pl_t_insert" on public.evento_plantilla_tareas
  for insert to authenticated with check (true);
drop policy if exists "evt_pl_t_update" on public.evento_plantilla_tareas;
create policy "evt_pl_t_update" on public.evento_plantilla_tareas
  for update to authenticated using (true) with check (true);
drop policy if exists "evt_pl_t_delete" on public.evento_plantilla_tareas;
create policy "evt_pl_t_delete" on public.evento_plantilla_tareas
  for delete to authenticated using (true);

-- ════════════════════════════════════════════════════════════════
-- 5. PLANTILLA · ACTIVIDADES (líneas reutilizables del cronograma)
-- ════════════════════════════════════════════════════════════════
create table if not exists public.evento_plantilla_actividades (
  id uuid primary key default gen_random_uuid(),
  plantilla_id uuid not null references public.evento_plantillas(id) on delete cascade,
  hora time,
  actividad text not null,
  responsable text,
  ubicacion text,
  observaciones text,
  critica boolean not null default false,
  orden int not null default 0
);

create index if not exists idx_evt_pl_act_plantilla
  on public.evento_plantilla_actividades(plantilla_id);

alter table public.evento_plantilla_actividades enable row level security;

drop policy if exists "evt_pl_a_select" on public.evento_plantilla_actividades;
create policy "evt_pl_a_select" on public.evento_plantilla_actividades
  for select to authenticated using (true);
drop policy if exists "evt_pl_a_insert" on public.evento_plantilla_actividades;
create policy "evt_pl_a_insert" on public.evento_plantilla_actividades
  for insert to authenticated with check (true);
drop policy if exists "evt_pl_a_update" on public.evento_plantilla_actividades;
create policy "evt_pl_a_update" on public.evento_plantilla_actividades
  for update to authenticated using (true) with check (true);
drop policy if exists "evt_pl_a_delete" on public.evento_plantilla_actividades;
create policy "evt_pl_a_delete" on public.evento_plantilla_actividades
  for delete to authenticated using (true);


-- ############################################################################
-- ## eventos-plantilla-seed.sql
-- ############################################################################
-- Plantilla "Evento estándar Quinta Mamá"
-- Basada en el spreadsheet de Beatriz: checklist por fases + cronograma del día.
-- Idempotente: se puede correr varias veces sin duplicar (se borra y reinserta
-- el contenido de la plantilla).
--
-- Para crear nuevas plantillas, copia este patrón cambiando el nombre y los datos.

do $$
declare
  pl_id uuid;
begin
  -- ── 1) Cabecera (insertar si no existe; obtener id) ──────────────
  select id into pl_id
    from public.evento_plantillas
   where nombre = 'Evento estándar Quinta Mamá'
   limit 1;

  if pl_id is null then
    insert into public.evento_plantillas (nombre, descripcion, activa)
    values (
      'Evento estándar Quinta Mamá',
      'Checklist y cronograma típicos basados en el flujo de Beatriz. Editable después de aplicar.',
      true
    )
    returning id into pl_id;
  end if;

  -- ── 2) Tareas del checklist (por fase) ───────────────────────────
  -- dias_offset = días ANTES del evento. 0 = mismo día. Negativo = después.
  delete from public.evento_plantilla_tareas where plantilla_id = pl_id;

  insert into public.evento_plantilla_tareas
    (plantilla_id, fase, titulo, responsable, notas, dias_offset, orden)
  values
    -- Pre-producción
    (pl_id, 'pre-pro', 'Confirmación de fecha y detalles del cliente', 'Colaborador', null, 14, 10),
    (pl_id, 'pre-pro', 'Solicitar servicio de catering', 'Quinta Mamá', 'Confirmar si el evento requiere catering', 10, 20),
    (pl_id, 'pre-pro', 'Solicitar servicio de valet parking', 'Quinta Mamá', 'Coordinar con Evenseg si aplica', 10, 30),
    (pl_id, 'pre-pro', 'Convocar personal de apoyo', 'Quinta Mamá', 'Anfitriona, limpieza, mesoneros', 7, 40),
    (pl_id, 'pre-pro', 'Definir horas de montaje y desmontaje', 'Quinta Mamá', null, 5, 50),
    (pl_id, 'pre-pro', 'Confirmar lista de contratistas y proveedores', 'Quinta Mamá', null, 3, 60),
    (pl_id, 'pre-pro', 'Enviar recordatorio al cliente', 'Quinta Mamá', null, 2, 70),
    -- Montaje
    (pl_id, 'montaje', 'Confirmación de requerimientos finales', 'Quinta Mamá', null, 1, 10),
    (pl_id, 'montaje', 'Decoración y preparación de espacios comunes', 'Colaborador', 'Limpieza, flores, otros', 1, 20),
    (pl_id, 'montaje', 'Revisión técnica (luces, sonido, WiFi)', 'Quinta Mamá', null, 0, 30),
    -- Ejecución
    (pl_id, 'ejecucion', 'Supervisión en campo', 'Quinta Mamá', null, 0, 10),
    (pl_id, 'ejecucion', 'Atención al cliente y contingencias', 'Quinta Mamá', null, 0, 20),
    -- Desmontaje
    (pl_id, 'desmontaje', 'Supervisión de retiro de proveedores', 'Quinta Mamá', null, -1, 10),
    (pl_id, 'desmontaje', 'Revisión de la casa (daños / faltantes)', 'Quinta Mamá', null, -1, 20),
    -- Cierre
    (pl_id, 'cierre', 'Enviar encuesta de satisfacción', 'Quinta Mamá', null, -2, 10),
    (pl_id, 'cierre', 'Cobrar saldo pendiente', 'Quinta Mamá', null, -3, 20),
    (pl_id, 'cierre', 'Realizar informe final del evento', 'Quinta Mamá', null, -5, 30);

  -- ── 3) Cronograma del día (run of show) ──────────────────────────
  delete from public.evento_plantilla_actividades where plantilla_id = pl_id;

  insert into public.evento_plantilla_actividades
    (plantilla_id, hora, actividad, responsable, ubicacion, observaciones, critica, orden)
  values
    (pl_id, '09:00', 'Apertura de Quinta Mamá y check de servicios', 'Staff Quinta', 'Toda la casa', 'Revisar baños, luces, limpieza y WiFi.', true, 10),
    (pl_id, '10:00', 'Llegada de proveedores de montaje (mobiliario / flores)', 'Colaborador externo', 'Acceso de carga', 'Supervisar que no se golpeen paredes ni marcos.', true, 20),
    (pl_id, '12:00', 'Montaje técnico (sonido e iluminación)', 'Técnico audio', 'Área principal', 'Verificar tomas de corriente y cableado oculto.', false, 30),
    (pl_id, '14:00', 'Llegada de catering y montaje de estación', 'Chef / Catering', 'Cocina / Área social', 'Check de potencia eléctrica para hornos y cafeteras.', true, 40),
    (pl_id, '16:00', 'Ready for Guest (RFG): todo listo', 'Staff Quinta', 'Toda la casa', 'Música ambiente, velas encendidas, staff cambiado.', true, 50),
    (pl_id, '17:00', 'Recepción de invitados', 'Host / Quinta', 'Entrada', 'Lista de invitados en mano y bienvenida.', true, 60),
    (pl_id, '18:30', 'Momento cumbre (charla, brindis o actividad)', 'Organizador', 'Área principal', 'Bajar volumen de música ambiente, ajustar luces.', true, 70),
    (pl_id, '21:00', 'Cierre de estaciones de comida y bebida', 'Catering', 'Área social', 'Retiro discreto de platos y copas.', false, 80),
    (pl_id, '22:00', 'Fin del evento y salida de invitados', 'Staff Quinta', 'Entrada', 'Despedida y chequeo de objetos olvidados.', false, 90),
    (pl_id, '22:30', 'Desmontaje express y limpieza básica', 'Proveedores', 'Toda la casa', 'Supervisar retiro de basura y cuidado de la casa.', false, 100),
    (pl_id, '23:30', 'Cierre total y entrega de llaves', 'Staff Quinta', 'Puerta principal', 'Inventario final de daños o faltantes.', false, 110);
end$$;


-- ############################################################################
-- ## harden-function-search-path.sql
-- ############################################################################
-- Endurecimiento: fija el search_path de todas las funciones del esquema public.
--
-- CONTEXTO
-- El Advisor de Supabase marca "Function Search Path Mutable" (lint 0011) en
-- cada función que no fija su search_path: sin fijarlo, hereda el del rol que la
-- llama, lo que abre un riesgo teórico de "search_path hijacking". Este script
-- lo fija a un valor estable (public, pg_temp) SIN cambiar la lógica de las
-- funciones — solo quita la ambigüedad del path.
--
-- Es idempotente: puedes correrlo las veces que quieras. Recorre las funciones
-- reales (prokind = 'f', incluye las de triggers) y no toca vistas ni tablas.
--
-- Cómo aplicarlo: pégalo en Supabase → SQL Editor y córrelo. Luego dale Refresh
-- al Security Advisor; los ~23 warnings de "Function Search Path Mutable" se van.

do $$
declare
  r record;
begin
  for r in
    select p.proname as name,
           pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'   -- solo funciones (incluye funciones de trigger)
  loop
    execute format(
      'alter function public.%I(%s) set search_path = public, pg_temp;',
      r.name, r.args
    );
  end loop;
end $$;

-- Verificación: lista funciones del esquema public cuyo search_path AÚN no está
-- fijado. Después de correr lo de arriba debe devolver 0 filas.
select p.proname,
       coalesce(array_to_string(p.proconfig, ', '), '(sin fijar)') as config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind = 'f'
  and not exists (
    select 1 from unnest(coalesce(p.proconfig, '{}')) c
    where c like 'search_path=%'
  );


-- ############################################################################
-- ## menaje-ajuste-atomico.sql
-- ############################################################################
-- Menaje · Ajuste ATÓMICO de cantidad_actual
-- ════════════════════════════════════════════════════════════════
-- Antes, descontar/sumar menaje se hacía leyendo cantidad_actual en el navegador,
-- calculando el nuevo valor y escribiéndolo (read-modify-write). Dos operaciones
-- casi simultáneas (ej. dos personas registrando) podían pisarse y perder una.
--
-- Este RPC hace el ajuste en un SOLO UPDATE en la base (cantidad = cantidad +
-- delta), así que es atómico: no hay ventana para que se pisen.
--   • delta negativo → descuento (pérdida, uso)
--   • delta positivo → compra (reposición)
-- Devuelve la nueva cantidad. greatest(0, …) evita negativos.
--
-- p_precio_reposicion (opcional): si el ítem no tenía precio de reposición y
-- esta compra trae uno, lo guarda (solo entonces). Idempotente.

create or replace function public.ajustar_menaje_stock(
  p_item_id uuid,
  p_delta numeric,
  p_precio_reposicion numeric default null
)
returns numeric
language plpgsql
security invoker
as $$
declare
  v_nueva numeric;
begin
  update public.menaje_items
     set cantidad_actual = greatest(0, coalesce(cantidad_actual, 0) + p_delta),
         precio_reposicion_usd = case
           when precio_reposicion_usd is null and p_precio_reposicion is not null
             then p_precio_reposicion
           else precio_reposicion_usd
         end
   where id = p_item_id
   returning cantidad_actual into v_nueva;

  if v_nueva is null then
    raise exception 'Ítem de menaje no encontrado';
  end if;
  return v_nueva;
end;
$$;


-- ############################################################################
-- ## menaje-fotos-bucket.sql
-- ############################################################################
-- Bucket PÚBLICO para fotos de ítems de menaje (cristalería, vajilla, etc.).
--
-- A diferencia de las facturas (bucket privado `menaje-facturas`, con signed
-- URLs), las fotos de producto NO son sensibles: se muestran directo en la app
-- y en el PDF del cliente. Por eso este bucket es público.
--
-- Cómo aplicarlo: pégalo en Supabase → SQL Editor y córrelo una vez.

-- 1) Crear el bucket público (idempotente).
insert into storage.buckets (id, name, public)
values ('menaje-fotos', 'menaje-fotos', true)
on conflict (id) do update set public = true;

-- 2) Lectura pública: cualquiera con el link ve la imagen (necesario para que
--    el <img> de la app y el <Image> del PDF la carguen sin autenticación).
drop policy if exists "menaje_fotos_public_read" on storage.objects;
create policy "menaje_fotos_public_read"
  on storage.objects for select
  using (bucket_id = 'menaje-fotos');

-- 3) Subir / actualizar / borrar: solo usuarios autenticados (tu equipo).
drop policy if exists "menaje_fotos_auth_insert" on storage.objects;
create policy "menaje_fotos_auth_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'menaje-fotos');

drop policy if exists "menaje_fotos_auth_update" on storage.objects;
create policy "menaje_fotos_auth_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'menaje-fotos');

drop policy if exists "menaje_fotos_auth_delete" on storage.objects;
create policy "menaje_fotos_auth_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'menaje-fotos');


-- ############################################################################
-- ## presupuestos-inventario-contratistas.sql
-- ############################################################################
-- Catálogos para Presupuestos: inventario de alquiler (mobiliario) +
-- contratistas (servicios de terceros que ofrecemos al cliente).
-- Aditivo, no toca tablas existentes.

-- ============================================================
-- INVENTARIO DE ALQUILER
-- ============================================================
create table if not exists public.inventario_alquiler (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  categoria text not null default 'Otros',  -- texto libre, editable por usuario
  descripcion text,
  cantidad_disponible int not null default 0,
  precio_alquiler_usd numeric(10, 2),
  estado text not null default 'disponible',  -- 'disponible' | 'mantenimiento' | 'agotado'
  foto_url text,
  notas text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_inv_categoria on public.inventario_alquiler(categoria);

alter table public.inventario_alquiler enable row level security;

drop policy if exists "inv_select" on public.inventario_alquiler;
create policy "inv_select" on public.inventario_alquiler
  for select to authenticated using (true);
drop policy if exists "inv_insert" on public.inventario_alquiler;
create policy "inv_insert" on public.inventario_alquiler
  for insert to authenticated with check (true);
drop policy if exists "inv_update" on public.inventario_alquiler;
create policy "inv_update" on public.inventario_alquiler
  for update to authenticated using (true) with check (true);
drop policy if exists "inv_delete" on public.inventario_alquiler;
create policy "inv_delete" on public.inventario_alquiler
  for delete to authenticated using (true);

drop trigger if exists inv_set_updated on public.inventario_alquiler;
create trigger inv_set_updated
  before update on public.inventario_alquiler
  for each row execute function public.set_updated_at();

-- ============================================================
-- CONTRATISTAS (servicios de terceros)
-- ============================================================
create table if not exists public.contratistas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  especialidad text not null default 'Otros',  -- texto libre, editable por usuario
  contacto_nombre text,
  contacto_telefono text,
  contacto_email text,
  precio_referencial_usd numeric(10, 2),
  comision_porc numeric(5, 2),
  notas text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_contra_especialidad on public.contratistas(especialidad);

alter table public.contratistas enable row level security;

drop policy if exists "contra_select" on public.contratistas;
create policy "contra_select" on public.contratistas
  for select to authenticated using (true);
drop policy if exists "contra_insert" on public.contratistas;
create policy "contra_insert" on public.contratistas
  for insert to authenticated with check (true);
drop policy if exists "contra_update" on public.contratistas;
create policy "contra_update" on public.contratistas
  for update to authenticated using (true) with check (true);
drop policy if exists "contra_delete" on public.contratistas;
create policy "contra_delete" on public.contratistas
  for delete to authenticated using (true);

drop trigger if exists contra_set_updated on public.contratistas;
create trigger contra_set_updated
  before update on public.contratistas
  for each row execute function public.set_updated_at();


-- ############################################################################
-- ## presupuestos.sql
-- ############################################################################
-- Schema para Presupuestos — La Quinta Mamá
-- Ejecuta este SQL en: Supabase → SQL Editor → New query
-- Esto NO toca las tablas existentes (tareas, eventos). Es aditivo.

-- ============================================================
-- CATÁLOGO DE SERVICIOS
-- ============================================================
create table if not exists public.services_catalog (
  id uuid primary key default gen_random_uuid(),
  categoria text not null,
  nombre text not null,
  descripcion text,
  unidad text not null,
  precio_unitario numeric(10,2),
  manual boolean not null default false,
  incluido boolean not null default false,
  activo boolean not null default true,
  orden int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.services_catalog enable row level security;

drop policy if exists "svc_select_auth" on public.services_catalog;
create policy "svc_select_auth" on public.services_catalog
  for select to authenticated using (true);

drop policy if exists "svc_insert_auth" on public.services_catalog;
create policy "svc_insert_auth" on public.services_catalog
  for insert to authenticated with check (true);

drop policy if exists "svc_update_auth" on public.services_catalog;
create policy "svc_update_auth" on public.services_catalog
  for update to authenticated using (true) with check (true);

drop policy if exists "svc_delete_auth" on public.services_catalog;
create policy "svc_delete_auth" on public.services_catalog
  for delete to authenticated using (true);

-- ============================================================
-- PRESUPUESTOS
-- ============================================================
create table if not exists public.presupuestos (
  id uuid primary key default gen_random_uuid(),
  numero text unique not null,

  -- Cliente (inline, sin tabla aparte)
  cliente_nombre text not null,
  cliente_telefono text,
  cliente_email text,
  cliente_rif text,

  -- Evento
  evento_nombre text not null,
  evento_fecha date,
  evento_hora text,

  -- Negocio
  notas text,
  validez_dias int not null default 15,
  descuento numeric(10,2) not null default 0,

  estado text not null default 'borrador',  -- borrador|enviado|aprobado|rechazado
  subtotal numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,

  -- Link a evento si se aprueba
  evento_id uuid references public.eventos(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table public.presupuestos enable row level security;

drop policy if exists "pre_select_auth" on public.presupuestos;
create policy "pre_select_auth" on public.presupuestos
  for select to authenticated using (true);

drop policy if exists "pre_insert_auth" on public.presupuestos;
create policy "pre_insert_auth" on public.presupuestos
  for insert to authenticated with check (true);

drop policy if exists "pre_update_auth" on public.presupuestos;
create policy "pre_update_auth" on public.presupuestos
  for update to authenticated using (true) with check (true);

drop policy if exists "pre_delete_auth" on public.presupuestos;
create policy "pre_delete_auth" on public.presupuestos
  for delete to authenticated using (true);

-- ============================================================
-- ITEMS DE PRESUPUESTO
-- ============================================================
create table if not exists public.presupuesto_items (
  id uuid primary key default gen_random_uuid(),
  presupuesto_id uuid not null references public.presupuestos(id) on delete cascade,
  service_id uuid references public.services_catalog(id) on delete set null,
  nombre text not null,
  categoria text,
  unidad text not null,
  cantidad numeric(10,2) not null default 1,
  precio_unitario numeric(10,2) not null default 0,
  subtotal numeric(10,2) not null default 0,
  orden int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_items_presupuesto on public.presupuesto_items(presupuesto_id);

alter table public.presupuesto_items enable row level security;

drop policy if exists "items_select_auth" on public.presupuesto_items;
create policy "items_select_auth" on public.presupuesto_items
  for select to authenticated using (true);

drop policy if exists "items_insert_auth" on public.presupuesto_items;
create policy "items_insert_auth" on public.presupuesto_items
  for insert to authenticated with check (true);

drop policy if exists "items_update_auth" on public.presupuesto_items;
create policy "items_update_auth" on public.presupuesto_items
  for update to authenticated using (true) with check (true);

drop policy if exists "items_delete_auth" on public.presupuesto_items;
create policy "items_delete_auth" on public.presupuesto_items
  for delete to authenticated using (true);

-- ============================================================
-- TRIGGERS updated_at
-- ============================================================
drop trigger if exists svc_set_updated_at on public.services_catalog;
create trigger svc_set_updated_at
  before update on public.services_catalog
  for each row execute function public.set_updated_at();

drop trigger if exists pre_set_updated_at on public.presupuestos;
create trigger pre_set_updated_at
  before update on public.presupuestos
  for each row execute function public.set_updated_at();

-- ============================================================
-- SECUENCIA PARA NUMERAR PRESUPUESTOS (PRES-2026-001, etc.)
-- ============================================================
create sequence if not exists presupuestos_num_seq start with 1;

-- ============================================================
-- SEED DEL CATÁLOGO (precios del Dossier 2026)
-- ============================================================
insert into public.services_catalog (categoria, nombre, descripcion, unidad, precio_unitario, manual, incluido, orden) values
  -- ESPACIOS
  ('espacio', 'Salón A1 — Galería (114 m²)', 'Full Day. Espacio de mayor visibilidad.', 'dia', 620, false, false, 10),
  ('espacio', 'Salón A1 — Galería (medio día)', 'Medio Día.', 'medio_dia', 325, false, false, 11),
  ('espacio', 'Salón A1 — Galería (mensual)', 'Alquiler fijo mensual.', 'mes', 3000, false, false, 12),
  ('espacio', 'Salón B1 — Multiusos (168 m²)', 'Full Day = 8 bloques (12h).', 'dia', 450, false, false, 20),
  ('espacio', 'Salón B1 — Multiusos (medio día)', 'Medio Día = 4 bloques (6h).', 'medio_dia', 240, false, false, 21),
  ('espacio', 'Salón B1 — Multiusos (bloque 1.5h)', 'Uso por bloque de 1.5h.', 'bloque', 65, false, false, 22),
  ('espacio', 'Salón B1 — Multiusos (mensual)', 'Alquiler fijo mensual.', 'mes', 3000, false, false, 23),
  ('espacio', 'Salón B5 — Terapias (34 m²)', 'Full Day.', 'dia', 180, false, false, 30),
  ('espacio', 'Salón B5 — Terapias (medio día)', 'Medio Día.', 'medio_dia', 110, false, false, 31),
  ('espacio', 'Salón B5 — Terapias (bloque 1.5h)', 'Uso por bloque.', 'bloque', 35, false, false, 32),
  ('espacio', 'Salón B5 — Terapias (mensual)', 'Alquiler fijo mensual.', 'mes', 880, false, false, 33),
  ('espacio', 'Salón C2 — Oficina (39 m²)', 'Solo mensual.', 'mes', 1000, false, false, 40),
  ('espacio', 'Salón C6 — Taller Creativo (38 m²)', 'Full Day.', 'dia', 150, false, false, 50),
  ('espacio', 'Salón C6 — Taller Creativo (mensual)', 'Alquiler fijo mensual.', 'mes', 1000, false, false, 51),
  ('espacio', 'Jardín', 'Alquiler exterior (precio según evento).', 'evento', null, true, false, 60),
  ('espacio', 'Canchas de pádel (ambas)', 'Por bloque de 1.5h. Incluido si se alquila el jardín.', 'bloque', 100, false, false, 70),

  -- CATERING
  ('catering', 'Catering — propuesta del Chef', 'Monto definido por la Chef según el evento. Incluye equipo operativo de cocina.', 'evento', null, true, false, 100),

  -- EQUIPO (por persona, día completo)
  ('equipo', 'Anfitriona', 'Por persona, día completo.', 'persona', 40, false, false, 200),
  ('equipo', 'Mesonero', 'Por persona, día completo.', 'persona', 40, false, false, 201),
  ('equipo', 'Bartender', 'Por persona, día completo.', 'persona', 50, false, false, 202),
  ('equipo', 'Personal de higiene (baño interno)', 'Por persona, día completo.', 'persona', 40, false, false, 203),
  ('equipo', 'Personal de higiene (baño externo)', 'Por persona, día completo.', 'persona', 40, false, false, 204),
  ('equipo', 'Limpieza', 'Por persona, día completo.', 'persona', 40, false, false, 205),

  -- PÁDEL
  ('padel', 'Paleta de pádel', 'Alquiler por paleta.', 'unidad', 10, false, false, 300),
  ('padel', 'Pote de pelotas (3 unidades)', 'Compra de pelotas.', 'unidad', 10, false, false, 301),

  -- TÉCNICO / OTROS
  ('tecnico', 'Sonido — corneta básica', 'Incluida sin costo adicional.', 'evento', 0, false, true, 400),
  ('tecnico', 'Planta eléctrica', 'Servicio adicional.', 'evento', 400, false, false, 401),
  ('otros', 'Valet parking', 'Precio según evento.', 'evento', null, true, false, 500)
on conflict do nothing;


-- ############################################################################
-- ## tareas-so-schema.sql
-- ############################################################################
-- Sistema Operativo (tareas estratégicas) — La Quinta Mamá
-- ════════════════════════════════════════════════════════════════
-- Ejecuta este SQL en: Supabase → SQL Editor → New query.
-- Es ADITIVO: no toca las tablas existentes (tareas, eventos, cocina,
-- presupuestos). Crea el modelo de datos del sistema operativo descrito
-- en el traspaso (motor de priorización PCE, casa, objetivos, reportes).
--
-- Convención de nombres: todas las tablas llevan prefijo `so_` (sistema
-- operativo) para no chocar con nombres genéricos ya usados en la app
-- (eventos, tareas). La taxonomía (7 áreas · 27 sub-ejes) NO es una tabla:
-- es una constante de aplicación (ver src/lib/tareas-so/taxonomia.ts).
--
-- Regla no negociable (§3.1): una tarea sin objetivo NO entra al tablero;
-- por eso so_tarea.objetivo_id es NULLABLE (queda "retenida"), aunque el
-- flujo normal siempre le asigne uno.

-- ============================================================
-- PERSONAS
-- ============================================================
create table if not exists public.so_persona (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  correo text unique,                 -- null permitido; sin correo no se notifica
  activo boolean not null default true,
  rol text,                           -- descripción libre
  figura text,                        -- nómina | honorarios | colaboración
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- OBJETIVOS ESTRATÉGICOS
-- ============================================================
create table if not exists public.so_objetivo (
  id text primary key,                -- 'ESP-02-C1'
  area_id text not null,              -- 'ESP-02'
  sub_eje_id text not null,           -- 'ESP-02.1'
  horizonte text not null,            -- corto | mediano | largo
  titulo text not null,
  indicador text not null,
  meta numeric not null,
  actual numeric not null default 0,
  unidad text not null,
  sentido text not null default 'mayor',   -- mayor | menor
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_so_objetivo_area on public.so_objetivo(area_id);
create index if not exists idx_so_objetivo_sub on public.so_objetivo(sub_eje_id);

-- ============================================================
-- ESPACIOS DE LA CASA
-- ============================================================
create table if not exists public.so_espacio (
  id text primary key,                -- 'B1', 'S-ELE'
  nombre text not null,
  planta text not null,               -- 'Planta A' … 'Sistemas y envolvente'
  tipo text not null,                 -- privativo | común | servicio | sistema
  estado text not null default 'operativo',
                                      -- operativo | atención | intervención | fuera | definir
  nota text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- TAREAS
-- ============================================================
create table if not exists public.so_tarea (
  id text primary key,                -- 'T-0001', o 'WEB-1042' si entra del sitio
  titulo text not null,
  sub_eje_id text not null,
  objetivo_id text references public.so_objetivo(id) on delete set null,   -- NULLABLE (§3.1)
  espacio_id text references public.so_espacio(id) on delete set null,
  vence date,
  creada date not null default current_date,
  cerrada date,
  impacto text not null,              -- alto | medio | bajo | nulo
  proximidad text not null,           -- directa | requisito | apoyo
  patrimonio boolean not null default false,
  compromiso boolean not null default false,
  nota text,
  estado text not null default 'pendiente',
                                      -- pendiente | completado | descartado
  origen text not null default 'sistema',   -- sistema | web | vercel | importado
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_so_tarea_objetivo on public.so_tarea(objetivo_id);
create index if not exists idx_so_tarea_sub on public.so_tarea(sub_eje_id);
create index if not exists idx_so_tarea_espacio on public.so_tarea(espacio_id);
create index if not exists idx_so_tarea_estado on public.so_tarea(estado);

-- ============================================================
-- RESPONSABLES (N a N) — una tarea puede tener varios
-- ============================================================
create table if not exists public.so_tarea_responsable (
  tarea_id text not null references public.so_tarea(id) on delete cascade,
  persona_id uuid not null references public.so_persona(id) on delete cascade,
  primary key (tarea_id, persona_id)
);

-- ============================================================
-- VALORES ASOCIADOS (N a N)
-- ============================================================
-- valor: Comunidad | Autenticidad | Patrimonio | Acción | Excelencia | __tensiona
create table if not exists public.so_tarea_valor (
  tarea_id text not null references public.so_tarea(id) on delete cascade,
  valor text not null,
  primary key (tarea_id, valor)
);

-- ============================================================
-- SUBTAREAS — pasos internos, NO se puntúan (§3.5)
-- ============================================================
create table if not exists public.so_subtarea (
  id uuid primary key default gen_random_uuid(),
  tarea_id text not null references public.so_tarea(id) on delete cascade,
  titulo text not null,
  hecho boolean not null default false,
  orden int not null default 0
);
create index if not exists idx_so_subtarea_tarea on public.so_subtarea(tarea_id);

-- ============================================================
-- COMENTARIOS
-- ============================================================
create table if not exists public.so_comentario (
  id uuid primary key default gen_random_uuid(),
  tarea_id text not null references public.so_tarea(id) on delete cascade,
  persona_id uuid references public.so_persona(id) on delete set null,
  autor text,                         -- snapshot del nombre (por si la persona cambia)
  fecha timestamptz not null default now(),
  texto text not null
);
create index if not exists idx_so_comentario_tarea on public.so_comentario(tarea_id);

-- ============================================================
-- ESTRATEGIA EDITABLE POR SUB-EJE
-- ============================================================
create table if not exists public.so_sub_eje_estrategia (
  sub_eje_id text primary key,
  texto text,
  actualizada date
);

-- ============================================================
-- HITOS — historial que se genera SOLO (§3.6)
-- ============================================================
create table if not exists public.so_hito (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  sub_eje_id text,
  tipo text not null,                 -- medición | tarea | estrategia | estado |
                                      -- inventario | equipo | reporte | hito
  texto text not null,
  ref text,                           -- id de objetivo o tarea
  espacio_id text,
  avance int,                         -- solo en tipo='medición'
  avance_anterior int,
  created_at timestamptz not null default now()
);
create index if not exists idx_so_hito_sub on public.so_hito(sub_eje_id);
create index if not exists idx_so_hito_ref on public.so_hito(ref);

-- ============================================================
-- REPORTES QUINCENALES GENERADOS
-- ============================================================
create table if not exists public.so_reporte (
  id uuid primary key default gen_random_uuid(),
  periodo int not null,
  desde date not null,
  hasta date not null,
  generado date not null default current_date,
  url text
);

-- ============================================================
-- NOTIFICACIONES DESPACHADAS (evita reenvíos)
-- ============================================================
-- clave = tarea_id|tipo|persona   (tipo: creada | vence)
create table if not exists public.so_notificacion (
  clave text primary key,
  tarea_id text,
  persona_id uuid,
  tipo text not null,
  enviada timestamptz not null default now()
);

-- ============================================================
-- RLS — todos los usuarios autenticados pueden todo
-- (decisión del equipo: "todos pueden todo"; se puede endurecer luego)
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'so_persona','so_objetivo','so_espacio','so_tarea','so_tarea_responsable',
    'so_tarea_valor','so_subtarea','so_comentario','so_sub_eje_estrategia',
    'so_hito','so_reporte','so_notificacion'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "%s_all_auth" on public.%I;', t, t);
    execute format(
      'create policy "%s_all_auth" on public.%I for all to authenticated using (true) with check (true);',
      t, t);
  end loop;
end $$;

-- ============================================================
-- TRIGGERS updated_at (solo en las tablas que lo tienen)
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['so_persona','so_objetivo','so_espacio','so_tarea'] loop
    execute format('drop trigger if exists %s_set_updated on public.%I;', t, t);
    execute format(
      'create trigger %s_set_updated before update on public.%I for each row execute function public.set_updated_at();',
      t, t);
  end loop;
end $$;


-- ############################################################################
-- ## tareas-so-seed.sql
-- ############################################################################
-- Sistema Operativo · datos de referencia (seed). Generado, idempotente.
-- Ejecuta en Supabase → SQL Editor. Requiere haber corrido tareas-so-schema.sql.

-- Personas
insert into public.so_persona (nombre) select 'Rodrigo Pietri' where not exists (select 1 from public.so_persona where nombre = 'Rodrigo Pietri');
insert into public.so_persona (nombre) select 'Óscar Pietri' where not exists (select 1 from public.so_persona where nombre = 'Óscar Pietri');
insert into public.so_persona (nombre) select 'Beatriz Márquez' where not exists (select 1 from public.so_persona where nombre = 'Beatriz Márquez');
insert into public.so_persona (nombre) select 'Lucía Dickson' where not exists (select 1 from public.so_persona where nombre = 'Lucía Dickson');
insert into public.so_persona (nombre) select 'Luis Castellanos' where not exists (select 1 from public.so_persona where nombre = 'Luis Castellanos');

-- Espacios
insert into public.so_espacio (id, nombre, planta, tipo, estado, nota) values ('A1', 'A1 · Galería', 'Planta A', 'privativo', 'operativo', 'Espacio expositivo. Comercializable por día, medio día y hora.') on conflict (id) do nothing;
insert into public.so_espacio (id, nombre, planta, tipo, estado, nota) values ('A-REC', 'Recepción', 'Planta A', 'común', 'operativo', 'Punto de control de acceso y bitácora diaria de anfitrionas.') on conflict (id) do nothing;
insert into public.so_espacio (id, nombre, planta, tipo, estado, nota) values ('A-COM', 'Comedor', 'Planta A', 'servicio', 'operativo', 'Operado por GAS-04.1.') on conflict (id) do nothing;
insert into public.so_espacio (id, nombre, planta, tipo, estado, nota) values ('A-CAF', 'Cafetín y barra', 'Planta A', 'servicio', 'operativo', 'Operado por GAS-04.2.') on conflict (id) do nothing;
insert into public.so_espacio (id, nombre, planta, tipo, estado, nota) values ('A-COC', 'Cocina', 'Planta A', 'servicio', 'operativo', 'Producción de comedor, cafetín y catering.') on conflict (id) do nothing;
insert into public.so_espacio (id, nombre, planta, tipo, estado, nota) values ('A-BAN', 'Baños Planta A', 'Planta A', 'común', 'operativo', null) on conflict (id) do nothing;
insert into public.so_espacio (id, nombre, planta, tipo, estado, nota) values ('A-JAR', 'Jardín y exteriores', 'Planta A', 'común', 'operativo', 'Áreas verdes y circulación exterior.') on conflict (id) do nothing;
insert into public.so_espacio (id, nombre, planta, tipo, estado, nota) values ('A-EST', 'Estacionamiento', 'Planta A', 'común', 'operativo', 'Incluido en el paquete transversal de inquilinos.') on conflict (id) do nothing;
insert into public.so_espacio (id, nombre, planta, tipo, estado, nota) values ('B1', 'B1 · Sala Multiusos y Bienestar', 'Planta B', 'privativo', 'operativo', 'Comercializable por bloques horarios. Tarifa especial para instructores recurrentes.') on conflict (id) do nothing;
insert into public.so_espacio (id, nombre, planta, tipo, estado, nota) values ('B3', 'B3 · Estudio', 'Planta B', 'privativo', 'operativo', 'Alquiler mensual. Ventanas y luz natural; sin espejo ni tarima.') on conflict (id) do nothing;
insert into public.so_espacio (id, nombre, planta, tipo, estado, nota) values ('B5', 'B5 · Salón de Terapias', 'Planta B', 'privativo', 'operativo', 'Comercializable.') on conflict (id) do nothing;
insert into public.so_espacio (id, nombre, planta, tipo, estado, nota) values ('B-BAN', 'Baños Planta B', 'Planta B', 'común', 'operativo', null) on conflict (id) do nothing;
insert into public.so_espacio (id, nombre, planta, tipo, estado, nota) values ('B-CIR', 'Circulaciones Planta B', 'Planta B', 'común', 'operativo', 'Escaleras y pasillos.') on conflict (id) do nothing;
insert into public.so_espacio (id, nombre, planta, tipo, estado, nota) values ('C2', 'C2 · Oficina', 'Planta C', 'privativo', 'operativo', 'Alquiler mensual.') on conflict (id) do nothing;
insert into public.so_espacio (id, nombre, planta, tipo, estado, nota) values ('C3', 'C3 · Depósito', 'Planta C', 'servicio', 'operativo', 'No comercializable. Uso interno como depósito.') on conflict (id) do nothing;
insert into public.so_espacio (id, nombre, planta, tipo, estado, nota) values ('C6', 'C6 · Taller Creativo', 'Planta C', 'privativo', 'operativo', 'Alquiler mensual.') on conflict (id) do nothing;
insert into public.so_espacio (id, nombre, planta, tipo, estado, nota) values ('C-BAN', 'Baños Planta C', 'Planta C', 'común', 'operativo', null) on conflict (id) do nothing;
insert into public.so_espacio (id, nombre, planta, tipo, estado, nota) values ('C-CIR', 'Circulaciones Planta C', 'Planta C', 'común', 'operativo', 'Escaleras y pasillos.') on conflict (id) do nothing;
insert into public.so_espacio (id, nombre, planta, tipo, estado, nota) values ('D-PEN', 'Planta D · por registrar', 'Planta D', 'privativo', 'operativo', 'Completar el inventario de esta planta.') on conflict (id) do nothing;
insert into public.so_espacio (id, nombre, planta, tipo, estado, nota) values ('S-FAC', 'Fachada', 'Sistemas y envolvente', 'sistema', 'operativo', 'Conservación patrimonial de la casa de 1955.') on conflict (id) do nothing;
insert into public.so_espacio (id, nombre, planta, tipo, estado, nota) values ('S-TEC', 'Cubierta y techos', 'Sistemas y envolvente', 'sistema', 'operativo', null) on conflict (id) do nothing;
insert into public.so_espacio (id, nombre, planta, tipo, estado, nota) values ('S-ELE', 'Instalación eléctrica', 'Sistemas y envolvente', 'sistema', 'operativo', 'Conexión trifásica 150 kVA · CORPOELEC.') on conflict (id) do nothing;
insert into public.so_espacio (id, nombre, planta, tipo, estado, nota) values ('S-PLO', 'Plomería y aguas', 'Sistemas y envolvente', 'sistema', 'operativo', null) on conflict (id) do nothing;
insert into public.so_espacio (id, nombre, planta, tipo, estado, nota) values ('S-SEG', 'Sistema de seguridad', 'Sistemas y envolvente', 'sistema', 'operativo', 'Servicio 24/7 · Evenseg.') on conflict (id) do nothing;
insert into public.so_espacio (id, nombre, planta, tipo, estado, nota) values ('S-CON', 'Conectividad', 'Sistemas y envolvente', 'sistema', 'operativo', 'Starlink.') on conflict (id) do nothing;

-- Objetivos
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('DIR-01-C1', 'DIR-01', 'DIR-01.1', 'corto', 'Definir Quinta Mamá en una sola frase y aplicarla en todo punto de contacto', 'Puntos de contacto con la frase desplegada', 4, 0, 'puntos', 'mayor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('DIR-01-C2', 'DIR-01', 'DIR-01.1', 'corto', 'Cerrar el catálogo de servicios: qué se ofrece y qué se deja de ofrecer', 'Catálogo cerrado con tarifario único', 1, 0, 'sí/no', 'mayor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('DIR-01-C3', 'DIR-01', 'DIR-01.4', 'corto', 'Delegar formalmente 3 decisiones hoy centralizadas en dirección', 'Decisiones con dueño distinto a dirección', 3, 0, 'decisiones', 'mayor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('DIR-01-M1', 'DIR-01', 'DIR-01.2', 'mediano', 'Consolidar el modelo replicable y presentarlo a socios', 'Conversaciones formales avanzadas', 1, 0, 'socios', 'mayor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('DIR-01-M2', 'DIR-01', 'DIR-01.4', 'mediano', 'Instalar ritmo de gobierno: comité mensual sobre las 7 áreas', 'Comités consecutivos con acta', 6, 0, 'comités', 'mayor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('DIR-01-L1', 'DIR-01', 'DIR-01.4', 'largo', 'Reducir la dependencia operativa del fundador', 'Tiempo de dirección en operación', 20, 0, '%', 'menor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('DIR-01-L2', 'DIR-01', 'DIR-01.2', 'largo', 'Cerrar acuerdo de expansión o licenciamiento del modelo', 'Cartas de intención firmadas', 1, 0, 'cartas', 'mayor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('ESP-02-C1', 'ESP-02', 'ESP-02.1', 'corto', 'Colocar B3, C2 y C6; activar B1 por bloques', 'Ocupación de espacios comercializables', 80, 0, '%', 'mayor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('ESP-02-C2', 'ESP-02', 'ESP-02.3', 'corto', 'Contratos firmados, vigentes y digitalizados', 'Inquilinos con contrato vigente', 100, 0, '%', 'mayor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('ESP-02-C3', 'ESP-02', 'ESP-02.3', 'corto', 'Cobranza estandarizada con fecha única y recordatorio', 'Casos de mora mayor a 15 días', 0, 0, 'casos', 'menor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('ESP-02-M1', 'ESP-02', 'ESP-02.2', 'mediano', 'Programa de retención y convivencia con inquilinos', 'Tasa de renovación', 85, 0, '%', 'mayor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('ESP-02-M2', 'ESP-02', 'ESP-02.4', 'mediano', 'Tarifario dinámico por bloque horario en B1', 'Bloques usados sobre disponibles', 60, 0, '%', 'mayor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('ESP-02-L1', 'ESP-02', 'ESP-02.1', 'largo', 'Lista de espera activa: demanda mayor que oferta', 'Prospectos calificados esperando', 3, 0, 'prospectos', 'mayor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('ESP-02-L2', 'ESP-02', 'ESP-02.2', 'largo', 'Elevar el mix de inquilinos hacia perfiles de curaduría', 'Inquilinos alineados al criterio', 100, 0, '%', 'mayor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('EXP-03-C1', 'EXP-03', 'EXP-03.1', 'corto', 'Estandarizar el proceso de evento de punta a punta', 'Eventos bajo el SOP único', 100, 0, '%', 'mayor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('EXP-03-C2', 'EXP-03', 'EXP-03.1', 'corto', 'Fijar plazos de producción y cláusulas no negociables', 'Eventos nuevos con contrato tipo', 100, 0, '%', 'mayor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('EXP-03-C3', 'EXP-03', 'EXP-03.2', 'corto', 'Publicar el calendario cultural y de bienestar con antelación', 'Días de antelación de publicación', 30, 0, 'días', 'mayor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('EXP-03-M1', 'EXP-03', 'EXP-03.3', 'mediano', 'Consolidar programación recurrente que no dependa de esfuerzo nuevo', 'Actividades recurrentes fijas al mes', 4, 0, 'actividades', 'mayor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('EXP-03-M2', 'EXP-03', 'EXP-03.1', 'mediano', 'Convertir eventos privados en canal de captación', 'Eventos originados en asistentes previos', 20, 0, '%', 'mayor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('EXP-03-L1', 'EXP-03', 'EXP-03.2', 'largo', 'Programa cultural con identidad propia y reconocimiento externo', 'Programa insignia con cobertura', 1, 0, 'programa', 'mayor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('EXP-03-L2', 'EXP-03', 'EXP-03.1', 'largo', 'Estabilizar el ingreso variable', 'Variación mensual de ingresos', 25, 0, '%', 'menor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('GAS-04-C1', 'GAS-04', 'GAS-04.4', 'corto', 'Menú cerrado con fichas técnicas y costeo por plato', 'Platos con food cost calculado', 100, 0, '%', 'mayor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('GAS-04-C2', 'GAS-04', 'GAS-04.4', 'corto', 'Control de inventario y compras semanal', 'Conteos registrados por semana', 1, 0, 'conteos', 'mayor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('GAS-04-C3', 'GAS-04', 'GAS-04.1', 'corto', 'Estándar de servicio documentado para comedor y cafetín', 'Cumplimiento del SOP de servicio', 100, 0, '%', 'mayor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('GAS-04-M1', 'GAS-04', 'GAS-04.4', 'mediano', 'Food cost dentro de rango objetivo', 'Food cost sobre la venta', 32, 0, '%', 'menor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('GAS-04-M2', 'GAS-04', 'GAS-04.2', 'mediano', 'Integrar la oferta al flujo de inquilinos y eventos', 'Inquilinos que consumen semanalmente', 40, 0, '%', 'mayor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('GAS-04-L1', 'GAS-04', 'GAS-04.1', 'largo', 'Comedor con P&L propio y positivo', 'Margen operativo del área', 15, 0, '%', 'mayor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('GAS-04-L2', 'GAS-04', 'GAS-04.1', 'largo', 'Identidad gastronómica reconocible y coherente con la casa', 'Propuesta definida y comunicada', 1, 0, 'sí/no', 'mayor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('OPS-05-C1', 'OPS-05', 'OPS-05.1', 'corto', 'Cerrar los pendientes de mantenimiento críticos abiertos', 'Pendientes críticos abiertos', 0, 0, 'pendientes', 'menor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('OPS-05-C2', 'OPS-05', 'OPS-05.4', 'corto', 'Protocolos de apertura, cierre, falla e inventario en uso diario', 'Días con bitácora completa', 100, 0, '%', 'mayor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('OPS-05-C3', 'OPS-05', 'OPS-05.5', 'corto', 'Roles, SOPs y contratos del equipo actualizados y accesibles', 'Equipo con rol y contrato vigente', 100, 0, '%', 'mayor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('OPS-05-M1', 'OPS-05', 'OPS-05.1', 'mediano', 'Plan de mantenimiento preventivo anual en ejecución', 'Preventivas ejecutadas a tiempo', 90, 0, '%', 'mayor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('OPS-05-M2', 'OPS-05', 'OPS-05.5', 'mediano', 'Revisar la compensación del equipo frente a mercado', 'Propuesta presentada y decidida', 1, 0, 'sí/no', 'mayor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('OPS-05-M3', 'OPS-05', 'OPS-05.2', 'mediano', 'Reducir dependencia de proveedores críticos únicos', 'Proveedores calificados por servicio', 2, 0, 'proveedores', 'mayor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('OPS-05-L1', 'OPS-05', 'OPS-05.1', 'largo', 'Plan de conservación patrimonial de la casa de 1955', 'Plan aprobado con cronograma', 1, 0, 'sí/no', 'mayor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('OPS-05-L2', 'OPS-05', 'OPS-05.5', 'largo', 'Equipo estable y formado', 'Rotación anual', 15, 0, '%', 'menor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('MKT-06-C1', 'MKT-06', 'MKT-06.2', 'corto', 'Asignar dueño de contenido digital', 'Responsable designado', 1, 0, 'sí/no', 'mayor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('MKT-06-C2', 'MKT-06', 'MKT-06.2', 'corto', 'Lanzar el sitio web de producción con backend real', 'Sitio en línea y funcional', 1, 0, 'sí/no', 'mayor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('MKT-06-C3', 'MKT-06', 'MKT-06.2', 'corto', 'Calendario editorial mensual con parrilla fija', 'Publicaciones sostenidas por semana', 4, 0, 'publicaciones', 'mayor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('MKT-06-M1', 'MKT-06', 'MKT-06.3', 'mediano', 'Base de datos unificada de comunidad', 'Contactos segmentados y utilizables', 1000, 0, 'contactos', 'mayor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('MKT-06-M2', 'MKT-06', 'MKT-06.4', 'mediano', 'Comunicar valor antes de la compra con el relato de la casa', 'Conversión de consulta a visita', 30, 0, '%', 'mayor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('MKT-06-L1', 'MKT-06', 'MKT-06.3', 'largo', 'Programa de comunidad o membresía activo', 'Miembros inscritos', 100, 0, 'miembros', 'mayor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('MKT-06-L2', 'MKT-06', 'MKT-06.1', 'largo', 'Posicionar Quinta Mamá como referencia cultural en Caracas', 'Menciones editoriales o institucionales', 6, 0, 'menciones', 'mayor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('FIN-07-C1', 'FIN-07', 'FIN-07.4', 'corto', 'Asignar responsable administrativo-financiero', 'Responsable designado', 1, 0, 'sí/no', 'mayor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('FIN-07-C2', 'FIN-07', 'FIN-07.3', 'corto', 'Claridad fiscal y legal básica', 'Diagnóstico y plan de regularización', 1, 0, 'sí/no', 'mayor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('FIN-07-C3', 'FIN-07', 'FIN-07.3', 'corto', 'Cierre mensual de ingresos, egresos y caja en formato único', 'Cierres entregados antes del día 10', 3, 0, 'cierres', 'mayor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('FIN-07-M1', 'FIN-07', 'FIN-07.4', 'mediano', 'P&L separado por unidad de negocio', 'P&L mensuales por unidad', 3, 0, 'informes', 'mayor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('FIN-07-M2', 'FIN-07', 'FIN-07.2', 'mediano', 'Presupuesto anual con control de desviación', 'Desviación mensual', 10, 0, '%', 'menor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('FIN-07-L1', 'FIN-07', 'FIN-07.1', 'largo', 'Punto de equilibrio cubierto por ingreso recurrente', 'Ingreso recurrente sobre costos fijos', 100, 0, '%', 'mayor') on conflict (id) do nothing;
insert into public.so_objetivo (id, area_id, sub_eje_id, horizonte, titulo, indicador, meta, actual, unidad, sentido) values ('FIN-07-L2', 'FIN-07', 'FIN-07.4', 'largo', 'Capacidad de planificación e inversión', 'Reserva operativa', 3, 0, 'meses', 'mayor') on conflict (id) do nothing;

-- Tareas + responsables + valores + subtareas
insert into public.so_tarea (id, titulo, sub_eje_id, objetivo_id, espacio_id, vence, creada, impacto, proximidad, patrimonio, compromiso, nota, estado, origen) values ('T-0001', 'Evaluar la carga de Beatriz Márquez y definir el perfil de un coordinador de experiencias', 'OPS-05.5', 'OPS-05-C3', null, '2026-08-29', '2026-07-30', 'alto', 'requisito', false, false, 'Tres áreas (ESP-02, EXP-03, OPS-05) recaen hoy sobre una sola persona.', 'pendiente', 'sistema') on conflict (id) do nothing;
insert into public.so_tarea_responsable (tarea_id, persona_id) select 'T-0001', id from public.so_persona where nombre = 'Rodrigo Pietri' on conflict do nothing;
insert into public.so_tarea_valor (tarea_id, valor) values ('T-0001', 'Acción') on conflict do nothing;
insert into public.so_subtarea (tarea_id, titulo, hecho, orden) select 'T-0001', 'Medir horas semanales reales por área durante 2 semanas', false, 0 where not exists (select 1 from public.so_subtarea where tarea_id = 'T-0001' and titulo = 'Medir horas semanales reales por área durante 2 semanas');
insert into public.so_subtarea (tarea_id, titulo, hecho, orden) select 'T-0001', 'Listar qué tareas de EXP-03 son delegables hoy', false, 1 where not exists (select 1 from public.so_subtarea where tarea_id = 'T-0001' and titulo = 'Listar qué tareas de EXP-03 son delegables hoy');
insert into public.so_subtarea (tarea_id, titulo, hecho, orden) select 'T-0001', 'Redactar el perfil del coordinador: alcance, reporte y rango', false, 2 where not exists (select 1 from public.so_subtarea where tarea_id = 'T-0001' and titulo = 'Redactar el perfil del coordinador: alcance, reporte y rango');
insert into public.so_subtarea (tarea_id, titulo, hecho, orden) select 'T-0001', 'Decidir: contratar, redistribuir o acotar alcance', false, 3 where not exists (select 1 from public.so_subtarea where tarea_id = 'T-0001' and titulo = 'Decidir: contratar, redistribuir o acotar alcance');
insert into public.so_tarea (id, titulo, sub_eje_id, objetivo_id, espacio_id, vence, creada, impacto, proximidad, patrimonio, compromiso, nota, estado, origen) values ('T-0002', 'Evaluar la incorporación de un responsable de contenido digital y definir su perfil profesional', 'MKT-06.2', 'MKT-06-C1', null, '2026-08-29', '2026-07-30', 'alto', 'directa', false, false, 'Definir perfil, dedicación, compensación y línea de reporte.', 'pendiente', 'sistema') on conflict (id) do nothing;
insert into public.so_tarea_responsable (tarea_id, persona_id) select 'T-0002', id from public.so_persona where nombre = 'Rodrigo Pietri' on conflict do nothing;
insert into public.so_tarea_responsable (tarea_id, persona_id) select 'T-0002', id from public.so_persona where nombre = 'Óscar Pietri' on conflict do nothing;
insert into public.so_tarea_valor (tarea_id, valor) values ('T-0002', 'Autenticidad') on conflict do nothing;
insert into public.so_subtarea (tarea_id, titulo, hecho, orden) select 'T-0002', 'Definir modalidad: interno, freelance o agencia', false, 0 where not exists (select 1 from public.so_subtarea where tarea_id = 'T-0002' and titulo = 'Definir modalidad: interno, freelance o agencia');
insert into public.so_subtarea (tarea_id, titulo, hecho, orden) select 'T-0002', 'Estimar volumen mensual de piezas y canales a cubrir', false, 1 where not exists (select 1 from public.so_subtarea where tarea_id = 'T-0002' and titulo = 'Estimar volumen mensual de piezas y canales a cubrir');
insert into public.so_subtarea (tarea_id, titulo, hecho, orden) select 'T-0002', 'Fijar rango de compensación y presupuesto anual', false, 2 where not exists (select 1 from public.so_subtarea where tarea_id = 'T-0002' and titulo = 'Fijar rango de compensación y presupuesto anual');
insert into public.so_subtarea (tarea_id, titulo, hecho, orden) select 'T-0002', 'Acordar el perfil con la dirección creativa', false, 3 where not exists (select 1 from public.so_subtarea where tarea_id = 'T-0002' and titulo = 'Acordar el perfil con la dirección creativa');
insert into public.so_tarea (id, titulo, sub_eje_id, objetivo_id, espacio_id, vence, creada, impacto, proximidad, patrimonio, compromiso, nota, estado, origen) values ('T-0003', 'Evaluar la incorporación de un administrador financiero y definir su perfil profesional', 'FIN-07.4', 'FIN-07-C1', null, '2026-08-29', '2026-07-30', 'alto', 'directa', false, false, 'Definir si el alcance cubre solo administración o también contabilidad y fiscal.', 'pendiente', 'sistema') on conflict (id) do nothing;
insert into public.so_tarea_responsable (tarea_id, persona_id) select 'T-0003', id from public.so_persona where nombre = 'Rodrigo Pietri' on conflict do nothing;
insert into public.so_tarea_valor (tarea_id, valor) values ('T-0003', 'Excelencia') on conflict do nothing;
insert into public.so_subtarea (tarea_id, titulo, hecho, orden) select 'T-0003', 'Delimitar alcance: administración, contabilidad, fiscal', false, 0 where not exists (select 1 from public.so_subtarea where tarea_id = 'T-0003' and titulo = 'Delimitar alcance: administración, contabilidad, fiscal');
insert into public.so_subtarea (tarea_id, titulo, hecho, orden) select 'T-0003', 'Definir si es interno o contador externo con retainer', false, 1 where not exists (select 1 from public.so_subtarea where tarea_id = 'T-0003' and titulo = 'Definir si es interno o contador externo con retainer');
insert into public.so_subtarea (tarea_id, titulo, hecho, orden) select 'T-0003', 'Fijar rango de compensación', false, 2 where not exists (select 1 from public.so_subtarea where tarea_id = 'T-0003' and titulo = 'Fijar rango de compensación');
insert into public.so_subtarea (tarea_id, titulo, hecho, orden) select 'T-0003', 'Redactar el perfil y la línea de reporte', false, 3 where not exists (select 1 from public.so_subtarea where tarea_id = 'T-0003' and titulo = 'Redactar el perfil y la línea de reporte');
insert into public.so_tarea (id, titulo, sub_eje_id, objetivo_id, espacio_id, vence, creada, impacto, proximidad, patrimonio, compromiso, nota, estado, origen) values ('T-0004', 'Revisión de la estructura de 7 áreas tras el período de prueba', 'DIR-01.4', 'DIR-01-M2', null, '2026-10-28', '2026-07-30', 'alto', 'requisito', false, true, 'Agenda cerrada de la revisión de los 3 meses.', 'pendiente', 'sistema') on conflict (id) do nothing;
insert into public.so_tarea_responsable (tarea_id, persona_id) select 'T-0004', id from public.so_persona where nombre = 'Rodrigo Pietri' on conflict do nothing;
insert into public.so_tarea_valor (tarea_id, valor) values ('T-0004', 'Acción') on conflict do nothing;
insert into public.so_subtarea (tarea_id, titulo, hecho, orden) select 'T-0004', 'Medir carga de tareas por área y por persona', false, 0 where not exists (select 1 from public.so_subtarea where tarea_id = 'T-0004' and titulo = 'Medir carga de tareas por área y por persona');
insert into public.so_subtarea (tarea_id, titulo, hecho, orden) select 'T-0004', 'Identificar áreas y sub-ejes mudos en el período', false, 1 where not exists (select 1 from public.so_subtarea where tarea_id = 'T-0004' and titulo = 'Identificar áreas y sub-ejes mudos en el período');
insert into public.so_subtarea (tarea_id, titulo, hecho, orden) select 'T-0004', 'Calibrar el PCE: ¿los umbrales separaron bien?', false, 2 where not exists (select 1 from public.so_subtarea where tarea_id = 'T-0004' and titulo = 'Calibrar el PCE: ¿los umbrales separaron bien?');
insert into public.so_subtarea (tarea_id, titulo, hecho, orden) select 'T-0004', 'Decidir si Gente (OPS-05.5) o Legal (DIR-01.3) se separan', false, 3 where not exists (select 1 from public.so_subtarea where tarea_id = 'T-0004' and titulo = 'Decidir si Gente (OPS-05.5) o Legal (DIR-01.3) se separan');
insert into public.so_tarea (id, titulo, sub_eje_id, objetivo_id, espacio_id, vence, creada, impacto, proximidad, patrimonio, compromiso, nota, estado, origen) values ('T-0005', 'Completar el inventario de la Planta D y su estado de conservación', 'OPS-05.1', 'OPS-05-L1', 'D-PEN', '2026-08-20', '2026-07-30', 'medio', 'requisito', false, false, 'El inventario de la casa está incompleto en esta planta.', 'pendiente', 'sistema') on conflict (id) do nothing;
insert into public.so_tarea_responsable (tarea_id, persona_id) select 'T-0005', id from public.so_persona where nombre = 'Luis Castellanos' on conflict do nothing;
insert into public.so_tarea_valor (tarea_id, valor) values ('T-0005', 'Patrimonio') on conflict do nothing;
insert into public.so_subtarea (tarea_id, titulo, hecho, orden) select 'T-0005', 'Levantar los espacios de la planta con la memoria descriptiva', false, 0 where not exists (select 1 from public.so_subtarea where tarea_id = 'T-0005' and titulo = 'Levantar los espacios de la planta con la memoria descriptiva');
insert into public.so_subtarea (tarea_id, titulo, hecho, orden) select 'T-0005', 'Registrar cada espacio en el panel Casa', false, 1 where not exists (select 1 from public.so_subtarea where tarea_id = 'T-0005' and titulo = 'Registrar cada espacio en el panel Casa');
insert into public.so_subtarea (tarea_id, titulo, hecho, orden) select 'T-0005', 'Asignar estado de conservación a cada uno', false, 2 where not exists (select 1 from public.so_subtarea where tarea_id = 'T-0005' and titulo = 'Asignar estado de conservación a cada uno');
insert into public.so_tarea (id, titulo, sub_eje_id, objetivo_id, espacio_id, vence, creada, impacto, proximidad, patrimonio, compromiso, nota, estado, origen) values ('T-0006', 'Documentar formalmente la estructura organizativa: quién está, en qué rol y bajo qué figura', 'OPS-05.5', 'OPS-05-C3', null, '2026-08-22', '2026-07-30', 'alto', 'directa', false, false, 'Óscar Pietri no figuraba en ningún documento de estructura pese a llevar dirección creativa. El sistema solo sabe lo que está escrito.', 'pendiente', 'sistema') on conflict (id) do nothing;
insert into public.so_tarea_responsable (tarea_id, persona_id) select 'T-0006', id from public.so_persona where nombre = 'Rodrigo Pietri' on conflict do nothing;
insert into public.so_tarea_responsable (tarea_id, persona_id) select 'T-0006', id from public.so_persona where nombre = 'Beatriz Márquez' on conflict do nothing;
insert into public.so_tarea_valor (tarea_id, valor) values ('T-0006', 'Excelencia') on conflict do nothing;
insert into public.so_tarea_valor (tarea_id, valor) values ('T-0006', 'Comunidad') on conflict do nothing;
insert into public.so_subtarea (tarea_id, titulo, hecho, orden) select 'T-0006', 'Listar a todas las personas activas hoy, internas y externas', false, 0 where not exists (select 1 from public.so_subtarea where tarea_id = 'T-0006' and titulo = 'Listar a todas las personas activas hoy, internas y externas');
insert into public.so_subtarea (tarea_id, titulo, hecho, orden) select 'T-0006', 'Asignar rol, área y figura (nómina, honorarios, colaboración)', false, 1 where not exists (select 1 from public.so_subtarea where tarea_id = 'T-0006' and titulo = 'Asignar rol, área y figura (nómina, honorarios, colaboración)');
insert into public.so_subtarea (tarea_id, titulo, hecho, orden) select 'T-0006', 'Registrar a Óscar Pietri en dirección creativa de MKT-06', false, 2 where not exists (select 1 from public.so_subtarea where tarea_id = 'T-0006' and titulo = 'Registrar a Óscar Pietri en dirección creativa de MKT-06');
insert into public.so_subtarea (tarea_id, titulo, hecho, orden) select 'T-0006', 'Definir el estatus de los colaboradores externos de marca', false, 3 where not exists (select 1 from public.so_subtarea where tarea_id = 'T-0006' and titulo = 'Definir el estatus de los colaboradores externos de marca');
insert into public.so_subtarea (tarea_id, titulo, hecho, orden) select 'T-0006', 'Cargar el organigrama en Drive y en el sistema', false, 4 where not exists (select 1 from public.so_subtarea where tarea_id = 'T-0006' and titulo = 'Cargar el organigrama en Drive y en el sistema');


-- ############################################################################
-- ## wifi-invitados.sql
-- ############################################################################
-- WiFi de invitados · registro por QR
-- ═══════════════════════════════════════════════════════════════════
-- El cliente escanea el QR de la mesa, cae en /wifi, llena el formulario
-- (nombre, correo, teléfono, fecha de nacimiento) y recién ahí ve la clave
-- del WiFi. Cada registro queda aquí para construir la base de clientes.
--
-- Aplicar en el SQL Editor de Supabase (ver supabase/README-migraciones.md).

-- ============================================================
-- INVITADOS REGISTRADOS
-- ============================================================
create table if not exists public.wifi_invitados (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  email text not null,
  telefono text not null,
  fecha_nacimiento date,
  acepta_promos boolean not null default true,
  visitas integer not null default 1,
  origen text,                 -- de dónde escaneó: ?p=terraza, ?p=barra, etc.
  primera_visita timestamptz not null default now(),
  ultima_visita timestamptz not null default now()
);

-- Un registro por correo: si el mismo cliente vuelve, se suma una visita.
create unique index if not exists wifi_invitados_email_uniq
  on public.wifi_invitados (lower(email));

create index if not exists wifi_invitados_ultima_visita_idx
  on public.wifi_invitados (ultima_visita desc);

alter table public.wifi_invitados enable row level security;

-- El invitado NO toca esta tabla: escribe el servidor con service-role.
-- El equipo (usuarios logueados en la app) sí puede consultarla y limpiarla.
drop policy if exists "wifi_inv_select" on public.wifi_invitados;
create policy "wifi_inv_select" on public.wifi_invitados
  for select to authenticated using (true);
drop policy if exists "wifi_inv_update" on public.wifi_invitados;
create policy "wifi_inv_update" on public.wifi_invitados
  for update to authenticated using (true) with check (true);
drop policy if exists "wifi_inv_delete" on public.wifi_invitados;
create policy "wifi_inv_delete" on public.wifi_invitados
  for delete to authenticated using (true);

-- ============================================================
-- CONFIGURACIÓN DEL WIFI (una sola fila)
-- ============================================================
create table if not exists public.wifi_config (
  id boolean primary key default true check (id),
  ssid text not null default '',
  clave text not null default '',
  mensaje text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.wifi_config (id) values (true) on conflict (id) do nothing;

alter table public.wifi_config enable row level security;

-- Solo el equipo logueado ve y edita la clave. El invitado la recibe por el
-- endpoint del servidor, después de registrarse.
drop policy if exists "wifi_cfg_select" on public.wifi_config;
create policy "wifi_cfg_select" on public.wifi_config
  for select to authenticated using (true);
drop policy if exists "wifi_cfg_update" on public.wifi_config;
create policy "wifi_cfg_update" on public.wifi_config
  for update to authenticated using (true) with check (true);

-- ============================================================
-- REGISTRO ATÓMICO (lo llama el servidor con service-role)
-- ============================================================
create or replace function public.wifi_registrar(
  p_nombre text,
  p_email text,
  p_telefono text,
  p_nacimiento date,
  p_promos boolean,
  p_origen text
) returns table (nuevo boolean, visitas integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_visitas integer;
begin
  select id into v_id from public.wifi_invitados
   where lower(email) = lower(p_email) limit 1;

  if v_id is null then
    insert into public.wifi_invitados
      (nombre, email, telefono, fecha_nacimiento, acepta_promos, origen)
    values
      (p_nombre, p_email, p_telefono, p_nacimiento, p_promos, p_origen)
    returning wifi_invitados.visitas into v_visitas;
    return query select true, v_visitas;
  else
    update public.wifi_invitados set
      nombre = p_nombre,
      telefono = p_telefono,
      fecha_nacimiento = coalesce(p_nacimiento, fecha_nacimiento),
      acepta_promos = p_promos,
      origen = coalesce(p_origen, origen),
      visitas = wifi_invitados.visitas + 1,
      ultima_visita = now()
    where id = v_id
    returning wifi_invitados.visitas into v_visitas;
    return query select false, v_visitas;
  end if;
end;
$$;

-- El invitado no está logueado: se le permite ejecutar SOLO esta función
-- (que no devuelve la clave del WiFi, solo confirma el registro).
revoke all on function public.wifi_registrar(text, text, text, date, boolean, text) from public;
grant execute on function public.wifi_registrar(text, text, text, date, boolean, text)
  to anon, authenticated, service_role;


-- ############################################################################
-- ## admin-cuentas-cobrar.sql
-- ############################################################################
-- Administración · Cuentas por cobrar (CXC)
-- Lo que en Setux entra como "CXC" son ventas a crédito: NO son ingreso
-- todavía. Se guardan aquí como cuentas abiertas, salen como alerta en el
-- panel, y al marcarlas "cobrada" se convierten en ingreso.
-- Tabla CERRADA (RLS activo sin políticas): solo el servidor de admin.

create table if not exists public.admin_cuenta_cobrar (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,   -- fecha de origen (reporte)
  descripcion text,
  deudor text,                                -- opcional: quién debe
  monto numeric(16,2),                        -- en la moneda de origen (EUR de Setux)
  moneda text default 'EUR',
  tasa numeric(16,4),                         -- €→USD al importar (opcional)
  monto_usd numeric(16,2),                    -- equivalente calculado
  cobrada boolean not null default false,
  fecha_cobro date,
  ingreso_id uuid references public.admin_ingreso(id) on delete set null,
  fuente text,                                -- 'setux' si vino del import
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_admin_cxc_abierta on public.admin_cuenta_cobrar (cobrada, fecha);
create index if not exists idx_admin_cxc_fuente on public.admin_cuenta_cobrar (fuente, fecha);

alter table public.admin_cuenta_cobrar enable row level security;

drop trigger if exists admin_cxc_set_updated on public.admin_cuenta_cobrar;
create trigger admin_cxc_set_updated
  before update on public.admin_cuenta_cobrar
  for each row execute function public.set_updated_at();


-- ############################################################################
-- ## admin-cxc-v2.sql
-- ############################################################################
-- Administración · Cuentas por cobrar v2 (por cliente, con detalle y pagos)
-- Objetivo: manejar las CXC como saldos por cliente conservando el detalle de
-- cada deuda (cuenta) y registrando los pagos (cobros) como movimientos aparte.
--   saldo del cliente = Σ cuentas abiertas − Σ pagos
-- NO se borra el detalle al cobrar; el historial se conserva.
-- Todo se maneja como las ventas: monto en su moneda + tasa + equivalente USD.

-- 1) La tabla de cuentas (deudas) ya existe (admin_cuenta_cobrar). Le añadimos
--    referencia del documento de Zetux y un hash para no duplicar al reimportar.
alter table public.admin_cuenta_cobrar add column if not exists ref text;         -- p. ej. NE-8281
alter table public.admin_cuenta_cobrar add column if not exists import_hash text;  -- dedupe reimport

-- Evita importar dos veces la misma cuenta (mismo cliente + referencia).
create unique index if not exists idx_admin_cxc_import_hash
  on public.admin_cuenta_cobrar (import_hash) where import_hash is not null;

-- 2) Pagos (cobros) de cuentas por cobrar. Cada pago:
--    - reduce el saldo del cliente,
--    - queda enlazado al ingreso que genera (ingreso_id) para no duplicar,
--    - guarda el método y la fecha real del cobro.
create table if not exists public.admin_cxc_pago (
  id uuid primary key default gen_random_uuid(),
  cliente text not null,                       -- nombre del cliente (deudor)
  fecha date not null default current_date,    -- fecha REAL del cobro
  monto numeric(16,2) not null,                -- en la moneda del cobro
  moneda text not null default 'EUR',          -- EUR | USD | Bs
  tasa numeric(16,4),                          -- para el equivalente USD
  monto_usd numeric(16,2),                     -- equivalente calculado
  metodo text,                                 -- Efectivo | Pago Móvil | Zelle | ...
  referencia text,                             -- referencia/recibo opcional
  ingreso_id uuid references public.admin_ingreso(id) on delete set null,
  nota text,
  created_at timestamptz not null default now()
);
create index if not exists idx_admin_cxc_pago_cliente on public.admin_cxc_pago (cliente);
create index if not exists idx_admin_cxc_pago_fecha on public.admin_cxc_pago (fecha);

alter table public.admin_cxc_pago enable row level security;  -- CERRADA: solo el servidor de admin

-- 3) Limpieza de las CXC del modelo anterior (montos globales / por-cliente sin
--    detalle). El nuevo flujo las reimporta con detalle por documento, así que
--    borramos SOLO las abiertas importadas sin detalle (import_hash null) para
--    que no se dupliquen. Las cuentas manuales y las ya cobradas se conservan.
delete from public.admin_cuenta_cobrar
  where cobrada = false and import_hash is null and fuente in ('estado-cuenta', 'setux');


-- ############################################################################
-- ## admin-egresos.sql
-- ############################################################################
-- Administración · Egresos y categorías
-- Tablas CERRADAS (RLS activo sin políticas): solo el servidor con la
-- contraseña de administración. Un egreso es un pago YA confirmado; puede
-- nacer a mano o al confirmar una línea de solicitud (solicitud_linea_id).

create table if not exists public.admin_categoria (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  clasificacion text not null default 'variable',  -- fija | variable
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_admin_cat_nombre on public.admin_categoria (lower(nombre));

create table if not exists public.admin_egreso (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  concepto text,
  categoria_id uuid references public.admin_categoria(id) on delete set null,
  categoria_nombre text,                 -- snapshot del nombre de categoría
  clasificacion text,                    -- fija | variable (snapshot)
  proveedor_id uuid references public.admin_proveedor(id) on delete set null,
  proveedor_nombre text,                 -- snapshot del nombre del proveedor
  monto numeric(16,2),                   -- en moneda original
  moneda text,                           -- Bs | USD | EUR
  tasa numeric(16,4),
  monto_usd numeric(16,2),               -- equivalente calculado al registrar
  metodo text,
  factura text,
  nota text,
  solicitud_linea_id uuid references public.admin_solicitud_linea(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_admin_egreso_fecha on public.admin_egreso (fecha);
-- Evita registrar dos veces el egreso de la misma línea de solicitud.
create unique index if not exists idx_admin_egreso_sollinea
  on public.admin_egreso (solicitud_linea_id) where solicitud_linea_id is not null;

alter table public.admin_categoria enable row level security;
alter table public.admin_egreso enable row level security;

drop trigger if exists admin_egreso_set_updated on public.admin_egreso;
create trigger admin_egreso_set_updated
  before update on public.admin_egreso
  for each row execute function public.set_updated_at();

-- Categorías iniciales (se pueden editar/agregar después).
insert into public.admin_categoria (nombre, clasificacion) values
  ('Alquiler','fija'),
  ('Nómina','fija'),
  ('Servicios','fija'),
  ('Seguros','fija'),
  ('Impuestos','fija'),
  ('Insumos','variable'),
  ('Mantenimiento','variable'),
  ('Mercadeo','variable'),
  ('Eventos','variable'),
  ('Honorarios','variable'),
  ('Otros','variable')
on conflict do nothing;


-- ############################################################################
-- ## admin-ingreso-fuente.sql
-- ############################################################################
-- Administración · marca de origen para los ingresos importados
-- Permite distinguir (y no duplicar) las ventas que entran desde Setux.
alter table public.admin_ingreso add column if not exists fuente text;
create index if not exists idx_admin_ingreso_fuente_fecha
  on public.admin_ingreso (fuente, fecha);


-- ############################################################################
-- ## categoria-insumo.sql
-- ############################################################################
-- Categorías de INSUMOS definidas por el usuario, para el Análisis de Compras.
-- Espejo de categoria_producto (que es para ventas), pero INDEPENDIENTE: los
-- insumos son materia prima (Lácteos, Harinas, Empaques, Café…) y no tienen por
-- qué compartir lista con las categorías de venta (Smoothies, Alquileres…). Se
-- gestionan desde Administración → Análisis de Compras → Clasificar insumos.
-- El insumo guarda el NOMBRE de la categoría en insumos.categoria_compra.
create table if not exists public.categoria_insumo (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  orden int not null default 0,
  excluir_ranking boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_categoria_insumo_nombre
  on public.categoria_insumo (lower(nombre));

alter table public.categoria_insumo enable row level security;
drop policy if exists "catins_select" on public.categoria_insumo;
create policy "catins_select" on public.categoria_insumo for select to authenticated using (true);
drop policy if exists "catins_insert" on public.categoria_insumo;
create policy "catins_insert" on public.categoria_insumo for insert to authenticated with check (true);
drop policy if exists "catins_update" on public.categoria_insumo;
create policy "catins_update" on public.categoria_insumo for update to authenticated using (true) with check (true);
drop policy if exists "catins_delete" on public.categoria_insumo;
create policy "catins_delete" on public.categoria_insumo for delete to authenticated using (true);

-- Columna donde el insumo guarda su categoría de compra (nombre). Es aparte de
-- insumos.categoria (que usa Ventas para insumos de reventa), así los dos
-- clasificadores no se pisan.
alter table public.insumos
  add column if not exists categoria_compra text;

-- Semilla de categorías típicas de compras (edítalas/bórralas desde la página).
insert into public.categoria_insumo (nombre, orden) values
  ('Lácteos', 10),
  ('Frutas y verduras', 20),
  ('Carnes y proteínas', 30),
  ('Panadería y harinas', 40),
  ('Abarrotes / secos', 50),
  ('Café y té', 60),
  ('Bebidas', 70),
  ('Endulzantes', 80),
  ('Snacks y golosinas', 90),
  ('Empaques y desechables', 100),
  ('Limpieza', 110),
  ('Otros', 999)
on conflict do nothing;

-- Migración suave: rescata las categorías que YA usan tus insumos, EXCEPTO las
-- que en realidad son de ventas (existen en categoria_producto → p.ej. el
-- azúcar quedó en "Alquileres fijos"). Esas se descartan y el insumo queda
-- "sin clasificar" para que lo asignes limpio desde la página.
insert into public.categoria_insumo (nombre, orden)
select distinct btrim(i.categoria), 500
from public.insumos i
where i.categoria is not null
  and btrim(i.categoria) <> ''
  and lower(btrim(i.categoria)) not in (
    select lower(nombre) from public.categoria_producto
  )
on conflict do nothing;

-- Copia la categoría existente a categoria_compra solo si quedó en la lista
-- nueva (es decir, si NO era una categoría de ventas colada).
update public.insumos i
set categoria_compra = c.nombre
from public.categoria_insumo c
where i.categoria_compra is null
  and i.categoria is not null
  and lower(btrim(i.categoria)) = lower(c.nombre);


-- ############################################################################
-- ## cocina-categorias-libres.sql
-- ############################################################################
-- Cocina · Categorías de insumo libres (texto)
-- ════════════════════════════════════════════════════════════════
-- Las categorías de materia prima pasan a ser TEXTO LIBRE (se pueden crear
-- categorías nuevas en cualquier momento desde el formulario, igual que el
-- menaje). El código ya no depende de los slugs fijos.
--
-- Esta migración unifica las categorías viejas (guardadas como slug, ej.
-- 'cafe') a su nombre legible (ej. 'Café & Té'), para que TODO el catálogo
-- quede parejo y no se dupliquen pills de filtro (slug viejo vs etiqueta nueva).
--
-- Solo afecta filas cuyo valor sea exactamente uno de los slugs conocidos.
-- Idempotente: correrla de nuevo no cambia nada (ya no quedan slugs).

update public.insumos set categoria = 'Café & Té'            where categoria = 'cafe';
update public.insumos set categoria = 'Lácteos'              where categoria = 'lacteos';
update public.insumos set categoria = 'Frutas & Vegetales'   where categoria = 'frutas';
update public.insumos set categoria = 'Panadería'            where categoria = 'panaderia';
update public.insumos set categoria = 'Proteínas'            where categoria = 'proteinas';
update public.insumos set categoria = 'Salsas & Aderezos'    where categoria = 'salsas';
update public.insumos set categoria = 'Bebidas'              where categoria = 'bebidas';
update public.insumos set categoria = 'Desechables'          where categoria = 'desechables';
update public.insumos set categoria = 'Condimentos & Especias' where categoria = 'condimentos';
update public.insumos set categoria = 'Snacks'               where categoria = 'snacks';
update public.insumos set categoria = 'Otros'                where categoria = 'otros';


-- ############################################################################
-- ## cocina-compra-flete.sql
-- ############################################################################
-- Cocina · Compras: flete / delivery del proveedor
-- ════════════════════════════════════════════════════════════════
-- Cargo de entrega que el proveedor suma a la factura al traer los insumos. Va
-- ASOCIADO a la compra (no es un gasto separado) y cuenta en el total de la
-- factura, pero NO se reparte en el precio unitario de cada insumo (es un cargo
-- de la factura completa, no del insumo). Por eso va en su propia columna y no
-- toca los triggers de stock/precio.
--
-- Como una factura puede tener varias líneas de compra (un insumo por línea), el
-- flete se anota UNA vez (en cualquier línea de esa factura); el resumen "por
-- factura" suma el flete de la factura.
--
-- Aditivo e idempotente.

alter table public.compras
  add column if not exists flete_usd numeric(12, 4);


-- ############################################################################
-- ## cocina-compra-numero-factura.sql
-- ############################################################################
-- Cocina · Compras: número de factura
-- ════════════════════════════════════════════════════════════════
-- Número de la factura del proveedor. Sirve para conciliar cada compra con su
-- factura (contabilidad), evitar pagar dos veces la misma y para el módulo
-- administrativo, que lee esta misma tabla `compras` (Análisis de Compras).
-- Texto libre porque las facturas pueden ser alfanuméricas. Opcional (no todas
-- las compras traen factura formal).
--
-- Aditivo e idempotente.

alter table public.compras
  add column if not exists numero_factura text;


-- ############################################################################
-- ## cocina-compra-pago-diferido.sql
-- ############################################################################
-- Cocina · Compras: pago diferido (cuentas por pagar)
-- ════════════════════════════════════════════════════════════════
-- No siempre se le paga al proveedor en el momento de la compra. Agregamos un
-- estado de pago a cada compra:
--   • pagada    → true si ya se pagó (por defecto true: las compras existentes
--                 se asumen pagadas, y una compra nueva normal se paga al toque).
--   • fecha_pago → cuándo se pagó (null mientras está "por pagar").
--
-- No afecta el stock ni el precio (esos los siguen manejando los triggers de
-- insert/delete). Editar una compra se hace en la app como borrar + recrear, así
-- que reutiliza esos triggers y no hace falta un trigger de UPDATE.
--
-- Aditivo e idempotente.

alter table public.compras
  add column if not exists pagada boolean not null default true,
  add column if not exists fecha_pago date;

create index if not exists idx_compras_pagada
  on public.compras(pagada) where pagada = false;


-- ############################################################################
-- ## cocina-compra-revertir-al-borrar.sql
-- ############################################################################
-- Al BORRAR una compra, revertir su efecto en el insumo.
--
-- CONTEXTO
-- Al insertar una compra, el trigger `apply_compra_to_insumo` suma stock y
-- actualiza el precio del insumo (rotando el historial de 2 niveles:
-- ultima ↔ penultima). Antes, al borrar una compra no pasaba nada, y había que
-- corregir el stock a mano en el módulo de stock.
--
-- Este trigger, al borrar una compra:
--   • STOCK: siempre resta lo que la compra había sumado (cantidad ×
--     cantidad_por_compra). Es la parte crítica y siempre es exacta.
--   • PRECIO: solo si la compra borrada era la ÚLTIMA registrada del insumo
--     (heurística por fecha + cantidad), revierte el precio rotando desde la
--     penúltima compra. Si se borra una compra vieja (no la última), el precio
--     NO se toca (el historial de 2 niveles no permite reconstruirlo bien);
--     solo se revierte el stock.
--
-- Cómo aplicarlo: pégalo en Supabase → SQL Editor y córrelo una vez.

create or replace function public.revertir_compra_de_insumo()
returns trigger language plpgsql as $$
declare
  v_cantidad_por_compra numeric;
  v_stock_sub numeric;
  v_es_ultima boolean;
begin
  select cantidad_por_compra into v_cantidad_por_compra
  from public.insumos where id = old.insumo_id;

  v_stock_sub := old.cantidad * coalesce(v_cantidad_por_compra, 1);

  -- ¿La compra borrada es la última registrada del insumo?
  select (old.fecha = ultima_fecha and old.cantidad = ultima_cantidad)
    into v_es_ultima
  from public.insumos where id = old.insumo_id;

  if coalesce(v_es_ultima, false) then
    -- Revertir stock + precio (rotando desde la penúltima).
    update public.insumos set
      stock_actual = greatest(0, coalesce(stock_actual, 0) - v_stock_sub),
      ultima_fecha = penultima_fecha,
      ultima_cantidad = penultima_cantidad,
      ultima_precio_usd = penultima_precio_usd,
      ultima_precio_bs = penultima_precio_bs,
      precio_compra_usd = penultima_precio_usd,
      precio_base_usd = case
        when coalesce(v_cantidad_por_compra, 0) > 0
             and penultima_precio_usd is not null
          then penultima_precio_usd / v_cantidad_por_compra
        else penultima_precio_usd
      end,
      precio_actualizado = penultima_fecha,
      penultima_fecha = null,
      penultima_cantidad = null,
      penultima_precio_usd = null,
      penultima_precio_bs = null
    where id = old.insumo_id;
  else
    -- Solo revertir stock (no se toca el precio).
    update public.insumos set
      stock_actual = greatest(0, coalesce(stock_actual, 0) - v_stock_sub)
    where id = old.insumo_id;
  end if;

  return old;
end;
$$;

drop trigger if exists compra_revert_from_insumo on public.compras;
create trigger compra_revert_from_insumo
  after delete on public.compras
  for each row execute function public.revertir_compra_de_insumo();


-- ############################################################################
-- ## cocina-compra-snapshot-factor.sql
-- ############################################################################
-- Cocina · Snapshot del factor de empaque en cada compra
-- ════════════════════════════════════════════════════════════════
-- PROBLEMA: al insertar una compra, `apply_compra_to_insumo` suma
--   cantidad × insumos.cantidad_por_compra  (el factor VIGENTE en ese momento).
-- Al borrarla, `revertir_compra_de_insumo` restaba
--   cantidad × insumos.cantidad_por_compra  (el factor VIGENTE AL BORRAR).
-- Si entre comprar y borrar se reconfiguraba el empaque (ej. cantidad_por_compra
-- de 1000 → 500 g/unidad), la reversión restaba una cantidad distinta a la que
-- se sumó → quedaban gramos fantasma (o de menos) en el stock.
--
-- SOLUCIÓN: congelar (snapshot) el factor de empaque en la propia fila de la
-- compra al insertarla, y que la reversión use ese snapshot, no el valor vivo.
--
-- No hace falta tocar `apply_compra_to_insumo`: corre en el MISMO insert, cuando
-- el factor vivo == el snapshot recién congelado, así que ya suma la cantidad
-- correcta. Solo el revert (que corre después, quizá con el factor ya cambiado)
-- necesitaba el snapshot.
--
-- Idempotente.

-- 1) Columna para el snapshot.
alter table public.compras
  add column if not exists cantidad_por_compra_snap numeric;

-- 2) Trigger BEFORE INSERT: congela el factor vigente del insumo en la compra.
--    (apply_compra_to_insumo es AFTER INSERT y no puede escribir en la fila, por
--    eso el snapshot va en un trigger BEFORE aparte.)
create or replace function public.snapshot_cantidad_por_compra()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.cantidad_por_compra_snap is null then
    select cantidad_por_compra
      into new.cantidad_por_compra_snap
      from public.insumos
     where id = new.insumo_id;
  end if;
  return new;
end;
$$;

drop trigger if exists compra_snapshot_factor on public.compras;
create trigger compra_snapshot_factor
  before insert on public.compras
  for each row execute function public.snapshot_cantidad_por_compra();

-- 3) Backfill de compras existentes con el factor ACTUAL del insumo. Es la mejor
--    aproximación posible (el factor original ya no se conoce). Si el empaque no
--    cambió, es exacto; si cambió, esas compras viejas ya tenían el riesgo y esto
--    al menos las deja consistentes de aquí en adelante.
update public.compras c
   set cantidad_por_compra_snap = i.cantidad_por_compra
  from public.insumos i
 where c.insumo_id = i.id
   and c.cantidad_por_compra_snap is null;

-- 4) Revert: usar el snapshot congelado (fallback al factor vigente por si
--    alguna fila no tuviera snapshot). Lo demás queda idéntico a la versión
--    canónica de cocina-compra-revertir-al-borrar.sql.
create or replace function public.revertir_compra_de_insumo()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_cantidad_por_compra numeric;
  v_stock_sub numeric;
  v_es_ultima boolean;
begin
  select cantidad_por_compra into v_cantidad_por_compra
  from public.insumos where id = old.insumo_id;

  -- Usar el factor CONGELADO al momento de la compra, no el vigente.
  v_stock_sub := old.cantidad
    * coalesce(old.cantidad_por_compra_snap, v_cantidad_por_compra, 1);

  select (old.fecha = ultima_fecha and old.cantidad = ultima_cantidad)
    into v_es_ultima
  from public.insumos where id = old.insumo_id;

  if coalesce(v_es_ultima, false) then
    update public.insumos set
      stock_actual = greatest(0, coalesce(stock_actual, 0) - v_stock_sub),
      ultima_fecha = penultima_fecha,
      ultima_cantidad = penultima_cantidad,
      ultima_precio_usd = penultima_precio_usd,
      ultima_precio_bs = penultima_precio_bs,
      precio_compra_usd = penultima_precio_usd,
      precio_base_usd = case
        when coalesce(v_cantidad_por_compra, 0) > 0
             and penultima_precio_usd is not null
          then penultima_precio_usd / v_cantidad_por_compra
        else penultima_precio_usd
      end,
      precio_actualizado = penultima_fecha,
      penultima_fecha = null,
      penultima_cantidad = null,
      penultima_precio_usd = null,
      penultima_precio_bs = null
    where id = old.insumo_id;
  else
    update public.insumos set
      stock_actual = greatest(0, coalesce(stock_actual, 0) - v_stock_sub)
    where id = old.insumo_id;
  end if;

  return old;
end;
$$;

drop trigger if exists compra_revert_from_insumo on public.compras;
create trigger compra_revert_from_insumo
  after delete on public.compras
  for each row execute function public.revertir_compra_de_insumo();


-- ############################################################################
-- ## cocina-config-historial.sql
-- ############################################################################
-- Cocina · Historial de cambios en cocina_config (M4 trazabilidad)
-- Registra cada modificación de food_cost, gastos, semáforo o IVA con fecha,
-- valor anterior, valor nuevo y usuario.
--
-- Idempotente.

create table if not exists public.cocina_config_historial (
  id uuid primary key default gen_random_uuid(),
  campo text not null,             -- 'food_cost_objetivo_porc' | 'gastos_operativos_porc' | ...
  valor_anterior numeric(5, 2),
  valor_nuevo numeric(5, 2) not null,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_cfg_hist_changed on public.cocina_config_historial(changed_at desc);

alter table public.cocina_config_historial enable row level security;

drop policy if exists "cfgh_select" on public.cocina_config_historial;
create policy "cfgh_select" on public.cocina_config_historial
  for select to authenticated using (true);
drop policy if exists "cfgh_insert" on public.cocina_config_historial;
create policy "cfgh_insert" on public.cocina_config_historial
  for insert to authenticated with check (true);

-- Trigger: cuando cambia cualquier campo de cocina_config, insertar fila por
-- cada campo modificado.
create or replace function public.log_cocina_config_change()
returns trigger language plpgsql as $$
begin
  if old.food_cost_objetivo_porc is distinct from new.food_cost_objetivo_porc then
    insert into public.cocina_config_historial (campo, valor_anterior, valor_nuevo, changed_by)
    values ('food_cost_objetivo_porc', old.food_cost_objetivo_porc, new.food_cost_objetivo_porc, auth.uid());
  end if;
  if old.gastos_operativos_porc is distinct from new.gastos_operativos_porc then
    insert into public.cocina_config_historial (campo, valor_anterior, valor_nuevo, changed_by)
    values ('gastos_operativos_porc', old.gastos_operativos_porc, new.gastos_operativos_porc, auth.uid());
  end if;
  if old.margen_verde_min is distinct from new.margen_verde_min then
    insert into public.cocina_config_historial (campo, valor_anterior, valor_nuevo, changed_by)
    values ('margen_verde_min', old.margen_verde_min, new.margen_verde_min, auth.uid());
  end if;
  if old.margen_amarillo_min is distinct from new.margen_amarillo_min then
    insert into public.cocina_config_historial (campo, valor_anterior, valor_nuevo, changed_by)
    values ('margen_amarillo_min', old.margen_amarillo_min, new.margen_amarillo_min, auth.uid());
  end if;
  if old.iva_porc is distinct from new.iva_porc then
    insert into public.cocina_config_historial (campo, valor_anterior, valor_nuevo, changed_by)
    values ('iva_porc', old.iva_porc, new.iva_porc, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists cfg_log_change on public.cocina_config;
create trigger cfg_log_change after update on public.cocina_config
  for each row execute function public.log_cocina_config_change();


-- ############################################################################
-- ## cocina-fix-cron-rls.sql
-- ############################################################################
-- Tasa BCV · RLS
-- La escribe el cron diario con SERVICE-ROLE (ver src/app/api/cron/bcv/route.ts),
-- que bypassa RLS. La escritura ANÓNIMA está bloqueada: la anon key es pública
-- (va en el bundle del navegador), así que si se permitiera escribir, cualquiera
-- podría fijar una tasa FALSA y descuadrar todos los precios en Bs.
--
-- Anon solo puede LEER (la app muestra la tasa del día).
--
-- OJO: antes de aplicar esto, configura SUPABASE_SERVICE_ROLE_KEY en Vercel,
-- si no el cron/banner no podrá escribir la tasa.

-- Quitar cualquier permiso de escritura anónima (de versiones anteriores).
drop policy if exists "tasa_anon_insert" on public.tasa_bcv;
drop policy if exists "tasa_anon_update" on public.tasa_bcv;

-- Lectura anónima: permitida (mostrar la tasa en la app).
drop policy if exists "tasa_anon_select" on public.tasa_bcv;
create policy "tasa_anon_select" on public.tasa_bcv
  for select to anon using (true);


-- ############################################################################
-- ## cocina-insumo-merma-coccion.sql
-- ############################################################################
-- Cocina · Merma por cocción en insumos (M5)
--
-- Guarda, por insumo, el % de peso que pierde al cocinarse. Sirve para
-- registrar pérdidas pesando el producto YA cocido (ej. tocineta): el sistema
-- convierte el peso cocido a su equivalente crudo antes de descontarlo del
-- stock, que se lleva en crudo.
--
--   crudo = cocido / (1 - merma_coccion_porc/100)
--   (tocineta con 70% → 100 g cocida ≈ 333 g cruda)
--
-- Nullable: la mayoría de los insumos no lo necesitan. Aditivo e idempotente.

alter table public.insumos
  add column if not exists merma_coccion_porc numeric(5, 2);

comment on column public.insumos.merma_coccion_porc is
  '% de peso que pierde el insumo al cocinarse (0-99). Para registrar '
  'pérdidas pesando el producto cocido y convertir a crudo.';


-- ############################################################################
-- ## cocina-precio-frescura.sql
-- ############################################################################
-- ============================================================
-- Frescura del precio de costeo (Opción A)
-- ------------------------------------------------------------
-- En Venezuela los precios cambian rápido, así que un precio de hace semanas
-- ya no sirve para costear. Esta migración:
--   1. Agrega la columna `precio_actualizado` a insumos = última vez que el
--      precio se confirmó (por una compra o por un refresco manual).
--   2. Actualiza el trigger de compras para que estampe esa fecha.
--   3. Rellena la columna en insumos existentes con su última fecha de compra,
--      para que la frescura funcione de inmediato con los datos históricos.
--
-- La definición del trigger es IDÉNTICA a la de `cocina.sql` (donde vive junto
-- a su `create trigger`). Se repite aquí solo para poder aplicar el cambio
-- sobre una base ya existente sin re-correr todo el esquema. Si cambias la
-- lógica del trigger, cámbiala en AMBOS archivos.
-- ============================================================

-- 1. Columna nueva (idempotente)
alter table public.insumos
  add column if not exists precio_actualizado date;

-- 2. Trigger actualizado (misma lógica que cocina.sql + estampa precio_actualizado)
create or replace function public.apply_compra_to_insumo()
returns trigger language plpgsql as $$
declare
  v_unidad_base text;
  v_cantidad_por_compra numeric;
  v_stock_add numeric;
  v_precio_compra_unit numeric;
begin
  -- Traer unidad_base y cantidad_por_compra del insumo
  select unidad_base, cantidad_por_compra into v_unidad_base, v_cantidad_por_compra
  from public.insumos where id = new.insumo_id;

  -- Sumar al stock (cantidad comprada × cantidad_por_compra)
  v_stock_add := new.cantidad * coalesce(v_cantidad_por_compra, 1);

  -- Precio unitario de esta compra
  if new.cantidad > 0 then
    v_precio_compra_unit := new.precio_total_usd / new.cantidad;
  else
    v_precio_compra_unit := new.precio_total_usd;
  end if;

  -- Rotar última → penúltima, y registrar nueva
  update public.insumos set
    stock_actual = coalesce(stock_actual, 0) + v_stock_add,

    penultima_fecha = ultima_fecha,
    penultima_cantidad = ultima_cantidad,
    penultima_precio_usd = ultima_precio_usd,
    penultima_precio_bs = ultima_precio_bs,

    ultima_fecha = new.fecha,
    ultima_cantidad = new.cantidad,
    ultima_precio_usd = v_precio_compra_unit,
    ultima_precio_bs = case
      when new.cantidad > 0 and new.precio_total_bs is not null
        then new.precio_total_bs / new.cantidad
      else null
    end,

    precio_compra_usd = v_precio_compra_unit,
    precio_base_usd = case
      when v_cantidad_por_compra > 0 then v_precio_compra_unit / v_cantidad_por_compra
      else v_precio_compra_unit
    end,
    -- El precio queda "fresco" a la fecha de la compra (frescura del costeo)
    precio_actualizado = new.fecha,

    proveedor_id = coalesce(new.proveedor_id, proveedor_id)
  where id = new.insumo_id;

  return new;
end;
$$;

drop trigger if exists compra_apply_to_insumo on public.compras;
create trigger compra_apply_to_insumo
  after insert on public.compras
  for each row execute function public.apply_compra_to_insumo();

-- 3. Relleno de datos existentes: el precio actual viene de la última compra,
--    así que su frescura arranca desde esa fecha.
update public.insumos
  set precio_actualizado = ultima_fecha
  where precio_actualizado is null
    and ultima_fecha is not null;


-- ############################################################################
-- ## cocina-recetas.sql
-- ############################################################################
-- Fase 2 — Recetario (M2)
-- Aditivo. No toca tablas existentes.

-- ============================================================
-- RECETAS
-- ============================================================
create table if not exists public.recetas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  seccion text not null default 'ambos',  -- cafetin | comedor | ambos
  categoria text,                          -- 'smoothie' | 'cafe' | 'sandwich' | 'bowl' | 'desayuno' | etc.
  perfil text,                             -- ej "tropical · cremoso · refrescante"
  porciones int not null default 1,
  tiempo_prep_min int,
  tiempo_coccion_min int,
  temperatura text,
  procedimiento text,
  presentacion text,
  notas_chef text,
  variaciones text,
  responsable text,
  foto_url text,
  precio_sugerido_usd numeric(10, 4),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_recetas_seccion on public.recetas(seccion);
create index if not exists idx_recetas_categoria on public.recetas(categoria);

alter table public.recetas enable row level security;

drop policy if exists "rec_select" on public.recetas;
create policy "rec_select" on public.recetas
  for select to authenticated using (true);
drop policy if exists "rec_insert" on public.recetas;
create policy "rec_insert" on public.recetas
  for insert to authenticated with check (true);
drop policy if exists "rec_update" on public.recetas;
create policy "rec_update" on public.recetas
  for update to authenticated using (true) with check (true);
drop policy if exists "rec_delete" on public.recetas;
create policy "rec_delete" on public.recetas
  for delete to authenticated using (true);

-- ============================================================
-- INGREDIENTES DE LA RECETA
-- ============================================================
create table if not exists public.receta_ingredientes (
  id uuid primary key default gen_random_uuid(),
  receta_id uuid not null references public.recetas(id) on delete cascade,
  insumo_id uuid references public.insumos(id) on delete set null,
  nombre text not null,         -- snapshot (sirve si insumo_id es null)
  cantidad numeric(12, 4) not null,
  unidad text not null,         -- snapshot: 'g', 'ml', 'unidad'
  observaciones text,
  orden int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_ri_receta on public.receta_ingredientes(receta_id, orden);
create index if not exists idx_ri_insumo on public.receta_ingredientes(insumo_id);

alter table public.receta_ingredientes enable row level security;

drop policy if exists "ri_select" on public.receta_ingredientes;
create policy "ri_select" on public.receta_ingredientes
  for select to authenticated using (true);
drop policy if exists "ri_insert" on public.receta_ingredientes;
create policy "ri_insert" on public.receta_ingredientes
  for insert to authenticated with check (true);
drop policy if exists "ri_update" on public.receta_ingredientes;
create policy "ri_update" on public.receta_ingredientes
  for update to authenticated using (true) with check (true);
drop policy if exists "ri_delete" on public.receta_ingredientes;
create policy "ri_delete" on public.receta_ingredientes
  for delete to authenticated using (true);

-- Trigger updated_at
drop trigger if exists rec_set_updated on public.recetas;
create trigger rec_set_updated
  before update on public.recetas
  for each row execute function public.set_updated_at();

-- ============================================================
-- SEED: 7 SMOOTHIES + 4 PLATOS BÁSICOS
-- ============================================================
-- Helper: subquery para obtener insumo_id por nombre (case-insensitive contains)

-- ── SMOOTHIES ────────────────────────────────────────────────────

with r as (
  insert into public.recetas (nombre, seccion, categoria, perfil, porciones, procedimiento, presentacion, precio_sugerido_usd)
  values (
    'Guayaba Sunrise',
    'cafetin',
    'smoothie',
    'tropical · cremoso · refrescante',
    1,
    E'1. Pelar y cortar guayaba y mango\n2. Licuar todos los ingredientes con hielo hasta cremoso\n3. Servir en vaso alto\n4. Decorar con rodaja de mango si se desea',
    'Vaso alto · color amarillo intenso · pajilla biodegradable',
    7.5
  ) returning id
)
insert into public.receta_ingredientes (receta_id, insumo_id, nombre, cantidad, unidad, orden)
select r.id, (select id from public.insumos where nombre ilike 'Guayaba' limit 1), 'Guayaba', 100, 'g', 1 from r union all
select r.id, (select id from public.insumos where nombre ilike 'Mango' limit 1), 'Mango', 100, 'g', 2 from r union all
select r.id, (select id from public.insumos where nombre ilike 'Agua de coco' limit 1), 'Agua de coco', 180, 'ml', 3 from r union all
select r.id, (select id from public.insumos where nombre ilike 'Hielo' limit 1), 'Hielo', 100, 'g', 4 from r;

with r as (
  insert into public.recetas (nombre, seccion, categoria, perfil, porciones, procedimiento, precio_sugerido_usd)
  values (
    'Cacao Papelón Power',
    'cafetin',
    'smoothie',
    'reconfortante · energizante · protein-friendly',
    1,
    E'1. Pelar cambur\n2. Licuar todos los ingredientes hasta lograr textura cremosa\n3. Servir en vaso alto\n4. Espolvorear canela por encima',
    7.5
  ) returning id
)
insert into public.receta_ingredientes (receta_id, insumo_id, nombre, cantidad, unidad, orden)
select r.id, (select id from public.insumos where nombre ilike 'Cambur' limit 1), 'Cambur', 100, 'g', 1 from r union all
select r.id, (select id from public.insumos where nombre ilike 'Leche completa' limit 1), 'Leche', 180, 'ml', 2 from r union all
select r.id, (select id from public.insumos where nombre ilike 'Cacao en polvo' limit 1), 'Cacao en polvo', 12, 'g', 3 from r union all
select r.id, (select id from public.insumos where nombre ilike 'Papelón%' limit 1), 'Papelón pulverizado', 18, 'g', 4 from r union all
select r.id, (select id from public.insumos where nombre ilike 'Hielo' limit 1), 'Hielo', 80, 'g', 5 from r union all
select r.id, (select id from public.insumos where nombre ilike 'Canela' limit 1), 'Canela (pizca)', 2, 'g', 6 from r;

with r as (
  insert into public.recetas (nombre, seccion, categoria, perfil, porciones, procedimiento, presentacion, precio_sugerido_usd, notas_chef)
  values (
    'Parchitada',
    'cafetin',
    'smoothie',
    'cítrico · refrescante · tropical',
    1,
    E'1. Licuar pulpa de parchita con piña y agua de coco\n2. Agregar hielo y hierbabuena\n3. Procesar hasta granizado',
    'Vaso alto · color amarillo brillante · decorar con hierbabuena',
    6,
    'Si la parchita está muy ácida, añadir un toque de papelón'
  ) returning id
)
insert into public.receta_ingredientes (receta_id, insumo_id, nombre, cantidad, unidad, orden)
select r.id, (select id from public.insumos where nombre ilike 'Pulpa de parchita' limit 1), 'Pulpa de parchita', 100, 'g', 1 from r union all
select r.id, (select id from public.insumos where nombre ilike 'Piña' limit 1), 'Piña', 120, 'g', 2 from r union all
select r.id, (select id from public.insumos where nombre ilike 'Agua de coco' limit 1), 'Agua de coco', 200, 'ml', 3 from r union all
select r.id, (select id from public.insumos where nombre ilike 'Hierbabuena' limit 1), 'Hierbabuena (3-4 hojas)', 2, 'g', 4 from r union all
select r.id, (select id from public.insumos where nombre ilike 'Hielo' limit 1), 'Hielo', 100, 'g', 5 from r;

with r as (
  insert into public.recetas (nombre, seccion, categoria, perfil, porciones, procedimiento, precio_sugerido_usd)
  values (
    'Green Ávila',
    'cafetin',
    'smoothie',
    'fresh · green · wellness',
    1,
    E'1. Lavar bien espinaca y celery\n2. Licuar todo con agua de coco\n3. Agregar hielo al final\n4. Servir inmediatamente',
    7.5
  ) returning id
)
insert into public.receta_ingredientes (receta_id, insumo_id, nombre, cantidad, unidad, orden)
select r.id, (select id from public.insumos where nombre ilike 'Espinaca' limit 1), 'Espinaca', 40, 'g', 1 from r union all
select r.id, (select id from public.insumos where nombre ilike 'Celery' limit 1), 'Celery', 30, 'g', 2 from r union all
select r.id, (select id from public.insumos where nombre ilike 'Piña' limit 1), 'Piña', 130, 'g', 3 from r union all
select r.id, (select id from public.insumos where nombre ilike 'Aguacate' limit 1), 'Aguacate', 45, 'g', 4 from r union all
select r.id, (select id from public.insumos where nombre ilike 'Jengibre' limit 1), 'Jengibre', 4, 'g', 5 from r union all
select r.id, (select id from public.insumos where nombre ilike 'Agua de coco' limit 1), 'Agua de coco', 180, 'ml', 6 from r union all
select r.id, (select id from public.insumos where nombre ilike 'Hielo' limit 1), 'Hielo', 100, 'g', 7 from r;

with r as (
  insert into public.recetas (nombre, seccion, categoria, perfil, porciones, procedimiento, presentacion, precio_sugerido_usd, notas_chef)
  values (
    'Fresas con Crema',
    'cafetin',
    'smoothie',
    'creamy · sweet · feel-good',
    1,
    E'1. Licuar fresas con crema de coco y leche\n2. Agregar vainilla\n3. Agregar hielo y procesar hasta cremoso',
    'Vaso alto · color rosa · decorar con fresa cortada en el borde',
    7,
    'Opcional: añadir un poquito de maple o miel si se requiere endulzar'
  ) returning id
)
insert into public.receta_ingredientes (receta_id, insumo_id, nombre, cantidad, unidad, orden)
select r.id, (select id from public.insumos where nombre ilike 'Fresa' limit 1), 'Fresa', 140, 'g', 1 from r union all
select r.id, (select id from public.insumos where nombre ilike 'Crema de coco' limit 1), 'Crema de coco', 60, 'g', 2 from r union all
select r.id, (select id from public.insumos where nombre ilike 'Leche completa' limit 1), 'Leche', 120, 'ml', 3 from r union all
select r.id, (select id from public.insumos where nombre ilike 'Vainilla' limit 1), 'Vainilla', 1, 'ml', 4 from r union all
select r.id, (select id from public.insumos where nombre ilike 'Hielo' limit 1), 'Hielo', 80, 'g', 5 from r;

with r as (
  insert into public.recetas (nombre, seccion, categoria, perfil, porciones, procedimiento, precio_sugerido_usd, notas_chef)
  values (
    'Peanut Butter Cup',
    'cafetin',
    'smoothie',
    'rich · satisfying · post-workout',
    1,
    E'1. Licuar cambur con mantequilla de maní, leche y cacao\n2. Agregar hielo y procesar\n3. Servir inmediatamente',
    8,
    'Recomendado con booster de proteína'
  ) returning id
)
insert into public.receta_ingredientes (receta_id, insumo_id, nombre, cantidad, unidad, orden)
select r.id, (select id from public.insumos where nombre ilike 'Cambur' limit 1), 'Cambur', 100, 'g', 1 from r union all
select r.id, (select id from public.insumos where nombre ilike 'Mantequilla de man%' limit 1), 'Mantequilla de maní', 50, 'g', 2 from r union all
select r.id, (select id from public.insumos where nombre ilike 'Leche completa' limit 1), 'Leche', 180, 'ml', 3 from r union all
select r.id, (select id from public.insumos where nombre ilike 'Cacao en polvo' limit 1), 'Cacao en polvo', 10, 'g', 4 from r union all
select r.id, (select id from public.insumos where nombre ilike 'Hielo' limit 1), 'Hielo', 80, 'g', 5 from r;

with r as (
  insert into public.recetas (nombre, seccion, categoria, perfil, porciones, procedimiento, precio_sugerido_usd, notas_chef)
  values (
    'Vitamina C',
    'cafetin',
    'smoothie',
    'bright · fruity · immune boost',
    1,
    E'1. Licuar fresa y mora con jugo de naranja\n2. Agregar hielo y procesar',
    6,
    'Si está muy ácido, ajustar con mango o cambur pequeño'
  ) returning id
)
insert into public.receta_ingredientes (receta_id, insumo_id, nombre, cantidad, unidad, orden)
select r.id, (select id from public.insumos where nombre ilike 'Fresa' limit 1), 'Fresa', 90, 'g', 1 from r union all
select r.id, (select id from public.insumos where nombre ilike 'Mora' limit 1), 'Mora', 60, 'g', 2 from r union all
select r.id, (select id from public.insumos where nombre ilike 'Jugo de naranja' limit 1), 'Jugo de naranja', 180, 'ml', 3 from r union all
select r.id, (select id from public.insumos where nombre ilike 'Hielo' limit 1), 'Hielo', 100, 'g', 4 from r;


-- ── COMEDOR — DESAYUNOS Y BOWLS ──────────────────────────────────

with r as (
  insert into public.recetas (nombre, seccion, categoria, porciones, tiempo_prep_min, tiempo_coccion_min, procedimiento, presentacion, variaciones)
  values (
    'Desayuno Caraqueño',
    'comedor',
    'desayuno',
    1, 10, 15,
    E'AREPA:\n1. Mezclar harina, agua y sal\n2. Reposar 5 minutos\n3. Formar arepa y cocinar en budare 5-7 min por lado\n\nHUEVOS:\n• Revueltos, fritos, pochados o perico (al gusto)\n\nPERICO (opcional):\n1. Sofreír cebolla y tomate en aceite de oliva\n2. Agregar huevos batidos y revolver\n3. Sal al gusto',
    E'• 1 Arepa (abierta o a un lado)\n• Huevos a un lado\n• Queso arepero a un lado\n• Aguacate en abanico',
    E'Aditivos opcionales: Aguacate · Ají dulce salteado · Aceite de cilantro'
  ) returning id
)
insert into public.receta_ingredientes (receta_id, insumo_id, nombre, cantidad, unidad, orden)
select r.id, (select id from public.insumos where nombre ilike 'Harina PAN' limit 1), 'Harina PAN', 80, 'g', 1 from r union all
select r.id, (select id from public.insumos where nombre ilike 'Queso arepero' limit 1), 'Queso arepero', 70, 'g', 2 from r union all
select r.id, (select id from public.insumos where nombre ilike 'Huevos' limit 1), 'Huevos', 2, 'unidad', 3 from r union all
select r.id, (select id from public.insumos where nombre ilike 'Aguacate' limit 1), 'Aguacate (opcional)', 50, 'g', 4 from r;

with r as (
  insert into public.recetas (nombre, seccion, categoria, porciones, tiempo_prep_min, tiempo_coccion_min, procedimiento, presentacion, variaciones)
  values (
    'Omelette Country',
    'comedor',
    'desayuno',
    1, 5, 8,
    E'1. Batir ligeramente huevos con leche, sal y pimienta\n2. Calentar aceite en sartén\n3. Añadir mezcla de huevos\n4. Añadir trozos de queso de cabra y tomate seco al centro\n5. Formar omelette sin sobrecocer\n6. Emplatar inmediatamente',
    E'Plato limpio · Omelette en el centro · Drizzle de aceite de oregano · Migajas de queso espolvoreadas',
    E'Acompañantes opcionales: 1 arepita · Ensalada fresca (rúcula + limón) · Aguacate'
  ) returning id
)
insert into public.receta_ingredientes (receta_id, insumo_id, nombre, cantidad, unidad, orden)
select r.id, (select id from public.insumos where nombre ilike 'Huevos' limit 1), 'Huevos', 3, 'unidad', 1 from r union all
select r.id, (select id from public.insumos where nombre ilike 'Leche completa' limit 1), 'Leche (opcional)', 10, 'ml', 2 from r union all
select r.id, (select id from public.insumos where nombre ilike 'Aceite de oliva' limit 1), 'Aceite de oliva', 5, 'ml', 3 from r;

with r as (
  insert into public.recetas (nombre, seccion, categoria, porciones, tiempo_prep_min, procedimiento, presentacion, variaciones)
  values (
    'Bowl de Yogurt',
    'comedor',
    'desayuno',
    1, 8,
    E'1. Lavar y cortar frutas en cortes limpios y uniformes\n2. Base de yogurt en bowl\n3. Capa de granola\n4. Capa de frutas frescas\n5. Topping de semillas y coco rallado\n6. Drizzle final de miel o maple',
    E'• Base de yogurt\n• Capa de granola\n• Capa de frutas\n• Topping de semillas\n• Drizzle de miel/maple',
    E'Combinaciones distintas de fruta de temporada · Añadir mantequilla de maní o almendra · Cacao nibs · Proteína · Yogurt de coco (versión vegana)'
  ) returning id
)
insert into public.receta_ingredientes (receta_id, insumo_id, nombre, cantidad, unidad, orden)
select r.id, (select id from public.insumos where nombre ilike 'Yogurt griego' limit 1), 'Yogurt griego', 200, 'g', 1 from r union all
select r.id, (select id from public.insumos where nombre ilike 'Granola' limit 1), 'Granola', 40, 'g', 2 from r union all
select r.id, (select id from public.insumos where nombre ilike 'Fresa' limit 1), 'Fresa', 45, 'g', 3 from r union all
select r.id, (select id from public.insumos where nombre ilike 'Cambur' limit 1), 'Cambur', 45, 'g', 4 from r union all
select r.id, (select id from public.insumos where nombre ilike 'Mora' limit 1), 'Mora / Arándanos / Mango', 30, 'g', 5 from r;

with r as (
  insert into public.recetas (nombre, seccion, categoria, porciones, tiempo_prep_min, tiempo_coccion_min, procedimiento, presentacion, variaciones, notas_chef)
  values (
    'Huevos Mamá',
    'comedor',
    'desayuno',
    1, 10, 8,
    E'BASE:\n1. Cortar conchas de arepa\n2. Calentar pavo\n\nHUEVOS POCHADOS (2:30 - 3 min):\n• Llevar agua con vinagre a hervir suave\n• Pochar los huevos hasta clara firme, yema líquida\n\nHOLANDESA DE AGUACATE:\n1. Licuar aguacate, jugo de limón, aceite de oliva\n2. Ajustar textura con agua tibia\n3. Salar al gusto',
    E'• 2 conchas de arepa de base\n• Pavo\n• 1 huevo pochado sobre cada arepa\n• Drizzle de holandesa de aguacate\n• Toque de flor de sal\n• Pimienta · cebollín (opcional)',
    E'Cambiar pavo por salmón ahumado u otra proteína · Versión vegetariana (sin proteína animal)',
    'La salsa holandesa debe quedar cremosa con un toque de acidez'
  ) returning id
)
insert into public.receta_ingredientes (receta_id, insumo_id, nombre, cantidad, unidad, orden)
select r.id, (select id from public.insumos where nombre ilike 'Harina PAN' limit 1), 'Harina PAN (conchas de arepa)', 80, 'g', 1 from r union all
select r.id, null, 'Pavo', 60, 'g', 2 from r union all
select r.id, (select id from public.insumos where nombre ilike 'Huevos' limit 1), 'Huevos', 2, 'unidad', 3 from r union all
select r.id, (select id from public.insumos where nombre ilike 'Aguacate' limit 1), 'Aguacate (para holandesa)', 80, 'g', 4 from r union all
select r.id, (select id from public.insumos where nombre ilike 'Aceite de oliva' limit 1), 'Aceite de oliva', 25, 'ml', 5 from r;


-- ############################################################################
-- ## cocina-stock-auditoria.sql
-- ############################################################################
-- Cocina · Auditoría de stock (M5 — trazabilidad total del inventario)
--
-- Registra AUTOMÁTICAMENTE cada cambio del stock de un insumo, sin importar
-- por dónde entre el cambio: el formulario de insumos, una compra, una venta
-- del POS, un plan de producción, una pérdida/merma… o una edición directa
-- desde el editor SQL de Supabase.
--
-- El disparador vive en la base de datos (no en la app), así que NADA se le
-- escapa. Es la red de seguridad que faltó cuando se pusieron 7 insumos en
-- cero sin dejar rastro: aquí habría quedado registrado el antes, el después,
-- el momento exacto y si vino de la app (usuario) o de un cambio directo.
--
-- Aditivo e idempotente — corre seguro varias veces.

create table if not exists public.stock_auditoria (
  id uuid primary key default gen_random_uuid(),

  -- Insumo afectado. on delete set null: si el insumo se borra, el historial
  -- sobrevive (por eso guardamos también el nombre y la unidad como snapshot).
  insumo_id uuid references public.insumos(id) on delete set null,
  insumo_nombre text not null,
  unidad_base text,

  -- Capa física (stock_actual). anterior = null cuando es un alta.
  stock_anterior numeric(14, 4),
  stock_nuevo numeric(14, 4),

  -- Capa reservada (stock_comprometido).
  comprometido_anterior numeric(14, 4),
  comprometido_nuevo numeric(14, 4),

  -- De dónde vino el cambio:
  --   'alta'    → se creó el insumo con stock inicial
  --   'app'     → cambio hecho por un usuario logueado (tiene auth.uid())
  --   'directo' → cambio SIN usuario: editor SQL de Supabase o service_role.
  --               ESTOS son los que hay que mirar con lupa.
  origen text not null default 'directo',

  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists idx_saud_insumo on public.stock_auditoria(insumo_id);
create index if not exists idx_saud_changed on public.stock_auditoria(changed_at desc);
create index if not exists idx_saud_origen on public.stock_auditoria(origen);

alter table public.stock_auditoria enable row level security;

drop policy if exists "saud_select" on public.stock_auditoria;
create policy "saud_select" on public.stock_auditoria
  for select to authenticated using (true);

-- El disparador corre como el rol que hace el UPDATE (authenticated), así que
-- necesita permiso de insert. Los cambios directos desde el editor SQL corren
-- como postgres/service_role y saltan RLS, así que también quedan registrados.
drop policy if exists "saud_insert" on public.stock_auditoria;
create policy "saud_insert" on public.stock_auditoria
  for insert to authenticated with check (true);

-- ─── Disparador ────────────────────────────────────────────────────
create or replace function public.log_stock_auditoria()
returns trigger language plpgsql as $$
declare
  v_actor uuid := auth.uid();
begin
  if (tg_op = 'INSERT') then
    -- Solo registramos el alta si nace con algo de stock.
    if coalesce(new.stock_actual, 0) <> 0
       or coalesce(new.stock_comprometido, 0) <> 0 then
      insert into public.stock_auditoria (
        insumo_id, insumo_nombre, unidad_base,
        stock_anterior, stock_nuevo,
        comprometido_anterior, comprometido_nuevo,
        origen, changed_by
      ) values (
        new.id, new.nombre, new.unidad_base,
        null, new.stock_actual,
        null, new.stock_comprometido,
        'alta', v_actor
      );
    end if;
    return new;
  end if;

  -- UPDATE: registrar solo si cambió alguna de las dos capas de stock.
  if new.stock_actual is distinct from old.stock_actual
     or coalesce(new.stock_comprometido, 0)
        is distinct from coalesce(old.stock_comprometido, 0) then
    insert into public.stock_auditoria (
      insumo_id, insumo_nombre, unidad_base,
      stock_anterior, stock_nuevo,
      comprometido_anterior, comprometido_nuevo,
      origen, changed_by
    ) values (
      new.id, new.nombre, new.unidad_base,
      old.stock_actual, new.stock_actual,
      old.stock_comprometido, new.stock_comprometido,
      case when v_actor is not null then 'app' else 'directo' end,
      v_actor
    );
  end if;

  return new;
end;
$$;

drop trigger if exists insumos_log_stock on public.insumos;
create trigger insumos_log_stock
  after insert or update on public.insumos
  for each row execute function public.log_stock_auditoria();


-- ############################################################################
-- ## cocina-stock-comprometido.sql
-- ############################################################################
-- Cocina · M5 stock 3 capas
-- Agrega stock_comprometido a insumos. Mantiene stock_actual con su nombre
-- en DB (no rompemos triggers ni código SQL existente) pero en código se
-- expone como `stockTotal`.
--
-- stockTotal       = stock_actual         (físico — solo cambia con compra/pérdida)
-- stockComprometido = stock_comprometido  (reservado por planes activos)
-- stockLibre        = stockTotal - stockComprometido (lo que alerta/pedido usan)
--
-- Aditivo, idempotente — corre seguro varias veces.

alter table public.insumos
  add column if not exists stock_comprometido numeric(12, 4) not null default 0;

-- Asegurar valor no negativo
update public.insumos
   set stock_comprometido = 0
 where stock_comprometido is null or stock_comprometido < 0;


-- ############################################################################
-- ## cocina-stock-movimientos.sql
-- ############################################################################
-- Cocina · Stock movimientos (M5 – libro de movimientos de inventario)
-- Tabla append-only que registra cada cambio en el stock de un insumo, con tipo
-- (perdida, mal_estado, merma, vencimiento, otro, ajuste, compra_recibida,
-- venta, comprometido_in, comprometido_out, plan_completado) y la capa
-- afectada (total o comprometido).
--
-- Diseñada para soportar el refactor a 3 capas (stockTotal / stockComprometido /
-- stockLibre) sin migración futura — por ahora solo usamos 'total' para
-- pérdida/merma; las otras capas se activan en sub-tareas futuras.
--
-- Aditivo, idempotente — corre seguro varias veces.

create table if not exists public.stock_movimientos (
  id uuid primary key default gen_random_uuid(),
  insumo_id uuid not null references public.insumos(id) on delete cascade,

  -- Tipo de movimiento. Texto libre para no atarse a un enum (más flexible).
  -- Valores canónicos:
  --   perdida | mal_estado | merma | vencimiento | otro
  --   ajuste            (corrección manual del stock)
  --   compra_recibida   (entrada por pedido)
  --   venta             (salida por Xetux)
  --   comprometido_in   (reserva por plan de producción)
  --   comprometido_out  (libera reserva: completado o cancelado)
  --   plan_completado   (la producción se hizo, salen ingredientes del total)
  tipo text not null,

  -- Capa afectada: 'total' (físico) o 'comprometido' (reservado).
  capa text not null default 'total',

  -- Cantidad en unidad_base del insumo. Positivo = entra, negativo = sale.
  -- (Para pérdidas/mermas guardamos cantidad negativa.)
  cantidad numeric(12, 4) not null,

  -- Para movimientos manuales (pérdida/merma/ajuste): motivo opcional libre.
  -- Útil para reportes y trazabilidad.
  motivo text,

  -- Fecha del movimiento (puede ser distinta de created_at si se registra ex-post).
  fecha date not null default current_date,

  nota text,

  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_smov_insumo on public.stock_movimientos(insumo_id);
create index if not exists idx_smov_fecha on public.stock_movimientos(fecha desc);
create index if not exists idx_smov_tipo on public.stock_movimientos(tipo);

alter table public.stock_movimientos enable row level security;

drop policy if exists "smov_select" on public.stock_movimientos;
create policy "smov_select" on public.stock_movimientos
  for select to authenticated using (true);

drop policy if exists "smov_insert" on public.stock_movimientos;
create policy "smov_insert" on public.stock_movimientos
  for insert to authenticated with check (true);

drop policy if exists "smov_update" on public.stock_movimientos;
create policy "smov_update" on public.stock_movimientos
  for update to authenticated using (true) with check (true);

drop policy if exists "smov_delete" on public.stock_movimientos;
create policy "smov_delete" on public.stock_movimientos
  for delete to authenticated using (true);


-- ############################################################################
-- ## cocina-subrecetas.sql
-- ############################################################################
-- Sub-recetas (preparaciones): salsas, mezclas, componentes que entran en otras recetas.
-- Ejemplo: "Salsa pesto" es subreceta usada en "Sandwich de pesto".

-- 1) Marcar recetas como subreceta + rendimiento
alter table public.recetas
  add column if not exists es_subreceta boolean not null default false,
  add column if not exists rendimiento numeric(12, 4),
  add column if not exists rendimiento_unidad text;

-- 2) Permitir que receta_ingredientes referencie una subreceta en vez de un insumo
alter table public.receta_ingredientes
  add column if not exists subreceta_id uuid references public.recetas(id) on delete set null;

create index if not exists idx_ri_subreceta on public.receta_ingredientes(subreceta_id);

-- 3) 4) 5) flatten_receta_insumos / descontar / revertir  →  MOVIDAS (A5, dedupe)
-- Estas eran las versiones ORIGINALES (sin conversión de unidades, sin factor de
-- porciones de subreceta, y descontar solo manejaba receta). Las canónicas y
-- completas están en cocina-zzz-motor-canonico.sql. Aquí quedan solo las
-- COLUMNAS de arriba (es_subreceta / rendimiento / subreceta_id), esenciales.


-- ############################################################################
-- ## cocina-ventas.sql
-- ############################################################################
-- Fase 4 — M5 Inventario, ventas y pedidos
-- Cierra el ciclo: venta → descuenta stock automáticamente.

-- 1) Alias de Xetux en recetas (para matchear con el export del POS)
alter table public.recetas
  add column if not exists xetux_nombre text;
create index if not exists idx_recetas_xetux_nombre on public.recetas(xetux_nombre);

-- 2) VENTAS — cada línea representa unidades vendidas de una receta
create table if not exists public.ventas (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  receta_id uuid references public.recetas(id) on delete set null,
  receta_nombre text not null,
  cantidad numeric(12, 4) not null,
  precio_unitario_usd numeric(10, 4),
  total_usd numeric(12, 4),
  fuente text not null default 'manual',  -- 'manual' | 'xetux_csv' | 'xetux_api'
  batch_id uuid,                            -- agrupa import del mismo cierre diario
  notas text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_ventas_fecha on public.ventas(fecha desc);
create index if not exists idx_ventas_receta on public.ventas(receta_id, fecha desc);
create index if not exists idx_ventas_batch on public.ventas(batch_id);

alter table public.ventas enable row level security;

drop policy if exists "ventas_select" on public.ventas;
create policy "ventas_select" on public.ventas
  for select to authenticated using (true);
drop policy if exists "ventas_insert" on public.ventas;
create policy "ventas_insert" on public.ventas
  for insert to authenticated with check (true);
drop policy if exists "ventas_update" on public.ventas;
create policy "ventas_update" on public.ventas
  for update to authenticated using (true) with check (true);
drop policy if exists "ventas_delete" on public.ventas;
create policy "ventas_delete" on public.ventas
  for delete to authenticated using (true);

-- 3) Trigger: al insertar venta, descontar stock de cada ingrediente
-- Factor = cantidad_vendida / porciones_de_la_receta
-- (si receta rinde 5 porciones y se vendieron 10 unidades, factor = 2,
--  se descuenta 2× la cantidad de cada ingrediente)
create or replace function public.descontar_stock_por_venta()
returns trigger language plpgsql as $$
declare
  r record;
  porciones_receta int;
  factor numeric;
begin
  if new.receta_id is null then return new; end if;

  select porciones into porciones_receta
  from public.recetas where id = new.receta_id;

  if porciones_receta is null or porciones_receta = 0 then return new; end if;

  factor := new.cantidad / porciones_receta::numeric;

  for r in (
    select ri.insumo_id, ri.cantidad
    from public.receta_ingredientes ri
    where ri.receta_id = new.receta_id and ri.insumo_id is not null
  ) loop
    update public.insumos
    set stock_actual = greatest(0, stock_actual - (r.cantidad * factor))
    where id = r.insumo_id;
  end loop;

  return new;
end;
$$;

drop trigger if exists venta_decrement_stock on public.ventas;
create trigger venta_decrement_stock
  after insert on public.ventas
  for each row execute function public.descontar_stock_por_venta();

-- 4) Si se elimina una venta, devolver el stock (compensación inversa)
create or replace function public.revertir_stock_por_venta()
returns trigger language plpgsql as $$
declare
  r record;
  porciones_receta int;
  factor numeric;
begin
  if old.receta_id is null then return old; end if;
  select porciones into porciones_receta from public.recetas where id = old.receta_id;
  if porciones_receta is null or porciones_receta = 0 then return old; end if;
  factor := old.cantidad / porciones_receta::numeric;
  for r in (
    select ri.insumo_id, ri.cantidad
    from public.receta_ingredientes ri
    where ri.receta_id = old.receta_id and ri.insumo_id is not null
  ) loop
    update public.insumos
    set stock_actual = stock_actual + (r.cantidad * factor)
    where id = r.insumo_id;
  end loop;
  return old;
end;
$$;

drop trigger if exists venta_revert_stock on public.ventas;
create trigger venta_revert_stock
  after delete on public.ventas
  for each row execute function public.revertir_stock_por_venta();


-- ############################################################################
-- ## ingresos-efectivo-unificado.sql
-- ############################################################################
-- Unir "Dólar" (efectivo USD) y "Efectivo" bajo una sola etiqueta "Efectivo" en
-- los ingresos ya cargados. Solo cambia el CONCEPTO (la etiqueta visible). El
-- campo `metodo` crudo NO se toca, para que el IVA siga correcto (los "Dólar"
-- siguen exentos vía la config metodos_sin_iva; ver separaIva). El monto y el iva
-- de cada ingreso quedan intactos.
update public.admin_ingreso
set concepto = 'Ventas Efectivo'
where fuente = 'setux'
  and lower(btrim(concepto)) in ('ventas dólar', 'ventas dolar');


-- ############################################################################
-- ## insumos-categorias-limpieza.sql
-- ############################################################################
-- Limpieza de categorías de INSUMO (Fase A del reordenamiento de categorías).
-- El catálogo de Insumos (Cocina) usa ahora insumos.categoria_compra (tipo de
-- materia prima), separado de las categorías de venta de Administración.
-- Este SQL deja categoria_compra y la lista categoria_insumo limpias.
-- NO toca Administración (categoria_producto / admin_categoria) ni Recetario.

-- 1) Remapear valores colados/duplicados a los tipos limpios.
update public.insumos set categoria_compra = 'Bebidas'
  where categoria_compra = 'Bebidas frías embotelladas/enlatadas';
-- Bebidas naturales: coco frío + jugos ya exprimidos (son insumos, no reventa).
update public.insumos set categoria_compra = 'Bebidas naturales'
  where nombre in ('COCO FRIO', 'JUGO DE NARANJA', 'JUGO DE LIMON');
update public.insumos set categoria_compra = 'Café & Té'
  where categoria_compra = 'Café y té';
update public.insumos set categoria_compra = 'Postres y Snacks'
  where categoria_compra in ('Postres', 'Snacks');
update public.insumos set categoria_compra = 'Panadería'
  where categoria_compra = 'Panadería y harinas';
update public.insumos set categoria_compra = 'Proteínas'
  where categoria_compra = 'Adicionales/Extras';
-- Gatorade (todas las variantes) son bebidas.
update public.insumos set categoria_compra = 'Bebidas'
  where nombre like 'GATORADE%';
-- Suplementos: proteína / colágeno en polvo.
update public.insumos set categoria_compra = 'Suplementos'
  where nombre in ('COLAGENO', 'PROTEINA (ISO 100 DYMATIZE)');

-- 2) Clasificar los ex-"Otros" (los que la cascada mandó a "Alquileres fijos").
update public.insumos set categoria_compra = 'Granos y Cereales'
  where nombre in ('ARROZ ARBORIO', 'ARROZ BASMATI');
update public.insumos set categoria_compra = 'Endulzantes'
  where nombre in ('AZUCAR BLANCA (EN SOBRE)', 'AZUCAR BLANCA (KG)', 'SPLENDA');
update public.insumos set categoria_compra = 'Condimentos & Especias'
  where nombre in ('SAL (FINA)', 'BICARBONATO');

-- 3) Lista limpia de categorías de insumo (opciones del catálogo y del gestor
--    "Clasificar insumos"). Se reconstruye para quitar coladas/dups. Sin FK:
--    los insumos guardan el NOMBRE, así que rehacer esta lista es seguro.
delete from public.categoria_insumo;
insert into public.categoria_insumo (nombre, orden) values
  ('Café & Té', 10),
  ('Lácteos', 20),
  ('Frutas & Vegetales', 30),
  ('Panadería', 40),
  ('Proteínas', 50),
  ('Suplementos', 55),
  ('Salsas & Aderezos', 60),
  ('Bebidas', 70),
  ('Bebidas Alcohólicas', 80),
  ('Bebidas naturales', 90),
  ('Condimentos & Especias', 100),
  ('Endulzantes', 110),
  ('Granos y Cereales', 120),
  ('Semillas y Nueces', 130),
  ('Congelados', 140),
  ('Desechables', 150),
  ('Postres y Snacks', 160)
on conflict do nothing;


-- ############################################################################
-- ## inventario-mobiliario-seed.sql
-- ############################################################################
-- Mobiliario de alquiler — seed inicial
-- Carga el inventario de mesas, sillas, combos y paneles que tiene
-- Quinta Mamá para ofrecer a clientes en eventos.
--
-- Idempotente: solo inserta si el nombre no existe todavía. Re-corre
-- sin duplicar.

with nuevos (nombre, categoria, cantidad_disponible, precio_alquiler_usd, descripcion) as (
  values
    -- ── Mesas individuales ────────────────────────────────────
    ('1 mesa redonda',                 'Mesas',   1::int, 20.00::numeric, null::text),
    ('Mesa redonda de madera',         'Mesas',   1,      25.00,           null),

    -- ── Sillas (lotes completos) ──────────────────────────────
    ('10 sillas altas',                'Sillas',  1,      50.00,           'Lote completo de 10 sillas altas'),
    ('22 sillas marrones',             'Sillas',  1,     100.00,           'Lote completo de 22 sillas marrones'),
    ('36 sillas blancas',              'Sillas',  1,     150.00,           'Lote completo de 36 sillas blancas'),

    -- ── Combos (mesa + sillas) ────────────────────────────────
    ('1 mesa coctelera con 5 sillas altas',                'Combos',  1, 25.00,  'Combo: 1 mesa coctelera + 5 sillas altas'),
    ('Combo 2 mesas cocteleras con 10 sillas altas',       'Combos',  1, 50.00,  'Combo: 2 mesas cocteleras + 10 sillas altas'),
    ('Combo 5 mesas redondas con 22 sillas marrones',      'Combos',  1, 150.00, 'Combo: 5 mesas redondas + 22 sillas marrones'),

    -- ── Paneles ───────────────────────────────────────────────
    ('Paneles móviles',                'Paneles', 1,      20.00,           null)
)
insert into public.inventario_alquiler
  (nombre, categoria, cantidad_disponible, precio_alquiler_usd, descripcion, estado, activo)
select
  n.nombre,
  n.categoria,
  n.cantidad_disponible,
  n.precio_alquiler_usd,
  n.descripcion,
  'disponible',
  true
from nuevos n
where not exists (
  select 1 from public.inventario_alquiler ia where ia.nombre = n.nombre
);


-- ############################################################################
-- ## presupuestos-evento-logistica.sql
-- ############################################################################
-- Presupuestos — campos de logística del evento
-- Ejecuta este SQL en: Supabase → SQL Editor → New query
-- Aditivo e idempotente: NO toca datos existentes.
--
-- Agrega:
--   cantidad_personas  → nº de personas esperadas en el evento
--   montaje_fecha/hora → fecha y horario de montaje (T&C del PDF)
--   desmontaje_fecha/hora → fecha y horario de desmontaje (T&C del PDF)
-- Si montaje/desmontaje quedan en NULL, el PDF cae a la fecha/hora del evento.

alter table public.presupuestos
  add column if not exists cantidad_personas int,
  add column if not exists montaje_fecha date,
  add column if not exists montaje_hora text,
  add column if not exists desmontaje_fecha date,
  add column if not exists desmontaje_hora text;


-- ############################################################################
-- ## presupuestos-versiones.sql
-- ############################################################################
-- Presupuestos · Historial de versiones
-- Cada vez que se edita un presupuesto, guardamos un snapshot completo del
-- estado anterior antes de aplicar los cambios. Así dentro del mismo
-- presupuesto se ve cómo fue evolucionando — qué se ofreció antes, por qué
-- el cliente lo rechazó o pidió cambios, etc.
--
-- Snapshot guardado como JSONB: incluye cabecera + items completos.
-- Aditivo, idempotente.

create table if not exists public.presupuestos_versiones (
  id uuid primary key default gen_random_uuid(),
  presupuesto_id uuid not null references public.presupuestos(id) on delete cascade,
  version_numero int not null,         -- 1, 2, 3, ... orden cronológico
  snapshot jsonb not null,             -- {cabecera, items[]} de cómo estaba antes del cambio
  motivo text,                         -- opcional: por qué se editó (rechazo, ajuste, etc.)
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_pv_pres on public.presupuestos_versiones(presupuesto_id);
create index if not exists idx_pv_fecha on public.presupuestos_versiones(created_at desc);

alter table public.presupuestos_versiones enable row level security;

drop policy if exists "pv_select" on public.presupuestos_versiones;
create policy "pv_select" on public.presupuestos_versiones
  for select to authenticated using (true);

drop policy if exists "pv_insert" on public.presupuestos_versiones;
create policy "pv_insert" on public.presupuestos_versiones
  for insert to authenticated with check (true);

drop policy if exists "pv_delete" on public.presupuestos_versiones;
create policy "pv_delete" on public.presupuestos_versiones
  for delete to authenticated using (true);

-- Constraint útil: el (presupuesto_id, version_numero) debe ser único
create unique index if not exists uk_pv_pres_version
  on public.presupuestos_versiones(presupuesto_id, version_numero);


-- ############################################################################
-- ## rubro-administrativo.sql
-- ############################################################################
-- Rollup administrativo: agrupar categorías en un "rubro" solo para el análisis
-- de Administración. En Recetas/Cocina cada categoría se sigue usando tal cual.
-- Primer rubro: Smoothies + Bebidas naturales → "Smoothies y Bebidas Naturales".
-- (El índice único de categoria_producto es case-insensitive; todo va con lower().)

-- 1) Columna nueva (nullable). null = la categoría no se agrupa (se muestra sola).
alter table public.categoria_producto add column if not exists rubro text;

-- 2) "Bebidas naturales" ya existe como categoría de venta → no se inserta.

-- 3) Asignar el rubro a las dos categorías que se aglomeran en Admin.
update public.categoria_producto
set rubro = 'Smoothies y Bebidas Naturales'
where lower(nombre) in ('smoothies', 'bebidas naturales');

-- 4) Arreglo de dato: el coco frío es reventa "Bebidas naturales", no Smoothies.
--    Usa el nombre EXACTO de la categoría existente (respeta sus mayúsculas).
update public.insumos set categoria = (
  select nombre from public.categoria_producto where lower(nombre) = 'bebidas naturales' limit 1
)
where categoria = 'Smoothies' and nombre ilike '%coco fr%';
update public.recetas set categoria = (
  select nombre from public.categoria_producto where lower(nombre) = 'bebidas naturales' limit 1
)
where categoria = 'Smoothies' and nombre ilike '%coco fr%';


-- ############################################################################
-- ## rubros-reventa-rename.sql
-- ############################################################################
-- Renombrar los rubros de reventa (ingresos) para alinearlos con las categorías
-- de insumo ya limpias. Cascada a categoria_producto + recetas + insumos.
-- Estas categorías son de VENTA (aplica_receta = false); solo cambian de nombre.

-- Adicionales/extras bebidas → Suplementos (igual que en insumos).
update public.categoria_producto set nombre = 'Suplementos' where nombre = 'Adicionales/extras bebidas';
update public.recetas             set categoria = 'Suplementos' where categoria = 'Adicionales/extras bebidas';
update public.insumos             set categoria = 'Suplementos' where categoria = 'Adicionales/extras bebidas';

-- Bebidas frías embotelladas/enlatadas → Bebidas (como quedó el tipo de insumo).
update public.categoria_producto set nombre = 'Bebidas' where nombre = 'Bebidas frías embotelladas/enlatadas';
update public.recetas             set categoria = 'Bebidas' where categoria = 'Bebidas frías embotelladas/enlatadas';
update public.insumos             set categoria = 'Bebidas' where categoria = 'Bebidas frías embotelladas/enlatadas';


-- ############################################################################
-- ## ventas-fix-totales-xetux.sql
-- ############################################################################
-- Corrección de totales de ventas importadas de Xetux.
--
-- CONTEXTO / LECCIÓN APRENDIDA
-- Los exports de Xetux NO son uniformes: unos traen la columna de dinero como
-- TOTAL de línea (venta neta) y otros como PRECIO UNITARIO. El importador viejo
-- asumía siempre precio unitario y multiplicaba por la cantidad → inflaba los
-- que en realidad ya eran totales. Al corregir, NO se puede asumir que TODOS
-- estaban inflados: hay que mirar import por import (batch_id) y comparar la
-- suma contra el TOTAL GENERAL del reporte.
--
-- El importador ya se blindó (el usuario elige "total de línea" vs "precio
-- unitario" con vista previa), así que esto no debería repetirse.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 0 · Diagnóstico: suma por import vs TOTAL GENERAL del PDF.
select fecha, batch_id, count(*) as items,
       round(sum(total_usd)::numeric, 2) as suma_total
from ventas
where fuente = 'xetux_csv'
group by fecha, batch_id
order by fecha;

-- ─────────────────────────────────────────────────────────────────────────────
-- CASO A · Import cuya columna era TOTAL de línea y quedó inflado (total =
-- cantidad × venta_neta). Deja total = venta neta y precio = venta neta ÷ cant.
-- Idempotente por el marcador en notas. Reemplaza <BATCH_INFLADO> por el batch.
--
-- update ventas
-- set total_usd           = precio_unitario_usd,
--     precio_unitario_usd = round((precio_unitario_usd / cantidad)::numeric, 4),
--     notas               = trim(coalesce(notas, '') || ' [total corregido]')
-- where batch_id = '<BATCH_INFLADO>'
--   and cantidad > 1
--   and precio_unitario_usd is not null
--   and coalesce(notas, '') not like '%[total corregido]%';

-- ─────────────────────────────────────────────────────────────────────────────
-- CASO B · Import que YA estaba bien (columna era precio unitario) pero se le
-- aplicó el CASO A de más → quedó dividido. Restaura multiplicando de vuelta.
-- Reemplaza <BATCH_BIEN> por el batch afectado.
--
-- update ventas
-- set total_usd           = round((total_usd * cantidad)::numeric, 4),
--     precio_unitario_usd = total_usd,   -- (usa el total_usd viejo = precio unit.)
--     notas               = trim(replace(notas, '[total corregido]', '[restaurado]'))
-- where batch_id = '<BATCH_BIEN>'
--   and cantidad > 1
--   and coalesce(notas, '') like '%[total corregido]%';

-- Verificación final: cada batch debe cuadrar con el TOTAL GENERAL de su PDF.
-- select batch_id, round(sum(total_usd)::numeric, 2)
-- from ventas where fuente = 'xetux_csv' group by batch_id;


-- ############################################################################
-- ## admin-cxc-asignaciones.sql
-- ############################################################################
-- Administración · CXC: un cobro puede aplicarse a NE específicas
-- Guardamos en cada pago a qué cuentas (NE) se aplicó y cuánto a cada una,
-- para poder cobrar solo algunas cuentas (total o parcialmente) y calcular el
-- saldo restante por cuenta. Formato: [{cuenta_id, ref, eur, usd}, ...]
alter table public.admin_cxc_pago add column if not exists asignaciones jsonb;


-- ############################################################################
-- ## admin-cxc-incobrable.sql
-- ############################################################################
-- Administración · CXC incobrable (write-off / pérdida)
-- Cuando a un cliente no se le puede cobrar una cuenta, se marca como
-- INCOBRABLE: sale del saldo por cobrar y se asume como PÉRDIDA para la empresa
-- (se registra un egreso categoría "Incobrables"). Reversible.
alter table public.admin_cuenta_cobrar
  add column if not exists incobrable boolean not null default false;
alter table public.admin_cuenta_cobrar
  add column if not exists fecha_incobrable date;
-- Egreso (pérdida) generado al marcarla incobrable, para poder revertir.
alter table public.admin_cuenta_cobrar
  add column if not exists incobrable_egreso_id uuid references public.admin_egreso(id) on delete set null;

create index if not exists idx_admin_cxc_incobrable
  on public.admin_cuenta_cobrar (incobrable, fecha);


-- ############################################################################
-- ## admin-cxc-rpp-iva.sql
-- ############################################################################
-- IVA por registro en CXC y RPP (cortesías).
-- El importador por factura guarda las CXC y las cortesías en BRUTO (el "Total
-- Venta" del reporte = lo que el cliente realmente paga). Para conciliar con
-- Cocina —que va en NETO— se guarda además el IVA de cada registro, y así el
-- neto = monto − iva es EXACTO (no un ÷1+IVA aproximado que falla en facturas
-- con 0 IVA, como alquileres). Idempotente.
alter table public.admin_cuenta_cobrar add column if not exists iva numeric(16,2);
alter table public.admin_egreso        add column if not exists iva numeric(16,2);


-- ############################################################################
-- ## admin-egreso-flete.sql
-- ############################################################################
-- Flete / delivery en egresos admin. Se anota en la misma moneda del egreso y
-- SE SUMA al monto (igual que en las compras de Cocina). `monto` guarda el total
-- (bienes + flete) y `flete` la porción de flete, para poder desglosarla.
-- Idempotente. Filas existentes: flete null (no tenían flete).
alter table public.admin_egreso add column if not exists flete numeric(16,2);


-- ############################################################################
-- ## admin-egreso-fuente.sql
-- ############################################################################
-- Administración · Origen del egreso (para egresos automáticos de Setux, p. ej. RPP)
-- Permite distinguir los egresos creados por la importación de Setux y poder
-- reemplazarlos al re-importar el mismo día (igual que ingresos y cuentas).
alter table public.admin_egreso
  add column if not exists fuente text;  -- null = manual | 'setux' = importado

create index if not exists idx_admin_egreso_fuente_fecha
  on public.admin_egreso (fuente, fecha) where fuente is not null;

-- Categoría para las cortesías (RPP). No pisa las existentes.
insert into public.admin_categoria (nombre, clasificacion) values
  ('Cortesías','variable')
on conflict do nothing;


-- ############################################################################
-- ## admin-egreso-pagada.sql
-- ############################################################################
-- Estado de pago en egresos admin → habilita "cuentas por pagar" manuales.
-- Un egreso con pagada=false es una CUENTA POR PAGAR (aún no salió el dinero):
-- no cuenta en el total de egresos (caja real) hasta que se marca pagada.
-- Las compras de Cocina ya tienen su propio `pagada` (cocina-compra-pago-diferido).
-- Idempotente. Las filas existentes quedan pagada=true (ya eran gasto real).
alter table public.admin_egreso
  add column if not exists pagada boolean not null default true,
  add column if not exists fecha_pago date;

create index if not exists idx_admin_egreso_por_pagar
  on public.admin_egreso(pagada) where pagada = false;


-- ############################################################################
-- ## categorias-receta-aplica.sql
-- ############################################################################
-- Pieza 1 del reordenamiento de categorías del Recetario.
-- Las categorías de RECETA son un subconjunto de la taxonomía de ventas
-- (categoria_producto): se marcan con aplica_receta. El Recetario muestra solo
-- las marcadas; Administración/Ventas sigue viendo TODAS. No se borra ninguna
-- categoría de venta.

-- 1) Columna nueva.
alter table public.categoria_producto
  add column if not exists aplica_receta boolean not null default false;

-- 2) Renombrar a los nombres definitivos, con cascada a recetas e insumos
--    (para no perder su clasificación).
update public.categoria_producto set nombre = 'Smoothies' where nombre = 'Smoothies y jugos naturales';
update public.recetas             set categoria = 'Smoothies' where categoria = 'Smoothies y jugos naturales';
update public.insumos             set categoria = 'Smoothies' where categoria = 'Smoothies y jugos naturales';

update public.categoria_producto set nombre = 'Sándwiches' where nombre = 'Sándwich';
update public.recetas             set categoria = 'Sándwiches' where categoria in ('Sándwich', 'sandwich');
update public.insumos             set categoria = 'Sándwiches' where categoria in ('Sándwich', 'sandwich');

update public.categoria_producto set nombre = 'Postres y Snacks' where nombre = 'Postres';
update public.recetas             set categoria = 'Postres y Snacks' where categoria = 'Postres';
update public.insumos             set categoria = 'Postres y Snacks' where categoria = 'Postres';

update public.categoria_producto set nombre = 'Bebidas Alcohólicas' where nombre = 'Bebidas alchólicas';
update public.recetas             set categoria = 'Bebidas Alcohólicas' where categoria = 'Bebidas alchólicas';
update public.insumos             set categoria = 'Bebidas Alcohólicas' where categoria = 'Bebidas alchólicas';

-- 3) Categorías de receta nuevas (aún sin recetas; se llenarán después).
insert into public.categoria_producto (nombre, orden, aplica_receta) values
  ('Desayunos', 300, true),
  ('Bowls', 310, true),
  ('Platos Fuertes', 320, true)
on conflict do nothing;

-- 4) Marcar las 9 categorías de RECETA. El resto queda en false (solo Ventas):
--    Bebidas frías…, Adicionales/extras bebidas, Pádel, Alquileres fijos,
--    Eventos…, Bar of mix, Cocina clandestina.
update public.categoria_producto set aplica_receta = true
  where nombre in (
    'Café y té', 'Smoothies', 'Sándwiches', 'Pasapalos', 'Postres y Snacks',
    'Bebidas Alcohólicas', 'Desayunos', 'Bowls', 'Platos Fuertes'
  );
update public.categoria_producto set aplica_receta = false
  where nombre in (
    'Bebidas frías embotelladas/enlatadas', 'Adicionales/extras bebidas', 'Pádel',
    'Alquileres fijos', 'Eventos y alquileres por bloque',
    'Bar of mix (consignación)', 'Cocina clandestina (consignación)'
  );


-- ############################################################################
-- ## cocina-fix-receta-ingredientes-columns.sql
-- ############################################################################
-- Cocina · Fix columnas faltantes en receta_ingredientes
-- El código asume `costo_manual_usd` (precio ad-hoc) y `subreceta_id` (referencia
-- a una subreceta como ingrediente). Si faltan, el insert de ingredientes falla
-- y la receta se guarda sin ingredientes.
--
-- Idempotente — corre seguro.

alter table public.receta_ingredientes
  add column if not exists costo_manual_usd numeric(12, 6);

alter table public.receta_ingredientes
  add column if not exists subreceta_id uuid references public.recetas(id) on delete set null;

create index if not exists idx_ri_subreceta on public.receta_ingredientes(subreceta_id);

-- Asegurar también las columnas de subreceta en la tabla recetas
alter table public.recetas
  add column if not exists es_subreceta boolean not null default false,
  add column if not exists rendimiento numeric(12, 4),
  add column if not exists rendimiento_unidad text;


-- ############################################################################
-- ## cocina-mermas-produccion.sql
-- ############################################################################
-- Cocina · M5 — Merma de producción (pérdida interna de algo pre-producido)
-- ════════════════════════════════════════════════════════════════
-- Permite registrar que una ración (o varias) de una receta pre-producida
-- (ej. falafels congelados) se perdió por un fallo interno (falla de freidora,
-- quemado, contaminación, etc.) — NO una venta.
--
-- Diseño: la merma se inserta por el MISMO carril que las ventas, con la marca
-- `es_merma = true`. Así reutiliza los triggers ya probados que:
--   - descuentan del stock los insumos de la receta (flatten_receta_insumos,
--     incluye subrecetas), y
--   - liberan el compromiso de los planes de producción (cascada FIFO).
-- Pero al estar marcada como merma:
--   - no lleva precio (sin ingresos), y
--   - el código la excluye de los reportes/historial de venta (listVentas
--     filtra es_merma = false; listMermas trae solo es_merma = true).
--
-- No requiere cambios en los triggers (ya disparan en cualquier insert/delete
-- de ventas). Borrar una merma revierte stock y re-compromete, igual que
-- deshacer una venta.
--
-- Aditivo, idempotente.

alter table public.ventas
  add column if not exists es_merma boolean not null default false,
  add column if not exists merma_motivo text;

create index if not exists idx_ventas_es_merma on public.ventas(es_merma);


-- ############################################################################
-- ## cocina-pedidos-guardados.sql
-- ############################################################################
-- Cocina · Pedidos guardados
-- Permite guardar un pedido sugerido (con sus recetas y raciones) para
-- recuperarlo después, marcarlo como comprado, o usarlo como recordatorio
-- de qué hay que preparar para una fecha específica.
--
-- Aditivo, idempotente — se puede correr varias veces sin romper nada.

-- ════════════════════════════════════════════════════════════════
-- 1. HEADER: cabecera del pedido
-- ════════════════════════════════════════════════════════════════
create table if not exists public.cocina_pedidos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,                     -- ej "Pedido evento 28 may"
  fecha_necesaria date,                     -- fecha objetivo del pedido
  nota text,
  estado text not null default 'pendiente', -- pendiente | comprado | cancelado
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_cocina_pedidos_fecha
  on public.cocina_pedidos(fecha_necesaria);
create index if not exists idx_cocina_pedidos_estado
  on public.cocina_pedidos(estado);

alter table public.cocina_pedidos enable row level security;

drop policy if exists "cp_select" on public.cocina_pedidos;
create policy "cp_select" on public.cocina_pedidos
  for select to authenticated using (true);
drop policy if exists "cp_insert" on public.cocina_pedidos;
create policy "cp_insert" on public.cocina_pedidos
  for insert to authenticated with check (true);
drop policy if exists "cp_update" on public.cocina_pedidos;
create policy "cp_update" on public.cocina_pedidos
  for update to authenticated using (true) with check (true);
drop policy if exists "cp_delete" on public.cocina_pedidos;
create policy "cp_delete" on public.cocina_pedidos
  for delete to authenticated using (true);

drop trigger if exists cp_set_updated on public.cocina_pedidos;
create trigger cp_set_updated
  before update on public.cocina_pedidos
  for each row execute function public.set_updated_at();

-- ════════════════════════════════════════════════════════════════
-- 2. LÍNEAS: las recetas + raciones del pedido (objetivos)
-- ════════════════════════════════════════════════════════════════
-- on delete set null en receta_id: si se borra una receta del catálogo,
-- no perdemos el pedido entero; queda como línea huérfana con receta_nombre.
create table if not exists public.cocina_pedidos_recetas (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.cocina_pedidos(id) on delete cascade,
  receta_id uuid references public.recetas(id) on delete set null,
  receta_nombre text not null,              -- snapshot del nombre al guardar
  raciones numeric(10, 2) not null default 0,
  orden int not null default 0
);

create index if not exists idx_cp_recetas_pedido
  on public.cocina_pedidos_recetas(pedido_id);

alter table public.cocina_pedidos_recetas enable row level security;

drop policy if exists "cpr_select" on public.cocina_pedidos_recetas;
create policy "cpr_select" on public.cocina_pedidos_recetas
  for select to authenticated using (true);
drop policy if exists "cpr_insert" on public.cocina_pedidos_recetas;
create policy "cpr_insert" on public.cocina_pedidos_recetas
  for insert to authenticated with check (true);
drop policy if exists "cpr_update" on public.cocina_pedidos_recetas;
create policy "cpr_update" on public.cocina_pedidos_recetas
  for update to authenticated using (true) with check (true);
drop policy if exists "cpr_delete" on public.cocina_pedidos_recetas;
create policy "cpr_delete" on public.cocina_pedidos_recetas
  for delete to authenticated using (true);


-- ############################################################################
-- ## cocina-perdida-stock-atomica.sql
-- ############################################################################
-- Cocina · Descuento/reposición de stock por pérdida de forma ATÓMICA
-- ════════════════════════════════════════════════════════════════
-- Antes, `registrarPerdida` y `deleteMovimiento(devolverStock)` hacían un
-- read-modify-write DESDE EL CLIENTE: SELECT stock_actual → restar en JS →
-- UPDATE con el valor absoluto. Si entre el SELECT y el UPDATE ocurría otro
-- cambio (ej. un import de Xetux que baja el stock por trigger, otra pérdida,
-- o una compra), ese cambio se PERDÍA (lost update): el UPDATE con valor
-- absoluto pisaba lo que había pasado en el medio.
--
-- Estas dos funciones hacen el ajuste DENTRO de Postgres, con el patrón atómico
-- `stock_actual = stock_actual - x` bajo lock de fila (igual que los triggers de
-- venta/compra). Además insertan/borran el movimiento en la MISMA transacción,
-- así nunca queda un movimiento huérfano si el ajuste de stock falla.
--
-- security invoker → respetan la RLS del usuario (mismos permisos que hoy).
-- Idempotente (create or replace).

-- ─── Registrar una pérdida/merma (capa 'total') ─────────────────────────
create or replace function public.registrar_perdida_stock(
  p_insumo_id uuid,
  p_tipo text,
  p_cantidad numeric,        -- POSITIVA: magnitud de la pérdida
  p_motivo text default null,
  p_fecha date default null,
  p_nota text default null
)
returns table (
  id uuid,
  insumo_id uuid,
  tipo text,
  capa text,
  cantidad numeric,
  motivo text,
  fecha date,
  nota text,
  created_at timestamptz,
  stock_nuevo numeric
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_nuevo numeric;
  v_mov public.stock_movimientos%rowtype;
begin
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor a 0.';
  end if;

  -- Descuento ATÓMICO (bajo lock de fila). Nunca lee-modifica-escribe en cliente.
  update public.insumos
     set stock_actual = greatest(0, coalesce(stock_actual, 0) - p_cantidad)
   where insumos.id = p_insumo_id
   returning stock_actual into v_nuevo;
  if not found then
    raise exception 'Insumo no encontrado';
  end if;

  -- El movimiento se guarda en NEGATIVO (capa 'total'), en la misma transacción.
  insert into public.stock_movimientos
    (insumo_id, tipo, capa, cantidad, motivo, fecha, nota)
  values
    (p_insumo_id, p_tipo, 'total', -abs(p_cantidad), p_motivo,
     coalesce(p_fecha, current_date), p_nota)
  returning * into v_mov;

  return query
    select v_mov.id, v_mov.insumo_id, v_mov.tipo, v_mov.capa, v_mov.cantidad,
           v_mov.motivo, v_mov.fecha, v_mov.nota, v_mov.created_at, v_nuevo;
end;
$$;

-- ─── Borrar un movimiento, opcionalmente devolviendo el stock ───────────
-- p_devolver = true  → repone al stock físico (solo capa 'total') y borra.
-- p_devolver = false → solo borra el movimiento, sin tocar el stock.
-- Devuelve el nuevo stock físico si hubo reposición, o NULL si no.
create or replace function public.borrar_movimiento_stock(
  p_id uuid,
  p_devolver boolean default false
)
returns numeric
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_insumo uuid;
  v_capa   text;
  v_cant   numeric;
  v_nuevo  numeric := null;
begin
  select insumo_id, capa, cantidad
    into v_insumo, v_capa, v_cant
    from public.stock_movimientos
   where id = p_id;
  if not found then
    raise exception 'Movimiento no encontrado';
  end if;

  -- Revertir = deshacer el delta. Como la pérdida se guardó en negativo,
  -- restar la cantidad (negativa) la SUMA de vuelta al stock. Atómico.
  if p_devolver and v_capa = 'total' and coalesce(v_cant, 0) <> 0 then
    update public.insumos
       set stock_actual = greatest(0, coalesce(stock_actual, 0) - v_cant)
     where id = v_insumo
     returning stock_actual into v_nuevo;
  end if;

  delete from public.stock_movimientos where id = p_id;
  return v_nuevo;
end;
$$;


-- ############################################################################
-- ## cocina-planes-produccion.sql
-- ############################################################################
-- Cocina · M5 Planes de producción
-- Permite reservar stock por adelantado para producciones planificadas.
--
-- Flujo:
--   1. Usuario crea plan (receta + raciones + fecha objetivo)
--   2. Sistema calcula ingredientes (con expansión de subrecetas) en TS y
--      llama a create_plan_produccion con los compromisos pre-calculados
--   3. RPC inserta plan + compromisos + suma stock_comprometido + registra
--      movimientos 'comprometido_in' atomicamente
--   4. Cuando se "completa" el plan → baja stock_total + libera comprometido
--   5. Cuando se "cancela" → solo libera comprometido (no afecta total)
--   6. Al borrar un plan pendiente → libera automáticamente
--
-- Aditivo, idempotente.

-- ════════════════════════════════════════════════════════════════
-- 1. HEADER del plan
-- ════════════════════════════════════════════════════════════════
create table if not exists public.cocina_planes_produccion (
  id uuid primary key default gen_random_uuid(),
  receta_id uuid not null references public.recetas(id) on delete restrict,
  receta_nombre text not null,      -- snapshot por si se borra la receta
  raciones numeric(10, 2) not null,
  fecha_objetivo date,
  nota text,
  estado text not null default 'pendiente',  -- pendiente | completado | cancelado
  completado_at timestamptz,
  cancelado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_planes_estado on public.cocina_planes_produccion(estado);
create index if not exists idx_planes_fecha on public.cocina_planes_produccion(fecha_objetivo);

alter table public.cocina_planes_produccion enable row level security;

drop policy if exists "pln_select" on public.cocina_planes_produccion;
create policy "pln_select" on public.cocina_planes_produccion
  for select to authenticated using (true);
drop policy if exists "pln_insert" on public.cocina_planes_produccion;
create policy "pln_insert" on public.cocina_planes_produccion
  for insert to authenticated with check (true);
drop policy if exists "pln_update" on public.cocina_planes_produccion;
create policy "pln_update" on public.cocina_planes_produccion
  for update to authenticated using (true) with check (true);
drop policy if exists "pln_delete" on public.cocina_planes_produccion;
create policy "pln_delete" on public.cocina_planes_produccion
  for delete to authenticated using (true);

drop trigger if exists pln_set_updated on public.cocina_planes_produccion;
create trigger pln_set_updated before update on public.cocina_planes_produccion
  for each row execute function public.set_updated_at();

-- ════════════════════════════════════════════════════════════════
-- 2. COMPROMISOS (insumos reservados por el plan)
-- ════════════════════════════════════════════════════════════════
create table if not exists public.cocina_plan_compromisos (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.cocina_planes_produccion(id) on delete cascade,
  insumo_id uuid not null references public.insumos(id) on delete restrict,
  cantidad numeric(12, 4) not null,  -- en unidad_base del insumo
  unidad_base text not null           -- snapshot
);

create index if not exists idx_pln_comp_plan on public.cocina_plan_compromisos(plan_id);
create index if not exists idx_pln_comp_insumo on public.cocina_plan_compromisos(insumo_id);

alter table public.cocina_plan_compromisos enable row level security;

drop policy if exists "plc_select" on public.cocina_plan_compromisos;
create policy "plc_select" on public.cocina_plan_compromisos
  for select to authenticated using (true);
drop policy if exists "plc_insert" on public.cocina_plan_compromisos;
create policy "plc_insert" on public.cocina_plan_compromisos
  for insert to authenticated with check (true);
drop policy if exists "plc_update" on public.cocina_plan_compromisos;
create policy "plc_update" on public.cocina_plan_compromisos
  for update to authenticated using (true) with check (true);
drop policy if exists "plc_delete" on public.cocina_plan_compromisos;
create policy "plc_delete" on public.cocina_plan_compromisos
  for delete to authenticated using (true);

-- ════════════════════════════════════════════════════════════════
-- 3. RPC: create_plan_produccion
-- ════════════════════════════════════════════════════════════════
-- Recibe compromisos pre-calculados desde TS (ya con conversión de unidades).
-- p_compromisos JSONB: [{"insumo_id": "uuid", "cantidad": 123.45, "unidad_base": "g"}, ...]
create or replace function public.create_plan_produccion(
  p_receta_id uuid,
  p_receta_nombre text,
  p_raciones numeric,
  p_fecha_objetivo date,
  p_nota text,
  p_compromisos jsonb
) returns uuid
language plpgsql
security invoker
as $$
declare
  v_plan_id uuid;
  v_item jsonb;
  v_insumo_id uuid;
  v_cant numeric;
  v_unidad text;
begin
  -- Insertar header
  insert into public.cocina_planes_produccion
    (receta_id, receta_nombre, raciones, fecha_objetivo, nota)
  values
    (p_receta_id, p_receta_nombre, p_raciones, p_fecha_objetivo,
     nullif(trim(coalesce(p_nota, '')), ''))
  returning id into v_plan_id;

  -- Por cada compromiso: insertar línea + sumar stock_comprometido + registrar movimiento
  for v_item in select * from jsonb_array_elements(p_compromisos)
  loop
    v_insumo_id := (v_item->>'insumo_id')::uuid;
    v_cant := (v_item->>'cantidad')::numeric;
    v_unidad := v_item->>'unidad_base';

    if v_cant <= 0 then continue; end if;

    insert into public.cocina_plan_compromisos
      (plan_id, insumo_id, cantidad, unidad_base)
    values (v_plan_id, v_insumo_id, v_cant, v_unidad);

    update public.insumos
       set stock_comprometido = coalesce(stock_comprometido, 0) + v_cant
     where id = v_insumo_id;

    insert into public.stock_movimientos
      (insumo_id, tipo, capa, cantidad, motivo, fecha, nota)
    values
      (v_insumo_id, 'comprometido_in', 'comprometido', v_cant,
       'Plan: ' || p_receta_nombre, current_date,
       'Plan ' || v_plan_id::text);
  end loop;

  return v_plan_id;
end;
$$;

-- ════════════════════════════════════════════════════════════════
-- 4. y 5. RPC: completar_plan_produccion / cancelar_plan_produccion
--     →  MOVIDAS (A5, dedupe) — ver definiciones canónicas abajo
-- ════════════════════════════════════════════════════════════════
-- Definiciones canónicas (las que corren en la base):
--   • completar_plan_produccion → cocina-planes-fix-completar.sql
--       Solo cambia el estado a 'completado'. NO toca el stock: el ingrediente
--       sigue comprometido hasta venderse o perderse. (La venta descuenta el
--       crudo del total.)
--   • cancelar_plan_produccion  → cocina-planes-venta-libera.sql
--       Libera la FRACCIÓN no vendida del comprometido.
--
-- Las versiones que vivían aquí eran las VIEJAS y erróneas, y se eliminaron
-- para que no pisen a las buenas al reaplicar el repo:
--   - completar descontaba stock_actual al completar → doble descuento (la
--     venta vuelve a restar el crudo).
--   - cancelar liberaba la cantidad COMPLETA (sin fracción) → restaba de más.

-- ════════════════════════════════════════════════════════════════
-- 6. RPC: delete_plan_produccion  →  MOVIDA (A5, dedupe)
-- ════════════════════════════════════════════════════════════════
-- La definición canónica de delete_plan_produccion vive en
-- cocina-planes-venta-libera.sql: libera la FRACCIÓN no vendida del comprometido
-- (pendiente O completado) antes de borrar. La versión que estaba aquí solo
-- liberaba si el plan estaba 'pendiente' — dejaba comprometido colgado al borrar
-- un completado. Se eliminó para no pisar la buena.


-- ############################################################################
-- ## cocina-planes-venta-libera.sql
-- ############################################################################
-- Cocina · M5 — La venta libera el stock comprometido (cierre del ciclo)
-- ════════════════════════════════════════════════════════════════
-- Conecta ventas (Xetux o manual) con los planes de producción:
-- al vender un producto, se libera automáticamente el stock comprometido
-- por los planes pendientes/completados de esa receta, en orden FIFO
-- (el plan más viejo primero).
--
-- Modelo de stock (recordatorio):
--   total        = físico (baja con pérdida y con venta vía trigger existente)
--   comprometido = reservado por planes activos
--   libre        = total - comprometido
--
-- Coherencia clave: 1 ración del plan == 1 unidad vendida (ambas escalan
-- igual contra `porciones`). Por eso, al vender una unidad que YA estaba
-- comprometida, el trigger existente baja el `total` y este trigger baja el
-- `comprometido` en la misma cantidad → el `libre` queda invariante (la bolsa
-- ya no era stock libre; venderla no cambia lo disponible para otra cosa).
--
-- Soporta ventas PARCIALES: un plan de 10 raciones del que se venden 3 queda
-- con raciones_consumidas=3 y libera 3/10 de su compromiso. Cuando se agota
-- (consumidas >= raciones) pasa a estado 'vendido'.
--
-- Aditivo, idempotente — corre seguro varias veces.

-- ────────────────────────────────────────────────────────────────
-- 1) Consumo parcial del plan por ventas
-- ────────────────────────────────────────────────────────────────
alter table public.cocina_planes_produccion
  add column if not exists raciones_consumidas numeric(10, 2) not null default 0;

-- ────────────────────────────────────────────────────────────────
-- 2) Trigger AFTER INSERT en ventas: liberar comprometido FIFO
-- ────────────────────────────────────────────────────────────────
-- No registra stock_movimientos por línea para no inundar el historial
-- (un import de Xetux son muchas líneas × varios ingredientes). La
-- trazabilidad queda en raciones_consumidas del plan.
create or replace function public.liberar_comprometido_por_venta()
returns trigger language plpgsql as $$
declare
  v_restante numeric;
  v_take numeric;
  v_frac numeric;
  v_plan record;
  v_comp record;
begin
  if new.receta_id is null then return new; end if;
  v_restante := new.cantidad;
  if v_restante is null or v_restante <= 0 then return new; end if;

  for v_plan in
    select id, raciones, coalesce(raciones_consumidas, 0) as consumidas, estado
      from public.cocina_planes_produccion
     where receta_id = new.receta_id
       and estado in ('pendiente', 'completado')
       and coalesce(raciones_consumidas, 0) < raciones
     order by created_at asc          -- FIFO: el plan más viejo se vende primero
     for update
  loop
    exit when v_restante <= 0;
    v_take := least(v_restante, v_plan.raciones - v_plan.consumidas);
    if v_take <= 0 then continue; end if;
    v_frac := v_take / v_plan.raciones;

    -- Liberar la fracción correspondiente de cada ingrediente comprometido.
    -- greatest(0, …) protege contra desajustes acumulados de redondeo.
    for v_comp in
      select insumo_id, cantidad
        from public.cocina_plan_compromisos where plan_id = v_plan.id
    loop
      update public.insumos
         set stock_comprometido =
               greatest(0, coalesce(stock_comprometido, 0) - v_comp.cantidad * v_frac)
       where id = v_comp.insumo_id;
    end loop;

    update public.cocina_planes_produccion
       set raciones_consumidas = v_plan.consumidas + v_take,
           estado = case
                      when v_plan.consumidas + v_take >= v_plan.raciones then 'vendido'
                      else estado
                    end,
           completado_at = case
                      when v_plan.consumidas + v_take >= v_plan.raciones
                        then coalesce(completado_at, now())
                      else completado_at
                    end
     where id = v_plan.id;

    v_restante := v_restante - v_take;
  end loop;

  return new;
end;
$$;

drop trigger if exists venta_libera_comprometido on public.ventas;
create trigger venta_libera_comprometido
  after insert on public.ventas
  for each row execute function public.liberar_comprometido_por_venta();

-- ────────────────────────────────────────────────────────────────
-- 3) Trigger AFTER DELETE en ventas: re-comprometer (deshacer venta)
-- ────────────────────────────────────────────────────────────────
-- Simétrico al de insert pero en orden inverso (LIFO): re-compromete los
-- planes que fueron consumidos más recientemente. Cubre el caso común de
-- "deshacer la última venta / re-importar un cierre".
create or replace function public.recommit_comprometido_por_venta()
returns trigger language plpgsql as $$
declare
  v_restante numeric;
  v_give numeric;
  v_frac numeric;
  v_plan record;
  v_comp record;
begin
  if old.receta_id is null then return old; end if;
  v_restante := old.cantidad;
  if v_restante is null or v_restante <= 0 then return old; end if;

  for v_plan in
    select id, raciones, coalesce(raciones_consumidas, 0) as consumidas, estado
      from public.cocina_planes_produccion
     where receta_id = old.receta_id
       and coalesce(raciones_consumidas, 0) > 0
       and estado in ('pendiente', 'completado', 'vendido')
     order by created_at desc
     for update
  loop
    exit when v_restante <= 0;
    v_give := least(v_restante, v_plan.consumidas);
    if v_give <= 0 then continue; end if;
    v_frac := v_give / v_plan.raciones;

    for v_comp in
      select insumo_id, cantidad
        from public.cocina_plan_compromisos where plan_id = v_plan.id
    loop
      update public.insumos
         set stock_comprometido = coalesce(stock_comprometido, 0) + v_comp.cantidad * v_frac
       where id = v_comp.insumo_id;
    end loop;

    update public.cocina_planes_produccion
       set raciones_consumidas = v_plan.consumidas - v_give,
           estado = case
                      when v_plan.estado = 'vendido'
                       and (v_plan.consumidas - v_give) < v_plan.raciones then 'completado'
                      else v_plan.estado
                    end
     where id = v_plan.id;

    v_restante := v_restante - v_give;
  end loop;

  return old;
end;
$$;

drop trigger if exists venta_recommit_comprometido on public.ventas;
create trigger venta_recommit_comprometido
  after delete on public.ventas
  for each row execute function public.recommit_comprometido_por_venta();

-- ────────────────────────────────────────────────────────────────
-- 4) cancelar_plan_produccion — liberar solo lo RESTANTE
-- ────────────────────────────────────────────────────────────────
-- Si el plan ya tenía ventas parciales, su compromiso vivo es solo la
-- fracción no vendida. Liberar el total restaría de más y afectaría a otros
-- planes que comparten el mismo insumo.
create or replace function public.cancelar_plan_produccion(p_plan_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
  v_estado text;
  v_nombre text;
  v_raciones numeric;
  v_consumidas numeric;
  v_frac numeric;
  v_comp record;
begin
  select estado, receta_nombre, raciones, coalesce(raciones_consumidas, 0)
    into v_estado, v_nombre, v_raciones, v_consumidas
    from public.cocina_planes_produccion where id = p_plan_id;
  if v_estado is null then
    raise exception 'Plan no encontrado';
  end if;
  if v_estado <> 'pendiente' then
    raise exception 'Solo se pueden cancelar planes pendientes (actual: %)', v_estado;
  end if;

  v_frac := case when v_raciones > 0
                 then (v_raciones - v_consumidas) / v_raciones
                 else 0 end;

  for v_comp in
    select insumo_id, cantidad from public.cocina_plan_compromisos where plan_id = p_plan_id
  loop
    update public.insumos
       set stock_comprometido =
             greatest(0, coalesce(stock_comprometido, 0) - v_comp.cantidad * v_frac)
     where id = v_comp.insumo_id;

    insert into public.stock_movimientos
      (insumo_id, tipo, capa, cantidad, motivo, fecha, nota)
    values
      (v_comp.insumo_id, 'comprometido_out', 'comprometido', -(v_comp.cantidad * v_frac),
       'Plan cancelado: ' || v_nombre, current_date,
       'Plan ' || p_plan_id::text);
  end loop;

  update public.cocina_planes_produccion
     set estado = 'cancelado', cancelado_at = now()
   where id = p_plan_id;
end;
$$;

-- ────────────────────────────────────────────────────────────────
-- 5) delete_plan_produccion — liberar solo lo RESTANTE antes de borrar
-- ────────────────────────────────────────────────────────────────
create or replace function public.delete_plan_produccion(p_plan_id uuid)
returns void
language plpgsql
security invoker
as $$
declare
  v_estado text;
  v_nombre text;
  v_raciones numeric;
  v_consumidas numeric;
  v_frac numeric;
  v_comp record;
begin
  select estado, receta_nombre, raciones, coalesce(raciones_consumidas, 0)
    into v_estado, v_nombre, v_raciones, v_consumidas
    from public.cocina_planes_produccion where id = p_plan_id;
  if v_estado is null then return; end if;

  -- Un plan COMPLETADO no se puede borrar: el producto ya está hecho y sus
  -- insumos no vuelven a su estado original (aderezo, pesto, falafel…). Solo
  -- puede venderse o registrarse como pérdida. Borrarlo liberaría comprometido
  -- y dejaría el crudo "devuelto" como libre → inflaría el inventario.
  if v_estado = 'completado' then
    raise exception 'No se puede borrar un plan completado: solo se vende o se registra como pérdida.';
  end if;

  -- Liberar el compromiso vivo (fracción no vendida) al borrar un pendiente.
  -- 'vendido' y 'cancelado' ya no tienen compromiso, así que la fracción da 0.
  if v_estado = 'pendiente' then
    v_frac := case when v_raciones > 0
                   then (v_raciones - v_consumidas) / v_raciones
                   else 0 end;
    if v_frac > 0 then
      for v_comp in
        select insumo_id, cantidad
          from public.cocina_plan_compromisos where plan_id = p_plan_id
      loop
        update public.insumos
           set stock_comprometido =
                 greatest(0, coalesce(stock_comprometido, 0) - v_comp.cantidad * v_frac)
         where id = v_comp.insumo_id;

        insert into public.stock_movimientos
          (insumo_id, tipo, capa, cantidad, motivo, fecha, nota)
        values
          (v_comp.insumo_id, 'comprometido_out', 'comprometido', -(v_comp.cantidad * v_frac),
           'Plan borrado: ' || v_nombre, current_date,
           'Plan ' || p_plan_id::text);
      end loop;
    end if;
  end if;

  delete from public.cocina_planes_produccion where id = p_plan_id;
end;
$$;

-- ────────────────────────────────────────────────────────────────
-- 6) recalcular_stock_comprometido  →  MOVIDA (A5, dedupe)
-- ────────────────────────────────────────────────────────────────
-- La definición canónica vive en cocina-recalcular-comprometido.sql. Esa
-- versión, además de contar la fracción no vendida de planes pendientes y
-- completados, SOLO escribe cuando el valor cambia de verdad (para no
-- reescribir la base en cada carga del M5). La versión que estaba aquí era
-- anterior a esa mejora; se eliminó para no pisarla al reaplicar.


-- ############################################################################
-- ## cocina-pos-clasificacion.sql
-- ############################################################################
-- Cocina · POS: tabla base de clasificación de ítems del POS (Xetux)
--
-- NOTA: esta tabla existía en producción pero su CREATE nunca quedó en el repo
-- (los archivos `cocina-pos-*.sql` solo le AGREGAN columnas). Este archivo la
-- crea con sus columnas base, para que la base se pueda reconstruir desde cero.
-- Las columnas extra (insumo_id, extra_receta_id, swap_*, etc.) las agregan los
-- `cocina-pos-*.sql`.

create table if not exists public.pos_clasificacion (
  id uuid primary key default gen_random_uuid(),
  -- nombre normalizado del ítem del POS (clave de match). Único: upsert por él.
  nombre_norm text not null unique,
  nombre_original text not null,
  tipo text not null default 'sin_clasificar',
  receta_id uuid references public.recetas(id) on delete set null,
  proveedor_id uuid references public.proveedores(id) on delete set null,
  porcentaje_acuerdo numeric(6, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pos_clasificacion enable row level security;

drop policy if exists "pos_clasificacion_select_authenticated" on public.pos_clasificacion;
create policy "pos_clasificacion_select_authenticated"
  on public.pos_clasificacion for select to authenticated using (true);
drop policy if exists "pos_clasificacion_insert_authenticated" on public.pos_clasificacion;
create policy "pos_clasificacion_insert_authenticated"
  on public.pos_clasificacion for insert to authenticated with check (true);
drop policy if exists "pos_clasificacion_update_authenticated" on public.pos_clasificacion;
create policy "pos_clasificacion_update_authenticated"
  on public.pos_clasificacion for update to authenticated using (true) with check (true);
drop policy if exists "pos_clasificacion_delete_authenticated" on public.pos_clasificacion;
create policy "pos_clasificacion_delete_authenticated"
  on public.pos_clasificacion for delete to authenticated using (true);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pos_clasificacion_set_updated_at on public.pos_clasificacion;
create trigger pos_clasificacion_set_updated_at
  before update on public.pos_clasificacion
  for each row execute function public.set_updated_at();


-- ############################################################################
-- ## cocina-pos-insumo-directo.sql
-- ############################################################################
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

-- 3) y 4) descontar/revertir_stock_por_venta  →  MOVIDAS (A5, dedupe)
-- Esta era una versión anterior (solo insumo directo + receta, sin extra ni
-- sustitución). La canónica y completa está en cocina-zzz-motor-canonico.sql.
-- Aquí se conservan solo las COLUMNAS (arriba), que sí son necesarias.


-- ############################################################################
-- ## cocina-pos-receta-extra.sql
-- ############################################################################
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

-- descontar/revertir_stock_por_venta  →  MOVIDAS (A5, dedupe)
-- Versión anterior (insumo + receta base + extra, sin sustitución). La canónica
-- y completa está en cocina-zzz-motor-canonico.sql. Aquí quedan solo las
-- COLUMNAS de arriba (extra_receta_id / extra_cantidad), que sí son necesarias.


-- ############################################################################
-- ## cocina-pos-sustitucion-insumo.sql
-- ############################################################################
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

-- descontar/revertir_stock_por_venta  →  MOVIDAS (A5, dedupe)
-- Versión anterior (tenía la sustitución pero le faltaba el swap-reverse en el
-- bloque de insumo directo). La canónica y completa está en
-- cocina-zzz-motor-canonico.sql. Aquí quedan solo las COLUMNAS de arriba
-- (swap_from_insumo_id / swap_to_insumo_id), que sí son necesarias.

-- ─── DECISIÓN DE MODELO (M8): swap vs. reservas de planes ─────────
-- El DESCUENTO de stock aplica la sustitución (resta el insumo swap_to). La
-- LIBERACIÓN de comprometido (liberar_comprometido_por_venta) NO conoce swaps:
-- libera la reserva del insumo ORIGINAL de la receta. Esto es INTENCIONAL y
-- correcto:
--   • El insumo original (ej. leche entera) que el plan reservó NO se usó en
--     esa venta (se sustituyó), así que liberar su reserva es lo correcto —
--     vuelve al stock libre.
--   • El insumo sustituto (ej. leche de almendras) sí se usó, y el descuento lo
--     resta del stock físico.
-- Propagar el swap a la liberación sería PEOR: dejaría al insumo original
-- reservado para siempre (los planes se arman desde la receta base, que no
-- tiene swaps). Por eso NO se propaga. Documentado a raíz de la auditoría (M8).


-- ############################################################################
-- ## cocina-receta-ingrediente-libre-ok.sql
-- ############################################################################
-- Cocina · Ingrediente libre "a propósito" en recetas
-- ════════════════════════════════════════════════════════════════
-- Algunas recetas llevan a propósito un ingrediente que NO está en el catálogo
-- de insumos (y por diseño no tiene stock ni costo): el caso típico es el agua
-- de filtro. Antes, cualquier ingrediente sin insumo mostraba el aviso amarillo
-- "No descuenta stock", lo cual era ruido en esos casos legítimos.
--
-- Esta columna marca que ESE ingrediente va sin insumo a propósito. Cuando está
-- en true:
--   • No sale el aviso amarillo (solo una nota gris discreta).
--   • El formulario SÍ deja guardar la receta (los no marcados la bloquean).
--
-- Solo aplica a líneas sin insumo_id ni subreceta_id (ingredientes libres). En
-- líneas vinculadas se ignora.
--
-- Aditivo e idempotente.

alter table public.receta_ingredientes
  add column if not exists sin_insumo_ok boolean not null default false;


-- ############################################################################
-- ## cocina-recetas-costo-manual.sql
-- ############################################################################
-- Agrega columna para precio manual en ingredientes ad-hoc (fuera del catálogo).
-- Si la línea de receta tiene insumo_id, el precio se calcula del catálogo.
-- Si NO tiene insumo_id, se usa este costo_manual_usd como base.
-- Es por unidad de la 'unidad' del ingrediente (ej: $0.05/g, $0.20/ml).

alter table public.receta_ingredientes
  add column if not exists costo_manual_usd numeric(12, 6);


-- ############################################################################
-- ## cocina-recetas-porciones-min.sql
-- ############################################################################
-- Cocina · porciones ≥ 1 en recetas
-- ════════════════════════════════════════════════════════════════
-- Si una receta se guarda con porciones = 0, el motor diverge: un plan de
-- producción SÍ compromete crudo (el TS asume porciones=1), pero la venta de esa
-- receta NO descuenta nada (flatten_receta_insumos retorna vacío cuando
-- porciones = 0) y libera el comprometido igual → inventario inflado.
--
-- El formulario ya coacciona porciones a ≥ 1 y la capa de datos ahora también,
-- pero un CHECK lo blinda por cualquier vía (SQL directo, otra integración).
--
-- Idempotente.

-- 1) Arreglar cualquier fila existente con porciones inválido.
update public.recetas
   set porciones = 1
 where porciones is null or porciones < 1;

-- 2) Blindaje: porciones siempre ≥ 1.
alter table public.recetas
  drop constraint if exists recetas_porciones_pos;
alter table public.recetas
  add constraint recetas_porciones_pos check (porciones >= 1);


-- ############################################################################
-- ## cocina-fix-compromisos-unidad.sql
-- ############################################################################
-- Cocina · Arreglo de compromisos de planes con unidad desfasada
--
-- PROBLEMA
-- Cuando se cambia la unidad base de un insumo (ej. ajo de g → kg), el sistema
-- convierte el stock del insumo pero NO los compromisos ya guardados en los
-- planes (cocina_plan_compromisos.cantidad, que trae un snapshot de la unidad).
-- Resultado: un compromiso de 14 g queda como "14" y, con el insumo ya en kg,
-- se lee como 14 kg → el stock libre se ve en 0 aunque el insumo tenga stock.
--
-- SOLUCIÓN (2 capas)
--   1) DATOS: convertir los compromisos desfasados a la unidad actual del insumo
--      usando la función canónica convertir_para_costo, y actualizar el snapshot.
--   2) BLINDAJE: recalcular_stock_comprometido ahora convierte al vuelo el
--      compromiso (snapshot → unidad actual del insumo), así aunque queden
--      snapshots viejos el total siempre se calcula en la unidad correcta.
--
-- Idempotente — se puede correr varias veces sin daño.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) DATOS · convertir SOLO los compromisos donde la conversión es matemática-
--    mente segura: mismo tipo de unidad (peso↔peso, volumen↔volumen), donde
--    convertir_para_costo realmente cambia el número (ej. g→kg ÷1000).
--    Se EXCLUYE a propósito:
--      • unidades iguales escritas distinto (unid/unidades) → el valor no cambia,
--        no hace falta tocarlas.
--      • conversiones entre dimensiones distintas (g→L) → dependen de densidad,
--        no se pueden convertir solas; se resuelven a mano.
update public.cocina_plan_compromisos c
set cantidad    = round(
                    public.convertir_para_costo(c.cantidad, c.unidad_base, i.unidad_base)::numeric,
                    4
                  ),
    unidad_base = i.unidad_base
from public.insumos i
where c.insumo_id = i.id
  and abs(
        public.convertir_para_costo(c.cantidad, c.unidad_base, i.unidad_base) - c.cantidad
      ) > 0.00005;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) BLINDAJE · recalcular_stock_comprometido convierte el compromiso al vuelo.
--    (Misma lógica que la versión previa, pero envolviendo c.cantidad en
--    convertir_para_costo contra la unidad_base ACTUAL del insumo.)
create or replace function public.recalcular_stock_comprometido()
returns table (insumo_id uuid, stock_comprometido_anterior numeric, stock_comprometido_nuevo numeric)
language plpgsql
security invoker
as $$
begin
  return query
  with totales as (
    select
      c.insumo_id,
      sum(
        public.convertir_para_costo(c.cantidad, c.unidad_base, i.unidad_base)
        * (p.raciones - coalesce(p.raciones_consumidas, 0))::numeric
        / nullif(p.raciones, 0)
      ) as total_comprometido
    from public.cocina_plan_compromisos c
    join public.cocina_planes_produccion p on p.id = c.plan_id
    join public.insumos i on i.id = c.insumo_id
    where p.estado in ('pendiente', 'completado')
      and coalesce(p.raciones_consumidas, 0) < p.raciones
    group by c.insumo_id
  ),
  updates as (
    update public.insumos i
       set stock_comprometido = coalesce(t.total_comprometido, 0)
      from totales t
     where i.id = t.insumo_id
       and abs(coalesce(i.stock_comprometido, 0) - coalesce(t.total_comprometido, 0)) > 0.00005
    returning i.id, 0::numeric as anterior, i.stock_comprometido as nuevo
  ),
  resets as (
    update public.insumos i
       set stock_comprometido = 0
     where not exists (
       select 1 from public.cocina_plan_compromisos c
         join public.cocina_planes_produccion p on p.id = c.plan_id
        where c.insumo_id = i.id
          and p.estado in ('pendiente', 'completado')
          and coalesce(p.raciones_consumidas, 0) < p.raciones
     )
       and coalesce(i.stock_comprometido, 0) <> 0
    returning i.id, 0::numeric as anterior, 0::numeric as nuevo
  )
  select * from updates
  union all
  select * from resets;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) COSMÉTICO · normalizar el snapshot cuando la unidad es la MISMA escrita
--    distinto (ej. "unid" vs "unidades"): el valor no cambia, solo la etiqueta.
--    Se restringe a la misma dimensión para NO tocar cruces peso↔volumen.
-- Normaliza cuando el valor NO cambia (misma unidad escrita distinto, ej.
-- unid/unidades), pero NUNCA cuando son dos unidades conocidas de dimensión
-- distinta (g vs L) — ese caso es un cruce real que se resuelve a mano.
update public.cocina_plan_compromisos c
set unidad_base = i.unidad_base
from public.insumos i
where c.insumo_id = i.id
  and public.unidad_norm(c.unidad_base) is distinct from public.unidad_norm(i.unidad_base)
  and abs(public.convertir_para_costo(c.cantidad, c.unidad_base, i.unidad_base) - c.cantidad) <= 0.00005
  and not (
    public.unidad_factor(c.unidad_base) is not null
    and public.unidad_factor(i.unidad_base) is not null
    and public.unidad_dim(c.unidad_base) is distinct from public.unidad_dim(i.unidad_base)
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) BLINDAJE A FUTURO · trigger: al cambiar la unidad_base de un insumo, si
--    tiene compromisos, se convierten automáticamente (misma dimensión) y se
--    recalcula su stock_comprometido en el acto. Vive en la base de datos, así
--    que aplica venga el cambio de la app o del editor SQL.
create or replace function public.sync_compromisos_al_cambiar_unidad()
returns trigger language plpgsql as $$
begin
  -- Solo actuar si de verdad cambió la unidad base.
  if public.unidad_norm(new.unidad_base) is distinct from public.unidad_norm(old.unidad_base) then

    -- (a) Convertir los compromisos de este insumo a la nueva unidad, solo cuando
    --     es una conversión real del mismo tipo (peso↔peso, volumen↔volumen).
    --     Los cruces de dimensión (g→L) NO se tocan: dependen de densidad y hay
    --     que resolverlos a mano.
    update public.cocina_plan_compromisos c
    set cantidad    = round(public.convertir_para_costo(c.cantidad, c.unidad_base, new.unidad_base)::numeric, 4),
        unidad_base = new.unidad_base
    where c.insumo_id = new.id
      and abs(public.convertir_para_costo(c.cantidad, c.unidad_base, new.unidad_base) - c.cantidad) > 0.00005;

    -- (b) Recalcular el stock_comprometido de ESTE insumo desde sus compromisos
    --     vivos (planes pendiente/completado con raciones por consumir).
    new.stock_comprometido := coalesce((
      select sum(
        public.convertir_para_costo(c.cantidad, c.unidad_base, new.unidad_base)
        * (p.raciones - coalesce(p.raciones_consumidas, 0))::numeric
        / nullif(p.raciones, 0)
      )
      from public.cocina_plan_compromisos c
      join public.cocina_planes_produccion p on p.id = c.plan_id
      where c.insumo_id = new.id
        and p.estado in ('pendiente', 'completado')
        and coalesce(p.raciones_consumidas, 0) < p.raciones
    ), 0);
  end if;
  return new;
end;
$$;

drop trigger if exists insumos_sync_compromisos_unidad on public.insumos;
create trigger insumos_sync_compromisos_unidad
  before update on public.insumos
  for each row execute function public.sync_compromisos_al_cambiar_unidad();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) Recalcular ya, para que el stock_comprometido de cada insumo quede al día.
select * from public.recalcular_stock_comprometido();


-- ############################################################################
-- ## cocina-pedido-planes-generados.sql
-- ############################################################################
-- Al marcar un pedido guardado como "comprado", la app crea automáticamente un
-- plan de producción PENDIENTE por cada receta del pedido (reserva sus insumos).
-- Esta columna marca que ya se generaron, para no duplicarlos si se cambia el
-- estado ida y vuelta (comprado → reabrir → comprado).
alter table public.cocina_pedidos
  add column if not exists planes_generados boolean not null default false;


-- ############################################################################
-- ## cocina-zzz-motor-canonico.sql
-- ############################################################################
-- ════════════════════════════════════════════════════════════════════════
-- Cocina · MOTOR CANÓNICO (A5) — fuente de verdad del descuento de stock
-- ════════════════════════════════════════════════════════════════════════
-- Este archivo contiene las definiciones VIVAS y correctas de las funciones del
-- motor de ventas/stock, copiadas tal cual de la base de producción
-- (pg_get_functiondef). Varias de estas funciones están duplicadas en archivos
-- más viejos del repo, y algunas versiones viejas GANABAN por orden alfabético
-- (p.ej. descontar_stock_por_venta: la buena vive en
-- cocina-pos-modificador-sustitucion.sql, pero cocina-pos-sustitucion-insumo.sql
-- ordena después y la degradaría).
--
-- El nombre "cocina-zzz-…" hace que este archivo se aplique de ÚLTIMO en orden
-- alfabético, así estas definiciones SIEMPRE ganan y no pueden ser pisadas por
-- una versión vieja al reaplicar el repo.
--
-- Funciones canónicas aquí:
--   • descontar_stock_por_venta        (venta → baja stock; insumo/receta/extra/swap)
--   • revertir_stock_por_venta         (borrar venta → repone stock)
--   • flatten_receta_insumos           (expande receta+subrecetas con conversión y porciones)
--   • flatten_receta_planes            (idem para planes de producción)
--   • liberar_comprometido_por_venta   (venta/merma → libera reserva de planes, fracción)
--   • recommit_comprometido_por_venta  (deshacer venta → re-reserva)
--
-- recalcular_stock_comprometido: su canónica está en
-- cocina-recalcular-comprometido.sql (más nueva: escribe-solo-si-cambia). Como
-- 'r' < 'z', este archivo NO la redefine y la de allá queda vigente.
--
-- Idempotente (CREATE OR REPLACE). Ver README-migraciones.md.

-- ─── descontar_stock_por_venta ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.descontar_stock_por_venta()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
      -- "Sin X": swap_from SIN swap_to → se quita ese insumo (no se descuenta).
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
      -- "Sin X": swap_from SIN swap_to → se quita ese insumo (no se descuenta).
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

-- ─── revertir_stock_por_venta ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.revertir_stock_por_venta()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
      -- "Sin X": swap_from SIN swap_to → se quitó ese insumo (nunca se descontó,
      -- así que no se repone).
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
      -- "Sin X": swap_from SIN swap_to → se quitó ese insumo (nunca se descontó,
      -- así que no se repone).
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

-- ─── flatten_receta_insumos ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.flatten_receta_insumos(p_receta_id uuid, p_factor numeric DEFAULT 1, p_depth integer DEFAULT 0)
 RETURNS TABLE(insumo_id uuid, total_cantidad numeric)
 LANGUAGE plpgsql
AS $function$
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
      sub_factor := (v_cant_conv * p_factor / porciones_r::numeric)
                    / sub_rend * coalesce(nullif(sub_porciones, 0), 1);
      return query
        select fi.insumo_id, fi.total_cantidad
          from public.flatten_receta_insumos(r.subreceta_id, sub_factor, p_depth + 1) fi;
    end if;
  end loop;
end;
$function$;

-- ─── flatten_receta_planes ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.flatten_receta_planes(p_receta_id uuid, p_factor numeric DEFAULT 1, p_depth integer DEFAULT 0)
 RETURNS TABLE(receta_id uuid, factor numeric)
 LANGUAGE plpgsql
AS $function$
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
$function$;

-- ─── liberar_comprometido_por_venta ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.liberar_comprometido_por_venta()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  v_target record; v_restante numeric; v_take numeric; v_frac numeric;
  v_plan record; v_comp record;
begin
  if new.receta_id is null then return new; end if;

  for v_target in
    select receta_id as rid, sum(factor) as factor
    from public.flatten_receta_planes(new.receta_id, new.cantidad)
    group by receta_id
  loop
    v_restante := v_target.factor;
    if v_restante is null or v_restante <= 0 then continue; end if;

    for v_plan in
      select id, raciones, coalesce(raciones_consumidas, 0) as consumidas, estado
        from public.cocina_planes_produccion
       where receta_id = v_target.rid
         and estado in ('pendiente', 'completado')
         and coalesce(raciones_consumidas, 0) < raciones
       order by created_at asc
       for update
    loop
      exit when v_restante <= 0;
      v_take := least(v_restante, v_plan.raciones - v_plan.consumidas);
      if v_take <= 0 then continue; end if;
      v_frac := v_take / v_plan.raciones;

      for v_comp in
        select insumo_id, cantidad
          from public.cocina_plan_compromisos where plan_id = v_plan.id
      loop
        update public.insumos
           set stock_comprometido =
                 greatest(0, coalesce(stock_comprometido, 0) - v_comp.cantidad * v_frac)
         where id = v_comp.insumo_id;
      end loop;

      update public.cocina_planes_produccion
         set raciones_consumidas = v_plan.consumidas + v_take,
             raciones_perdidas = coalesce(raciones_perdidas, 0)
               + (case when coalesce(new.es_merma, false) then v_take else 0 end),
             estado = case
                        when v_plan.consumidas + v_take >= v_plan.raciones then 'vendido'
                        else estado
                      end,
             completado_at = case
                        when v_plan.consumidas + v_take >= v_plan.raciones
                          then coalesce(completado_at, now())
                        else completado_at
                      end
       where id = v_plan.id;

      v_restante := v_restante - v_take;
    end loop;
  end loop;

  return new;
end;
$function$;

-- ─── recommit_comprometido_por_venta ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recommit_comprometido_por_venta()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  v_target record; v_restante numeric; v_give numeric; v_frac numeric;
  v_plan record; v_comp record;
begin
  if old.receta_id is null then return old; end if;

  for v_target in
    select receta_id as rid, sum(factor) as factor
    from public.flatten_receta_planes(old.receta_id, old.cantidad)
    group by receta_id
  loop
    v_restante := v_target.factor;
    if v_restante is null or v_restante <= 0 then continue; end if;

    for v_plan in
      select id, raciones, coalesce(raciones_consumidas, 0) as consumidas, estado
        from public.cocina_planes_produccion
       where receta_id = v_target.rid
         and coalesce(raciones_consumidas, 0) > 0
         and estado in ('pendiente', 'completado', 'vendido')
       order by created_at desc
       for update
    loop
      exit when v_restante <= 0;
      v_give := least(v_restante, v_plan.consumidas);
      if v_give <= 0 then continue; end if;
      v_frac := v_give / v_plan.raciones;

      for v_comp in
        select insumo_id, cantidad
          from public.cocina_plan_compromisos where plan_id = v_plan.id
      loop
        update public.insumos
           set stock_comprometido = coalesce(stock_comprometido, 0) + v_comp.cantidad * v_frac
         where id = v_comp.insumo_id;
      end loop;

      update public.cocina_planes_produccion
         set raciones_consumidas = v_plan.consumidas - v_give,
             raciones_perdidas = case
                        when coalesce(old.es_merma, false)
                          then greatest(0, coalesce(raciones_perdidas, 0) - v_give)
                        else raciones_perdidas
                      end,
             estado = case
                        when v_plan.estado = 'vendido'
                         and (v_plan.consumidas - v_give) < v_plan.raciones then 'completado'
                        else v_plan.estado
                      end
       where id = v_plan.id;

      v_restante := v_restante - v_give;
    end loop;
  end loop;

  return old;
end;
$function$;

