import * as Sentry from "@sentry/node";

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return; // Noop if no DSN configured

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: 0.1,
    beforeSend(event) {
      // Redact PII
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }
      return event;
    },
  });
}

export function captureError(error: Error, context?: Record<string, unknown>): void {
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error, { extra: context });
  }
}
