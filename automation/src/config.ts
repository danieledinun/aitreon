function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  tandymApiUrl: requireEnv('TANDYM_API_URL').replace(/\/$/, ''),
  automationApiKey: requireEnv('AUTOMATION_API_KEY'),
  googleClientId: requireEnv('GOOGLE_CLIENT_ID'),
  googleClientSecret: requireEnv('GOOGLE_CLIENT_SECRET'),
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '300000', 10),
  port: parseInt(process.env.PORT || '3000', 10),
} as const;
