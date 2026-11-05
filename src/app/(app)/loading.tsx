export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-32 animate-pulse rounded-2xl bg-forest/10" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-2xl border border-line bg-white" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="h-[520px] animate-pulse rounded-2xl border border-line bg-white" />
        <div className="h-[520px] animate-pulse rounded-2xl border border-line bg-white" />
      </div>
      <p className="text-center text-[11px] text-muted">Carregando portfólio Land Bank Corp…</p>
    </div>
  );
}
