/**
 * Static shell for the sidebar while the signed-in user's profile loads.
 * Keeping it outside the layout's async work lets the page stream immediately.
 */
export function SidebarSkeleton() {
  return (
    <aside
      aria-hidden
      className="flex w-full shrink-0 flex-col border-b border-line bg-surface md:w-56 md:border-b-0 md:border-r"
    >
      <div className="px-4 py-4">
        <div className="h-5 w-20 animate-pulse rounded bg-surface-2" />
        <div className="mt-2 h-3 w-28 animate-pulse rounded bg-surface-2" />
      </div>
      <div className="flex gap-1 overflow-hidden px-2 pb-2 md:flex-1 md:flex-col">
        {[88, 72, 64, 92, 80].map((width) => (
          <div
            key={width}
            className="h-9 shrink-0 animate-pulse rounded-md bg-surface-2"
            style={{ width }}
          />
        ))}
      </div>
    </aside>
  );
}
