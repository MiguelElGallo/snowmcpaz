# Publishing Checklist

This repository is already standalone and can be packaged locally.

## Remaining Metadata Work

1. Optionally rename the extension if you want a Marketplace-facing name different from the current package name.
2. Review Marketplace branding assets before wider release:
   - icon PNG is included
   - support/issues link is in the README and repository metadata
   - repository URL is set

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

## Automated Release Flow

1. Add a repository secret named `VSCE_PAT` with your Marketplace Personal Access Token.
2. Bump the version locally:

```bash
npm run bump:patch
```

3. Push the resulting Git tag.
4. GitHub Actions runs `.github/workflows/release.yml`, verifies the extension, publishes it to Marketplace, and uploads the VSIX artifact.

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
- Tag-driven Marketplace publishing is available in `.github/workflows/release.yml` once `VSCE_PAT` is configured.


