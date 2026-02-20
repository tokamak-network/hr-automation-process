import type { Metadata } from "next";
import "./globals.css";
import { UserProvider } from "./UserContext";
import UserSelector from "./UserSelector";

export const metadata: Metadata = {
  title: "Tokamak Hiring Framework",
  description: "AI-powered hiring pipeline for Tokamak Network",
};

const navLinks = [
  { href: "/submit", label: "Submit" },
  { href: "/monitor", label: "Monitor" },
  { href: "/linkedin", label: "LinkedIn" },
  { href: "/team", label: "Team" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900">
        <UserProvider>
          <nav className="border-b border-gray-800 sticky top-0 z-50" style={{ background: "#1C1C1C" }}>
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-6">
              <a href="/" className="flex items-center gap-2 shrink-0">
                <img src="/tokamak-logo-white.png" alt="Tokamak Network" className="h-8 w-auto" />
                <span className="text-base font-semibold text-white">Hiring</span>
              </a>
              {navLinks.map(l => (
                <a key={l.href} href={l.href} className="text-sm text-gray-400 hover:text-white transition">{l.label}</a>
              ))}
              <div className="ml-auto">
                <UserSelector />
              </div>
            </div>
          </nav>
          <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
        </UserProvider>
      </body>
    </html>
  );
}
