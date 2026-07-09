# Kavach intelligence extension tables

Create these Catalyst DataStore tables in addition to the 27 operational tables.
`ROWID`, `CREATORID`, `CREATEDTIME`, and `MODIFIEDTIME` remain Catalyst-managed.

## Conversation

| Column | Type | Constraint |
|---|---|---|
| ConversationID | String | Unique |
| UserID | String | Indexed |
| Language | String | |
| Title | String | |
| CreatedAt | DateTime | |
| UpdatedAt | DateTime | |

## ConversationMessage

| Column | Type | Constraint |
|---|---|---|
| MessageID | String | Unique |
| ConversationID | String | Indexed |
| Role | String | |
| Content | Text | |
| Citations | Text | JSON evidence manifest |
| CreatedAt | DateTime | |

## AuditLog

| Column | Type | Constraint |
|---|---|---|
| AuditID | String | Unique |
| UserID | String | Indexed |
| UserRole | String | |
| Action | String | Indexed |
| Resource | String | Indexed |
| Details | Text | JSON |
| EventTime | DateTime | Indexed |

## Required environment variables

- `QUICKML_ENDPOINT_KEY`: optional deployed QuickML endpoint. When absent or
  unavailable, the API returns deterministic ZCQL-grounded answers.

## API Gateway

Expose the Advanced I/O function at `/api/*`. Require Catalyst Authentication for
all routes except `/health`. Restrict status mutations to investigator/supervisor
roles. Rate-limit `/chat/query` and `/chat/export-pdf`.
