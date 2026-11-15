// Installed Next instrumentation runs once before this server accepts requests.
// Initialize cron explicitly: plain getPayload() does not start Payload autoRun.
export async function register() {
  if (
    process.env.NEXT_RUNTIME !== 'nodejs' ||
    process.env.JOBS_AUTORUN !== 'true' ||
    process.env.NEXT_PHASE === 'phase-production-build'
  )
    return
  const [{ getPayload }, { default: config }] = await Promise.all([
    import('payload'),
    import('./payload.config'),
  ])
  await getPayload({ config, cron: true })
}
