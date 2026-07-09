import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import "./styles.css";

const trend = [
  { month: "Jan", cases: 114, solved: 82 }, { month: "Feb", cases: 128, solved: 88 },
  { month: "Mar", cases: 119, solved: 91 }, { month: "Apr", cases: 151, solved: 96 },
  { month: "May", cases: 144, solved: 108 }, { month: "Jun", cases: 173, solved: 118 },
  { month: "Jul", cases: 162, solved: 121 }, { month: "Aug", cases: 188, solved: 132 }
];

const copy = {
  en: {
    greeting: "Good evening, Inspector",
    subtitle: "Here is the current operational picture across Karnataka.",
    ask: "Ask Kavach about any FIR, person, location, pattern, or trend…",
    title: "Intelligence workspace",
    chatTitle: "Ask Kavach",
    status: "Live intelligence",
    suggestions: ["Show repeat offenders in Bengaluru", "Which districts show rising cybercrime?", "Summarise FIR 400170118202400001"],
    nav: ["Overview", "Crime map", "Networks", "Cases", "Alerts"],
    export: "Export briefing",
  },
  kn: {
    greeting: "ಶುಭ ಸಂಜೆ, ಇನ್ಸ್‌ಪೆಕ್ಟರ್",
    subtitle: "ಕರ್ನಾಟಕದ ಪ್ರಸ್ತುತ ಕಾರ್ಯಾಚರಣೆಯ ಚಿತ್ರಣ ಇಲ್ಲಿದೆ.",
    ask: "ಯಾವುದೇ ಎಫ್‌ಐಆರ್, ವ್ಯಕ್ತಿ, ಸ್ಥಳ ಅಥವಾ ಅಪರಾಧ ಪ್ರವೃತ್ತಿಯ ಬಗ್ಗೆ ಕೇಳಿ…",
    title: "ಗುಪ್ತಚರ ಕಾರ್ಯಕ್ಷೇತ್ರ",
    chatTitle: "ಕವಚವನ್ನು ಕೇಳಿ",
    status: "ನೇರ ಗುಪ್ತಚರ",
    suggestions: ["ಬೆಂಗಳೂರಿನ ಪುನರಾವರ್ತಿತ ಅಪರಾಧಿಗಳನ್ನು ತೋರಿಸಿ", "ಸೈಬರ್ ಅಪರಾಧ ಹೆಚ್ಚುತ್ತಿರುವ ಜಿಲ್ಲೆಗಳು ಯಾವುವು?", "ಎಫ್‌ಐಆರ್ 400170118202400001 ಸಾರಾಂಶ ನೀಡಿ"],
    nav: ["ಅವಲೋಕನ", "ಅಪರಾಧ ನಕ್ಷೆ", "ಜಾಲಗಳು", "ಪ್ರಕರಣಗಳು", "ಎಚ್ಚರಿಕೆಗಳು"],
    export: "ವರದಿ ರಫ್ತು",
  }
};

const responses = {
  repeat: {
    en: "I found 18 accused linked to two or more cases. The strongest cluster contains 6 people connected through 9 FIRs across Bengaluru Urban and Bengaluru Rural. Three share the same police-station and offence pattern. Treat this as an investigative lead—not proof of association.",
    kn: "ಎರಡು ಅಥವಾ ಹೆಚ್ಚು ಪ್ರಕರಣಗಳಿಗೆ ಸಂಬಂಧಿಸಿದ 18 ಆರೋಪಿಗಳನ್ನು ಕಂಡುಹಿಡಿದಿದ್ದೇನೆ. ಬೆಂಗಳೂರು ನಗರ ಮತ್ತು ಗ್ರಾಮಾಂತರದ 9 ಎಫ್‌ಐಆರ್‌ಗಳ ಮೂಲಕ 6 ಜನರ ಪ್ರಮುಖ ಗುಂಪು ಸಂಪರ್ಕಗೊಂಡಿದೆ. ಇದು ತನಿಖಾ ಸುಳಿವು ಮಾತ್ರ—ಸಂಬಂಧದ ಪುರಾವೆಯಲ್ಲ.",
    cites: ["Accused · PersonID / CaseMasterID", "CaseMaster · PoliceStationID", "CrimeSubHead · CrimeHeadName"]
  },
  cyber: {
    en: "Cybercrime shows the clearest recent increase in Bengaluru Urban (+22%), Mysuru (+14%), and Dakshina Kannada (+11%). Bengaluru also has the largest absolute volume. The comparison uses registered cases from the last 90 days against the preceding 90-day period.",
    kn: "ಬೆಂಗಳೂರು ನಗರ (+22%), ಮೈಸೂರು (+14%) ಮತ್ತು ದಕ್ಷಿಣ ಕನ್ನಡ (+11%) ಜಿಲ್ಲೆಗಳಲ್ಲಿ ಸೈಬರ್ ಅಪರಾಧದ ಏರಿಕೆ ಸ್ಪಷ್ಟವಾಗಿದೆ. ಹೋಲಿಕೆಯು ಕಳೆದ 90 ದಿನಗಳನ್ನು ಹಿಂದಿನ 90 ದಿನಗಳೊಂದಿಗೆ ಪರಿಗಣಿಸುತ್ತದೆ.",
    cites: ["CaseMaster · CrimeRegisteredDate", "Unit · DistrictID", "CrimeHead · CrimeGroupName"]
  },
  fir: {
    en: "FIR 400170118202400001 was registered on 7 February 2024. The incident occurred near Oza Nagar, Kalaburagi, between 3–5 February. Two accused are recorded: Qasim Sarraf and Nilima Tara. The case is currently under investigation; scene documentation and witness statements are noted.",
    kn: "ಎಫ್‌ಐಆರ್ 400170118202400001 ಅನ್ನು 7 ಫೆಬ್ರವರಿ 2024 ರಂದು ದಾಖಲಿಸಲಾಗಿದೆ. ಘಟನೆ ಕಲಬುರಗಿಯ ಓಜಾ ನಗರ ಬಳಿ 3–5 ಫೆಬ್ರವರಿ ನಡುವೆ ನಡೆದಿದೆ. ಖಾಸಿಮ್ ಸರ್ರಾಫ್ ಮತ್ತು ನಿಲಿಮಾ ತಾರಾ ಆರೋಪಿಗಳಾಗಿ ದಾಖಲಾಗಿದ್ದಾರೆ. ಪ್ರಕರಣ ತನಿಖೆಯಲ್ಲಿದೆ.",
    cites: ["CaseMaster · ROWID 1", "Accused · ROWID 1–2", "CaseStatusMaster · CaseStatusID 1"]
  }
};

function Icon({ name }) {
  const icons = { Overview:"⌂", "Crime map":"⌖", Networks:"⌘", Cases:"▤", Alerts:"△" };
  return <span className="nav-icon">{icons[name] || "•"}</span>;
}

function App() {
  const [lang, setLang] = useState("en");
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const t = copy[lang];
  const kpis = useMemo(() => [
    ["1,284", lang === "en" ? "Active cases" : "ಸಕ್ರಿಯ ಪ್ರಕರಣಗಳು", "+8.2%"],
    ["73.6%", lang === "en" ? "Resolution rate" : "ಪರಿಹಾರ ದರ", "+4.1%"],
    ["142", lang === "en" ? "High-risk persons" : "ಹೆಚ್ಚಿನ ಅಪಾಯದ ವ್ಯಕ್ತಿಗಳು", "12 new"],
    ["08", lang === "en" ? "Priority alerts" : "ಆದ್ಯತೆಯ ಎಚ್ಚರಿಕೆಗಳು", "3 urgent"],
  ], [lang]);

  async function send(text = query) {
    if (!text.trim()) return;
    setMessages(m => [...m, { role: "user", text }]);
    setQuery("");
    setBusy(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE || "/server/chat-functions"}/chat/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, language: lang, conversationId: conversationId || undefined })
      });
      if (!response.ok) throw new Error("Backend unavailable");
      const data = await response.json();
      setConversationId(data.conversationId);
      setMessages(m => [...m, { role: "assistant", en: data.answer, kn: data.answer, cites: data.citations.map(c => `${c.table} · ${c.label}`) }]);
      return;
    } catch {
      // The demo remains usable when running the frontend without Catalyst serve.
    } finally {
      setBusy(false);
    }
    const low = text.toLowerCase();
    const key = low.includes("400170") || low.includes("ಸಾರಾಂಶ") ? "fir" : low.includes("cyber") || low.includes("ಸೈಬರ್") ? "cyber" : "repeat";
    setMessages(m => [...m, { role: "assistant", ...responses[key] }]);
  }

  async function exportPdf() {
    if (!conversationId) return window.print();
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE || "/server/chat-functions"}/chat/export-pdf`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId })
      });
      if (!response.ok) throw new Error();
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url; link.download = `kavach-${conversationId}.pdf`; link.click();
      URL.revokeObjectURL(url);
    } catch { window.print(); }
  }

  function voice() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return alert("Speech recognition is not available in this browser.");
    const r = new Recognition();
    r.lang = lang === "kn" ? "kn-IN" : "en-IN";
    r.onstart = () => setListening(true);
    r.onend = () => setListening(false);
    r.onresult = e => setQuery(e.results[0][0].transcript);
    r.start();
  }

  return <div className="app">
    <aside>
      <div className="brand"><div className="crest">ಕ</div><div><b>KAVACH</b><small>Karnataka State Police</small></div></div>
      <div className="section-label">WORKSPACE</div>
      <nav>{t.nav.map((n,i) => <button className={i===0 ? "active" : ""} key={n}><Icon name={copy.en.nav[i]}/>{n}{i===4 && <em>8</em>}</button>)}</nav>
      <div className="section-label">INTELLIGENCE</div>
      <nav><button><Icon name="Networks"/>{lang==="en"?"Offender profiles":"ಅಪರಾಧಿ ವಿವರ"}</button><button><Icon name="Crime map"/>{lang==="en"?"Trend analysis":"ಪ್ರವೃತ್ತಿ ವಿಶ್ಲೇಷಣೆ"}</button></nav>
      <div className="user"><div className="avatar">AR</div><div><b>Arjun Rao</b><small>Crime Branch · Analyst</small></div><span>•••</span></div>
    </aside>

    <main>
      <header><div><div className="eyebrow"><span></span>{t.status}</div><h1>{t.title}</h1></div><div className="head-actions"><button className="language" onClick={() => setLang(lang==="en"?"kn":"en")}>{lang==="en" ? "ಕನ್ನಡ" : "English"}</button><button className="icon-btn">⌕</button><button className="icon-btn bell">♢<i>3</i></button></div></header>
      <section className="welcome"><div><h2>{t.greeting}</h2><p>{t.subtitle}</p></div><button className="export" onClick={exportPdf}>⇩ {t.export}</button></section>

      <section className="kpis">{kpis.map((x,i) => <article key={x[1]}><div className={`metric-icon m${i}`}>{["▤","✓","◎","△"][i]}</div><div><small>{x[1]}</small><strong>{x[0]}</strong><span className={i===3?"warn":""}>{x[2]}</span></div></article>)}</section>

      <section className="grid">
        <article className="panel trend"><div className="panel-head"><div><h3>Crime trend</h3><p>Registered vs. resolved · last 8 months</p></div><button>All Karnataka⌄</button></div>
          <div className="chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trend}><defs><linearGradient id="cases" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7869e6" stopOpacity=".35"/><stop offset="1" stopColor="#7869e6" stopOpacity="0"/></linearGradient></defs><CartesianGrid stroke="#202b3d" vertical={false}/><XAxis dataKey="month" stroke="#69768c" axisLine={false} tickLine={false}/><YAxis stroke="#69768c" axisLine={false} tickLine={false}/><Tooltip contentStyle={{background:"#101a29",border:"1px solid #29364a",borderRadius:8}}/><Area type="monotone" dataKey="cases" stroke="#8d80f5" fill="url(#cases)" strokeWidth={2}/><Area type="monotone" dataKey="solved" stroke="#2dd4a0" fill="transparent" strokeWidth={2}/></AreaChart></ResponsiveContainer></div>
        </article>
        <article className="panel hotspot"><div className="panel-head"><div><h3>Hotspot watch</h3><p>Risk signals · next 7 days</p></div><button>View map ↗</button></div><div className="map">
          <div className="roads"></div><span className="heat h1"></span><span className="heat h2"></span><span className="heat h3"></span><span className="pin p1">12</span><span className="pin p2">8</span><span className="pin p3">5</span><label className="bl">BENGALURU</label><label className="my">MYSURU</label><label className="tu">TUMAKURU</label>
        </div><div className="map-footer"><span><i className="critical"></i>Critical</span><span><i className="elevated"></i>Elevated</span><b>Updated 4 min ago</b></div></article>
      </section>

      <section className="lower">
        <article className="panel alerts"><div className="panel-head"><div><h3>Priority alerts</h3><p>Signals requiring review</p></div><button>View all 8 →</button></div>
          {[["critical","Repeat-offender cluster detected","6 linked persons · Bengaluru Urban","2 min"],["high","Burglary pattern escalation","Jayanagar & JP Nagar · +31%","18 min"],["medium","Bond expiry approaching","14 high-risk bonds · within 30 days","1 hr"]].map(a=><div className="alert-row" key={a[1]}><span className={a[0]}>△</span><div><b>{a[1]}</b><small>{a[2]}</small></div><time>{a[3]}</time></div>)}
        </article>
        <article className="panel network"><div className="panel-head"><div><h3>Active network</h3><p>Most connected persons · 30 days</p></div><button>Explore graph ↗</button></div><div className="network-viz"><svg viewBox="0 0 500 170"><g stroke="#46536a" strokeWidth="1">{[[250,80,105,35],[250,80,398,40],[250,80,130,130],[250,80,382,132],[250,80,310,142],[105,35,48,86],[398,40,458,92]].map((l,i)=><line key={i} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]}/>)}</g>{[[250,80,25,"QR"],[105,35,15,"NS"],[398,40,15,"SK"],[130,130,13,"AM"],[382,132,13,"VG"],[310,142,10,""],[48,86,10,""],[458,92,10,""]].map((n,i)=><g key={i}><circle cx={n[0]} cy={n[1]} r={n[2]} fill={i===0?"#695ce0":"#24334a"} stroke={i===0?"#b4aafa":"#51627b"}/><text x={n[0]} y={n[1]+4} textAnchor="middle" fill="white" fontSize={i===0?11:8}>{n[3]}</text></g>)}</svg><div className="network-caption"><b>Qasim Sarraf</b><span>9 cases · 14 connections</span></div></div></article>
      </section>
    </main>

    <aside className="chat">
      <div className="chat-head"><div className="ai-logo">✦</div><div><h3>{t.chatTitle}</h3><span><i></i>{busy ? "Analysing records…" : "Evidence-grounded AI"}</span></div><button onClick={() => { setMessages([]); setConversationId(""); }}>＋</button></div>
      <div className="chat-body">
        {messages.length===0 && <div className="empty"><div className="orb">✦</div><h3>{lang==="en"?"What would you like to investigate?":"ನೀವು ಏನನ್ನು ತನಿಖೆ ಮಾಡಲು ಬಯಸುತ್ತೀರಿ?"}</h3><p>{lang==="en"?"I can search records, connect entities, analyse patterns, and cite every finding.":"ನಾನು ದಾಖಲೆಗಳನ್ನು ಹುಡುಕಿ, ಸಂಬಂಧಗಳನ್ನು ವಿಶ್ಲೇಷಿಸಿ, ಪ್ರತಿಯೊಂದು ಫಲಿತಾಂಶಕ್ಕೂ ಆಧಾರ ನೀಡುತ್ತೇನೆ."}</p><div className="suggestions">{t.suggestions.map(s=><button key={s} onClick={()=>send(s)}>{s}<span>↗</span></button>)}</div></div>}
        {messages.map((m,i)=><div className={`message ${m.role}`} key={i}>{m.role==="assistant"&&<span className="mini-ai">✦</span>}<div><p>{m.role==="assistant"?m[lang]:m.text}</p>{m.cites&&<div className="citations">{m.cites.map((c,j)=><button key={c}>[{j+1}] {c}</button>)}</div>}</div></div>)}
      </div>
      <div className="composer"><textarea disabled={busy} value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}}} placeholder={t.ask}/><div><button className={listening?"listening":""} onClick={voice}>◉</button><small>↵ to send</small><button disabled={busy} className="send" onClick={()=>send()}>↑</button></div><p>✦ Responses include source citations and confidence. Verify before action.</p></div>
    </aside>
  </div>
}

createRoot(document.getElementById("root")).render(<App />);
