import Link from "next/link";
import type { DatasetMeta } from "@/lib/datasetMeta";

export function DatasetCard({ meta }: { meta: DatasetMeta }) {
  const card = (
    <div
      className={`group card p-6 sm:p-7 flex flex-col h-full transition-all duration-200 ${
        meta.comingSoon
          ? "opacity-60 cursor-default"
          : "hover:shadow-lg hover:-translate-y-0.5"
      }`}
    >
      {/* Tag */}
      <div className="flex items-start justify-between mb-2">
        <span
          className="text-[0.6875rem] font-bold tracking-[0.14em] uppercase"
          style={{ color: meta.accentColor }}
        >
          {meta.key === "brfss" || meta.key === "nhanes" ? meta.key.toUpperCase() : meta.title.split(" ")[0]}
        </span>
        {meta.comingSoon && (
          <span className="text-[10px] uppercase tracking-wider font-semibold text-muted bg-background px-2 py-1 rounded-sm">
            Coming soon
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="font-headline text-[1.1875rem] font-bold text-foreground leading-tight mb-2">
        {meta.title}
      </h3>

      {/* Description */}
      <p className="font-serif text-[0.875rem] text-body leading-[1.7] mb-4 flex-1">
        {meta.description}
      </p>

      {/* Stats */}
      <div className="text-[0.75rem] text-muted pt-3 border-t border-rule-light mb-3" style={{ fontFeatureSettings: "'tnum' 1" }}>
        {meta.stats.map((stat) => stat.value + " " + stat.label).join(" \u00B7 ")}
      </div>

      {/* Limitations */}
      {meta.limitations.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-muted mb-1.5">Limitations</p>
          <ul className="space-y-1">
            {meta.limitations.map((lim) => (
              <li key={lim} className="text-xs text-muted flex items-start gap-1.5">
                <span className="text-rule mt-0.5">-</span>
                {lim}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* CTA */}
      {!meta.comingSoon && (
        <div
          className="flex items-center gap-2 text-sm font-semibold transition-colors"
          style={{ color: meta.accentColor }}
        >
          Explore &rarr;
        </div>
      )}
    </div>
  );

  if (meta.comingSoon) {
    return card;
  }

  return (
    <Link href={meta.href} className="block">
      {card}
    </Link>
  );
}
