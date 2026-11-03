import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ScrollToTop from "@/components/ScrollToTop";
import HomeButton from "@/components/HomeButton";
import AiWidget from "@/components/AiWidget";
import { ToastProvider } from "@/components/Toast/ToastContext";
import ErrorBoundary from "@/components/ErrorBoundary";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ReadGrid — Електронна бібліотека",
  description: "Читай, завантажуй та відкривай нові книги у ReadGrid — сучасній системі електронної бібліотеки з рейтингами, коментарями та персональними рекомендаціями.",
  keywords: ["електронна бібліотека", "книги онлайн", "читати книги", "ReadGrid", "епаб", "PDF книги"],
  authors: [{ name: "ReadGrid Team" }],
  openGraph: {
    title: "ReadGrid — Електронна бібліотека",
    description: "Сучасна система електронної бібліотеки з великим каталогом книг",
    url: "https://readgridproject.onrender.com",
    siteName: "ReadGrid",
    locale: "uk_UA",
    type: "website",
  },
  icons: {
    icon: "/logo1.png?v=2",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ToastProvider>
          <ErrorBoundary fallbackTitle="Помилка на сторінці">
            {children}
          </ErrorBoundary>
          <ScrollToTop />
          <HomeButton />
          <AiWidget /> {}
        </ToastProvider>
      </body>
    </html>
  );
}