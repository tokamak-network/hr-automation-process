import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Tokamak HR Solution",
  description: "Payroll & Tax Management for Tokamak Network",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen flex" style={{ background: "var(--color-bg)" }}>
        <Sidebar />
        <main className="flex-1 min-h-screen overflow-auto p-8">{children}</main>
      </body>
    </html>
  );
}
