# Shared-text fixtures

Each case is `<name>.txt` (the exact text a maps app put on the share sheet) plus `<name>.expected.json` (the `ParsedSharedPlace` that `RegexSharedTextParser` must produce). `packages/domain/test/shared-match/regex-shared-text.parser.fixtures.test.ts` runs every pair; adding a pair adds a test.

The `synthetic-*` cases are written by hand in the formats Google Maps and Apple Maps are known to use. They are placeholders: replace or extend them with real payloads. To capture one, share a place to Notes or a chat with yourself and paste it into a `.txt` file unchanged (keep line breaks and the link).

Do not commit payloads that reveal where someone lives or was.
