import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, TrendingUp, TrendingDown, Minus, Activity, AlertTriangle, Image as ImageIcon, X } from "lucide-react";

const OUTCOMES = [
  { key: "be", label: "โดนหน้าทุน", short: "BE", color: "#64748b", rr: 0 },
  { key: "sl", label: "โดน SL", short: "SL", color: "#fb5673", rr: -1 },
  { key: "tp3", label: "+3 RR (เป้า)", short: "+3R", color: "#06c281", rr: 3 },
  { key: "running", label: "RR ตามสวิง (ไม้รันอยู่)", short: "RUN", color: "#f59e0b", rr: null, needsPeak: true },
];

const STORAGE_KEY = "trade-journal-data";
const MAX_TRADES = 100;

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function loadTrades() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

// Resize + compress an image file down to a small base64 JPEG so it doesn't blow up localStorage
function compressImage(file, maxDim = 900, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("image load failed"));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function StatCard({ label, value, color, icon }) {
  return (
    <div
      style={{
        position: "relative",
        background: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(255,255,255,0.6)",
        borderRadius: 16,
        padding: "15px 14px",
        overflow: "hidden",
        boxShadow: "0 4px 20px rgba(99,60,217,0.08)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -24,
          right: -24,
          width: 70,
          height: 70,
          borderRadius: "50%",
          background: color,
          opacity: 0.22,
          filter: "blur(16px)",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 5, color, marginBottom: 8, position: "relative" }}>
        {icon}
        <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontWeight: 700 }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 23, fontWeight: 800, letterSpacing: "-0.02em", position: "relative", color: "#1e1b3a" }}>{value}</div>
    </div>
  );
}

export default function App() {
  const [trades, setTrades] = useState(() => loadTrades());
  const [openOutcome, setOpenOutcome] = useState(null);
  const [customRR, setCustomRR] = useState("");
  const [note, setNote] = useState("");
  const [imageData, setImageData] = useState(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [saveError, setSaveError] = useState(false);
  const [justAdded, setJustAdded] = useState(null);
  const errorTimeout = useRef(null);
  const fileInputRef = useRef(null);

  function persist(next) {
    setTrades(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSaveError(false);
    } catch (e) {
      setSaveError(true);
      if (errorTimeout.current) clearTimeout(errorTimeout.current);
      errorTimeout.current = setTimeout(() => setSaveError(false), 4000);
    }
  }

  function addTrade(outcomeKey) {
    const o = OUTCOMES.find((x) => x.key === outcomeKey);
    let rr = o.rr;
    if (o.needsPeak) {
      const parsed = parseFloat(customRR);
      rr = isNaN(parsed) ? 0 : parsed;
    }
    const trade = {
      id: uid(),
      outcome: outcomeKey,
      rr,
      note: note.trim(),
      image: imageData || null,
      ts: new Date().toISOString(),
    };
    const next = [trade, ...trades].slice(0, MAX_TRADES + 200);
    persist(next);
    setOpenOutcome(null);
    setCustomRR("");
    setNote("");
    setImageData(null);
    setJustAdded(trade.id);
    setTimeout(() => setJustAdded(null), 650);
  }

  async function handleImageSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageBusy(true);
    try {
      const dataUrl = await compressImage(file);
      setImageData(dataUrl);
    } catch (err) {
      setSaveError(true);
      if (errorTimeout.current) clearTimeout(errorTimeout.current);
      errorTimeout.current = setTimeout(() => setSaveError(false), 4000);
    }
    setImageBusy(false);
    e.target.value = "";
  }

  function removeTrade(id) {
    persist(trades.filter((t) => t.id !== id));
  }

  function resetAll() {
    if (window.confirm("ล้างสถิติทั้งหมด? กู้คืนไม่ได้")) {
      persist([]);
    }
  }

  const count = trades.length;
  const wins = trades.filter((t) => t.rr > 0).length;
  const losses = trades.filter((t) => t.rr < 0).length;
  const breakevens = trades.filter((t) => t.rr === 0).length;
  const running = trades.filter((t) => t.outcome === "running").length;
  const closed = trades.filter((t) => t.outcome !== "running");
  const totalRR = trades.reduce((s, t) => s + t.rr, 0);
  const winRate = closed.length ? ((wins / closed.length) * 100).toFixed(1) : "0.0";
  const remaining = Math.max(0, MAX_TRADES - count);
  const progressPct = Math.min(100, (count / MAX_TRADES) * 100);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg, #fef3ff 0%, #eef1ff 35%, #e6fff5 100%)",
        color: "#1e1b3a",
        fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700;800&family=JetBrains+Mono:wght@400;600;700&family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes popIn { 0% { transform: scale(0.96) translateY(2px); opacity: 0; } 100% { transform: scale(1) translateY(0); opacity: 1; } }
        @keyframes flash { 0% { background: rgba(6,194,129,0.18); } 100% { background: transparent; } }
        @keyframes slideDown { 0% { opacity: 0; transform: translateY(-6px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes blob1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(30px,-20px) scale(1.1); } }
        @keyframes blob2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-25px,25px) scale(1.08); } }
        input::placeholder { color: #a3a0c2; }
        button { font-family: inherit; }
        .add-btn:hover { filter: brightness(1.05); transform: translateY(-1px); }
        .save-btn:hover { filter: brightness(1.08); transform: translateY(-1px); box-shadow: 0 8px 22px rgba(124,58,237,0.35) !important; }
        .trash-btn:hover { color: #fb5673 !important; }
        .reset-btn:hover { border-color: #fb5673 !important; color: #fb5673 !important; background: rgba(251,86,115,0.06) !important; }
      `}</style>

      {/* decorative blurred blobs */}
      <div style={{ position: "fixed", top: -80, left: -80, width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle, #a78bfa66, transparent 70%)", filter: "blur(10px)", animation: "blob1 14s ease-in-out infinite", pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: -100, right: -100, width: 360, height: 360, borderRadius: "50%", background: "radial-gradient(circle, #34d39955, transparent 70%)", filter: "blur(10px)", animation: "blob2 16s ease-in-out infinite", pointerEvents: "none" }} />

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 18px 80px", position: "relative" }}>
        {/* Header */}
        <div style={{ marginBottom: 26 }}>
          <div
            style={{
              display: "inline-block",
              fontSize: 10.5,
              letterSpacing: "0.16em",
              color: "#7c3aed",
              textTransform: "uppercase",
              marginBottom: 10,
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontWeight: 700,
              background: "rgba(124,58,237,0.1)",
              border: "1px solid rgba(124,58,237,0.25)",
              borderRadius: 99,
              padding: "4px 12px",
            }}
          >
            Trade Journal · เป้าหมาย {MAX_TRADES} ไม้
          </div>
          <h1
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize: 34,
              fontWeight: 800,
              margin: 0,
              letterSpacing: "-0.02em",
              background: "linear-gradient(120deg, #7c3aed 0%, #ec4899 50%, #f59e0b 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            สถิติเทรด
          </h1>
          <div style={{ fontSize: 13, color: "#5b5780", marginTop: 8, lineHeight: 1.65, fontWeight: 500 }}>
            SL 200 จุด · RR ขั้นต่ำ 1:3 หรือรันตามสวิง (กันหน้าทุน)
          </div>
        </div>

        {saveError && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(251,86,115,0.1)",
              border: "1px solid rgba(251,86,115,0.35)",
              color: "#d23659",
              borderRadius: 12,
              padding: "10px 13px",
              fontSize: 12.5,
              marginBottom: 18,
              animation: "slideDown 0.2s ease",
              fontWeight: 600,
            }}
          >
            <AlertTriangle size={15} style={{ flexShrink: 0 }} />
            บันทึกไม่สำเร็จ — พื้นที่จัดเก็บของเบราว์เซอร์อาจเต็มหรือถูกบล็อก
          </div>
        )}

        {/* Progress bar */}
        <div style={{ marginBottom: 26 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#5b5780", marginBottom: 8, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontWeight: 600 }}>
            <span>{count} / {MAX_TRADES} ไม้</span>
            <span>เหลืออีก {remaining} ไม้</span>
          </div>
          <div style={{ height: 9, borderRadius: 99, background: "rgba(124,58,237,0.1)", overflow: "hidden", boxShadow: "inset 0 1px 3px rgba(99,60,217,0.12)" }}>
            <div
              style={{
                height: "100%",
                width: `${progressPct}%`,
                borderRadius: 99,
                background: "linear-gradient(90deg, #7c3aed, #ec4899, #f59e0b)",
                transition: "width 0.45s cubic-bezier(.4,0,.2,1)",
                boxShadow: "0 0 14px rgba(124,58,237,0.45)",
              }}
            />
          </div>
        </div>

        {/* Stat grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 12 }}>
          <StatCard label="Win" value={wins} color="#06c281" icon={<TrendingUp size={14} />} />
          <StatCard label="Loss" value={losses} color="#fb5673" icon={<TrendingDown size={14} />} />
          <StatCard label="BE" value={breakevens} color="#64748b" icon={<Minus size={14} />} />
          <StatCard label="Running" value={running} color="#f59e0b" icon={<Activity size={14} />} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 32 }}>
          <div style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.6)", borderRadius: 16, padding: "17px 18px", boxShadow: "0 4px 20px rgba(99,60,217,0.08)" }}>
            <div style={{ fontSize: 11, color: "#7a76a3", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontWeight: 700 }}>
              Win rate (closed)
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", color: "#7c3aed" }}>{winRate}%</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.6)", borderRadius: 16, padding: "17px 18px", boxShadow: "0 4px 20px rgba(99,60,217,0.08)" }}>
            <div style={{ fontSize: 11, color: "#7a76a3", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontWeight: 700 }}>
              Total RR
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", color: totalRR > 0 ? "#06c281" : totalRR < 0 ? "#fb5673" : "#1e1b3a" }}>
              {totalRR > 0 ? "+" : ""}{totalRR.toFixed(2)} R
            </div>
          </div>
        </div>

        {/* Add trade */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 12, color: "#7a76a3", marginBottom: 12, fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: "0.03em", fontWeight: 700 }}>
            + เพิ่มผลเทรด
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
            {OUTCOMES.map((o) => {
              const active = openOutcome === o.key;
              return (
                <button
                  key={o.key}
                  className="add-btn"
                  onClick={() => {
                    const willOpen = openOutcome !== o.key;
                    setOpenOutcome(willOpen ? o.key : null);
                    setImageData(null);
                  }}
                  style={{
                    border: `1.5px solid ${active ? o.color : "rgba(124,58,237,0.15)"}`,
                    background: active ? `${o.color}22` : "rgba(255,255,255,0.8)",
                    color: active ? o.color : "#3d3870",
                    borderRadius: 11,
                    padding: "10px 16px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    transition: "all 0.18s ease",
                    boxShadow: active ? `0 0 0 3px ${o.color}22, 0 6px 16px ${o.color}33` : "0 2px 8px rgba(99,60,217,0.06)",
                  }}
                >
                  <Plus size={13} style={{ transform: active ? "rotate(45deg)" : "none", transition: "transform 0.18s ease" }} />
                  {o.label}
                </button>
              );
            })}
          </div>

          {openOutcome && (
            <div
              style={{
                marginTop: 14,
                background: "rgba(255,255,255,0.9)",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(124,58,237,0.15)",
                borderRadius: 16,
                padding: 18,
                animation: "popIn 0.18s ease",
                boxShadow: "0 8px 26px rgba(99,60,217,0.1)",
              }}
            >
              {OUTCOMES.find((x) => x.key === openOutcome)?.needsPeak && (
                <div style={{ marginBottom: 13 }}>
                  <label style={{ fontSize: 12, color: "#5b5780", display: "block", marginBottom: 7, fontWeight: 600 }}>
                    RR ปัจจุบันตามสวิง (เช่น 19.5)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={customRR}
                    onChange={(e) => setCustomRR(e.target.value)}
                    placeholder="19.5"
                    style={{
                      width: "100%",
                      background: "#ffffff",
                      border: "1.5px solid rgba(124,58,237,0.2)",
                      borderRadius: 9,
                      padding: "10px 12px",
                      color: "#1e1b3a",
                      fontSize: 14,
                      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>
              )}
              <div style={{ marginBottom: 13 }}>
                <label style={{ fontSize: 12, color: "#5b5780", display: "block", marginBottom: 7, fontWeight: 600 }}>โน้ต (ไม่บังคับ)</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="เช่น คู่เงิน, เซตอัพ"
                  style={{
                    width: "100%",
                    background: "#ffffff",
                    border: "1.5px solid rgba(124,58,237,0.2)",
                    borderRadius: 9,
                    padding: "10px 12px",
                    color: "#1e1b3a",
                    fontSize: 14,
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
              </div>
              <div style={{ marginBottom: 13 }}>
                <label style={{ fontSize: 12, color: "#5b5780", display: "block", marginBottom: 7, fontWeight: 600 }}>รูปภาพ (ไม่บังคับ)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  style={{ display: "none" }}
                />
                {!imageData ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={imageBusy}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 7,
                      background: "#ffffff",
                      border: "1.5px dashed rgba(124,58,237,0.3)",
                      borderRadius: 9,
                      padding: "12px 0",
                      color: "#7c3aed",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: imageBusy ? "default" : "pointer",
                    }}
                  >
                    <ImageIcon size={15} />
                    {imageBusy ? "กำลังประมวลผลรูป..." : "แนบรูปกราฟ / สกรีนช็อต"}
                  </button>
                ) : (
                  <div style={{ position: "relative", display: "inline-block" }}>
                    <img
                      src={imageData}
                      alt="preview"
                      style={{ maxWidth: "100%", maxHeight: 180, borderRadius: 9, border: "1.5px solid rgba(124,58,237,0.2)", display: "block" }}
                    />
                    <button
                      type="button"
                      onClick={() => setImageData(null)}
                      style={{
                        position: "absolute",
                        top: 6,
                        right: 6,
                        background: "rgba(30,27,58,0.75)",
                        border: "none",
                        borderRadius: 99,
                        width: 24,
                        height: 24,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}
              </div>
              <button
                className="save-btn"
                onClick={() => addTrade(openOutcome)}
                style={{
                  width: "100%",
                  background: "linear-gradient(120deg, #7c3aed, #ec4899)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 10,
                  padding: "12px 0",
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  boxShadow: "0 6px 18px rgba(124,58,237,0.3)",
                }}
              >
                บันทึกไม้นี้
              </button>
            </div>
          )}
        </div>

        {/* Trade list */}
        <div style={{ fontSize: 12, color: "#7a76a3", marginBottom: 12, fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: "0.03em", fontWeight: 700 }}>
          ประวัติ ({count})
        </div>
        {count === 0 ? (
          <div style={{ color: "#9b97c2", fontSize: 13, padding: "30px 0", textAlign: "center", border: "1.5px dashed rgba(124,58,237,0.25)", borderRadius: 16, background: "rgba(255,255,255,0.5)", fontWeight: 500 }}>
            ยังไม่มีรายการ — เริ่มเพิ่มไม้แรกได้เลย
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {trades.map((t, idx) => {
              const o = OUTCOMES.find((x) => x.key === t.outcome);
              return (
                <div
                  key={t.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    background: "rgba(255,255,255,0.85)",
                    backdropFilter: "blur(8px)",
                    border: "1px solid rgba(255,255,255,0.7)",
                    borderRadius: 12,
                    padding: "12px 14px",
                    boxShadow: "0 2px 10px rgba(99,60,217,0.06)",
                    animation: justAdded === t.id ? "flash 0.65s ease" : "none",
                  }}
                >
                  <div style={{ fontSize: 11, color: "#a3a0c2", width: 28, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontWeight: 600 }}>
                    #{count - idx}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: "#fff",
                      background: o.color,
                      borderRadius: 8,
                      padding: "4px 10px",
                      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                      minWidth: 48,
                      textAlign: "center",
                    }}
                  >
                    {o.short}
                  </div>
                  <div style={{ flex: 1, fontSize: 13, color: t.note ? "#3d3870" : "#c4c0e0", fontWeight: 500 }}>
                    {t.note || "—"}
                  </div>
                  {t.image && (
                    <img
                      src={t.image}
                      alt="trade"
                      onClick={() => setLightbox(t.image)}
                      style={{ width: 34, height: 34, objectFit: "cover", borderRadius: 7, cursor: "pointer", border: "1.5px solid rgba(124,58,237,0.2)", flexShrink: 0 }}
                    />
                  )}
                  <div style={{ fontSize: 13.5, fontWeight: 800, fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: t.rr > 0 ? "#06c281" : t.rr < 0 ? "#fb5673" : "#64748b" }}>
                    {t.rr > 0 ? "+" : ""}{t.rr}R
                  </div>
                  <button
                    className="trash-btn"
                    onClick={() => removeTrade(t.id)}
                    style={{ background: "none", border: "none", color: "#c4c0e0", cursor: "pointer", padding: 4, transition: "color 0.15s ease" }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {count > 0 && (
          <button
            className="reset-btn"
            onClick={resetAll}
            style={{
              marginTop: 30,
              background: "rgba(255,255,255,0.7)",
              border: "1.5px solid rgba(124,58,237,0.2)",
              color: "#5b5780",
              borderRadius: 10,
              padding: "9px 16px",
              fontSize: 12,
              cursor: "pointer",
              transition: "all 0.15s ease",
              fontWeight: 600,
            }}
          >
            ล้างสถิติทั้งหมด
          </button>
        )}
      </div>

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(20,17,40,0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 24,
            animation: "popIn 0.15s ease",
          }}
        >
          <img
            src={lightbox}
            alt="trade full"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: 14, boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}
          />
          <button
            onClick={() => setLightbox(null)}
            style={{
              position: "fixed",
              top: 22,
              right: 22,
              background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.3)",
              borderRadius: 99,
              width: 38,
              height: 38,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
}