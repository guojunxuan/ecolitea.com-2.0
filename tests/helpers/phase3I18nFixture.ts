/** Test-only injection is permitted solely for isolated local browser builds. */
export function assertPhase3I18nFixtureEnvironment(env: Partial<NodeJS.ProcessEnv>): boolean {
  if (env.PHASE3_I18N_FIXTURE !== 'true') return false
  const target = new URL(env.DATABASE_URI ?? '')
  if (
    env.PLAYWRIGHT_TEST !== 'true' ||
    env.DISABLE_R2_STORAGE !== 'true' ||
    target.protocol !== 'mongodb:' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
    !target.pathname.includes('phase3') ||
    !/(?:^|[-_])(?:test|e2e|int|ci)(?:$|[-_])/.test(target.pathname.slice(1))
  ) {
    throw new Error(
      'Phase3 i18n fixtures require Playwright, disabled storage, and a local phase3 test database.',
    )
  }
  return true
}
