# TranceLogix brand assets

The product name is **TranceLogix**, with capital T and L. Technical names use `trancelogix`.

- `public/images/brand/trancelogix-mark.png`: the established transparent TL monogram, renamed without changing its pixels.
- `public/images/brand/trancelogix-logo-horizontal.png`: the horizontal logo with the corrected TranceLogix wordmark.

The website uses the shared `BrandMark` component with a live text wordmark. The monogram takes the active theme's accent color through an alpha mask. Preserve the monogram's proportions, clear internal channel, and transparent margins.

The horizontal raster logo was edited with the built-in image-generation tool to update the embedded name. The original export is preserved in Git history; the generated source also remains in the image tool's output directory. No OpenAI API credential was used by the application for this asset edit.

## Wordmark edit prompt

```text
Use case: text-localization. Asset type: production horizontal logo PNG. Input image 1 is the edit target, the current forest green TL logo and wordmark. Change ONLY the wordmark from its current spelling to the EXACT text "TranceLogix" (T r a n c e L o g i x; capital T and L, every other letter lowercase). Preserve the existing TL monogram geometry, flat forest green #004717, semibold sans-serif typography, horizontal arrangement, visual weight, and generous clear margins. Rebalance the wordmark spacing only as needed for the extra letters. Entire mark must fit inside the image with no cropping. Keep a genuinely transparent background. Crisp two-dimensional opaque shapes. No gradients, shadows, textures, 3D, decoration, captions, mockup surfaces, or extra words. Output exactly one logo.
```
