import { Header } from "@/components/Header";
import { TareasClient } from "./TareasClient";

export default function TareasPage() {
  return (
    <>
      <Header subtitle="Tareas" />
      <main className="flex-1 mx-auto w-full max-w-3xl px-5 py-8">
        <TareasClient />
      </main>
    </>
  );
}
