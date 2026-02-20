import { buildApp } from "./app";

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "0.0.0.0";

async function start() {
  const { initSentry } = await import("./monitoring/sentry");
  initSentry();

  const app = await buildApp();

  await app.listen({ port: PORT, host: HOST });

  // Start retention cron in production or when explicitly enabled
  if (process.env.NODE_ENV === "production" || process.env.ENABLE_RETENTION === "true") {
    const { startRetentionCron } = await import("./retention/retention-job");
    startRetentionCron();
    app.log.info("Position retention cron started");
  }
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
