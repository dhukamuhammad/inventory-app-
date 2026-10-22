"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, ArrowLeftRight, BarChart3, Settings } from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Inventory", href: "/inventory", icon: Package },
    { name: "Movements", href: "/movements", icon: ArrowLeftRight },
    { name: "Analytics", href: "/analytics", icon: BarChart3 },
  ];

  return (
    <aside className="w-64 bg-white border-r border-gray-200 hidden md:flex flex-col h-full">
      <div className="h-16 flex items-center px-6 border-b border-gray-200 overflow-hidden">
        <div className="flex items-center justify-start w-full h-full relative">
          <img 
            src="/logo.png" 
            alt="ScoviX Logo" 
            className="absolute max-w-none" 
            style={{ width: '160px', objectFit: 'contain' }}
          />
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                isActive
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? "text-blue-700" : "text-slate-400"}`} />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
