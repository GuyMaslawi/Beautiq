import { Skeleton } from "@/components/ui/skeleton";

// מסך טעינה כללי לכל עמודי האפליקציה — שלד בקצב של עמוד פרימיום:
// הירו, שורת מדדים ורשימת כרטיסים.
export default function AppLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-7 md:space-y-9" dir="rtl">
      {/* Hero skeleton */}
      <div className="rounded-[1.75rem] border border-border bg-surface/70 p-6 md:p-8">
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-2xl" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="mt-4 h-9 w-56 md:w-72" />
        <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      </div>

      {/* Metrics skeleton */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-surface/70 p-5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-3 h-8 w-20" />
          </div>
        ))}
      </div>

      {/* Content skeleton */}
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-surface/70 p-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-64 max-w-full" />
              </div>
              <Skeleton className="hidden h-9 w-24 rounded-xl md:block" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
