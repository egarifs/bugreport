export default function TestCasesLoading() {
  return (
    <div className="flex-1 flex flex-col p-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-200">
        <div className="h-6 w-56 bg-slate-200 rounded" />
        <div className="h-9 w-36 bg-slate-200 rounded" />
      </div>

      {/* Two Column Layout Skeleton */}
      <div className="flex flex-col md:flex-row gap-6 mt-6 flex-1 min-h-[500px]">
        {/* Left Sidebar Skeleton */}
        <div className="w-full md:w-64 border border-slate-200 rounded-lg p-3 space-y-3 bg-white">
          <div className="h-4 w-28 bg-slate-200 rounded mb-4" />
          <div className="h-8 w-full bg-slate-100 rounded" />
          <div className="space-y-2 pt-2">
            <div className="h-8 w-full bg-slate-200 rounded" />
            <div className="h-8 w-full bg-slate-100 rounded" />
            <div className="h-8 w-full bg-slate-100 rounded" />
          </div>
        </div>

        {/* Right Table Skeleton */}
        <div className="flex-1 border border-slate-200 rounded-lg p-4 bg-white space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-5 w-40 bg-slate-200 rounded" />
            <div className="h-8 w-48 bg-slate-100 rounded" />
          </div>
          <div className="border border-slate-100 rounded divide-y divide-slate-100">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="p-4 flex items-center justify-between gap-4">
                <div className="h-4 w-24 bg-slate-200 rounded" />
                <div className="h-4 w-1/2 bg-slate-100 rounded" />
                <div className="h-5 w-16 bg-slate-200 rounded" />
                <div className="h-4 w-20 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
