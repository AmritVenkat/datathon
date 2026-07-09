"use strict";

const crypto = require("crypto");

const ALLOWED = new Set([
  "CaseMaster", "Accused", "Victim", "ComplainantDetails", "CaseStatusMaster",
  "CrimeHead", "CrimeSubHead", "Unit", "District", "ActSectionAssociation",
  "ArrestSurrender", "ChargesheetDetails", "BondRecord", "Conversation",
  "ConversationMessage", "AuditLog"
]);

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

function userContext(req) {
  const catalystUser = req.catalystUser || {};
  const catalystRole = catalystUser.role_details?.role_name || catalystUser.role_name;
  const localRole = process.env.NODE_ENV !== "production" ? req.get("x-kavach-role") : null;
  return {
    id: catalystUser.user_id || req.get("x-zc-user-id") || "anonymous",
    email: catalystUser.email_id || "",
    role: String(catalystRole || localRole || "analyst").toLowerCase()
  };
}

function requireRole(...roles) {
  return (req, _res, next) => {
    const user = userContext(req);
    if (!roles.includes(user.role)) return next(Object.assign(new Error("Insufficient role"), { status: 403 }));
    next();
  };
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

module.exports = { id, escapeZcql, query, safeInsert, userContext, requireRole, audit, citation };
