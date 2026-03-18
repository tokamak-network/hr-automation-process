"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";

const nav = [
  { href: "/dashboard", label: "대시보드", icon: "📊" },
  { href: "/members", label: "팀원 관리", icon: "👥" },
  { href: "/payroll", label: "급여 관리", icon: "💰" },
  { href: "/tax", label: "세금 시뮬레이션", icon: "🧮" },
  { href: "http://localhost:3001", label: "채용 (Hiring)", icon: "🔍", external: true },
  { href: "/settings", label: "설정", icon: "⚙️" },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-64 shrink-0 border-r flex flex-col h-screen sticky top-0"
      style={{ background: "var(--color-bg-secondary)", borderColor: "var(--color-border)" }}>
      <div className="p-5 flex items-center gap-2.5 border-b" style={{ borderColor: "var(--color-border)" }}>
        <img src="/tokamak-symbol.png" alt="Tokamak" className="h-9 w-auto" />
        <div>
          <div className="font-bold text-sm" style={{ color: "var(--color-text)" }}>Tokamak</div>
          <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>HR Solution</div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {nav.map((n) => {
          const active = pathname?.startsWith(n.href) && !n.external;
          const El = n.external ? "a" : Link;
          const props: any = n.external ? { href: n.href, target: "_blank", rel: "noopener" } : { href: n.href };
          return (
            <El key={n.href} {...props}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active ? "text-white" : ""
              }`}
              style={{
                background: active ? "var(--color-primary)" : "transparent",
                color: active ? "#fff" : "var(--color-text-secondary)",
              }}>
              <span className="text-base">{n.icon}</span>
              {n.label}
              {n.external && <span className="ml-auto text-xs opacity-50">↗</span>}
            </El>
          );
        })}
      </nav>
      <div className="p-4 border-t text-xs" style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}>
        Tokamak HR v0.1.0
      </div>
    </aside>
  );
}
