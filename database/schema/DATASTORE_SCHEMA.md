# Zoho Catalyst DataStore — Table Schema Reference

This document specifies the exact column **name** and **Catalyst column type** to use
when creating each DataStore table, so the CSVs in `database/datastore_csv/` import
cleanly via **Catalyst Console → DataStore → Table → Import Data → CSV**.

> Catalyst column types available: `String` (≤255), `Text` (long), `Int`, `BigInt`,
> `Double`, `Decimal`, `DateTime`, `Boolean`, `Encrypted`.
> Catalyst auto-generates a `ROWID` per row — **do not** include a ROWID column in
> the CSV or as a manual table column. The PK columns below are *business keys*,
> kept as a normal indexed column (set "Unique" constraint in table settings where noted).

Import order matters because later tables reference IDs from earlier ones (no FK
enforcement in DataStore, but importing in this order guarantees IDs already exist
if you later add app-level validation). Folder numbers (`01_`, `02_`, ...) reflect this order.

---

## 01_org_geography

### State
| Column | Type | Notes |
|---|---|---|
| StateID | Int | Unique |
| StateName | String | |
| NationalityID | Int | |
| Active | Boolean | |

### District
| Column | Type | Notes |
|---|---|---|
| DistrictID | Int | Unique |
| DistrictName | String | |
| StateID | Int | FK → State.StateID |
| Active | Boolean | |

### UnitType
| Column | Type | Notes |
|---|---|---|
| UnitTypeID | Int | Unique |
| UnitTypeName | String | |
| CityDistState | String | |
| Hierarchy | Int | |
| Active | Boolean | |

### Unit
| Column | Type | Notes |
|---|---|---|
| UnitID | Int | Unique |
| UnitName | String | |
| TypeID | Int | FK → UnitType.UnitTypeID |
| ParentUnit | Int | self-ref → Unit.UnitID (blank for root) |
| NationalityID | Int | |
| StateID | Int | FK → State.StateID |
| DistrictID | Int | FK → District.DistrictID |
| Active | Boolean | |

### Rank
| Column | Type | Notes |
|---|---|---|
| RankID | Int | Unique |
| RankName | String | |
| Hierarchy | Int | |
| Active | Boolean | |

### Designation
| Column | Type | Notes |
|---|---|---|
| DesignationID | Int | Unique |
| DesignationName | String | |
| Active | Boolean | |
| SortOrder | Int | |

### Employee
| Column | Type | Notes |
|---|---|---|
| EmployeeID | Int | Unique |
| DistrictID | Int | FK → District.DistrictID |
| UnitID | Int | FK → Unit.UnitID |
| RankID | Int | FK → Rank.RankID |
| DesignationID | Int | FK → Designation.DesignationID |
| KGID | String | Unique — used as login identifier |
| FirstName | String | |
| EmployeeDOB | DateTime | date-only, stored at midnight |
| GenderID | Int | 1=M, 2=F, 3=T |
| BloodGroupID | Int | 1..8 lookup |
| PhysicallyChallenged | Boolean | |
| AppointmentDate | DateTime | date-only |

### Court
| Column | Type | Notes |
|---|---|---|
| CourtID | Int | Unique |
| CourtName | String | |
| DistrictID | Int | FK → District.DistrictID |
| StateID | Int | FK → State.StateID |
| Active | Boolean | |

---

## 02_legal_reference

### Act
| Column | Type | Notes |
|---|---|---|
| ActCode | String | Unique (PK) |
| ActDescription | String | |
| ShortName | String | |
| Active | Boolean | |

### Section
| Column | Type | Notes |
|---|---|---|
| ActCode | String | FK → Act.ActCode |
| SectionCode | String | composite key with ActCode |
| SectionDescription | String | |
| Active | Boolean | |

### CrimeHead
| Column | Type | Notes |
|---|---|---|
| CrimeHeadID | Int | Unique |
| CrimeGroupName | String | |
| Active | Boolean | |

### CrimeSubHead
| Column | Type | Notes |
|---|---|---|
| CrimeSubHeadID | Int | Unique |
| CrimeHeadID | Int | FK → CrimeHead.CrimeHeadID |
| CrimeHeadName | String | sub-head name, e.g. Murder |
| SeqID | Int | |

### CrimeHeadActSection
| Column | Type | Notes |
|---|---|---|
| CrimeHeadID | Int | FK → CrimeHead.CrimeHeadID |
| ActCode | String | FK → Act.ActCode |
| SectionCode | String | FK → Section.SectionCode (with ActCode) |

---

## 03_lookup_master

### CaseCategory
| Column | Type | Notes |
|---|---|---|
| CaseCategoryID | Int | Unique |
| LookupValue | String | FIR / UDR / Zero FIR / PAR |

### GravityOffence
| Column | Type | Notes |
|---|---|---|
| GravityOffenceID | Int | Unique |
| LookupValue | String | Heinous / Non-Heinous |

### CaseStatusMaster
| Column | Type | Notes |
|---|---|---|
| CaseStatusID | Int | Unique |
| CaseStatusName | String | |

### CasteMaster
| Column | Type | Notes |
|---|---|---|
| caste_master_id | Int | Unique |
| caste_master_name | String | |

### ReligionMaster
| Column | Type | Notes |
|---|---|---|
| ReligionID | Int | Unique |
| ReligionName | String | |

### OccupationMaster
| Column | Type | Notes |
|---|---|---|
| OccupationID | Int | Unique |
| OccupationName | String | |

---

## 04_core_transactional

### CaseMaster
| Column | Type | Notes |
|---|---|---|
| CaseMasterID | Int | Unique |
| CrimeNo | String | Unique — 18-digit structured: 1(cat)+4(district)+4(station)+4(year)+5(serial) |
| CaseNo | String | last 9 digits of CrimeNo: 4(year)+5(serial) |
| CrimeRegisteredDate | DateTime | date-only |
| PolicePersonID | Int | FK → Employee.EmployeeID |
| PoliceStationID | Int | FK → Unit.UnitID |
| CaseCategoryID | Int | FK → CaseCategory.CaseCategoryID |
| GravityOffenceID | Int | FK → GravityOffence.GravityOffenceID |
| CrimeMajorHeadID | Int | FK → CrimeHead.CrimeHeadID |
| CrimeMinorHeadID | Int | FK → CrimeSubHead.CrimeSubHeadID |
| CaseStatusID | Int | FK → CaseStatusMaster.CaseStatusID |
| CourtID | Int | FK → Court.CourtID |
| IncidentFromDate | DateTime | |
| IncidentToDate | DateTime | |
| InfoReceivedPSDate | DateTime | |
| latitude | Decimal | |
| longitude | Decimal | |
| BriefFacts | Text | long text, summary of the case |

### ComplainantDetails
| Column | Type | Notes |
|---|---|---|
| ComplainantID | Int | Unique |
| CaseMasterID | Int | FK → CaseMaster.CaseMasterID |
| ComplainantName | String | |
| AgeYear | Int | |
| OccupationID | Int | FK → OccupationMaster.OccupationID |
| ReligionID | Int | FK → ReligionMaster.ReligionID |
| CasteID | Int | FK → CasteMaster.caste_master_id |
| GenderID | Int | 1=M, 2=F, 3=T |

### Victim
| Column | Type | Notes |
|---|---|---|
| VictimMasterID | Int | Unique |
| CaseMasterID | Int | FK → CaseMaster.CaseMasterID |
| VictimName | String | |
| AgeYear | Int | |
| GenderID | String | m / f / t (as per source spec) |
| VictimPolice | Boolean | 1 if victim is police |

### Accused
| Column | Type | Notes |
|---|---|---|
| AccusedMasterID | Int | Unique |
| CaseMasterID | Int | FK → CaseMaster.CaseMasterID |
| AccusedName | String | |
| AgeYear | Int | |
| GenderID | String | M / F / T |
| PersonID | String | sort code A1, A2, A3... within case |

### ActSectionAssociation
| Column | Type | Notes |
|---|---|---|
| CaseMasterID | Int | FK → CaseMaster.CaseMasterID |
| ActID | String | FK → Act.ActCode |
| SectionID | String | FK → Section.SectionCode |
| ActOrderID | Int | display order |
| SectionOrderID | Int | display order |

### ArrestSurrender
| Column | Type | Notes |
|---|---|---|
| ArrestSurrenderID | Int | Unique |
| CaseMasterID | Int | FK → CaseMaster.CaseMasterID |
| ArrestSurrenderTypeID | Int | 1=Arrest, 2=Voluntary Surrender |
| ArrestSurrenderDate | DateTime | date-only |
| ArrestSurrenderStateId | Int | FK → State.StateID |
| ArrestSurrenderDistrictId | Int | FK → District.DistrictID |
| PoliceStationID | Int | FK → Unit.UnitID |
| IOID | Int | FK → Employee.EmployeeID |
| CourtID | Int | FK → Court.CourtID |
| AccusedMasterID | Int | FK → Accused.AccusedMasterID |
| IsAccused | Boolean | |
| IsComplainantAccused | Boolean | |

### inv_arrestsurrenderaccused
Junction table: one arrest event ↔ multiple accused.
| Column | Type | Notes |
|---|---|---|
| JunctionID | Int | Unique |
| ArrestSurrenderID | Int | FK → ArrestSurrender.ArrestSurrenderID |
| AccusedMasterID | Int | FK → Accused.AccusedMasterID |

### ChargesheetDetails
| Column | Type | Notes |
|---|---|---|
| CSID | Int | Unique |
| CaseMasterID | Int | FK → CaseMaster.CaseMasterID |
| csdate | DateTime | chargesheet date+time |
| cstype | String | A=Chargesheet, B=False Case, C=Undetected |
| PolicePersonID | Int | FK → Employee.EmployeeID |

---

## 05_extensions

### Inv_OccuranceTime
This table resolves the "open item" flagged in the architecture document — the
relationship matrix documents a **1:1 CaseMaster ↔ Inv_OccuranceTime** link whose
columns were never separately defined. Since the same fields already exist directly
on `CaseMaster` (IncidentFromDate, IncidentToDate, InfoReceivedPSDate, latitude,
longitude), this table is generated as a 1:1 mirror keyed by CaseMasterID, so the
documented relationship is satisfiable in DataStore without altering CaseMaster.
**Recommendation:** if a denormalized 1:1 table isn't actually needed by any query
pattern, drop this table and reference the fields on CaseMaster directly instead.

| Column | Type | Notes |
|---|---|---|
| InvOccuranceTimeID | Int | Unique, = CaseMasterID (1:1) |
| CaseMasterID | Int | FK → CaseMaster.CaseMasterID, Unique |
| IncidentFromDate | DateTime | |
| IncidentToDate | DateTime | |
| InfoReceivedPSDate | DateTime | |
| latitude | Decimal | |
| longitude | Decimal | |

### BondRecord
Supports the **Good Conduct Bond / HS Record Tracker** module (`POST /bonds`,
`GET /bonds/expiring?withinDays=30`) described in the architecture document's API
section as a new extension table.

| Column | Type | Notes |
|---|---|---|
| BondRecordID | Int | Unique |
| CaseMasterID | Int | FK → CaseMaster.CaseMasterID |
| AccusedMasterID | Int | FK → Accused.AccusedMasterID |
| signDate | DateTime | date-only |
| expiryDate | DateTime | date-only |
| status | String | Active / Expired / Renewed / Violated |

---

## Total table count: 27

| Folder | Tables |
|---|---|
| 01_org_geography | State, District, UnitType, Unit, Rank, Designation, Employee, Court (8) |
| 02_legal_reference | Act, Section, CrimeHead, CrimeSubHead, CrimeHeadActSection (5) |
| 03_lookup_master | CaseCategory, GravityOffence, CaseStatusMaster, CasteMaster, ReligionMaster, OccupationMaster (6) |
| 04_core_transactional | CaseMaster, ComplainantDetails, Victim, Accused, ActSectionAssociation, ArrestSurrender, inv_arrestsurrenderaccused, ChargesheetDetails (8) |
| 05_extensions | Inv_OccuranceTime, BondRecord (2) |
