import { Database } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-white/[0.08] py-12 mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-accent" />
            <span className="font-medium text-white">Open Health Data Hub</span>
          </div>
          <div className="text-sm text-muted-dark text-right space-y-1">
            <p>
              <a href="https://data.cms.gov/provider-summary-by-type-of-service/medicare-physician-other-practitioners/medicaid-provider-utilization-and-spending" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">CMS Medicaid Provider Utilization and Spending</a> (2018–2024). 227M+ claims records.
            </p>
            <p>
              <a href="https://data.cms.gov/provider-summary-by-type-of-service/medicare-physician-other-practitioners/medicare-physician-other-practitioners-by-provider-and-service" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">CMS Medicare Physician Spending</a> (2023). 9.7M+ service records.
            </p>
            <p>
              <a href="https://www.cdc.gov/brfss/index.html" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">CDC BRFSS</a> (2014–2020, 2023). 3.5M+ survey respondents.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
