# Editorial Design System — Font Variant A

Canonical reference for the Open Health Data Hub visual design.

## Typography

| Role | Font | Usage |
|------|------|-------|
| Headline | Playfair Display 700 | Page titles, hero headlines, stat numbers |
| Subhead | Lora 400/italic | Deck text, subtitles, chart subtitles |
| Body | Merriweather 400 | Paragraphs, descriptions, long-form text |
| UI | DM Sans 400–700 | Navigation, buttons, labels, table data, metadata |
| Mono | JetBrains Mono 400–500 | SQL code blocks, inline code |

CSS variables: `--font-playfair`, `--font-lora`, `--font-merriweather`, `--font-dm-sans`, `--font-jetbrains`

Tailwind classes: `font-headline`, `font-subhead`, `font-serif` (body), `font-sans` (UI), `font-mono`

## Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `background` | `#FAFAF5` | Page background (warm cream) |
| `surface` | `#FFFFFF` | Card backgrounds |
| `foreground` | `#1C1917` | Primary text, headings |
| `body` | `#57534E` | Body text |
| `muted` | `#78716C` | Secondary text, metadata |
| `muted-dark` | `#57534E` | Alias for body |
| `accent` | `#B91C1C` | Primary CTA, red accent |
| `accent-hover` | `#991B1B` | Hover state for accent |
| `teal` | `#0F766E` | Links, secondary accent |
| `teal-hover` | `#0D6560` | Hover state for teal |
| `rule` | `#D6D3D1` | Standard horizontal rules, borders |
| `rule-light` | `#E7E5E4` | Light dividers, inner borders |

Shadows:
- `warm-shadow`: `rgba(28, 25, 23, 0.06)` — card default
- `warm-shadow-lg`: `rgba(28, 25, 23, 0.1)` — card hover

## Component Patterns

### Cards
- Background: white (`bg-surface`)
- Border: `1px solid rule`
- Radius: `2px` (`rounded-sm`)
- Shadow: `0 1px 4px warm-shadow`
- Hover: `0 4px 16px warm-shadow-lg` + `translateY(-1px)`

### Buttons
- **Primary**: Red bg (`accent`), white text, DM Sans 600, uppercase, 0.06em tracking, 2px radius
- **Secondary**: White bg, rule border, foreground text, DM Sans
- **Text link**: Teal color, underline on hover

### Inputs
- Font: Lora italic
- Background: `#FAFAF5` (bg)
- Border: `1px solid rule`
- Focus: `border-color: accent` (red)
- Radius: 2px

### Tables
- Header: DM Sans uppercase 0.6875rem, `border-top: 2px solid foreground`, `border-bottom: 1px solid foreground`
- Cells: DM Sans, `font-feature-settings: 'tnum' 1`, right-aligned numerics
- Row borders: `1px solid rule-light`
- Row hover: `#F5F5F0` background

### Code Blocks
- Background: `#F5F5F0`
- Border: `1px solid rule-light`
- Font: JetBrains Mono 0.8125rem
- Syntax: red keywords, teal functions, gold/amber numbers, green strings

### Section Labels
- DM Sans 0.75rem 600, uppercase, 0.12em tracking
- Red accent color
- Flanking horizontal rules (CSS `::before`/`::after`)

## Horizontal Rules

| Class | Style |
|-------|-------|
| `.rule` | `1px solid rule` |
| `.rule-thick` | `3px solid foreground` |
| `.rule-thin` | `1px solid rule-light` |

## Spacing

- Section padding: `3.5rem 0 2rem` between major sections
- Card padding: `1.75rem 1.5rem`
- Max content width: `1080px` (container), `900px` (analysis pages)

## Animations

- `fadeInUp`: 0.5s ease-out, translateY(16px) → 0
- Staggered delays: 0.1s increments (d1–d5)
- Card hover: `0.2s ease` shadow + translateY transitions

## Responsive Breakpoints

- `768px`: Stack grids to 1-col, reduce font sizes, center footer
- `480px`: Further reduce headlines, hide nav separators

## Chart Styling

- Primary color: `#B91C1C` (red accent)
- Grid: `#E7E5E4` (rule-light)
- Axes: `#78716C` (muted)
- Tooltip: white bg, rule border, warm shadow
- Area fill gradient: accent at 12% opacity → 1% opacity

## Dataset Accent Colors

| Dataset | Color | Hex |
|---------|-------|-----|
| Medicaid | Red | `#B91C1C` |
| Medicare | Teal | `#0F766E` |
| BRFSS | Blue | `#1D4ED8` |
| NHANES | Purple | `#7C3AED` |
