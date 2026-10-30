export default function ProjectPageLoading() {
  return (
    <div className="flex-1 flex flex-col p-6 animate-pulse">
      {/* Top Header Skeleton */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-200">
        <div className="space-y-2">
          <div className="h-6 w-52 bg-slate-200 rounded" />
          <div className="h-4 w-32 bg-slate-100 rounded" />
        </div>
        <div className="h-9 w-32 bg-slate-200 rounded" />
      </div>

      {/* Filter / Subheader Bar Skeleton */}
      <div className="flex items-center gap-3 py-4">
        <div className="h-8 w-24 bg-slate-200 rounded" />
        <div className="h-8 w-24 bg-slate-100 rounded" />
        <div className="h-8 w-24 bg-slate-100 rounded" />
        <div className="ml-auto h-8 w-64 bg-slate-100 rounded" />
      </div>

      {/* Table Rows Skeleton */}
      <div className="mt-4 border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white overflow-hidden shadow-2xs">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex items-center justify-between p-4 gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="h-4 w-16 bg-slate-200 rounded shrink-0" />
              <div className="h-4 w-3/5 bg-slate-100 rounded" />
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="h-5 w-14 bg-slate-100 rounded" />
              <div className="h-5 w-16 bg-slate-200 rounded" />
              <div className="h-4 w-20 bg-slate-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
