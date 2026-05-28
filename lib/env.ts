/**
 * Runtime environment variable validation.
 * Import this at the top of any server-side route that needs a specific set of vars.
 * Throws with a clear message if any required var is missing.
 */

type EnvGroup = 'public' | 'google' | 'cron' | 'admin' | 'openai'

const ENV_VARS: Record<EnvGroup, string[]> = {
  public: [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ],
  google: [
    'GOOGLE_CLIENT_EMAIL',
    'GOOGLE_PRIVATE_KEY',
  ],
  cron: [
    'CRON_SECRET',
    'SUPABASE_SERVICE_ROLE_KEY',
  ],
  admin: [
    'SUPABASE_SERVICE_ROLE_KEY',
  ],
  openai: [
    'OPENAI_API_KEY',
  ],
}

export function requireEnv(...groups: EnvGroup[]): void {
  const vars = [...new Set(groups.flatMap((g) => ENV_VARS[g]))]
  const missing = vars.filter((v) => !process.env[v])

  if (missing.length > 0) {
    const list = missing.map((v) => `  • ${v}`).join('\n')
    throw new Error(
      `[KeepGoing] Missing required environment variables:\n${list}\n` +
      `Check your .env.local (dev) or Vercel project environment settings (prod).`
    )
  }
}

/** Returns the value of an env var, throwing if absent. */
export function getEnv(name: string): string {
  const val = process.env[name]
  if (!val) {
    throw new Error(
      `[KeepGoing] Missing required environment variable: ${name}\n` +
      `Check your .env.local (dev) or Vercel project environment settings (prod).`
    )
  }
  return val
}
