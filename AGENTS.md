# Repository Guidelines

## Project Structure & Module Organization
The app follows the Next.js App Router layout modelled after `ratio1-drive`. Public routes sit in `app/` (`app/page.tsx` for login, `app/dashboard` for the job console, `app/dashboard/jobs/new` for creation, `app/dashboard/jobs/[jobId]` for deep dives, and `app/advanced` for troubleshooting). UI building blocks live in `components/` (`components/ui` atoms, `components/dashboard` feature widgets, `components/layout` shells/providers, `components/auth` session state). Runtime logic sits in `lib/`: `lib/api` for RedMesh/CStore/R1FS gateways, `lib/domain` for shared metadata (feature catalog, job schemas), `lib/config/env.ts` for Worker App Runner configuration, and `lib/hooks` for client data hooks. Jest specs are grouped in `__tests__/` mirroring the feature surface.

## Build, Test, and Development Commands
Install dependencies once with `npm install`. Use `npm run dev` for local work, `npm run build` + `npm run start` to reproduce Worker App Runner boot, `npm run lint` and `npm run typecheck` before submitting reviews, and `npm test` (or `npm run test:watch`) to exercise the mock-backed API and UI suites.

## Coding Style & Naming Conventions
Author features in TypeScript with strict mode enabled. Prefer function components, kebab-case filenames, and colocated styles via Tailwind utility classes (keep design tokens in `app/globals.css`). Share types through `lib/api/types.ts` and `lib/domain`. Use named exports, short derived selectors, and describe non-trivial computations with a brief comment. When importing data from Ratio1 endpoints favour the service helpers instead of raw `fetch` calls.

## Testing Guidelines
The test suite mixes API route checks and Testing Library UI specs. Extend `lib/api/mockData.ts` when adding new behaviours so offline development matches production workflows from the `edge_node` `develop` branch. Add at least one happy-path and one failure-path test per feature (authentication, job creation, job timelines, advanced diagnostics). Wrap UI specs in real providers (`Providers`) so session, config, and hooks behave like the Worker runtime.

## Commit & Pull Request Guidelines
Use Conventional Commits (`feat(dashboard): surface worker status cards`) and keep PRs focused. Summaries should state user-facing impact, list manual test commands (`npm test`, `npm run lint`), and link Ratio1 issues or the relevant sections of `edge_node`/`ratio1-drive` when mirroring behaviour. Include screenshots or console captures whenever you modify dashboards or advanced diagnostics. Request review only once lint, type-checks, and tests pass locally.

## Environment & Deployment Notes
Worker App Runner supplies `R1EN_HOST_IP` + `API_PORT` for the RedMesh URL (legacy `EE_REDMESH_API_URL` still works), `EE_CHAINSTORE_API_URL`, `EE_R1FS_API_URL`, `EE_HOST_ID`, `EE_CHAINSTORE_PEERS`, and `REDMESH_TOKEN`. Missing values automatically enable mock mode; never deploy with `mockMode` flagged true. Sensitive configuration must flow through `lib/config/env.ts`—avoid reading `process.env` in components. Keep the Swagger link surfaced in `app/advanced` aligned with the upstream RedMesh FastAPI instance from `edge_node` and document any new configuration flags in the README when they ship.
