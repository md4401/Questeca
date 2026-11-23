export const env = {
  appUrl: () => (process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")).replace(/\/$/, ""),
  secret: () => process.env.AUTH_SECRET ?? "dev-secret-change-me",
  requireVerification: () => process.env.REQUIRE_EMAIL_VERIFICATION === "true",
  staffEmails: () => (process.env.STAFF_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
  isProd: () => process.env.NODE_ENV === "production",
};
export const TERMS_VERSION = "2026-11";
