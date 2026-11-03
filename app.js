/* Plan B app: polls JSON files under d/{DATA_PATH}/. Every FOMO URL comes from the JSON (links.py). */
(function () {
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const POLL = 15000, $ = s => document.querySelector(s), V = $("#view");
  const hp = new URLSearchParams(location.hash.slice(1));
  if (hp.get("d")) { localStorage.setItem("desk_d", hp.get("d")); hp.delete("d"); history.replaceState(null, "", location.pathname + location.search + (hp.toString() ? "#" + hp : "")); }
  const DP = localStorage.getItem("desk_d");
  const S = { state: null, chart: null, activity: null, coin: {}, last: 0, fail: 0, range: "LIVE", tab: hp.get("tab") || "home", sub: null };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const usd = v => v == null ? "n/a" : (v < 0 ? "-" : "") + "$" + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const big = v => v == null ? "n/a" : v >= 1e6 ? "$" + (v / 1e6).toFixed(2) + "M" : v >= 1e3 ? "$" + (v / 1e3).toFixed(1) + "K" : "$" + v.toFixed(0);
  const tm = ts => new Date(ts * 1000).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
  const shortM = m => m ? m.slice(0, 4) + "…" + m.slice(-4) : "";
  const AG = { scanner: ["Scanner", "#64d2ff"], auditor: ["Auditor", "#fff"], analyst: ["Analyst", "#ffd60a"], executor: ["Executor", "#00d35a"], risk: ["Risk", "#ff6b9a"] };
  async function getj(p) { const r = await fetch(`d/${DP}/${p}?_=${Date.now()}`, { cache: "no-store" }); if (!r.ok) throw new Error(r.status); return r.json(); }
  async function poll() {
    if (!DP) { render(); return; }
    try {
      const [st, ch, ac] = await Promise.all([getj("state.json"), getj("chart.json"), getj("activity.json")]);
      S.state = st; S.chart = ch; S.activity = ac; S.fail = 0; S.last = st.ts;
      if (S.sub && S.sub.mint) { try { S.coin[S.sub.mint] = await getj(`coin/${S.sub.mint}.json`); } catch (e) { } }
    } catch (e) { S.fail++; }
    render(); setTimeout(poll, POLL);
  }
  let errT;
  function errRow() {
    const el = $("#err"); clearInterval(errT);
    const stale = S.last && Date.now() / 1000 - S.last > 600;
    if (!S.fail && !stale) { el.hidden = true; return; }
    let n = 15; const f = () => { el.hidden = false; el.textContent = `Desk offline · retrying in ${n}s · last update ${S.last ? tm(S.last) : "never"}`; if (n > 0) n--; };
    f(); errT = setInterval(f, 1000);
  }
  // odometer: each changed digit rolls 600ms ease-out, 30ms stagger right to left
  function odo(el, text) {
    const old = el.dataset.v || ""; el.dataset.v = text;
    if (RM || old.length !== text.length || !old) { el.innerHTML = [...text].map(c => /\d/.test(c) ? `<span class="d"><span style="transform:translateY(-${c}em)">${[...Array(10).keys()].map(i => `<b>${i}</b>`).join("")}</span></span>` : `<span>${c}</span>`).join(""); return; }
    const ds = el.querySelectorAll(".d > span"); let k = 0, idx = [...text].map((c, i) => /\d/.test(c) ? i : -1).filter(i => i >= 0);
    idx.reverse().forEach((i, j) => { const sp = ds[idx.length - 1 - j]; if (old[i] !== text[i]) { sp.style.transitionDelay = (k++ * 30) + "ms"; sp.style.transform = `translateY(-${text[i]}em)`; } });
  }
  function nav(title) {
    const unread = +(localStorage.getItem("desk_unread") || 0);
    return `<div class="nav"><button class="av" data-go="account" aria-label="Account"><i>G</i></button><div class="ttl">${esc(title)}</div>
      <button class="ib" data-act="search" aria-label="Search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg></button>
      <button class="ib" data-go="activity" aria-label="Notifications"><svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0"/></svg>${unread ? '<span class="dot"></span>' : ""}</button></div>`;
  }
  const sk = (h, m = "0 16px 12px") => `<div class="sk" style="height:${h}px;margin:${m}"></div>`;
  function actRow(r) {
    const ic = { bought: ["#0a84ff", "↗"], sold: ["#00d35a", "$"], stopped: ["#ff453a", "↓"], rejected: ["#2c2c2e", "×"] }[r.kind] || ["#2c2c2e", "•"];
    const cls = r.kind === "sold" ? "up" : r.kind === "stopped" ? "dn" : r.kind === "rejected" ? "mut" : "";
    return `<button class="row" style="width:100%;text-align:left" data-${r.kind === "rejected" ? "audit" : "coin"}="${esc(r.mint)}"><div class="ic" style="background:${ic[0]}">${ic[1]}</div>
      <div class="tx"><b>${esc(r.title)}</b><small>${esc(r.subtitle)}</small></div><div class="rv ${cls}">${esc(r.value)}</div></button>`;
  }
  function agentCard(a, st) {
    const c = st.agents[a], [nm, col] = AG[a], run = c.running ? "running" : c.paused ? "paused" : "offline";
    let body = "";
    if (a === "scanner") {
      body = `<div class="kpi">${c.pools} pools</div><div class="sub">Tonight</div><div class="feed">${c.feed.length ? c.feed.map(f => f.verdict === "kill" ? `<div class="k">${esc(f.name)}<i>${esc(f.reason)}</i></div>` : f.verdict === "pass" ? `<div>${esc(f.name)} <span class="up">→ auditor</span></div>` : `<div class="mut">${esc(f.name)} · ${esc(f.verdict)}</div>`).join("") : '<div class="mut">Listening for graduations</div>'}</div>`;
    } else if (a === "auditor") {
      const L = (c.last && c.last.layers) || [], red = L.find(l => l.pass === false);
      body = `<div class="kpi">${c.taken} taken apart</div><div class="strips">${[1, 2, 3, 4, 5, 6, 7, 8].map(i => { const l = L.find(x => x.n === i); return `<div class="${l ? (l.pass ? "ok" : l.pass === false ? "no" : "") : ""}">L${i}</div>`; }).join("")}</div>
        <div class="sub">${c.last ? (red ? esc(c.last.name + " · " + red.value) : L.length === 8 ? "8/8 → Executor" : "taking apart...") : "No coin taken apart yet"}</div><div class="sub" style="margin-top:auto">${c.rejected} rejected</div>`;
    } else if (a === "analyst") {
      body = `<div class="kpi">Scoring</div><canvas class="ring" data-ring="${c.score == null ? "" : c.score}"></canvas><div class="sub" style="text-align:center;margin-top:8px">${c.last ? esc(c.last.name + " · " + (c.last.pass ? "pass" : c.last.reason)) : "Nothing scored yet"}</div>`;
    } else if (a === "executor") {
      body = `<div class="kpi">${c.trades} trades</div><div class="sub">${usd(c.ticket)} · ${c.stack_pct}% of stack</div><div class="bar"><i style="width:0%"></i></div><div class="sub" style="margin-top:8px">${c.trades ? "✓ Filled" : "Waiting for a signal"}</div>`;
    } else {
      body = `<div class="kpi">Guarding</div><div class="sub">${c.open} open · ${c.last_exit ? (c.last_exit.includes("trail") ? "Trailed out" : c.last_exit.includes("stop") ? "Stopped" : esc(c.last_exit)) : "No exits yet"}</div><div style="margin-top:auto"><span class="tp r">stop -${c.stop_pct}%</span><span class="tp g">trail ${c.trail_pct}%</span></div>`;
    }
    return `<div class="card"><div class="hd"><span class="sw" style="background:${col}"></span>${nm}<span class="st">${run}</span></div>${body}</div>`;
  }
  function rangePts(pts) {
    const now = Date.now() / 1000, w = { LIVE: 1800, "1H": 3600, "4H": 14400, "1D": 86400, "1W": 604800, ALL: 1e12 }[S.range];
    return pts.filter(p => p[0] >= now - w);
  }
  function home() {
    const st = S.state;
    if (!st) return nav("Grok Bot ›") + sk(80) + sk(230) + sk(300);
    const up = st.today_pct >= 0, nrun = Object.values(st.agents).filter(a => a.running).length;
    const rows = (S.activity.rows || []).slice(0, 5), pts = rangePts(S.chart.points || []);
    const trades = (S.chart.marks || []).length;
    return nav("Grok Bot ›") + `<div class="bal"><span class="odo" id="odo"></span>${st.mode === "PAPER" ? '<span class="pill paper">PAPER</span>' : ""}</div>
      <div class="chg"><span class="${up ? "up" : "dn"}">${up ? "+" : ""}${st.today_pct.toFixed(2)}%</span> <span class="mut">today</span> <span class="pill mult">${st.multiplier.toFixed(2)}×</span></div>
      <div class="chart"><canvas id="line"></canvas>${trades ? "" : '<div class="emp">Waiting for the first trade</div>'}</div>
      <div class="ranges">${["LIVE", "1H", "4H", "1D", "1W", "ALL"].map(r => `<button data-range="${r}" class="${r === S.range ? "on" : ""}">${r}</button>`).join("")}</div>
      <div class="sec"><h2>Agents · ${nrun} running</h2></div><div class="car">${Object.keys(AG).map(a => agentCard(a, st)).join("")}</div>
      <div class="sec"><h2>Activity</h2><button data-go="activity">See all</button></div>
      <div class="list">${rows.length ? rows.map(actRow).join("") : '<div class="empty">Nothing yet tonight</div>'}</div>`;
  }
  function agents() {
    const st = S.state; if (!st) return `<h1 class="big">Agents</h1>` + sk(260) + sk(260);
    return `<h1 class="big">Agents</h1>` + Object.keys(AG).map(a => {
      const c = st.agents[a], [nm, col] = AG[a], count = { scanner: c.pools, auditor: c.taken, analyst: (c.decisions || []).length, executor: c.trades, risk: c.open }[a];
      const lock = a === "risk" && c.open > 0;
      return `<div class="acard"><div class="hd"><span class="sdot ${c.running ? "" : "off"}"></span><b style="color:${a === "auditor" ? "#fff" : col}">${nm}</b><span class="cnt">${count} today</span>
        <button class="tgw" data-tg="${a}" aria-label="pause/resume ${nm}"><span class="tog ${c.paused ? "" : "on"} ${lock ? "lock" : ""}"></span></button></div>
        <div class="dec">${(c.decisions || []).length ? c.decisions.map(d => `<div><span class="mut">${tm(d.ts)}</span><a href="${esc(d.url)}" target="_blank" rel="noopener">${esc(d.name)}</a><span class="v">${esc(d.verdict)} · ${esc(d.reason || "")}</span></div>`).join("") : '<div style="display:block" class="mut">' + (a === "scanner" ? "Listening for graduations" : "No decisions yet tonight") + "</div>"}</div>
        <button class="lnk" data-go="account" data-grp="${a}">Settings</button></div>`;
    }).join("") + `<p class="note">Pause and resume go through Telegram in this setup: send "pause ${"<agent>"}" or "resume ${"<agent>"}" to the bot.</p>`;
  }
  function activity() {
    if (!S.activity) return `<h1 class="big">Activity</h1>` + sk(400);
    const rows = S.activity.rows || [];
    return `<h1 class="big">Activity</h1><div class="list">${rows.length ? rows.map(actRow).join("") : '<div class="empty">Nothing yet tonight</div>'}</div>`;
  }
  const GROUPS = ["scanner", "auditor", "analyst", "executor", "risk", "desk"];
  function account() {
    const st = S.state; if (!st) return `<h1 class="big">Account</h1>` + sk(120) + sk(300);
    const set = st.settings, A = st.account;
    return `<h1 class="big">Account</h1>
      <div class="list plain">
        <div class="row"><div class="tx"><b>Mode</b><small>Change with "paper" / "live" in Telegram</small></div><div class="seg"><span class="${st.mode === "PAPER" ? "on" : ""}">PAPER</span><span class="${st.mode === "LIVE" ? "on" : ""}">LIVE</span></div></div>
        <div class="row"><div class="tx"><b>Stack</b><small>"stack N" in Telegram</small></div><div class="rv">${usd(st.stack)}</div></div>
        <a class="row" href="${esc(A.profile_url)}" target="_blank" rel="noopener"><div class="tx"><b>Your FOMO profile</b><small>@${esc(A.fomo_handle)}</small></div><span class="chev">›</span></a>
        <button class="row" style="width:100%;text-align:left" data-share="${esc(A.signup_url)}"><div class="tx"><b>Invite a friend</b><small id="shr">Share your FOMO invite</small></div><span class="chev">›</span></button>
        <div class="row"><div class="tx"><b>Telegram</b><small>${st.telegram ? "Connected" : "Not connected"} · send "test" to the bot for a test push</small></div></div>
        <div class="row"><div class="tx"><b>Notifications</b><small>Telegram only. This app is hosted without a server (plan B), so it has no web push.</small></div></div>
      </div>
      <p class="note">Settings are read-only here. Change any of them in Telegram: "set &lt;setting&gt; to &lt;value&gt;", e.g. "set stop to 7".</p>
      ${GROUPS.map(g => `<div class="grp" id="g-${g}">${g[0].toUpperCase() + g.slice(1)}</div><div class="list plain">${Object.keys(set).filter(k => k.startsWith(g + ".")).map(k => setRow(k, set[k])).join("")}</div>`).join("")}`;
  }
  function setRow(k, v) {
    const lab = k.split(".")[1].replace(/_/g, " ");
    if (typeof v === "number") return `<div class="set ro"><div><label>${esc(lab)}</label><div class="k">${esc(k)}</div></div><input type="number" value="${v}" disabled><input type="range" value="${v}" min="0" max="${Math.max(1, v * 2)}" step="any" disabled></div>`;
    return `<div class="set ro"><div><label>${esc(lab)}</label><div class="k">${esc(k)}</div></div><input type="text" value="${esc(v)}" disabled></div>`;
  }
  function coinScreen(m) {
    const c = S.coin[m]; if (!c) return `<button class="back" data-back>‹ Back</button>` + sk(60) + sk(260) + sk(120);
    const pos = c.position, age = c.migrated_at ? Math.floor((Date.now() / 1000 - c.migrated_at) / 3600) : null;
    const L = (c.audit && c.audit.layers) || [], passed = L.filter(l => l.pass).length;
    const since = pos && c.price ? (c.price / pos.entry - 1) * 100 : null;
    return `<div class="nav"><button class="back" data-back>‹</button><div class="ttl">${esc(c.name)} ${S.state && S.state.mode === "PAPER" ? '<span class="pill paper">PAPER</span>' : ""}</div></div>
      <div class="pad"><div class="mut">${esc(c.symbol || "")} · Solana${age != null ? " · " + age + "h old" : ""} <span class="chip">🛡 ${passed}/8</span></div></div>
      <div class="price">${c.price == null ? "n/a" : "$" + c.price.toPrecision(4)}</div>
      ${since != null ? `<div class="chg ${since >= 0 ? "up" : "dn"}">${since >= 0 ? "▲" : "▼"} ${Math.abs(since).toFixed(2)}% since entry</div>` : ""}
      <div class="chart" style="height:240px"><canvas id="cnd"></canvas></div>
      <div class="stats"><div><small>Market cap</small><b>n/a</b></div><div><small>Liquidity</small><b>n/a</b></div><div><small>24h volume</small><b>n/a</b></div><div><small>Holders</small><b>${c.holders == null ? "n/a" : c.holders}</b></div></div>
      ${pos ? `<div class="list plain"><div class="row"><div class="tx"><b>Your position · ${usd(pos.size)} in · Executor</b><small>Stop $${pos.stop.toPrecision(4)} · ${pos.trail ? "trailing" : "trail not active"} · timeout ${tm(pos.timeout_at)}</small></div></div></div>` : ""}
      <button class="lnk pad" data-audit="${esc(m)}">Auditor screen ›</button>
      <a class="cta" href="${esc(c.coin_url)}" target="_blank" rel="noopener">${pos ? "Sell on FOMO" : "Buy on FOMO"}</a>`;
  }
  function auditScreen(m) {
    const c = S.coin[m]; if (!c) return `<button class="back" data-back>‹ Back</button>` + sk(300);
    const L = c.audit.layers || [], red = L.find(l => l.pass === false), on = S.state ? S.state.settings["auditor.enabled"] : true;
    return `<div class="nav"><button class="back" data-back>‹</button><div class="ttl">${esc(c.name)} · Auditor</div></div>
      ${L.length ? `<div class="discs" id="discs">${[1, 2, 3, 4, 5, 6, 7, 8].map(i => `<div class="disc" data-n="${i}"></div>`).join("")}<div class="beam" id="beam" style="top:0"></div></div>
      <div class="list plain">${L.map(l => `<div class="lay"><span class="n">${l.n}</span><span class="nm">${esc(l.name)}</span><span class="vv">${esc(l.value)}</span><span>${l.pass ? '<span class="up">✓</span>' : l.pass === false ? '<span class="dn">✕</span>' : "·"}</span></div>`).join("")}</div>
      <div class="pad" style="margin-top:14px">${red ? `<b>Rejected · ${esc(red.value)}</b><div class="mut">Grok Bot won't buy ${esc(c.name)}</div>` : L.length === 8 ? `<b>Cleared · 8/8 parts</b><div class="mut">Sent to Executor</div>` : ""}</div>` : '<div class="empty">No coin taken apart yet</div>'}
      <div class="list plain" style="margin-top:14px"><div class="row"><div class="tx"><b>Take apart before buying</b><small>Read-only here · change in Telegram</small></div><span class="tog ${on ? "on" : ""} lock"></span></div></div>
      <a class="cta" href="${esc(c.coin_url)}" target="_blank" rel="noopener">Open on FOMO</a>`;
  }
  function beam() {
    const c = S.coin[S.sub.mint]; if (!c) return; const L = c.audit.layers, ds = document.querySelectorAll(".disc"), b = $("#beam"); if (!b) return;
    if (RM) { L.forEach(l => ds[l.n - 1] && ds[l.n - 1].classList.add(l.pass ? "ok" : l.pass === false ? "no" : "x")); b.remove(); return; }
    let i = 0; const step = () => { if (i >= L.length) { b.style.opacity = 0; return; } const d = ds[L[i].n - 1]; b.style.top = (d.offsetTop + 13) + "px";
      const l = L[i]; setTimeout(() => { d.classList.add(l.pass ? "ok" : l.pass === false ? "no" : "x"); i++; setTimeout(step, 0); }, 350 + 150); };
    step();
  }
  let lastKey = "";
  function render() {
    errRow();
    document.querySelectorAll(".tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === S.tab && !S.sub));
    if (!DP) { V.innerHTML = `<h1 class="big">Desk</h1><p class="note">Open this app once with the link that ends in #d=… so it knows where your desk data lives.</p>`; return; }
    const key = JSON.stringify([S.tab, S.sub, S.range, S.state && S.state.ts, !!(S.sub && S.coin[S.sub.mint])]);
    if (key === lastKey) return; lastKey = key;
    const y = scrollY;
    V.innerHTML = S.sub ? (S.sub.kind === "coin" ? coinScreen(S.sub.mint) : auditScreen(S.sub.mint)) : { home, agents, activity, account }[S.tab]();
    scrollTo(0, y);
    if (S.state && !S.sub && S.tab === "home") { odo($("#odo"), usd(S.state.balance)); Charts.line($("#line"), rangePts(S.chart.points || []), S.state.start, S.chart.marks); }
    document.querySelectorAll("canvas[data-ring]").forEach(cv => Charts.ring(cv, cv.dataset.ring === "" ? null : +cv.dataset.ring));
    if (S.sub && S.sub.kind === "coin" && S.coin[S.sub.mint]) { const c = S.coin[S.sub.mint]; Charts.candles($("#cnd"), c.candles, c.position ? c.position.stop : null); }
    if (S.sub && S.sub.kind === "audit") beam();
  }
  async function open(kind, mint) { S.sub = { kind, mint }; lastKey = ""; render(); scrollTo(0, 0); try { S.coin[mint] = await getj(`coin/${mint}.json`); } catch (e) { } lastKey = ""; render(); }
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-tab],[data-go],[data-range],[data-coin],[data-audit],[data-back],[data-share],[data-tg],[data-act]"); if (!t) return;
    if (t.dataset.tab || t.dataset.go) { S.tab = t.dataset.tab || t.dataset.go; S.sub = null; lastKey = ""; if (S.tab === "activity") localStorage.setItem("desk_unread", 0); render(); if (t.dataset.grp) { const g = $("#g-" + t.dataset.grp); g && g.scrollIntoView(); } else scrollTo(0, 0); }
    else if (t.dataset.range) { S.range = t.dataset.range; lastKey = ""; render(); }
    else if (t.dataset.coin) open("coin", t.dataset.coin);
    else if (t.dataset.audit) open("audit", t.dataset.audit);
    else if ("back" in t.dataset) { S.sub = null; lastKey = ""; render(); }
    else if (t.dataset.share) { const u = t.dataset.share; if (navigator.share) navigator.share({ url: u }).catch(() => { }); else navigator.clipboard.writeText(u).then(() => { const s = $("#shr"); if (s) s.textContent = "Link copied"; }); }
    else if (t.dataset.tg) alert(`Send "pause ${t.dataset.tg}" or "resume ${t.dataset.tg}" to the Telegram bot.`);
    else if (t.dataset.act === "search") { const q = (prompt("Name, symbol or mint") || "").trim().toLowerCase(); if (!q || !S.state) return;
      const all = [].concat(...Object.values(S.state.agents).map(a => a.decisions || []), S.activity.rows || []); const hit = all.find(d => d.mint && (d.mint.toLowerCase() === q || (d.name || "").toLowerCase().includes(q)));
      if (hit) open("coin", hit.mint); else alert("The desk hasn't seen that coin tonight."); }
  });
  render(); poll();
})();
