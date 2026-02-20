import type { Metadata } from "next";
import "./globals.css";
import { UserProvider } from "./UserContext";
import UserSelector from "./UserSelector";

export const metadata: Metadata = {
  title: "Tokamak Hiring Framework",
  description: "AI-powered hiring pipeline for Tokamak Network",
};

const navLinks = [
  { href: "/", label: "Candidates" },
  { href: "/submit", label: "Submit" },
  { href: "/monitor", label: "Monitor" },
  { href: "/linkedin", label: "LinkedIn" },
  { href: "/team", label: "Team" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 min-h-screen">
        <UserProvider>
          <nav className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-50">
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-6">
              <span className="font-bold text-lg text-blue-400">⚛ Tokamak Hiring</span>
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
