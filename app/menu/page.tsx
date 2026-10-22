"use client";

import Link from "next/link";
import { 
  ArrowLeftRight, 
  BarChart3, 
  Building2, 
  ChevronRight, 
  ShieldCheck, 
  Sparkles, 
  Smartphone, 
  Database, 
  HelpCircle, 
  Bell, 
  RefreshCw,
  Warehouse,
  ExternalLink
} from "lucide-react";
import { useState } from "react";

export default function MobileMenuPage() {
  const [autoSync, setAutoSync] = useState(true);
  const [notifications, setNotifications] = useState(true);

  return (
    <div className="max-w-md mx-auto space-y-4 pb-20 animate-in fade-in duration-200">
      
      {/* Profile & Branding Header */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm relative overflow-hidden">
        {/* Soft decorative gradient background */}
        <div className="absolute top-0 right-0 w-44 h-44 bg-gradient-to-br from-indigo-50/80 to-blue-50/30 rounded-full blur-2xl -mr-12 -mt-12 pointer-events-none" />

        <div className="flex items-center gap-4 relative z-10">
          {/* Logo container using desktop sidebar image */}
          <div className="w-16 h-16 rounded-2xl bg-white border border-gray-100 shadow-sm p-1.5 flex items-center justify-center flex-shrink-0">
            <img 
              src="/logo.png" 
              alt="ScoviX" 
              className="w-full h-full object-contain"
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-800 tracking-tight">ScoviX</h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-150">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-medium truncate">
              Warehouse & Inventory Operations
            </p>
            <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1">
                <Warehouse className="w-3 h-3 text-slate-400" /> Hub-01
              </span>
              <span>•</span>
              <span className="text-indigo-600 font-medium">Enterprise Suite</span>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Navigation Hub (Movements & Analytics) */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
          Operations & Insights
        </h2>

        <div className="grid grid-cols-1 gap-2.5">
          {/* Stock Movements Card */}
          <Link
            href="/movements"
            className="group bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-between"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-indigo-50/80 flex items-center justify-center text-indigo-600 group-hover:scale-105 transition-transform">
                <ArrowLeftRight className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">
                    Stock Movements
                  </h3>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-600">
                    Ledger
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Track in, out, returns & audit logs
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
          </Link>

          {/* Business Analytics Card */}
          <Link
            href="/analytics"
            className="group bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-between"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-emerald-50/80 flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-transform">
                <BarChart3 className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-800 group-hover:text-emerald-600 transition-colors">
                    Business Analytics
                  </h3>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-600">
                    Reports
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Sales velocity, return rates & channel trends
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
          </Link>
        </div>
      </div>

      {/* Static Information Cards */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
          Warehouse & System Info
        </h2>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50 overflow-hidden">
          {/* Location */}
          <div className="p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-500">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700">Primary Warehouse</p>
                <p className="text-[11px] text-slate-400">Hub 01 • Surat, Gujarat</p>
              </div>
            </div>
            <span className="text-[11px] font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md">
              Active
            </span>
          </div>

          {/* Database & Cloud status */}
          <div className="p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-500">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700">Database Engine</p>
                <p className="text-[11px] text-slate-400">PostgreSQL (Prisma 7 • Low Latency)</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Connected
            </span>
          </div>

          {/* Security & Access */}
          <div className="p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-500">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700">Security & Encryption</p>
                <p className="text-[11px] text-slate-400">Role-Based Access Control</p>
              </div>
            </div>
            <span className="text-[11px] font-medium text-slate-500">
              256-bit SSL
            </span>
          </div>
        </div>
      </div>

      {/* Quick Settings & App Preferences */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
          Preferences
        </h2>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50 overflow-hidden">
          {/* Auto-Sync Toggle */}
          <div className="p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-500">
                <RefreshCw className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700">Realtime Auto-Sync</p>
                <p className="text-[11px] text-slate-400">Background inventory polling</p>
              </div>
            </div>
            <button
              onClick={() => setAutoSync(!autoSync)}
              className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none ${
                autoSync ? "bg-indigo-600" : "bg-slate-200"
              }`}
            >
              <span
                className={`block w-4 h-4 rounded-full bg-white transition-transform transform shadow-sm ${
                  autoSync ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Low Stock Alerts */}
          <div className="p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-500">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-700">Stock Threshold Alerts</p>
                <p className="text-[11px] text-slate-400">Notify when stock is below 15%</p>
              </div>
            </div>
            <button
              onClick={() => setNotifications(!notifications)}
              className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none ${
                notifications ? "bg-indigo-600" : "bg-slate-200"
              }`}
            >
              <span
                className={`block w-4 h-4 rounded-full bg-white transition-transform transform shadow-sm ${
                  notifications ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* App Version & Credits */}
      <div className="text-center pt-2 pb-4 space-y-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
          <Smartphone className="w-3.5 h-3.5 text-slate-400" />
          ScoviX App v1.2.0 • Pro
        </div>
        <p className="text-[11px] text-slate-400">
          Powered by Next.js & Supabase Cloud
        </p>
      </div>

    </div>
  );
}
