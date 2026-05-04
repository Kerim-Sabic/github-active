export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-surface">
      <header className="border-b border-border bg-surface/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Skeleton className="h-10 w-64" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-28" />
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-5 xl:grid-cols-[292px_1fr_360px]">
        <div className="grid gap-5">
          <Skeleton className="h-64" />
          <Skeleton className="h-56" />
        </div>
        <div className="grid gap-5">
          <div className="grid gap-3 md:grid-cols-4">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
          <Skeleton className="h-80" />
          <Skeleton className="h-96" />
        </div>
        <div className="grid gap-5">
          <Skeleton className="h-48" />
          <Skeleton className="h-96" />
        </div>
      </div>
    </main>
  );
}

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg border border-border bg-surface-muted ${className}`} />;
}
