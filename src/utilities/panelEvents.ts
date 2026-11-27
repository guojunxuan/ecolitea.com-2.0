// Coordinate independently mounted Header and Cookie panels without coupling their state.
const PANEL_OPEN_EVENT = 'ecolitea:panel-open'
export const announcePanelOpen = (owner: string): void => {
  window.dispatchEvent(new CustomEvent(PANEL_OPEN_EVENT, { detail: owner }))
}
export const listenForPanelOpen = (listener: (owner: string) => void): (() => void) => {
  const onOpen = (event: Event) => {
    if (event instanceof CustomEvent && typeof event.detail === 'string') listener(event.detail)
  }
  window.addEventListener(PANEL_OPEN_EVENT, onOpen)
  return () => window.removeEventListener(PANEL_OPEN_EVENT, onOpen)
}
