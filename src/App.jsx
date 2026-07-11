import { useState, useRef, useEffect } from "react";
import {
  TrendingUp, TrendingDown, Minus, Plus, X,
  ChevronDown, Pencil, Check, Calendar,
  ImageIcon, Download, Sun, Moon, Search, Trash2,
} from "lucide-react";

// ─── Storage ──────────────────────────────────────────────────────────────────
const LS = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v != null ? JSON.parse(v) : d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};

// ─── Outcomes (3 only, all with custom RR input) ──────────────────────────────
const OUTCOMES = [
  { key: "win", label: "Win",         short: "WIN", needRR: true  },
  { key: "sl",  label: "Loss (SL)",   short: "SL",  needRR: true  },
  { key: "be",  label: "หน้าทุน (BE)", short: "BE",  needRR: false },
];

// ─── Theme ────────────────────────────────────────────────────────────────────
const T = {
  dark: {
    bg: "#070c14",
    nav: "rgba(7,12,20,0.82)",
    card: "rgba(255,255,255,0.04)",
    cardHover: "rgba(255,255,255,0.07)",
    border: "rgba(255,255,255,0.08)",
    borderHover: "rgba(255,255,255,0.18)",
    text: "#e8f0fc",
    sub: "#7990b0",
    dim: "#3d5068",
    input: "rgba(255,255,255,0.05)",
    overlay: "rgba(3,6,12,0.96)",
    win: "#34d399",
    loss: "#f87171",
    be: "#64748b",
    accent: "#60a5fa",
    accentGrad: "linear-gradient(135deg,#3b82f6,#6366f1)",
    accentInk: "#fff",
    winBg: "rgba(52,211,153,0.12)",
    lossBg: "rgba(248,113,113,0.12)",
    beBg: "rgba(100,116,139,0.10)",
    glow: "rgba(59,130,246,0.20)",
  },
  light: {
    bg: "#f0f5ff",
    nav: "rgba(240,245,255,0.88)",
    card: "rgba(255,255,255,0.85)",
    cardHover: "rgba(255,255,255,1)",
    border: "rgba(99,102,241,0.13)",
    borderHover: "rgba(99,102,241,0.35)",
    text: "#0f1829",
    sub: "#4a5c80",
    dim: "#94a3b8",
    input: "rgba(255,255,255,0.9)",
    overlay: "rgba(5,10,20,0.94)",
    win: "#059669",
    loss: "#dc2626",
    be: "#64748b",
    accent: "#4f46e5",
    accentGrad: "linear-gradient(135deg,#4f46e5,#7c3aed)",
    accentInk: "#fff",
    winBg: "rgba(5,150,105,0.10)",
    lossBg: "rgba(220,38,38,0.10)",
    beBg: "rgba(100,116,139,0.08)",
    glow: "rgba(79,70,229,0.15)",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("th-TH", { day: "2-digit", month: "short" })
    + " " + d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

function compressImage(file, max = 900, q = 0.72) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onerror = rej;
    r.onload = () => {
      const img = new window.Image();
      img.onerror = rej;
      img.onload = () => {
        let { width: w, height: h } = img;
        if (w > max || h > max) {
          if (w > h) { h = Math.round(h * max / w); w = max; }
          else { w = Math.round(w * max / h); h = max; }
        }
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        res(c.toDataURL("image/jpeg", q));
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}

function downloadCSV(trades) {
  const rows = [
    ["#", "วันที่", "ผล", "RR", "โน้ต"],
    ...[...trades].reverse().map((t, i) => {
      const o = OUTCOMES.find(x => x.key === t.outcome);
      return [i + 1, new Date(t.ts).toLocaleString("th-TH"), o?.short, t.rr, `"${(t.note || "").replace(/"/g, '""')}"`];
    }),
  ].map(r => r.join(",")).join("\n");
  const b = new Blob(["\uFEFF" + rows], { type: "text/csv;charset=utf-8;" });
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(b),
    download: `trades-${new Date().toISOString().slice(0, 10)}.csv`,
  });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// ─── Animated counter ─────────────────────────────────────────────────────────
function useAnim(target, dur = 550) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  const raf = useRef();
  useEffect(() => {
    const f = from.current, t = target;
    if (f === t) { setV(t); return; }
    const s = performance.now();
    const tick = now => {
      const p = Math.min(1, (now - s) / dur);
      setV(f + (t - f) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else from.current = t;
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target]);
  return v;
}

// ─── Win Rate Ring ────────────────────────────────────────────────────────────
function Ring({ rate, C }) {
  const a = useAnim(parseFloat(rate) || 0);
  const R = 38, circ = 2 * Math.PI * R;
  const color = a >= 55 ? C.win : a >= 35 ? C.accent : C.loss;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "16px 10px 12px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", minWidth: 0, boxSizing: "border-box", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 60% 20%,${color}18,transparent 70%)`, pointerEvents: "none" }} />
      <div style={{ position: "relative", width: 86, height: 86 }}>
        <svg width="86" height="86" viewBox="0 0 86 86">
          <circle cx="43" cy="43" r={R} fill="none" stroke={`${color}1a`} strokeWidth="7" />
          <circle cx="43" cy="43" r={R} fill="none" stroke={`${color}35`} strokeWidth="7"
            strokeDasharray={`${(a / 100) * circ} ${circ}`} strokeLinecap="round"
            transform="rotate(-90 43 43)" style={{ transition: "stroke-dasharray .65s cubic-bezier(.4,0,.2,1)" }} />
          <circle cx="43" cy="43" r={R} fill="none" stroke={color} strokeWidth="2.5"
            strokeDasharray={`${(a / 100) * circ} ${circ}`} strokeLinecap="round"
            transform="rotate(-90 43 43)"
            style={{ transition: "stroke-dasharray .65s cubic-bezier(.4,0,.2,1)", filter: `drop-shadow(0 0 5px ${color}80)` }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: "clamp(15px,4vw,19px)", fontWeight: 800, color, letterSpacing: "-0.03em", lineHeight: 1 }}>{a.toFixed(0)}%</div>
        </div>
      </div>
      <div style={{ fontSize: 9, color: C.dim, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 8, fontFamily: "ui-monospace,monospace" }}>Win Rate</div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function Stat({ icon, label, value, dec = 0, color, sub, C }) {
  const a = useAnim(value);
  const disp = dec ? a.toFixed(dec) : Math.round(a);
  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "13px 12px 11px", background: C.card, border: `1px solid ${C.border}`, borderTop: `2px solid ${color}`, borderRadius: 18, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", minWidth: 0, boxSizing: "border-box", overflow: "hidden", position: "relative" }}>
      <div style={{ position: "absolute", top: -20, right: -20, width: 64, height: 64, borderRadius: "50%", background: color, opacity: 0.1, filter: "blur(16px)", pointerEvents: "none" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 9 }}>
        <span style={{ width: 18, height: 18, borderRadius: 6, background: `${color}1e`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</span>
        <span style={{ fontSize: 9, color: C.dim, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", fontFamily: "ui-monospace,monospace" }}>{label}</span>
      </div>
      <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "clamp(18px,5vw,26px)", fontWeight: 800, color, letterSpacing: "-0.03em", lineHeight: 1 }}>
        {value > 0 && dec ? "+" : ""}{disp}
      </div>
      {sub && <div style={{ fontSize: 9, color: C.dim, marginTop: 6, fontFamily: "ui-monospace,monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>}
    </div>
  );
}

// ─── Equity Chart ─────────────────────────────────────────────────────────────
function Chart({ trades, C }) {
  if (trades.length < 2) return (
    <div style={{ height: 100, display: "flex", alignItems: "center", justifyContent: "center", color: C.dim, fontSize: 12 }}>
      เพิ่มอย่างน้อย 2 ไม้เพื่อดูกราฟ
    </div>
  );
  const W = 640, H = 108, P = { t: 10, b: 18, l: 30, r: 8 };
  const cw = W - P.l - P.r, ch = H - P.t - P.b;
  const ordered = [...trades].reverse();
  let cum = 0;
  const vals = ordered.map(t => { cum += t.rr; return cum; });
  const minV = Math.min(0, ...vals), maxV = Math.max(0, ...vals);
  const range = maxV - minV || 1;
  const px = i => P.l + (i / (vals.length - 1)) * cw;
  const py = v => P.t + (1 - (v - minV) / range) * ch;
  const y0 = py(0), last = vals[vals.length - 1];
  const color = last >= 0 ? C.win : C.loss;
  const pts = vals.map((v, i) => ({ x: px(i), y: py(v) }));
  let path = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const mx = (pts[i - 1].x + pts[i].x) / 2;
    path += ` C${mx.toFixed(1)},${pts[i - 1].y.toFixed(1)} ${mx.toFixed(1)},${pts[i].y.toFixed(1)} ${pts[i].x.toFixed(1)},${pts[i].y.toFixed(1)}`;
  }
  const area = path + ` L${px(vals.length - 1).toFixed(1)},${y0.toFixed(1)} L${px(0).toFixed(1)},${y0.toFixed(1)} Z`;
  const grids = [0, 0.5, 1].map(p => ({ yg: P.t + p * ch, label: (maxV - p * range).toFixed(1) }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 100, display: "block" }}>
      <defs>
        <linearGradient id="cg3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <filter id="gf"><feGaussianBlur stdDeviation="1.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      {grids.map(({ yg, label }, i) => (
        <g key={i}>
          <line x1={P.l} y1={yg} x2={W - P.r} y2={yg} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <text x={P.l - 4} y={yg + 3.5} textAnchor="end" fontSize="7.5" fill={C.dim} fontFamily="ui-monospace,monospace">{label}</text>
        </g>
      ))}
      <line x1={P.l} y1={y0} x2={W - P.r} y2={y0} stroke="rgba(255,255,255,0.14)" strokeWidth="1" strokeDasharray="4,4" />
      <path d={area} fill="url(#cg3)" />
      <path d={path} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" filter="url(#gf)" />
      <circle cx={px(vals.length - 1)} cy={py(last)} r="9" fill={color} fillOpacity="0.18" />
      <circle cx={px(vals.length - 1)} cy={py(last)} r="4" fill={color} style={{ filter: `drop-shadow(0 0 5px ${color})` }} />
    </svg>
  );
}

// ─── Trade Row ────────────────────────────────────────────────────────────────
function Row({ trade, index, total, onRemove, onSave, setLightbox, C }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [eO, setEO] = useState(trade.outcome);
  const [eRR, setERR] = useState(String(trade.rr));
  const [eN, setEN] = useState(trade.note || "");
  const o = OUTCOMES.find(x => x.key === trade.outcome);
  const oColor = trade.rr > 0 ? C.win : trade.rr < 0 ? C.loss : C.be;
  const rrBg = trade.rr > 0 ? C.winBg : trade.rr < 0 ? C.lossBg : C.beBg;

  function save() {
    const eo = OUTCOMES.find(x => x.key === eO);
    const rr = eo.needRR ? (parseFloat(eRR) || 0) : 0;
    onSave({ ...trade, outcome: eO, rr, note: eN });
    setEditing(false); setOpen(true);
  }

  return (
    <div
      style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", transition: "border-color .2s, box-shadow .2s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderHover; e.currentTarget.style.boxShadow = `0 4px 20px ${oColor}12`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = "none"; }}
    >
      <div style={{ height: 2, background: `linear-gradient(90deg,${oColor},${oColor}00)` }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 13px", cursor: "pointer" }} onClick={() => { if (!editing) setOpen(p => !p); }}>
        <span style={{ fontSize: 9, color: C.dim, width: 20, fontFamily: "ui-monospace,monospace", flexShrink: 0 }}>#{total - index}</span>
        <span style={{ fontSize: 10, fontWeight: 800, color: oColor, border: `1px solid ${oColor}40`, borderRadius: 7, padding: "2px 8px", fontFamily: "ui-monospace,monospace", minWidth: 36, textAlign: "center", flexShrink: 0, background: `${oColor}15`, letterSpacing: "0.02em" }}>
          {o?.short}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: trade.note ? C.text : C.dim, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{trade.note || "—"}</div>
          <div style={{ fontSize: 9, color: C.dim, display: "flex", alignItems: "center", gap: 3, marginTop: 2, fontFamily: "ui-monospace,monospace" }}>
            <Calendar size={8} />{fmtDate(trade.ts)}
          </div>
        </div>
        {trade.image && (
          <img src={trade.image} alt="" onClick={e => { e.stopPropagation(); setLightbox(trade.image); }}
            style={{ width: 28, height: 28, objectFit: "cover", borderRadius: 7, border: `1px solid ${C.border}`, cursor: "zoom-in", flexShrink: 0 }} />
        )}
        <span style={{ fontSize: 12, fontWeight: 800, fontFamily: "ui-monospace,monospace", color: oColor, background: rrBg, borderRadius: 8, padding: "3px 9px", flexShrink: 0, letterSpacing: "0.01em" }}>
          {trade.rr > 0 ? "+" : ""}{trade.rr}R
        </span>
        <ChevronDown size={11} color={C.dim} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .22s", flexShrink: 0 }} />
      </div>

      {open && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: "13px", background: "rgba(0,0,0,0.12)" }}>
          {editing ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <div style={{ fontSize: 9, color: C.dim, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "ui-monospace,monospace", marginBottom: 6 }}>ผลลัพธ์</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {OUTCOMES.map(oo => (
                    <button key={oo.key} onClick={() => setEO(oo.key)}
                      style={{ border: `1px solid ${eO === oo.key ? C.accent : C.border}`, background: eO === oo.key ? `${C.accent}18` : "transparent", color: eO === oo.key ? C.accent : C.dim, borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                      {oo.short}
                    </button>
                  ))}
                </div>
              </div>
              {OUTCOMES.find(x => x.key === eO)?.needRR && (
                <div>
                  <div style={{ fontSize: 9, color: C.dim, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "ui-monospace,monospace", marginBottom: 5 }}>RR</div>
                  <input type="number" step="0.1" value={eRR} onChange={e => setERR(e.target.value)}
                    style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 11px", color: C.text, fontSize: 13, fontFamily: "ui-monospace,monospace", boxSizing: "border-box", outline: "none" }} />
                </div>
              )}
              <div>
                <div style={{ fontSize: 9, color: C.dim, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "ui-monospace,monospace", marginBottom: 5 }}>โน้ต</div>
                <input type="text" value={eN} onChange={e => setEN(e.target.value)} placeholder="เช่น XAUUSD H4"
                  style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 11px", color: C.text, fontSize: 13, boxSizing: "border-box", outline: "none" }} />
              </div>
              <div style={{ display: "flex", gap: 7 }}>
                <button onClick={save} style={{ flex: 1, background: C.accentGrad, color: C.accentInk, border: "none", borderRadius: 9, padding: "9px 0", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                  <Check size={12} /> บันทึก
                </button>
                <button onClick={() => setEditing(false)} style={{ flex: 1, background: "rgba(255,255,255,0.06)", color: C.sub, border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 0", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>ยกเลิก</button>
              </div>
            </div>
          ) : (
            <div>
              {trade.image && <img src={trade.image} alt="chart" onClick={() => setLightbox(trade.image)} style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 10, marginBottom: 10, cursor: "zoom-in", border: `1px solid ${C.border}` }} />}
              {trade.note && <div style={{ fontSize: 12, color: C.sub, marginBottom: 10, lineHeight: 1.65 }}>{trade.note}</div>}
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <button onClick={e => { e.stopPropagation(); setEditing(true); }}
                  style={{ display: "flex", alignItems: "center", gap: 4, background: `${C.accent}14`, border: `1px solid ${C.accent}30`, borderRadius: 8, padding: "5px 11px", fontSize: 11, fontWeight: 600, color: C.accent, cursor: "pointer" }}>
                  <Pencil size={11} /> แก้ไข
                </button>
                <button onClick={e => { e.stopPropagation(); if (window.confirm("ลบไม้นี้?")) onRemove(trade.id); }}
                  style={{ display: "flex", alignItems: "center", gap: 4, background: C.lossBg, border: `1px solid ${C.loss}30`, borderRadius: 8, padding: "5px 11px", fontSize: 11, fontWeight: 600, color: C.loss, cursor: "pointer" }}>
                  <Trash2 size={11} /> ลบ
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [trades, setTrades] = useState(() => LS.get("tj-v3", []));
  const [dark, setDark] = useState(() => LS.get("tj-dark", true));
  const [openForm, setOpenForm] = useState(null);
  const [rr, setRR] = useState("");
  const [note, setNote] = useState("");
  const [img, setImg] = useState(null);
  const [imgBusy, setImgBusy] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [lightbox, setLightbox] = useState(null);
  const [flash, setFlash] = useState(null);
  const [err, setErr] = useState(false);
  const fileRef = useRef(null);
  const errT = useRef(null);

  const C = dark ? T.dark : T.light;

  function persist(next) {
    setTrades(next);
    if (!LS.set("tj-v3", next)) {
      setErr(true);
      if (errT.current) clearTimeout(errT.current);
      errT.current = setTimeout(() => setErr(false), 4000);
    } else setErr(false);
  }

  function addTrade(key) {
    const o = OUTCOMES.find(x => x.key === key);
    const rrVal = o.needRR ? (parseFloat(rr) || 0) : 0;
    const t = { id: uid(), outcome: key, rr: rrVal, note: note.trim(), image: img || null, ts: new Date().toISOString() };
    persist([t, ...trades].slice(0, 200));
    setOpenForm(null); setRR(""); setNote(""); setImg(null);
    setFlash(t.id); setTimeout(() => setFlash(null), 700);
  }

  async function onFile(e) {
    const f = e.target.files?.[0]; if (!f) return;
    setImgBusy(true);
    try { setImg(await compressImage(f)); } catch { setErr(true); }
    setImgBusy(false); e.target.value = "";
  }

  // Stats
  const count = trades.length;
  const MAX = 100;
  const wins = trades.filter(t => t.rr > 0).length;
  const losses = trades.filter(t => t.rr < 0).length;
  const bes = trades.filter(t => t.rr === 0).length;
  const closed = trades.filter(t => t.outcome !== "running");
  const totalRR = trades.reduce((s, t) => s + t.rr, 0);
  const winRate = closed.length ? ((wins / closed.length) * 100).toFixed(1) : "0.0";
  const pct = Math.min(100, (count / MAX) * 100);
  const tRRC = totalRR > 0 ? C.win : totalRR < 0 ? C.loss : C.dim;

  let filtered = filter === "all" ? trades : trades.filter(t => t.outcome === filter);
  if (search.trim()) filtered = filtered.filter(t => (t.note || "").toLowerCase().includes(search.toLowerCase()));

  const outcomeRRColor = (key) => {
    if (key === "win") return C.win;
    if (key === "sl") return C.loss;
    return C.be;
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Inter',ui-sans-serif,system-ui,sans-serif", transition: "background .3s,color .3s", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=JetBrains+Mono:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap');
        @keyframes up{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pop{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
        @keyframes b1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-3%,4%) scale(1.06)}}
        @keyframes b2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(4%,-3%) scale(1.08)}}
        *{box-sizing:border-box}
        html,body{margin:0;width:100%;overflow-x:hidden;-webkit-text-size-adjust:100%}
        input::placeholder{color:${C.dim}}
        input:focus,select:focus{border-color:${C.accent}70!important;box-shadow:0 0 0 3px ${C.accent}18!important;outline:none}
        button{font-family:inherit;cursor:pointer;transition:all .18s ease}
        select{font-family:inherit;appearance:none;-webkit-appearance:none}
        .hov:hover{transform:translateY(-1px);opacity:.9}
      `}</style>

      {/* Background blobs */}
      <div aria-hidden style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
        {dark ? (
          <>
            <div style={{ position: "absolute", top: "-15%", left: "-12%", width: "65vw", height: "65vw", maxWidth: 480, maxHeight: 480, borderRadius: "50%", background: "radial-gradient(circle,#1e3a8a,transparent 70%)", opacity: 0.5, animation: "b1 22s ease-in-out infinite" }} />
            <div style={{ position: "absolute", bottom: "-12%", right: "-12%", width: "55vw", height: "55vw", maxWidth: 420, maxHeight: 420, borderRadius: "50%", background: "radial-gradient(circle,#0f3460,transparent 70%)", opacity: 0.45, animation: "b2 26s ease-in-out infinite" }} />
            <div style={{ position: "absolute", top: "30%", right: "5%", width: "30vw", height: "30vw", maxWidth: 240, maxHeight: 240, borderRadius: "50%", background: "radial-gradient(circle,#1e1b4b,transparent 70%)", opacity: 0.5 }} />
            <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,0.025) 1px,transparent 1px)", backgroundSize: "28px 28px" }} />
          </>
        ) : (
          <>
            <div style={{ position: "absolute", top: "-10%", right: "-10%", width: "60vw", height: "60vw", maxWidth: 460, maxHeight: 460, borderRadius: "50%", background: "radial-gradient(circle,#dbeafe,transparent 70%)", opacity: 0.9, animation: "b1 22s ease-in-out infinite" }} />
            <div style={{ position: "absolute", bottom: "-10%", left: "-10%", width: "50vw", height: "50vw", maxWidth: 380, maxHeight: 380, borderRadius: "50%", background: "radial-gradient(circle,#ede9fe,transparent 70%)", opacity: 0.8, animation: "b2 26s ease-in-out infinite" }} />
          </>
        )}
      </div>

      {/* Nav */}
      <nav style={{ position: "sticky", top: 0, zIndex: 10, borderBottom: `1px solid ${C.border}`, background: C.nav, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", padding: "0 16px" }}>
        <div style={{ maxWidth: 780, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 50 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0, overflow: "hidden" }}>
            <div style={{ width: 28, height: 28, borderRadius: 9, background: C.accentGrad, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 14px ${C.glow}`, flexShrink: 0 }}>
              <TrendingUp size={14} color="#fff" />
            </div>
            <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 14, fontWeight: 800, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>TradeJournal</span>
            {count > 0 && (
              <span style={{ fontSize: 10, fontWeight: 700, color: tRRC, background: totalRR >= 0 ? C.winBg : C.lossBg, borderRadius: 6, padding: "2px 7px", fontFamily: "ui-monospace,monospace", flexShrink: 0 }}>
                {totalRR >= 0 ? "+" : ""}{totalRR.toFixed(1)}R
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
            {[
              { icon: <Download size={13} />, fn: () => downloadCSV(trades) },
              { icon: dark ? <Sun size={13} /> : <Moon size={13} />, fn: () => { setDark(p => { LS.set("tj-dark", !p); return !p; }); } },
            ].map((b, i) => (
              <button key={i} className="hov" onClick={b.fn}
                style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", color: C.sub, backdropFilter: "blur(10px)" }}>
                {b.icon}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 780, margin: "0 auto", padding: "20px 14px 60px", position: "relative", zIndex: 1 }}>

        {/* Sub header */}
        <div style={{ fontSize: 9, color: C.dim, fontFamily: "ui-monospace,monospace", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14, textAlign: "center" }}>
          SL 200 จุด · RR กำหนดเอง · เป้าหมาย 100 ไม้
        </div>

        {err && (
          <div style={{ fontSize: 12, color: C.loss, background: C.lossBg, border: `1px solid ${C.loss}35`, borderRadius: 10, padding: "9px 13px", marginBottom: 14, animation: "up .2s ease" }}>
            บันทึกไม่สำเร็จ — พื้นที่เก็บข้อมูลอาจเต็ม
          </div>
        )}

        {/* KPI — Win rate ring + 3 stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
          <Ring rate={winRate} C={C} />
          <Stat C={C} icon={<TrendingUp size={11} color={C.win} />} label="Win" value={wins} color={C.win} sub={`${winRate}% of closed`} />
          <Stat C={C} icon={<TrendingDown size={11} color={C.loss} />} label="Loss" value={losses} color={C.loss} sub={`SL ${losses}×`} />
          <div style={{ position: "relative", background: `linear-gradient(160deg,${tRRC}14,${C.card} 60%)`, border: `1px solid ${tRRC}35`, borderTop: `2px solid ${tRRC}`, borderRadius: 18, overflow: "hidden", minWidth: 0, boxSizing: "border-box", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
            <div style={{ position: "absolute", top: -20, right: -20, width: 70, height: 70, borderRadius: "50%", background: tRRC, opacity: 0.15, filter: "blur(18px)", pointerEvents: "none" }} />
            <Stat C={{ ...C, card: "transparent", border: "transparent" }} icon={<TrendingUp size={11} color={tRRC} />} label="Total RR" value={totalRR} dec={2} color={tRRC} sub={`${count} ไม้ · เหลือ ${Math.max(0, 100 - count)}`} />
          </div>
        </div>

        {/* BE + Progress */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          <Stat C={C} icon={<Minus size={11} color={C.be} />} label="BE · หน้าทุน" value={bes} color={C.be} />
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: "12px 13px", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 9, color: C.dim, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", fontFamily: "ui-monospace,monospace" }}>ความคืบหน้า</span>
              <span style={{ fontSize: 9, color: C.accent, fontFamily: "ui-monospace,monospace", fontWeight: 800 }}>{pct.toFixed(0)}%</span>
            </div>
            <div style={{ height: 5, borderRadius: 99, background: `${C.accent}18`, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, background: C.accentGrad, transition: "width .6s cubic-bezier(.4,0,.2,1)", boxShadow: `0 0 8px ${C.accent}50` }} />
            </div>
            <div style={{ fontSize: 9, color: C.dim, marginTop: 7, fontFamily: "ui-monospace,monospace" }}>{count} / 100 ไม้</div>
          </div>
        </div>

        {/* Chart */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: "16px", marginBottom: 22, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, fontWeight: 800, letterSpacing: "-0.01em" }}>Equity Curve</div>
              <div style={{ fontSize: 9, color: C.dim, marginTop: 2, fontFamily: "ui-monospace,monospace" }}>ผล RR สะสมทุกไม้</div>
            </div>
            <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 12, fontWeight: 800, color: tRRC, background: `${tRRC}18`, borderRadius: 8, padding: "3px 10px" }}>
              {totalRR > 0 ? "+" : ""}{totalRR.toFixed(2)} R
            </span>
          </div>
          <Chart trades={trades} C={C} />
        </div>

        {/* Add trade form */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: "16px", marginBottom: 22, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
          <div style={{ fontSize: 10, color: C.dim, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "ui-monospace,monospace", marginBottom: 13 }}>+ บันทึกผลเทรด</div>

          {/* Outcome selector */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginBottom: 13 }}>
            {OUTCOMES.map(o => {
              const ac = openForm === o.key;
              const oc = outcomeRRColor(o.key);
              return (
                <button key={o.key} onClick={() => { setOpenForm(ac ? null : o.key); setRR(""); setNote(""); setImg(null); }}
                  style={{ border: `1px solid ${ac ? oc : C.border}`, background: ac ? `${oc}18` : "transparent", color: ac ? oc : C.sub, borderRadius: 11, padding: "10px 8px", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, boxShadow: ac ? `0 0 18px ${oc}22` : "none", transition: "all .18s ease" }}>
                  <Plus size={11} style={{ transform: ac ? "rotate(45deg)" : "none", transition: "transform .18s" }} />
                  {o.label}
                </button>
              );
            })}
          </div>

          {openForm && (
            <div style={{ animation: "pop .18s ease" }}>
              <div style={{ height: 1, background: `linear-gradient(90deg,${C.border},transparent)`, marginBottom: 13 }} />

              {/* RR input */}
              {OUTCOMES.find(x => x.key === openForm)?.needRR && (
                <div style={{ marginBottom: 11 }}>
                  <div style={{ fontSize: 9, color: C.dim, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "ui-monospace,monospace", marginBottom: 5 }}>
                    RR ที่ได้ {openForm === "sl" ? "(ใส่เป็นลบ เช่น -1)" : "(เช่น 3.5)"}
                  </div>
                  <input type="number" step="0.1" value={rr} onChange={e => setRR(e.target.value)}
                    placeholder={openForm === "sl" ? "-1" : "3.5"}
                    style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", color: C.text, fontSize: 14, fontFamily: "ui-monospace,monospace", boxSizing: "border-box", outline: "none" }} />
                </div>
              )}

              {/* Note */}
              <div style={{ marginBottom: 11 }}>
                <div style={{ fontSize: 9, color: C.dim, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "ui-monospace,monospace", marginBottom: 5 }}>โน้ต (ไม่บังคับ)</div>
                <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="เช่น XAUUSD H4 breakout"
                  style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", color: C.text, fontSize: 13, boxSizing: "border-box", outline: "none" }} />
              </div>

              {/* Image */}
              <div style={{ marginBottom: 13 }}>
                <div style={{ fontSize: 9, color: C.dim, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "ui-monospace,monospace", marginBottom: 5 }}>รูปกราฟ (ไม่บังคับ)</div>
                <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
                {!img ? (
                  <button onClick={() => fileRef.current?.click()} disabled={imgBusy}
                    style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "rgba(255,255,255,0.04)", border: `1.5px dashed ${C.border}`, borderRadius: 10, padding: "11px 0", color: C.dim, fontSize: 12, fontWeight: 600 }}>
                    <ImageIcon size={14} />{imgBusy ? "กำลังประมวลผล..." : "แนบรูปกราฟ"}
                  </button>
                ) : (
                  <div style={{ position: "relative" }}>
                    <img src={img} alt="preview" style={{ width: "100%", maxHeight: 155, objectFit: "cover", borderRadius: 10, border: `1px solid ${C.border}`, display: "block" }} />
                    <button onClick={() => setImg(null)} style={{ position: "absolute", top: 7, right: 7, background: "rgba(0,0,0,0.7)", border: "none", borderRadius: 99, width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>

              <button onClick={() => addTrade(openForm)}
                style={{ width: "100%", background: C.accentGrad, color: C.accentInk, border: "none", borderRadius: 11, padding: "12px 0", fontSize: 13, fontWeight: 700, boxShadow: `0 6px 20px ${C.glow}` }}>
                บันทึกไม้นี้
              </button>
            </div>
          )}
        </div>

        {/* History */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 9, color: C.dim, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "ui-monospace,monospace" }}>ประวัติ ({filtered.length})</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {[{ key: "all", label: "ทั้งหมด" }, { key: "win", label: "WIN" }, { key: "sl", label: "SL" }, { key: "be", label: "BE" }].map(({ key, label }) => (
              <button key={key} onClick={() => setFilter(key)}
                style={{ border: `1px solid ${filter === key ? `${C.accent}60` : C.border}`, background: filter === key ? `${C.accent}14` : "transparent", color: filter === key ? C.accent : C.dim, borderRadius: 7, padding: "4px 10px", fontSize: 9, fontWeight: 700, fontFamily: "ui-monospace,monospace", backdropFilter: "blur(10px)" }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 10 }}>
          <Search size={12} color={C.dim} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาโน้ต..."
            style={{ width: "100%", background: C.card, border: `1px solid ${C.border}`, borderRadius: 11, padding: "9px 11px 9px 30px", color: C.text, fontSize: 12, boxSizing: "border-box", outline: "none", backdropFilter: "blur(10px)" }} />
        </div>

        {count === 0 ? (
          <div style={{ color: C.dim, fontSize: 12, padding: "32px 0", textAlign: "center", border: `1px dashed ${C.border}`, borderRadius: 16, background: C.card, backdropFilter: "blur(10px)" }}>
            ยังไม่มีรายการ — เริ่มบันทึกไม้แรกได้เลย
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ color: C.dim, fontSize: 12, padding: "22px 0", textAlign: "center", border: `1px dashed ${C.border}`, borderRadius: 16 }}>ไม่พบรายการ</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {filtered.map(t => (
              <div key={t.id} style={{ animation: flash === t.id ? "pop .5s ease" : undefined }}>
                <Row trade={t} index={trades.indexOf(t)} total={count} onRemove={id => persist(trades.filter(x => x.id !== id))} onSave={u => persist(trades.map(x => x.id === u.id ? u : x))} setLightbox={setLightbox} C={C} />
              </div>
            ))}
          </div>
        )}

        {count > 0 && (
          <button onClick={() => { if (window.confirm("ล้างสถิติทั้งหมด? กู้คืนไม่ได้")) persist([]); }}
            style={{ marginTop: 22, background: "none", border: `1px solid ${C.loss}40`, color: C.loss, borderRadius: 9, padding: "7px 14px", fontSize: 11, fontWeight: 700 }}>
            ล้างสถิติทั้งหมด
          </button>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)}
          style={{ position: "fixed", inset: 0, background: C.overlay, backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16, animation: "pop .15s ease" }}>
          <img src={lightbox} alt="chart" onClick={e => e.stopPropagation()}
            style={{ maxWidth: "100%", maxHeight: "90vh", borderRadius: 16, boxShadow: "0 28px 70px rgba(0,0,0,0.6)", border: `1px solid ${C.border}` }} />
          <button onClick={() => setLightbox(null)}
            style={{ position: "fixed", top: 16, right: 16, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 99, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}