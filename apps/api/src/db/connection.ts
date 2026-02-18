import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://golfix:golfix_dev@localhost:5433/golfix";

const client = postgres(connectionString);

export const db = drizzle(client, { schema });
