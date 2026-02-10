export default function LoadingSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
            </div>
            <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          </div>
          <div className="mt-3 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full w-full" />
        </div>
      ))}
    </div>
  );
}
