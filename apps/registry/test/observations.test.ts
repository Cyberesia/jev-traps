import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "../app/api/observations/route";
import {
  setObservationStoreForTests,
  type AutomatedObservation,
  type AutomatedObservationInput,
  type ObservationStore,
} from "../lib/observations";

const received: AutomatedObservationInput[] = [];
const stored: AutomatedObservation = {
  id: "9e3a952c-e7d7-4de7-8fc8-91a09183ecf2",
  url: "https://victim.org/page",
  domain: "victim.org",
  observations: 2,
  maxRisk: 0.9,
  actions: ["block"],
  trapTypes: ["hidden_instruction"],
  detectorVersions: ["0.1.0"],
  surfaces: ["html"],
  firstSeen: new Date().toISOString(),
  lastSeen: new Date().toISOString(),
  status: "automated_observation",
};
const store: ObservationStore = {
  upsert: async (input) => {
    received.push(input);
    return stored;
  },
  list: async () => [stored],
};

const validObservation = () => ({
  schemaVersion: 1,
  url: "https://victim.org/page",
  action: "block",
  risk: 0.9,
  trapTypes: ["hidden_instruction"],
  detectorVersion: "0.1.0",
  observedAt: new Date().toISOString(),
  surface: "html",
});

const request = (body: unknown, key = "ingest-secret") =>
  new Request("https://registry.example/api/observations", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

afterEach(() => {
  received.length = 0;
  setObservationStoreForTests(null);
  vi.unstubAllEnvs();
});

describe("automated SDK observations", () => {
  it("authenticates, validates and stores a minimal observation", async () => {
    vi.stubEnv("REGISTRY_INGEST_KEY", "ingest-secret");
    vi.stubEnv("REGISTRY_ENABLE_OBSERVATIONS", "1");
    setObservationStoreForTests(store);
    const response = await POST(request({ ...validObservation(), evidence: "must not be stored" }));
    expect(response.status).toBe(202);
    expect(received).toHaveLength(1);
    expect(received[0]).not.toHaveProperty("evidence");
    expect(await response.json()).toMatchObject({
      id: stored.id,
      observations: 2,
      status: "automated_observation",
    });
  });

  it("rejects missing credentials, allow results and private-style URLs", async () => {
    vi.stubEnv("REGISTRY_INGEST_KEY", "ingest-secret");
    vi.stubEnv("REGISTRY_ENABLE_OBSERVATIONS", "1");
    setObservationStoreForTests(store);
    expect((await POST(request(validObservation(), "wrong"))).status).toBe(401);
    expect((await POST(request({ ...validObservation(), action: "allow" }))).status).toBe(400);
    expect((await POST(request({ ...validObservation(), url: "http://127.0.0.1/private" }))).status).toBe(400);
  });

  it("rejects stale timestamps and unknown trap types", async () => {
    vi.stubEnv("REGISTRY_INGEST_KEY", "ingest-secret");
    vi.stubEnv("REGISTRY_ENABLE_OBSERVATIONS", "1");
    setObservationStoreForTests(store);
    expect(
      (
        await POST(
          request({ ...validObservation(), observedAt: new Date(Date.now() - 31 * 86_400_000).toISOString() }),
        )
      ).status,
    ).toBe(400);
    expect((await POST(request({ ...validObservation(), trapTypes: ["made_up"] }))).status).toBe(400);
  });

  it("fails closed in production unless ingestion is enabled", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("REGISTRY_INGEST_KEY", "ingest-secret");
    setObservationStoreForTests(store);
    expect((await POST(request(validObservation()))).status).toBe(503);
  });

  it("never exposes private reports even with the obsolete public flag enabled", async () => {
    vi.stubEnv("REGISTRY_PUBLIC_OBSERVATIONS", "1");
    setObservationStoreForTests(store);
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.count).toBe(0);
    expect(JSON.stringify(body)).not.toContain("victim.org");
    expect(JSON.stringify(body)).not.toContain("evidence");
  });
});

it("keeps raw observations private by default even when ingestion is enabled", async () => {
  vi.stubEnv("REGISTRY_ENABLE_OBSERVATIONS", "1"); setObservationStoreForTests(store);
  expect(await (await GET()).json()).toMatchObject({observations:[],publicFeedEnabled:true});
});
