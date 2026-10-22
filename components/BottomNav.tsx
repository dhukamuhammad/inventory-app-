"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, Menu } from "lucide-react";

export function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Inventory", href: "/inventory", icon: Package },
    { name: "Menu", href: "/menu", icon: Menu },
  ];

  return (
    <nav className="md:hidden fixed bottom-3.5 inset-x-4 max-w-xs mx-auto z-50 bg-white/95 backdrop-blur-xl rounded-full px-3 py-1.5 shadow-[0_12px_36px_-6px_rgba(0,0,0,0.12)] border border-white/80 ring-1 ring-black/[0.04] flex items-center justify-around">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.name}
            href={item.href}
            className="flex-1 flex flex-col items-center justify-center py-0.5 transition-all active:scale-95 cursor-pointer"
          >
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ${
                isActive
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30 scale-105"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <Icon className={`w-4.5 h-4.5 ${isActive ? "text-white stroke-[2.2]" : "text-gray-400 stroke-[1.8]"}`} />
            </div>
            <span
              className={`text-[10px] tracking-tight mt-0.5 transition-colors ${
                isActive ? "font-bold text-indigo-600" : "font-medium text-gray-500"
              }`}
            >
              {item.name}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
