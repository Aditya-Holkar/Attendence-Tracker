/** Lightweight route-level skeleton used while a page's data loads. */
export function PageLoading() {
  return (
    <div aria-busy="true" className="space-y-4">
      <span className="sr-only">Loading page…</span>
      <div className="mb-6 space-y-2">
        <div className="h-6 w-44 animate-pulse rounded bg-surface-2" />
        <div className="h-4 w-64 animate-pulse rounded bg-surface-2" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg border border-line bg-surface" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-lg border border-line bg-surface" />
      <div className="h-40 animate-pulse rounded-lg border border-line bg-surface" />
    </div>
  );
}
