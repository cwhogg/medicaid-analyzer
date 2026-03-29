import { describe, test, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock external dependencies
const mockCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate };
      constructor() {}
    },
  };
});

vi.mock("@/lib/railway", () => ({
  executeRemoteQuery: vi.fn().mockResolvedValue({
    columns: ["year", "total"],
    rows: [[2023, 1000000]],
  }),
}));

vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 10, retryAfterSec: 0 }),
}));

vi.mock("@/lib/metrics", () => ({
  recordRequest: vi.fn(),
  recordQuery: vi.fn(),
  recordFeedItem: vi.fn(),
}));

// Mock env vars
vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
vi.stubEnv("RAILWAY_QUERY_URL", "http://localhost:3001");
vi.stubEnv("RAILWAY_API_KEY", "test-railway-key");

// Import datasets AFTER mocking
import "@/lib/datasets/index";

// Import the POST handler
import { POST } from "../route";

function makeRequest(body: object): NextRequest {
  return new NextRequest("http://localhost:3000/api/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "127.0.0.1",
    },
    body: JSON.stringify(body),
  });
}

function mockHaikuResponse(json: object) {
  mockCreate.mockResolvedValueOnce({
    content: [{ type: "text", text: JSON.stringify(json) }],
    usage: { input_tokens: 100, output_tokens: 50 },
  });
}

function mockSonnetResponse(json: object) {
  mockCreate.mockResolvedValueOnce({
    content: [{ type: "text", text: JSON.stringify(json) }],
    usage: { input_tokens: 200, output_tokens: 100 },
    stop_reason: "end_turn",
  });
}

describe("Analyze API Route", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  // --- Input Validation ---

  test("rejects empty question", async () => {
    const req = makeRequest({ question: "", dataset: "medicaid", sessionId: "test", stepIndex: 0 });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  test("rejects question over 1000 chars", async () => {
    const req = makeRequest({
      question: "a".repeat(1001),
      dataset: "medicaid",
      sessionId: "test",
      stepIndex: 0,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  test("accepts question up to 1000 chars", async () => {
    // Mock the Sonnet plan response
    mockSonnetResponse({
      plan: [{ stepNumber: 1, title: "Test", purpose: "Test purpose" }],
      reasoning: "Test reasoning",
      complexity: "simple",
      stepIndex: 0,
      done: false,
    });

    const req = makeRequest({
      question: "a".repeat(999),
      dataset: "medicaid",
      sessionId: "test",
      stepIndex: 0,
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  test("rejects missing sessionId", async () => {
    const req = makeRequest({ question: "test", dataset: "medicaid", stepIndex: 0 });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  // --- Routing: Concept Extraction (step -2) ---

  test("concept extraction returns concepts for auto mode", async () => {
    mockHaikuResponse({
      concepts: ["drug spending"],
      dataFields: ["drug name", "cost"],
      variables: [],
      timeRange: null,
      comparisonIntent: false,
      populationType: null,
    });

    const req = makeRequest({
      question: "What are the most expensive drugs?",
      dataset: "auto",
      sessionId: "test",
      stepIndex: -2,
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.stepIndex).toBe(-2);
    expect(data.conceptExtraction).toBeDefined();
    expect(data.conceptExtraction.concepts).toContain("drug spending");
  });

  // --- Routing: Dataset Selection (step -1) ---

  test("dataset selection returns datasets for auto mode", async () => {
    // First call: extractConcepts
    mockHaikuResponse({
      concepts: ["drug spending"],
      dataFields: ["drug name", "cost"],
      variables: [],
      timeRange: null,
      comparisonIntent: false,
      populationType: null,
    });
    // Second call: selectDatasets
    mockHaikuResponse({
      datasets: ["medicare-partd"],
      reasoning: "Drug spending is in Part D",
      joinStrategy: "none",
      joinKeys: null,
      ambiguous: false,
      clarificationQuestion: null,
      confidence: "high",
    });

    const req = makeRequest({
      question: "What are the most expensive drugs?",
      dataset: "auto",
      sessionId: "test",
      stepIndex: -1,
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.stepIndex).toBe(-1);
    expect(data.datasetSelection).toBeDefined();
    expect(data.datasetSelection.datasets).toContain("medicare-partd");
  });

  test("returns clarification when ambiguous", async () => {
    // extractConcepts
    mockHaikuResponse({
      concepts: ["BMI"],
      dataFields: ["BMI values"],
      variables: [],
      timeRange: null,
      comparisonIntent: false,
      populationType: "general population",
    });
    // selectDatasets
    mockHaikuResponse({
      datasets: ["brfss", "nhanes"],
      reasoning: "BMI available in both",
      joinStrategy: "none",
      joinKeys: null,
      ambiguous: true,
      clarificationQuestion: "Do you want self-reported or measured BMI?",
      confidence: "low",
    });

    const req = makeRequest({
      question: "What is the average BMI?",
      dataset: "auto",
      sessionId: "test",
      stepIndex: -1,
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.clarification).toBeDefined();
    expect(data.clarification.question).toContain("BMI");
  });

  // --- Standard single-dataset flow ---

  test("single dataset plan step works", async () => {
    mockSonnetResponse({
      plan: [{ stepNumber: 1, title: "Get top drugs", purpose: "Rank drugs by cost" }],
      reasoning: "Single step analysis",
      complexity: "simple",
      stepIndex: 0,
      done: false,
    });

    const req = makeRequest({
      question: "Top 10 drugs by spending",
      dataset: "medicaid",
      sessionId: "test",
      stepIndex: 0,
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.plan).toBeDefined();
    expect(Array.isArray(data.plan)).toBe(true);
  });

  // --- Multi-dataset flow ---

  test("multi-dataset query uses combined schema", async () => {
    mockSonnetResponse({
      plan: [{ stepNumber: 1, title: "Part B spending by NPI", purpose: "Get top NPIs from Part B" }],
      reasoning: "Cross-dataset NPI analysis",
      complexity: "moderate",
      stepIndex: 0,
      done: false,
    });

    const req = makeRequest({
      question: "Which NPIs bill the most across Part B and D?",
      dataset: "auto",
      sessionId: "test",
      stepIndex: 0,
      resolvedDatasets: ["medicare", "medicare-partd"],
      joinStrategy: "sql_join",
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.plan).toBeDefined();
    // The multi-dataset info should be echoed back
    expect(data.resolvedDatasets).toEqual(["medicare", "medicare-partd"]);
    expect(data.joinStrategy).toBe("sql_join");
  });

  // --- stepIndex validation ---

  test("allows stepIndex -2", async () => {
    mockHaikuResponse({
      concepts: ["test"],
      dataFields: [],
      variables: [],
      timeRange: null,
      comparisonIntent: false,
      populationType: null,
    });

    const req = makeRequest({
      question: "Test question",
      dataset: "auto",
      sessionId: "test",
      stepIndex: -2,
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  test("rejects stepIndex -3", async () => {
    const req = makeRequest({
      question: "Test question",
      dataset: "auto",
      sessionId: "test",
      stepIndex: -3,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
