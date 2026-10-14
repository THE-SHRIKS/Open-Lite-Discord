# SIDEBAND visual system — original, editorial, engineered

## Creative brief
A communication workbench, not a gamer chat clone and not a generic SaaS dashboard. Think precise typographic hierarchies, well-crafted dark materials, subtle linework, low-contrast panels, and one judicious signal accent. The interface should feel inviting enough for everyday conversation without losing technical confidence.

## Distinct identity
Name: **SIDEBAND**. Mark: independent custom geometric glyph: two parallel open channels intersecting a slim signal bar. No Discord font, iconography, mascots, logos, color palette, or assets. Avoid identical server 'pill' icon treatment, 1:1 copied channel header, or pixel-level reproduction of Discord UI.

## Palette (CSS token requirements)
- `--canvas: #0B0D0E` deep graphite, not pure black
- `--surface-0: #101416` workspace rail
- `--surface-1: #151A1C` navigation
- `--surface-2: #1B2224` chat stage/hover
- `--surface-raised: #222B2D` menus/modals
- `--stroke: #303B3E` quiet boundary
- `--stroke-emphasis: #526163` focus delimiters
- `--type: #E9ECE7` main text
- `--type-muted: #9FAAA6` secondary
- `--type-faint: #74827E` tertiary
- `--signal: #A0BF9F` mint-olive accent for active focus or notifications ONLY
- `--danger: #CE807C` destructive
- `--warning: #D5B67A` warning
- `--success: #A6C8AC` success
No gradients for primary panels; no neon glow. Use 1px strokes, real shadows only for elevated overlays.

## Typography
Use local platform font stack (`Inter` only if license-compliant font is already bundled locally; otherwise system): `"Segoe UI Variable", "Inter", system-ui, sans-serif`. Display text uses sturdy geometric proportions; labels small and letterspaced sparingly. Default body 14px / 1.45, message content 15px / 1.6, section labels 11px uppercase only when functionally useful, screen headings 20-25px. Long content wraps; no text overflow.

## Layout 1440×900
- Edge to edge app, no giant centered card.
- Space rail **76px**, vertical, unobtrusive brand at top; spaces distinguished with typography/glyph identity, not copied circular app icons.
- Channel nav **244px** (resizable if feasible), 22px section gap. Space title in strong 18px style. Channel names clean, selected indicator as slim left rule plus soft fill.
- Content stage fluid min-width 480px. Channel header 72px including path, topic and focused controls. Message scroller uses continuous reading rhythm: grouped messages from same author, timestamps on first message or hover, avatar only on new clusters. No bubbles for every message; restrained editorial alignment.
- Optional member drawer **264px**; closed on 1024 width to preserve message width. Members grouped by role with meaningful status indicators.
- Composer anchored bottom: monolithic matte input area with top-divider and slight raised fill. 1-line -> growing multi-line, send button visibly enabled only when valid. Shortcut hint small and useful.
- Dialogs 440-520px. Search is a sheet, not giant dashboard. Fine focus ring from signal token.

## Mobile 390×844
- Space/channel drawer opens via accessible navigation controls; chat full width. Composer safe-area aware. Channel header 56px. Navigation drawers close on message selection, preserve focus. No horizontal overflow at 320px.

## Micro-interactions
120-180ms simple transitions (respect prefers-reduced-motion). Press feedback and keyboard focus must be visible. Unread count and typing presence should reflect real server data, not looped decoration. Autoscroll only when reader is near bottom; otherwise show 'New messages' marker.

## Design states (required)
No spaces, no channels, empty chat, invite invalid/expired, disconnected/reconnecting, slow/failed request, permission denied, deleted message, search zero results, upload too large, long usernames, long code block text, keyboard focus. Each state requires designed copy and accessible affordance.

## Evaluation rubric
Score each 0-5: authored visual identity, readability/hierarchy, spacing precision, state completeness, keyboard accessibility, responsive behavior, density and performance. Any 0-2 blocks phase approval. Provide 1440x900, 1024x768, 768x1024, 390x844 and 320x720 screenshots. No screenshot proof, no visual signoff.

## Implementation guardrails
Use real iconography from a bundled locally installed library if needed; limit to purposeful actions. No web font dependencies. No fake charts, fake activity graph, floating marketing hero, glassmorphism, emoji-heavy surfaces, repetitive cards or generic color-rich UI.
