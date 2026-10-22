import { 
  Package, 
  TrendingUp, 
  AlertCircle, 
  ArrowUpRight, 
  ArrowDownRight, 
  Undo2, 
  Plus, 
  CheckCircle2, 
  ChevronRight,
  Boxes,
  Activity,
  BarChart3
} from "lucide-react";
import Link from "next/link";
import prisma from "@/lib/prisma";

export default async function DashboardPage() {
  const [products, recentMovements, allMovements] = await Promise.all([
    prisma.product.findMany({
      include: {
        category: true,
      },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.stockMovement.findMany({
      take: 6,
      orderBy: { date: "desc" },
      include: {
        product: true,
        platform: true,
      },
    }),
    prisma.stockMovement.findMany({
      select: {
        type: true,
        quantity: true,
        platformId: true,
        platform: {
          select: { id: true, name: true },
        },
      },
    }),
  ]);

  const totalProducts = products.length;
  const totalValue = products.reduce((sum, p) => sum + (p.costPrice * p.currentStock), 0);
  const totalUnits = products.reduce((sum, p) => sum + p.currentStock, 0);
  const defectiveUnits = products.reduce((sum, p) => sum + (p.defectiveStock || 0), 0);
  const defectiveLoss = products.reduce((sum, p) => sum + ((p.defectiveStock || 0) * (p.costPrice || 0)), 0);
  
  // Calculate overall sales & returns performance
  let totalSold = 0;
  let totalReturns = 0;
  let totalRto = 0;
  let totalCustomer = 0;
  const platformStatsMap: Record<string, { name: string; sold: number; returns: number }> = {};

  allMovements.forEach((m) => {
    if (m.type === "OUT") {
      totalSold += m.quantity;
      if (m.platform) {
        if (!platformStatsMap[m.platform.id]) {
          platformStatsMap[m.platform.id] = { name: m.platform.name, sold: 0, returns: 0 };
        }
        platformStatsMap[m.platform.id].sold += m.quantity;
      }
    } else if (m.type.startsWith("RETURN")) {
      totalReturns += m.quantity;
      if (m.type.includes("RTO")) totalRto += m.quantity;
      else totalCustomer += m.quantity;

      if (m.platform) {
        if (!platformStatsMap[m.platform.id]) {
          platformStatsMap[m.platform.id] = { name: m.platform.name, sold: 0, returns: 0 };
        }
        platformStatsMap[m.platform.id].returns += m.quantity;
      }
    }
  });

  const overallReturnRate = totalSold > 0 ? (totalReturns / totalSold) * 100 : 0;
  const platformSummaries = Object.values(platformStatsMap).map((p) => ({
    ...p,
    rate: p.sold > 0 ? (p.returns / p.sold) * 100 : 0,
  })).sort((a, b) => b.sold - a.sold);

  // Calculate low stock items using dynamic threshold
  const lowStockProducts = products.filter(p => p.currentStock <= p.lowStockAlertAt);
  const lowStockCount = lowStockProducts.length;

  return (
    <div>
      {/* ============================================================== */}
      {/* 📱 MOBILE VIEW (md:hidden) — True Native App Interface         */}
      {/* ============================================================== */}
      <div className="md:hidden flex flex-col gap-4 pb-6">
        {/* App Header Greeting */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Sync
            </span>
            <h1 className="text-xl font-bold text-gray-900 mt-1">Dashboard</h1>
          </div>
          <Link
            href="/inventory"
            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl active:bg-indigo-100 transition-colors"
          >
            <Boxes className="w-4 h-4" />
            Inventory
          </Link>
        </div>

        {/* 1. Hero Valuation Card (Modern Indigo Vibrant Gradient Style) */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-blue-600 text-white p-5 shadow-lg shadow-indigo-500/20">
          {/* Subtle background glow */}
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-blue-400/20 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10">
            <div className="flex items-center justify-between text-indigo-100 text-xs font-medium tracking-wide">
              <span>TOTAL INVENTORY VALUATION</span>
              <span className="bg-white/20 backdrop-blur-xs px-2 py-0.5 rounded-md text-[10px] text-white font-semibold">
                At Cost
              </span>
            </div>

            <div className="mt-2 text-3xl font-black tracking-tight text-white flex items-baseline gap-1">
              <span>₹</span>
              <span>{totalValue.toLocaleString()}</span>
            </div>

            <div className="mt-4 pt-3.5 border-t border-white/15 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-white/10 backdrop-blur-xs py-1.5 px-2 rounded-xl">
                <p className="text-indigo-100 text-[10px]">Total Units</p>
                <p className="font-bold text-white mt-0.5">{totalUnits.toLocaleString()}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-xs py-1.5 px-2 rounded-xl">
                <p className="text-indigo-100 text-[10px]">Total SKUs</p>
                <p className="font-bold text-white mt-0.5">{totalProducts}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-xs py-1.5 px-2 rounded-xl">
                <p className="text-indigo-100 text-[10px]">Defective</p>
                <p className={`font-bold mt-0.5 ${defectiveUnits > 0 ? 'text-amber-200' : 'text-white'}`}>
                  {defectiveUnits}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Compact 2-Column Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Card: Active SKUs */}
          <Link
            href="/inventory"
            className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm active:scale-[0.98] transition-transform flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Package className="w-5 h-5" />
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </div>
            <div className="mt-3">
              <p className="text-2xl font-bold text-gray-900">{totalProducts}</p>
              <p className="text-xs font-medium text-gray-500 mt-0.5">Active Products</p>
            </div>
          </Link>

          {/* Card: Low Stock Alerts */}
          <Link
            href="/inventory"
            className={`p-4 rounded-2xl border border-gray-100 shadow-sm active:scale-[0.98] transition-transform flex flex-col justify-between ${
              lowStockCount > 0 
                ? "bg-rose-50/40" 
                : "bg-emerald-50/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                lowStockCount > 0 ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"
              }`}>
                {lowStockCount > 0 ? (
                  <AlertCircle className="w-5 h-5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
              </div>
              <ChevronRight className={`w-4 h-4 ${lowStockCount > 0 ? "text-rose-300" : "text-emerald-300"}`} />
            </div>
            <div className="mt-3">
              <p className={`text-2xl font-bold ${lowStockCount > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                {lowStockCount}
              </p>
              <p className={`text-xs font-medium mt-0.5 ${lowStockCount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                {lowStockCount > 0 ? "Low Stock Alerts" : "All Healthy"}
              </p>
            </div>
          </Link>
        </div>

        {/* Business Performance Summary Card (Synchronized with Dashboard Theme) */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3.5">
          {/* Card Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 leading-tight">Business Performance</h3>
                <p className="text-xs text-gray-400 font-medium">Sales vs returns overview</p>
              </div>
            </div>
            <Link
              href="/analytics"
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-xl transition-colors active:scale-95"
            >
              Analytics <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Open Metrics Row (Fintech Style - No Box In A Box) */}
          <div className="grid grid-cols-3 items-end pt-1">
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalSold.toLocaleString()}</p>
              <p className="text-xs font-medium text-gray-400 mt-0.5">Sold Units</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-rose-600">{totalReturns.toLocaleString()}</p>
              <p className="text-xs font-medium text-rose-500/80 mt-0.5">Returned</p>
            </div>
            <div className="text-right">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold ${
                overallReturnRate > 20
                  ? "bg-rose-50 text-rose-700"
                  : overallReturnRate >= 12
                  ? "bg-amber-50 text-amber-700"
                  : "bg-emerald-50 text-emerald-700"
              }`}>
                {overallReturnRate.toFixed(1)}% Rate
              </span>
              <p className="text-[10px] text-gray-400 mt-0.5 font-medium">
                {overallReturnRate < 12 ? "Healthy" : overallReturnRate <= 20 ? "Moderate" : "Critical"}
              </p>
            </div>
          </div>

          {/* Dual Split Visual Track */}
          <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden flex">
            <div
              className="h-full bg-emerald-500 transition-all rounded-l-full"
              style={{ width: `${totalSold > 0 ? ((totalSold - totalReturns) / totalSold) * 100 : 100}%` }}
              title={`Kept: ${totalSold - totalReturns}`}
            />
            <div
              className="h-full bg-rose-500 transition-all rounded-r-full"
              style={{ width: `${totalSold > 0 ? (totalReturns / totalSold) * 100 : 0}%` }}
              title={`Returns: ${totalReturns}`}
            />
          </div>

          {/* Footer Info Row */}
          <div className="flex items-center justify-between text-[11px] font-medium text-gray-500 pt-0.5">
            <span>
              <strong className="text-emerald-700 font-bold">{Math.max(totalSold - totalReturns, 0).toLocaleString()}</strong> orders retained
            </span>
            <span className="text-gray-400">
              {platformSummaries.length} Channels Active
            </span>
          </div>
        </div>

        {/* 3. Attention Required: Restock Items */}
        {lowStockCount > 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-rose-50/50 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <h3 className="text-xs font-bold text-rose-900 uppercase tracking-wide">
                  Items Needing Restock ({lowStockCount})
                </h3>
              </div>
              <Link href="/inventory" className="text-xs font-semibold text-rose-600">
                Fix All →
              </Link>
            </div>

            <div className="divide-y divide-gray-100">
              {lowStockProducts.map((item) => (
                <div key={item.id} className="p-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
                      <span className="font-mono text-gray-400">{item.sku}</span>
                      <span>•</span>
                      <span>₹{item.costPrice.toLocaleString()}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right">
                      <span className="inline-block px-2 py-0.5 text-xs font-bold rounded-md bg-rose-50 text-rose-700">
                        {item.currentStock} left
                      </span>
                      <p className="text-[10px] text-gray-400 mt-0.5">Limit: {item.lowStockAlertAt}</p>
                    </div>
                    <Link
                      href="/inventory"
                      className="px-2.5 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-xl shadow-xs active:bg-indigo-700"
                    >
                      + IN
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-emerald-50/60 border border-gray-100 rounded-2xl p-4 flex items-center gap-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-900">All Stock Healthy</p>
              <p className="text-xs text-emerald-700 mt-0.5">No products have reached their low stock threshold.</p>
            </div>
          </div>
        )}

        {/* 5. Recent Activity Feed */}
        {recentMovements.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-gray-400" />
                <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                  Recent Movements
                </h3>
              </div>
              <Link href="/movements" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                View all →
              </Link>
            </div>

            <div className="space-y-2">
              {recentMovements.map((m) => {
                const isIN = m.type === "IN";
                const isOUT = m.type === "OUT";
                const isRtoGood = m.type === "RETURN_RTO";
                const isRtoDefect = m.type === "RETURN_RTO_DEFECTIVE";
                const isCustGood = m.type === "RETURN_GOOD";
                const isCustDefect = m.type === "RETURN_DEFECTIVE";

                let badgeLabel = "Movement";
                let iconBg = "bg-gray-50 text-gray-600";
                let qtyClass = "text-gray-700 bg-gray-50";
                let qtyPrefix = "";

                if (isIN) {
                  badgeLabel = "Stock IN";
                  iconBg = "bg-emerald-50 text-emerald-600";
                  qtyClass = "text-emerald-700 bg-emerald-50";
                  qtyPrefix = "+";
                } else if (isOUT) {
                  badgeLabel = "Sold / Out";
                  iconBg = "bg-rose-50 text-rose-600";
                  qtyClass = "text-rose-700 bg-rose-50";
                  qtyPrefix = "-";
                } else if (isRtoGood) {
                  badgeLabel = "RTO (Good)";
                  iconBg = "bg-amber-50 text-amber-700";
                  qtyClass = "text-amber-800 bg-amber-50";
                  qtyPrefix = "↺+";
                } else if (isRtoDefect) {
                  badgeLabel = "RTO (Defect)";
                  iconBg = "bg-red-50 text-red-600";
                  qtyClass = "text-red-800 bg-red-50";
                  qtyPrefix = "↺!";
                } else if (isCustGood) {
                  badgeLabel = "Cust Good";
                  iconBg = "bg-teal-50 text-teal-700";
                  qtyClass = "text-teal-800 bg-teal-50";
                  qtyPrefix = "↺+";
                } else if (isCustDefect) {
                  badgeLabel = "Cust Defect";
                  iconBg = "bg-orange-50 text-orange-600";
                  qtyClass = "text-orange-800 bg-orange-50";
                  qtyPrefix = "↺!";
                }

                return (
                  <div key={m.id} className="flex items-center justify-between text-xs py-1.5 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                        {isIN && <ArrowDownRight className="w-4 h-4" />}
                        {isOUT && <ArrowUpRight className="w-4 h-4" />}
                        {(isRtoGood || isCustGood) && <Undo2 className="w-4 h-4" />}
                        {(isRtoDefect || isCustDefect) && <AlertCircle className="w-4 h-4" />}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-gray-800 truncate">{m.product.name}</p>
                          <span className="text-[10px] font-semibold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
                            {badgeLabel}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {m.platform ? m.platform.name : "Manual"} • {new Date(m.date).toLocaleDateString()}
                          {m.unitCost && m.unitCost > 0 && ` • ₹${m.unitCost}/unit`}
                        </p>
                      </div>
                    </div>

                    <span className={`font-bold font-mono px-2 py-0.5 rounded-md shrink-0 ${qtyClass}`}>
                      {qtyPrefix}{m.quantity}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 🖥️ DESKTOP VIEW (hidden md:block) — Modern Soft Design         */}
      {/* ============================================================== */}
      <div className="hidden md:block space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
          <p className="mt-1 text-sm text-gray-500">
            A quick summary of your inventory and sales performance.
          </p>
        </div>

        {/* 3 Modern Summary Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {/* Total Products Card */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Total Products
              </span>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Package className="h-5 w-5" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline justify-between">
              <div>
                <p className="text-3xl font-black text-gray-900">{totalProducts}</p>
                <p className="text-xs text-gray-400 mt-0.5">Active catalog SKUs</p>
              </div>
              <Link href="/inventory" className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
                View all →
              </Link>
            </div>
          </div>

          {/* Total Value Card */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Total Inventory Value
              </span>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <TrendingUp className="h-5 w-5" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline justify-between">
              <div>
                <p className="text-3xl font-black text-gray-900">₹{totalValue.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-0.5">{totalUnits.toLocaleString()} total units in stock</p>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                At Cost Price
              </span>
            </div>
          </div>

          {/* Low Stock Alerts Card */}
          <div className={`p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between ${
            lowStockCount > 0 ? 'bg-rose-50/20' : 'bg-white'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold uppercase tracking-wider ${lowStockCount > 0 ? 'text-rose-600' : 'text-gray-500'}`}>
                Low Stock Alerts
              </span>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                lowStockCount > 0 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-50 text-emerald-600'
              }`}>
                <AlertCircle className="h-5 w-5" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline justify-between">
              <div>
                <p className={`text-3xl font-black ${lowStockCount > 0 ? 'text-rose-700' : 'text-gray-900'}`}>
                  {lowStockCount} <span className="text-xs font-semibold text-gray-400">Items</span>
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {lowStockCount > 0 ? "Threshold reached" : "All products healthy"}
                </p>
              </div>
              <Link href="/inventory" className={`text-xs font-bold ${lowStockCount > 0 ? 'text-rose-600 hover:text-rose-800' : 'text-indigo-600 hover:text-indigo-800'} transition-colors`}>
                Resolve now →
              </Link>
            </div>
          </div>
        </div>

        {/* Desktop Overall Business Health & Returns Section */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between pb-5 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Total Business Health & Return Overview</h3>
                <p className="text-xs text-gray-500">Cross-channel sales vs return performance across all inventory products</p>
              </div>
            </div>
            <Link
              href="/analytics"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all"
            >
              View Detailed Analytics & Reports <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {/* 4 Executive Metric Tiles */}
          <div className="grid grid-cols-4 gap-4 mt-5">
            <div className="bg-gray-50/80 p-4 rounded-xl">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">All-Time Units Sold</span>
              <p className="text-2xl font-black text-gray-900 mt-1">{totalSold.toLocaleString()} <span className="text-xs font-normal text-gray-400">pcs</span></p>
            </div>
            <div className="bg-rose-50/60 p-4 rounded-xl">
              <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider">Total Units Returned</span>
              <p className="text-2xl font-black text-rose-700 mt-1">{totalReturns.toLocaleString()} <span className="text-xs font-normal text-rose-400">pcs</span></p>
            </div>
            <div className="bg-amber-50/60 p-4 rounded-xl">
              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Overall Return Rate</span>
              <p className="text-2xl font-black text-amber-800 mt-1">{overallReturnRate.toFixed(1)}%</p>
            </div>
            <div className="bg-emerald-50/60 p-4 rounded-xl">
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Net Retained Units</span>
              <p className="text-2xl font-black text-emerald-800 mt-1">{(totalSold - totalReturns).toLocaleString()} <span className="text-xs font-normal text-emerald-500">pcs</span></p>
            </div>
          </div>

          {/* Platform Performance Quick Grid */}
          {platformSummaries.length > 0 && (
            <div className="mt-5 pt-4 border-t border-gray-100">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">Channel Breakdown</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {platformSummaries.map((p) => (
                  <div key={p.name} className="p-3 bg-gray-50/80 rounded-xl border border-gray-100 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-gray-900">{p.name}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">{p.sold} Sold • {p.returns} Ret</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                      p.rate > 20 ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
                    }`}>
                      {p.rate.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Low Stock Items List */}
        {lowStockCount > 0 && (
          <div className="bg-white shadow-sm rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-rose-50/40">
              <h3 className="text-base font-bold text-rose-900 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-600" />
                Items Needing Restock
              </h3>
            </div>
            <ul role="list" className="divide-y divide-gray-100">
              {lowStockProducts.map((item) => (
                <li key={item.id} className="px-6 py-4 hover:bg-gray-50/60 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="h-10 w-10 flex-shrink-0 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center font-bold">
                        <Package className="h-5 w-5" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-bold text-gray-900">
                          {item.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{item.sku} • {item.category.name}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-4">
                        <p className="text-sm font-semibold text-gray-900">₹{item.costPrice.toLocaleString()}</p>
                        <p className="px-2.5 py-1 inline-flex text-xs font-bold rounded-lg bg-rose-50 text-rose-700">
                          {item.currentStock} in stock
                        </p>
                      </div>
                      <p className="text-xs text-rose-500 font-medium">(Alert set at {item.lowStockAlertAt})</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recent Stock Movements Card (Desktop) */}
        <div className="bg-white shadow-sm rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/40">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-gray-500" />
              <h3 className="text-base font-bold text-gray-900">
                Recent Stock Movements
              </h3>
            </div>
            <Link 
              href="/movements" 
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1"
            >
              View Full Ledger →
            </Link>
          </div>

          {recentMovements.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50/40 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3">Date & Time</th>
                    <th className="px-6 py-3">Product</th>
                    <th className="px-6 py-3">Action Type</th>
                    <th className="px-6 py-3">Channel</th>
                    <th className="px-6 py-3 text-right">Quantity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentMovements.map((m) => {
                    const isIN = m.type === "IN";
                    const isOUT = m.type === "OUT";
                    const isRtoGood = m.type === "RETURN_RTO";
                    const isRtoDefect = m.type === "RETURN_RTO_DEFECTIVE";
                    const isCustGood = m.type === "RETURN_GOOD";
                    const isCustDefect = m.type === "RETURN_DEFECTIVE";

                    let badgeText = "Movement";
                    let badgeClass = "bg-gray-100 text-gray-700";
                    let qtyPrefix = "";
                    let qtyClass = "text-gray-700";

                    if (isIN) {
                      badgeText = "Stock Added";
                      badgeClass = "bg-emerald-50 text-emerald-700 font-bold";
                      qtyPrefix = "+";
                      qtyClass = "text-emerald-700 font-bold";
                    } else if (isOUT) {
                      badgeText = "Sold / Out";
                      badgeClass = "bg-rose-50 text-rose-700 font-bold";
                      qtyPrefix = "-";
                      qtyClass = "text-rose-700 font-bold";
                    } else if (isRtoGood) {
                      badgeText = "RTO Return (Good)";
                      badgeClass = "bg-amber-50 text-amber-800 font-bold";
                      qtyPrefix = "↺+";
                      qtyClass = "text-amber-700 font-bold";
                    } else if (isRtoDefect) {
                      badgeText = "RTO Defective";
                      badgeClass = "bg-red-50 text-red-800 font-bold";
                      qtyPrefix = "↺!";
                      qtyClass = "text-red-700 font-bold";
                    } else if (isCustGood) {
                      badgeText = "Customer Return (Good)";
                      badgeClass = "bg-teal-50 text-teal-800 font-bold";
                      qtyPrefix = "↺+";
                      qtyClass = "text-teal-700 font-bold";
                    } else if (isCustDefect) {
                      badgeText = "Customer Return (Defective)";
                      badgeClass = "bg-orange-50 text-orange-800 font-bold";
                      qtyPrefix = "↺!";
                      qtyClass = "text-orange-700 font-bold";
                    }

                    return (
                      <tr key={m.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-3.5 whitespace-nowrap text-xs text-gray-500">
                          {new Date(m.date).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-6 py-3.5">
                          <p className="font-semibold text-gray-900">{m.product.name}</p>
                          <p className="text-xs text-gray-400 font-mono">
                            SKU: {m.product.sku}
                            {m.unitCost && m.unitCost > 0 && ` • Rate: ₹${m.unitCost}/unit`}
                          </p>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-xs ${badgeClass}`}>
                            {badgeText}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-xs text-gray-600 font-medium">
                          {m.platform ? (
                            <span className="inline-block px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                              {m.platform.name}
                            </span>
                          ) : (
                            <span className="text-gray-400">Manual Entry</span>
                          )}
                        </td>
                        <td className={`px-6 py-3.5 text-right font-mono text-sm ${qtyClass}`}>
                          {qtyPrefix}{m.quantity}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="p-6 text-sm text-gray-400 text-center">No recent stock movements recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
