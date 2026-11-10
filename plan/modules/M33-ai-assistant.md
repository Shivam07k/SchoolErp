# M33 — AI Assistant

**Package ID:** M33.

**Priority:** Later; only after governance approval. **Starting status:** workflow/API unverified.

## Submodules

Approved use cases; permission-aware retrieval; prompt/tool policy; citations/source links; feedback; usage/audit; disable switch.

## How it must work

Assistant uses only authorized data, distinguishes unknown facts, avoids unauthorized actions, and is disabled when provider/configuration is absent. Critical writes require explicit, approved application workflows; no direct permission bypass.

## Dependencies and links

M03 governance + M30 authorized reports/data → assistant. Uses the same server-side authorization as direct module access and logs data access appropriately.

## Files

- Form candidate: `src/forms/frmSchoolAI/`; `SchoolPage.jsx` currently handles menu dispatch.
- Dedicated AI API/provider is unverified. Any proposed UI/API must be added to `src/pages/school/ai/`, a route module, and `server/src/index.js` only after privacy/security review.
- Provider secrets belong in M03, never frontend code.

## QA plan

- Prompt injection and requests for another tenant's or restricted health/safety data.
- Test fabricated-data prompt; answer must cite authorized source or state it cannot verify.
- Confirm write action requires confirmation and uses normal API permissions.
- Test provider failure, disable switch, audit, and data retention.

**Acceptance:** AI is optional, permission-bounded, explainable, auditable, and safe when unavailable.
