import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QalaHub AI — твой город, твои возможности",
  description: "Городской ИИ-помощник для Казахстана: события, еда, отдых и повседневные вопросы. Начинаем с Астаны.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
