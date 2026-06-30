# Analytics Functions
Catalyst serverless functions for hotspot clustering, risk scoring, gang networks.
Endpoints: GET /analytics/hotspots, GET /analytics/risk-score/{accusedMasterId},
GET /analytics/gang-network, POST /alerts/escape, GET /districts/{id}/stats
Tables touched: CaseMaster (lat/long), Accused, ArrestSurrender, Victim
