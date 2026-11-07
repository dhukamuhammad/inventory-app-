export default function ReturnsLoading() {
  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-gray-200 rounded-lg" />
          <div className="h-4 w-72 bg-gray-100 rounded-md" />
        </div>
        <div className="h-10 w-32 bg-gray-200 rounded-xl" />
      </div>

      {/* Metric Cards Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-2">
            <div className="h-3 w-20 bg-gray-100 rounded" />
            <div className="h-7 w-14 bg-gray-200 rounded-lg" />
          </div>
        ))}
      </div>

      {/* Scanner & Search Box Skeleton */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="h-12 bg-gray-50 rounded-xl" />
        <div className="h-32 bg-gray-50 rounded-xl" />
      </div>

      {/* Recent Returns Table Skeleton */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-50 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

