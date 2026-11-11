// Compare two style dumps: `node styles-diff.mjs before after [prop-filter-regex-to-ignore]`
import { readFileSync } from 'node:fs'
const [a, b, ignore] = process.argv.slice(2)
const byIndex = (d) => Object.fromEntries(Object.entries(d).map(([st, els]) => [st, Object.fromEntries(Object.entries(els).map(([k, v]) => [k.replace(/\.[^.]*$/, '').replace(/:(\w+)$/, ':$1') + '|' + k.split('.').pop(), v]))]))
const norm = (d) => Object.fromEntries(Object.entries(d).map(([st, els]) => [st, Object.fromEntries(Object.entries(els).map(([k, v]) => [k.split('.')[0], { ...v, _k: k }]))]))
const A = norm(JSON.parse(readFileSync(`styles-${a}.json`))), B = norm(JSON.parse(readFileSync(`styles-${b}.json`)))
const ig = ignore ? new RegExp(ignore) : null
let diffs = 0
for (const state of new Set([...Object.keys(A), ...Object.keys(B)])) {
  const sa = A[state] ?? {}, sb = B[state] ?? {}
  for (const el of new Set([...Object.keys(sa), ...Object.keys(sb)])) {
    if (!sa[el] || !sb[el]) { console.log(state, el, sa[el] ? 'missing in after' : 'new in after'); diffs++; continue }
    for (const p of Object.keys(sa[el])) { if (p === '_k') continue; if (/:img$/.test(el) && /^(width|height)$/.test(p)) continue; if (sa[el][p] !== sb[el][p] && !(ig && ig.test(p))) { console.log(state, sb[el]._k, p, sa[el][p], '→', sb[el][p]); diffs++ } }
  }
}
console.log('diffs:', diffs)
