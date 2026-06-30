# Arrest Functions
Catalyst serverless functions for arrest/surrender events and chargesheets.
Endpoints: POST /arrests, GET /arrests?accusedId=, GET /arrests?districtId=&stateId=,
POST /chargesheets, GET /courts/{courtId}/hearings
Tables touched: ArrestSurrender, inv_arrestsurrenderaccused, ChargesheetDetails
