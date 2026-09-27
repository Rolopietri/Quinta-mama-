# Crear un proyecto nuevo desde esta plataforma

Esta plataforma (Next.js + Supabase + Vercel) se puede reutilizar como base para
otro proyecto, **totalmente separado**. Son 3 piezas independientes: código
(GitHub), base de datos (Supabase) y hosting (Vercel).

> ⚠️ Nada de esto toca el proyecto original. Un proyecto nuevo = repo nuevo +
> Supabase nuevo + Vercel nuevo, todo aislado.

## 1) Código (GitHub)
- Opción recomendada: marca este repo como **Template repository**
  (Settings → casilla "Template repository") y luego usa **"Use this template" →
  Create a new repository** para crear el repo del proyecto nuevo.

## 2) Base de datos (Supabase) — un solo pegado
1. [supabase.com](https://supabase.com/dashboard) → **New project** (nombre y
   contraseña nuevas). Es una base 100% aparte.
2. **SQL Editor → New query** → pega **todo** el archivo
   [`supabase/setup-completo.sql`](supabase/setup-completo.sql) → **Run**.
   - Recrea TODAS las tablas en el orden correcto (verificado desde cero).
   - Es idempotente (seguro re-ejecutar).
   - Los bloques `*-seed.sql` cargan datos de ejemplo que puedes borrar.
3. **Settings → API** → copia **Project URL** y **anon key**.

## 3) Hosting (Vercel)
1. [vercel.com](https://vercel.com) → **Add New → Project** → importa el repo nuevo.
2. **Environment Variables** (ver `.env.local.example`):
   - `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` → del Supabase nuevo.
   - `ALLOWED_EMAILS` → correos con permiso de entrar.
   - `SUPABASE_SERVICE_ROLE_KEY` (solo si usas el cron de tasa BCV / envíos).
   - `GOOGLE_CALENDAR_ICS_URL` (opcional) → calendario de Google a reflejar.
3. **Deploy**.

## 4) Personalizar (opcional)
- Marca/nombre: `src/app/page.tsx`, `src/components/Header.tsx`, logos en `public/`.
- Borra los módulos que no uses (carpetas en `src/app/`, ej. `cocina/`,
  `presupuestos/`) y sus tablas si no las necesitas.
