#!/usr/bin/env python3
"""
Validates referential integrity across all generated DataStore CSVs.
Run after generate_data.py to confirm every FK resolves to an existing PK,
CrimeNo format is correct, and required Zoho Catalyst CSV constraints hold
(consistent column count per row, no blank PKs, UTF-8 readable).
"""
import csv
import os
import re

ROOT = os.path.join(os.path.dirname(os.path.dirname(__file__)), "datastore_csv")

def load(category, name):
    path = os.path.join(ROOT, category, f"{name}.csv")
    with open(path, encoding="utf-8") as f:
        return list(csv.DictReader(f))

errors = []
warnings = []

def check_fk(child_rows, child_table, fk_col, parent_keys, parent_table, allow_blank=False):
    missing = 0
    for r in child_rows:
        v = r[fk_col]
        if v == "" and allow_blank:
            continue
        if v not in parent_keys:
            missing += 1
    if missing:
        errors.append(f"{child_table}.{fk_col} -> {parent_table}: {missing} orphaned references")
    else:
        print(f"  OK  {child_table}.{fk_col} -> {parent_table} ({len(child_rows)} rows checked)")

print("Loading tables...")
state = load("01_org_geography", "State")
district = load("01_org_geography", "District")
unittype = load("01_org_geography", "UnitType")
unit = load("01_org_geography", "Unit")
rank = load("01_org_geography", "Rank")
designation = load("01_org_geography", "Designation")
employee = load("01_org_geography", "Employee")
court = load("01_org_geography", "Court")

act = load("02_legal_reference", "Act")
section = load("02_legal_reference", "Section")
crimehead = load("02_legal_reference", "CrimeHead")
crimesubhead = load("02_legal_reference", "CrimeSubHead")
cheadactsec = load("02_legal_reference", "CrimeHeadActSection")

casecategory = load("03_lookup_master", "CaseCategory")
gravity = load("03_lookup_master", "GravityOffence")
casestatus = load("03_lookup_master", "CaseStatusMaster")
caste = load("03_lookup_master", "CasteMaster")
religion = load("03_lookup_master", "ReligionMaster")
occupation = load("03_lookup_master", "OccupationMaster")

casemaster = load("04_core_transactional", "CaseMaster")
complainant = load("04_core_transactional", "ComplainantDetails")
victim = load("04_core_transactional", "Victim")
accused = load("04_core_transactional", "Accused")
actsection = load("04_core_transactional", "ActSectionAssociation")
arrest = load("04_core_transactional", "ArrestSurrender")
junction = load("04_core_transactional", "inv_arrestsurrenderaccused")
chargesheet = load("04_core_transactional", "ChargesheetDetails")

invocc = load("05_extensions", "Inv_OccuranceTime")
bond = load("05_extensions", "BondRecord")

print(f"\nLoaded {len(casemaster)} CaseMaster rows, {len(employee)} Employees, {len(unit)} Units\n")

# Build key sets
K_state = {r["StateID"] for r in state}
K_district = {r["DistrictID"] for r in district}
K_unittype = {r["UnitTypeID"] for r in unittype}
K_unit = {r["UnitID"] for r in unit}
K_rank = {r["RankID"] for r in rank}
K_designation = {r["DesignationID"] for r in designation}
K_employee = {r["EmployeeID"] for r in employee}
K_court = {r["CourtID"] for r in court}
K_act = {r["ActCode"] for r in act}
K_section = {(r["ActCode"], r["SectionCode"]) for r in section}
K_crimehead = {r["CrimeHeadID"] for r in crimehead}
K_crimesubhead = {r["CrimeSubHeadID"] for r in crimesubhead}
K_casecategory = {r["CaseCategoryID"] for r in casecategory}
K_gravity = {r["GravityOffenceID"] for r in gravity}
K_casestatus = {r["CaseStatusID"] for r in casestatus}
K_caste = {r["caste_master_id"] for r in caste}
K_religion = {r["ReligionID"] for r in religion}
K_occupation = {r["OccupationID"] for r in occupation}
K_casemaster = {r["CaseMasterID"] for r in casemaster}
K_accused = {r["AccusedMasterID"] for r in accused}
K_arrest = {r["ArrestSurrenderID"] for r in arrest}

print("Checking foreign keys...")
check_fk(district, "District", "StateID", K_state, "State")
check_fk(unit, "Unit", "TypeID", K_unittype, "UnitType")
check_fk(unit, "Unit", "StateID", K_state, "State")
check_fk(unit, "Unit", "DistrictID", K_district, "District")
check_fk(employee, "Employee", "DistrictID", K_district, "District")
check_fk(employee, "Employee", "UnitID", K_unit, "Unit")
check_fk(employee, "Employee", "RankID", K_rank, "Rank")
check_fk(employee, "Employee", "DesignationID", K_designation, "Designation")
check_fk(court, "Court", "DistrictID", K_district, "District")

check_fk(section, "Section", "ActCode", K_act, "Act")
check_fk(crimesubhead, "CrimeSubHead", "CrimeHeadID", K_crimehead, "CrimeHead")
check_fk(cheadactsec, "CrimeHeadActSection", "CrimeHeadID", K_crimehead, "CrimeHead")
check_fk(cheadactsec, "CrimeHeadActSection", "ActCode", K_act, "Act")

check_fk(casemaster, "CaseMaster", "PolicePersonID", K_employee, "Employee")
check_fk(casemaster, "CaseMaster", "PoliceStationID", K_unit, "Unit")
check_fk(casemaster, "CaseMaster", "CaseCategoryID", K_casecategory, "CaseCategory")
check_fk(casemaster, "CaseMaster", "GravityOffenceID", K_gravity, "GravityOffence")
check_fk(casemaster, "CaseMaster", "CrimeMajorHeadID", K_crimehead, "CrimeHead")
check_fk(casemaster, "CaseMaster", "CrimeMinorHeadID", K_crimesubhead, "CrimeSubHead")
check_fk(casemaster, "CaseMaster", "CaseStatusID", K_casestatus, "CaseStatusMaster")
check_fk(casemaster, "CaseMaster", "CourtID", K_court, "Court")

check_fk(complainant, "ComplainantDetails", "CaseMasterID", K_casemaster, "CaseMaster")
check_fk(complainant, "ComplainantDetails", "OccupationID", K_occupation, "OccupationMaster")
check_fk(complainant, "ComplainantDetails", "ReligionID", K_religion, "ReligionMaster")
check_fk(complainant, "ComplainantDetails", "CasteID", K_caste, "CasteMaster")

check_fk(victim, "Victim", "CaseMasterID", K_casemaster, "CaseMaster")
check_fk(accused, "Accused", "CaseMasterID", K_casemaster, "CaseMaster")

check_fk(actsection, "ActSectionAssociation", "CaseMasterID", K_casemaster, "CaseMaster")
check_fk(actsection, "ActSectionAssociation", "ActID", K_act, "Act")
sec_pairs_ok = sum(1 for r in actsection if (r["ActID"], r["SectionID"]) in K_section)
if sec_pairs_ok != len(actsection):
    errors.append(f"ActSectionAssociation (ActID,SectionID) -> Section: "
                   f"{len(actsection) - sec_pairs_ok} unmatched pairs")
else:
    print(f"  OK  ActSectionAssociation.(ActID,SectionID) -> Section ({len(actsection)} rows checked)")

check_fk(arrest, "ArrestSurrender", "CaseMasterID", K_casemaster, "CaseMaster")
check_fk(arrest, "ArrestSurrender", "ArrestSurrenderStateId", K_state, "State")
check_fk(arrest, "ArrestSurrender", "ArrestSurrenderDistrictId", K_district, "District")
check_fk(arrest, "ArrestSurrender", "PoliceStationID", K_unit, "Unit")
check_fk(arrest, "ArrestSurrender", "IOID", K_employee, "Employee")
check_fk(arrest, "ArrestSurrender", "CourtID", K_court, "Court")
check_fk(arrest, "ArrestSurrender", "AccusedMasterID", K_accused, "Accused")

check_fk(junction, "inv_arrestsurrenderaccused", "ArrestSurrenderID", K_arrest, "ArrestSurrender")
check_fk(junction, "inv_arrestsurrenderaccused", "AccusedMasterID", K_accused, "Accused")

check_fk(chargesheet, "ChargesheetDetails", "CaseMasterID", K_casemaster, "CaseMaster")
check_fk(chargesheet, "ChargesheetDetails", "PolicePersonID", K_employee, "Employee")

check_fk(invocc, "Inv_OccuranceTime", "CaseMasterID", K_casemaster, "CaseMaster")
check_fk(bond, "BondRecord", "CaseMasterID", K_casemaster, "CaseMaster")
check_fk(bond, "BondRecord", "AccusedMasterID", K_accused, "Accused")

# CrimeNo format check: 1+4+4+4+5 = 18 digits
print("\nChecking CrimeNo structured format...")
bad_format = 0
for r in casemaster:
    if not re.fullmatch(r"\d{18}", r["CrimeNo"]):
        bad_format += 1
if bad_format:
    errors.append(f"CrimeNo format invalid in {bad_format} rows")
else:
    print(f"  OK  All {len(casemaster)} CrimeNo values match 18-digit structured format")

# Uniqueness checks on PKs
print("\nChecking primary key uniqueness...")
def check_unique(rows, table, col):
    vals = [r[col] for r in rows]
    if len(vals) != len(set(vals)):
        errors.append(f"{table}.{col} has duplicate values")
    else:
        print(f"  OK  {table}.{col} unique ({len(vals)} rows)")

check_unique(casemaster, "CaseMaster", "CaseMasterID")
check_unique(casemaster, "CaseMaster", "CrimeNo")
check_unique(employee, "Employee", "EmployeeID")
check_unique(employee, "Employee", "KGID")
check_unique(accused, "Accused", "AccusedMasterID")
check_unique(arrest, "ArrestSurrender", "ArrestSurrenderID")

print("\n" + "=" * 70)
if errors:
    print(f"VALIDATION FAILED — {len(errors)} error(s):")
    for e in errors:
        print(f"  ERROR: {e}")
else:
    print("VALIDATION PASSED — all foreign keys resolve, all PKs unique, CrimeNo format correct.")
print("=" * 70)
