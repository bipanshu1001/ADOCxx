"use strict";

/* ===== ADOC tuner (JS port of adoc_tuner.cpp) ===== */
const CFG = {
  l0_threshold: 20,
  rdo_threshold: 16 * 1024,  // MB — scaled for a short demo (real: 64 GB)
  thread_add: 2, batch_add: 64,
  min_threads: 1, max_threads: 32,
  min_batch: 64, max_batch: 512, flush_divisor: 4,
};
const compaction = (k) => k.total - k.flush;

function rebalance(k) {
  let f = Math.floor(k.total / CFG.flush_divisor);
  if (f < 1) f = 1;
  if (k.total > 1 && f > k.total - 1) f = k.total - 1;
  if (k.total === 1) f = 1;
  k.flush = f;
}
function tune(k, s) {
  const l0o = s.l0 > CFG.l0_threshold, rdo = s.redun > CFG.rdo_threshold, mmo = s.mmo;
  let a = "None";
  if (l0o) { k.total = Math.min(CFG.max_threads, k.total + CFG.thread_add); a = "L0O"; }
  else if (rdo) { k.total = Math.min(CFG.max_threads, k.total + CFG.thread_add); k.batch = Math.max(CFG.min_batch, Math.floor(k.batch / 2)); a = "RDO"; }
  else if (mmo) { k.total = Math.max(CFG.min_threads, Math.floor(k.total / 2)); k.batch = Math.min(CFG.max_batch, k.batch + CFG.batch_add); a = "MMO"; }
  rebalance(k);
  return a;
}

/* ===== Synthetic LSM engine (JS port of metrics_collector.cpp) ===== */
const MAX_POINTS = 150;
let sim;
function resetSim() {
  sim = { knobs: { total: 2, flush: 1, batch: 64 }, mem: 0, l0: 0, redun: 0,
    t: 0, steps: 0, stallSteps: 0, totalThru: 0, lastAction: "None",
    cur: { mmo: false, l0o: false, rdo: false }, history: [] };
  rebalance(sim.knobs);
}
function step(bw, inRate, adocOn) {
  const k = sim.knobs;
  const perThread = bw / Math.max(1, k.total);
  const flushEff = Math.min(2, 0.6 + 0.4 * (k.batch / 64));
  const flushRate = k.flush * perThread * flushEff;
  const l0l1 = bw * 0.9;
  const deep = Math.max(0, compaction(k)) * perThread * 0.7;

  sim.mem += (inRate - flushRate); if (sim.mem < 0) sim.mem = 0;
  const memLimit = 2 * k.batch;
  const mmo = sim.mem > memLimit; if (mmo) sim.mem = memLimit;

  const flushed = Math.min(flushRate, inRate);
  sim.l0 += flushed / k.batch; sim.l0 -= l0l1 / k.batch; if (sim.l0 < 0) sim.l0 = 0;
  sim.redun += l0l1 * 0.2 - deep; if (sim.redun < 0) sim.redun = 0;

  const s = { mmo, l0: Math.floor(sim.l0), redun: sim.redun };
  const l0o = s.l0 > CFG.l0_threshold, rdo = s.redun > CFG.rdo_threshold;
  let action = "None";
  if (adocOn) action = tune(k, s);
  sim.lastAction = adocOn ? action : "off";
  sim.cur = { mmo, l0o, rdo };

  const thru = mmo ? flushRate : inRate;
  sim.history.push({ thru, demand: inRate, stalled: mmo, action });
  if (sim.history.length > MAX_POINTS) sim.history.shift();
  sim.t++; sim.steps++; sim.totalThru += thru; if (mmo) sim.stallSteps++;
}

/* ===== Chart ===== */
const canvas = document.getElementById("chart");
const ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height, PAD = 8, BOTTOM = 20;
const COL = { thru: "#4ea1ff", demand: "rgba(148,163,180,.55)", stall: "rgba(255,107,107,.13)",
  MMO: "#ff6b6b", L0O: "#ffb14d", RDO: "#b197fc", grid: "#1a2230" };

function draw(yMax) {
  ctx.clearRect(0, 0, W, H);
  const plotH = H - BOTTOM - PAD, n = MAX_POINTS;
  const stepX = (W - PAD * 2) / (n - 1);
  const y = (v) => PAD + plotH * (1 - Math.min(1, v / yMax));
  ctx.strokeStyle = COL.grid; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) { const gy = PAD + plotH * i / 4; ctx.beginPath(); ctx.moveTo(PAD, gy); ctx.lineTo(W - PAD, gy); ctx.stroke(); }
  const h = sim.history, off = n - h.length;
  ctx.fillStyle = COL.stall;
  for (let i = 0; i < h.length; i++) if (h[i].stalled) ctx.fillRect(PAD + (off + i) * stepX - stepX / 2, PAD, stepX, plotH);
  // demand dashed
  ctx.strokeStyle = COL.demand; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.beginPath();
  for (let i = 0; i < h.length; i++) { const x = PAD + (off + i) * stepX; i ? ctx.lineTo(x, y(h[i].demand)) : ctx.moveTo(x, y(h[i].demand)); }
  ctx.stroke(); ctx.setLineDash([]);
  // throughput area + line
  if (h.length > 1) {
    const grad = ctx.createLinearGradient(0, PAD, 0, PAD + plotH);
    grad.addColorStop(0, "rgba(78,161,255,.33)"); grad.addColorStop(1, "rgba(78,161,255,0)");
    ctx.beginPath(); ctx.moveTo(PAD + off * stepX, PAD + plotH);
    for (let i = 0; i < h.length; i++) ctx.lineTo(PAD + (off + i) * stepX, y(h[i].thru));
    ctx.lineTo(PAD + (off + h.length - 1) * stepX, PAD + plotH); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();
    ctx.strokeStyle = COL.thru; ctx.lineWidth = 2.2; ctx.shadowColor = COL.thru; ctx.shadowBlur = 8; ctx.beginPath();
    for (let i = 0; i < h.length; i++) { const x = PAD + (off + i) * stepX; i ? ctx.lineTo(x, y(h[i].thru)) : ctx.moveTo(x, y(h[i].thru)); }
    ctx.stroke(); ctx.shadowBlur = 0;
  }
  // action markers
  for (let i = 0; i < h.length; i++) { const a = h[i].action; if (a && a !== "None" && COL[a]) { ctx.fillStyle = COL[a]; ctx.fillRect(PAD + (off + i) * stepX - stepX / 2 + 1, H - BOTTOM + 5, Math.max(2, stepX - 2), 9); } }
}

/* ===== DOM ===== */
const el = (id) => document.getElementById(id);
const deviceSel = el("device"), pressure = el("pressure"), pressureVal = el("pressureVal");
const adocChk = el("adoc"), startBtn = el("startBtn"), resetBtn = el("resetBtn");
const ACTION_DESC = {
  MMO: "memory full → fewer threads, bigger batch",
  L0O: "L0 backed up → add threads",
  RDO: "redundancy high → add threads, smaller batch",
  None: "balanced — no overflow", off: "ADOC disabled (fixed knobs)",
};
let prevTotal = -1, prevFlush = -1, running = true;

function setClass(node, on) { node.classList.toggle("overflow", !!on); }
function setBadge(node, on) { node.classList.toggle("active", !!on); }

function paint(bw) {
  const k = sim.knobs, c = sim.cur;
  el("memFill").style.height = Math.min(100, sim.mem / (2 * k.batch) * 100) + "%";
  el("l0Fill").style.height = Math.min(100, sim.l0 / CFG.l0_threshold * 100) + "%";
  el("redunFill").style.height = Math.min(100, sim.redun / CFG.rdo_threshold * 100) + "%";
  el("l0count").textContent = Math.floor(sim.l0);
  setClass(el("memStage"), c.mmo); setClass(el("l0Stage"), c.l0o); setClass(el("deepStage"), c.rdo);
  setBadge(el("mmoBadge"), c.mmo); setBadge(el("l0oBadge"), c.l0o); setBadge(el("rdoBadge"), c.rdo);

  el("kThreads").textContent = k.total;
  el("kBatch").textContent = k.batch + " MB";
  el("batchBlock").style.width = Math.max(10, k.batch / 512 * 100) + "%";
  if (k.total !== prevTotal || k.flush !== prevFlush) {
    let html = "";
    for (let i = 0; i < k.total; i++) html += `<span class="worker ${i < k.flush ? "flush" : "comp"}"></span>`;
    el("workers").innerHTML = html; prevTotal = k.total; prevFlush = k.flush;
  }
  const a = sim.lastAction;
  const aEl = el("tAction");
  aEl.textContent = a === "off" ? "—" : a;
  aEl.style.color = COL[a] || "var(--muted)";
  el("actionDesc").textContent = ACTION_DESC[a] || "";

  const avg = sim.steps ? sim.totalThru / sim.steps : 0;
  el("tAvg").textContent = Math.round(avg) + " kOps/s";
  el("tStall").textContent = sim.stallSteps + " s";
  el("tTime").textContent = sim.t + " s";
}

function tick() {
  if (!running) return;
  const bw = parseFloat(deviceSel.value);
  const inRate = bw * (parseInt(pressure.value, 10) / 100);
  step(bw, inRate, adocChk.checked);
  draw(bw * 1.7);
  paint(bw);
}

pressure.addEventListener("input", () => { pressureVal.textContent = pressure.value + "%"; });
startBtn.addEventListener("click", () => { running = !running; startBtn.textContent = running ? "Pause" : "Resume"; });
resetBtn.addEventListener("click", () => { resetSim(); prevTotal = -1; draw(parseFloat(deviceSel.value) * 1.7); paint(); });
deviceSel.addEventListener("change", () => { resetSim(); prevTotal = -1; });

/* hero particles */
(function heroDots() {
  const c = el("heroDots"); if (!c) return;
  let html = "";
  for (let i = 0; i < 20; i++) {
    const left = Math.random() * 100, dur = 4 + Math.random() * 5, delay = Math.random() * 6;
    html += `<span style="left:${left}%;bottom:${Math.random() * 40}%;animation-duration:${dur}s;animation-delay:${delay}s"></span>`;
  }
  c.innerHTML = html;
})();

resetSim();
draw(parseFloat(deviceSel.value) * 1.7);
paint();
setInterval(tick, 130);
