# Changelog

Notable user-facing changes are recorded here. The release notes for a published version should be reviewed against its final artifacts.

## Unreleased (3.0.0 candidate)

- Add OpenAI, Anthropic, and Gemini translation providers, with optional provider-native asynchronous Batch API settings.
- Translate mod language resources into an instance resource pack without rewriting source mod JARs; support explicit per-target replacement when a locale already exists.
- Cover multiple quest layouts, including localized SNBT outputs where supported and backed-up in-place replacement for legacy inline quest text.
- Add structural/key-set validation and retry handling for model responses, plus fixture-based tests for extraction and output application.
- Improve translation logs and add scan-only and real-app end-to-end test paths.
- Prepare signed updater artifacts, updater manifests, and SHA-256 checksums in the release workflow.
