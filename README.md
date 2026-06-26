# Quinta Mamá · Calculadora financiera

Herramienta interactiva de modelado financiero para el comedor **Quinta Mamá**.
Edita los supuestos a la izquierda y observa cómo se recalculan en vivo las ventas,
el EBITDA, el punto de equilibrio, los escenarios y la proyección a 12 meses.

Construida con **Vite + React** y **Recharts**. Todo corre en el navegador (sin
servidor); los supuestos se guardan automáticamente en el dispositivo (localStorage).

---

## Ver la app en tu computadora (local)

Necesitas tener instalado [Node.js](https://nodejs.org) (versión 18 o superior).

```bash
# 1. Entra a la carpeta del proyecto
cd quinta-mama-calculadora

# 2. Instala las dependencias (solo la primera vez)
npm install

# 3. Arranca el servidor de desarrollo
npm run dev
```

Luego abre en el navegador la dirección que aparece (normalmente
**http://localhost:5173**). Cada cambio que hagas en el código se refleja al instante.

Para generar la versión optimizada de producción:

```bash
npm run build      # crea la carpeta dist/
npm run preview    # previsualiza esa versión de producción
```

---

## Desplegar en Vercel

### Opción A — Desde la web (recomendada, ideal para iPad)

1. Sube esta carpeta a un repositorio de GitHub (por ejemplo `quinta-mama-calculadora`).
2. Entra a <https://vercel.com/new>.
3. Elige **Import** sobre ese repositorio.
4. Vercel detecta **Vite** automáticamente. No cambies nada:
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Pulsa **Deploy**. En ~1 minuto tendrás tu URL pública.

A partir de ahí, cada cambio que subas a GitHub se publicará solo.

### Opción B — Desde la terminal (Vercel CLI)

```bash
npm i -g vercel        # instala la herramienta de Vercel (una vez)
vercel login           # inicia sesión con tu cuenta
vercel                 # primer despliegue (preview); responde las preguntas
vercel --prod          # publica en producción
```

No se necesita configurar nada especial: Vite funciona en Vercel sin ajustes.

---

## Estructura

```
src/
  main.jsx      Punto de entrada de React
  App.jsx       Pantalla principal (estado, supuestos, resultados)
  lib.js        Toda la lógica de cálculo + formateadores (€ / Bs / %)
  ui.jsx        Componentes (campos, tooltips ⓘ, secciones, tarjetas, KPIs)
  charts.jsx    Gráficos con Recharts (cascada, escenarios, proyección)
  styles.css    Estilos (paleta negro + dorado + crema, responsive, impresión)
```

## Funciones incluidas

- Recálculo en vivo de ventas, CMV, margen bruto, EBITDA y márgenes.
- Punto de equilibrio, margen de seguridad, payback y ROI anual.
- Nómina paramétrica editable (añadir / eliminar roles, cargas sociales).
- Tres escenarios (Conservador / Base / Optimista) con factores editables.
- Conversión € → Bs con tasa editable.
- Gráfico de cascada, barras de escenarios y proyección a 12 meses.
- Lectura narrativa "para accionistas" generada con los números en vivo.
- Tooltips educativos (rotación, ticket, food cost, CMV, EBITDA).
- Exportar a PDF, guardar/cargar escenarios en JSON y restablecer valores.
- Diseño responsive para iPhone / iPad (Safari) y escritorio.
