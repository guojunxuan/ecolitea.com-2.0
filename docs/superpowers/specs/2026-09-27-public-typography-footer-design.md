# Public Typography and Footer Visual Design

## Goal

Give the public website one Geist Sans typography hierarchy based on the eleven measurements supplied by the site owner. Apply the hierarchy to real public components, keep titles responsive, and refine the existing Footer's type hierarchy and visual details without changing its layout or content ownership.

The owner selected Geist Sans with the supplied Notion-inspired metrics, not NotionInter or Inter. The design reference is a set of measurements, not a dependency or a wholesale copy of Notion's website. Existing `geist` package versions remain governed by `package.json` and `pnpm-lock.yaml`.

## Boundaries and Existing State

- `src/app/(frontend)/layout.tsx` exposes the installed Geist Sans and Geist Mono variable fonts. `src/styles/tokens.css` maps them to `--website-font-sans` and `--website-font-mono`.
- `src/styles/typography.css` currently defines nine older global roles. Public components mix those roles with local font declarations. The new eleven-role hierarchy replaces the old Sans role contract; code retains its Mono exception.
- `src/styles/content.css` owns scoped RichText typography. An earlier, uncommitted B adjustment in `typography.css`, `content.css`, and `PostHero/index.module.css` adds negative title tracking. Implementation must incorporate or supersede those edits deliberately, rather than discard unrelated work.
- `src/Footer/Component.tsx` composes Site Settings and Footer Global data through `adaptFooter.ts`. Site Settings owns branding, contact, social, newsletter, and legal information; Footer Global owns navigation columns. This design changes their presentation, not their persisted fields.
- The current cool-gray palette, inverse Footer theme, page spacing rhythm, Footer three-column desktop layout, mobile content order, and mobile navigation accordion remain in place.

## Typography Contract

All non-code public website roles use `--website-font-sans` (Geist Sans). Code blocks and inline code continue to use `--website-font-mono` (Geist Mono). Body and heading roles enable OpenType `lnum` and `locl` where the font supports them. Role classes set typography only and remain margin-free; spacing belongs to the consuming component or RichText scope.

| Role | Desktop size | Mobile size | Weight | Line height | Desktop tracking | Use |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `display-1` | 64px | 48px | 700 | 1 | -2.125px | Highest-impact Hero and post-cover titles |
| `display-2` | 54px | 42px | 700 | 1.04 | -1.875px | Medium-impact Hero titles |
| `heading-1` | 40px | 32px | 700 | 1.1 | -1px | Page and major section titles |
| `heading-2` | 26px | 24px | 700 | 1.23 | -0.625px | Subsection titles |
| `heading-3` | 22px | 20px | 700 | 1.27 | -0.25px | Content card titles |
| `title` | 20px | 20px | 600 | 1.4 | -0.125px | Feature, callout, and Footer newsletter titles |
| `body-md` | 16px | 16px | 400 | 1.5 | 0 | Ordinary paragraphs and card descriptions |
| `body-sm` | 15px | 15px | 400 | 1.33 | Dense descriptions, navigation links, and input text |
| `button` | 16px | 16px | 500 | 1.5 | Button labels, including the Footer subscription placeholder |
| `caption` | 14px | 14px | 400 | 1.43 | Captions, metadata, and Footer contact/legal text |
| `eyebrow` | 12px | 12px | 600 | 1.33 | Compact labels and category badges |

Mobile title tracking preserves the desktop's tight direction at the smaller size: `display-1` -1.6px, `display-2` -1.5px, `heading-1` -0.8px, `heading-2` -0.5px, and `heading-3` -0.25px. The other roles keep their desktop tracking. Desktop values apply from the existing 48rem typography breakpoint; long titles wrap naturally within their component's width. These are visual values, independent of semantic HTML heading levels.

## Public Consumer Mapping

| Consumer | Role and ownership |
| --- | --- |
| High-impact Hero title; PostHero cover title | `display-1` |
| Medium-impact Hero title | `display-2` |
| Low-impact Hero title; page titles in search, post listings, and not-found pages; major section titles | `heading-1` |
| Subsection headings in public blocks | `heading-2` |
| Content card titles | `heading-3` |
| Feature/callout titles and Footer newsletter heading | `title` |
| General descriptions, card descriptions, and prose paragraphs | `body-md` |
| Dense copy and public navigation links outside Footer | `body-sm` |
| Public buttons and Footer subscription placeholder button | `button` |
| Metadata, image captions, Footer contact/legal/copyright text | `caption` |
| Category and other compact labels | `eyebrow` |

The implementation should inspect actual consumers before changing each selector and map according to function, not merely its `h1`–`h6` tag or old class name. Existing global role consumers should compose the new role classes; component modules keep their layout, color, width, and spacing rules. Hero RichText title selectors need a Hero-owned scope so article RichText is not changed by a broad heading selector.

Article body headings inside the reading area retain their current `content.css` sizes, weights, margins, and hierarchy during this change. The PostHero title is a separate cover component and follows `display-1`. Ordinary RichText paragraphs align to `body-md` at 16px / 1.5 line height. Code typography stays Geist Mono. This preserves the owner's earlier decision to leave article headings for a separate review.

## Footer Refinement

The Footer keeps its current desktop columns, mobile stack, accordion behavior, inverse theme, content order, data adapter, and disabled newsletter placeholder. The old project's Footer is a hierarchy reference: its navigation heading is more prominent than its links. Its very small 10–13px copy is not copied into the new site.

Footer consumes the global typography roles and theme tokens as follows:

| Element | Global foundation | Footer-owned presentation |
| --- | --- | --- |
| Brand description, newsletter description and input | `body-sm` / Geist Sans | Width and intra-group spacing |
| Footer navigation links | `caption` / Geist Sans, 14px / 400 | Existing link spacing and target behavior |
| Navigation column heading and mobile trigger | `caption` / Geist Sans, 14px | Footer-owned 600 weight, 0.055em tracking, and uppercase treatment make them stronger than links |
| Newsletter heading | `title` | Existing position within the right column |
| Disabled subscription button | `button` | Disabled border, surface, and adjoining input shape |
| Address, telephone, email, copyright and legal links | `caption` | Icon alignment and group spacing |
| Social SVGs and contact icons | Semantic global color, border, size, and control tokens | Social icons use 24px artwork within the existing 44px target; contact icon alignment, hover and focus treatment stay component-owned |

The footer should use existing `--website-space-*` values for its internal spacing where they express the approved visual rhythm. This must not move sections between columns or reorder them. Social icon assets continue to come from Site Settings' Social Platform relationship; the Global stores content and assets, not CSS settings. The Footer component styles the assets and uses the inverse theme's semantic colors. No Payload schema, generated type, migration, or data change is required.

## Verification and Acceptance

- Update focused visual-foundation and frontend role tests that currently assert the old nine-role contract. Verify the eleven values, mobile/desktop title steps, margin-free role classes, code exception, and real consumer mappings.
- Preserve scoped RichText behavior and article heading measurements. Cover Hero titles separately from article headings.
- Verify the Footer server adapter still reads Site Settings and Footer Global through existing boundaries; preserve its disabled newsletter placeholder and mobile accordion behavior.
- Inspect actual pages at representative phone and desktop widths, including high/medium/low Heroes, PostHero, listing titles, cards, article paragraphs/headings, Footer navigation, contact text, social buttons, and the subscription placeholder. Check wrapping, hierarchy, contrast, targets, and horizontal overflow.
- Run the smallest relevant tests first, then TypeScript, lint, and a build in proportion to the implementation. Database-dependent tests require an isolated/local MongoDB environment. Report any skipped or blocked verification precisely.

The local HTML Footer comparison is a discussion aid, not a production source of truth. The approved role values and boundaries in this document govern implementation.
