# Brand assets

The current GRIDI logo asset files are:

- `src/ui/logo/gridi-symbol.svg` — compact symbol.
- `src/ui/logo/gridi-wordmark.svg` — horizontal wordmark.
- `src/ui/logo/gridi_logo_v3_source.svg` — editable/source exploration file.

## Production asset guidance

For production usage (`gridi-symbol.svg` and `gridi-wordmark.svg`):

- Assets should be background-free (no background rectangle).
- Assets should use `currentColor` so logo color follows context.
- Color should be controlled by CSS (for example, via `color` on a parent element).

`gridi_logo_v3_source.svg` is maintained as an editable/source exploration file and is not the production delivery artifact.

## Integration status

These assets are not yet integrated into the app header or favicon.
