import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "EldoradoCorp | Áreas & Galpões",
  description:
    "CRM de controle de áreas e galpões com mapa interativo, dossiês, perímetros KMZ e inteligência de indicadores IBGE para Sumaré, RMC e Piracicaba.",
  applicationName: "EldoradoCorp",
  keywords: ["EldoradoCorp", "CRM imobiliário", "galpões", "Sumaré", "Campinas", "Piracicaba", "IBGE"],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-paper text-ink antialiased">{children}</body>
    </html>
  );
}
