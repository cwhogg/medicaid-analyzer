export function Footer() {
  return (
    <footer className="mt-14 pb-8">
      <div className="max-w-[1080px] mx-auto px-4 sm:px-8">
        <hr className="rule" />
        <div className="flex flex-col md:flex-row justify-between items-start gap-3 pt-5">
          <div className="text-[0.8125rem] text-muted">
            &copy; 2024&ndash;2026 Open Health Data Hub
          </div>
          <div className="text-[0.8125rem] text-muted md:text-right space-y-0.5">
            <p>
              Data sources:{" "}
              <a href="https://data.cms.gov/" target="_blank" rel="noopener noreferrer" className="text-teal hover:text-teal-hover transition-colors">CMS</a>,{" "}
              <a href="https://www.cdc.gov/brfss/" target="_blank" rel="noopener noreferrer" className="text-teal hover:text-teal-hover transition-colors">CDC BRFSS</a>,{" "}
              <a href="https://wwwn.cdc.gov/nchs/nhanes/" target="_blank" rel="noopener noreferrer" className="text-teal hover:text-teal-hover transition-colors">CDC NHANES</a>,{" "}
              <a href="https://data.cms.gov/provider-data/dataset/mj5m-pzi6" target="_blank" rel="noopener noreferrer" className="text-teal hover:text-teal-hover transition-colors">CMS DAC</a>,{" "}
              <a href="https://data.cms.gov/provider-summary-by-type-of-service/medicare-part-d-prescribers/medicare-part-d-prescribers-by-provider-and-drug" target="_blank" rel="noopener noreferrer" className="text-teal hover:text-teal-hover transition-colors">CMS Part D</a>
            </p>
          </div>
        </div>
        <p className="text-center text-[0.6875rem] text-muted mt-3 opacity-70">
          Built with Next.js, DuckDB, and Claude by <a href="https://x.com/cwhogg" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Chris Hogg</a>
        </p>
      </div>
    </footer>
  );
}
