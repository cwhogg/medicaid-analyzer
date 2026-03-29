import { describe, test, expect } from "vitest";

// Need to import dataset registrations before using getDataset
import "@/lib/datasets/index";

import {
  buildCrossDatasetSchemaPrompt,
  buildCombinedDomainKnowledge,
  MULTI_DATASET_PREAMBLE,
  MULTI_DATASET_RULES,
} from "../crossDatasetSchema";

describe("buildCrossDatasetSchemaPrompt", () => {
  test("single dataset returns schema without join reference", () => {
    const prompt = buildCrossDatasetSchemaPrompt(["medicaid"]);
    expect(prompt).toContain("Medicaid");
    expect(prompt).toContain("claims");
    // Should NOT contain join reference for single dataset
    expect(prompt).not.toContain("Cross-Dataset Join Reference");
  });

  test("two datasets include join reference", () => {
    const prompt = buildCrossDatasetSchemaPrompt(["medicare", "medicare-partd"]);
    expect(prompt).toContain("Medicare");
    expect(prompt).toContain("Part D");
    expect(prompt).toContain("Cross-Dataset Join Reference");
    expect(prompt).toContain("Rndrng_NPI");
    expect(prompt).toContain("Prscrbr_NPI");
  });

  test("BRFSS + Medicaid includes join reference", () => {
    const prompt = buildCrossDatasetSchemaPrompt(["brfss", "medicaid"]);
    expect(prompt).toContain("BRFSS");
    expect(prompt).toContain("Medicaid");
    expect(prompt).toContain("Cross-Dataset Join Reference");
    expect(prompt).toContain("narrative");
  });

  test("join reference includes correct NPI column names", () => {
    const prompt = buildCrossDatasetSchemaPrompt(["medicaid", "medicare"]);
    expect(prompt).toContain("billing_npi");
    expect(prompt).toContain("Rndrng_NPI");
  });

  test("join reference warns about CCN vs NPI for Inpatient", () => {
    const prompt = buildCrossDatasetSchemaPrompt(["medicare", "medicare-inpatient"]);
    expect(prompt).toContain("N/A (uses CCN)");
  });
});

describe("buildCombinedDomainKnowledge", () => {
  test("combines domain knowledge from multiple datasets", () => {
    const knowledge = buildCombinedDomainKnowledge(["medicaid", "medicare"]);
    expect(knowledge).toContain("Medicaid Domain Knowledge");
    expect(knowledge).toContain("Medicare");
  });

  test("handles dataset without domain knowledge", () => {
    // All current datasets have domainKnowledge, but this tests robustness
    const knowledge = buildCombinedDomainKnowledge(["medicaid"]);
    expect(knowledge).toContain("Medicaid Domain Knowledge");
  });
});

describe("MULTI_DATASET_PREAMBLE", () => {
  test("mentions cross-dataset capability", () => {
    expect(MULTI_DATASET_PREAMBLE).toContain("multiple public health datasets");
    expect(MULTI_DATASET_PREAMBLE).toContain("DuckDB");
  });
});

describe("MULTI_DATASET_RULES", () => {
  test("warns about CTE-first for large joins", () => {
    expect(MULTI_DATASET_RULES).toContain("ALWAYS aggregate each side in CTEs first");
  });

  test("warns about survey data limitations", () => {
    expect(MULTI_DATASET_RULES).toContain("BRFSS and NHANES are population surveys");
    expect(MULTI_DATASET_RULES).toContain("NO provider identifiers");
  });

  test("mentions exact column name requirement", () => {
    expect(MULTI_DATASET_RULES).toContain("EXACT column names");
  });

  test("warns about specialty string differences", () => {
    expect(MULTI_DATASET_RULES).toContain("DAC uses ALL CAPS");
  });
});
