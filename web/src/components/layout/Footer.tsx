import { Database } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-white/[0.08] py-12 mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-accent" />
            <span className="font-medium text-white">Medicaid Claims Analyzer</span>
          </div>
          <p className="text-sm text-muted-dark">
            Data source: CMS Medicaid Provider Utilization and Spending (2018-2024). 227M+ claims records.
          </p>
        </div>
      </div>
    </footer>
  );
}
