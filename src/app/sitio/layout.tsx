import type { Metadata, Viewport } from "next";
import { Radley, Playfair_Display, Archivo } from "next/font/google";
import "./sitio.css";

/**
 * Fuentes de la identidad (ver 02-TOKENS). Alte Haas Grotesk no está en Google
 * Fonts; se usa Archivo como aproximación geométrica cercana hasta que se
 * decida licenciar y auto-hospedar Alte Haas.
 */
const radley = Radley({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Quinta Mamá — Centro de salud y cultura · Caracas",
  description:
    "Centro cultural autosustentable en una casa de 1955 en Chacao, Caracas. Siete aliados independientes, espacios para eventos y un programa de impacto social. En Quinta Mamá la cultura es la esencia del bienestar.",
  openGraph: {
    title: "Quinta Mamá — Centro de salud y cultura",
    description:
      "En Quinta Mamá la cultura es la esencia del bienestar. Chacao · Caracas · Venezuela.",
    locale: "es_VE",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#E3DCD2",
};

export default function SitioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`qm-root ${radley.variable} ${playfair.variable} ${archivo.variable}`}
    >
      {children}
    </div>
  );
}
