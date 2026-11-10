# M01 — Platform / Super Admin

**Package ID:** M01.

**Priority:** Conditional by deployment model. **Starting status:** unverified/high risk.

## Submodules

Tenant provisioning and lifecycle; activation/suspension; subscription/limits; support access; platform audit.

## How it must work

Platform admins provision and manage a tenant without exposing another tenant's users, data, files, or configuration. Suspension blocks sign-in and API access according to policy; reactivation restores permitted access without changing tenant data.

## Dependencies and links

Authentication → tenant context → every school module. Platform actions → immutable audit/support logs. Coordinates with M02 Settings and M03 Integrations.

## Files

- Current: `src/school/menu.js`, `src/app.jsx`, `src/components/SchoolPage.jsx`, `src/forms/frmSchoolPlatform/`.
- Backend candidates: `server/src/routes/schoolFoundation.js`, `server/src/routes/school_comprehensive.js`; verify dedicated endpoints before wiring.
- Shared: `server/src/index.js`, `server/src/middleware/auth.js`, `server/src/school/foundation.js`.

## QA plan

- A non-super-admin receives `403` for every platform endpoint, including direct API calls.
- Tenant A cannot enumerate/read/change tenant B using IDs, filters, exports, or file keys.
- Suspend/reactivate behavior is consistent for login and APIs.
- Every privileged operation records actor, tenant, time, target, and result.
- Test boundary cases: unknown tenant, duplicate tenant code, failed provisioning rollback, and unavailable database.

**Acceptance:** no cross-tenant access; admin-only actions are audited and lifecycle transitions are recoverable.
