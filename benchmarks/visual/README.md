# Visual fixtures

Six synthetic raster frames: a Slack-style attachment, low-contrast website text, tiny footer, PDF-style security quotation, normal email and fake authority panel. All content is fictional. PDF-style means a rendered image, not a PDF parser fixture.

`pnpm benchmark:visual:render` regenerates the PNGs with local Chromium. `pnpm benchmark:visual` checks fixture contracts and image presence offline; package tests validate provider protocols, localization and failure behavior with mocks. Neither measures vision-model efficacy.

`pnpm benchmark:visual:live` explicitly sends these synthetic images to the configured vision endpoint, then observations to Jev. Supply provider and TypeSafe credentials; this incurs usage. Results include requested/returned model provenance. Review false positives, missed attacks, errors and estimated regions; no live accuracy claim is made without actual results. Real adversarial perturbations are not included yet.
