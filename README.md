# RedMesh Demo UI

A Next.js App Router experience for operating the Ratio1 RedMesh framework on an Edge Node. The UI mirrors the workflows from [`edge_node` `develop`](https://github.com/Ratio1/edge_node/tree/develop) and borrows layout and interaction patterns from [`ratio1-drive`](https://github.com/Ratio1/ratio1-drive) to offer a modern operator console.

## Features
- **Credentialed sign-in** – validates users against the Ratio1 CStore API using the deployment token supplied to the Worker App Runner.
- **Live job observability** – consolidated dashboard with status cards, ongoing/backlog lists, job timelines, and aggregate findings (open ports, service fingerprints, web findings).
- **Deep dive pages** – dedicated job view (`/dashboard/jobs/:id`) exposes worker coverage, per-port telemetry, and historical events aligned with the RedMesh FastAPI schema.
- **Guided workload creation** – `/dashboard/jobs/new` hosts the advanced form that captures target, port ranges, feature set, worker count, payload URI, and optional notes with defaults derived from the RedMesh feature catalog.
- **Advanced diagnostics** – environment summary, Swagger deep-link, and configuration badges to troubleshoot missing Worker variables at a glance.
- **Edge service health** – live CStore/R1FS telemetry (or mock fallbacks) via `@ratio1/edge-node-client`, mirroring the Ratio1 Drive diagnostics flow.
- **Mock runtime** – when critical environment variables are absent the app switches to seeded data and mock credentials (`admin/admin123`, `operator/operator123`) so development and tests run offline.

## Project Layout
- `app/` – Next.js routes (`page.tsx` login, `dashboard/` console, `dashboard/jobs/[jobId]` detail, `advanced/` diagnostics, `api/` server routes).
- `components/` – UI primitives (`ui/`), domain widgets (`dashboard/`), layout scaffolding (`layout/`), and session helpers (`auth/`).
- `lib/` – API gateways (`lib/api`), shared metadata (`lib/domain`), environment helpers (`lib/config`), and reusable hooks (`lib/hooks`).
- `__tests__/` – Jest suites covering API routes and UI flows with the mock services.

## Getting Started
1. `npm install`
2. Create `.env.local` (empty values keep mock mode enabled):
   - `EE_REDMESH_API_URL`
   - `EE_CHAINSTORE_API_URL`
   - `EE_CHAINSTORE_PEERS`
   - `EE_R1FS_API_URL`
   - `EE_HOST_ID`
   - `REDMESH_TOKEN`
3. `npm run dev` and open http://localhost:3000 (job creation lives under `/dashboard/jobs/new`)

## Scripts
- `npm run dev` – start the development server with hot reload
- `npm run build` / `npm run start` – produce and serve a production build (mirrors Worker App Runner expectations)
- `npm run lint` – ESLint with Next.js Core Web Vitals config
- `npm run typecheck` – TypeScript in no-emit mode
- `npm test` / `npm run test:watch` – Jest suites against the mock RedMesh, CStore, and R1FS endpoints

## Testing
Unit and integration tests live in `__tests__/` and default to mock mode; no live services are required. Every feature (auth, job creation, job timelines, config API) should include happy-path and failure-path coverage. Extend `lib/api/mockData.ts` when adding scenarios so offline testing matches the structure of the RedMesh FastAPI responses.

## Deployment Notes
Worker App Runner deployments must inject every `EE_*` variable plus `REDMESH_TOKEN`. Missing values leave the console in mock mode and display a warning badge in the header. Secrets should only be accessed through `lib/config/env.ts`; avoid touching `process.env` directly in components. The Advanced page surfaces the current Swagger endpoint so operators can validate the RedMesh FastAPI instance shipped with the Edge Node.

## Related Projects
- RedMesh API framework – https://github.com/Ratio1/edge_node/tree/develop
- Ratio1 Drive UI reference – https://github.com/Ratio1/ratio1-drive
- Ratio1 NodeJS package - https://github.com/Ratio1/edge-node-client
