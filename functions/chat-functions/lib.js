"use strict";

const crypto = require("crypto");

const ALLOWED = new Set([
  "CaseMaster", "Accused", "Victim", "ComplainantDetails", "CaseStatusMaster",
  "CrimeHead", "CrimeSubHead", "Unit", "District", "ActSectionAssociation",
  "ArrestSurrender", "ChargesheetDetails", "BondRecord", "Conversation",
  "ConversationMessage", "AuditLog", "Employee"
]);

const ROLE_PERMISSIONS = {
  admin: ["case:read:any", "case:update:any", "analytics:read:any", "chat:use", "export:pdf", "admin:read"],
  supervisor: ["case:read:district", "case:update:district", "analytics:read:district", "chat:use", "export:pdf"],
  investigator: ["case:read:unit", "case:update:unit", "analytics:read:unit", "chat:use", "export:pdf"],
  analyst: ["case:read:district", "analytics:read:district", "chat:use", "export:pdf"],
  officer: ["case:read:unit", "analytics:read:unit", "chat:use"]
};

function id(prefix = "") {
  return `${prefix}${Date.now()}${crypto.randomBytes(4).toString("hex")}`;
}

function escapeZcql(value) {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/'/g, "''");
}

function assertTable(name) {
  if (!ALLOWED.has(name)) throw Object.assign(new Error("Table is not allowed"), { status: 400 });
  return name;
}

function rows(result) {
  return (result || []).map(item => {
    const keys = Object.keys(item);
    return keys.length === 1 && typeof item[keys[0]] === "object" ? item[keys[0]] : item;
  });
}

async function query(app, sql) {
  return rows(await app.zcql().executeZCQLQuery(sql));
}

async function safeInsert(app, table, data) {
  try {
    return await app.datastore().table(assertTable(table)).insertRow(data);
  } catch (error) {
    console.warn(`Optional ${table} write skipped:`, error.message);
    return null;
  }
}

function normalizeRole(role) {
  const value = String(role || "officer").toLowerCase().replace(/\s+/g, "_");
  if (value.includes("admin")) return "admin";
  if (value.includes("supervisor") || value.includes("sho") || value.includes("commissioner") || value.includes("dysp")) return "supervisor";
  if (value.includes("investigator") || value.includes("inspector") || value.includes("psi") || value.includes("pi")) return "investigator";
  if (value.includes("analyst")) return "analyst";
  return ROLE_PERMISSIONS[value] ? value : "officer";
}

function userContext(req) {
  const catalystUser = req.catalystUser || {};
  const catalystRole = catalystUser.role_details?.role_name || catalystUser.role_name;
  const localRole = process.env.NODE_ENV !== "production" ? req.get("x-kavach-role") : null;
  const email = catalystUser.email_id || req.get("x-zc-user-email") || "";
  const kgid = catalystUser.KGID || catalystUser.kgid || req.get("x-kavach-kgid") || email.split("@")[0] || "";
  return {
    id: catalystUser.user_id || req.get("x-zc-user-id") || "anonymous",
    email,
    kgid,
    role: normalizeRole(catalystRole || localRole || "officer")
  };
}

function requireAuthenticated(req, _res, next) {
  const user = userContext(req);
  if (process.env.NODE_ENV === "production" && user.id === "anonymous") {
    return next(Object.assign(new Error("Authentication required"), { status: 401 }));
  }
  next();
}

function requireRole(...roles) {
  return (req, _res, next) => {
    const user = userContext(req);
    if (!roles.includes(user.role)) return next(Object.assign(new Error("Insufficient role"), { status: 403 }));
    next();
  };
}

async function officerContext(app, req) {
  if (req.officerContext) return req.officerContext;
  const user = userContext(req);
  let employee = null;
  if (user.kgid) {
    const kgid = escapeZcql(user.kgid);
    const employees = await query(app, `SELECT EmployeeID, DistrictID, UnitID, RankID, DesignationID, KGID, FirstName FROM Employee WHERE KGID = '${kgid}' LIMIT 1`).catch(() => []);
    employee = employees[0] || null;
  }
  const role = normalizeRole(user.role);
  req.officerContext = {
    user,
    employee,
    role,
    permissions: ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.officer,
    districtId: employee?.DistrictID ? Number(employee.DistrictID) : null,
    unitId: employee?.UnitID ? Number(employee.UnitID) : null
  };
  return req.officerContext;
}

async function requirePoliceOfficer(app, req) {
  const context = await officerContext(app, req);
  if (process.env.NODE_ENV === "production" && !context.employee) {
    throw Object.assign(new Error("Police employee mapping required"), { status: 403 });
  }
  return context;
}

function caseScopeWhere(context, alias = "") {
  const column = (name) => alias ? `${alias}.${name}` : name;
  if (context.role === "admin") return "";
  if (context.unitId) return `${column("PoliceStationID")} = ${context.unitId}`;
  return process.env.NODE_ENV === "production" ? "1 = 0" : "";
}

function hasPermission(context, permission) {
  return context.permissions.includes(permission);
}

async function audit(app, req, action, resource, details = {}) {
  const user = userContext(req);
  return safeInsert(app, "AuditLog", {
    AuditID: id("AUD-"), UserID: user.id, UserRole: user.role, Action: action,
    Resource: resource, Details: JSON.stringify(details).slice(0, 10000),
    EventTime: new Date().toISOString().replace("T", " ").slice(0, 19)
  });
}

function citation(table, row, fields, label) {
  return {
    id: `${table}:${row.ROWID || row.CaseMasterID || row.AccusedMasterID || "aggregate"}`,
    table, rowId: row.ROWID || null, fields, label,
    evidence: fields.reduce((acc, field) => ({ ...acc, [field]: row[field] }), {})
  };
}

module.exports = {
  id,
  escapeZcql,
  query,
  safeInsert,
  userContext,
  requireAuthenticated,
  requireRole,
  officerContext,
  requirePoliceOfficer,
  caseScopeWhere,
  hasPermission,
  audit,
  citation
};
