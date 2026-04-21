"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";

const sections = [
  {
    title: "채용",
    items: [
      { href: "/submit", label: "Submit", icon: "📝" },
      { href: "/monitor", label: "Monitor", icon: "📡" },
      { href: "/linkedin", label: "Developer Sourcing", icon: "🔍" },
      { href: "/team", label: "Team", icon: "👥" },
    ],
  },
  {
    title: "HR 관리",
    items: [
      { href: "/hr/dashboard", label: "대시보드", icon: "📊" },
      { href: "/hr/members", label: "팀원 관리", icon: "👤" },
      { href: "/hr/payroll", label: "급여 관리", icon: "💰" },
      { href: "/hr/expenses", label: "경비 정산", icon: "🧾" },
      { href: "/hr/fiat", label: "법인 입출금", icon: "🏦" },
      { href: "/hr/calculate", label: "급여 계산", icon: "📋" },
      { href: "/hr/tax", label: "세금 시뮬레이션", icon: "🧮" },
      { href: "/hr/settings", label: "설정", icon: "⚙️" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 border-r border-gray-200 flex flex-col h-screen sticky top-0 bg-white">
      {/* Logo */}
      <div className="p-5 flex items-center gap-1.5 border-b border-gray-200">
        <img src="/tokamak-symbol.png" alt="Tokamak" className="h-[42px] w-[42px] object-contain -m-1" />
        <div>
          <div className="font-bold text-sm text-[#1C1C1C]">Tokamak Network</div>
          <div className="text-xs text-gray-400">HR Solution</div>
        </div>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-5">
        {sections.map((section) => (
          <div key={section.title}>
            <div className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              {section.title}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? "bg-[#2A72E5] text-white"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <span className="text-base">{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 text-xs text-gray-400">
        Tokamak HR v0.2.0
      </div>
    </aside>
  );
}
