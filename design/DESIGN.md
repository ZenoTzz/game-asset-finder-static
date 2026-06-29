# Game Asset Finder Hybrid Design Contract

This project uses the official getdesign outputs generated with:

```bash
npx getdesign@latest add playstation
npx getdesign@latest add pinterest
```

Source files:

- `DESIGN.md`: PlayStation design analysis.
- `pinterest/DESIGN.md`: Pinterest design analysis.

## Execution Rule

Use PlayStation for the app shell and editorial media-tool chrome. Use Pinterest for image discovery and masonry behavior.

## PlayStation Rules Applied

- Primary brand color: `#0070d1`.
- Pressed primary: `#0064b7`.
- Dark canvas: `#000000`.
- Dark elevated surface: `#121314`.
- Dark card surface: `#181818`.
- White canvas: `#ffffff`.
- Hairline dark: `rgba(229,229,229,0.2)`.
- Body dark: `rgba(255,255,255,0.7)`.
- Primary CTA buttons are full pills, 48px height, bold label.
- Secondary dark buttons are transparent full pills with dark hairline border.
- Inputs use 4px radius and 48px height.
- Utility/product cards use 8px radius unless they are image pins.
- Avoid decorative gradients on chrome. Imagery and layout carry the visual weight.
- Avoid resting drop shadows on ordinary cards.

## Pinterest Rules Applied

- Masonry is the load-bearing visual system for image results.
- Pin cards preserve natural image proportions.
- Pin grid uses tight gutters, targeting 8px.
- Pin cards use 16px radius.
- Search controls may use full pill geometry.
- Empty states and discovery surfaces should get out of the imagery's way.
- No heavy shadows on pin cards.

## Hybrid Decisions

- Main app shell: PlayStation dark canvas.
- Workspace tabs and primary actions: PlayStation Blue pills.
- Local asset and network result cards: Pinterest pin-card behavior with 16px radius.
- Inspector/sidebar/forms/crop controls: PlayStation utility chrome.
- External source chips: pill-shaped compact controls, PlayStation dark variant.
- Network discovery header: dark PlayStation editorial band, no decorative gradient.

## Component Priorities

1. Image grid and network discovery must feel like Pinterest masonry.
2. Header, sidebars, inspector, and crop workspace must feel like PlayStation media utility chrome.
3. Upload/import/export modals should use PlayStation dark utility surfaces with clear button hierarchy.
4. Empty states should be compact, dark, and action-oriented.
