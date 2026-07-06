# ==========================================
# Zoho Catalyst Bulk Import Script
# ==========================================

$config = "configs/import.json"

Write-Host "=============================="
Write-Host "Starting Catalyst Data Import..."
Write-Host "=============================="

# -----------------------------
# 01_org_geography
# -----------------------------

#catalyst ds:import database/datastore_csv/01_org_geography/State.csv --table State --config $config
#catalyst ds:import database/datastore_csv/01_org_geography/District.csv --table District --config $config
#catalyst ds:import database/datastore_csv/01_org_geography/UnitType.csv --table UnitType --config $config
catalyst ds:import database/datastore_csv/01_org_geography/Unit.csv --table Unit --config $config
#catalyst ds:import database/datastore_csv/01_org_geography/Rank.csv --table Rank --config $config
#catalyst ds:import database/datastore_csv/01_org_geography/Designation.csv --table Designation --config $config
#catalyst ds:import database/datastore_csv/01_org_geography/Employee.csv --table Employee --config $config
#catalyst ds:import database/datastore_csv/01_org_geography/Court.csv --table Court --config $config

# -----------------------------
# 02_legal_reference
# -----------------------------

#catalyst ds:import database/datastore_csv/02_legal_reference/Act.csv --table Act --config $config
#catalyst ds:import database/datastore_csv/02_legal_reference/Section.csv --table Section --config $config
#catalyst ds:import database/datastore_csv/02_legal_reference/CrimeHead.csv --table CrimeHead --config $config
#catalyst ds:import database/datastore_csv/02_legal_reference/CrimeSubHead.csv --table CrimeSubHead --config $config
#catalyst ds:import database/datastore_csv/02_legal_reference/CrimeHeadActSection.csv --table CrimeHeadActSection --config $config

# -----------------------------
# 03_lookup_master
# -----------------------------

#catalyst ds:import database/datastore_csv/03_lookup_master/CaseCategory.csv --table CaseCategory --config $config
#catalyst ds:import database/datastore_csv/03_lookup_master/GravityOffence.csv --table GravityOffence --config $config
#catalyst ds:import database/datastore_csv/03_lookup_master/CaseStatusMaster.csv --table CaseStatusMaster --config $config
#catalyst ds:import database/datastore_csv/03_lookup_master/CasteMaster.csv --table CasteMaster --config $config
#catalyst ds:import database/datastore_csv/03_lookup_master/ReligionMaster.csv --table ReligionMaster --config $config
#catalyst ds:import database/datastore_csv/03_lookup_master/OccupationMaster.csv --table OccupationMaster --config $config

# -----------------------------
# 04_core_transactional
# -----------------------------

#catalyst ds:import database/datastore_csv/04_core_transactional/CaseMaster.csv --table CaseMaster --config $config
#catalyst ds:import database/datastore_csv/04_core_transactional/ComplainantDetails.csv --table ComplainantDetails --config $config
#catalyst ds:import database/datastore_csv/04_core_transactional/Victim.csv --table Victim --config $config
catalyst ds:import database/datastore_csv/04_core_transactional/Accused.csv --table Accused --config $config
#catalyst ds:import database/datastore_csv/04_core_transactional/ActSectionAssociation.csv --table ActSectionAssociation --config $config
catalyst ds:import database/datastore_csv/04_core_transactional/ArrestSurrender.csv --table ArrestSurrender --config $config
#catalyst ds:import database/datastore_csv/04_core_transactional/inv_arrestsurrenderaccused.csv --table inv_arrestsurrenderaccused --config $config
#catalyst ds:import database/datastore_csv/04_core_transactional/ChargesheetDetails.csv --table ChargesheetDetails --config $config

# -----------------------------
# 05_extensions
# -----------------------------

#catalyst ds:import database/datastore_csv/05_extensions/Inv_OccuranceTime.csv --table Inv_OccuranceTime --config $config
#catalyst ds:import database/datastore_csv/05_extensions/BondRecord.csv --table BondRecord --config $config

Write-Host ""
Write-Host "=================================="
Write-Host "All Import Commands Submitted!"
Write-Host "=================================="

pause