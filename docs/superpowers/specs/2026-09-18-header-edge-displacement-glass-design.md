# Header Edge-Displacement Glass Design

## Status

Approved visual direction; implementation pending.

## Context

The desktop Header and Mega Menu already have a working Payload-driven data model,
DOM structure, and pointer/click interaction model. Their current translucent
surface relies mainly on `backdrop-filter`, which produces a uniform blur and a
white veil. The desired result is closer to the optical behavior demonstrated by
`liquid-glass-react` and the liquid-glass reference site: the center remains
legible and relatively clean, while the glass boundary subtly displaces and
separates the sampled background.

## Goals

- Change desktop glass optics only; preserve mobile behavior.
- Preserve Header and Mega Menu component ownership, Payload data normalization,
  DOM semantics, keyboard behavior, hover behavior, and open/close timing.
- Keep the current native `backdrop-filter` surface as the base material.
- Add a static, edge-only SVG displacement treatment inspired by the reference:
  a fixed displacement texture, edge mask, small RGB channel offsets, and a clean
  center composite.
- Keep Header and Mega Menu content sharp and readable.
- Avoid continuous animation, pointer-following optics, local caustic layers, and
  dynamic highlight layers.
- Provide a progressive fallback for browsers without backdrop blur or SVG filter
  support.

## Non-goals

- Do not add the `liquid-glass-react` dependency.
- Do not replace the Header/Mega Menu architecture or introduce a second data
  source.
- Do not add mobile glass effects in this change.
- Do not use full-surface procedural noise or animated displacement.

## Proposed Architecture

The existing surface elements remain the owners of layout and interaction:

```text
.header-surface / .mega-menu
├── existing ::before base material
├── .glass-edge-optics decorative sibling
│   └── .glass-edge-warp (static SVG-filtered backdrop sample)
└── existing content layer
```

The decorative layer is `aria-hidden`, `pointer-events: none`, and positioned
behind the existing content. It must not change layout dimensions or affect hit
testing.

### Base material

- Header: approximately 18px to 20px blur, 120% to 128% saturation, and a very
  light white tint (about 8% to 14%).
- Mega Menu: approximately 22px blur, 125% to 132% saturation, and a light white
  tint (about 10% to 16%).
- Existing border, shadow, state visibility, and overlay rules remain intact.

### Edge displacement filter

The filter is defined once in a hidden SVG `<defs>` block and referenced by the
decorative layer. Its stages are:

1. `feImage` loads a small static displacement texture, avoiding per-frame noise
   generation.
2. `feColorMatrix` and `feComponentTransfer` derive an edge mask.
3. Three `feDisplacementMap` stages sample the source with small R/G/B scale
   differences to create restrained chromatic aberration.
4. `feGaussianBlur` softens the channel result.
5. `feComposite` keeps the original source in the center and applies the optical
   result only where the edge mask is active.

The displacement must be intentionally smaller than the reference demo's
interactive settings. Initial target ranges are 8px to 14px for Header and 12px
to 20px for Mega Menu, with chromatic separation kept around 0.5px to 1.5px.

## State and Data Flow

No Payload fields or presentation-model contracts change. The existing state
attributes continue to control visibility:

- `data-scrolled` and `data-menu-open` control Header material visibility.
- `data-open` controls Mega Menu visibility.
- Existing `current` versus `proposed` demo controls remain demo-only and are not
  part of production behavior.

The optical layer is static after mount. There is no React state, pointer event,
requestAnimationFrame loop, or idle animation for the effect.

## Browser Fallback

- If `backdrop-filter` is unavailable, use a higher-opacity solid surface and keep
  content readable.
- If the SVG filter is unavailable or disabled by the browser, render only the
  native translucent surface and border treatment.
- Respect `prefers-reduced-motion`; the design has no required motion, so this is
  naturally satisfied.

## Verification

The implementation will be verified at desktop widths with:

- Header top, scrolled, and menu-open states.
- Mega Menu products, block, and card navigation variants.
- Existing hover, click, Escape, overlay-close, and category-switch interactions.
- A visual comparison against the current uniform-blur treatment.
- Browser console with zero new errors or warnings.
- A browser without supported backdrop blur, if available, to confirm fallback
  legibility.

Success means the boundary visibly refracts sampled page content without broad
  grey/blue bands, while menu text and product cards remain sharp and interaction
  behavior is unchanged.
