import postgres from "postgres";
// Reuse one bounded pool per server process; polling must not create a new pool.
let cached: { connection: string; sql: postgres.Sql } | undefined;
export function getDatabase(connection: string): postgres.Sql {
  if (cached && cached.connection === connection) return cached.sql;
  if (cached) void cached.sql.end({ timeout: 1 });
  const sql = postgres(connection, { max: 1, prepare: false, connect_timeout: 5, idle_timeout: 20, max_lifetime: 600 });
  cached = { connection, sql };
  return sql;
}
