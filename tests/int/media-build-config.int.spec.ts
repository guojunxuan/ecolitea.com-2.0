// @vitest-environment node
import { describe, expect, it } from 'vitest'
import nextConfig from '../../next.config'

describe('native upload file reader build boundary', () => {
  it('externalizes Payload with its transitive file reader for standalone tracing while preserving build configuration', () => {
    const configure = (isServer: boolean) =>
      nextConfig.webpack!({ externals: ['existing-external'], resolve: {} }, {
        isServer,
        webpack: { IgnorePlugin: class {} },
      } as never)
    const server = configure(true)
    expect(nextConfig.serverExternalPackages).toContain('payload')
    expect(nextConfig.outputFileTracingIncludes?.['/api/*']).toContain(
      './node_modules/.pnpm/strtok3@*/node_modules/strtok3/lib/**/*.js',
    )
    expect(server.externals).toContain('existing-external')
    expect(server.externals).toContain('sharp')
    expect(server.resolve.extensionAlias['.js']).toEqual(['.ts', '.tsx', '.js', '.jsx'])
    expect(configure(false).externals).not.toContain('file-type')
  })
})
