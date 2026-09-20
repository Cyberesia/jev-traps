# Publishing cyberesia/jev-traps

## GitHub source release

The working folder may be an exported directory rather than a Git checkout. Review it before initializing Git. Keep `.env*` (except `.env.example`), `node_modules`, `.next`, `dist`, private submissions, raw screenshots and credentials out of commits.

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm benchmark
pnpm benchmark:visual
pnpm --filter @jev-traps/registry build
```

Run the live benchmarks only intentionally with synthetic fixtures and explicit provider credentials. They consume credits. Record missing live validations as limitations rather than publishing mock numbers as efficacy claims.

After reviewing the staged files, the maintainer can initialize the repository, create `main`, add `https://github.com/cyberesia/jev-traps.git` as origin, commit and push. No automatic GitHub publication is performed by these scripts. Enable private vulnerability reporting and GitHub branch protections. CI tests run without provider keys; do not expose secrets to pull-request workflows.

## npm preparation

The public package scope `@jev-traps` must be controlled by the maintainer before publishing. Package metadata points to cyberesia/jev-traps. npm publication has not been assumed or performed. Build first, then pack in dependency order:

```bash
pnpm build:packages
mkdir -p artifacts/packages
pnpm --filter @jev-traps/core pack --pack-destination artifacts/packages
pnpm --filter @jev-traps/destination pack --pack-destination artifacts/packages
pnpm --filter @jev-traps/jev pack --pack-destination artifacts/packages
pnpm --filter @jev-traps/vision pack --pack-destination artifacts/packages
pnpm --filter @jev-traps/playwright pack --pack-destination artifacts/packages
pnpm --filter @jev-traps/sdk pack --pack-destination artifacts/packages
```

Inspect every tarball: compiled ESM, declarations, README, Apache license; no credentials, test reports or private content. pnpm rewrites workspace dependencies to package versions in packed manifests. For a local consumer install all packed dependencies together. For a public release use explicit version bumps, changelog and npm provenance/trusted publishing under a maintainer-controlled release workflow. Do not publish from PR CI.

## Site deployment

`pnpm --filter @jev-traps/registry build` creates the Next.js application. Deploy to a Node-capable host. No provider key is needed for the public site. Production intake is off by default; see [registry operations](REGISTRY.md) before enabling a persistent queue. Publishing the source is independent from deploying a public website.

For a new local checkout, the maintainer's publication sequence is:

```bash
git init -b main
git add .
git diff --cached --stat
# Review staged files and secret exclusions before continuing.
git commit -m "Prepare Jev Traps open-source preview"
git remote add origin https://github.com/cyberesia/jev-traps.git
git push -u origin main
```

Create the empty GitHub repository under the intended owner first. If the folder is already a Git checkout, inspect its existing origin and history instead of repeating initialization.
