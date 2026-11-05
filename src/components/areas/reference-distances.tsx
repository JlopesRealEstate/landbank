import { distancesToReferences, REFERENCE_KIND_LABELS, REFERENCE_METHOD, type ReferenceKind } from "@/lib/references";
import { num } from "@/lib/format";
import { cn } from "@/components/ui";

/**
 * Distâncias do imóvel até rodovias, capital, porto e aeroportos.
 * Medida em linha reta até o eixo da via/instalação — leitura estratégica.
 */
export function ReferenceDistances({
  lat,
  lng,
  compact = false,
  only,
  title = "Distâncias estratégicas",
}: {
  lat: number;
  lng: number;
  compact?: boolean;
  only?: ReferenceKind[];
  title?: string;
}) {
  const all = distancesToReferences({ lat, lng });
  const list = only ? all.filter((item) => only.includes(item.kind)) : all;
  const kinds = [...new Set(list.map((item) => item.kind))] as ReferenceKind[];

  return (
    <div className="rounded-xl border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-paper/60 px-2.5 py-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">{title}</p>
        <p className="text-[9px] text-muted">geometria real (OSM) · menor distância até o eixo/acesso</p>
      </div>
      <div className={cn("space-y-2 p-2.5", compact && "space-y-1.5 p-2")}>
        {kinds.map((kind) => (
          <div key={kind}>
            <p className="text-[8px] font-semibold uppercase tracking-[0.1em] text-[#8c2f43]">
              {REFERENCE_KIND_LABELS[kind]}
            </p>
            <div className="mt-0.5 grid grid-cols-2 gap-x-2 gap-y-0.5 sm:grid-cols-3">
              {list
                .filter((item) => item.kind === kind)
                .sort((a, b) => a.km - b.km)
                .map((item) => (
                  <div
                    key={item.id}
                    className="flex items-baseline justify-between gap-1 border-b border-dashed border-line/70 py-0.5"
                    title={`${item.name ?? item.short}${item.note ? ` — ${item.note}` : ""}\nAcesso mais próximo: ${item.nearest.lat.toFixed(5)}, ${item.nearest.lng.toFixed(5)}`}
                  >
                    <span className="truncate text-[9.5px] text-ink-soft">{item.short}</span>
                    <span className="shrink-0 text-[9.5px] font-semibold tabular-nums text-ink">
                      {num(item.km, 1)} km
                    </span>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
      <p className="border-t border-line px-2.5 py-1 text-[8px] leading-snug text-muted">{REFERENCE_METHOD}</p>
    </div>
  );
}
