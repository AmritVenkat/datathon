# Person Functions
Catalyst serverless functions for Complainant, Victim, and Accused writes.
Endpoints: POST /cases/{id}/complainants, POST /cases/{id}/victims,
POST /cases/{id}/accused (auto-assigns PersonID A1, A2...), GET /accused/{id}/profile
Tables touched: ComplainantDetails, Victim, Accused
