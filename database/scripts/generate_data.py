#!/usr/bin/env python3
"""
KSP Crime Intelligence Platform — Synthetic Data Generator
=============================================================
Generates a complete, referentially-consistent synthetic dataset for every
table in the Police FIR ER schema, exported as Zoho Catalyst DataStore
compatible CSV files.

Zoho Catalyst DataStore CSV import requirements respected here:
  - UTF-8 encoding, comma-delimited, header row = exact column names
  - No ROWID column included (Catalyst auto-assigns ROWID on import)
  - Date / DateTime columns formatted as "yyyy-MM-dd" / "yyyy-MM-dd HH:mm:ss"
  - Boolean / BIT columns exported as 0 / 1 (Catalyst has no native BIT type,
    these tables should be created with column type "Number" or "Boolean")
  - Foreign-key columns export the referenced PK value (plain integer/string),
    since Catalyst DataStore does not enforce FK constraints natively —
    integrity is therefore guaranteed at generation time, in dependency order
  - All text fields free of embedded raw commas/newlines that could break
    naive CSV parsing (handled automatically by Python's csv module anyway)
  - Files are written one-table-per-CSV, named exactly as the table name,
    so they can be bulk-uploaded directly as DataStore tables of the same name

Run:
    python3 generate_data.py
"""

import csv
import os
import random
from datetime import datetime, timedelta, date

from faker import Faker

# ----------------------------------------------------------------------------
# CONFIG
# ----------------------------------------------------------------------------

SEED = 42
random.seed(SEED)
fake = Faker("en_IN")
Faker.seed(SEED)

OUTPUT_ROOT = os.path.join(os.path.dirname(os.path.dirname(__file__)), "datastore_csv")

DIRS = {
    "org": os.path.join(OUTPUT_ROOT, "01_org_geography"),
    "legal": os.path.join(OUTPUT_ROOT, "02_legal_reference"),
    "lookup": os.path.join(OUTPUT_ROOT, "03_lookup_master"),
    "core": os.path.join(OUTPUT_ROOT, "04_core_transactional"),
    "ext": os.path.join(OUTPUT_ROOT, "05_extensions"),
}
for d in DIRS.values():
    os.makedirs(d, exist_ok=True)

# Volume knobs — tuned to be demo-realistic but fast to generate
N_DISTRICTS = 31                 # Karnataka has 31 districts (real count)
N_UNITS_PER_DISTRICT = 6
N_COURTS_PER_DISTRICT = 2
N_EMPLOYEES = 1200
N_CASES = 4000
MAX_VICTIMS_PER_CASE = 3
MAX_ACCUSED_PER_CASE = 4
MAX_COMPLAINANTS_PER_CASE = 2
MAX_SECTIONS_PER_CASE = 3
ARREST_RATE = 0.55               # fraction of accused with an arrest/surrender event
CHARGESHEET_RATE = 0.62          # fraction of cases with a chargesheet outcome
BOND_RATE = 0.18                 # fraction of arrested accused with a Good Conduct Bond

YEAR_RANGE = (2023, 2026)

# ----------------------------------------------------------------------------
# WRITE HELPER
# ----------------------------------------------------------------------------

def write_csv(category, table_name, fieldnames, rows):
    """Write rows to /<category>/<table_name>.csv, Catalyst-import-ready."""
    path = os.path.join(DIRS[category], f"{table_name}.csv")
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="raise")
        writer.writeheader()
        for r in rows:
            writer.writerow(r)
    print(f"  [OK] {table_name:<28} {len(rows):>6} rows -> {os.path.relpath(path, OUTPUT_ROOT)}")
    return path


def dt(d):
    return d.strftime("%Y-%m-%d %H:%M:%S")


def dt_date(d):
    return d.strftime("%Y-%m-%d")


def rand_date_between(start_year, end_year):
    start = date(start_year, 1, 1)
    end = date(end_year, 6, 30)
    delta = (end - start).days
    return start + timedelta(days=random.randint(0, delta))


def rand_datetime_between(start_year, end_year):
    d = rand_date_between(start_year, end_year)
    return datetime(d.year, d.month, d.day, random.randint(0, 23), random.randint(0, 59), random.randint(0, 59))


print("=" * 78)
print("KSP CRIME INTELLIGENCE PLATFORM — SYNTHETIC DATA GENERATOR")
print("=" * 78)

# ============================================================================
# 01 — ORG & GEOGRAPHY HIERARCHY
# ============================================================================
print("\n[1/5] Generating Org & Geography Hierarchy tables...")

# ---- State ----
STATE_NAME = "Karnataka"
states = [{
    "StateID": 1,
    "StateName": STATE_NAME,
    "NationalityID": 1,
    "Active": 1,
}]
write_csv("org", "State", ["StateID", "StateName", "NationalityID", "Active"], states)

# ---- District ----
KARNATAKA_DISTRICTS = [
    "Bagalkot", "Ballari", "Belagavi", "Bengaluru Rural", "Bengaluru Urban", "Bidar",
    "Chamarajanagar", "Chikballapur", "Chikkamagaluru", "Chitradurga", "Dakshina Kannada",
    "Davanagere", "Dharwad", "Gadag", "Hassan", "Haveri", "Kalaburagi", "Kodagu", "Kolar",
    "Koppal", "Mandya", "Mysuru", "Raichur", "Ramanagara", "Shivamogga", "Tumakuru",
    "Udupi", "Uttara Kannada", "Vijayapura", "Yadgir", "Chikkaballapur",
][:N_DISTRICTS]

districts = []
for i, name in enumerate(KARNATAKA_DISTRICTS, start=1):
    districts.append({
        "DistrictID": i,
        "DistrictName": name,
        "StateID": 1,
        "Active": 1,
    })
write_csv("org", "District", ["DistrictID", "DistrictName", "StateID", "Active"], districts)

# ---- UnitType ----
unit_types = [
    {"UnitTypeID": 1, "UnitTypeName": "Police Station", "CityDistState": "City", "Hierarchy": 4, "Active": 1},
    {"UnitTypeID": 2, "UnitTypeName": "Circle Office", "CityDistState": "City", "Hierarchy": 3, "Active": 1},
    {"UnitTypeID": 3, "UnitTypeName": "Sub-Division", "CityDistState": "District", "Hierarchy": 2, "Active": 1},
    {"UnitTypeID": 4, "UnitTypeName": "District SP Office", "CityDistState": "District", "Hierarchy": 1, "Active": 1},
    {"UnitTypeID": 5, "UnitTypeName": "State CID/SCRB HQ", "CityDistState": "State", "Hierarchy": 0, "Active": 1},
]
write_csv("org", "UnitType",
          ["UnitTypeID", "UnitTypeName", "CityDistState", "Hierarchy", "Active"], unit_types)

# ---- Unit (police stations, self-referencing hierarchy) ----
PS_NAME_SUFFIXES = [
    "Town", "Rural", "Traffic", "Cantonment", "City Market", "Industrial Area",
    "East", "West", "North", "South", "Extension", "Railway",
]
units = []
unit_id = 1
state_hq_id = unit_id
units.append({
    "UnitID": unit_id, "UnitName": "Karnataka State Police HQ / SCRB", "TypeID": 5,
    "ParentUnit": "", "NationalityID": 1, "StateID": 1, "DistrictID": districts[0]["DistrictID"], "Active": 1,
})
unit_id += 1

district_sp_office_id = {}
for d in districts:
    sp_id = unit_id
    units.append({
        "UnitID": sp_id, "UnitName": f"{d['DistrictName']} District SP Office", "TypeID": 4,
        "ParentUnit": state_hq_id, "NationalityID": 1, "StateID": 1, "DistrictID": d["DistrictID"], "Active": 1,
    })
    district_sp_office_id[d["DistrictID"]] = sp_id
    unit_id += 1

    for n in range(1, N_UNITS_PER_DISTRICT + 1):
        suffix = PS_NAME_SUFFIXES[(n - 1) % len(PS_NAME_SUFFIXES)]
        units.append({
            "UnitID": unit_id,
            "UnitName": f"{d['DistrictName']} {suffix} Police Station",
            "TypeID": 1,
            "ParentUnit": sp_id,
            "NationalityID": 1,
            "StateID": 1,
            "DistrictID": d["DistrictID"],
            "Active": 1,
        })
        unit_id += 1

write_csv("org", "Unit",
          ["UnitID", "UnitName", "TypeID", "ParentUnit", "NationalityID", "StateID", "DistrictID", "Active"],
          units)

police_stations = [u for u in units if u["TypeID"] == 1]

# ---- Rank ----
ranks = [
    {"RankID": 1, "RankName": "Director General of Police", "Hierarchy": 1, "Active": 1},
    {"RankID": 2, "RankName": "Inspector General of Police", "Hierarchy": 2, "Active": 1},
    {"RankID": 3, "RankName": "Deputy Inspector General", "Hierarchy": 3, "Active": 1},
    {"RankID": 4, "RankName": "Superintendent of Police", "Hierarchy": 4, "Active": 1},
    {"RankID": 5, "RankName": "Deputy Superintendent of Police", "Hierarchy": 5, "Active": 1},
    {"RankID": 6, "RankName": "Inspector", "Hierarchy": 6, "Active": 1},
    {"RankID": 7, "RankName": "Sub-Inspector", "Hierarchy": 7, "Active": 1},
    {"RankID": 8, "RankName": "Assistant Sub-Inspector", "Hierarchy": 8, "Active": 1},
    {"RankID": 9, "RankName": "Head Constable", "Hierarchy": 9, "Active": 1},
    {"RankID": 10, "RankName": "Police Constable", "Hierarchy": 10, "Active": 1},
]
write_csv("org", "Rank", ["RankID", "RankName", "Hierarchy", "Active"], ranks)

# ---- Designation ----
designations = [
    {"DesignationID": 1, "DesignationName": "Station House Officer", "SortOrder": 1, "Active": 1},
    {"DesignationID": 2, "DesignationName": "Investigating Officer", "SortOrder": 2, "Active": 1},
    {"DesignationID": 3, "DesignationName": "Beat Constable", "SortOrder": 3, "Active": 1},
    {"DesignationID": 4, "DesignationName": "Crime Branch Officer", "SortOrder": 4, "Active": 1},
    {"DesignationID": 5, "DesignationName": "Traffic Officer", "SortOrder": 5, "Active": 1},
    {"DesignationID": 6, "DesignationName": "Station Clerk", "SortOrder": 6, "Active": 1},
    {"DesignationID": 7, "DesignationName": "SCRB Analyst", "SortOrder": 7, "Active": 1},
    {"DesignationID": 8, "DesignationName": "Circle Inspector", "SortOrder": 8, "Active": 1},
]
write_csv("org", "Designation", ["DesignationID", "DesignationName", "SortOrder", "Active"], designations)

# ---- Employee ----
GENDER_LOOKUP = ["M", "F", "T"]
BLOOD_GROUPS = [1, 2, 3, 4, 5, 6, 7, 8]  # 1=A+,2=A-,3=B+,4=B-,5=AB+,6=AB-,7=O+,8=O-

employees = []
used_kgids = set()
for emp_id in range(1, N_EMPLOYEES + 1):
    station = random.choice(police_stations)
    district_id = station["DistrictID"]

    # rank distribution: mostly constables/HCs, few senior officers
    rank_id = random.choices(
        population=[10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
        weights=[35, 20, 12, 12, 10, 5, 3, 2, 0.7, 0.3],
        k=1,
    )[0]
    if rank_id in (1, 2, 3):
        designation_id = random.choice([4, 8])
    elif rank_id in (4, 5):
        designation_id = random.choice([1, 4, 8])
    elif rank_id == 6:
        designation_id = random.choice([1, 2, 4])
    elif rank_id == 7:
        designation_id = random.choice([1, 2])
    else:
        designation_id = random.choice([2, 3, 5, 6])

    while True:
        kgid = f"KGID{district_id:02d}{emp_id:06d}"
        if kgid not in used_kgids:
            used_kgids.add(kgid)
            break

    dob = fake.date_of_birth(minimum_age=22, maximum_age=58)
    appt_date = dob + timedelta(days=random.randint(22 * 365, 30 * 365))
    if appt_date > date(2026, 6, 30):
        appt_date = date(2026, 6, 30) - timedelta(days=random.randint(30, 3000))

    employees.append({
        "EmployeeID": emp_id,
        "DistrictID": district_id,
        "UnitID": station["UnitID"],
        "RankID": rank_id,
        "DesignationID": designation_id,
        "KGID": kgid,
        "FirstName": fake.first_name(),
        "EmployeeDOB": dt_date(dob),
        "GenderID": GENDER_LOOKUP.index(random.choices(GENDER_LOOKUP, weights=[88, 11, 1])[0]) + 1,
        "BloodGroupID": random.choice(BLOOD_GROUPS),
        "PhysicallyChallenged": 1 if random.random() < 0.01 else 0,
        "AppointmentDate": dt_date(appt_date),
    })
write_csv("org", "Employee",
          ["EmployeeID", "DistrictID", "UnitID", "RankID", "DesignationID", "KGID", "FirstName",
           "EmployeeDOB", "GenderID", "BloodGroupID", "PhysicallyChallenged", "AppointmentDate"],
          employees)

investigating_officers = [e for e in employees if e["DesignationID"] in (1, 2, 4)]
if not investigating_officers:
    investigating_officers = employees

# ---- Court ----
courts = []
court_id = 1
COURT_TYPES = ["District & Sessions Court", "Civil Judge Court", "JMFC Court", "Fast Track Court", "Family Court"]
for d in districts:
    for n in range(N_COURTS_PER_DISTRICT):
        courts.append({
            "CourtID": court_id,
            "CourtName": f"{COURT_TYPES[n % len(COURT_TYPES)]}, {d['DistrictName']}",
            "DistrictID": d["DistrictID"],
            "StateID": 1,
            "Active": 1,
        })
        court_id += 1
write_csv("org", "Court", ["CourtID", "CourtName", "DistrictID", "StateID", "Active"], courts)

print(f"  Summary: {len(states)} states, {len(districts)} districts, {len(units)} units "
      f"({len(police_stations)} stations), {len(employees)} employees, {len(courts)} courts")

# ============================================================================
# 02 — LEGAL REFERENCE TABLES
# ============================================================================
print("\n[2/5] Generating Legal Reference tables...")

# ---- Act ----
acts_data = [
    ("IPC", "Indian Penal Code, 1860", "IPC"),
    ("BNS", "Bharatiya Nyaya Sanhita, 2023", "BNS"),
    ("NDPS", "Narcotic Drugs and Psychotropic Substances Act, 1985", "NDPS Act"),
    ("MV", "Motor Vehicles Act, 1988", "MV Act"),
    ("POCSO", "Protection of Children from Sexual Offences Act, 2012", "POCSO"),
    ("ARMS", "Arms Act, 1959", "Arms Act"),
    ("SC_ST", "Scheduled Castes and Scheduled Tribes (Prevention of Atrocities) Act, 1989", "SC/ST Act"),
    ("EXCISE", "Karnataka Excise Act, 1965", "Excise Act"),
    ("GAMBLING", "Karnataka Police (Prevention of Gambling) Act, 1963", "Gambling Act"),
    ("IT_ACT", "Information Technology Act, 2000", "IT Act"),
    ("PREVENTION_CORRUPTION", "Prevention of Corruption Act, 1988", "PC Act"),
    ("DV", "Protection of Women from Domestic Violence Act, 2005", "DV Act"),
]
acts = [{"ActCode": code, "ActDescription": desc, "ShortName": short, "Active": 1}
        for code, desc, short in acts_data]
write_csv("legal", "Act", ["ActCode", "ActDescription", "ShortName", "Active"], acts)

# ---- Section (subset of realistic sections per act) ----
sections_data = {
    "IPC": [
        ("302", "Punishment for murder"),
        ("304", "Punishment for culpable homicide not amounting to murder"),
        ("307", "Attempt to murder"),
        ("324", "Voluntarily causing hurt by dangerous weapons or means"),
        ("325", "Punishment for voluntarily causing grievous hurt"),
        ("354", "Assault or criminal force to woman with intent to outrage her modesty"),
        ("363", "Punishment for kidnapping"),
        ("376", "Punishment for rape"),
        ("379", "Punishment for theft"),
        ("380", "Theft in dwelling house"),
        ("392", "Punishment for robbery"),
        ("395", "Punishment for dacoity"),
        ("406", "Punishment for criminal breach of trust"),
        ("420", "Cheating and dishonestly inducing delivery of property"),
        ("498A", "Husband or relative of husband subjecting woman to cruelty"),
        ("506", "Punishment for criminal intimidation"),
    ],
    "BNS": [
        ("103", "Punishment for murder"),
        ("109", "Attempt to murder"),
        ("115", "Voluntarily causing hurt"),
        ("303", "Theft"),
        ("309", "Robbery"),
        ("318", "Cheating"),
        ("351", "Criminal intimidation"),
    ],
    "NDPS": [
        ("8", "Prohibition of certain operations"),
        ("20", "Punishment for contravention in relation to cannabis"),
        ("21", "Punishment for contravention in relation to manufactured drugs"),
        ("22", "Punishment for contravention in relation to psychotropic substances"),
        ("27A", "Punishment for financing illicit traffic"),
    ],
    "MV": [
        ("177", "General provision for punishment of offences"),
        ("184", "Driving dangerously"),
        ("185", "Driving by drunken person"),
        ("196", "Driving without insurance"),
    ],
    "POCSO": [
        ("4", "Punishment for penetrative sexual assault"),
        ("6", "Punishment for aggravated penetrative sexual assault"),
        ("8", "Punishment for sexual assault"),
        ("12", "Punishment for sexual harassment"),
    ],
    "ARMS": [
        ("25", "Punishment for certain offences relating to arms"),
        ("27", "Punishment for using arms"),
    ],
    "SC_ST": [
        ("3", "Punishments for offences of atrocities"),
    ],
    "EXCISE": [
        ("32", "Illegal import, export, transport, manufacture, possession or sale"),
    ],
    "GAMBLING": [
        ("4", "Punishment for keeping a common gaming house"),
    ],
    "IT_ACT": [
        ("66", "Computer related offences"),
        ("66C", "Identity theft"),
        ("67", "Publishing obscene material in electronic form"),
    ],
    "PREVENTION_CORRUPTION": [
        ("7", "Offence relating to public servant being bribed"),
        ("13", "Criminal misconduct by a public servant"),
    ],
    "DV": [
        ("12", "Application to Magistrate"),
    ],
}
sections = []
for act_code, sec_list in sections_data.items():
    for code, desc in sec_list:
        sections.append({
            "ActCode": act_code,
            "SectionCode": code,
            "SectionDescription": desc,
            "Active": 1,
        })
write_csv("legal", "Section", ["ActCode", "SectionCode", "SectionDescription", "Active"], sections)

# ---- CrimeHead ----
crime_heads_data = [
    "Crimes Against Body", "Crimes Against Property", "Crimes Against Women",
    "Crimes Against Children", "Economic Offences", "Narcotics & Excise Offences",
    "Cyber Crimes", "Traffic & Motor Vehicle Offences", "Public Order Offences",
    "Corruption & Public Servant Offences",
]
crime_heads = [{"CrimeHeadID": i + 1, "CrimeGroupName": name, "Active": 1}
               for i, name in enumerate(crime_heads_data)]
write_csv("legal", "CrimeHead", ["CrimeHeadID", "CrimeGroupName", "Active"], crime_heads)

# ---- CrimeSubHead ----
crime_subheads_data = {
    1: ["Murder", "Attempt to Murder", "Culpable Homicide", "Grievous Hurt", "Simple Hurt"],
    2: ["Theft", "Burglary", "Robbery", "Dacoity", "Criminal Breach of Trust", "Cheating"],
    3: ["Rape", "Outraging Modesty", "Dowry Harassment", "Domestic Violence", "Kidnapping of Woman"],
    4: ["POCSO Penetrative Assault", "POCSO Sexual Assault", "Child Kidnapping", "Child Labour"],
    5: ["Bank Fraud", "Cheating - Property", "Forgery", "Counterfeiting"],
    6: ["Cannabis Possession", "Drug Trafficking", "Illicit Liquor", "Psychotropic Substance Sale"],
    7: ["Identity Theft", "Online Fraud", "Obscene Content", "Hacking"],
    8: ["Drunken Driving", "Hit and Run", "Driving Without License", "Rash Driving"],
    9: ["Rioting", "Unlawful Assembly", "Gambling", "Public Nuisance"],
    10: ["Bribery", "Criminal Misconduct", "Abuse of Official Position"],
}
crime_subheads = []
sh_id = 1
for head_id, names in crime_subheads_data.items():
    for seq, name in enumerate(names, start=1):
        crime_subheads.append({
            "CrimeSubHeadID": sh_id,
            "CrimeHeadID": head_id,
            "CrimeHeadName": name,
            "SeqID": seq,
        })
        sh_id += 1
write_csv("legal", "CrimeSubHead", ["CrimeSubHeadID", "CrimeHeadID", "CrimeHeadName", "SeqID"], crime_subheads)

# ---- CrimeHeadActSection (mapping crime heads to plausible act-sections) ----
crime_head_act_section_map = {
    1: [("IPC", "302"), ("IPC", "304"), ("IPC", "307"), ("IPC", "324"), ("IPC", "325"), ("BNS", "103"), ("BNS", "109")],
    2: [("IPC", "379"), ("IPC", "380"), ("IPC", "392"), ("IPC", "395"), ("IPC", "406"), ("IPC", "420"), ("BNS", "303"), ("BNS", "309"), ("BNS", "318")],
    3: [("IPC", "354"), ("IPC", "376"), ("IPC", "498A"), ("IPC", "363"), ("DV", "12")],
    4: [("POCSO", "4"), ("POCSO", "6"), ("POCSO", "8"), ("POCSO", "12"), ("IPC", "363")],
    5: [("IPC", "420"), ("IPC", "406"), ("PREVENTION_CORRUPTION", "7")],
    6: [("NDPS", "8"), ("NDPS", "20"), ("NDPS", "21"), ("NDPS", "22"), ("NDPS", "27A"), ("EXCISE", "32")],
    7: [("IT_ACT", "66"), ("IT_ACT", "66C"), ("IT_ACT", "67")],
    8: [("MV", "177"), ("MV", "184"), ("MV", "185"), ("MV", "196")],
    9: [("IPC", "506"), ("GAMBLING", "4"), ("ARMS", "25"), ("ARMS", "27")],
    10: [("PREVENTION_CORRUPTION", "7"), ("PREVENTION_CORRUPTION", "13")],
}
crime_head_act_sections = []
for head_id, pairs in crime_head_act_section_map.items():
    for act_code, section_code in pairs:
        crime_head_act_sections.append({
            "CrimeHeadID": head_id,
            "ActCode": act_code,
            "SectionCode": section_code,
        })
write_csv("legal", "CrimeHeadActSection", ["CrimeHeadID", "ActCode", "SectionCode"], crime_head_act_sections)

print(f"  Summary: {len(acts)} acts, {len(sections)} sections, {len(crime_heads)} crime heads, "
      f"{len(crime_subheads)} crime sub-heads, {len(crime_head_act_sections)} crime-head-act-section mappings")

# ============================================================================
# 03 — LOOKUP / MASTER TABLES
# ============================================================================
print("\n[3/5] Generating Lookup / Master tables...")

# ---- CaseCategory ----
# Category code digit used in CrimeNo: 1=FIR, 3=UDR, 8=ZeroFIR, 4=PAR
case_categories = [
    {"CaseCategoryID": 1, "LookupValue": "FIR"},
    {"CaseCategoryID": 2, "LookupValue": "UDR"},
    {"CaseCategoryID": 3, "LookupValue": "Zero FIR"},
    {"CaseCategoryID": 4, "LookupValue": "PAR"},
]
CASE_CATEGORY_CRIMENO_DIGIT = {1: "1", 2: "3", 3: "8", 4: "4"}
write_csv("lookup", "CaseCategory", ["CaseCategoryID", "LookupValue"], case_categories)

# ---- GravityOffence ----
gravity_offences = [
    {"GravityOffenceID": 1, "LookupValue": "Heinous"},
    {"GravityOffenceID": 2, "LookupValue": "Non-Heinous"},
]
write_csv("lookup", "GravityOffence", ["GravityOffenceID", "LookupValue"], gravity_offences)

# ---- CaseStatusMaster ----
case_statuses = [
    {"CaseStatusID": 1, "CaseStatusName": "Under Investigation"},
    {"CaseStatusID": 2, "CaseStatusName": "Charge Sheeted"},
    {"CaseStatusID": 3, "CaseStatusName": "Closed"},
    {"CaseStatusID": 4, "CaseStatusName": "Undetected"},
    {"CaseStatusID": 5, "CaseStatusName": "False Case"},
    {"CaseStatusID": 6, "CaseStatusName": "Pending Court Trial"},
]
write_csv("lookup", "CaseStatusMaster", ["CaseStatusID", "CaseStatusName"], case_statuses)

# ---- CasteMaster ----
caste_names = [
    "General", "OBC", "SC", "ST", "Category-1", "Category-2A", "Category-2B",
    "Category-3A", "Category-3B", "Minority",
]
caste_master = [{"caste_master_id": i + 1, "caste_master_name": name} for i, name in enumerate(caste_names)]
write_csv("lookup", "CasteMaster", ["caste_master_id", "caste_master_name"], caste_master)

# ---- ReligionMaster ----
religion_names = ["Hindu", "Muslim", "Christian", "Sikh", "Buddhist", "Jain", "Other"]
religion_master = [{"ReligionID": i + 1, "ReligionName": name} for i, name in enumerate(religion_names)]
write_csv("lookup", "ReligionMaster", ["ReligionID", "ReligionName"], religion_master)

# ---- OccupationMaster ----
occupation_names = [
    "Farmer", "Government Employee", "Private Employee", "Business / Self-Employed",
    "Daily Wage Labourer", "Student", "Homemaker", "Unemployed", "Driver",
    "Shopkeeper", "Retired", "Other",
]
occupation_master = [{"OccupationID": i + 1, "OccupationName": name} for i, name in enumerate(occupation_names)]
write_csv("lookup", "OccupationMaster", ["OccupationID", "OccupationName"], occupation_master)

print(f"  Summary: {len(case_categories)} case categories, {len(gravity_offences)} gravity levels, "
      f"{len(case_statuses)} case statuses, {len(caste_master)} castes, {len(religion_master)} religions, "
      f"{len(occupation_master)} occupations")

# ============================================================================
# 04 — CORE TRANSACTIONAL TABLES
# ============================================================================
print("\n[4/5] Generating Core Transactional tables (CaseMaster and children)...")

INDIAN_FIRST_NAMES_M = None  # faker handles this via fake.first_name_male() etc.

# Karnataka approximate bounding box for lat/long realism
KARNATAKA_LAT_RANGE = (11.6, 18.4)
KARNATAKA_LON_RANGE = (74.1, 78.6)

# running serial counters: keyed by (PoliceStationID, CaseCategoryID, Year)
serial_counters = {}

def next_running_serial(station_id, category_id, year):
    key = (station_id, category_id, year)
    serial_counters[key] = serial_counters.get(key, 0) + 1
    return serial_counters[key]


def build_crime_no(category_id, district_id, station_id, year, serial):
    cat_digit = CASE_CATEGORY_CRIMENO_DIGIT[category_id]
    return f"{cat_digit}{district_id:04d}{station_id:04d}{year:04d}{serial:05d}"


def build_case_no(year, serial):
    return f"{year:04d}{serial:05d}"


BRIEF_FACTS_TEMPLATES = [
    "Complainant reported that on the night of the incident, unidentified person(s) committed the offence "
    "near {place}. Preliminary investigation initiated; statements of witnesses being recorded.",
    "On receiving information, the jurisdictional police station registered the case and rushed to the spot "
    "at {place}. Scene of offence secured and panchanama drawn up.",
    "A complaint was lodged stating that the accused committed the offence at {place}. Case registered under "
    "relevant sections and investigation taken up by the Investigating Officer.",
    "Information was received at the police station regarding the incident that occurred near {place}. "
    "FIR registered and further investigation is in progress.",
]

cases = []
case_id = 1
for _ in range(N_CASES):
    station = random.choice(police_stations)
    district_id = station["DistrictID"]
    station_id = station["UnitID"]

    category_id = random.choices([1, 2, 3, 4], weights=[78, 6, 8, 8])[0]
    year = random.randint(YEAR_RANGE[0], YEAR_RANGE[1])

    serial = next_running_serial(station_id, category_id, year)
    crime_no = build_crime_no(category_id, district_id, station_id, year, serial)
    case_no = build_case_no(year, serial)

    incident_from = rand_datetime_between(year, year)
    incident_to = incident_from + timedelta(hours=random.randint(0, 48))
    info_received = incident_to + timedelta(hours=random.randint(0, 72))
    crime_registered_date = (info_received + timedelta(hours=random.randint(0, 24))).date()
    if crime_registered_date.year > 2026 or (crime_registered_date.year == 2026 and crime_registered_date.month > 6):
        crime_registered_date = date(2026, 6, random.randint(1, 29))

    police_person = random.choice(investigating_officers)
    gravity_id = random.choices([1, 2], weights=[22, 78])[0]
    crime_head = random.choice(crime_heads)
    matching_subheads = [sh for sh in crime_subheads if sh["CrimeHeadID"] == crime_head["CrimeHeadID"]]
    crime_subhead = random.choice(matching_subheads)

    case_status_id = random.choices([1, 2, 3, 4, 5, 6], weights=[35, 25, 12, 10, 8, 10])[0]
    court = random.choice([c for c in courts if c["DistrictID"] == district_id])

    lat = round(random.uniform(*KARNATAKA_LAT_RANGE), 6)
    lon = round(random.uniform(*KARNATAKA_LON_RANGE), 6)

    place = f"{fake.street_name()}, {[d for d in districts if d['DistrictID'] == district_id][0]['DistrictName']}"
    brief = random.choice(BRIEF_FACTS_TEMPLATES).format(place=place)

    cases.append({
        "CaseMasterID": case_id,
        "CrimeNo": crime_no,
        "CaseNo": case_no,
        "CrimeRegisteredDate": dt_date(crime_registered_date),
        "PolicePersonID": police_person["EmployeeID"],
        "PoliceStationID": station_id,
        "CaseCategoryID": category_id,
        "GravityOffenceID": gravity_id,
        "CrimeMajorHeadID": crime_head["CrimeHeadID"],
        "CrimeMinorHeadID": crime_subhead["CrimeSubHeadID"],
        "CaseStatusID": case_status_id,
        "CourtID": court["CourtID"],
        "IncidentFromDate": dt(incident_from),
        "IncidentToDate": dt(incident_to),
        "InfoReceivedPSDate": dt(info_received),
        "latitude": lat,
        "longitude": lon,
        "BriefFacts": brief,
        # convenience fields kept in-memory only (not exported, used to drive child gen)
        "_district_id": district_id,
        "_year": year,
    })
    case_id += 1

CASE_FIELDS = ["CaseMasterID", "CrimeNo", "CaseNo", "CrimeRegisteredDate", "PolicePersonID",
               "PoliceStationID", "CaseCategoryID", "GravityOffenceID", "CrimeMajorHeadID",
               "CrimeMinorHeadID", "CaseStatusID", "CourtID", "IncidentFromDate", "IncidentToDate",
               "InfoReceivedPSDate", "latitude", "longitude", "BriefFacts"]
write_csv("core", "CaseMaster", CASE_FIELDS, [{k: c[k] for k in CASE_FIELDS} for c in cases])

# ---- ComplainantDetails ----
complainants = []
comp_id = 1
for c in cases:
    n = random.randint(1, MAX_COMPLAINANTS_PER_CASE)
    for _ in range(n):
        gender = random.choices(GENDER_LOOKUP, weights=[55, 44, 1])[0]
        complainants.append({
            "ComplainantID": comp_id,
            "CaseMasterID": c["CaseMasterID"],
            "ComplainantName": fake.name_male() if gender == "M" else (fake.name_female() if gender == "F" else fake.name()),
            "AgeYear": random.randint(18, 75),
            "OccupationID": random.choice(occupation_master)["OccupationID"],
            "ReligionID": random.choices([r["ReligionID"] for r in religion_master],
                                          weights=[70, 14, 5, 3, 3, 2, 3])[0],
            "CasteID": random.choice(caste_master)["caste_master_id"],
            "GenderID": GENDER_LOOKUP.index(gender) + 1,
        })
        comp_id += 1
write_csv("core", "ComplainantDetails",
          ["ComplainantID", "CaseMasterID", "ComplainantName", "AgeYear", "OccupationID",
           "ReligionID", "CasteID", "GenderID"], complainants)

# ---- Victim ----
victims = []
victim_id = 1
for c in cases:
    n = random.randint(1, MAX_VICTIMS_PER_CASE)
    for _ in range(n):
        gender = random.choices(GENDER_LOOKUP, weights=[52, 47, 1])[0]
        victims.append({
            "VictimMasterID": victim_id,
            "CaseMasterID": c["CaseMasterID"],
            "VictimName": fake.name_male() if gender == "M" else (fake.name_female() if gender == "F" else fake.name()),
            "AgeYear": random.randint(1, 85),
            "GenderID": gender,
            "VictimPolice": 1 if random.random() < 0.02 else 0,
        })
        victim_id += 1
write_csv("core", "Victim",
          ["VictimMasterID", "CaseMasterID", "VictimName", "AgeYear", "GenderID", "VictimPolice"], victims)

# ---- Accused ----
accused_list = []
accused_id = 1
case_to_accused = {}
for c in cases:
    n = random.randint(1, MAX_ACCUSED_PER_CASE)
    case_accused = []
    for idx in range(1, n + 1):
        gender = random.choices(["M", "F", "T"], weights=[91, 8, 1])[0]
        rec = {
            "AccusedMasterID": accused_id,
            "CaseMasterID": c["CaseMasterID"],
            "AccusedName": fake.name_male() if gender == "M" else (fake.name_female() if gender == "F" else fake.name()),
            "AgeYear": random.randint(16, 65),
            "GenderID": gender,
            "PersonID": f"A{idx}",
        }
        accused_list.append(rec)
        case_accused.append(rec)
        accused_id += 1
    case_to_accused[c["CaseMasterID"]] = case_accused
write_csv("core", "Accused",
          ["AccusedMasterID", "CaseMasterID", "AccusedName", "AgeYear", "GenderID", "PersonID"], accused_list)

# ---- ActSectionAssociation ----
act_section_assoc = []
for c in cases:
    crime_head_id = c["CrimeMajorHeadID"]
    candidates = [pair for pair in crime_head_act_sections if pair["CrimeHeadID"] == crime_head_id]
    if not candidates:
        candidates = crime_head_act_sections
    n = random.randint(1, min(MAX_SECTIONS_PER_CASE, len(candidates)))
    chosen = random.sample(candidates, n)
    for order, pair in enumerate(chosen, start=1):
        act_section_assoc.append({
            "CaseMasterID": c["CaseMasterID"],
            "ActID": pair["ActCode"],
            "SectionID": pair["SectionCode"],
            "ActOrderID": order,
            "SectionOrderID": order,
        })
write_csv("core", "ActSectionAssociation",
          ["CaseMasterID", "ActID", "SectionID", "ActOrderID", "SectionOrderID"], act_section_assoc)

print(f"  Summary: {len(cases)} cases, {len(complainants)} complainants, {len(victims)} victims, "
      f"{len(accused_list)} accused, {len(act_section_assoc)} act-section associations")

# ---- ArrestSurrender + inv_arrestsurrenderaccused junction ----
arrest_surrenders = []
arrest_junction = []
arrest_id = 1
junction_id = 1
ARREST_TYPE_LOOKUP = {1: "Arrest", 2: "Voluntary Surrender"}

for c in cases:
    case_accused = case_to_accused[c["CaseMasterID"]]
    district_id = c["_district_id"]
    for acc in case_accused:
        if random.random() > ARREST_RATE:
            continue
        arrest_type_id = random.choices([1, 2], weights=[80, 20])[0]
        arrest_date = (datetime.strptime(c["CrimeRegisteredDate"], "%Y-%m-%d").date()
                        + timedelta(days=random.randint(0, 180)))
        if arrest_date > date(2026, 6, 30):
            arrest_date = date(2026, 6, 30)

        # arrest usually happens in-state, mostly same district, occasionally elsewhere (escape/inter-district)
        if random.random() < 0.85:
            arrest_district_id = district_id
        else:
            arrest_district_id = random.choice(districts)["DistrictID"]

        arrest_station = random.choice([u for u in police_stations if u["DistrictID"] == arrest_district_id])
        io = random.choice(investigating_officers)
        court = random.choice([ct for ct in courts if ct["DistrictID"] == district_id])

        rec = {
            "ArrestSurrenderID": arrest_id,
            "CaseMasterID": c["CaseMasterID"],
            "ArrestSurrenderTypeID": arrest_type_id,
            "ArrestSurrenderDate": dt_date(arrest_date),
            "ArrestSurrenderStateId": 1,
            "ArrestSurrenderDistrictId": arrest_district_id,
            "PoliceStationID": arrest_station["UnitID"],
            "IOID": io["EmployeeID"],
            "CourtID": court["CourtID"],
            "AccusedMasterID": acc["AccusedMasterID"],
            "IsAccused": 1,
            "IsComplainantAccused": 1 if random.random() < 0.03 else 0,
        }
        arrest_surrenders.append(rec)

        arrest_junction.append({
            "JunctionID": junction_id,
            "ArrestSurrenderID": arrest_id,
            "AccusedMasterID": acc["AccusedMasterID"],
        })
        junction_id += 1
        arrest_id += 1

write_csv("core", "ArrestSurrender",
          ["ArrestSurrenderID", "CaseMasterID", "ArrestSurrenderTypeID", "ArrestSurrenderDate",
           "ArrestSurrenderStateId", "ArrestSurrenderDistrictId", "PoliceStationID", "IOID",
           "CourtID", "AccusedMasterID", "IsAccused", "IsComplainantAccused"], arrest_surrenders)

write_csv("core", "inv_arrestsurrenderaccused",
          ["JunctionID", "ArrestSurrenderID", "AccusedMasterID"], arrest_junction)

# ---- ChargesheetDetails ----
chargesheets = []
cs_id = 1
CSTYPE_LOOKUP = {"A": "Chargesheet", "B": "False Case", "C": "Undetected"}
for c in cases:
    if random.random() > CHARGESHEET_RATE:
        continue
    crime_reg_date = datetime.strptime(c["CrimeRegisteredDate"], "%Y-%m-%d").date()
    cs_date = crime_reg_date + timedelta(days=random.randint(15, 270))
    if cs_date > date(2026, 6, 30):
        cs_date = date(2026, 6, 30)
    cstype = random.choices(["A", "B", "C"], weights=[72, 10, 18])[0]
    chargesheets.append({
        "CSID": cs_id,
        "CaseMasterID": c["CaseMasterID"],
        "csdate": dt(datetime(cs_date.year, cs_date.month, cs_date.day,
                               random.randint(9, 17), random.randint(0, 59))),
        "cstype": cstype,
        "PolicePersonID": c["PolicePersonID"],
    })
    cs_id += 1
write_csv("core", "ChargesheetDetails",
          ["CSID", "CaseMasterID", "csdate", "cstype", "PolicePersonID"], chargesheets)

print(f"  Summary: {len(arrest_surrenders)} arrest/surrender events, "
      f"{len(arrest_junction)} junction rows, {len(chargesheets)} chargesheets")

# ============================================================================
# 05 — EXTENSION TABLES
# ============================================================================
print("\n[5/5] Generating Extension tables (Inv_OccuranceTime, BondRecord)...")

# ---- Inv_OccuranceTime ----
# Per the architecture doc's "open item": this 1:1 table is now built explicitly
# with the fields already present on CaseMaster (IncidentFromDate, IncidentToDate,
# InfoReceivedPSDate, latitude, longitude), mirrored 1:1 by CaseMasterID so that
# the relationship matrix's documented One-to-One CaseMaster -> Inv_OccuranceTime
# link is satisfiable in DataStore without duplicating CaseMaster itself.
inv_occurance_time = []
for c in cases:
    inv_occurance_time.append({
        "InvOccuranceTimeID": c["CaseMasterID"],
        "CaseMasterID": c["CaseMasterID"],
        "IncidentFromDate": c["IncidentFromDate"],
        "IncidentToDate": c["IncidentToDate"],
        "InfoReceivedPSDate": c["InfoReceivedPSDate"],
        "latitude": c["latitude"],
        "longitude": c["longitude"],
    })
write_csv("ext", "Inv_OccuranceTime",
          ["InvOccuranceTimeID", "CaseMasterID", "IncidentFromDate", "IncidentToDate",
           "InfoReceivedPSDate", "latitude", "longitude"], inv_occurance_time)

# ---- BondRecord (Good Conduct Bond / HS Record Tracker — platform innovation) ----
bond_records = []
bond_id = 1
for a in arrest_surrenders:
    if a["ArrestSurrenderTypeID"] != 1:  # bonds only follow arrests, not surrenders
        continue
    if random.random() > BOND_RATE:
        continue
    sign_date = datetime.strptime(a["ArrestSurrenderDate"], "%Y-%m-%d").date() + timedelta(days=random.randint(1, 30))
    if sign_date > date(2026, 6, 30):
        sign_date = date(2026, 6, 30)
    validity_months = random.choice([6, 12, 24, 36])
    expiry_date = sign_date + timedelta(days=validity_months * 30)
    if expiry_date < date(2026, 6, 30):
        status = random.choices(["Expired", "Renewed", "Violated"], weights=[70, 20, 10])[0]
    else:
        status = random.choices(["Active", "Violated"], weights=[92, 8])[0]
    bond_records.append({
        "BondRecordID": bond_id,
        "CaseMasterID": a["CaseMasterID"],
        "AccusedMasterID": a["AccusedMasterID"],
        "signDate": dt_date(sign_date),
        "expiryDate": dt_date(expiry_date),
        "status": status,
    })
    bond_id += 1
write_csv("ext", "BondRecord",
          ["BondRecordID", "CaseMasterID", "AccusedMasterID", "signDate", "expiryDate", "status"],
          bond_records)

print(f"  Summary: {len(inv_occurance_time)} occurrence-time records, {len(bond_records)} bond records")

print("\n" + "=" * 78)
print("DATA GENERATION COMPLETE")
print("=" * 78)
print(f"Output directory: {OUTPUT_ROOT}")
