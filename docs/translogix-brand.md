# TransLogix logo

## Assets

- `public/images/brand/translogix-mark.png`: 1254 × 1254 transparent PNG monogram.
- `public/images/brand/translogix-logo-horizontal.png`: 2172 × 724 transparent PNG with the TransLogix wordmark.

The angular T and L share a base, with an open channel separating their vertical strokes. The construction takes its direction from transport wayfinding and organized handoffs. The palette follows the portal's forest green; the composition uses a single symbol and readable type.

The website uses the monogram as an alpha mask in `src/components/BrandMark.tsx`, paired with the existing live Inter wordmark. The mask takes `--accent` from the active theme: forest green in light mode and pale green in dark mode. Keep the mark proportional and retain its internal channel and transparent margins. The visible brand name supplies its accessible text; the repeated symbol is decorative.

Both exports were generated with the built-in image-generation tool using a transparent background. The original generated files remain outside the project; these project copies are the application assets.

## Generation prompts

Monogram:

```text
Use case: logo-brand. Asset type: production website brand symbol for TransLogix, a logistics operations portal connecting orders, warehouse preparation, and carriers. Create ONE carefully resolved, original TL monogram symbol, no wordmark in this asset. Design direction: sober transport wayfinding and modernist identity design; solid upright letter construction, a clear T joined to an L through one deliberate shared stroke, with a generous straight negative-space channel suggesting an organized handoff. T and L should both be readable; compact balanced square silhouette, sturdy consistent stroke weights, precise optical balance, square terminals, a single restrained chamfer if useful. Favor simple memorable construction that remains legible at 24 to 40 pixels. Flat ONE-color dark forest green #004717, completely opaque interior, crisp clean edges on a genuinely transparent background. Center the symbol and fill approximately 88 percent of the square canvas, leaving an even modest transparent safety margin. Pure two-dimensional vector-like graphic, suitable for signage and shipping labels. Do not put the mark inside a container, square tile, circle, or shield. No gradients, glow, shadows, 3D, bevels, textures, fine lines, decorative dots, sparkles, swooshes, globes, trucks, boxes, circuit motifs, generic arrow icons, mockup surfaces, extra lettering, captions, or multiple alternatives. Output just the finished monogram with alpha transparency.
```

Horizontal logo (using the generated monogram as its image reference):

```text
Use case: logo-brand. Create the finished horizontal logo lockup for TransLogix, using the attached TL monogram as the authoritative symbol reference. Keep that symbol geometry unchanged. Set it to the LEFT of the exact wordmark "TransLogix" (capital T, capital L, remaining letters lowercase), rendered exactly once. Use a sturdy, carefully kerned contemporary humanist sans serif in semibold, with clear open letter counters, approximately Inter semibold in feel. The symbol should be slightly taller than the text caps; align it optically to the wordmark. Separate symbol and wordmark by a deliberate gap approximately the width of the capital T. One simple horizontal arrangement, no tagline, no labels, no presentation board or variations. Entire logo in one uniform flat forest green #004717, 100 percent opaque fill inside the shapes and letters, genuinely transparent background. Crisp, mathematically clean, two-dimensional vector-like edges. Tight, balanced transparent margins around the complete lockup, wide landscape canvas. No gradients, noise, texture, lighting, shadows, 3D, mockup surfaces, decorative elements, or containers. Preserve the exact TL shape of the reference; add only the wordmark.
```

## Verification

The PNG decoded in Chrome with a transparent surrounding area. The shared mark and homepage brand action were checked in both themes at 1440, 390, and 320 pixels. Login and workspace entry remained functional, with no page overflow or uncaught browser errors in those checks. Desktop homepage and mobile sidebar captures were opened to inspect spacing and small-size legibility. TypeScript and the production build passed.
