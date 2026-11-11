@AGENTS.md

# Sistema Operativo · Quinta Mamá

Sistema interno de gestión de operaciones de Proyectos Quinta Mamá, C.A. (Caracas). Responsable: Rodrigo López Pietri. Hablamos en español.

## Qué es

- Panel en Next.js desplegado en Vercel (quinta-mama.vercel.app).
- Base de datos PostgreSQL en Supabase.
- Módulos principales: motor de puntuación estratégica PCE, seguimiento de tareas, inventario de los 25 espacios físicos de la casa y reportes automáticos.
- El panel es la fuente de verdad. Ningún dato vive solo fuera de él.
- Principio para cualquier agente o automatización (por ejemplo WhatsApp): el agente interpreta, el panel decide. La IA nunca escribe decisiones finales sin pasar por las reglas del panel.

## Comandos

No adivines comandos. Léelos de `package.json` (scripts) y de la configuración de Supabase y Vercel del repo. Si falta un comando necesario, pregúntame antes de inventarlo.

## Cómo trabajar

1. **Plan primero** en cualquier cambio que toque más de un archivo, la base de datos o el despliegue. Explica el plan en pocas líneas y luego ejecútalo.
2. **Pasos pequeños.** Un cambio lógico por commit, con mensaje claro en español.
3. **Verifica antes de dar algo por terminado:** que compile (build), que pasen las pruebas y que no haya errores de tipos ni de lint.
4. **Si algo falla dos veces seguidas** con el mismo enfoque, detente, explícame qué pasa y propón alternativas.

## Base de datos (Supabase)

- Todo cambio de estructura va como migración en archivo dentro de `supabase/migrations/`. Nada de cambios manuales sin migración.
- Nunca edites una migración ya aplicada: crea una nueva.
- Antes de aplicar una migración, resume en una línea qué cambia.
- Cualquier cosa que borre tablas, columnas o datos (DROP, TRUNCATE, DELETE, `db reset`) requiere mi autorización. Explica qué se pierde y si hay respaldo.
- Mantén las políticas de seguridad (RLS) activas en tablas nuevas.

## GitHub y Vercel

- Puedes subir cambios y desplegar sin preguntarme, siempre que build y pruebas pasen antes.
- Si build o pruebas fallan, no subas ni despliegues: arregla primero o avísame.
- Nunca reescribas el historial (force push) sin preguntarme.
- Después de desplegar a producción, revisa que el sitio cargue y dime qué se publicó.

## Claves y contraseñas

- No leas ni modifiques `.env`, `.env.local`, claves, certificados ni variables de entorno de Vercel sin pedirme permiso.
- Nunca escribas una clave dentro del código, de un commit o de un mensaje.

## Al terminar una tarea

Dame un resumen corto: qué cambió, qué se subió o desplegó, y qué queda pendiente.
