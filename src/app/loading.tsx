export default function Loading() {
  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-16 sm:px-6 lg:px-8">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-orange-100" />
      <div className="h-12 max-w-2xl animate-pulse rounded-lg bg-orange-100" />
      <div className="grid gap-5 md:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-80 animate-pulse rounded-xl bg-orange-50" />
        ))}
      </div>
    </div>
  );
}

