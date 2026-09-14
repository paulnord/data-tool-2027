# Detailed export reference

`fullCodeExport.ts` preserves the version-1 exporter from PR #5. It generates
complete CSV/metadata readers, detailed reports, optional residual panels and
guides, and numerical ROOT objects. The application now generates the short,
standalone programs in `src/core/fit/codeExport.ts`.

This is development/reference material, not another export setting. It shares
scientific equation definitions and peak evaluation helpers with the application.

To validate the detailed reference with installed NumPy, SciPy, Matplotlib and ROOT:

```sh
npx vite-node scripts/check-full-code-exports.ts
```

The check generates temporary version-1 bundles and executes their programs.
It checks fit coefficients, derived peak moments, metadata compatibility,
quoted CSV fields and failure handling. The normal `npm run test:code-exports`
checks the application's simple exports instead.
