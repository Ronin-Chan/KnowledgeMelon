import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LocaleProvider } from "@/components/locale-provider";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Knowledge Melon",
  description: "Your workspace for knowledge, memory, and chat",
};

const themeInitScript = `
(() => {
  try {
    const raw = localStorage.getItem("settings-storage");
    const parsed = raw ? JSON.parse(raw) : null;
    const theme = parsed?.state?.theme === "dark" ? "dark" : "light";
    const root = document.documentElement;
    const bg = theme === "dark" ? "#171717" : "#ffffff";
    const fg = theme === "dark" ? "#fafafa" : "#171717";

    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
    root.style.backgroundColor = bg;
    root.style.color = fg;

    const applyBodyTheme = () => {
      if (!document.body) return;
      document.body.style.backgroundColor = bg;
      document.body.style.color = fg;
    };

    applyBodyTheme();
    document.addEventListener("DOMContentLoaded", applyBodyTheme, { once: true });
  } catch (_) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="dark light" />
        <style>{`html,body{min-height:100%;background:#171717;color:#fafafa;}`}</style>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider>
          <LocaleProvider>{children}</LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
