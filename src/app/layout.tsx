import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import App from "@/components/App";
import "./globals.css";

const bodyFont = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gelang GPS",
  description: "Pemantauan gelang GPS warga binaan, Lapas Cebongan",
  // Internal tool: keep it out of search engines.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${bodyFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <App>{children}</App>
      </body>
    </html>
  );
}
