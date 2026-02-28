// Side-effect imports: register each dataset
import "./medicaid";
import "./brfss";

// Re-export registry API
export { getDataset, getAllDatasets, getDefaultDatasetKey } from "@/lib/datasets";
export type { DatasetConfig, YearFilterConfig, ResultCaveat } from "@/lib/datasets";
