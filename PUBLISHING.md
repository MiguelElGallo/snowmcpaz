# Publishing Checklist

This repository is already standalone and can be packaged locally.

## Remaining Metadata Work

1. Replace the placeholder `publisher` value in `package.json` with your real VS Code Marketplace publisher ID.
2. Optionally rename the extension if you want a Marketplace-facing name different from the current package name.
3. Add Marketplace branding assets if you want them before first publication:
   - icon PNG
   - support contact
   - repository URL is already set

## Before Packaging

1. Update `package.json`:
   - replace `publisher`
2. Run:

```bash
npm install
npm run check
npm run build
npm test
npm run package:vsix
```

## Before Publishing To Marketplace

1. Create a VS Code Marketplace publisher.
2. Authenticate `vsce` with that publisher.
3. Package and test locally:

```bash
npm run package:vsix
code --install-extension *.vsix
```

1. Publish:

```bash
vsce publish
```

## Recommended Follow-Up Work

1. Replace Azure CLI-only auth with extension-managed sign-in if you want zero-shell UX.
2. Add pre-release or tag-driven publishing automation if you want hands-off releases.
3. Add a Marketplace icon and support metadata.

## Current Status

- `npm run check` passes.
- `npm run build` passes.
- `npm test` passes.
- `npm run package:vsix` produces a local VSIX.
- CI workflow is available in `.github/workflows/ci.yml`.

