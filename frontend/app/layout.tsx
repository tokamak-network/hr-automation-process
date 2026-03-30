import type { Metadata } from "next";
import "./globals.css";
import { UserProvider } from "./UserContext";
import UserSelector from "./UserSelector";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Tokamak HR Solution",
  description: "Hiring & HR Management for Tokamak Network",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-white text-gray-900">
        <UserProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex-1 flex flex-col min-h-screen overflow-auto">
              {/* Top bar with UserSelector */}
              <header className="h-14 border-b border-gray-200 flex items-center justify-end px-6 shrink-0 bg-white sticky top-0 z-40">
                <UserSelector />
              </header>
              <main className="flex-1 p-8 max-w-6xl">{children}</main>
            </div>
          </div>
        </UserProvider>
      </body>
    </html>
  );
}
