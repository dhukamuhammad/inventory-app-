"use client";

import Link from "next/link";
import { 
  ArrowLeftRight, 
  BarChart3, 
  Building2, 
  ChevronRight, 
  ShieldCheck, 
  Smartphone, 
  Database, 
  Bell, 
  RefreshCw, 
  Warehouse, 
  GitFork,
  User,
  CheckCircle2,
  Mail,
  MapPin,
  RotateCcw,
  FileText
} from "lucide-react";
import { useState } from "react";

export default function ProfilePage() {
  const [autoSync, setAutoSync] = useState(true);
  const [notifications, setNotifications] = useState(true);

  return (
    <div className="max-w-md mx-auto space-y-4 pb-24 animate-in fade-in duration-200">
      
      {/* Page Header */}
      <div className="flex items-center justify-between pt-1 px-1">
        <div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Sync
          </span>
          <h1 className="text-xl font-bold text-gray-900 mt-1">My Profile</h1>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
          <Warehouse className="w-3.5 h-3.5 text-gray-400" />
          Hub 01 • Surat
        </div>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm relative overflow-hidden">
        <div className="flex items-center gap-3.5">
          {/* Avatar */}
          <div className="w-13 h-13 rounded-2xl bg-indigo-50 border border-indigo-100/60 flex items-center justify-center text-indigo-600 font-bold text-lg flex-shrink-0 shadow-xs">
            <User className="w-6 h-6 stroke-[2.2]" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-gray-900 truncate">Warehouse Manager</h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700">
                Admin
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
              <Mail className="w-3 h-3 text-gray-400 flex-shrink-0" />
              <span className="truncate">admin@scovix.internal</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mt-0.5">
              <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
              <span>Surat Fulfillment Center</span>
            </div>
          </div>
        </div>
      </div>

      {/* Operations & Modules Shortcuts */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
          Operations & Modules
        </h3>

        <div className="space-y-2.5">
          {/* Dispatch History Card */}
          <Link
            href="/dispatch-history"
            className="group bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-between active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:scale-105 transition-transform">
                <FileText className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                    Dispatch History
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700">
                    PDF Batches
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Track uploaded labels, couriers & undo dispatches
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
          </Link>

          {/* SKU Mappings Card */}
          <Link
            href="/mappings"
            className="group bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-between active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 group-hover:scale-105 transition-transform">
                <GitFork className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">
                    SKU Mappings
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700">
                    Channels
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Decode Meesho, Flipkart & Amazon listings
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all" />
          </Link>

          {/* Returns & RTO Management Card */}
          <Link
            href="/returns"
            className="group bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-between active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 group-hover:scale-105 transition-transform">
                <RotateCcw className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900 group-hover:text-amber-600 transition-colors">
                    Returns & RTO Inward
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700">
                    Order ID / AWB
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Instant packet lookup, RTO vs customer QC & stock restock
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
          </Link>

          {/* Stock Movements Card */}
          <Link
            href="/movements"
            className="group bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-between active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:scale-105 transition-transform">
                <ArrowLeftRight className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                    Stock Movements
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700">
                    Ledger
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Track in, out, returns & audit logs
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
          </Link>

          {/* Business Analytics Card */}
          <Link
            href="/analytics"
            className="group bg-white rounded-2xl p-3.5 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-between active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-transform">
                <BarChart3 className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors">
                    Business Analytics
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                    Reports
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Sales velocity, return rates & channel trends
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
          </Link>
        </div>
      </div>

      {/* Warehouse & System Info */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
          Warehouse & System Info
        </h3>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100 overflow-hidden">
          {/* Facility */}
          <div className="p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-600">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-900">Primary Facility</p>
                <p className="text-[11px] text-gray-500">Hub 01 • Surat Warehouse</p>
              </div>
            </div>
            <span className="text-[11px] font-medium text-gray-600 bg-gray-50 px-2 py-0.5 rounded-md">
              Active
            </span>
          </div>

          {/* Database Engine */}
          <div className="p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-900">Database Engine</p>
                <p className="text-[11px] text-gray-500">PostgreSQL (Prisma 7 • Low Latency)</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Connected
            </span>
          </div>

          {/* Security & Access */}
          <div className="p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-900">Security & Encryption</p>
                <p className="text-[11px] text-gray-500">Role-Based Access Control</p>
              </div>
            </div>
            <span className="text-[11px] font-medium text-gray-600 bg-gray-50 px-2 py-0.5 rounded-md">
              256-bit SSL
            </span>
          </div>
        </div>
      </div>

      {/* App Preferences */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
          App Preferences
        </h3>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100 overflow-hidden">
          {/* Auto-Sync Toggle */}
          <div className="p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                <RefreshCw className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-900">Realtime Auto-Sync</p>
                <p className="text-[11px] text-gray-500">Background inventory polling</p>
              </div>
            </div>
            <button
              onClick={() => setAutoSync(!autoSync)}
              className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none ${
                autoSync ? "bg-indigo-600" : "bg-gray-200"
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
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-900">Stock Threshold Alerts</p>
                <p className="text-[11px] text-gray-500">Notify when stock is below 15%</p>
              </div>
            </div>
            <button
              onClick={() => setNotifications(!notifications)}
              className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none ${
                notifications ? "bg-indigo-600" : "bg-gray-200"
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
      <div className="text-center pt-2 pb-2 space-y-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
          <Smartphone className="w-3.5 h-3.5 text-gray-400" />
          ScoviX App v1.2.0 • Pro
        </div>
        <p className="text-[11px] text-gray-400">
          Powered by Next.js & Supabase Cloud
        </p>
      </div>

    </div>
  );
}
