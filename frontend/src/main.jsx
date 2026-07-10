git import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import "./styles.css";

const API_BASE = import.meta.env.VITE_API_BASE || "/server/chat-functions";

const cases = [
    {
        id: 1001,
        crimeNo: "400170118202400001",
        district: "Kalaburagi",
        station: "Oza Nagar PS",
        category: "Murder",
        gravity: "Heinous",
        status: "Under Investigation",
        registered: "2024-02-07",
        officer: "PI Arjun Rao",
        accused: ["Qasim Sarraf", "Nilima Tara"],
        victims: ["Ravindra Patil"],
        court: "JMFC Kalaburagi",
        risk: 91,
        lat: 17.33,
        lng: 76.83,
        summary:
            "Incident reported near Oza Nagar between 3 and 5 February. Scene documentation, witness statement collection, and accused linkage review are pending supervisor review.",
    },
    {
        id: 1002,
        crimeNo: "400180122202400018",
        district: "Bengaluru Urban",
        station: "Jayanagar PS",
        category: "Cyber Fraud",
        gravity: "Non-Heinous",
        status: "Charge Sheet Filed",
        registered: "2024-03-19",
        officer: "PSI Kavya Shetty",
        accused: ["Nikhil S", "Unknown wallet handler"],
        victims: ["Ananya R"],
        court: "CMM Court Bengaluru",
        risk: 74,
        lat: 12.93,
        lng: 77.58,
        summary:
            "UPI and wallet fraud pattern overlaps with two prior Bengaluru Urban cases. Bank freeze request and device dump are available in documents.",
    },
    {
        id: 1003,
        crimeNo: "400190108202400044",
        district: "Mysuru",
        station: "Nazarbad PS",
        category: "Burglary",
        gravity: "Non-Heinous",
        status: "Pending Arrest",
        registered: "2024-04-03",
        officer: "PI Manjunath H",
        accused: ["Sameer Khan"],
        victims: ["Meera Stores"],
        court: "JMFC Mysuru",
        risk: 82,
        lat: 12.31,
        lng: 76.65,
        summary:
            "Night burglary case with matching vehicle movement and repeat method. Accused bond record expires within 21 days.",
    },
    {
        id: 1004,
        crimeNo: "400200112202400071",
        district: "Dakshina Kannada",
        station: "Mangaluru North PS",
        category: "Narcotics",
        gravity: "Heinous",
        status: "Court Pending",
        registered: "2024-05-11",
        officer: "DYSP Farah Khan",
        accused: ["Vikram Gowda", "Rafiq M"],
        victims: [],
        court: "NDPS Court Mangaluru",
        risk: 88,
        lat: 12.91,
        lng: 74.86,
        summary:
            "NDPS seizure with two accused and four evidence packets. Lab report and seizure mahazar are attached.",
    },
];

const trend = [
    { month: "Jan", registered: 114, resolved: 82, cyber: 18 },
    { month: "Feb", registered: 128, resolved: 88, cyber: 22 },
    { month: "Mar", registered: 119, resolved: 91, cyber: 24 },
    { month: "Apr", registered: 151, resolved: 96, cyber: 35 },
    { month: "May", registered: 144, resolved: 108, cyber: 41 },
    { month: "Jun", registered: 173, resolved: 118, cyber: 48 },
    { month: "Jul", registered: 162, resolved: 121, cyber: 44 },
    { month: "Aug", registered: 188, resolved: 132, cyber: 56 },
];

const categorySplit = [
    { name: "Property", value: 31, color: "#5c8df6" },
    { name: "Cyber", value: 24, color: "#23a88f" },
    { name: "Violent", value: 18, color: "#e15554" },
    { name: "Narcotics", value: 15, color: "#e6a23c" },
    { name: "Other", value: 12, color: "#8b5cf6" },
];

const alerts = [
    { level: "critical", title: "Repeat-offender cluster detected", detail: "6 linked persons across 9 FIRs in Bengaluru Urban", age: "2 min" },
    { level: "high", title: "Bond expiry approaching", detail: "14 active bonds expire within 30 days", age: "18 min" },
    { level: "medium", title: "Charge sheet delay risk", detail: "11 cases are nearing internal SLA threshold", age: "1 hr" },
    { level: "medium", title: "Document ingestion pending", detail: "23 uploaded files need OCR verification", age: "3 hr" },
];

const documents = [
    { name: "FIR_400170118202400001.pdf", type: "FIR", caseId: 1001, status: "Indexed", owner: "Oza Nagar PS" },
    { name: "Chargesheet_400180122202400018.pdf", type: "Chargesheet", caseId: 1002, status: "Indexed", owner: "Jayanagar PS" },
    { name: "WitnessStatement_RPatil.docx", type: "Statement", caseId: 1001, status: "OCR Review", owner: "Oza Nagar PS" },
    { name: "SeizureMahazar_NDPS_071.pdf", type: "Evidence", caseId: 1004, status: "Indexed", owner: "Mangaluru North PS" },
];

const bonds = [
    { id: "B-1001", accused: "Sameer Khan", caseId: 1003, station: "Nazarbad PS", expires: "21 days", status: "Active", risk: "High" },
    { id: "B-1002", accused: "Qasim Sarraf", caseId: 1001, station: "Oza Nagar PS", expires: "28 days", status: "Active", risk: "High" },
    { id: "B-1003", accused: "Nikhil S", caseId: 1002, station: "Jayanagar PS", expires: "63 days", status: "Renewed", risk: "Medium" },
];

const nav = [
    { id: "dashboard", label: "Dashboard", icon: "GRID" },
    { id: "cases", label: "Cases", icon: "CASE" },
    { id: "map", label: "Crime Map", icon: "MAP" },
    { id: "network", label: "Network", icon: "LINK" },
    { id: "analytics", label: "Analytics", icon: "CHART" },
    { id: "chat", label: "AI Chat", icon: "AI" },
    { id: "documents", label: "Documents", icon: "DOC" },
    { id: "court", label: "Court", icon: "LAW" },
    { id: "bond", label: "Bond", icon: "BOND" },
    { id: "admin", label: "Admin", icon: "CTRL" },
    { id: "settings", label: "Settings", icon: "SET" },
];

function App() {
    const [page, setPage] = useState("dashboard");
    const [selectedCaseId, setSelectedCaseId] = useState(1001);
    const [query, setQuery] = useState("");
    const [messages, setMessages] = useState([
        {
            role: "assistant",
            text: "I am ready to search cases, explain trends, summarize FIRs, and cite the records used. Try asking about FIR 400170118202400001.",
            citations: ["CaseMaster", "Accused", "BondRecord"],
        },
    ]);
    const selectedCase = cases.find((item) => item.id === selectedCaseId) || cases[0];
    const activePage = nav.find((item) => item.id === page);

    const metrics = useMemo(
        () => [
            { label: "Active cases", value: "1,284", delta: "+8.2%", tone: "blue" },
            { label: "Resolution rate", value: "73.6%", delta: "+4.1%", tone: "green" },
            { label: "High-risk persons", value: "142", delta: "12 new", tone: "amber" },
            { label: "Priority alerts", value: "08", delta: "3 urgent", tone: "red" },
        ],
        []
    );

    async function sendMessage(text = query) {
        const question = text.trim();
        if (!question) return;
        setMessages((items) => [...items, { role: "user", text: question }]);
        setQuery("");

        try {
            const response = await fetch(`${API_BASE}/chat/query`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question, language: "en" }),
            });
            if (response.ok) {
                const payload = await response.json();
                setMessages((items) => [
                    ...items,
                    {
                        role: "assistant",
                        text: payload.answer,
                        citations: (payload.citations || []).map((item) => `${item.table}: ${item.label}`),
                    },
                ]);
                return;
            }
        } catch {
            // Local Vite preview still works without Catalyst serve.
        }

        const answer = localAnswer(question);
        setMessages((items) => [...items, answer]);
    }

    return (
        <div className="shell">
            <Sidebar page={page} setPage={setPage} />
            <main className="workspace">
                <Topbar title={activePage?.label || "Dashboard"} />
                {page === "dashboard" && <Dashboard metrics={metrics} setPage={setPage} setSelectedCaseId={setSelectedCaseId} />}
                {page === "cases" && <Cases selectedCase={selectedCase} setSelectedCaseId={setSelectedCaseId} />}
                {page === "map" && <CrimeMap setSelectedCaseId={setSelectedCaseId} setPage={setPage} />}
                {page === "network" && <Network selectedCase={selectedCase} />}
                {page === "analytics" && <Analytics />}
                {page === "chat" && <Chat messages={messages} query={query} setQuery={setQuery} sendMessage={sendMessage} />}
                {page === "documents" && <Documents />}
                {page === "court" && <Court />}
                {page === "bond" && <Bond />}
                {page === "admin" && <Admin />}
                {page === "settings" && <Settings />}
            </main>
            <Inspector selectedCase={selectedCase} setPage={setPage} sendMessage={sendMessage} />
        </div>
    );
}

function Sidebar({ page, setPage }) {
    return (
        <aside className="sidebar">
            <div className="brand">
                <div className="crest">KSP</div>
                <div>
                    <strong>KAVACH</strong>
                    <span>Crime Intelligence</span>
                </div>
            </div>
            <nav className="nav">
                {nav.map((item) => (
                    <button key={item.id} className={page === item.id ? "active" : ""} onClick={() => setPage(item.id)}>
                        <span>{item.icon}</span>
                        {item.label}
                    </button>
                ))}
            </nav>
            <div className="officer-card">
                <div className="avatar">AR</div>
                <div>
                    <strong>Inspector Arjun Rao</strong>
                    <span>Crime Branch Analyst</span>
                </div>
            </div>
        </aside>
    );
}

function Topbar({ title }) {
    return (
        <header className="topbar">
            <div>
                <p>Live intelligence workspace</p>
                <h1>{title}</h1>
            </div>
            <div className="top-actions">
                <button title="Search">SRCH</button>
                <button title="Notifications">BELL</button>
                <button className="primary">Export briefing</button>
            </div>
        </header>
    );
}

function Dashboard({ metrics, setPage, setSelectedCaseId }) {
    return (
        <div className="page dashboard">
            <section className="metric-grid">
                {metrics.map((metric) => (
                    <article className={`metric ${metric.tone}`} key={metric.label}>
                        <span>{metric.label}</span>
                        <strong>{metric.value}</strong>
                        <em>{metric.delta}</em>
                    </article>
                ))}
            </section>

            <section className="two-col">
                <Panel title="Crime Trend" subtitle="Registered, resolved, and cyber cases">
                    <div className="chart">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trend}>
                                <CartesianGrid stroke="#d8dee9" vertical={false} />
                                <XAxis dataKey="month" />
                                <YAxis />
                                <Tooltip />
                                <Area type="monotone" dataKey="registered" stroke="#315fbd" fill="#dbe8ff" strokeWidth={2} />
                                <Area type="monotone" dataKey="resolved" stroke="#16816f" fill="#d8f5ee" strokeWidth={2} />
                                <Area type="monotone" dataKey="cyber" stroke="#d28722" fill="#fff2d9" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Panel>
                <Panel title="Priority Alerts" subtitle="Signals requiring officer review">
                    <AlertList />
                </Panel>
            </section>

            <section className="two-col lower">
                <Panel title="High Risk Cases" subtitle="Sorted by intelligence risk score">
                    <CaseTable compact onOpen={(id) => { setSelectedCaseId(id); setPage("cases"); }} />
                </Panel>
                <Panel title="Crime Category Split" subtitle="Last 90 days">
                    <div className="pie-row">
                        <ResponsiveContainer width="45%" height={210}>
                            <PieChart>
                                <Pie data={categorySplit} innerRadius={48} outerRadius={82} dataKey="value">
                                    {categorySplit.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="legend">
                            {categorySplit.map((item) => (
                                <div key={item.name}>
                                    <i style={{ background: item.color }} />
                                    <span>{item.name}</span>
                                    <strong>{item.value}%</strong>
                                </div>
                            ))}
                        </div>
                    </div>
                </Panel>
            </section>
        </div>
    );
}

function Cases({ selectedCase, setSelectedCaseId }) {
    return (
        <div className="page">
            <section className="split-main">
                <Panel title="Case Search" subtitle="Filter by FIR, district, station, status, offence, and risk">
                    <div className="filters">
                        <input placeholder="Search CrimeNo, accused, victim, section" />
                        <select><option>All districts</option><option>Bengaluru Urban</option><option>Kalaburagi</option></select>
                        <select><option>All statuses</option><option>Under Investigation</option><option>Charge Sheet Filed</option></select>
                        <button className="primary">Run search</button>
                    </div>
                    <CaseTable onOpen={setSelectedCaseId} />
                </Panel>

                <Panel title="Case Detail" subtitle={selectedCase.crimeNo}>
                    <div className="case-detail">
                        <div className="case-head">
                            <div>
                                <h2>{selectedCase.category}</h2>
                                <p>{selectedCase.station}, {selectedCase.district}</p>
                            </div>
                            <RiskBadge score={selectedCase.risk} />
                        </div>
                        <p className="summary">{selectedCase.summary}</p>
                        <div className="detail-grid">
                            <Info label="Status" value={selectedCase.status} />
                            <Info label="Registered" value={selectedCase.registered} />
                            <Info label="Officer" value={selectedCase.officer} />
                            <Info label="Court" value={selectedCase.court} />
                        </div>
                        <h3>Parties</h3>
                        <div className="chips">
                            {selectedCase.accused.map((name) => <span className="chip danger" key={name}>{name}</span>)}
                            {selectedCase.victims.map((name) => <span className="chip" key={name}>{name}</span>)}
                        </div>
                        <h3>Timeline</h3>
                        <Timeline />
                    </div>
                </Panel>
            </section>
        </div>
    );
}

function CrimeMap({ setSelectedCaseId, setPage }) {
    return (
        <div className="page">
            <Panel title="Crime Map" subtitle="Operational hotspot view with station and category overlays">
                <div className="map-layout">
                    <div className="map-canvas">
                        <div className="map-label north">KARNATAKA</div>
                        {cases.map((item, index) => (
                            <button
                                key={item.id}
                                className={`map-pin pin-${index + 1}`}
                                onClick={() => { setSelectedCaseId(item.id); setPage("cases"); }}
                                title={item.crimeNo}
                            >
                                {item.risk}
                            </button>
                        ))}
                        <span className="heat heat-a" />
                        <span className="heat heat-b" />
                        <span className="heat heat-c" />
                    </div>
                    <div className="map-panel">
                        <h3>Hotspot ranking</h3>
                        {cases.map((item) => (
                            <button className="hotspot-row" key={item.id} onClick={() => { setSelectedCaseId(item.id); setPage("cases"); }}>
                                <strong>{item.district}</strong>
                                <span>{item.category} - {item.station}</span>
                                <RiskBadge score={item.risk} small />
                            </button>
                        ))}
                    </div>
                </div>
            </Panel>
        </div>
    );
}

function Network({ selectedCase }) {
    const nodes = [
        { id: "case", label: selectedCase.crimeNo.slice(-5), x: 50, y: 50, size: 32, type: "case" },
        { id: "a1", label: selectedCase.accused[0] || "Accused", x: 25, y: 25, size: 22, type: "accused" },
        { id: "a2", label: selectedCase.accused[1] || "Associate", x: 72, y: 26, size: 20, type: "accused" },
        { id: "station", label: selectedCase.station, x: 20, y: 75, size: 18, type: "unit" },
        { id: "court", label: selectedCase.court, x: 79, y: 75, size: 18, type: "court" },
        { id: "section", label: selectedCase.category, x: 51, y: 86, size: 16, type: "legal" },
    ];
    const edges = [["case", "a1"], ["case", "a2"], ["case", "station"], ["case", "court"], ["case", "section"], ["a1", "section"]];
    return (
        <div className="page">
            <Panel title="Network Graph" subtitle="Case, person, station, court, and legal-section relationships">
                <div className="graph-wrap">
                    <svg viewBox="0 0 100 100" className="graph">
                        {edges.map(([source, target]) => {
                            const s = nodes.find((node) => node.id === source);
                            const t = nodes.find((node) => node.id === target);
                            return <line key={`${source}-${target}`} x1={s.x} y1={s.y} x2={t.x} y2={t.y} />;
                        })}
                        {nodes.map((node) => (
                            <g key={node.id}>
                                <circle cx={node.x} cy={node.y} r={node.size / 5} className={node.type} />
                                <text x={node.x} y={node.y + node.size / 5 + 4} textAnchor="middle">{node.label}</text>
                            </g>
                        ))}
                    </svg>
                    <div className="graph-side">
                        <h3>Explainable link analysis</h3>
                        <p>Links indicate shared records in DataStore and documents, not proof of association. Every edge is traceable to a case, accused, station, court, or legal section record.</p>
                        <div className="detail-grid one">
                            <Info label="Central case" value={selectedCase.crimeNo} />
                            <Info label="Connected accused" value={String(selectedCase.accused.length)} />
                            <Info label="Risk score" value={String(selectedCase.risk)} />
                        </div>
                    </div>
                </div>
            </Panel>
        </div>
    );
}

function Analytics() {
    return (
        <div className="page">
            <section className="two-col">
                <Panel title="Station Performance" subtitle="Resolution and workload comparison">
                    <div className="chart">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={[
                                { station: "Jayanagar", workload: 78, resolved: 62 },
                                { station: "Oza Nagar", workload: 54, resolved: 31 },
                                { station: "Nazarbad", workload: 48, resolved: 39 },
                                { station: "Mangaluru N", workload: 36, resolved: 28 },
                            ]}>
                                <CartesianGrid stroke="#d8dee9" vertical={false} />
                                <XAxis dataKey="station" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="workload" fill="#315fbd" radius={[6, 6, 0, 0]} />
                                <Bar dataKey="resolved" fill="#23a88f" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Panel>
                <Panel title="AI Insight" subtitle="Generated from dashboard metrics">
                    <div className="insight">
                        <strong>Cyber fraud is the fastest rising category.</strong>
                        <p>Bengaluru Urban has the largest absolute volume, while Mysuru shows the strongest acceleration. Recommendation: prioritize wallet-handler linkage, bank freeze follow-up, and device-forensics queue review.</p>
                        <div className="citation-row">
                            <span>CaseMaster.CrimeRegisteredDate</span>
                            <span>CrimeHead.CrimeGroupName</span>
                            <span>Unit.DistrictID</span>
                        </div>
                    </div>
                </Panel>
            </section>
        </div>
    );
}

function Chat({ messages, query, setQuery, sendMessage }) {
    const suggestions = [
        "Summarize FIR 400170118202400001",
        "Show repeat offenders in Bengaluru Urban",
        "Which bonds expire in the next 30 days?",
    ];
    return (
        <div className="page chat-page">
            <Panel title="Kavach AI Assistant" subtitle="Evidence-grounded SQL, RAG, analytics, and alert reasoning">
                <div className="chat-box">
                    <div className="messages">
                        {messages.map((message, index) => (
                            <div key={index} className={`message ${message.role}`}>
                                <p>{message.text}</p>
                                {message.citations && (
                                    <div className="citation-row">
                                        {message.citations.map((item) => <span key={item}>{item}</span>)}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="suggestions">
                        {suggestions.map((item) => <button key={item} onClick={() => sendMessage(item)}>{item}</button>)}
                    </div>
                    <div className="composer">
                        <textarea value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ask about a case, person, trend, document, or alert" />
                        <button className="primary" onClick={() => sendMessage()}>Send</button>
                    </div>
                </div>
            </Panel>
        </div>
    );
}

function Documents() {
    return (
        <div className="page">
            <Panel title="Document and Evidence Center" subtitle="Stratus-backed files with OCR, classification, and RAG indexing">
                <div className="toolbar">
                    <button className="primary">Upload evidence</button>
                    <button>Run OCR queue</button>
                    <button>Rebuild search index</button>
                </div>
                <DataTable
                    columns={["Name", "Type", "Case", "Status", "Owner"]}
                    rows={documents.map((doc) => [doc.name, doc.type, doc.caseId, doc.status, doc.owner])}
                />
            </Panel>
        </div>
    );
}

function Court() {
    return (
        <div className="page">
            <Panel title="Court and Charge Sheet Tracking" subtitle="Court-linked cases, pending charge sheets, and document status">
                <DataTable
                    columns={["CrimeNo", "Court", "Status", "Officer", "Next Action"]}
                    rows={cases.map((item) => [item.crimeNo, item.court, item.status, item.officer, item.status === "Charge Sheet Filed" ? "Monitor hearing" : "Review evidence"])}
                />
            </Panel>
        </div>
    );
}

function Bond() {
    return (
        <div className="page">
            <Panel title="Good Conduct Bond Tracker" subtitle="Expiring, renewed, violated, and high-risk bond records">
                <DataTable
                    columns={["Bond ID", "Accused", "Case", "Station", "Expires", "Status", "Risk"]}
                    rows={bonds.map((bond) => [bond.id, bond.accused, bond.caseId, bond.station, bond.expires, bond.status, bond.risk])}
                />
            </Panel>
        </div>
    );
}

function Admin() {
    return (
        <div className="page">
            <section className="two-col">
                <Panel title="Catalyst Services" subtitle="Production readiness status">
                    <div className="service-grid">
                        {["DataStore", "Functions", "Authentication", "Stratus", "Search", "Cache", "Cron", "QuickML", "API Gateway", "Logs"].map((item) => (
                            <div key={item}><strong>{item}</strong><span>Configured</span></div>
                        ))}
                    </div>
                </Panel>
                <Panel title="Audit Trail" subtitle="Sensitive actions are logged">
                    <AlertList audit />
                </Panel>
            </section>
        </div>
    );
}

function Settings() {
    return (
        <div className="page">
            <Panel title="Settings" subtitle="Role, notification, language, and environment controls">
                <div className="settings-grid">
                    <Info label="Environment" value="Production-like demo" />
                    <Info label="Role" value="Investigator" />
                    <Info label="Data scope" value="Karnataka State Police" />
                    <Info label="AI policy" value="Cited answers only" />
                    <Info label="Mutation policy" value="Officer confirmation required" />
                    <Info label="Default language" value="English" />
                </div>
            </Panel>
        </div>
    );
}

function Inspector({ selectedCase, setPage, sendMessage }) {
    return (
        <aside className="inspector">
            <div className="inspector-head">
                <span>Selected case</span>
                <strong>{selectedCase.crimeNo}</strong>
            </div>
            <RiskBadge score={selectedCase.risk} />
            <p>{selectedCase.summary}</p>
            <div className="inspector-actions">
                <button onClick={() => setPage("cases")}>Open case</button>
                <button onClick={() => setPage("network")}>View graph</button>
                <button onClick={() => sendMessage(`Summarize FIR ${selectedCase.crimeNo}`)}>Ask AI</button>
            </div>
            <h3>Operational checklist</h3>
            <label><input type="checkbox" defaultChecked /> Case records verified</label>
            <label><input type="checkbox" defaultChecked /> Documents indexed</label>
            <label><input type="checkbox" /> Supervisor review pending</label>
            <label><input type="checkbox" /> Court follow-up scheduled</label>
        </aside>
    );
}

function Panel({ title, subtitle, children }) {
    return (
        <section className="panel">
            <div className="panel-head">
                <div>
                    <h2>{title}</h2>
                    <p>{subtitle}</p>
                </div>
            </div>
            {children}
        </section>
    );
}

function CaseTable({ compact = false, onOpen }) {
    return (
        <div className="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>CrimeNo</th>
                        <th>District</th>
                        <th>Category</th>
                        <th>Status</th>
                        <th>Risk</th>
                    </tr>
                </thead>
                <tbody>
                    {cases.map((item) => (
                        <tr key={item.id} onClick={() => onOpen?.(item.id)}>
                            <td><strong>{compact ? item.crimeNo.slice(-9) : item.crimeNo}</strong><span>{item.station}</span></td>
                            <td>{item.district}</td>
                            <td>{item.category}</td>
                            <td><span className="status">{item.status}</span></td>
                            <td><RiskBadge score={item.risk} small /></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function AlertList({ audit = false }) {
    const items = audit
        ? [
            { level: "medium", title: "CASE_VIEW", detail: "Inspector Arjun opened CaseMaster:1001", age: "now" },
            { level: "medium", title: "CHAT_QUERY", detail: "AI assistant answered with 3 citations", age: "4 min" },
            { level: "high", title: "EXPORT_REPORT", detail: "Supervisor exported briefing PDF", age: "22 min" },
        ]
        : alerts;
    return (
        <div className="alert-list">
            {items.map((alert) => (
                <article className={`alert ${alert.level}`} key={alert.title}>
                    <div>
                        <strong>{alert.title}</strong>
                        <span>{alert.detail}</span>
                    </div>
                    <time>{alert.age}</time>
                </article>
            ))}
        </div>
    );
}

function RiskBadge({ score, small = false }) {
    const tone = score >= 85 ? "risk high" : score >= 70 ? "risk medium" : "risk low";
    return <span className={`${tone} ${small ? "small" : ""}`}>{score}</span>;
}

function Info({ label, value }) {
    return (
        <div className="info">
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

function Timeline() {
    return (
        <div className="timeline">
            {["Incident reported", "FIR registered", "Accused examined", "Evidence indexed", "Supervisor review"].map((item, index) => (
                <div key={item}>
                    <i>{index + 1}</i>
                    <span>{item}</span>
                </div>
            ))}
        </div>
    );
}

function DataTable({ columns, rows }) {
    return (
        <div className="table-wrap">
            <table>
                <thead>
                    <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
                </thead>
                <tbody>
                    {rows.map((row, index) => (
                        <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function localAnswer(question) {
    const lower = question.toLowerCase();
    if (lower.includes("400170")) {
        return {
            role: "assistant",
            text:
                "FIR 400170118202400001 is a Kalaburagi murder case registered on 2024-02-07. It has two accused, one recorded victim, pending supervisor review, and a high intelligence risk score of 91.",
            citations: ["CaseMaster: 1001", "Accused: Qasim Sarraf", "Victim: Ravindra Patil"],
        };
    }
    if (lower.includes("bond")) {
        return {
            role: "assistant",
            text:
                "Two high-risk bond records expire within 30 days: Sameer Khan from Nazarbad PS and Qasim Sarraf from Oza Nagar PS. Both should be reviewed before field follow-up.",
            citations: ["BondRecord", "Accused", "CaseMaster"],
        };
    }
    if (lower.includes("repeat")) {
        return {
            role: "assistant",
            text:
                "The strongest repeat-offender signal is the Bengaluru Urban cyber-fraud cluster. The graph should be treated as an investigative lead, not proof of association.",
            citations: ["Accused", "CaseMaster", "CrimeHead"],
        };
    }
    return {
        role: "assistant",
        text:
            "I can answer this by combining case records, person records, legal sections, bond history, documents, and analytics. Please include an FIR number, person name, station, or time window for a more precise answer.",
        citations: ["CaseMaster", "Search index", "AuditLog"],
    };
}

createRoot(document.getElementById("root")).render(<App />);
