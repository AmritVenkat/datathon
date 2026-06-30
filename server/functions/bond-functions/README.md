# Bond Functions
Catalyst serverless functions for the Good Conduct Bond / HS Record Tracker.
Endpoints: POST /bonds, GET /bonds/expiring?withinDays=30
Tables touched: BondRecord (extension table, see database/schema/DATASTORE_SCHEMA.md)
Triggered by: Cron (nightly expiry scan) -> Signals (alert fan-out)
