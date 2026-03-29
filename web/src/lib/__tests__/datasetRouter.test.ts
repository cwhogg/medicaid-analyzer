import { describe, test, expect, vi, beforeEach } from "vitest";

// Mock the Anthropic client
const mockCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate };
      constructor() {}
    },
  };
});

import { extractConcepts, selectDatasets, type ConceptExtraction } from "../datasetRouter";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: "test-key" }) as unknown as Anthropic;

function mockHaikuResponse(json: object) {
  mockCreate.mockResolvedValueOnce({
    content: [{ type: "text", text: JSON.stringify(json) }],
    usage: { input_tokens: 100, output_tokens: 50 },
  });
}

describe("extractConcepts", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  test("extracts obesity-related concepts", async () => {
    mockHaikuResponse({
      concepts: ["prevalence", "obesity", "trend"],
      dataFields: ["BMI category", "survey weights", "year"],
      variables: ["_BMI5CAT", "_LLCPWT", "survey_year"],
      timeRange: null,
      comparisonIntent: false,
      populationType: "general population",
    });

    const result = await extractConcepts(client, "How has obesity changed over time?");
    expect(result.concepts).toContain("obesity");
    expect(result.comparisonIntent).toBe(false);
    expect(result.populationType).toBe("general population");
  });

  test("extracts comparison intent for cross-dataset question", async () => {
    mockHaikuResponse({
      concepts: ["spending", "remote patient monitoring", "comparison"],
      dataFields: ["HCPCS codes", "payment amounts", "year"],
      variables: ["hcpcs_code", "total_paid"],
      timeRange: "2023",
      comparisonIntent: true,
      populationType: "providers",
    });

    const result = await extractConcepts(client, "Compare Medicaid and Medicare spending on RPM in 2023");
    expect(result.comparisonIntent).toBe(true);
    expect(result.timeRange).toBe("2023");
    expect(result.concepts).toContain("spending");
  });

  test("extracts drug-related concepts", async () => {
    mockHaikuResponse({
      concepts: ["drug spending", "ranking"],
      dataFields: ["drug name", "total cost"],
      variables: ["Gnrc_Name", "Tot_Drug_Cst"],
      timeRange: null,
      comparisonIntent: false,
      populationType: null,
    });

    const result = await extractConcepts(client, "What drugs cost the most?");
    expect(result.concepts).toContain("drug spending");
  });

  test("handles empty/malformed response gracefully", async () => {
    mockHaikuResponse({});

    const result = await extractConcepts(client, "Test question");
    expect(result.concepts).toEqual([]);
    expect(result.dataFields).toEqual([]);
    expect(result.comparisonIntent).toBe(false);
    expect(result.timeRange).toBeNull();
  });

  test("strips markdown code fences from response", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "```json\n" + JSON.stringify({
        concepts: ["test"],
        dataFields: [],
        variables: [],
        timeRange: null,
        comparisonIntent: false,
        populationType: null,
      }) + "\n```" }],
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    const result = await extractConcepts(client, "Test");
    expect(result.concepts).toEqual(["test"]);
  });
});

describe("selectDatasets", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  const drugConcepts: ConceptExtraction = {
    concepts: ["drug spending", "ranking"],
    dataFields: ["drug name", "total cost"],
    variables: ["Gnrc_Name", "Tot_Drug_Cst"],
    timeRange: null,
    comparisonIntent: false,
    populationType: null,
  };

  test("routes drug questions to Part D", async () => {
    mockHaikuResponse({
      datasets: ["medicare-partd"],
      reasoning: "Drug spending data is in Part D",
      joinStrategy: "none",
      joinKeys: null,
      ambiguous: false,
      clarificationQuestion: null,
      confidence: "high",
    });

    const result = await selectDatasets(client, drugConcepts, "What drugs cost the most?");
    expect(result.datasets).toEqual(["medicare-partd"]);
    expect(result.joinStrategy).toBe("none");
    expect(result.ambiguous).toBe(false);
  });

  test("routes cross-dataset NPI question to sql_join", async () => {
    const concepts: ConceptExtraction = {
      concepts: ["billing", "NPI", "comparison"],
      dataFields: ["NPI", "spending"],
      variables: [],
      timeRange: null,
      comparisonIntent: true,
      populationType: "providers",
    };

    mockHaikuResponse({
      datasets: ["medicare", "medicare-partd"],
      reasoning: "NPI billing spans Part B and Part D",
      joinStrategy: "sql_join",
      joinKeys: ["NPI"],
      ambiguous: false,
      clarificationQuestion: null,
      confidence: "high",
    });

    const result = await selectDatasets(client, concepts, "Which NPIs bill the most across Part B and Part D?");
    expect(result.datasets).toEqual(["medicare", "medicare-partd"]);
    expect(result.joinStrategy).toBe("sql_join");
    expect(result.joinKeys).toEqual(["NPI"]);
  });

  test("routes survey+claims to narrative_only", async () => {
    const concepts: ConceptExtraction = {
      concepts: ["smoking", "spending", "relationship"],
      dataFields: ["prevalence", "payment amounts"],
      variables: [],
      timeRange: null,
      comparisonIntent: true,
      populationType: null,
    };

    mockHaikuResponse({
      datasets: ["brfss", "medicaid"],
      reasoning: "Survey data and claims can't be joined at row level",
      joinStrategy: "narrative_only",
      joinKeys: null,
      ambiguous: false,
      clarificationQuestion: null,
      confidence: "medium",
    });

    const result = await selectDatasets(client, concepts, "How does smoking relate to Medicaid spending?");
    expect(result.datasets).toEqual(["brfss", "medicaid"]);
    expect(result.joinStrategy).toBe("narrative_only");
  });

  test("returns ambiguous for BMI question", async () => {
    const concepts: ConceptExtraction = {
      concepts: ["BMI", "average"],
      dataFields: ["BMI values"],
      variables: [],
      timeRange: null,
      comparisonIntent: false,
      populationType: "general population",
    };

    mockHaikuResponse({
      datasets: ["brfss", "nhanes"],
      reasoning: "BMI is available in both BRFSS (self-reported) and NHANES (measured)",
      joinStrategy: "none",
      joinKeys: null,
      ambiguous: true,
      clarificationQuestion: "Do you want self-reported BMI from BRFSS or clinically measured BMI from NHANES?",
      confidence: "low",
    });

    const result = await selectDatasets(client, concepts, "What's the average BMI?");
    expect(result.ambiguous).toBe(true);
    expect(result.clarificationQuestion).toBeTruthy();
  });

  test("filters invalid dataset keys", async () => {
    mockHaikuResponse({
      datasets: ["medicare", "invalid-dataset", "brfss"],
      reasoning: "Test",
      joinStrategy: "none",
      joinKeys: null,
      ambiguous: false,
      clarificationQuestion: null,
      confidence: "high",
    });

    const result = await selectDatasets(client, drugConcepts, "Test");
    expect(result.datasets).toEqual(["medicare", "brfss"]);
  });

  test("falls back to medicaid when no valid datasets", async () => {
    mockHaikuResponse({
      datasets: ["invalid1", "invalid2"],
      reasoning: "Test",
      joinStrategy: "none",
      joinKeys: null,
      ambiguous: false,
      clarificationQuestion: null,
      confidence: "low",
    });

    const result = await selectDatasets(client, drugConcepts, "Test");
    expect(result.datasets).toEqual(["medicaid"]);
  });
});
