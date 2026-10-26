// Names only: values come from the canonical stylesheet on the server, and the
// enclosing computed theme in the browser for blocks with an inherited theme.
export const inheritedTokenNames = [
  '--website-color-background',
  '--website-color-foreground',
  '--website-color-muted-foreground',
  '--website-color-subtle-foreground',
  '--website-color-surface',
  '--website-color-muted-surface',
  '--website-color-interactive-surface',
  '--website-color-border',
  '--website-color-input',
  '--website-color-action',
  '--website-color-action-foreground',
  '--website-color-focus',
  '--website-font-sans',
  '--website-font-mono',
  '--website-radius-content',
  '--website-radius-control',
] as const

export const escapeStyle = (value: string) => value.replace(/<\/style/gi, '<\\/style')
