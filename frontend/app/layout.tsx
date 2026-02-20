import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tokamak Hiring Framework",
  description: "AI-powered hiring pipeline for Tokamak Network",
};

const navLinks = [
  { href: "/", label: "Candidates" },
  { href: "/submit", label: "Submit" },
  { href: "/monitor", label: "Monitor" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 min-h-screen">
        <nav className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-6">
            <span className="font-bold text-lg text-blue-400">⚛ Tokamak Hiring</span>
            {navLinks.map(l => (
              <a key={l.href} href={l.href} className="text-sm text-gray-400 hover:text-white transition">{l.label}</a>
            ))}
          </div>
        </nav>
        <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
