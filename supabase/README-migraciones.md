# Migraciones / funciones SQL de cocina — cómo está organizado

## El problema (histórico)
Este directorio son archivos `.sql` sueltos que se aplicaron a mano, sin un
orden de migración numerado. Con el tiempo, **varias funciones quedaron
definidas en más de un archivo**, con versiones distintas. Como al reaplicar se
ejecutan en orden alfabético, la versión que "gana" es la del archivo que ordena
**último** — y en algunos casos esa era una versión **vieja** que degradaba una
corrección. (Ej.: `descontar_stock_por_venta` bueno vive en
`cocina-pos-modificador-sustitucion.sql`, pero `cocina-pos-sustitucion-insumo.sql`
ordena después y lo pisaría.)

## La solución actual
La **base de producción es la fuente de verdad** (sus funciones fueron
verificadas). Para que ninguna versión vieja pueda pisar las buenas al reaplicar:

- **`cocina-zzz-motor-canonico.sql`** contiene las definiciones VIVAS y correctas
  del motor de stock (descontar, revertir, flatten×2, liberar, recommit). El
  prefijo `zzz-` hace que se aplique **de último** → siempre gana.
- **`cocina-recalcular-comprometido.sql`** es la canónica de
  `recalcular_stock_comprometido` (escribe-solo-si-cambia). Como `r` < `z`, el
  motor-canonico no la redefine.
- Las funciones de **planes** ya quedaron con una sola definición cada una:
  - `create_plan_produccion` → `cocina-planes-produccion.sql`
  - `completar_plan_produccion` → `cocina-planes-fix-completar.sql`
  - `cancelar_plan_produccion` / `delete_plan_produccion` → `cocina-planes-venta-libera.sql`

## Regla de oro
- **Al reaplicar el repo**, hazlo en orden alfabético; `cocina-zzz-…` va de último
  y deja las funciones del motor en su versión correcta.
- **No edites** las definiciones viejas duplicadas en los archivos `cocina-pos-*`,
  `cocina-ventas.sql`, `cocina-subrecetas.sql`, etc. — están superseded por el
  motor-canonico. Si necesitas cambiar una función del motor, cámbiala en
  `cocina-zzz-motor-canonico.sql`.

## Pendiente (limpieza futura, sin urgencia)
Borrar de raíz las definiciones duplicadas viejas de los archivos superseded, y
migrar todo a una carpeta `migrations/` numerada. La base ya corre las versiones
correctas, así que esto es higiene, no un bug.
