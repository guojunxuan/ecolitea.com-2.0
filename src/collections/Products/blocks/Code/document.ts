import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { ProductCodeBlock } from '@/payload-types'
import { getMediaUrl } from '@/utilities/getMediaUrl'
import { escapeStyle } from './tokens'

const siteTokens = readFileSync(path.join(process.cwd(), 'src/styles/tokens.css'), 'utf8')
const siteTypography = readFileSync(path.join(process.cwd(), 'src/styles/typography.css'), 'utf8')
const serializeScript = (value: string) =>
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')

export function buildProductCodeDocument(block: ProductCodeBlock): string {
  const assets =
    block.assets?.map((asset) =>
      typeof asset === 'object' && asset
        ? getMediaUrl(asset.url, asset.updatedAt).replace(/[<>"'`\\\s]/g, (value) =>
            value === "'" ? '%27' : encodeURIComponent(value),
          )
        : '',
    ) ?? []
  const substitute = (value: string) =>
    value.replace(
      /\{\{asset:(\d+)\}\}/g,
      (match, number: string) => assets[Number(number)] || match,
    )
  const aliases =
    ':root{--font-geist-sans:sans-serif;--font-geist-mono:monospace;--color-background:var(--website-color-background);--color-foreground:var(--website-color-foreground);--color-muted-foreground:var(--website-color-muted-foreground);--color-surface:var(--website-color-surface);--color-border:var(--website-color-border);--font-sans:var(--website-font-sans);--font-mono:var(--website-font-mono);--radius:var(--website-radius-content)}'
  const sharedStyles = `${escapeStyle(siteTokens)}${aliases}${escapeStyle(siteTypography)}`
  const measure = `(()=>{const report=()=>parent.postMessage({type:'productCode-height',height:Math.max(document.body.scrollHeight,document.body.getBoundingClientRect().height)},'*');new ResizeObserver(report).observe(document.body);window.addEventListener('load',report);if(document.fonts)document.fonts.ready.then(report);report()})()`
  // DOM script text bypasses the HTML parser while retaining normal JavaScript
  // semantics, including comparisons and strings containing HTML comment tags.
  const script = `(()=>{const script=document.createElement('script');script.textContent=${serializeScript(substitute(block.js || ''))};document.body.appendChild(script)})()`
  return `<!doctype html><html data-website-theme="default"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${sharedStyles}body{margin:0;background:var(--website-color-background);color:var(--website-color-foreground);font-family:var(--website-font-sans,sans-serif)}</style><style id="product-code-theme"></style><style>${escapeStyle(substitute(block.css || ''))}</style></head><body>${substitute(block.html)}<script>${script}</script><script>${measure}</script></body></html>`
}
