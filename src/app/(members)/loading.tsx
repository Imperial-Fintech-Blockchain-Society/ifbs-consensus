export default function Loading() {
  return (
    <div aria-label="Loading" className="animate-pulse space-y-6">
      <div className="h-10 w-64 rounded-lg bg-slate-200" />
      <div className="grid gap-5 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card h-36 bg-slate-100" />
        ))}
      </div>
      <div className="card h-80 bg-slate-100" />
    </div>
  );
}
