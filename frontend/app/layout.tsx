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
          <nav className="border-b border-gray-200 sticky top-0 z-50 bg-white">
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-8">
              <a href="/" className="flex items-center gap-2.5 shrink-0">
                <img src="/tokamak-symbol.png" alt="Tokamak" className="h-10 w-auto -mr-1" />
                <span className="text-xl font-bold tracking-tight text-[#1C1C1C]">Tokamak Hiring</span>
              </a>
              {navLinks.map(l => (
                <a key={l.href} href={l.href} className="text-sm text-gray-500 hover:text-[#1C1C1C] transition font-medium">{l.label}</a>
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
