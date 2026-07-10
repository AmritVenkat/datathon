# Catalyst Production Deployment

This project is now structured as a Catalyst-hosted production application:

- React client in `frontend/`
- Advanced I/O API function in `functions/chat-functions/`
- Operational records in Catalyst DataStore
- Conversation/audit records in Catalyst DataStore
- PDF export through Catalyst SmartBrowz
- Authenticated officer access through Catalyst Authentication plus `Employee.KGID` mapping

## What Can Be Done From Catalyst CLI

Use CLI for repeatable deployment and data movement:

```powershell
catalyst login --dc in
catalyst project:use <project_id_or_name>
npm --prefix frontend run build
catalyst deploy functions
catalyst deploy client
catalyst apig:enable
catalyst deploy apig
```

Data import can also be automated through CLI after tables exist:

```powershell
catalyst ds:import database/datastore_csv/01_org_geography/State.csv --table State
catalyst ds:import database/datastore_csv/01_org_geography/District.csv --table District
```

Import the remaining CSV files in the order documented in
`database/schema/DATASTORE_SCHEMA.md`.

## What Still Needs Catalyst Console

Some service setup is intentionally console-controlled:

- Create the Catalyst project and choose the correct data center.
- Enable and configure Catalyst Authentication.
- Choose Hosted or Embedded Authentication.
- Create roles: `admin`, `supervisor`, `investigator`, `analyst`, `officer`.
- Add police users and assign roles.
- Ensure each login identity maps to `Employee.KGID` in DataStore.
- Create DataStore tables and indexes before first CSV import.
- Configure API Gateway routes and require auth for every `/api/*` route except `/health`.
- Enable SmartBrowz before using `/chat/export-pdf`.
- Create private Stratus buckets before enabling document upload/RAG.
- Configure authorized domains/CORS for the final hosted domain.

## Required DataStore Tables

Create/import the 27 operational tables in `database/schema/DATASTORE_SCHEMA.md`.
Then create the extension tables in `database/schema/INTELLIGENCE_EXTENSION_SCHEMA.md`:

- `Conversation`
- `ConversationMessage`
- `AuditLog`

`Employee.KGID` is the production identity bridge. If a Catalyst user cannot be
matched to an employee row in production, the API returns `403 Police employee
mapping required`.

## API Gateway

The API should expose the Advanced I/O function under one base path:

```text
/api/* -> chat-functions
```

The frontend can then be built with:

```powershell
$env:VITE_API_BASE="/api"
npm --prefix frontend run build
```

For local Catalyst serve, the fallback remains:

```text
/server/chat-functions
```

## Security Model

The backend enforces:

- Catalyst authenticated session in production.
- Police identity mapping through `Employee.KGID`.
- Role permissions for chat, PDF export, and case mutation.
- Unit/district scoping for dashboard, case reads, hotspots, network graph, person profile, and chat answers.
- Audit writes for sensitive reads, chat, errors, and mutations.

Recommended production roles:

| Role | Scope | Capability |
|---|---|---|
| `officer` | Own police unit | read dashboard/analytics |
| `investigator` | Own police unit | read + update case status |
| `supervisor` | District units | read + update district case status |
| `analyst` | District units | analytics/chat/PDF, read-only |
| `admin` | All units | admin and service operations |

## Smoke Test

After deployment:

1. Open `/health`; it should respond without login.
2. Open the hosted client; login through Catalyst Authentication.
3. Confirm `/auth/me` returns employee, role, unit, and permissions.
4. Open Dashboard and Cases; data should be scoped to the officer.
5. Ask chat for an FIR outside the officer scope; it should not leak records.
6. Open Network; it should load from `/analytics/network`.
7. Ask a chat question, then click Export PDF.
8. Check `AuditLog` for `AUTH_ME`, `CASE_SEARCH`, `CHAT_QUERY`, and export/error events.

## Notes

The app can deploy code through CLI, but you cannot avoid the console completely.
Catalyst Authentication setup, users/roles, authorized domains, first-time
service enablement, and some service-specific permissions are console work. Once
those are done, normal code deployment and CSV imports can be CLI-driven.
