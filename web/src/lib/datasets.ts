export interface YearFilterConfig {
  years: number[];
  dateColumn: string;
}

export interface ResultCaveat {
  title: string;
  text: string;
  borderColor: string;
  titleColor: string;
}

export interface DatasetConfig {
  key: string;
  label: string;
  beta: boolean;

  // Backend env var names
  envUrlKey: string;
  envApiKeyKey: string;

  // Prompts
  generateSchemaPrompt: () => string;
  systemPromptPreamble: string;
  systemPromptRules: string;
  retrySystemPromptRules: string;

  // UI
  pageTitle: string;
  pageSubtitle: string;
  inputHeading: string;
  inputPlaceholder: string;

  // Features
  yearFilter: YearFilterConfig | null;
  buildYearConstraint?: (years: number[]) => string;
  deepAnalysisSupported: boolean;
  deepAnalysisDisabledReason?: string;
  checkDataScope?: (question: string) => string | null;

  // Results
  resultCaveat?: ResultCaveat;

  // Deep analysis
  domainKnowledge?: string;

  // Example queries shown as chips
  exampleQueries?: { label: string; question: string }[];
}

const registry = new Map<string, DatasetConfig>();
let defaultKey: string | null = null;

export function registerDataset(config: DatasetConfig): void {
  registry.set(config.key, config);
  if (!defaultKey) {
    defaultKey = config.key;
  }
}

export function getDataset(key: string): DatasetConfig {
  const config = registry.get(key);
  if (!config) {
    throw new Error(`Unknown dataset: "${key}". Available: ${Array.from(registry.keys()).join(", ")}`);
  }
  return config;
}

export function getAllDatasets(): DatasetConfig[] {
  return Array.from(registry.values());
}

export function getDefaultDatasetKey(): string {
  if (!defaultKey) {
    throw new Error("No datasets registered");
  }
  return defaultKey;
}
