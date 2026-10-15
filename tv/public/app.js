// Anita TV client: a live-TV streaming app with a home feed, a live guide,
// an unlimited "DVR" library, search and a live player. Built for mouse,
// touch and TV-remote style arrow-key navigation.

const MIN = 60e3;
const HOUR = 60 * MIN;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const view = $("#view");
const modal = $("#modal");

const state = {
  channels: [],
  chMap: new Map(),
  guide: null, // { from, to, rows: [{ channelId, programs }] }
  progMap: new Map(),
  guideFilter: "All",
  heroIndex: 0,
};

// ---------- Persistence ----------

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
const library = load("atv.library", {}); // showId -> { title, channelId, addedAt }
const progress = load("atv.progress", {}); // programId -> { pos, dur, at, program }

function inLibrary(showId) {
  return Boolean(library[showId]);
}
function toggleLibrary(p) {
  if (library[p.showId]) {
    delete library[p.showId];
    toast(`Removed ${p.title} from library`);
  } else {
    // Recording starts with whatever airing is on now, like a real DVR.
    library[p.showId] = { title: p.title, channelId: p.channelId, addedAt: Math.min(Date.now(), p.start) };
    toast(`Added ${p.title} to library. New airings will be recorded.`);
  }
  save("atv.library", library);
}

// ---------- Utilities ----------

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function hash(str) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: "short" });
function fmtTime(t) {
  return timeFmt.format(t);
}
function fmtWhen(t) {
  const d = new Date(t);
  const today = new Date();
  const tomorrow = new Date(Date.now() + 24 * HOUR);
  if (d.toDateString() === today.toDateString()) return fmtTime(t);
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow ${fmtTime(t)}`;
  return `${dayFmt.format(d)} ${fmtTime(t)}`;
}
function fmtDur(ms) {
  const m = Math.round(ms / MIN);
  return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m}m`;
}
function fmtClock(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = String(sec % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}
function minsLeft(p) {
  return Math.max(1, Math.round((p.end - Date.now()) / MIN));
}
function pct(p, at = Date.now()) {
  return Math.min(100, Math.max(0, ((at - p.start) / (p.end - p.start)) * 100));
}
const isNow = (p, at = Date.now()) => p.start <= at && at < p.end;
const epLine = (p) => (p.episodeTitle ? `S${p.season} E${p.episode} · ${p.episodeTitle}` : "");

let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

// Generated key art: each show gets a stable palette and composition
// derived from its title, tinted by its channel's brand color.
function artStyle(p) {
  const ch = state.chMap.get(p.channelId);
  const h = hash(p.title);
  const hue = h % 360;
  const hue2 = (hue + 40 + (h >> 9) % 140) % 360;
  const x = 55 + (h >> 3) % 40;
  const y = 15 + (h >> 6) % 50;
  const color = ch?.color || "#555";
  return [
    `radial-gradient(circle at ${x}% ${y}%, hsl(${hue} 85% 60% / .95) 0, hsl(${hue} 85% 50% / 0) 38%)`,
    `radial-gradient(ellipse at ${100 - x}% 110%, ${color}cc 0, ${color}00 55%)`,
    `repeating-linear-gradient(${(h >> 4) % 180}deg, rgba(255,255,255,.035) 0 2px, transparent 2px ${8 + (h % 14)}px)`,
    `linear-gradient(${135 + (h % 90)}deg, hsl(${hue2} 55% 22%), hsl(${hue} 60% 7%))`,
  ].join(",");
}
function art(p, { title = true } = {}) {
  return `<div class="art" style="background:${artStyle(p)}">${title ? `<div class="art-title">${esc(p.title)}</div>` : ""}</div>`;
}
function logo(channelId, cls = "") {
  const ch = state.chMap.get(channelId);
  if (!ch) return "";
  return `<span class="logo ${cls}" style="background:${ch.color}" aria-hidden="true">${esc(ch.short)}</span>`;
}

// ---------- Data ----------

async function api(path) {
  const res = await fetch(`api/${path}`);
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json();
}

async function loadGuide() {
  const from = Math.floor(Date.now() / (30 * MIN)) * 30 * MIN;
  const g = await api(`guide?from=${from}&hours=12`);
  state.guide = g;
  for (const row of g.rows) for (const p of row.programs) state.progMap.set(p.id, p);
  return g;
}

function guideFresh() {
  return state.guide && Date.now() - state.guide.from < 30 * MIN;
}

function onNowList() {
  const now = Date.now();
  return state.guide.rows
    .map((r) => r.programs.find((p) => isNow(p, now)))
    .filter(Boolean)
    .sort((a, b) => state.chMap.get(a.channelId).number - state.chMap.get(b.channelId).number);
}
function upNextList() {
  const now = Date.now();
  return state.guide.rows.map((r) => r.programs.find((p) => p.start > now)).filter(Boolean);
}
function nowOnChannel(channelId) {
  return state.guide.rows.find((r) => r.channelId === channelId)?.programs.find((p) => isNow(p));
}

// Recordings: airings of library shows that began after the show was added
// (or were in progress then) and have started by now. Pulls up to 48h back.
async function loadRecordings() {
  const shows = Object.entries(library);
  if (!shows.length) return [];
  const now = Date.now();
  const earliest = Math.max(Math.min(...shows.map(([, s]) => s.addedAt)), now - 47 * HOUR);
  const from = Math.floor(earliest / (30 * MIN)) * 30 * MIN;
  const hours = Math.ceil((now - from) / HOUR) + 1;
  const g = await api(`guide?from=${from}&hours=${hours}`);
  const recs = [];
  for (const row of g.rows) {
    for (const p of row.programs) {
      const s = library[p.showId];
      if (s && p.end > s.addedAt && p.start <= now) recs.push(p);
    }
  }
  return recs.sort((a, b) => b.start - a.start);
}

// ---------- Cards ----------

function liveCard(p, key) {
  const ch = state.chMap.get(p.channelId);
  return `
    <button class="card" data-focus data-key="${esc(key)}" data-open="${esc(p.id)}">
      <div class="thumb">
        ${art(p)}
        ${logo(p.channelId)}
        ${p.live ? `<span class="badge-live">LIVE</span>` : `<span class="time-tag">${minsLeft(p)}m left</span>`}
        <div class="bar"><i data-bar data-start="${p.start}" data-end="${p.end}" style="width:${pct(p)}%"></i></div>
      </div>
      <div class="title">${esc(p.title)}</div>
      <div class="sub">${esc(epLine(p) || ch.name)} · ${fmtTime(p.start)}–${fmtTime(p.end)}</div>
    </button>`;
}
function upcomingCard(p, key) {
  const ch = state.chMap.get(p.channelId);
  return `
    <button class="card" data-focus data-key="${esc(key)}" data-open="${esc(p.id)}">
      <div class="thumb">
        ${art(p)}
        ${logo(p.channelId)}
        <span class="time-tag">${fmtWhen(p.start)}</span>
      </div>
      <div class="title">${esc(p.title)}</div>
      <div class="sub">${esc(ch.name)} · ${fmtDur(p.end - p.start)}${inLibrary(p.showId) ? " · Recording" : ""}</div>
    </button>`;
}
function recordingCard(p, key) {
  const pr = progress[p.id];
  const watched = pr ? Math.min(100, (pr.pos / ((p.end - p.start) / 1000)) * 100) : 0;
  const recording = isNow(p);
  return `
    <button class="card" data-focus data-key="${esc(key)}" data-play-rec="${esc(p.id)}">
      <div class="thumb">
        ${art(p)}
        ${logo(p.channelId)}
        ${recording ? `<span class="badge-live">RECORDING</span>` : `<span class="time-tag">${fmtDur(p.end - p.start)}</span>`}
        ${watched ? `<div class="bar"><i style="width:${watched}%"></i></div>` : ""}
      </div>
      <div class="title">${esc(p.title)}</div>
      <div class="sub">${esc(epLine(p) || state.chMap.get(p.channelId).name)} · ${fmtWhen(p.start)}</div>
    </button>`;
}
function row(title, cards) {
  if (!cards.length) return "";
  return `<section class="row"><h2>${esc(title)}</h2><div class="scroller">${cards.join("")}</div></section>`;
}

// ---------- Views ----------

async function renderHome() {
  if (!guideFresh()) await loadGuide();
  const now = onNowList();
  const picks = [
    ...now.filter((p) => p.live && p.category === "Sports"),
    ...now.filter((p) => p.category === "Movies"),
    ...now.filter((p) => p.live && p.category !== "Sports"),
    ...now.filter((p) => !p.live && p.category !== "Movies"),
  ].slice(0, 5);
  state.heroPicks = picks;
  state.heroIndex %= picks.length || 1;
  const hero = picks[state.heroIndex];

  const recs = await loadRecordings().catch(() => []);
  const cont = Object.values(progress)
    .filter((r) => r.pos > 30 && r.pos < r.dur - 60)
    .sort((a, b) => b.at - a.at)
    .map((r) => r.program);
  const by = (cat) => now.filter((p) => p.category === cat);

  view.innerHTML = `
    ${hero ? heroHtml(hero, picks) : ""}
    ${row("Continue watching", cont.map((p) => recordingCard(p, `cont-${p.id}`)))}
    ${row("Live now", now.map((p) => liveCard(p, `now-${p.id}`)))}
    ${row("New in your library", recs.filter((p) => !progress[p.id]).slice(0, 12).map((p) => recordingCard(p, `rec-${p.id}`)))}
    ${row("Live sports", by("Sports").map((p) => liveCard(p, `sp-${p.id}`)))}
    ${row("News", by("News").concat(upNextList().filter((p) => p.category === "News")).map((p) => (isNow(p) ? liveCard(p, `n-${p.id}`) : upcomingCard(p, `n-${p.id}`))))}
    ${row("Movies on now", by("Movies").map((p) => liveCard(p, `mv-${p.id}`)))}
    ${row("Coming up next", upNextList().map((p) => upcomingCard(p, `up-${p.id}`)))}
    ${row("Entertainment", by("Entertainment").concat(by("Lifestyle")).map((p) => liveCard(p, `ent-${p.id}`)))}
    ${row("Documentaries & kids", by("Documentary").concat(by("Kids")).map((p) => liveCard(p, `doc-${p.id}`)))}
  `;
}

function heroHtml(p, picks) {
  const ch = state.chMap.get(p.channelId);
  const saved = inLibrary(p.showId);
  return `
    <section class="hero">
      ${art(p)}
      <div class="hero-body">
        <div class="meta-line">
          <span class="chip">${logo(p.channelId)}${esc(ch.name)}</span>
          ${p.live ? `<span class="badge-live">LIVE</span>` : ""}
          <span class="badge">${esc(p.rating)}</span>
          <span>${fmtTime(p.start)}–${fmtTime(p.end)} · ${minsLeft(p)}m left</span>
        </div>
        <h1>${esc(p.title)}</h1>
        ${p.episodeTitle ? `<div class="meta-line" style="color:#ddd;margin:-4px 0 8px">${esc(epLine(p))}</div>` : ""}
        <p>${esc(p.synopsis)}</p>
        <div class="btn-row">
          <button class="btn primary" data-focus data-key="hero-watch" data-watch="${esc(p.id)}">
            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>Watch live
          </button>
          <button class="btn" data-focus data-key="hero-lib" data-lib="${esc(p.id)}">
            <svg viewBox="0 0 24 24"><path d="${saved ? "M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" : "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z"}"/></svg>
            ${saved ? "In library" : "Add to library"}
          </button>
          <button class="btn" data-focus data-key="hero-info" data-open="${esc(p.id)}">More info</button>
        </div>
      </div>
      <div class="hero-dots">
        ${picks.map((_, i) => `<button aria-label="Featured ${i + 1}" data-hero="${i}" class="${i === state.heroIndex ? "on" : ""}"></button>`).join("")}
      </div>
    </section>`;
}

const CATEGORIES = ["All", "Sports", "News", "Movies", "Entertainment", "Lifestyle", "Documentary", "Kids"];

async function renderLive() {
  if (!guideFresh()) await loadGuide();
  const g = state.guide;
  const now = Date.now();
  const totalMin = (g.to - g.from) / MIN;
  const rows = g.rows.filter((r) => {
    const ch = state.chMap.get(r.channelId);
    return state.guideFilter === "All" || ch.category === state.guideFilter;
  });

  const slots = [];
  for (let t = g.from; t < g.to; t += 30 * MIN) slots.push(`<div class="g-slot">${fmtTime(t)}</div>`);

  const rowHtml = rows
    .map((r) => {
      const ch = state.chMap.get(r.channelId);
      const progs = r.programs
        .map((p) => {
          const s = Math.max(p.start, g.from);
          const e = Math.min(p.end, g.to);
          const left = (s - g.from) / MIN;
          const width = (e - s) / MIN;
          const cls = isNow(p, now) ? "now" : p.end <= now ? "past" : "";
          return `
            <button class="g-prog ${cls}" data-focus data-key="g-${esc(p.id)}" data-open="${esc(p.id)}"
              style="left:calc(${left} * var(--px-per-min) + 2px);width:calc(${width} * var(--px-per-min) - 4px)"
              title="${esc(p.title)}">
              <div class="t">${p.live && cls === "now" ? `<span class="badge-live">LIVE</span>` : ""}${esc(p.title)}</div>
              <div class="s">${inLibrary(p.showId) ? `<span class="rec">● </span>` : ""}${fmtTime(p.start)}–${fmtTime(p.end)}${p.episodeTitle ? ` · ${esc(p.episodeTitle)}` : ""}</div>
            </button>`;
        })
        .join("");
      return `
        <div class="g-row">
          <div class="g-ch" title="${esc(ch.name)}">${logo(ch.id, "lg")}<div><div class="num">${ch.number}</div><div class="nm">${esc(ch.name)}</div></div></div>
          <div class="g-progs" style="width:calc(${totalMin} * var(--px-per-min))">${progs}</div>
        </div>`;
    })
    .join("");

  view.innerHTML = `
    <div class="filters" role="toolbar" aria-label="Channel categories">
      ${CATEGORIES.map((c) => `<button data-focus data-key="f-${c}" data-filter="${c}" class="${c === state.guideFilter ? "on" : ""}">${c}</button>`).join("")}
    </div>
    <div class="guide" id="guide">
      <div class="guide-inner">
        <div class="g-head"><div class="g-corner">${dayFmt.format(now)} ${fmtTime(now)}</div>${slots.join("")}</div>
        ${rowHtml}
        <div class="g-now" id="gNow" style="left:calc(var(--ch-w) + ${(now - g.from) / MIN} * var(--px-per-min))"></div>
      </div>
    </div>`;
}

async function renderLibrary() {
  if (!guideFresh()) await loadGuide();
  const shows = Object.entries(library);
  if (!shows.length) {
    view.innerHTML = `
      <div class="page-head"><h1>Library</h1></div>
      <div class="empty">
        <h2>Your library is empty</h2>
        <p>Add shows, games and movies to record every airing. Space is unlimited.</p>
        <p style="margin-top:18px"><a class="btn primary" href="#/live" data-focus>Browse the live guide</a></p>
      </div>`;
    return;
  }
  const recs = await loadRecordings();
  const byShow = new Map();
  for (const p of recs) {
    if (!byShow.has(p.showId)) byShow.set(p.showId, []);
    byShow.get(p.showId).push(p);
  }
  const upcoming = upNextList().filter((p) => inLibrary(p.showId));
  const showCards = shows
    .sort((a, b) => b[1].addedAt - a[1].addedAt)
    .map(([showId, s]) => {
      const list = byShow.get(showId) || [];
      const sample = list[0] || { title: s.title, channelId: s.channelId, showId };
      return `
        <button class="card" data-focus data-key="show-${esc(showId)}" data-show="${esc(showId)}">
          <div class="thumb">${art(sample)}${logo(s.channelId)}<span class="time-tag">${list.length} recorded</span></div>
          <div class="title">${esc(s.title)}</div>
          <div class="sub">${esc(state.chMap.get(s.channelId)?.name || "")}</div>
        </button>`;
    });

  view.innerHTML = `
    <div class="page-head"><h1>Library</h1><p>${recs.length} recording${recs.length === 1 ? "" : "s"} · unlimited space</p></div>
    ${row("Recently recorded", recs.slice(0, 16).map((p) => recordingCard(p, `lr-${p.id}`)))}
    ${row("Scheduled to record", upcoming.map((p) => upcomingCard(p, `lu-${p.id}`)))}
    <section class="row"><h2>Shows, movies & sports</h2><div class="grid">${showCards.join("")}</div></section>`;
}

let searchTimer;
async function renderSearch(q = "") {
  view.innerHTML = `
    <div class="search-bar">
      <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14"/></svg>
      <input id="q" type="search" placeholder="Search shows, movies, sports and channels" value="${esc(q)}" autocomplete="off" data-focus />
    </div>
    <div id="results"></div>`;
  const input = $("#q");
  input.focus();
  input.setSelectionRange(q.length, q.length);
  input.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      history.replaceState(null, "", `#/search?q=${encodeURIComponent(input.value)}`);
      runSearch(input.value);
    }, 200);
  });
  await runSearch(q);
}

async function runSearch(q) {
  const out = $("#results");
  if (!out) return;
  if (!q.trim()) {
    if (!guideFresh()) await loadGuide();
    out.innerHTML = row("Popular right now", onNowList().filter((p) => p.live).map((p) => liveCard(p, `pop-${p.id}`)));
    return;
  }
  const r = await api(`search?q=${encodeURIComponent(q)}`);
  for (const p of r.programs) state.progMap.set(p.id, p);
  if (!r.channels.length && !r.programs.length) {
    out.innerHTML = `<div class="empty"><h2>No results for “${esc(q)}”</h2><p>Try a show, team, genre or channel name.</p></div>`;
    return;
  }
  out.innerHTML = `
    ${r.channels.length ? `<div class="ch-results">${r.channels.map((c) => `<button class="ch-result" data-focus data-channel="${c.id}">${logo(c.id, "lg")}<span>${esc(c.name)}</span></button>`).join("")}</div>` : ""}
    ${r.programs.length ? `<div class="grid">${r.programs.map((p) => (isNow(p) ? liveCard(p, `s-${p.id}`) : upcomingCard(p, `s-${p.id}`))).join("")}</div>` : ""}`;
}

// ---------- Detail modals ----------

function upcomingAirings(showId, excludeId) {
  const out = [];
  for (const r of state.guide?.rows || []) {
    for (const p of r.programs) if (p.showId === showId && p.id !== excludeId && p.end > Date.now()) out.push(p);
  }
  return out.sort((a, b) => a.start - b.start).slice(0, 6);
}

function openDetail(p) {
  const ch = state.chMap.get(p.channelId);
  const now = Date.now();
  const live = isNow(p, now);
  const past = p.end <= now;
  const recorded = inLibrary(p.showId) && p.end > library[p.showId].addedAt;
  const airings = upcomingAirings(p.showId, p.id);
  let primary;
  if (live) primary = `<button class="btn primary" data-focus data-watch="${esc(p.id)}"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>Watch live</button>`;
  else if (past && recorded) primary = `<button class="btn primary" data-focus data-play-rec="${esc(p.id)}"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>Play recording</button>`;
  else primary = `<button class="btn primary" data-focus data-watch-channel="${esc(p.channelId)}"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>Watch ${esc(ch.name)} live</button>`;

  showModal(`
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(p.title)}">
      <button class="icon-btn sheet-close" data-focus data-close aria-label="Close"><svg viewBox="0 0 24 24"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>
      <div class="detail-art art" style="background:${artStyle(p)}"></div>
      <div class="sheet-body">
        <div class="meta-line">
          <span class="chip">${logo(p.channelId)}${esc(ch.name)} · ${ch.number}</span>
          ${live && p.live ? `<span class="badge-live">LIVE</span>` : ""}
          ${p.isNew ? `<span class="badge-new">NEW</span>` : ""}
          <span class="badge">${esc(p.rating)}</span>
        </div>
        <h2>${esc(p.title)}</h2>
        ${p.episodeTitle ? `<p class="ep">${esc(epLine(p))}</p>` : ""}
        <div class="meta-line">${fmtWhen(p.start)}–${fmtTime(p.end)} · ${fmtDur(p.end - p.start)} · ${esc(p.category)}${live ? ` · ${minsLeft(p)}m left` : ""}</div>
        <p class="syn">${esc(p.synopsis)}</p>
        <div class="btn-row">
          ${primary}
          <button class="btn" data-focus data-lib="${esc(p.id)}" data-refresh-detail>
            <svg viewBox="0 0 24 24"><path d="${inLibrary(p.showId) ? "M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" : "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z"}"/></svg>
            ${inLibrary(p.showId) ? "In library" : "Add to library"}
          </button>
        </div>
        ${airings.length ? `<h3>Upcoming airings</h3><ul class="airings">${airings
          .map((a) => `<li><button data-focus data-open="${esc(a.id)}"><span class="when">${fmtWhen(a.start)}</span><span>${esc(a.episodeTitle || a.title)}</span></button></li>`)
          .join("")}</ul>` : ""}
      </div>
    </div>`);
  modal.dataset.programId = p.id;
}

async function openShow(showId) {
  const s = library[showId];
  if (!s) return;
  const recs = (await loadRecordings()).filter((p) => p.showId === showId);
  const sample = recs[0] || { title: s.title, channelId: s.channelId };
  showModal(`
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(s.title)}">
      <button class="icon-btn sheet-close" data-focus data-close aria-label="Close"><svg viewBox="0 0 24 24"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button>
      <div class="detail-art art" style="background:${artStyle(sample)}"></div>
      <div class="sheet-body">
        <div class="meta-line"><span class="chip">${logo(s.channelId)}${esc(state.chMap.get(s.channelId)?.name || "")}</span></div>
        <h2>${esc(s.title)}</h2>
        <div class="btn-row" style="margin-top:12px">
          <button class="btn" data-focus data-unlib="${esc(showId)}">Remove from library</button>
        </div>
        <h3>Recordings</h3>
        ${recs.length ? `<ul class="airings">${recs
          .map((p) => `<li><button data-focus data-play-rec="${esc(p.id)}"><span class="when">${fmtWhen(p.start)}</span><span>${esc(epLine(p) || p.title)}${isNow(p) ? " · recording now" : ""}</span></button></li>`)
          .join("")}</ul>` : `<p class="syn">Nothing recorded yet. The next airing will be saved automatically.</p>`}
      </div>
    </div>`);
  delete modal.dataset.programId;
}

let lastFocus;
function showModal(html) {
  if (modal.hidden) lastFocus = document.activeElement;
  modal.innerHTML = html;
  modal.hidden = false;
  $("[data-focus]:not([data-close])", modal)?.focus();
}
function closeModal() {
  modal.hidden = true;
  modal.innerHTML = "";
  lastFocus?.focus?.();
}

// ---------- Player ----------

const player = {
  el: $("#player"),
  video: $("#video"),
  program: null,
  mode: "live", // "live" | "recording"
  pos: 0, // seconds into the program
  playing: false,
  lastTick: 0,
  lastSave: 0,
  failed: false,
  idleTimer: null,
  raf: null,
};

function programDur(p) {
  return (p.end - p.start) / 1000;
}
// Furthest point that has aired: the live edge, or the end of a finished recording.
function liveEdge() {
  const p = player.program;
  return Math.min(programDur(p), (Date.now() - p.start) / 1000);
}

async function play(p, mode = "live", startAt) {
  if (!modal.hidden) closeModal();
  player.program = p;
  player.mode = mode;
  player.failed = false;
  player.pos = startAt ?? (mode === "live" ? liveEdge() : progress[p.id]?.pos ?? 0);
  player.el.hidden = false;
  $("#signal").hidden = true;
  $("#miniGuide").hidden = true;
  document.body.style.overflow = "hidden";
  if (mode === "live") save("atv.lastChannel", p.channelId);
  updatePlayerMeta();

  const v = player.video;
  if (v.dataset.src !== p.stream || v.error) {
    v.dataset.src = p.stream;
    v.src = p.stream;
  }
  v.loop = true;
  v.addEventListener("loadedmetadata", syncVideo, { once: true });
  setPlaying(true);
  if (!player.raf) tick();
  wake();
}

// The stream is a loop standing in for the broadcast; the program clock is
// the source of truth and the video is kept aligned to it.
function syncVideo() {
  const v = player.video;
  if (!v.duration || !isFinite(v.duration)) return;
  const target = player.pos % v.duration;
  if (Math.abs(v.currentTime - target) > 1.5) v.currentTime = target;
}

function setPlaying(on) {
  player.playing = on;
  player.lastTick = performance.now();
  const v = player.video;
  if (on && !player.failed) {
    v.play().catch((err) => {
      // Autoplay with sound can be blocked; retry muted rather than stall.
      if (err.name !== "NotAllowedError") return;
      v.muted = true;
      updateMute();
      v.play().catch(() => {});
    });
  } else v.pause();
  $("#pPlayIcon").innerHTML = on ? `<path d="M6 19h4V5H6zm8-14v14h4V5z"/>` : `<path d="M8 5v14l11-7z"/>`;
  $("#pPlay").setAttribute("aria-label", on ? "Pause" : "Play");
}

function showSignal() {
  player.failed = true;
  const p = player.program;
  const ch = state.chMap.get(p.channelId);
  const sig = $("#signal");
  sig.innerHTML = `
    <div class="art" style="background:${artStyle(p)}"></div>
    <div class="signal-card">
      ${logo(p.channelId, "lg")}
      <h2>${esc(p.title)}</h2>
      <p>${esc(epLine(p) || p.synopsis)}</p>
      <div class="clock" id="sigClock"></div>
      <div class="note">${esc(ch.name)} stream unavailable on this network. Playing the program clock.</div>
    </div>`;
  sig.hidden = false;
}

player.video.addEventListener("error", () => {
  if (!player.el.hidden) showSignal();
});

function tick() {
  player.raf = requestAnimationFrame(tick);
  if (player.el.hidden || !player.program) return;
  const t = performance.now();
  const dt = (t - player.lastTick) / 1000;
  player.lastTick = t;
  const p = player.program;
  if (player.playing) {
    player.pos = Math.min(player.pos + dt, liveEdge());
    if (player.pos >= programDur(p) - 0.05) return onProgramEnd();
  }
  if (!player.failed && player.playing) syncVideo();
  renderTimeline();
  if (player.mode === "recording" && t - player.lastSave > 5000) {
    player.lastSave = t;
    saveProgress();
  }
}

function saveProgress() {
  const p = player.program;
  if (player.mode !== "recording" || !p) return;
  progress[p.id] = { pos: player.pos, dur: programDur(p), at: Date.now(), program: p };
  save("atv.progress", progress);
}

async function onProgramEnd() {
  const p = player.program;
  if (player.ending) return;
  player.ending = true;
  try {
    await finishProgram(p);
  } finally {
    player.ending = false;
  }
}

async function finishProgram(p) {
  if (player.mode === "recording") {
    saveProgress();
    closePlayer();
    toast(`Finished ${p.title}`);
    return;
  }
  // Live: roll into whatever is on next on this channel.
  await loadGuide();
  const next = nowOnChannel(p.channelId);
  if (next && next.id !== p.id) {
    play(next, "live", 0);
    flash(`Now: ${next.title}`);
  }
}

function renderTimeline() {
  const p = player.program;
  const dur = programDur(p);
  const avail = liveEdge();
  $("#pAvail").style.width = `${(avail / dur) * 100}%`;
  $("#pProgress").style.width = `${(player.pos / dur) * 100}%`;
  $("#pThumb").style.left = `${(player.pos / dur) * 100}%`;
  if (player.mode === "live") {
    const behind = liveEdge() - player.pos;
    $("#pStart").textContent = fmtTime(p.start);
    $("#pEnd").textContent = behind > 5 ? `-${fmtClock(behind)} behind live · ends ${fmtTime(p.end)}` : `Ends ${fmtTime(p.end)}`;
    $("#pLive").className = `live-pill${behind <= 5 ? " at-edge" : ""}`;
  } else {
    $("#pStart").textContent = fmtClock(player.pos);
    $("#pEnd").textContent = fmtClock(dur);
    $("#pLive").className = "live-pill hidden";
  }
  const clock = $("#sigClock");
  if (clock) clock.textContent = `${fmtClock(player.pos)} / ${fmtClock(dur)}`;
}

function updatePlayerMeta() {
  const p = player.program;
  const ch = state.chMap.get(p.channelId);
  $("#pTitle").textContent = p.title;
  $("#pSub").textContent = [epLine(p), player.mode === "recording" ? `Recorded ${fmtWhen(p.start)}` : `${fmtTime(p.start)}–${fmtTime(p.end)}`, p.rating]
    .filter(Boolean)
    .join(" · ");
  $("#pChannel").innerHTML = `${logo(p.channelId, "lg")}<span>${ch.number} ${esc(ch.name)}</span>`;
  $("#pChUp").hidden = $("#pChDown").hidden = player.mode !== "live";
  $("#pRecord").setAttribute("aria-label", inLibrary(p.showId) ? "Remove from library" : "Add to library");
  $("#pRecord").innerHTML = `<svg viewBox="0 0 24 24"><path d="${inLibrary(p.showId) ? "M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" : "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z"}"/></svg>`;
  if ($("#miniGuide").hidden === false) renderMiniGuide();
}

function seek(to) {
  player.pos = Math.max(0, Math.min(to, liveEdge()));
  if (!player.failed) {
    const v = player.video;
    if (v.duration && isFinite(v.duration)) v.currentTime = player.pos % v.duration;
  }
  renderTimeline();
  wake();
}

async function changeChannel(dir) {
  if (player.mode !== "live") return;
  if (!guideFresh()) await loadGuide();
  const list = [...state.channels].sort((a, b) => a.number - b.number);
  const i = list.findIndex((c) => c.id === player.program.channelId);
  const ch = list[(i + dir + list.length) % list.length];
  const p = nowOnChannel(ch.id);
  if (p) {
    play(p, "live");
    flash(`${ch.number} ${ch.name}`);
  }
}

function renderMiniGuide() {
  const mg = $("#miniGuide");
  mg.innerHTML = `<h3>On now</h3>${onNowList()
    .map(
      (p) => `
      <button class="mg-item ${p.channelId === player.program.channelId ? "on" : ""}" data-watch="${esc(p.id)}">
        ${logo(p.channelId, "lg")}
        <div class="info"><div class="t">${esc(p.title)}</div><div class="s">${state.chMap.get(p.channelId).number} · ${esc(state.chMap.get(p.channelId).name)} · ${minsLeft(p)}m left</div><div class="bar"><i style="width:${pct(p)}%"></i></div></div>
      </button>`,
    )
    .join("")}`;
}

function toggleMiniGuide() {
  const mg = $("#miniGuide");
  if (mg.hidden) {
    renderMiniGuide();
    mg.hidden = false;
    $(".mg-item.on", mg)?.focus();
    $(".mg-item.on", mg)?.scrollIntoView({ block: "center" });
  } else mg.hidden = true;
}

function flash(text) {
  const z = $("#pToast");
  z.textContent = text;
  z.classList.add("show");
  clearTimeout(z._t);
  z._t = setTimeout(() => z.classList.remove("show"), 1200);
}

function wake() {
  player.el.classList.remove("idle");
  clearTimeout(player.idleTimer);
  player.idleTimer = setTimeout(() => {
    if (player.playing && $("#miniGuide").hidden) player.el.classList.add("idle");
  }, 3500);
}

function closePlayer() {
  saveProgress();
  player.video.pause();
  player.el.hidden = true;
  player.program = null;
  document.body.style.overflow = "";
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  route();
}

function updateMute() {
  const v = player.video;
  $("#pMuteIcon").innerHTML = v.muted || v.volume === 0
    ? `<path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45q.05-.3.05-.63m2.5 0q-.01 1.42-.54 2.64l1.51 1.51A8.8 8.8 0 0 0 21 12a9 9 0 0 0-7-8.77v2.06A7 7 0 0 1 19 12M4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a9 9 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9zM12 4 9.91 6.09 12 8.18z"/>`
    : `<path d="M3 9v6h4l5 5V4L7 9zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02M14 3.23v2.06a7 7 0 0 1 0 13.42v2.06A9 9 0 0 0 14 3.23"/>`;
  $("#pVol").value = v.muted ? 0 : v.volume;
}

$("#pBack").onclick = closePlayer;
$("#pPlay").onclick = () => setPlaying(!player.playing);
$("#pBack15").onclick = () => seek(player.pos - 15);
$("#pFwd15").onclick = () => seek(player.pos + 15);
$("#pLive").onclick = () => seek(liveEdge());
$("#pChUp").onclick = () => changeChannel(1);
$("#pChDown").onclick = () => changeChannel(-1);
$("#pGuide").onclick = toggleMiniGuide;
$("#pRecord").onclick = () => {
  toggleLibrary(player.program);
  updatePlayerMeta();
};
$("#pMute").onclick = () => {
  player.video.muted = !player.video.muted;
  updateMute();
};
$("#pVol").oninput = (e) => {
  player.video.volume = Number(e.target.value);
  player.video.muted = player.video.volume === 0;
  updateMute();
};
$("#pFull").onclick = () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else player.el.requestFullscreen?.().catch(() => {});
};
$("#pTimeline").addEventListener("click", (e) => {
  const r = e.currentTarget.getBoundingClientRect();
  seek(((e.clientX - r.left) / r.width) * programDur(player.program));
});
player.el.addEventListener("mousemove", wake);
player.el.addEventListener("click", (e) => {
  if (e.target === player.video || e.target.closest(".signal") || e.target === $("#playerUi")) {
    setPlaying(!player.playing);
  }
  wake();
});
$("#miniGuide").addEventListener("click", (e) => {
  const b = e.target.closest("[data-watch]");
  if (!b) return;
  e.stopPropagation();
  const p = state.progMap.get(b.dataset.watch);
  if (p) play(p, "live");
});

// ---------- Global click delegation ----------

document.addEventListener("click", async (e) => {
  if (!player.el.hidden && player.el.contains(e.target)) return;
  const t = e.target.closest(
    "[data-open],[data-watch],[data-watch-channel],[data-lib],[data-unlib],[data-play-rec],[data-show],[data-close],[data-filter],[data-hero],[data-channel]",
  );
  if (!t) {
    if (e.target === modal) closeModal();
    return;
  }
  const d = t.dataset;
  const prog = (id) => state.progMap.get(id) || Object.values(progress).find((r) => r.program.id === id)?.program;
  if (d.close !== undefined) closeModal();
  else if (d.open) {
    const p = prog(d.open);
    if (p) openDetail(p);
  } else if (d.watch) {
    const p = prog(d.watch);
    if (p) play(isNow(p) ? p : nowOnChannel(p.channelId) || p, "live");
  } else if (d.watchChannel || d.channel) {
    if (!guideFresh()) await loadGuide();
    const p = nowOnChannel(d.watchChannel || d.channel);
    if (p) play(p, "live");
  } else if (d.playRec) {
    const p = prog(d.playRec);
    if (p) play(p, "recording");
  } else if (d.lib) {
    const p = prog(d.lib);
    if (!p) return;
    toggleLibrary(p);
    if (d.refreshDetail !== undefined) openDetail(p);
    else if (t.closest(".hero")) {
      updateHero();
      $('[data-key="hero-lib"]')?.focus();
    } else route();
  } else if (d.unlib) {
    delete library[d.unlib];
    save("atv.library", library);
    closeModal();
    toast("Removed from library");
    route();
  } else if (d.show) openShow(d.show);
  else if (d.filter) {
    state.guideFilter = d.filter;
    await renderLive();
    $(`[data-key="f-${d.filter}"]`)?.focus();
    scrollGuideToNow();
  } else if (d.hero !== undefined) {
    state.heroIndex = Number(d.hero);
    updateHero();
  }
});

$("#searchBtn").onclick = () => (location.hash = "#/search");

// ---------- Keyboard & remote navigation ----------

const DIRS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

// Spatial navigation. Vertical moves go to the nearest row band, then the
// closest item across; horizontal moves stay within the current row.
function moveFocus(key) {
  const [dx, dy] = DIRS[key];
  const scope = !modal.hidden ? modal : document;
  const items = $$("[data-focus]", scope).filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  const cur = document.activeElement;
  if (!cur || !items.includes(cur)) {
    (items.find((el) => el.closest("main")) || items[0])?.focus();
    return;
  }
  const a = cur.getBoundingClientRect();
  const center = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  const ac = center(a);
  const cands = [];
  for (const el of items) {
    if (el === cur) continue;
    const b = el.getBoundingClientRect();
    const gap = dx > 0 ? b.left - a.right : dx < 0 ? a.left - b.right : dy > 0 ? b.top - a.bottom : a.top - b.bottom;
    if (gap < -4) continue;
    const overlap = dx
      ? Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
      : Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const across = dx ? Math.abs(center(b).y - ac.y) : Math.abs(center(b).x - ac.x);
    cands.push({ el, gap: Math.max(0, gap), overlap, across });
  }
  let pool = cands;
  if (dx) pool = cands.filter((c) => c.overlap > 4);
  else {
    const band = Math.min(...cands.map((c) => c.gap));
    pool = cands.filter((c) => c.gap <= band + 12);
  }
  pool.sort((p, q) => (dx ? p.gap - q.gap || p.across - q.across : q.overlap > 0 === p.overlap > 0 ? p.across - q.across : q.overlap - p.overlap));
  const best = pool[0]?.el;
  if (best) {
    best.focus({ preventScroll: true });
    best.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }
}

document.addEventListener("keydown", (e) => {
  const typing = e.target.matches?.("input[type=search], input[type=text]");
  if (!player.el.hidden) {
    wake();
    const k = e.key;
    const handled = {
      " ": () => setPlaying(!player.playing),
      k: () => setPlaying(!player.playing),
      ArrowLeft: () => seek(player.pos - 15),
      ArrowRight: () => seek(player.pos + 15),
      ArrowUp: () => changeChannel(1),
      ArrowDown: () => changeChannel(-1),
      PageUp: () => changeChannel(1),
      PageDown: () => changeChannel(-1),
      f: () => $("#pFull").click(),
      m: () => $("#pMute").click(),
      g: toggleMiniGuide,
      l: () => seek(liveEdge()),
      Escape: () => ($("#miniGuide").hidden ? closePlayer() : toggleMiniGuide()),
      Backspace: closePlayer,
    }[k];
    // Inside the mini guide, arrows move through the list instead.
    if (!$("#miniGuide").hidden && (k === "ArrowUp" || k === "ArrowDown")) {
      const items = $$(".mg-item");
      const i = items.indexOf(document.activeElement);
      items[Math.max(0, Math.min(items.length - 1, i + (k === "ArrowDown" ? 1 : -1)))]?.focus();
      e.preventDefault();
      return;
    }
    if (!$("#miniGuide").hidden && k === "Enter" && document.activeElement?.matches(".mg-item")) return;
    if (handled && !(e.target.closest?.(".p-controls") && (k === " " || k === "Enter"))) {
      e.preventDefault();
      handled();
    }
    return;
  }
  if (e.key === "Escape" && !modal.hidden) return closeModal();
  if (typing) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      $("#results [data-focus]")?.focus();
    }
    return;
  }
  if (e.key === "/") {
    e.preventDefault();
    location.hash = "#/search";
  } else if (DIRS[e.key]) {
    e.preventDefault();
    document.body.classList.add("remote");
    moveFocus(e.key);
  }
});
document.addEventListener("mousedown", () => document.body.classList.remove("remote"));

// ---------- Routing & live refresh ----------

function scrollGuideToNow() {
  const g = $("#guide");
  if (g) g.scrollLeft = 0;
}

async function route() {
  const hash = location.hash || "#/home";
  const [path, query] = hash.slice(2).split("?");
  const tab = path.split("/")[0] || "home";
  $$(".tabs a").forEach((a) => a.classList.toggle("active", a.dataset.tab === tab));
  const key = document.activeElement?.dataset?.key;
  const scroll = window.scrollY;
  try {
    if (tab === "live") {
      const gl = $("#guide")?.scrollLeft;
      const gt = $("#guide")?.scrollTop;
      const wasLive = view.dataset.view === "live";
      await renderLive();
      if (wasLive && gl != null) Object.assign($("#guide"), { scrollLeft: gl, scrollTop: gt });
      else scrollGuideToNow();
    } else if (tab === "library") await renderLibrary();
    else if (tab === "search") {
      if (view.dataset.view !== "search") await renderSearch(new URLSearchParams(query).get("q") || "");
    } else await renderHome();
  } catch (err) {
    console.error(err);
    view.innerHTML = `<div class="empty"><h2>Can't reach Anita TV</h2><p>${esc(err.message)}</p></div>`;
  }
  const sameView = view.dataset.view === tab;
  view.dataset.view = tab;
  if (sameView) {
    window.scrollTo(0, scroll);
    if (key) $(`[data-key="${CSS.escape(key)}"]`)?.focus({ preventScroll: true });
  } else window.scrollTo(0, 0);
}

window.addEventListener("hashchange", () => {
  if (!player.el.hidden) closePlayer();
  if (!modal.hidden) closeModal();
  view.dataset.view = "";
  route();
});

// Every 20s: advance progress bars; when any airing ends, refetch and redraw
// the current view (keeping scroll and focus) so "on now" stays honest.
setInterval(async () => {
  const now = Date.now();
  $$("[data-bar]").forEach((b) => (b.style.width = `${pct({ start: +b.dataset.start, end: +b.dataset.end }, now)}%`));
  const line = $("#gNow");
  if (line && state.guide) line.style.left = `calc(var(--ch-w) + ${(now - state.guide.from) / MIN} * var(--px-per-min))`;
  const stale = state.guide && onNowList().some((p) => p.end <= now + 1000);
  if (!state.guide || !guideFresh() || stale || onNowList().length < state.channels.length) {
    await loadGuide();
    if (player.el.hidden && modal.hidden && view.dataset.view !== "search") route();
  }
}, 20e3);

// Rotate the home hero.
setInterval(() => {
  if (view.dataset.view !== "home" || !player.el.hidden || !modal.hidden) return;
  if (document.activeElement?.closest(".hero")) return;
  state.heroIndex++;
  updateHero();
}, 12e3);

function updateHero() {
  const el = $(".hero");
  const picks = state.heroPicks || [];
  if (!el || !picks.length) return;
  state.heroIndex %= picks.length;
  el.outerHTML = heroHtml(picks[state.heroIndex], picks);
}

async function boot() {
  const { channels } = await api("channels");
  state.channels = channels;
  state.chMap = new Map(channels.map((c) => [c.id, c]));
  await loadGuide();
  route();
}
boot().catch((err) => {
  view.innerHTML = `<div class="empty"><h2>Can't reach Anita TV</h2><p>${esc(err.message)}</p></div>`;
});
