import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { DatasetMeta } from "@/lib/datasetMeta";

export function DatasetCard({ meta }: { meta: DatasetMeta }) {
  const Icon = meta.icon;

  const card = (
    <div
      className={`group glass-card p-6 sm:p-8 flex flex-col h-full transition-all duration-300 ${
        meta.comingSoon
          ? "opacity-50 cursor-default"
          : "hover:-translate-y-1 hover:border-white/[0.15]"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${meta.accentColor}15` }}
        >
          <Icon className="w-5 h-5" style={{ color: meta.accentColor }} />
        </div>
        {meta.comingSoon && (
          <span className="text-[10px] uppercase tracking-wider font-semibold text-muted bg-white/[0.05] px-2 py-1 rounded-md">
            Coming soon
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-lg font-bold text-white mb-1">{meta.title}</h3>
      <p className="text-xs text-muted mb-4">{meta.subtitle}</p>

      {/* Stats */}
      <div className="flex flex-wrap gap-3 mb-4">
        {meta.stats.map((stat) => (
          <div key={stat.label} className="bg-white/[0.03] rounded-lg px-3 py-1.5">
            <span className="text-sm font-semibold text-white">{stat.value}</span>
            <span className="text-xs text-muted ml-1.5">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Description */}
      <p className="text-sm text-muted leading-relaxed mb-4 flex-1">
        {meta.description}
      </p>

      {/* Limitations */}
      {meta.limitations.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-medium text-muted-dark mb-1.5">Limitations</p>
          <ul className="space-y-1">
            {meta.limitations.map((lim) => (
              <li key={lim} className="text-xs text-muted flex items-start gap-1.5">
                <span className="text-muted-dark mt-0.5">-</span>
                {lim}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* CTA */}
      {!meta.comingSoon && (
        <div
          className="flex items-center gap-2 text-sm font-medium transition-colors"
          style={{ color: meta.accentColor }}
        >
          Explore
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
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
