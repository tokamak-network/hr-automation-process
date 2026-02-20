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
      <body className="min-h-screen" style={{ background: "var(--color-bg)", color: "var(--color-text)" }}>
        <UserProvider>
          <nav className="border-b sticky top-0 z-50 backdrop-blur" style={{ borderColor: "var(--color-border)", background: "rgba(15, 15, 26, 0.85)" }}>
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-6">
              <a href="/" className="flex items-center gap-2 shrink-0">
                <img src="/tokamak-logo-white.png" alt="Tokamak Network" className="h-7 w-auto" />
                <span className="text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>Hiring</span>
              </a>
              {navLinks.map(l => (
                <a key={l.href} href={l.href} className="text-sm hover:text-white transition" style={{ color: "var(--color-text-secondary)" }}>{l.label}</a>
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
