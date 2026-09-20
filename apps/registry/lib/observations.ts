import type postgres from "postgres";
import { getDatabase } from "./db";

export const trapTypes = [
  "indirect_prompt_injection",
  "goal_hijacking",
  "secret_exfiltration",
  "tool_manipulation",
  "navigation_hijacking",
  "hidden_instruction",
  "obfuscated_instruction",
  "suspicious_scheme",
  "visual_prompt_injection",
] as const;

export type AutomatedObservationInput = {
  url: string;
  domain: string;
  action: "sanitize" | "review" | "block";
  risk: number;
  trapTypes: string[];
  detectorVersion: string;
  observedAt: string;
  surface: "text" | "html" | "image";
};

export type AutomatedObservation = {
  id: string;
  url: string;
  domain: string;
  observations: number;
  maxRisk: number;
  actions: string[];
  trapTypes: string[];
  detectorVersions: string[];
  surfaces: string[];
  firstSeen: string;
  lastSeen: string;
  status: "automated_observation";
};

export interface ObservationStore {
  upsert(input: AutomatedObservationInput): Promise<AutomatedObservation>;
  list(limit?: number): Promise<AutomatedObservation[]>;
}

const rowToObservation = (row: Record<string, unknown>): AutomatedObservation => ({
  id: String(row.id),
  url: String(row.url),
  domain: String(row.domain),
  observations: Number(row.observations),
  maxRisk: Number(row.max_risk),
  actions: row.actions as string[],
  trapTypes: row.trap_types as string[],
  detectorVersions: row.detector_versions as string[],
  surfaces: row.surfaces as string[],
  firstSeen: new Date(String(row.first_seen)).toISOString(),
  lastSeen: new Date(String(row.last_seen)).toISOString(),
  status: "automated_observation",
});

class PostgresObservationStore implements ObservationStore {
  constructor(private readonly sql: postgres.Sql) {}

  async upsert(input: AutomatedObservationInput): Promise<AutomatedObservation> {
    const id = crypto.randomUUID();
    const rows = await this.sql<Record<string, unknown>[]>`
      insert into automated_observations (
        id, url, domain, observations, max_risk, actions, trap_types,
        detector_versions, surfaces, first_seen, last_seen
      )
      values (
        ${id}, ${input.url}, ${input.domain}, 1, ${input.risk},
        ${[input.action]}, ${input.trapTypes}, ${[input.detectorVersion]},
        ${[input.surface]}, ${input.observedAt}, ${input.observedAt}
      )
      on conflict (url) do update set
        observations = automated_observations.observations + 1,
        max_risk = greatest(automated_observations.max_risk, excluded.max_risk),
        actions = array(select distinct unnest(automated_observations.actions || excluded.actions)),
        trap_types = array(select distinct unnest(automated_observations.trap_types || excluded.trap_types)),
        detector_versions = array(select distinct unnest(automated_observations.detector_versions || excluded.detector_versions)),
        surfaces = array(select distinct unnest(automated_observations.surfaces || excluded.surfaces)),
        first_seen = least(automated_observations.first_seen, excluded.first_seen),
        last_seen = greatest(automated_observations.last_seen, excluded.last_seen),
        updated_at = now()
      returning *
    `;
    if (!rows[0]) throw new Error("Observation upsert returned no row");
    return rowToObservation(rows[0]);
  }

  async list(limit = 50): Promise<AutomatedObservation[]> {
    const rows = await this.sql<Record<string, unknown>[]>`
      select * from automated_observations
      order by last_seen desc
      limit ${limit}
    `;
    return rows.map(rowToObservation);
  }
}

let testOverride: ObservationStore | null = null;

export function setObservationStoreForTests(store: ObservationStore | null): void {
  testOverride = store;
}

export function getObservationStore(env: NodeJS.ProcessEnv = process.env): ObservationStore | null {
  if (testOverride) return testOverride;
  if (!env.DATABASE_URL) return null;
  return new PostgresObservationStore(getDatabase(env.DATABASE_URL));
}
