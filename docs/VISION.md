# Experimental vision inspection

## Contract

`inspectImage({ image: { bytes, mimeType }, context: { goal, source?, channel? } }, { adapter, jev? })` accepts PNG, JPEG or WebP bytes. It does not fetch image URLs or parse PDFs. The upstream application is responsible for valid image decoding, dimensions and safely obtaining attachments. Oversized inputs are rejected before a provider call.

A `VisionAdapter` provides `provider`, `destination` and `inspect(image, context)`. Its response contains `model`, `complete`, and at most 24 observations. A complete extraction requires at least one nonempty observation, including for a text-free frame. Each observation contains `text`, `description`, `visibility` (`visible`, `low_visibility`, `non_text`) and a normalized region. The vision model observes pixels; Jev classifies the combined visual description and extracted text through the existing atomic questions. Deterministic policy owns actions.

Coordinates use the **original image**, top-left origin, values in [0,1]. `x + width` and `y + height` must not exceed 1. Invalid output, provider refusal, timeout, malformed JSON or semantic failure never produce an allow decision. An incomplete image gets `risk: null`; the code does not fabricate a probability for unknown coverage.

Findings are called `visual_prompt_injection` candidates; inspect each nested finding and action. A candidate on an allowed benign quotation is not a confirmed attack. Regions are model estimates, not certified bounding boxes. Non-allow output withholds the **whole image**, because cropping or hiding one box cannot prove the rest safe. No automatic pixel redaction exists.

## Provider configuration

- `openai`: official `/v1/chat/completions`, image data URL. API key required.
- `anthropic`: official `/v1/messages`, base64 image block. API key required.
- `openweights`: explicit `baseURL`, vision-capable model and a server implementing the chat-completions image protocol. HTTPS required except loopback HTTP. Model/server compatibility must be verified by the operator; not every open-weight model supports images or this token parameter.

Always select an explicit model. Hosted providers receive image bytes and task context. TypeSafe subsequently receives extracted observations and the goal, **not the original image**. A local open-weight vision server does not make the whole pipeline offline because Jev remains remote. Provider retention and billing are governed by your provider configuration.

The adapter formats follow the [OpenAI image guide](https://developers.openai.com/api/docs/guides/images-vision) and [Anthropic vision guide](https://platform.claude.com/docs/en/build-with-claude/vision). Calls have no tools, do not follow redirects, and do not execute instructions returned by the model.

## Benchmark protocol

`benchmarks/visual/` contains synthetic application frames and expected labels covering obvious text, low-visibility text and benign quotation. Offline tests use mocked vision/Jev responses and verify localization, validation and failure behavior. They do **not** measure actual visual detection accuracy.

For live evaluation, render fixtures with `pnpm benchmark:visual:render`, choose `VISION_PROVIDER`, `VISION_MODEL`, provider credentials and `TYPESAFE_API_KEY`, then explicitly run `pnpm benchmark:visual:live`. The run records returned vision models, requested and returned Jev model IDs, scores, actions and failures. A requested alias is not an immutable Jev version; capture the service deployment/version independently before publishing model-comparison claims.

Assess attack recall and benign false positives separately, plus incomplete/failed cases. Compare estimated regions against labeled regions; do not report mock coordinates as measured localization. Include low contrast and tiny text at original resolution. Computer-use agents require scanning each new frame; a DOM scan says nothing about screenshot pixels. Real adversarial perturbations, steganography and unseen attacks remain unvalidated. Do not claim complete multimodal protection.

## Local CLI

Export the chosen provider configuration and run `pnpm scan:image ./screen.png "Summarize support incidents"`. Only use images you are authorized to send to the configured providers. Exit code 2 means content was withheld; stdout is a local diagnostic report and must not be published or handed to the agent unfiltered.
