"use strict";

const express = require("express");
const catalyst = require("zcatalyst-sdk-node");
const {
  id, escapeZcql, query, safeInsert, userContext, requireAuthenticated, requireRole,
  requirePoliceOfficer, hasPermission, audit, citation
} = require("./lib");

const api = express();
api.use(express.json({ limit: "1mb" }));
api.use((req, res, next) => {
  res.set("Access-Control-Allow-Origin", req.get("origin") || "*");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-kavach-role, x-kavach-kgid");
  res.set("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  req.catalystApp = catalyst.initialize(req);
  next();
});

api.get("/health", (_req, res) => res.json({
  ok: true, service: "kavach-api", version: "1.0.0", time: new Date().toISOString()
}));

api.use(requireAuthenticated);

api.get("/auth/me", asyncRoute(async (req, res) => {
  const context = await requirePoliceOfficer(req.catalystApp, req);
  await audit(req.catalystApp, req, "AUTH_ME", `Employee:${context.employee?.EmployeeID || "unmapped"}`);
  res.json({
    user: { id: context.user.id, email: context.user.email, kgid: context.user.kgid },
    employee: context.employee,
    role: context.role,
    scope: { districtId: context.districtId, unitId: context.unitId },
    permissions: context.permissions
  });
}));

api.get("/dashboard", asyncRoute(async (req, res) => {
  const app = req.catalystApp;
  const context = await requirePoliceOfficer(app, req);
  const scope = await scopedCaseWhere(app, context);
  const where = scope ? ` WHERE ${scope}` : "";
  const [totals, statuses, trends, alerts] = await Promise.all([
    query(app, `SELECT COUNT(ROWID) AS TotalCases FROM CaseMaster${where}`),
    query(app, `SELECT CaseStatusID, COUNT(ROWID) AS Count FROM CaseMaster${where} GROUP BY CaseStatusID`),
    query(app, `SELECT CrimeRegisteredDate, CaseStatusID FROM CaseMaster${where} ORDER BY CrimeRegisteredDate DESC LIMIT 500`),
    query(app, "SELECT BondRecordID, AccusedMasterID, expiryDate, status FROM BondRecord WHERE status = 'Active' ORDER BY expiryDate ASC LIMIT 10").catch(() => [])
  ]);
  const active = statuses.filter(s => ["1", "6"].includes(String(s.CaseStatusID))).reduce((n, s) => n + Number(s.Count), 0);
  res.json({ kpis: { totalCases: Number(totals[0]?.TotalCases || 0), activeCases: active }, statuses, trends, alerts });
}));

api.get("/cases", asyncRoute(async (req, res) => {
  const { crimeNo, statusId, stationId, limit = "50" } = req.query;
  const context = await requirePoliceOfficer(req.catalystApp, req);
  const where = [];
  const scope = await scopedCaseWhere(req.catalystApp, context);
  if (scope) where.push(scope);
  if (crimeNo) where.push(`CrimeNo = '${escapeZcql(crimeNo)}'`);
  if (statusId) where.push(`CaseStatusID = ${Number(statusId)}`);
  if (stationId) where.push(`PoliceStationID = ${Number(stationId)}`);
  const take = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const sql = `SELECT ROWID, CaseMasterID, CrimeNo, CaseNo, CrimeRegisteredDate, PoliceStationID, CaseStatusID, latitude, longitude, BriefFacts FROM CaseMaster${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY CrimeRegisteredDate DESC LIMIT ${take}`;
  const data = await query(req.catalystApp, sql);
  await audit(req.catalystApp, req, "CASE_SEARCH", "CaseMaster", { filters: req.query, count: data.length });
  res.json({ data, count: data.length });
}));

api.get("/cases/:id", asyncRoute(async (req, res) => {
  const caseId = Number(req.params.id);
  if (!Number.isInteger(caseId)) return res.status(400).json({ error: "Invalid case id" });
  const app = req.catalystApp;
  const context = await requirePoliceOfficer(app, req);
  const scope = await scopedCaseWhere(app, context);
  const caseWhere = [`CaseMasterID = ${caseId}`];
  if (scope) caseWhere.push(scope);
  const [cases, accused, victims, sections, arrests, chargesheets] = await Promise.all([
    query(app, `SELECT * FROM CaseMaster WHERE ${caseWhere.join(" AND ")}`),
    query(app, `SELECT * FROM Accused WHERE CaseMasterID = ${caseId}`),
    query(app, `SELECT * FROM Victim WHERE CaseMasterID = ${caseId}`),
    query(app, `SELECT * FROM ActSectionAssociation WHERE CaseMasterID = ${caseId}`),
    query(app, `SELECT * FROM ArrestSurrender WHERE CaseMasterID = ${caseId}`),
    query(app, `SELECT * FROM ChargesheetDetails WHERE CaseMasterID = ${caseId}`)
  ]);
  if (!cases[0]) return res.status(404).json({ error: "Case not found" });
  const events = [
    { type: "incident", date: cases[0].IncidentFromDate },
    { type: "registered", date: cases[0].CrimeRegisteredDate },
    ...arrests.map(x => ({ type: Number(x.ArrestSurrenderTypeID) === 1 ? "arrest" : "surrender", date: x.ArrestSurrenderDate, ref: x.ArrestSurrenderID })),
    ...chargesheets.map(x => ({ type: "chargesheet", date: x.csdate, ref: x.CSID }))
  ].filter(x => x.date).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  await audit(app, req, "CASE_VIEW", `CaseMaster:${caseId}`);
  res.json({ case: cases[0], accused, victims, sections, arrests, chargesheets, timeline: events });
}));

api.patch("/cases/:id/status", requireRole("investigator", "supervisor"), asyncRoute(async (req, res) => {
  const caseId = Number(req.params.id);
  const status = Number(req.body.caseStatusId);
  if (!Number.isInteger(caseId) || !Number.isInteger(status)) return res.status(400).json({ error: "Invalid status update" });
  const context = await requirePoliceOfficer(req.catalystApp, req);
  const scope = await scopedCaseWhere(req.catalystApp, context);
  const where = [`CaseMasterID = ${caseId}`];
  if (scope) where.push(scope);
  const existing = await query(req.catalystApp, `SELECT ROWID, CaseStatusID FROM CaseMaster WHERE ${where.join(" AND ")}`);
  if (!existing[0]) return res.status(404).json({ error: "Case not found" });
  const result = await req.catalystApp.datastore().table("CaseMaster").updateRow({ ROWID: existing[0].ROWID, CaseStatusID: status });
  await audit(req.catalystApp, req, "CASE_STATUS_UPDATE", `CaseMaster:${caseId}`, { from: existing[0].CaseStatusID, to: status });
  res.json({ data: result });
}));

api.get("/accused/:id/profile", asyncRoute(async (req, res) => {
  const accusedId = Number(req.params.id);
  const app = req.catalystApp;
  const context = await requirePoliceOfficer(app, req);
  const persons = await query(app, `SELECT * FROM Accused WHERE AccusedMasterID = ${accusedId}`);
  if (!persons[0]) return res.status(404).json({ error: "Accused not found" });
  const person = persons[0];
  const scope = await scopedCaseWhere(app, context);
  if (scope) {
    const allowed = await query(app, `SELECT CaseMasterID FROM CaseMaster WHERE CaseMasterID = ${Number(person.CaseMasterID)} AND ${scope}`);
    if (!allowed[0]) return res.status(404).json({ error: "Accused not found" });
  }
  const scopedCases = scope ? await query(app, `SELECT CaseMasterID FROM CaseMaster WHERE ${scope} LIMIT 1000`) : [];
  const caseIds = scopedCases.map(c => Number(c.CaseMasterID)).filter(Number.isFinite);
  const caseFilter = scope ? ` AND CaseMasterID IN (${caseIds.length ? caseIds.join(",") : "0"})` : "";
  const history = await query(app, `SELECT AccusedMasterID, CaseMasterID, AccusedName, PersonID FROM Accused WHERE AccusedName = '${escapeZcql(person.AccusedName)}'${caseFilter}`);
  const arrests = await query(app, `SELECT * FROM ArrestSurrender WHERE AccusedMasterID = ${accusedId}`);
  const risk = riskScore(history.length, arrests.length);
  await audit(app, req, "PERSON_PROFILE_VIEW", `Accused:${accusedId}`);
  res.json({ person, criminalHistory: history, arrests, risk });
}));

api.get("/analytics/hotspots", asyncRoute(async (req, res) => {
  const context = await requirePoliceOfficer(req.catalystApp, req);
  const days = Math.min(Math.max(Number(req.query.days) || 90, 7), 730);
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const where = [`CrimeRegisteredDate >= '${cutoff}'`];
  const scope = await scopedCaseWhere(req.catalystApp, context);
  if (scope) where.push(scope);
  const points = await query(req.catalystApp, `SELECT CaseMasterID, CrimeRegisteredDate, CrimeMajorHeadID, latitude, longitude FROM CaseMaster WHERE ${where.join(" AND ")} LIMIT 2000`);
  const cells = new Map();
  for (const p of points) {
    const lat = Number(p.latitude), lng = Number(p.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const key = `${lat.toFixed(1)},${lng.toFixed(1)}`;
    const cell = cells.get(key) || { latitude: Number(lat.toFixed(1)), longitude: Number(lng.toFixed(1)), cases: 0, caseIds: [] };
    cell.cases++; if (cell.caseIds.length < 10) cell.caseIds.push(p.CaseMasterID); cells.set(key, cell);
  }
  const hotspots = [...cells.values()].sort((a, b) => b.cases - a.cases).slice(0, 25)
    .map((h, i) => ({ ...h, rank: i + 1, risk: h.cases >= 10 ? "critical" : h.cases >= 5 ? "elevated" : "watch" }));
  res.json({ windowDays: days, sourceRows: points.length, hotspots });
}));

api.get("/analytics/network", asyncRoute(async (req, res) => {
  const context = await requirePoliceOfficer(req.catalystApp, req);
  const max = Math.min(Math.max(Number(req.query.limit) || 200, 25), 500);
  const scope = await scopedCaseWhere(req.catalystApp, context);
  const caseWhere = [];
  if (scope) caseWhere.push(scope);
  if (req.query.caseId && Number.isFinite(Number(req.query.caseId))) caseWhere.push(`CaseMasterID = ${Number(req.query.caseId)}`);
  if (req.query.crimeNo) caseWhere.push(`CrimeNo = '${escapeZcql(req.query.crimeNo)}'`);
  let scopedCases = await query(req.catalystApp, `SELECT CaseMasterID, CrimeNo, PoliceStationID, CrimeRegisteredDate FROM CaseMaster${caseWhere.length ? ` WHERE ${caseWhere.join(" AND ")}` : ""} LIMIT ${max}`);
  if (req.query.person) {
    const name = escapeZcql(req.query.person);
    const matchingAccused = await query(req.catalystApp, `SELECT CaseMasterID FROM Accused WHERE AccusedName LIKE '%${name}%' LIMIT ${max}`);
    const personCaseIds = matchingAccused.map(x => Number(x.CaseMasterID)).filter(Number.isFinite);
    scopedCases = personCaseIds.length
      ? await query(req.catalystApp, `SELECT CaseMasterID, CrimeNo, PoliceStationID, CrimeRegisteredDate FROM CaseMaster WHERE CaseMasterID IN (${personCaseIds.join(",")})${scope ? ` AND ${scope}` : ""} LIMIT ${max}`)
      : [];
  }
  const caseIds = scopedCases.map(c => Number(c.CaseMasterID)).filter(Number.isFinite);
  const caseFilter = ` WHERE CaseMasterID IN (${caseIds.length ? caseIds.join(",") : "0"})`;
  const accused = await query(req.catalystApp, `SELECT AccusedMasterID, CaseMasterID, AccusedName, PersonID FROM Accused${caseFilter} LIMIT ${max}`);
  const byCase = accused.reduce((m, x) => ((m[x.CaseMasterID] ||= []).push(x), m), {});
  const nodes = [
    ...scopedCases.map(x => ({ id: `C${x.CaseMasterID}`, label: x.CrimeNo, type: "case", caseId: x.CaseMasterID })),
    ...accused.map(x => ({ id: `A${x.AccusedMasterID}`, label: x.AccusedName, type: "accused", caseId: x.CaseMasterID }))
  ];
  const edges = [];
  Object.entries(byCase).forEach(([caseId, group]) => {
    group.forEach(person => edges.push({ source: `A${person.AccusedMasterID}`, target: `C${caseId}`, relation: "named-in-case", caseId: Number(caseId) }));
    for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++)
      edges.push({ source: `A${group[i].AccusedMasterID}`, target: `A${group[j].AccusedMasterID}`, relation: "co-accused", caseId: group[i].CaseMasterID });
  });
  res.json({ nodes, edges, cases: scopedCases, disclaimer: "Links indicate shared records, not proven criminal association." });
}));

api.post("/chat/query", asyncRoute(async (req, res) => {
  const app = req.catalystApp;
  const context = await requirePoliceOfficer(app, req);
  const question = String(req.body.question || "").trim();
  const language = req.body.language === "kn" ? "kn" : "en";
  const conversationId = String(req.body.conversationId || id("CONV-"));
  if (!question || question.length > 1000) return res.status(400).json({ error: "Question must be 1–1000 characters" });
  if (!hasPermission(context, "chat:use")) return res.status(403).json({ error: "Chat access denied" });
  await ensureConversation(app, req, conversationId, language);
  await saveMessage(app, conversationId, "user", question, []);
  const grounded = await answerQuestion(app, question, language, context);
  const enhanced = await enhanceWithQuickML(app, question, grounded, language);
  const messageId = await saveMessage(app, conversationId, "assistant", enhanced.answer, enhanced.citations);
  await audit(app, req, "CHAT_QUERY", `Conversation:${conversationId}`, { intent: grounded.intent, citationCount: enhanced.citations.length });
  res.json({ conversationId, messageId, ...enhanced });
}));

api.get("/chat/:conversationId", asyncRoute(async (req, res) => {
  const conv = escapeZcql(req.params.conversationId);
  const messages = await query(req.catalystApp, `SELECT * FROM ConversationMessage WHERE ConversationID = '${conv}' ORDER BY CreatedAt ASC`);
  res.json({ conversationId: req.params.conversationId, messages: messages.map(m => ({ ...m, Citations: parseJson(m.Citations, []) })) });
}));

api.post("/chat/export-pdf", asyncRoute(async (req, res) => {
  const context = await requirePoliceOfficer(req.catalystApp, req);
  if (!hasPermission(context, "export:pdf")) return res.status(403).json({ error: "PDF export denied" });
  const conv = escapeZcql(req.body.conversationId);
  const messages = await query(req.catalystApp, `SELECT Role, Content, Citations, CreatedAt FROM ConversationMessage WHERE ConversationID = '${conv}' ORDER BY CreatedAt ASC`);
  if (!messages.length) return res.status(404).json({ error: "Conversation not found" });
  const html = conversationHtml(req.body.conversationId, messages);
  const stream = await req.catalystApp.smartbrowz().convertToPdf(html, { page_size: "A4", print_background: true });
  res.set("Content-Type", "application/pdf");
  res.set("Content-Disposition", `attachment; filename="kavach-${req.body.conversationId}.pdf"`);
  stream.pipe(res);
}));

api.use((error, req, res, _next) => {
  console.error(error);
  audit(req.catalystApp, req, "API_ERROR", req.path, { message: error.message }).catch(() => {});
  res.status(error.status || 500).json({ error: error.status ? error.message : "Backend operation failed", requestId: id("REQ-") });
});

async function answerQuestion(app, question, language, context) {
  const q = question.toLowerCase();
  const crimeNo = q.match(/\b\d{18}\b/)?.[0];
  if (crimeNo) {
    const where = [`CrimeNo = '${crimeNo}'`];
    const scope = await scopedCaseWhere(app, context);
    if (scope) where.push(scope);
    const cases = await query(app, `SELECT * FROM CaseMaster WHERE ${where.join(" AND ")}`);
    if (!cases[0]) return plain(language, "fir_not_found", [], "fir");
    const c = cases[0];
    const [accused, victims, status] = await Promise.all([
      query(app, `SELECT * FROM Accused WHERE CaseMasterID = ${Number(c.CaseMasterID)}`),
      query(app, `SELECT * FROM Victim WHERE CaseMasterID = ${Number(c.CaseMasterID)}`),
      query(app, `SELECT * FROM CaseStatusMaster WHERE CaseStatusID = ${Number(c.CaseStatusID)}`)
    ]);
    const answer = language === "kn"
      ? `ಎಫ್‌ಐಆರ್ ${c.CrimeNo} ಅನ್ನು ${c.CrimeRegisteredDate} ರಂದು ದಾಖಲಿಸಲಾಗಿದೆ. ಪ್ರಸ್ತುತ ಸ್ಥಿತಿ: ${status[0]?.CaseStatusName || c.CaseStatusID}. ${accused.length} ಆರೋಪಿ ಮತ್ತು ${victims.length} ಸಂತ್ರಸ್ತರ ದಾಖಲೆಗಳಿವೆ. ${c.BriefFacts || ""}`
      : `FIR ${c.CrimeNo} was registered on ${c.CrimeRegisteredDate}. Current status: ${status[0]?.CaseStatusName || c.CaseStatusID}. It records ${accused.length} accused and ${victims.length} victim(s). ${c.BriefFacts || ""}`;
    return { intent: "fir_summary", answer, confidence: 0.99, citations: [
      citation("CaseMaster", c, ["CrimeNo", "CrimeRegisteredDate", "CaseStatusID", "BriefFacts"], `FIR ${c.CrimeNo}`),
      ...accused.slice(0, 5).map(x => citation("Accused", x, ["AccusedMasterID", "AccusedName", "CaseMasterID"], x.AccusedName)),
      ...status.slice(0, 1).map(x => citation("CaseStatusMaster", x, ["CaseStatusID", "CaseStatusName"], x.CaseStatusName))
    ] };
  }
  if (/repeat|habitual|ಪುನರಾವರ್ತಿತ|ಮರು/.test(q)) {
    const scope = await scopedCaseWhere(app, context);
    const scopedCases = scope ? await query(app, `SELECT CaseMasterID FROM CaseMaster WHERE ${scope} LIMIT 1000`) : [];
    const caseIds = scopedCases.map(c => Number(c.CaseMasterID)).filter(Number.isFinite);
    const caseFilter = scope ? ` WHERE CaseMasterID IN (${caseIds.length ? caseIds.join(",") : "0"})` : "";
    const data = await query(app, `SELECT AccusedName, COUNT(ROWID) AS CaseCount FROM Accused${caseFilter} GROUP BY AccusedName ORDER BY CaseCount DESC LIMIT 20`);
    const repeats = data.filter(x => Number(x.CaseCount) > 1);
    const names = repeats.slice(0, 5).map(x => `${x.AccusedName} (${x.CaseCount})`).join(", ");
    return {
      intent: "repeat_offenders",
      answer: language === "kn" ? `${repeats.length} ಪುನರಾವರ್ತಿತ ಹೆಸರುಗಳು ಕಂಡುಬಂದಿವೆ. ಪ್ರಮುಖ ದಾಖಲೆಗಳು: ${names || "ಯಾವುದೂ ಇಲ್ಲ"}. ಒಂದೇ ಹೆಸರು ಒಂದೇ ವ್ಯಕ್ತಿ ಎಂಬುದನ್ನು ತನಿಖಾಧಿಕಾರಿ ಪರಿಶೀಲಿಸಬೇಕು.` : `${repeats.length} repeated names were found. Leading records: ${names || "none"}. Investigators must verify identity before treating matching names as the same person.`,
      confidence: 0.9,
      citations: repeats.slice(0, 10).map(x => citation("Accused", x, ["AccusedName", "CaseCount"], x.AccusedName))
    };
  }
  const scope = await scopedCaseWhere(app, context);
  const recentWhere = scope ? ` WHERE ${scope}` : "";
  const recent = await query(app, `SELECT CaseMasterID, CrimeNo, CrimeRegisteredDate, BriefFacts FROM CaseMaster${recentWhere} ORDER BY CrimeRegisteredDate DESC LIMIT 5`);
  return {
    intent: "recent_cases",
    answer: language === "kn" ? `ನಿಮ್ಮ ಪ್ರಶ್ನೆಗೆ ಸಂಬಂಧಿಸಿದಂತೆ ${recent.length} ಇತ್ತೀಚಿನ ಪ್ರಕರಣಗಳನ್ನು ಕಂಡುಹಿಡಿದಿದ್ದೇನೆ. ಹೆಚ್ಚಿನ ನಿಖರತೆಗೆ ಎಫ್‌ಐಆರ್ ಸಂಖ್ಯೆ, ಜಿಲ್ಲೆ ಅಥವಾ ಅವಧಿಯನ್ನು ಸೂಚಿಸಿ.` : `I found ${recent.length} recent cases relevant to a general record search. Specify an FIR number, district, offence, or date range for a more precise evidence-grounded answer.`,
    confidence: 0.65,
    citations: recent.map(x => citation("CaseMaster", x, ["CaseMasterID", "CrimeNo", "CrimeRegisteredDate"], `FIR ${x.CrimeNo}`))
  };
}

async function enhanceWithQuickML(app, question, grounded, language) {
  const endpoint = process.env.QUICKML_ENDPOINT_KEY;
  if (!endpoint) return grounded;
  try {
    const prompt = JSON.stringify({ language, question, evidenceOnly: true, draft: grounded.answer, evidence: grounded.citations });
    const result = await app.quickML().predict(endpoint, { prompt });
    const answer = result?.result?.[0];
    return answer ? { ...grounded, answer, model: "Catalyst QuickML" } : grounded;
  } catch (error) {
    console.warn("QuickML fallback:", error.message);
    return grounded;
  }
}

async function ensureConversation(app, req, conversationId, language) {
  const existing = await query(app, `SELECT ConversationID FROM Conversation WHERE ConversationID = '${escapeZcql(conversationId)}'`).catch(() => []);
  if (!existing.length) await safeInsert(app, "Conversation", {
    ConversationID: conversationId, UserID: userContext(req).id, Language: language,
    Title: language === "kn" ? "ಹೊಸ ತನಿಖೆ" : "New investigation",
    CreatedAt: now(), UpdatedAt: now()
  });
}

async function saveMessage(app, conversationId, role, content, citations) {
  const messageId = id("MSG-");
  await safeInsert(app, "ConversationMessage", {
    MessageID: messageId, ConversationID: conversationId, Role: role,
    Content: content, Citations: JSON.stringify(citations), CreatedAt: now()
  });
  return messageId;
}

async function scopedCaseWhere(app, context) {
  if (!context || context.role === "admin") return "";
  if (["supervisor", "analyst"].includes(context.role) && context.districtId) {
    const units = await query(app, `SELECT UnitID FROM Unit WHERE DistrictID = ${context.districtId} LIMIT 500`).catch(() => []);
    const unitIds = units.map(unit => Number(unit.UnitID)).filter(Number.isFinite);
    return `PoliceStationID IN (${unitIds.length ? unitIds.join(",") : "0"})`;
  }
  if (context.unitId) return `PoliceStationID = ${context.unitId}`;
  return process.env.NODE_ENV === "production" ? "1 = 0" : "";
}

function riskScore(caseCount, arrestCount) {
  const score = Math.min(100, Math.round(caseCount * 16 + arrestCount * 9));
  return { score, band: score >= 70 ? "high" : score >= 40 ? "medium" : "low", factors: { recordedCases: caseCount, arrests: arrestCount }, disclaimer: "Prioritisation aid only; not a determination of guilt or future conduct." };
}
function now() { return new Date().toISOString().replace("T", " ").slice(0, 19); }
function parseJson(v, fallback) { try { return JSON.parse(v); } catch { return fallback; } }
function plain(lang, key, citations, intent) {
  const text = key === "fir_not_found" ? (lang === "kn" ? "ಈ ಎಫ್‌ಐಆರ್ ಸಂಖ್ಯೆ ಕಂಡುಬಂದಿಲ್ಲ." : "No FIR was found with that number.") : "";
  return { intent, answer: text, confidence: 1, citations };
}
function escHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }
function conversationHtml(conversationId, messages) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{font:12px Arial;color:#172033;padding:32px}h1{color:#413b8f}.m{border-left:3px solid #7367d8;padding:8px 12px;margin:14px 0}.user{border-color:#2aa97d}.meta{color:#718096;font-size:10px}.cite{color:#5146aa;font-size:9px}</style></head><body><h1>Kavach Intelligence Conversation</h1><p class="meta">Conversation ${escHtml(conversationId)} · Generated ${new Date().toISOString()}</p>${messages.map(m => `<div class="m ${m.Role}"><b>${escHtml(m.Role)}</b><p>${escHtml(m.Content)}</p><div class="cite">${parseJson(m.Citations, []).map(c => escHtml(`${c.table} · ${c.label}`)).join("<br>")}</div><span class="meta">${escHtml(m.CreatedAt)}</span></div>`).join("")}<p class="meta">Operational intelligence must be independently verified before enforcement action.</p></body></html>`;
}
function asyncRoute(fn) { return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next); }

module.exports = api;
