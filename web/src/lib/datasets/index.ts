// Side-effect imports: register each dataset
import "./medicaid";
import "./brfss";
import "./medicare";
import "./medicare-inpatient";
import "./nhanes";
import "./dac";

// Re-export registry API
export { getDataset, getAllDatasets, getDefaultDatasetKey } from "@/lib/datasets";
export type { DatasetConfig, YearFilterConfig, ResultCaveat } from "@/lib/datasets";
