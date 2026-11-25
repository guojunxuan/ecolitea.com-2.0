import canUseDOM from './canUseDOM'

// A computed key keeps Next from inlining the build-time NEXT_PUBLIC_* value into server bundles,
// so a prebuilt image uses the URL from its runtime environment.
const runtimeEnv = (key: 'NEXT_PUBLIC_SERVER_URL' | 'VERCEL_PROJECT_PRODUCTION_URL') =>
  process.env[key]?.trim() || undefined

export const getServerSideURL = () => {
  const serverURL = runtimeEnv('NEXT_PUBLIC_SERVER_URL')
  if (serverURL) return serverURL.replace(/\/+$/, '')
  const vercelURL = runtimeEnv('VERCEL_PROJECT_PRODUCTION_URL')
  return vercelURL ? `https://${vercelURL}` : 'http://localhost:3000'
}

export const getClientSideURL = () => {
  if (canUseDOM) {
    const protocol = window.location.protocol
    const domain = window.location.hostname
    const port = window.location.port

    return `${protocol}//${domain}${port ? `:${port}` : ''}`
  }

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }

  return process.env.NEXT_PUBLIC_SERVER_URL || ''
}
