import type { Metadata } from "next";
import { VisitaClient } from "./VisitaClient";

export const metadata: Metadata = {
  title: "Entra a La Quinta Mamá — Casa de salud y cultura",
  description:
    "Recorre la casa piso por piso: cocina, bienestar, comunidad y eventos. Donde la cultura y el bienestar florecen. Caracas.",
  openGraph: {
    title: "La Quinta Mamá",
    description:
      "Entra y recorre la casa piso por piso. Donde la cultura y el bienestar florecen.",
  },
};

export default function VisitaPage() {
  return <VisitaClient />;
}
