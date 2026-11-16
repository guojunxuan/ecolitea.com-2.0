// Any setup scripts you might need go here

// Load .env files
import 'dotenv/config'

// jsdom has no ResizeObserver. Components that measure layout (e.g. the cookie
// description clamp) need an inert default; specs that assert on resize
// behaviour still install their own stub with vi.stubGlobal.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}
