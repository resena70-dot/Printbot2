import { useState, useRef, useEffect, useCallback, useMemo } from "react";

/* ═══════════════════════════════════════════════════════════
   PRINTBOT PRO v4 — AI 3D Print Designer
   Fixed · Production Ready · Full Featured · Freemium
═══════════════════════════════════════════════════════════ */

const APP_VERSION = "4.0";
const FREE_LIMIT = 4;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const PLANS = {
  monthly:  { price: 9.99,  label: "Mensual",   months: 1,    sub: "Billed monthly",    badge: null },
  yearly:   { price: 79.99, label: "Anual",      months: 12,   sub: "$6.67/mes · -33%",  badge: "MÁS POPULAR" },
  lifetime: { price: 199,   label: "Vitalicio",  months: 1200, sub: "Pago único",        badge: "MEJOR VALOR" },
};

/* ── AI PROMPT ─────────────────────────────────────────────────── */
const SYSTEM_PROMPT = `You are PRINTBOT PRO, an expert AI for 3D printing design. Design ANYTHING: characters (Mario, Batman, Pikachu, Goku, Spider-Man, Darth Vader, Sonic, Iron Man, Yoda, any character), brands/logos (Nike, Apple, Ferrari, NASA, Adidas, PlayStation), objects, jewelry, tools, art, vehicles, architecture, animals — everything.

Respond ONLY with a valid JSON object. No markdown. No backticks. No extra text. Just raw JSON.

{
  "name": "object name",
  "tagline": "catchy phrase max 8 words",
  "emoji": "one emoji",
  "category": "character|logo|object|jewelry|tool|toy|art|architecture|vehicle|nature|food|mechanical|custom",
  "vibe": "fun|professional|artistic|technical|cute|epic|elegant|weird|retro|sci-fi",
  "material": "PLA|ABS|PETG|TPU|Resin|Nylon",
  "primaryColor": "#hexcolor",
  "secondaryColor": "#hexcolor",
  "accentColor": "#hexcolor",
  "dimensions": { "w": number_mm, "h": number_mm, "d": number_mm },
  "printTime": "Xh Ym",
  "layerHeight": 0.1,
  "infill": 20,
  "supports": false,
  "bedAdhesion": "brim",
  "difficulty": "easy|medium|hard|expert",
  "resolution": "normal",
  "parts": [
    {
      "id": "p1",
      "name": "part name",
      "shape": "box|cylinder|sphere|cone|torus|capsule",
      "x": 0, "y": 0, "z": 0,
      "w": 20, "h": 20, "d": 20,
      "color": "#hexcolor",
      "note": "what this part is"
    }
  ],
  "tips": ["tip1", "tip2", "tip3", "tip4"],
  "warnings": [],
  "filamentMeters": 5,
  "filamentGrams": 30,
  "costUSD": 1.5,
  "funFact": "interesting fact about this object max 25 words",
  "remixIdeas": ["remix1", "remix2", "remix3"],
  "printProfile": { "speed": 50, "temperature": 200, "cooling": "medium", "firstLayerSpeed": 25 },
  "postProcessing": [],
  "slicerSettings": { "wallCount": 3, "topLayers": 4, "bottomLayers": 4, "travelSpeed": 150 }
}

CRITICAL RULES:
- Characters: use accurate colors. Mario=red+blue+skin. Batman=black+gray+yellow. Pikachu=yellow+red+brown.
- Use 4 to 12 parts to build recognizable shapes
- Dimensions: realistic mm (20 to 250mm typical)
- Parts positions x,y,z are offsets in mm from center
- All numbers must be plain numbers, no units`;

/* ── COLORS ────────────────────────────────────────────────────── */
const C = {
  bg: "#07090f", surf: "#0c0f1a", card: "#111520", cardH: "#161b28",
  b: "rgba(255,255,255,0.06)", bM: "rgba(255,255,255,0.12)", bH: "rgba(255,255,255,0.22)",
  tx: "#edf2ff", sub: "#7b88b0", dim: "#374060",
  or: "#ff6533", teal: "#00e5c0", pur: "#9d6ef8", pink: "#f472b6",
  grn: "#2ee89a", yel: "#fbbf24", red: "#f87171", blu: "#60a5fa", gold: "#ffc107",
};

/* ── DATA ──────────────────────────────────────────────────────── */
const MATS = {
  PLA:   { c:"#2ee89a", t:200, b:60,  fl:1, st:2, icon:"🌱", tag:"Fácil",     info:"Versátil, biodegradable, ideal principiantes" },
  PETG:  { c:"#60a5fa", t:230, b:80,  fl:3, st:3, icon:"💧", tag:"Equilibrado",info:"Resistente, algo flexible, food-safe" },
  ABS:   { c:"#fbbf24", t:240, b:100, fl:2, st:4, icon:"🔥", tag:"Duradero",  info:"Alta temperatura, muy duro, post-procesable" },
  TPU:   { c:"#9d6ef8", t:220, b:40,  fl:5, st:2, icon:"🤸", tag:"Flexible",  info:"Elástico, absorbe impactos, grip excelente" },
  Resin: { c:"#f472b6", t:"UV",b:"—", fl:1, st:5, icon:"💎", tag:"Precisión", info:"Máximo detalle, acabado liso, frágil" },
  Nylon: { c:"#22d3ee", t:250, b:90,  fl:2, st:5, icon:"🏋️",tag:"Pro",       info:"Resistencia extrema, piezas técnicas" },
};

const DIFFS = {
  easy:   { l:"Fácil",    c:"#2ee89a", b:1, d:"Sin experiencia necesaria" },
  medium: { l:"Moderado", c:"#fbbf24", b:2, d:"Algo de práctica ayuda" },
  hard:   { l:"Difícil",  c:"#f97316", b:3, d:"Calibración avanzada" },
  expert: { l:"Experto",  c:"#f87171", b:4, d:"Impresora optimizada" },
};

const VIBES_C = {
  fun:"#ff6533", professional:"#60a5fa", artistic:"#9d6ef8", technical:"#2ee89a",
  cute:"#f472b6", epic:"#f87171", "sci-fi":"#00e5c0", elegant:"#ffc107",
  weird:"#22d3ee", retro:"#fbbf24",
};

const QUICK_PROMPTS = [
  { e:"🦇", t:"Batman busto detallado con capucha y orejas",    c:"character" },
  { e:"⚡", t:"Pikachu kawaii sentado con mejillas rojas",       c:"character" },
  { e:"🍄", t:"Seta de Mario Bros gigante con manchas",         c:"character" },
  { e:"🌑", t:"Casco Darth Vader pantalla frontal",             c:"character" },
  { e:"🕷️",t:"Spider-Man colgando de tela de araña",           c:"character" },
  { e:"🐉", t:"Goku Super Saiyan en Kamehameha",               c:"character" },
  { e:"🦸", t:"Casco Iron Man con reactores Mark 50",           c:"character" },
  { e:"🟢", t:"Yoda meditando con bastón",                     c:"character" },
  { e:"👟", t:"Nike Swoosh logo 3D para escritorio",            c:"logo" },
  { e:"🍎", t:"Logo Apple con mordida y hoja en 3D",           c:"logo" },
  { e:"🚀", t:"Parche NASA misión Artemis en relieve",          c:"logo" },
  { e:"🏎️",t:"Ferrari escudo logo en relieve detallado",       c:"logo" },
  { e:"💍", t:"Anillo de compromiso con diamante solitario",    c:"jewelry" },
  { e:"📿", t:"Pulsera geométrica hexagonal articulada",       c:"jewelry" },
  { e:"🦖", t:"T-Rex articulado con mandíbula móvil",          c:"toy" },
  { e:"🏰", t:"Torre Eiffel 20cm ultra detallada",             c:"architecture" },
  { e:"🔧", t:"Llave ajustable funcional 150mm",               c:"tool" },
  { e:"🌀", t:"Espiral de Fibonacci matemática pura",          c:"art" },
  { e:"🚗", t:"Ferrari F40 miniatura coleccionable",           c:"vehicle" },
  { e:"🌺", t:"Maceta hexagonal con relieve floral",           c:"object" },
];

const CATS = [
  {id:"all",e:"✦",l:"Todo"}, {id:"character",e:"🎭",l:"Personajes"},
  {id:"logo",e:"🏷️",l:"Logos"}, {id:"object",e:"📦",l:"Objetos"},
  {id:"toy",e:"🧸",l:"Juguetes"}, {id:"jewelry",e:"💍",l:"Joyería"},
  {id:"tool",e:"🔧",l:"Tools"}, {id:"art",e:"🎨",l:"Arte"},
  {id:"vehicle",e:"🚗",l:"Vehículos"}, {id:"architecture",e:"🏛️",l:"Arq."},
];

/* ── LOCAL STORAGE HOOK ────────────────────────────────────────── */
function useLS(key, init) {
  const [v, sv] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : init; }
    catch { return init; }
  });
  const set = useCallback(val => {
    sv(val);
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }, [key]);
  return [v, set];
}

/* ── 3D ENGINE ─────────────────────────────────────────────────── */
function use3DEngine(canvasRef, parts, dimensions) {
  const rot = useRef({ x: 0.4, y: 0.6 });
  const zmRef = useRef(1.1);
  const drag = useRef(false);
  const auto = useRef(true);
  const wire = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const rafRef = useRef(null);

  const h2r = (h) => {
    const c = (h || "#888").replace("#", "").padEnd(6, "0");
    return [parseInt(c.slice(0,2),16)||128, parseInt(c.slice(2,4),16)||128, parseInt(c.slice(4,6),16)||128];
  };
  const shade = (h, amt) => {
    const [r,g,b] = h2r(h);
    const cl = v => Math.min(255, Math.max(0, Math.round(v + amt)));
    return `rgb(${cl(r)},${cl(g)},${cl(b)})`;
  };
  const proj = (x, y, z, rx, ry, W, H, zm) => {
    const cx = Math.cos(rx), sx = Math.sin(rx);
    const cy = Math.cos(ry), sy = Math.sin(ry);
    const nx = x*cy - z*sy;
    const nz2 = x*sy + z*cy;
    const ny = y*cx - nz2*sx;
    const nzf = y*sx + nz2*cx;
    const f = 570 * zm, o = 415;
    return { px: nx*f/(nzf+o) + W/2, py: -ny*f/(nzf+o) + H/2, d: nzf };
  };

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const W = cv.width, H = cv.height;
    const rx = rot.current.x, ry = rot.current.y, zm = zmRef.current;
    ctx.clearRect(0, 0, W, H);

    // Subtle radial glow
    const rg = ctx.createRadialGradient(W*0.42, H*0.4, 0, W*0.5, H*0.5, W*0.68);
    rg.addColorStop(0, "rgba(0,229,192,0.025)");
    rg.addColorStop(0.5, "rgba(255,101,51,0.015)");
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);

    // Grid with depth fade
    for (let i = -9; i <= 9; i++) {
      const gs = 18;
      const fade = 1 - Math.abs(i) / 10 * 0.55;
      ctx.strokeStyle = `rgba(0,229,192,${0.048 * fade})`;
      ctx.lineWidth = i === 0 ? 1 : 0.6;
      const a = proj(i*gs, -70, -gs*9, rx, ry, W, H, zm);
      const bv = proj(i*gs, -70, gs*9, rx, ry, W, H, zm);
      const cv2 = proj(-gs*9, -70, i*gs, rx, ry, W, H, zm);
      const dv = proj(gs*9, -70, i*gs, rx, ry, W, H, zm);
      ctx.beginPath(); ctx.moveTo(a.px,a.py); ctx.lineTo(bv.px,bv.py); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cv2.px,cv2.py); ctx.lineTo(dv.px,dv.py); ctx.stroke();
    }

    if (!parts || !parts.length) return;

    const maxD = Math.max(dimensions?.w||60, dimensions?.h||60, dimensions?.d||60, 1);
    const sc = 90 / maxD;

    const scaled = parts.map(p => ({
      ...p,
      _w: (p.w || 10) * sc, _h: (p.h || 10) * sc, _d: (p.d || 10) * sc,
      _x: (p.x || 0) * sc,  _y: (p.y || 0) * sc,  _z: (p.z || 0) * sc,
    }));

    const withDepth = scaled.map(p => {
      const c = proj(p._x, p._y, p._z, rx, ry, W, H, zm);
      return { ...p, _dep: c.d };
    });
    withDepth.sort((a, b) => b._dep - a._dep);

    const drawShadow = (cx, cy, r) => {
      const sg = ctx.createRadialGradient(cx, cy + r*0.1, 0, cx, cy + r*0.2, r*1.5);
      sg.addColorStop(0, "rgba(0,0,0,0.28)");
      sg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.beginPath();
      ctx.ellipse(cx, cy + r*0.15, r*1.3, r*0.22, 0, 0, Math.PI*2);
      ctx.fillStyle = sg; ctx.fill();
    };

    withDepth.forEach(p => {
      const col = p.color || "#4488ff";
      const { _w: w, _h: h, _d: d, _x: px, _y: py, _z: pz } = p;

      /* SPHERE */
      if (p.shape === "sphere" || p.shape === "capsule") {
        const c = proj(px, py, pz, rx, ry, W, H, zm);
        const e = proj(px + w/2, py, pz, rx, ry, W, H, zm);
        const r = Math.max(4, Math.abs(e.px - c.px));
        drawShadow(c.px, c.py, r);
        if (wire.current) {
          ctx.beginPath(); ctx.arc(c.px, c.py, r, 0, Math.PI*2);
          ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.stroke(); return;
        }
        const g = ctx.createRadialGradient(c.px - r*0.3, c.py - r*0.36, r*0.04, c.px, c.py, r);
        g.addColorStop(0, shade(col, 100));
        g.addColorStop(0.42, shade(col, 20));
        g.addColorStop(0.78, col);
        g.addColorStop(1, shade(col, -72));
        ctx.beginPath(); ctx.arc(c.px, c.py, r, 0, Math.PI*2);
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.07)"; ctx.lineWidth = 0.5; ctx.stroke();
        ctx.beginPath(); ctx.arc(c.px - r*0.27, c.py - r*0.3, r*0.16, 0, Math.PI*2);
        ctx.fillStyle = "rgba(255,255,255,0.26)"; ctx.fill();
        return;
      }

      /* CYLINDER / CONE / TORUS */
      if (p.shape === "cylinder" || p.shape === "cone" || p.shape === "torus") {
        const segs = 16;
        const topR = w / 2;
        const botR = p.shape === "cone" ? 1.5 : w / 2;
        const tops = [], bots = [];
        for (let i = 0; i <= segs; i++) {
          const a = (i / segs) * Math.PI * 2;
          tops.push(proj(px + Math.cos(a)*topR, py + h/2, pz + Math.sin(a)*topR, rx, ry, W, H, zm));
          bots.push(proj(px + Math.cos(a)*botR, py - h/2, pz + Math.sin(a)*botR, rx, ry, W, H, zm));
        }
        const bc = proj(px, py - h/2, pz, rx, ry, W, H, zm);
        drawShadow(bc.px, bc.py, w/2 * 0.85);
        if (wire.current) {
          for (let i = 0; i < segs; i++) {
            ctx.beginPath(); ctx.moveTo(tops[i].px, tops[i].py); ctx.lineTo(bots[i].px, bots[i].py);
            ctx.strokeStyle = col; ctx.lineWidth = 0.7; ctx.stroke();
          }
          ctx.beginPath();
          tops.forEach((t, i) => i ? ctx.lineTo(t.px, t.py) : ctx.moveTo(t.px, t.py));
          ctx.closePath(); ctx.strokeStyle = col; ctx.stroke(); return;
        }
        for (let i = 0; i < segs; i++) {
          const ang = (i + 0.5) / segs * Math.PI * 2;
          const lt = Math.cos(ang - ry) * 56 + 10;
          ctx.beginPath();
          ctx.moveTo(tops[i].px, tops[i].py); ctx.lineTo(tops[i+1].px, tops[i+1].py);
          ctx.lineTo(bots[i+1].px, bots[i+1].py); ctx.lineTo(bots[i].px, bots[i].py);
          ctx.closePath();
          ctx.fillStyle = shade(col, lt); ctx.fill();
          ctx.strokeStyle = "rgba(0,0,0,0.1)"; ctx.lineWidth = 0.3; ctx.stroke();
        }
        ctx.beginPath();
        tops.forEach((t, i) => i ? ctx.lineTo(t.px, t.py) : ctx.moveTo(t.px, t.py));
        ctx.closePath(); ctx.fillStyle = shade(col, 80); ctx.fill();
        return;
      }

      /* BOX (default) */
      const hw = w/2, hh = h/2, hd = d/2;
      // Build 8 vertices — using explicit subtraction to avoid Unicode minus issues
      const verts = [
        [px - hw, py - hh, pz - hd], [px + hw, py - hh, pz - hd],
        [px + hw, py + hh, pz - hd], [px - hw, py + hh, pz - hd],
        [px - hw, py - hh, pz + hd], [px + hw, py - hh, pz + hd],
        [px + hw, py + hh, pz + hd], [px - hw, py + hh, pz + hd],
      ].map(([vx, vy, vz]) => proj(vx, vy, vz, rx, ry, W, H, zm));

      const floorPt = proj(px, py - hh, pz, rx, ry, W, H, zm);
      drawShadow(floorPt.px, floorPt.py, Math.max(hw, hd) * 0.9);

      if (wire.current) {
        const edges = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
        edges.forEach(([a, b]) => {
          ctx.beginPath(); ctx.moveTo(verts[a].px, verts[a].py); ctx.lineTo(verts[b].px, verts[b].py);
          ctx.strokeStyle = col; ctx.lineWidth = 0.8; ctx.stroke();
        }); return;
      }

      const faces = [
        { idx:[3,2,6,7], light: 74 },
        { idx:[1,2,6,5], light: 46 },
        { idx:[0,1,5,4], light: -46 },
        { idx:[0,3,7,4], light: -28 },
        { idx:[0,1,2,3], light: -12 },
        { idx:[4,5,6,7], light: 26 },
      ];
      faces.sort((a, b) => {
        const da = a.idx.reduce((s,k) => s + verts[k].d, 0) / 4;
        const db = b.idx.reduce((s,k) => s + verts[k].d, 0) / 4;
        return db - da;
      });
      faces.forEach(({ idx, light }) => {
        const pts = idx.map(k => verts[k]);
        ctx.beginPath();
        ctx.moveTo(pts[0].px, pts[0].py);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].px, pts[i].py);
        ctx.closePath();
        ctx.fillStyle = shade(col, light); ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.12)"; ctx.lineWidth = 0.4; ctx.stroke();
      });
      // Top edge highlight
      const top = [verts[3], verts[2], verts[6], verts[7]];
      ctx.beginPath(); ctx.moveTo(top[0].px, top[0].py);
      top.slice(1).forEach(v => ctx.lineTo(v.px, v.py));
      ctx.closePath();
      ctx.strokeStyle = "rgba(255,255,255,0.14)"; ctx.lineWidth = 0.8; ctx.stroke();
    });

    // XYZ axis gizmo
    const ax = W - 52, ay = H - 52;
    [["X","#f87171",[22,0,0]], ["Y","#2ee89a",[0,22,0]], ["Z","#60a5fa",[0,0,22]]].forEach(([label, clr, vec]) => {
      const tp = proj(vec[0], vec[1], vec[2], rx, ry, ax, ay, 0.36);
      ctx.strokeStyle = clr; ctx.lineWidth = 2; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(tp.px, tp.py); ctx.stroke();
      ctx.beginPath(); ctx.arc(tp.px, tp.py, 2.5, 0, Math.PI*2);
      ctx.fillStyle = clr; ctx.fill();
      ctx.fillStyle = clr; ctx.font = "bold 9px monospace";
      ctx.fillText(label, tp.px + (tp.px - ax)*0.3, tp.py + (tp.py - ay)*0.3 + 3);
    });
  }, [parts, dimensions, canvasRef]);

  useEffect(() => {
    const loop = () => {
      if (auto.current && !drag.current) rot.current.y += 0.006;
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [draw]);

  const handlers = {
    onMouseDown: e => { drag.current = true; auto.current = false; lastMouse.current = { x: e.clientX, y: e.clientY }; },
    onMouseMove: e => {
      if (!drag.current) return;
      rot.current.y += (e.clientX - lastMouse.current.x) * 0.011;
      rot.current.x += (e.clientY - lastMouse.current.y) * 0.011;
      lastMouse.current = { x: e.clientX, y: e.clientY };
    },
    onMouseUp: () => { drag.current = false; },
    onWheel: e => { e.preventDefault(); zmRef.current = Math.max(0.2, Math.min(5, zmRef.current - e.deltaY * 0.0008)); },
    onTouchStart: e => { drag.current = true; auto.current = false; lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; },
    onTouchMove: e => {
      if (!drag.current) return;
      e.preventDefault();
      rot.current.y += (e.touches[0].clientX - lastMouse.current.x) * 0.011;
      rot.current.x += (e.touches[0].clientY - lastMouse.current.y) * 0.011;
      lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    },
    onTouchEnd: () => { drag.current = false; },
    reset:       () => { rot.current = { x: 0.4, y: 0.6 }; zmRef.current = 1.1; auto.current = true; },
    zoomIn:      () => { zmRef.current = Math.min(5, zmRef.current + 0.2); },
    zoomOut:     () => { zmRef.current = Math.max(0.2, zmRef.current - 0.2); },
    front:       () => { rot.current = { x: 0, y: 0 }; auto.current = false; },
    top:         () => { rot.current = { x: Math.PI/2 - 0.01, y: 0 }; auto.current = false; },
    side:        () => { rot.current = { x: 0, y: Math.PI/2 }; auto.current = false; },
    iso:         () => { rot.current = { x: 0.55, y: 0.78 }; auto.current = false; },
    toggleWire:  () => { wire.current = !wire.current; },
    toggleAuto:  () => { auto.current = !auto.current; },
  };
  return handlers;
}

/* ── COUNTDOWN ─────────────────────────────────────────────────── */
function Countdown({ targetMs, compact = false }) {
  const [rem, setRem] = useState(0);
  useEffect(() => {
    const upd = () => setRem(Math.max(0, targetMs - Date.now()));
    upd();
    const id = setInterval(upd, 1000);
    return () => clearInterval(id);
  }, [targetMs]);
  const days  = Math.floor(rem / 86400000);
  const hours = Math.floor((rem % 86400000) / 3600000);
  const mins  = Math.floor((rem % 3600000) / 60000);
  const secs  = Math.floor((rem % 60000) / 1000);
  if (rem <= 0) return null;
  if (compact) {
    return (
      <span style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:700, color:C.or, fontSize:13 }}>
        {days > 0 ? `${days}d ` : ""}{String(hours).padStart(2,"0")}:{String(mins).padStart(2,"0")}:{String(secs).padStart(2,"0")}
      </span>
    );
  }
  return (
    <div style={{ display:"flex", gap:6, justifyContent:"center" }}>
      {[[days,"días"],[hours,"hrs"],[mins,"min"],[secs,"seg"]].map(([val, lbl]) => (
        <div key={lbl} style={{ textAlign:"center", background:C.card, border:`1px solid ${C.b}`, borderRadius:9, padding:"8px 10px", minWidth:50 }}>
          <div style={{ fontSize:20, fontWeight:900, color:C.or, fontFamily:"'JetBrains Mono',monospace", lineHeight:1 }}>{String(val).padStart(2,"0")}</div>
          <div style={{ fontSize:9, color:C.dim, marginTop:3, letterSpacing:1, textTransform:"uppercase" }}>{lbl}</div>
        </div>
      ))}
    </div>
  );
}

/* ── STAR RATING ───────────────────────────────────────────────── */
function StarRating({ value, onChange, size = 12 }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display:"flex", gap:1 }}>
      {[1,2,3,4,5].map(n => (
        <span key={n} onClick={e => { e.stopPropagation(); onChange(n); }}
          onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
          style={{ fontSize:size, cursor:"pointer", color: n <= (hover || value) ? C.gold : C.dim, transition:"color .1s" }}>
          ★
        </span>
      ))}
    </div>
  );
}

/* ── MAIN APP ───────────────────────────────────────────────────── */
export default function PrintbotPro() {
  const canvasRef = useRef(null);
  const promptRef = useRef(null);

  /* State */
  const [design, setDesign]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [prompt, setPrompt]     = useState("");
  const [refineText, setRefine] = useState("");
  const [chatHistory, setChat]  = useState([]);
  const [rightTab, setRightTab] = useState("info");
  const [viewMode, setViewMode] = useState("3d");
  const [catFilter, setCatF]    = useState("all");
  const [modal, setModal]       = useState(null); // "upgrade"|"settings"|"gallery"|null
  const [isWelcome, setWelcome] = useState(true);
  const [toasts, setToasts]     = useState([]);

  /* Persisted */
  const [isPro, setIsPro]       = useLS("pb4_pro", false);
  const [proExp, setProExp]     = useLS("pb4_exp", null);
  const [usage, setUsage]       = useLS("pb4_usage", { ts: [] });
  const [history, setHistory]   = useLS("pb4_hist", []);
  const [favs, setFavs]         = useLS("pb4_favs", []);
  const [params, setParams]     = useLS("pb4_params", { w:80, h:80, d:80, material:"PLA", infill:20, layerH:0.2, supports:false, bedAdhesion:"brim", color:"#ff6533", speed:50 });
  const [stats, setStats]       = useLS("pb4_stats", { total:0, streak:0, lastVisit:"" });

  /* 3D engine */
  const h3d = use3DEngine(canvasRef, design?.parts, design?.dimensions);

  /* Toast system */
  const addToast = useCallback((msg, type = "success", icon = "✓") => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, msg, type, icon }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);

  /* Streak tracking */
  useEffect(() => {
    const today = new Date().toDateString();
    if (stats.lastVisit === today) return;
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const newStreak = stats.lastVisit === yesterday ? stats.streak + 1 : 1;
    setStats(s => ({ ...s, lastVisit: today, streak: newStreak }));
    if (newStreak > 1) setTimeout(() => addToast(`🔥 ¡${newStreak} días seguidos!`, "success", "🔥"), 1200);
  }, []); // eslint-disable-line

  /* Pro active check */
  const proActive = useMemo(() => isPro && proExp && Date.now() < proExp, [isPro, proExp]);

  /* Free tier */
  const freeStatus = useMemo(() => {
    const now = Date.now();
    const active = (usage.ts || []).filter(t => now - t < WEEK_MS);
    const left = Math.max(0, FREE_LIMIT - active.length);
    const nextAt = active.length >= FREE_LIMIT ? [...active].sort((a,b)=>a-b)[0] + WEEK_MS : null;
    return { left, nextAt, canGen: proActive || left > 0 };
  }, [usage, proActive]);

  /* AI call */
  const callAI = async (messages) => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Error ${res.status}`);
    }
    const data = await res.json();
    const raw = (data.content || []).map(b => b.text || "").join("").replace(/```json|```/g, "").trim();
    return JSON.parse(raw);
  };

  /* Record usage */
  const recordUsage = useCallback(() => {
    if (!proActive) {
      const now = Date.now();
      const active = (usage.ts || []).filter(t => now - t < WEEK_MS);
      setUsage({ ts: [...active, now] });
    }
    setStats(s => ({ ...s, total: s.total + 1 }));
  }, [proActive, usage]);

  /* Generate */
  const generate = async (p = prompt) => {
    if (!p.trim() || loading) return;
    if (!freeStatus.canGen) { setModal("upgrade"); return; }
    setLoading(true); setWelcome(false);
    const msg = {
      role: "user",
      content: `Design 3D printable: "${p}". Target size ~${params.w}x${params.h}x${params.d}mm. Material: ${params.material}. Infill: ${params.infill}%. Layer height: ${params.layerH}mm. Color hint: ${params.color}.`
    };
    const msgs = [...chatHistory, msg];
    try {
      const result = await callAI(msgs);
      setDesign(result);
      setChat([...msgs, { role:"assistant", content: JSON.stringify(result) }]);
      recordUsage();
      setHistory(h => [{ id: Date.now(), prompt: p, design: result, ts: new Date().toISOString(), rating: 0 }, ...h.slice(0, 29)]);
      setRightTab("info"); setViewMode("3d");
      addToast(`${result.emoji || "✨"} "${result.name}" generado!`, "success", "✓");
    } catch (err) {
      addToast(err.message || "Error al generar", "error", "✗");
    }
    setLoading(false);
    setPrompt("");
  };

  /* Refine */
  const doRefine = async () => {
    if (!refineText.trim() || !design || loading) return;
    if (!freeStatus.canGen) { setModal("upgrade"); return; }
    setLoading(true);
    const msg = { role:"user", content:`Modify: "${refineText}". Keep same object. Size ~${params.w}x${params.h}x${params.d}mm.` };
    const msgs = [...chatHistory, msg];
    try {
      const result = await callAI(msgs);
      setDesign(result);
      setChat([...msgs, { role:"assistant", content: JSON.stringify(result) }]);
      recordUsage();
      addToast("Diseño refinado!", "success", "↺");
    } catch (err) {
      addToast("Error al refinar", "error", "✗");
    }
    setLoading(false);
    setRefine("");
  };

  /* Subscribe */
  const activatePro = (plan) => {
    const months = PLANS[plan].months;
    setIsPro(true);
    setProExp(Date.now() + months * 30 * 24 * 60 * 60 * 1000);
    setModal(null);
    addToast(`👑 ¡Bienvenido a PRO ${PLANS[plan].label}!`, "success", "👑");
  };

  /* Export G-Code */
  const exportGcode = () => {
    if (!design) return;
    const d = design;
    const mat = MATS[d.material || params.material];
    const lines = [
      `; PRINTBOT PRO v${APP_VERSION} — G-Code Export`,
      `; Object: ${d.name} | ${d.category}`,
      `; Generated: ${new Date().toLocaleString("es-ES")}`,
      `; Material: ${d.material} @ ${mat?.t || 200}°C / Bed ${mat?.b || 60}°C`,
      `; Size: ${d.dimensions?.w}x${d.dimensions?.h}x${d.dimensions?.d}mm`,
      `; Layer: ${d.layerHeight || params.layerH}mm | Infill: ${d.infill || params.infill}%`,
      `; Supports: ${d.supports ? "YES" : "NO"} | Adhesion: ${d.bedAdhesion || params.bedAdhesion}`,
      `; Est. Time: ${d.printTime} | ${d.filamentGrams}g | $${d.costUSD} USD`,
      "",
      `M104 S${mat?.t || 200}`,
      `M140 S${mat?.b || 60}`,
      `M109 S${mat?.t || 200}`,
      `M190 S${mat?.b || 60}`,
      "",
      "G28 ; Home all",
      "G29 ; Bed level",
      "G92 E0",
      "G1 Z5 F5000",
      "",
      "; Purge line",
      "G1 X0.1 Y20 Z0.3 F5000",
      `G1 X0.1 Y200 E18 F${(d.printProfile?.firstLayerSpeed || 25) * 60}`,
      "G1 X0.5 Y200",
      "G1 X0.5 Y20 E36",
      "G92 E0",
      "",
      ...(d.parts || []).flatMap((p, i) => [
        `; Part ${i+1}: ${p.name} (${p.shape})`,
        `; Color: ${p.color} | ${p.w}x${p.h}x${p.d}mm`,
        `G1 X${Math.round((p.x || 0) + (d.dimensions?.w || 80) / 2)} Y${Math.round((p.z || 0) + (d.dimensions?.d || 80) / 2)} Z0.2 F3000`,
        "",
      ]),
      "; End sequence",
      "G1 E-3 F3000",
      "G91",
      "G1 Z15",
      "G90",
      "G28 X0 Y0",
      "M104 S0",
      "M140 S0",
      "M107",
      "M84",
      `; PRINTBOT PRO v${APP_VERSION}`,
    ];
    const blob = new Blob([lines.join("\n")], { type:"text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(d.name || "design").toLowerCase().replace(/\s+/g,"_")}.gcode`;
    a.click(); URL.revokeObjectURL(a.href);
    addToast("G-Code exportado!", "success", "⬇");
  };

  /* Export JSON */
  const exportJSON = () => {
    if (!design) return;
    const blob = new Blob([JSON.stringify({ ...design, params, exportedAt: new Date().toISOString(), version: APP_VERSION }, null, 2)], { type:"application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(design.name || "design").toLowerCase().replace(/\s+/g,"_")}.json`;
    a.click(); URL.revokeObjectURL(a.href);
    addToast("JSON exportado!", "info", "{}");
  };

  /* Copy specs */
  const copySpecs = () => {
    if (!design) return;
    const d = design;
    const text = `🖨️ PRINTBOT PRO v${APP_VERSION}\n${"=".repeat(38)}\n📦 ${d.name}\n💬 ${d.tagline}\n\n📐 ${d.dimensions?.w}x${d.dimensions?.h}x${d.dimensions?.d}mm\n🧱 Material: ${d.material}\n📏 Capa: ${d.layerHeight}mm | Relleno: ${d.infill}%\n⏱️ Tiempo: ${d.printTime}\n⚖️ ${d.filamentGrams}g · ${d.filamentMeters}m\n💰 ~$${d.costUSD} USD\n\n💡 ${(d.tips || []).slice(0,2).join("\n💡 ")}`;
    navigator.clipboard?.writeText(text).then(() => addToast("Specs copiadas!", "info", "📋"));
  };

  /* Share */
  const shareDesign = async () => {
    if (!design) return;
    if (navigator.share) {
      try { await navigator.share({ title: design.name, text: design.tagline, url: window.location.href }); return; }
      catch {}
    }
    navigator.clipboard?.writeText(`${design.name}: ${design.tagline}`).then(() => addToast("Enlace copiado!", "info", "🔗"));
  };

  /* Rate history item */
  const rateItem = (id, rating) => {
    setHistory(h => h.map(x => x.id === id ? { ...x, rating } : x));
    addToast(rating >= 4 ? "¡Excelente diseño!" : "Gracias por valorar", "info", "⭐");
  };

  /* Computed values */
  const filteredPrompts = useMemo(() => catFilter === "all" ? QUICK_PROMPTS : QUICK_PROMPTS.filter(p => p.c === catFilter), [catFilter]);
  const d   = design;
  const mat = d ? MATS[d.material || params.material] : null;
  const diff = d ? DIFFS[d.difficulty] : null;
  const vc   = d ? (VIBES_C[d.vibe] || C.or) : C.or;
  const proExpDate = proExp ? new Date(proExp).toLocaleDateString("es-ES") : null;
  const topMaterial = useMemo(() => {
    if (!history.length) return null;
    const counts = {};
    history.forEach(h => { counts[h.design?.material] = (counts[h.design?.material] || 0) + 1; });
    return Object.entries(counts).sort((a,b) => b[1]-a[1])[0]?.[0];
  }, [history]);

  /* CSS */
  const globalCSS = `
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; overflow: hidden; }
    ::-webkit-scrollbar { width: 4px; height: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.09); border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.18); }
    @keyframes tpop { from { opacity:0; transform:translateX(-50%) translateY(18px) scale(0.86); } to { opacity:1; transform:translateX(-50%) translateY(0) scale(1); } }
    @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
    @keyframes scaleIn { from { opacity:0; transform:scale(0.9) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes spinR { to { transform: rotate(-360deg); } }
    @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
    @keyframes float { 0%,100% { transform:translateY(0) rotate(-1deg); } 50% { transform:translateY(-9px) rotate(2deg); } }
    @keyframes glowOr { 0%,100% { box-shadow:0 0 20px rgba(255,101,51,0.28), 0 4px 20px rgba(255,101,51,0.14); } 50% { box-shadow:0 0 42px rgba(255,101,51,0.6), 0 6px 32px rgba(255,101,51,0.3); } }
    @keyframes glowGold { 0%,100% { box-shadow:0 0 18px rgba(255,193,7,0.28); } 50% { box-shadow:0 0 36px rgba(255,193,7,0.62); } }
    @keyframes gradShift { 0% { background-position:0% 50%; } 50% { background-position:100% 50%; } 100% { background-position:0% 50%; } }
    @keyframes dotBlink { 0%,80%,100% { opacity:0.15; } 40% { opacity:1; } }
    .fu { animation: fadeUp 0.45s cubic-bezier(0.22,1,0.36,1) both; }
    .sc { animation: scaleIn 0.38s cubic-bezier(0.34,1.56,0.64,1) both; }
    .fl { animation: float 4s ease-in-out infinite; }
    .glow-btn { animation: glowOr 2.8s ease-in-out infinite; }
    .gold-btn { animation: glowGold 2.6s ease-in-out infinite; }
    .pls { animation: pulse 2s ease-in-out infinite; }
    .grad-brand { background: linear-gradient(90deg,#ff6533,#f472b6); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
    .grad-gold { background: linear-gradient(90deg,#ffc107,#ffd54f,#ffc107); background-size:200% auto; -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; animation:gradShift 3s linear infinite; }
    .d1 { animation: dotBlink 1.4s 0s infinite; }
    .d2 { animation: dotBlink 1.4s 0.2s infinite; }
    .d3 { animation: dotBlink 1.4s 0.4s infinite; }
    button, input, textarea, select { font-family: 'Outfit', sans-serif; outline: none; }
    button { cursor: pointer; }
    .hl { transition: transform 0.2s cubic-bezier(0.22,1,0.36,1), box-shadow 0.2s; }
    .hl:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(0,0,0,0.4); }
    input[type=range] { accent-color: ${C.or}; }
  `;

  /* Shared styles */
  const sInput = (focus = C.or) => ({
    width:"100%", background:"rgba(255,255,255,0.04)", border:`1.5px solid ${C.b}`,
    borderRadius:9, color:C.tx, fontSize:13, padding:"10px 12px",
    transition:"border-color 0.2s",
    fontFamily:"'Outfit',sans-serif",
  });
  const sBtn = (bg, color = "#fff", extra = {}) => ({
    border:"none", borderRadius:10, padding:"12px", fontSize:14, fontWeight:700,
    background:bg, color, width:"100%", transition:"all 0.22s", ...extra,
  });

  return (
    <div style={{ height:"100vh", background:C.bg, color:C.tx, display:"flex", flexDirection:"column", overflow:"hidden", fontFamily:"'Outfit',sans-serif" }}>
      <style>{globalCSS}</style>

      {/* TOASTS */}
      <div style={{ position:"fixed", bottom:28, left:"50%", transform:"translateX(-50%)", display:"flex", flexDirection:"column", gap:8, zIndex:9999, pointerEvents:"none", alignItems:"center" }}>
        {toasts.map(t => {
          const bg = { success:"#10b981", error:"#ef4444", info:"#3b82f6", warn:"#f59e0b" }[t.type] || "#10b981";
          return (
            <div key={t.id} style={{ background:bg, color:"#fff", padding:"10px 22px", borderRadius:32, fontSize:13, fontWeight:700, animation:"tpop .35s cubic-bezier(0.34,1.56,0.64,1)", boxShadow:`0 8px 30px ${bg}55`, display:"flex", alignItems:"center", gap:8, backdropFilter:"blur(12px)", whiteSpace:"nowrap" }}>
              {t.icon} {t.msg}
            </div>
          );
        })}
      </div>

      {/* ═══ HEADER ════════════════════════════════════════════════ */}
      <header style={{ height:52, background:"rgba(7,9,15,0.97)", borderBottom:`1px solid ${C.b}`, backdropFilter:"blur(20px)", display:"flex", alignItems:"center", padding:"0 16px", gap:10, flexShrink:0, zIndex:50 }}>
        {/* Logo */}
        <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
          <div style={{ width:32, height:32, borderRadius:9, background:"linear-gradient(135deg,#ff6533,#f472b6)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, boxShadow:"0 0 20px rgba(255,101,51,0.45)" }}>🖨</div>
          <div>
            <div className="grad-brand" style={{ fontSize:15, fontWeight:900, letterSpacing:-0.6, lineHeight:1 }}>PRINTBOT PRO</div>
            <div style={{ fontSize:8, color:C.dim, letterSpacing:1.8, fontWeight:600, lineHeight:1 }}>AI 3D DESIGN STUDIO</div>
          </div>
        </div>

        {/* Center tabs */}
        <div style={{ flex:1, display:"flex", justifyContent:"center", gap:2 }}>
          {[{id:"3d",l:"🖥 Vista 3D"},{id:"specs",l:"📊 Specs"},{id:"gcode",l:"💾 G-Code"},{id:"compare",l:"⇄ Comparar"}].map(({ id, l }) => (
            <button key={id} onClick={() => setViewMode(id)} style={{ padding:"4px 12px", borderRadius:7, fontSize:11, fontWeight:600, border:"none", background:viewMode===id?"rgba(255,101,51,0.14)":"transparent", color:viewMode===id?C.or:C.sub, transition:"all .18s" }}>{l}</button>
          ))}
        </div>

        {/* Right controls */}
        <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
          {stats.streak > 1 && <div style={{ padding:"3px 9px", borderRadius:12, background:"rgba(251,191,36,0.1)", border:"1px solid rgba(251,191,36,0.22)", fontSize:10, fontWeight:700, color:C.yel }}>🔥 {stats.streak}d</div>}
          {!proActive && (
            <div style={{ padding:"3px 9px", borderRadius:12, background:freeStatus.left>0?"rgba(46,232,154,0.08)":"rgba(248,113,113,0.08)", border:`1px solid ${freeStatus.left>0?"rgba(46,232,154,0.2)":"rgba(248,113,113,0.25)"}`, fontSize:10, fontWeight:700, color:freeStatus.left>0?C.grn:C.red, display:"flex", alignItems:"center", gap:4 }}>
              <span className="pls" style={{ width:5, height:5, borderRadius:"50%", background:freeStatus.left>0?C.grn:C.red }} />
              {freeStatus.left > 0 ? `${freeStatus.left}/${FREE_LIMIT} gratis` : "Sin intentos"}
            </div>
          )}
          {proActive && <div style={{ padding:"3px 10px", borderRadius:12, background:"rgba(255,193,7,0.1)", border:"1px solid rgba(255,193,7,0.28)", fontSize:10, fontWeight:800, color:C.gold, display:"flex", alignItems:"center", gap:4 }}>👑 PRO — {proExpDate}</div>}
          {history.length > 0 && <button onClick={() => setModal("gallery")} style={{ padding:"4px 10px", borderRadius:7, fontSize:10, fontWeight:600, border:`1px solid ${C.b}`, background:"rgba(255,255,255,0.04)", color:C.sub }}>◈ {history.length}</button>}
          <button onClick={() => setModal("settings")} style={{ width:28, height:28, borderRadius:7, border:`1px solid ${C.b}`, background:"rgba(255,255,255,0.04)", color:C.sub, fontSize:14, display:"flex", alignItems:"center", justifyContent:"center" }}>⚙</button>
          {!proActive && <button onClick={() => setModal("upgrade")} className="gold-btn" style={{ padding:"4px 12px", borderRadius:7, fontSize:11, fontWeight:800, border:"1px solid rgba(255,193,7,0.38)", background:"rgba(255,193,7,0.09)", color:C.gold }}>👑 PRO</button>}
        </div>
      </header>

      {/* ═══ BODY ══════════════════════════════════════════════════ */}
      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

        {/* LEFT SIDEBAR */}
        <aside style={{ width:288, background:C.surf, borderRight:`1px solid ${C.b}`, display:"flex", flexDirection:"column", overflow:"hidden", flexShrink:0 }}>
          <div style={{ flex:1, overflowY:"auto", padding:"14px 12px" }}>

            {/* Welcome */}
            {isWelcome && !d && (
              <div className="fu" style={{ textAlign:"center", padding:"14px 6px 10px", marginBottom:12 }}>
                <div className="fl" style={{ fontSize:46, marginBottom:8 }}>🖨️</div>
                <div className="grad-brand" style={{ fontSize:19, fontWeight:900, letterSpacing:-0.6, marginBottom:4 }}>¡Diseña cualquier cosa!</div>
                <div style={{ fontSize:12, color:C.sub, lineHeight:1.7 }}>Personajes, logos, joyería, herramientas,<br />vehículos… todo para imprimir en 3D.</div>
                <div style={{ marginTop:10, padding:"6px 12px", borderRadius:9, background: proActive ? "rgba(255,193,7,0.1)" : "rgba(255,101,51,0.09)", border:`1px solid ${proActive ? "rgba(255,193,7,0.22)" : "rgba(255,101,51,0.2)"}`, fontSize:11, color: proActive ? C.gold : C.or, fontWeight:600 }}>
                  {proActive ? "👑 PRO — Acceso ilimitado" : `✦ ${freeStatus.left} intentos gratuitos disponibles`}
                </div>
              </div>
            )}

            {/* Prompt */}
            <div style={{ fontSize:9, fontWeight:700, color:C.dim, letterSpacing:1.8, textTransform:"uppercase", marginBottom:6 }}>✦ Describe tu diseño</div>
            <textarea
              ref={promptRef} value={prompt} rows={3}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), generate())}
              placeholder="Ej: figura de Pikachu, casco Iron Man, logo Nike, anillo con rosa..."
              style={{ ...sInput(), resize:"none", lineHeight:1.6, marginBottom:7 }}
              onFocus={e => { e.target.style.borderColor = C.or; }}
              onBlur={e  => { e.target.style.borderColor = C.b; }}
            />

            {freeStatus.canGen ? (
              <button onClick={() => generate()} disabled={loading || !prompt.trim()}
                className={loading || !prompt.trim() ? "" : "glow-btn"}
                style={sBtn(loading || !prompt.trim() ? "rgba(255,255,255,0.07)" : "linear-gradient(135deg,#ff6533,#f472b6)", loading || !prompt.trim() ? C.dim : "#fff", { boxShadow: loading ? "none" : "0 6px 28px rgba(255,101,51,0.3)" })}>
                {loading
                  ? <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
                      <div style={{ width:15, height:15, border:"2px solid rgba(255,255,255,0.2)", borderTop:"2px solid #fff", borderRadius:"50%", animation:"spin 0.75s linear infinite" }} />
                      Generando<span className="d1">.</span><span className="d2">.</span><span className="d3">.</span>
                    </span>
                  : "✦ Generar diseño con IA"}
              </button>
            ) : (
              <div>
                <button onClick={() => setModal("upgrade")} className="gold-btn"
                  style={sBtn("rgba(255,193,7,0.09)", C.gold, { border:"1px solid rgba(255,193,7,0.38)", fontSize:13 })}>
                  👑 Suscríbete para continuar
                </button>
                {freeStatus.nextAt && (
                  <div style={{ marginTop:10, background:"rgba(255,255,255,0.03)", border:`1px solid ${C.b}`, borderRadius:10, padding:12, textAlign:"center" }}>
                    <div style={{ fontSize:11, color:C.sub, marginBottom:8, fontWeight:600 }}>⏱ Próximo intento gratuito:</div>
                    <Countdown targetMs={freeStatus.nextAt} />
                    <div style={{ fontSize:10, color:C.dim, marginTop:8 }}>
                      O <button onClick={() => setModal("upgrade")} style={{ color:C.gold, background:"none", border:"none", fontSize:10, fontWeight:700 }}>hazte PRO</button> para acceso ilimitado
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Free tier bar */}
            {!proActive && freeStatus.canGen && (
              <div style={{ marginTop:7, padding:"6px 10px", background:"rgba(255,255,255,0.025)", border:`1px solid ${C.b}`, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div>
                  <div style={{ display:"flex", gap:3, marginBottom:3 }}>
                    {Array.from({ length: FREE_LIMIT }).map((_, i) => (
                      <div key={i} style={{ width:14, height:4, borderRadius:2, background: i < FREE_LIMIT - freeStatus.left ? C.dim : C.or, transition:"background .3s" }} />
                    ))}
                  </div>
                  <div style={{ fontSize:9, color:C.dim }}>{freeStatus.left}/{FREE_LIMIT} · 1 por semana</div>
                </div>
                <button onClick={() => setModal("upgrade")} style={{ fontSize:9, fontWeight:700, color:C.gold, background:"none", border:"none" }}>Mejorar →</button>
              </div>
            )}

            {/* Refine */}
            {d && (
              <div style={{ marginTop:12 }}>
                <div style={{ fontSize:9, fontWeight:700, color:C.dim, letterSpacing:1.8, textTransform:"uppercase", marginBottom:6 }}>↺ Refinar diseño actual</div>
                <div style={{ display:"flex", gap:5 }}>
                  <input value={refineText} onChange={e => setRefine(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && doRefine()}
                    placeholder="Más grande, otro color, más detalle..."
                    style={{ flex:1, ...sInput(C.teal), fontSize:12 }}
                    onFocus={e => { e.target.style.borderColor = C.teal; }}
                    onBlur={e  => { e.target.style.borderColor = C.b; }}
                  />
                  <button onClick={doRefine} disabled={loading || !refineText.trim()}
                    style={{ padding:"9px 13px", borderRadius:9, border:"none", background: refineText.trim() ? C.teal : "rgba(255,255,255,0.06)", color:"#000", fontSize:16, fontWeight:800, opacity: loading || !refineText.trim() ? 0.4 : 1, boxShadow: refineText.trim() ? `0 4px 16px rgba(0,229,192,0.35)` : "none", transition:"all .2s" }}>→</button>
                </div>
              </div>
            )}

            {/* Quick prompts */}
            <div style={{ marginTop:14 }}>
              <div style={{ fontSize:9, fontWeight:700, color:C.dim, letterSpacing:1.8, textTransform:"uppercase", marginBottom:7 }}>💡 Ideas rápidas</div>
              <div style={{ display:"flex", gap:3, flexWrap:"wrap", marginBottom:8 }}>
                {CATS.slice(0, 6).map(cat => (
                  <button key={cat.id} onClick={() => setCatF(cat.id)} style={{ padding:"3px 8px", borderRadius:14, fontSize:10, fontWeight:600, border:`1px solid ${catFilter===cat.id?C.or:C.b}`, background:catFilter===cat.id?"rgba(255,101,51,0.12)":"transparent", color:catFilter===cat.id?C.or:C.sub, transition:"all .15s" }}>{cat.e} {cat.l}</button>
                ))}
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                {filteredPrompts.slice(0, 8).map((p, i) => (
                  <button key={i} onClick={() => { setPrompt(p.t); setWelcome(false); promptRef.current?.focus(); }}
                    style={{ display:"flex", alignItems:"center", gap:7, padding:"7px 9px", borderRadius:8, border:`1px solid ${C.b}`, background:"transparent", color:C.sub, fontSize:11, textAlign:"left", width:"100%", transition:"all .14s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = C.or; e.currentTarget.style.background = "rgba(255,101,51,0.05)"; e.currentTarget.style.color = C.tx; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = C.b;  e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.sub; }}>
                    <span style={{ fontSize:14, flexShrink:0 }}>{p.e}</span>
                    <span style={{ lineHeight:1.4 }}>{p.t}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom quick params */}
          <div style={{ borderTop:`1px solid ${C.b}`, padding:"9px 12px", flexShrink:0, background:C.bg }}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:4, marginBottom:8 }}>
              {[["25","Nano"],["60","Mini"],["100","Std"],["200","XL"]].map(([s, l]) => (
                <button key={l} onClick={() => setParams(p => ({ ...p, w:+s, h:+s, d:+s }))}
                  style={{ padding:"4px 2px", borderRadius:6, fontSize:9, fontWeight:800, border:`1px solid ${params.w===+s?C.or:C.b}`, background:params.w===+s?"rgba(255,101,51,0.12)":"transparent", color:params.w===+s?C.or:C.dim, textTransform:"uppercase" }}>
                  {l}<br/><span style={{ fontSize:8, fontWeight:400 }}>{s}mm</span>
                </button>
              ))}
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:7 }}>
              <span style={{ fontSize:9, color:C.dim, flexShrink:0, fontWeight:600 }}>RELLENO</span>
              <input type="range" min={5} max={100} value={params.infill} onChange={e => setParams(p => ({ ...p, infill:+e.target.value }))} style={{ flex:1 }} />
              <span style={{ fontSize:10, fontWeight:800, color:C.or, width:30, textAlign:"right", fontFamily:"'JetBrains Mono',monospace" }}>{params.infill}%</span>
            </div>
            <div style={{ display:"flex", gap:3 }}>
              {Object.keys(MATS).map(m => (
                <button key={m} onClick={() => setParams(p => ({ ...p, material:m }))}
                  style={{ flex:1, padding:"3px 2px", borderRadius:5, fontSize:8, fontWeight:700, border:`1px solid ${params.material===m?MATS[m].c:C.b}`, background:params.material===m?`${MATS[m].c}18`:"transparent", color:params.material===m?MATS[m].c:C.dim, transition:"all .15s" }}>{m}</button>
              ))}
            </div>
          </div>
        </aside>

        {/* CENTER MAIN */}
        <main style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", position:"relative" }}>

          {/* 3D VIEWPORT */}
          {viewMode === "3d" && (
            <div style={{ flex:1, position:"relative", overflow:"hidden", cursor:"grab", background:`radial-gradient(ellipse at 38% 36%,rgba(0,229,192,0.03),transparent 52%),radial-gradient(ellipse at 66% 62%,rgba(255,101,51,0.025),transparent 48%),${C.bg}` }}
              onMouseDown={h3d.onMouseDown} onMouseMove={h3d.onMouseMove}
              onMouseUp={h3d.onMouseUp} onMouseLeave={h3d.onMouseUp}
              onWheel={h3d.onWheel}
              onTouchStart={h3d.onTouchStart} onTouchMove={h3d.onTouchMove} onTouchEnd={h3d.onTouchEnd}
            >
              <canvas ref={canvasRef} width={860} height={540} style={{ width:"100%", height:"100%", display:"block" }} />

              {!d && !loading && (
                <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:14, pointerEvents:"none" }}>
                  <div className="fl" style={{ fontSize:80, opacity:0.07 }}>🖨️</div>
                  <div style={{ fontWeight:900, fontSize:22, color:"rgba(255,255,255,0.07)", letterSpacing:-0.5 }}>Describe algo para empezar</div>
                </div>
              )}

              {loading && (
                <div style={{ position:"absolute", inset:0, background:"rgba(7,9,15,0.88)", backdropFilter:"blur(10px)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:22 }}>
                  <div style={{ position:"relative", width:76, height:76 }}>
                    <div style={{ position:"absolute", inset:0, border:"3px solid rgba(255,101,51,0.14)", borderTop:`3px solid ${C.or}`, borderRadius:"50%", animation:"spin 0.9s linear infinite" }} />
                    <div style={{ position:"absolute", inset:11, border:"2px solid rgba(0,229,192,0.1)", borderTop:`2px solid ${C.teal}`, borderRadius:"50%", animation:"spinR 1.3s linear infinite" }} />
                    <div style={{ position:"absolute", inset:22, border:"1.5px solid rgba(244,114,182,0.1)", borderTop:`1.5px solid ${C.pink}`, borderRadius:"50%", animation:"spin 1.8s linear infinite" }} />
                  </div>
                  <div style={{ textAlign:"center" }}>
                    <div className="grad-brand" style={{ fontWeight:900, fontSize:19, letterSpacing:-0.5, marginBottom:5 }}>Forjando tu diseño…</div>
                    <div style={{ fontSize:12, color:C.sub, animation:"pulse 1.6s infinite" }}>Calculando geometría, materiales y parámetros óptimos</div>
                  </div>
                </div>
              )}

              {d && (
                <div className="fu sc" style={{ position:"absolute", top:13, left:13, background:"rgba(7,9,15,0.93)", backdropFilter:"blur(18px)", borderRadius:14, padding:"11px 14px", border:`1px solid ${C.b}`, boxShadow:"0 10px 36px rgba(0,0,0,0.45)", maxWidth:240 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:7 }}>
                    <div style={{ width:38, height:38, borderRadius:10, flexShrink:0, background:`linear-gradient(135deg,${d.primaryColor||C.or},${d.secondaryColor||C.pink})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:19, boxShadow:`0 4px 16px ${d.primaryColor||C.or}55` }}>{d.emoji || "🎨"}</div>
                    <div>
                      <div style={{ fontSize:14, fontWeight:900, lineHeight:1.1, letterSpacing:-0.3 }}>{d.name}</div>
                      <div style={{ fontSize:10, color:C.sub, marginTop:1, lineHeight:1.3 }}>{d.tagline}</div>
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:3, flexWrap:"wrap", alignItems:"center" }}>
                    {d.vibe && <span style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:10, background:`${vc}16`, color:vc }}>{d.vibe}</span>}
                    {diff && <span style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:10, background:`${diff.c}16`, color:diff.c }}>{"█".repeat(diff.b)}{"░".repeat(4-diff.b)} {diff.l}</span>}
                    <button onClick={() => setFavs(f => f.includes(d.name) ? f.filter(x => x !== d.name) : [...f, d.name])}
                      style={{ padding:"2px 6px", borderRadius:10, background:favs.includes(d.name)?"rgba(255,193,7,0.15)":"rgba(255,255,255,0.05)", border:`1px solid ${favs.includes(d.name)?"rgba(255,193,7,0.35)":C.b}`, color:favs.includes(d.name)?C.gold:C.dim, fontSize:11, fontWeight:700 }}>
                      {favs.includes(d.name) ? "★" : "☆"}
                    </button>
                    <button onClick={shareDesign} style={{ padding:"2px 6px", borderRadius:10, background:"rgba(255,255,255,0.04)", border:`1px solid ${C.b}`, color:C.dim, fontSize:10, fontWeight:600 }}>↗</button>
                  </div>
                </div>
              )}

              {/* Viewport controls */}
              <div style={{ position:"absolute", top:13, right:13, display:"flex", flexDirection:"column", gap:4 }}>
                {[
                  { i:"↺", a:h3d.reset,      tip:"Reset vista"   },
                  { i:"+", a:h3d.zoomIn,      tip:"Zoom in"       },
                  { i:"−", a:h3d.zoomOut,     tip:"Zoom out"      },
                ].map(({ i, a, tip }) => (
                  <button key={tip} onClick={a} title={tip} style={{ width:32, height:32, borderRadius:8, border:`1px solid ${C.b}`, background:"rgba(7,9,15,0.88)", color:C.sub, fontSize:14, display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(8px)", transition:"all .18s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = C.or; e.currentTarget.style.color = C.or; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = C.b;  e.currentTarget.style.color = C.sub; }}>{i}</button>
                ))}
                <div style={{ height:1, background:C.b, margin:"2px 0" }} />
                {[
                  { i:"⊡", a:h3d.front,  tip:"Frente"     },
                  { i:"⊞", a:h3d.top,    tip:"Superior"   },
                  { i:"⊟", a:h3d.side,   tip:"Lateral"    },
                  { i:"◇", a:h3d.iso,    tip:"Isométrico" },
                ].map(({ i, a, tip }) => (
                  <button key={tip} onClick={a} title={tip} style={{ width:32, height:32, borderRadius:8, border:`1px solid ${C.b}`, background:"rgba(7,9,15,0.88)", color:C.sub, fontSize:13, display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(8px)", transition:"all .18s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = C.teal; e.currentTarget.style.color = C.teal; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = C.b;    e.currentTarget.style.color = C.sub; }}>{i}</button>
                ))}
                <div style={{ height:1, background:C.b, margin:"2px 0" }} />
                <button onClick={h3d.toggleWire} title="Wireframe" style={{ width:32, height:32, borderRadius:8, border:`1px solid ${C.b}`, background:"rgba(7,9,15,0.88)", color:C.sub, fontSize:12, display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(8px)" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.pur; e.currentTarget.style.color = C.pur; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.b;   e.currentTarget.style.color = C.sub; }}>⬡</button>
              </div>

              <div style={{ position:"absolute", bottom:11, left:13, fontSize:10, color:"rgba(255,255,255,0.18)", fontWeight:500 }}>Arrastra · Scroll para zoom · Touch soportado</div>
            </div>
          )}

          {/* SPECS VIEW */}
          {viewMode === "specs" && (
            <div className="fu" style={{ flex:1, overflowY:"auto", padding:22, background:C.bg }}>
              {d ? (
                <div style={{ maxWidth:700, margin:"0 auto" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
                    <div style={{ fontSize:44 }}>{d.emoji}</div>
                    <div>
                      <div style={{ fontSize:26, fontWeight:900, letterSpacing:-1 }}>{d.name}</div>
                      <div style={{ fontSize:13, color:C.sub }}>{d.tagline}</div>
                    </div>
                    <div style={{ marginLeft:"auto", display:"flex", gap:6 }}>
                      <button onClick={copySpecs} style={{ padding:"6px 13px", borderRadius:8, border:`1px solid ${C.b}`, background:"rgba(255,255,255,0.05)", color:C.sub, fontSize:11, fontWeight:600 }}>📋 Copiar</button>
                      <button onClick={exportJSON} style={{ padding:"6px 13px", borderRadius:8, border:`1px solid ${C.b}`, background:"rgba(255,255,255,0.05)", color:C.sub, fontSize:11, fontWeight:600 }}>{"{ }"} JSON</button>
                    </div>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:9, marginBottom:18 }}>
                    {[
                      {l:"Ancho",     v:`${d.dimensions?.w}mm`,        c:C.teal},
                      {l:"Alto",      v:`${d.dimensions?.h}mm`,        c:C.grn},
                      {l:"Profundo",  v:`${d.dimensions?.d}mm`,        c:C.pur},
                      {l:"Material",  v:d.material,                    c:mat?.c||C.or},
                      {l:"Relleno",   v:`${d.infill}%`,                c:C.or},
                      {l:"Capa",      v:`${d.layerHeight||params.layerH}mm`, c:C.blu},
                      {l:"Soportes",  v:d.supports?"Sí":"No",          c:d.supports?C.yel:C.grn},
                      {l:"Tiempo",    v:d.printTime||"—",              c:C.teal},
                      {l:"Costo",     v:`$${d.costUSD} USD`,           c:C.grn},
                      {l:"Peso",      v:`${d.filamentGrams}g`,         c:C.or},
                      {l:"Filamento", v:`${d.filamentMeters}m`,        c:C.pur},
                      {l:"Dificultad",v:diff?.l||"—",                  c:diff?.c||C.yel},
                    ].map(({ l, v, c }) => (
                      <div key={l} style={{ background:C.card, border:`1px solid ${C.b}`, borderRadius:11, padding:"12px 14px" }}>
                        <div style={{ fontSize:9, color:C.dim, marginBottom:3, fontWeight:700, letterSpacing:0.5, textTransform:"uppercase" }}>{l}</div>
                        <div style={{ fontSize:17, fontWeight:900, color:c, fontFamily:"'JetBrains Mono',monospace" }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  {d.printProfile && (
                    <div style={{ background:C.card, border:`1px solid ${C.b}`, borderRadius:11, padding:"14px 18px", marginBottom:12 }}>
                      <div style={{ fontSize:9, fontWeight:700, color:C.sub, letterSpacing:1.5, textTransform:"uppercase", marginBottom:10 }}>⚙️ Perfil de impresión</div>
                      <div style={{ display:"flex", gap:20, flexWrap:"wrap" }}>
                        {[["Velocidad",`${d.printProfile.speed}mm/s`,C.teal],["Temperatura",`${d.printProfile.temperature}°C`,C.or],["Enfriamiento",d.printProfile.cooling,C.blu],["1ª capa",`${d.printProfile.firstLayerSpeed||25}mm/s`,C.grn]].map(([l,v,c]) => (
                          <div key={l}><div style={{ fontSize:9, color:C.dim, marginBottom:2, textTransform:"uppercase", letterSpacing:0.4, fontWeight:600 }}>{l}</div><div style={{ fontSize:16, fontWeight:900, color:c, fontFamily:"'JetBrains Mono',monospace" }}>{v}</div></div>
                        ))}
                      </div>
                    </div>
                  )}
                  {d.funFact && (
                    <div style={{ background:`${C.teal}0c`, border:`1px solid ${C.teal}22`, borderRadius:11, padding:"12px 16px" }}>
                      <div style={{ fontSize:9, fontWeight:700, color:C.teal, letterSpacing:1.5, marginBottom:4, textTransform:"uppercase" }}>🌟 Dato curioso</div>
                      <div style={{ fontSize:13, color:C.tx, lineHeight:1.65 }}>{d.funFact}</div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:C.dim, fontWeight:700, padding:80, textAlign:"center" }}>📊 Genera un diseño para ver las especificaciones</div>
              )}
            </div>
          )}

          {/* GCODE VIEW */}
          {viewMode === "gcode" && (
            <div className="fu" style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
              {d ? (
                <>
                  <div style={{ padding:"10px 16px", borderBottom:`1px solid ${C.b}`, display:"flex", gap:8, alignItems:"center", background:C.surf, flexShrink:0 }}>
                    <div style={{ flex:1, fontSize:12, fontWeight:600, color:C.sub }}>💾 G-Code preview — {d.name}</div>
                    <button onClick={exportGcode} style={{ padding:"5px 14px", borderRadius:7, border:"none", fontSize:11, fontWeight:800, background:`linear-gradient(90deg,${C.or},${C.pink})`, color:"#fff" }}>⬇ .gcode</button>
                  </div>
                  <div style={{ flex:1, overflowY:"auto", padding:16 }}>
                    <pre style={{ background:"#04060e", border:`1px solid ${C.b}`, borderRadius:12, padding:18, fontSize:10.5, color:"#4fffcc", lineHeight:1.9, fontFamily:"'JetBrains Mono',monospace", whiteSpace:"pre-wrap", wordBreak:"break-word" }}>
{`; PRINTBOT PRO v${APP_VERSION} — G-Code Export
; Object  : ${d.name} (${d.category})
; Material: ${d.material} @ ${mat?.t||200}°C / Bed ${mat?.b||60}°C
; Size    : ${d.dimensions?.w}x${d.dimensions?.h}x${d.dimensions?.d}mm
; Layer   : ${d.layerHeight||params.layerH}mm | Infill: ${d.infill||params.infill}%
; Time    : ${d.printTime} | Mass: ${d.filamentGrams}g | Cost: $${d.costUSD}

M104 S${mat?.t||200}    ; Hotend
M140 S${mat?.b||60}    ; Bed
M109 S${mat?.t||200}    ; Wait hotend
M190 S${mat?.b||60}    ; Wait bed

G28          ; Home
G29          ; Bed level
G92 E0
G1 Z5 F5000

; Purge line
G1 X0.1 Y20 Z0.3 F5000
G1 X0.1 Y200 E18 F${(d.printProfile?.firstLayerSpeed||25)*60}
G92 E0

${(d.parts||[]).map((p,i)=>`; Part ${i+1}: ${p.name} (${p.shape})\nG1 X${Math.round((p.x||0)+(d.dimensions?.w||80)/2)} Y${Math.round((p.z||0)+(d.dimensions?.d||80)/2)} Z0.2 F3000`).join("\n\n")}

; End
G1 E-3 F3000
G91 G1 Z15 G90
G28 X0 Y0
M104 S0 M140 S0 M107 M84
; PRINTBOT PRO`}
                    </pre>
                  </div>
                </>
              ) : (
                <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:C.dim, fontWeight:700 }}>💾 Genera un diseño primero</div>
              )}
            </div>
          )}

          {/* COMPARE VIEW */}
          {viewMode === "compare" && (
            <div className="fu" style={{ flex:1, overflowY:"auto", padding:22, background:C.bg }}>
              <div style={{ maxWidth:860, margin:"0 auto" }}>
                <div style={{ fontSize:16, fontWeight:800, marginBottom:16 }}>⇄ Comparar diseños</div>
                {history.length < 2 ? (
                  <div style={{ textAlign:"center", padding:"60px 20px", color:C.dim }}>
                    Necesitas al menos 2 diseños generados para comparar.<br /><br />
                    <button onClick={() => setViewMode("3d")} style={{ padding:"8px 18px", borderRadius:9, border:`1px solid ${C.b}`, background:"rgba(255,255,255,0.05)", color:C.sub, fontSize:12, fontWeight:600 }}>← Ir a diseñar</button>
                  </div>
                ) : (
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                    {[d, ...history.map(h => h.design)].filter(Boolean).slice(0, 2).map((des, ci) => (
                      <div key={ci} style={{ background:C.card, border:`1px solid ${C.b}`, borderRadius:14, padding:16 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                          <div style={{ width:36, height:36, borderRadius:9, background:`linear-gradient(135deg,${des.primaryColor||C.or},${des.secondaryColor||C.pink})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>{des.emoji}</div>
                          <div>
                            <div style={{ fontWeight:800, fontSize:14 }}>{des.name}</div>
                            <div style={{ fontSize:10, color:C.sub }}>{des.tagline}</div>
                          </div>
                        </div>
                        {[["Material",des.material,MATS[des.material]?.c||C.or],["Tiempo",des.printTime,C.teal],["Costo",`$${des.costUSD}`,C.grn],["Peso",`${des.filamentGrams}g`,C.or],["Dificultad",DIFFS[des.difficulty]?.l||des.difficulty,DIFFS[des.difficulty]?.c||C.yel],["Infill",`${des.infill}%`,C.pur]].map(([l,v,c]) => (
                          <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:`1px solid ${C.b}` }}>
                            <span style={{ fontSize:11, color:C.sub }}>{l}</span>
                            <span style={{ fontSize:11, fontWeight:700, color:c, fontFamily:"'JetBrains Mono',monospace" }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STATUS BAR */}
          {d && viewMode === "3d" && (
            <div className="fu" style={{ height:48, background:"rgba(7,9,15,0.98)", borderTop:`1px solid ${C.b}`, flexShrink:0, display:"flex", alignItems:"center", padding:"0 13px", overflow:"hidden", backdropFilter:"blur(16px)" }}>
              <div style={{ display:"flex", gap:5, flex:1, overflowX:"auto", paddingRight:8 }}>
                {[{i:"⏱",l:"Tiempo",v:d.printTime||"—",c:C.teal},{i:"⚖",l:"Peso",v:`${d.filamentGrams||"—"}g`,c:C.or},{i:"🧱",l:"Mat",v:d.material,c:mat?.c||C.or},{i:"◼",l:"Relleno",v:`${d.infill||params.infill}%`,c:C.grn},{i:"💰",l:"Costo",v:`$${d.costUSD||"—"}`,c:C.grn},{i:"📐",l:"Tamaño",v:`${d.dimensions?.w}x${d.dimensions?.h}mm`,c:C.blu}].map(({ i, l, v, c }) => (
                  <div key={l} style={{ display:"flex", alignItems:"center", gap:4, padding:"3px 8px", borderRadius:6, background:`${c}10`, border:`1px solid ${c}22`, flexShrink:0 }}>
                    <span style={{ fontSize:11 }}>{i}</span>
                    <div>
                      <div style={{ fontSize:8, color:C.dim, lineHeight:1, fontWeight:700, letterSpacing:0.3, textTransform:"uppercase" }}>{l}</div>
                      <div style={{ fontSize:10, fontWeight:700, color:c, fontFamily:"'JetBrains Mono',monospace", lineHeight:1.2 }}>{v}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex", gap:4, flexShrink:0 }}>
                <button onClick={copySpecs}  style={{ padding:"4px 9px", borderRadius:6, border:`1px solid ${C.b}`, background:"rgba(255,255,255,0.04)", color:C.sub, fontSize:10, fontWeight:600 }}>📋</button>
                <button onClick={exportJSON} style={{ padding:"4px 9px", borderRadius:6, border:`1px solid ${C.b}`, background:"rgba(255,255,255,0.04)", color:C.sub, fontSize:10, fontWeight:600 }}>{"{ }"}</button>
                <button onClick={shareDesign} style={{ padding:"4px 9px", borderRadius:6, border:`1px solid ${C.b}`, background:"rgba(255,255,255,0.04)", color:C.sub, fontSize:10, fontWeight:600 }}>↗</button>
                <button onClick={exportGcode} style={{ padding:"4px 13px", borderRadius:7, border:"none", background:`linear-gradient(90deg,${C.or},${C.pink})`, color:"#fff", fontSize:11, fontWeight:800, boxShadow:`0 2px 12px rgba(255,101,51,0.32)` }}>⬇ G-Code</button>
              </div>
            </div>
          )}
        </main>

        {/* RIGHT PANEL */}
        <aside style={{ width:258, background:C.surf, borderLeft:`1px solid ${C.b}`, display:"flex", flexDirection:"column", overflow:"hidden", flexShrink:0 }}>
          <div style={{ display:"flex", padding:"8px 8px 0", borderBottom:`1px solid ${C.b}`, paddingBottom:8, flexShrink:0 }}>
            {[{id:"info",l:"ℹ Info"},{id:"parts",l:"⬡ Partes"},{id:"tips",l:"💡 Tips"},{id:"hist",l:"⟳ Hist"},{id:"stats",l:"📊 Stats"}].map(t => (
              <button key={t.id} onClick={() => setRightTab(t.id)} style={{ flex:1, padding:"6px 3px", borderRadius:7, fontSize:10, border:"none", background:rightTab===t.id?"rgba(255,101,51,0.12)":"transparent", color:rightTab===t.id?C.or:C.dim, fontWeight:600, transition:"all .15s" }}>{t.l}</button>
            ))}
          </div>

          <div style={{ flex:1, overflowY:"auto", padding:"12px 10px" }}>

            {/* INFO TAB */}
            {rightTab === "info" && d && (
              <div className="fu">
                {/* Color palette */}
                <div style={{ marginBottom:10 }}>
                  <div style={{ fontSize:8, fontWeight:700, color:C.dim, letterSpacing:1.8, textTransform:"uppercase", marginBottom:5 }}>🎨 Paleta</div>
                  <div style={{ display:"flex", gap:4 }}>
                    {[d.primaryColor, d.secondaryColor, d.accentColor].filter(Boolean).map((col, i) => (
                      <div key={i} title={col} style={{ flex:1, height:28, borderRadius:7, background:col, border:"1.5px solid rgba(255,255,255,0.1)", boxShadow:`0 4px 10px ${col}44`, cursor:"pointer", transition:"transform .15s" }}
                        onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.1)"; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }} />
                    ))}
                  </div>
                </div>
                {/* Stats grid */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:5, marginBottom:10 }}>
                  {[{i:"⏱",l:"Tiempo",v:d.printTime||"—",c:C.teal},{i:"💰",l:"Costo",v:`$${d.costUSD||"—"}`,c:C.grn},{i:"⚖",l:"Peso",v:`${d.filamentGrams||"—"}g`,c:C.or},{i:"📏",l:"Hilo",v:`${d.filamentMeters||"—"}m`,c:C.pur}].map(({ i, l, v, c }) => (
                    <div key={l} style={{ background:C.card, border:`1px solid ${C.b}`, borderRadius:9, padding:"8px 10px" }}>
                      <div style={{ display:"flex", gap:4, alignItems:"center", marginBottom:2 }}><span style={{ fontSize:11 }}>{i}</span><span style={{ fontSize:8, color:C.dim, fontWeight:700, letterSpacing:0.5, textTransform:"uppercase" }}>{l}</span></div>
                      <div style={{ fontSize:15, fontWeight:900, color:c, fontFamily:"'JetBrains Mono',monospace" }}>{v}</div>
                    </div>
                  ))}
                </div>
                {/* Difficulty */}
                {diff && (
                  <div style={{ marginBottom:10 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                      <span style={{ fontSize:8, fontWeight:700, color:C.dim, letterSpacing:1.8, textTransform:"uppercase" }}>Dificultad</span>
                      <span style={{ fontSize:10, fontWeight:700, color:diff.c }}>{diff.l}</span>
                    </div>
                    <div style={{ display:"flex", gap:3 }}>
                      {Array.from({ length:4 }).map((_, i) => (
                        <div key={i} style={{ height:4, flex:1, borderRadius:2, background:i<diff.b?diff.c:"rgba(255,255,255,0.07)", boxShadow:i<diff.b?`0 0 6px ${diff.c}66`:"none", transition:"all .4s" }} />
                      ))}
                    </div>
                    <div style={{ fontSize:9, color:C.dim, marginTop:2 }}>{diff.d}</div>
                  </div>
                )}
                {/* Dimensions */}
                <div style={{ background:C.card, border:`1px solid ${C.b}`, borderRadius:9, padding:10, marginBottom:10 }}>
                  <div style={{ fontSize:8, fontWeight:700, color:C.dim, letterSpacing:1.8, textTransform:"uppercase", marginBottom:6 }}>📐 Dimensiones</div>
                  <div style={{ display:"flex", gap:4 }}>
                    {[["W",d.dimensions?.w,C.teal],["H",d.dimensions?.h,C.grn],["D",d.dimensions?.d,C.pur]].map(([ax, val, col]) => (
                      <div key={ax} style={{ flex:1, textAlign:"center", background:C.surf, borderRadius:7, padding:"6px 3px", border:`1px solid ${C.b}` }}>
                        <div style={{ fontSize:15, fontWeight:900, color:col, fontFamily:"'JetBrains Mono',monospace", lineHeight:1 }}>{val}</div>
                        <div style={{ fontSize:8, color:C.dim, marginTop:2 }}>mm {ax}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Material info */}
                {mat && (
                  <div style={{ background:C.card, border:`1px solid ${C.b}`, borderRadius:9, padding:10, marginBottom:10 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:7 }}>
                      <span style={{ fontSize:18 }}>{mat.icon}</span>
                      <div>
                        <div style={{ fontSize:12, fontWeight:900, color:mat.c }}>{d.material}</div>
                        <div style={{ fontSize:9, color:C.dim }}>{mat.info}</div>
                      </div>
                      <div style={{ marginLeft:"auto", textAlign:"right" }}>
                        <div style={{ fontSize:10, fontWeight:700, color:C.tx, fontFamily:"'JetBrains Mono',monospace" }}>{mat.t}°C</div>
                        <div style={{ fontSize:8, color:C.dim }}>cama {mat.b}°C</div>
                      </div>
                    </div>
                    {[["Flexibilidad",mat.fl,C.teal],["Resistencia",mat.st,C.or]].map(([l, v, c]) => (
                      <div key={l} style={{ marginBottom:5 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}><span style={{ fontSize:8, color:C.sub }}>{l}</span><span style={{ fontSize:8, color:c, fontWeight:700 }}>{v}/5</span></div>
                        <div style={{ display:"flex", gap:2 }}>{Array.from({length:5}).map((_,i) => <div key={i} style={{ height:3, flex:1, borderRadius:2, background:i<v?c:"rgba(255,255,255,0.06)" }} />)}</div>
                      </div>
                    ))}
                  </div>
                )}
                {/* Fun fact */}
                {d.funFact && (
                  <div style={{ background:`${C.teal}0c`, border:`1px solid ${C.teal}20`, borderRadius:9, padding:10, marginBottom:10 }}>
                    <div style={{ fontSize:8, fontWeight:700, color:C.teal, letterSpacing:1.5, marginBottom:3, textTransform:"uppercase" }}>🌟 Dato curioso</div>
                    <div style={{ fontSize:11, color:C.tx, lineHeight:1.6 }}>{d.funFact}</div>
                  </div>
                )}
                {/* Remix ideas */}
                {d.remixIdeas?.length > 0 && (
                  <div>
                    <div style={{ fontSize:8, fontWeight:700, color:C.dim, letterSpacing:1.8, textTransform:"uppercase", marginBottom:6 }}>🎨 Remix ideas</div>
                    {d.remixIdeas.map((r, i) => (
                      <button key={i} onClick={() => { setPrompt(r); setWelcome(false); }}
                        style={{ width:"100%", textAlign:"left", padding:"7px 9px", borderRadius:7, marginBottom:4, background:"transparent", border:`1px solid ${C.b}`, color:C.sub, fontSize:11, display:"flex", gap:6, alignItems:"flex-start", transition:"all .14s" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = C.or; e.currentTarget.style.background = "rgba(255,101,51,0.05)"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = C.b; e.currentTarget.style.background = "transparent"; }}>
                        <span style={{ color:C.or, flexShrink:0, marginTop:1 }}>✦</span>
                        <span style={{ lineHeight:1.4 }}>{r}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* PARTS TAB */}
            {rightTab === "parts" && (
              <div className="fu">
                {d ? (
                  <>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                      <div style={{ fontSize:8, fontWeight:700, color:C.dim, letterSpacing:1.8, textTransform:"uppercase" }}>{d.parts?.length || 0} partes</div>
                      <span style={{ fontSize:9, color:C.sub }}>{d.supports ? "Con soportes" : "Sin soportes"}</span>
                    </div>
                    {(d.parts || []).map((p, i) => (
                      <div key={i} style={{ display:"flex", alignItems:"center", gap:7, padding:"7px 8px", borderRadius:7, background:"rgba(255,255,255,0.03)", border:`1px solid ${C.b}`, marginBottom:4, transition:"all .14s" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}>
                        <div style={{ width:15, height:15, borderRadius: p.shape==="sphere"?"50%":"3px", background:p.color||"#888", flexShrink:0, border:"1.5px solid rgba(255,255,255,0.14)", boxShadow:`0 0 6px ${p.color||"#888"}44` }} />
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:10, fontWeight:700, color:C.tx, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{p.name}</div>
                          <div style={{ fontSize:8, color:C.dim, fontFamily:"'JetBrains Mono',monospace" }}>{p.shape} {p.w}x{p.h}x{p.d}mm</div>
                        </div>
                        <div style={{ fontSize:7, color:C.dim, background:"rgba(255,255,255,0.04)", padding:"2px 4px", borderRadius:3, fontFamily:"monospace", flexShrink:0 }}>{(p.shape||"box").slice(0,4).toUpperCase()}</div>
                      </div>
                    ))}
                  </>
                ) : <div style={{ textAlign:"center", padding:"40px 0", color:C.dim, fontSize:11 }}>Genera un diseño primero</div>}
              </div>
            )}

            {/* TIPS TAB */}
            {rightTab === "tips" && (
              <div className="fu">
                {d ? (
                  <>
                    {(d.warnings || []).filter(w => w).length > 0 && (
                      <div style={{ marginBottom:12 }}>
                        <div style={{ fontSize:8, fontWeight:700, color:C.red, letterSpacing:1.8, textTransform:"uppercase", marginBottom:5 }}>⚠️ Advertencias</div>
                        {d.warnings.filter(w => w).map((w, i) => (
                          <div key={i} style={{ display:"flex", gap:7, padding:"8px 10px", borderRadius:7, background:"rgba(248,113,113,0.07)", border:"1px solid rgba(248,113,113,0.2)", marginBottom:4 }}>
                            <span style={{ flexShrink:0, fontSize:12 }}>⚠️</span>
                            <span style={{ fontSize:11, color:"#fca5a5", lineHeight:1.55 }}>{w}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ fontSize:8, fontWeight:700, color:C.dim, letterSpacing:1.8, textTransform:"uppercase", marginBottom:5 }}>💡 Consejos</div>
                    {(d.tips || []).map((tip, i) => (
                      <div key={i} style={{ display:"flex", gap:7, padding:"8px 10px", borderRadius:7, background:"rgba(255,255,255,0.03)", border:`1px solid ${C.b}`, marginBottom:5 }}>
                        <span style={{ color:C.or, flexShrink:0, marginTop:1 }}>✦</span>
                        <span style={{ fontSize:11, color:C.tx, lineHeight:1.6 }}>{tip}</span>
                      </div>
                    ))}
                    {(d.postProcessing || []).length > 0 && (
                      <div style={{ marginTop:10 }}>
                        <div style={{ fontSize:8, fontWeight:700, color:C.dim, letterSpacing:1.8, textTransform:"uppercase", marginBottom:5 }}>🎨 Post-procesado</div>
                        <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                          {d.postProcessing.map((p, i) => (
                            <span key={i} style={{ padding:"3px 9px", borderRadius:12, background:`${C.pur}16`, color:C.pur, fontSize:10, fontWeight:700, border:`1px solid ${C.pur}28` }}>{p}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : <div style={{ textAlign:"center", padding:"40px 0", color:C.dim, fontSize:11 }}>Genera un diseño primero</div>}
              </div>
            )}

            {/* HISTORY TAB */}
            {rightTab === "hist" && (
              <div className="fu">
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <div style={{ fontSize:8, fontWeight:700, color:C.dim, letterSpacing:1.8, textTransform:"uppercase" }}>{history.length} diseños · {favs.length} favs</div>
                  {history.length > 0 && <button onClick={() => { if (window.confirm("¿Limpiar historial?")) setHistory([]); }} style={{ fontSize:9, color:C.red, background:"none", border:"none", cursor:"pointer" }}>🗑 Limpiar</button>}
                </div>
                {history.length === 0 ? (
                  <div style={{ textAlign:"center", padding:"40px 0" }}>
                    <div style={{ fontSize:36, opacity:0.1, marginBottom:8 }}>📋</div>
                    <div style={{ fontSize:11, color:C.dim, lineHeight:1.6 }}>Aún no hay historial.<br />¡Genera tu primer diseño!</div>
                  </div>
                ) : history.map((h, i) => (
                  <div key={h.id || i} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px", borderRadius:9, cursor:"pointer", border:"1px solid transparent", marginBottom:3, transition:"all .14s" }}
                    onClick={() => { setDesign(h.design); setRightTab("info"); }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = C.b; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}>
                    <div style={{ width:32, height:32, borderRadius:8, flexShrink:0, background:`linear-gradient(135deg,${h.design?.primaryColor||"#888"},${h.design?.secondaryColor||"#555"})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, boxShadow:`0 3px 9px ${h.design?.primaryColor||"#888"}44` }}>{h.design?.emoji || "🎨"}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:C.tx, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{h.design?.name}</div>
                      <div style={{ fontSize:9, color:C.dim, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", marginBottom:2 }}>{h.prompt}</div>
                      <StarRating value={h.rating || 0} onChange={rating => rateItem(h.id, rating)} size={10} />
                    </div>
                    {favs.includes(h.design?.name) && <span style={{ fontSize:11, color:C.gold }}>★</span>}
                  </div>
                ))}
              </div>
            )}

            {/* STATS TAB */}
            {rightTab === "stats" && (
              <div className="fu">
                <div style={{ fontSize:8, fontWeight:700, color:C.dim, letterSpacing:1.8, textTransform:"uppercase", marginBottom:10 }}>📊 Tu actividad</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:5, marginBottom:12 }}>
                  {[{i:"🎨",l:"Diseños",v:stats.total,c:C.or},{i:"🔥",l:"Racha",v:`${stats.streak}d`,c:C.yel},{i:"⭐",l:"Favoritos",v:favs.length,c:C.gold},{i:"📋",l:"Guardados",v:history.length,c:C.teal}].map(({ i, l, v, c }) => (
                    <div key={l} style={{ background:C.card, border:`1px solid ${C.b}`, borderRadius:9, padding:"9px 10px", textAlign:"center" }}>
                      <div style={{ fontSize:18, marginBottom:2 }}>{i}</div>
                      <div style={{ fontSize:18, fontWeight:900, color:c, fontFamily:"'JetBrains Mono',monospace" }}>{v}</div>
                      <div style={{ fontSize:8, color:C.dim, textTransform:"uppercase", letterSpacing:0.5 }}>{l}</div>
                    </div>
                  ))}
                </div>
                {/* Material distribution */}
                {history.length > 0 && (
                  <div>
                    <div style={{ fontSize:8, fontWeight:700, color:C.dim, letterSpacing:1.8, textTransform:"uppercase", marginBottom:7 }}>🧱 Materiales usados</div>
                    {Object.entries(
                      history.reduce((acc, h) => {
                        const m = h.design?.material || "PLA";
                        acc[m] = (acc[m] || 0) + 1;
                        return acc;
                      }, {})
                    ).sort((a, b) => b[1] - a[1]).map(([m, cnt]) => (
                      <div key={m} style={{ marginBottom:5 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                          <span style={{ fontSize:10, color:C.sub, fontWeight:600 }}>{MATS[m]?.icon} {m}</span>
                          <span style={{ fontSize:10, color:MATS[m]?.c||C.or, fontWeight:700 }}>{cnt}</span>
                        </div>
                        <div style={{ height:3, background:"rgba(255,255,255,0.06)", borderRadius:2 }}>
                          <div style={{ height:3, width:`${(cnt/history.length)*100}%`, background:MATS[m]?.c||C.or, borderRadius:2, boxShadow:`0 0 6px ${MATS[m]?.c||C.or}66` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {topMaterial && (
                  <div style={{ marginTop:12, padding:10, background:`${C.or}0c`, border:`1px solid ${C.or}20`, borderRadius:9 }}>
                    <div style={{ fontSize:9, fontWeight:700, color:C.or, marginBottom:2 }}>🏆 Material favorito</div>
                    <div style={{ fontSize:13, fontWeight:800, color:C.tx }}>{MATS[topMaterial]?.icon} {topMaterial}</div>
                    <div style={{ fontSize:9, color:C.dim }}>{MATS[topMaterial]?.info}</div>
                  </div>
                )}
                {!proActive && <button onClick={() => setModal("upgrade")} style={{ width:"100%", marginTop:12, padding:"9px", borderRadius:9, border:"1px solid rgba(255,193,7,0.3)", background:"rgba(255,193,7,0.08)", color:C.gold, fontSize:11, fontWeight:800 }}>👑 Estadísticas PRO →</button>}
              </div>
            )}

            {!d && rightTab !== "hist" && rightTab !== "stats" && (
              <div style={{ textAlign:"center", padding:"44px 14px", color:C.dim }}>
                <div className="fl" style={{ fontSize:38, opacity:0.1, marginBottom:10 }}>🖨️</div>
                <div style={{ fontSize:12, lineHeight:1.7 }}>Genera tu primer<br />diseño para comenzar</div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ═══════════════ UPGRADE MODAL ══════════════════════════════ */}
      {modal === "upgrade" && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(12px)" }} onClick={() => setModal(null)}>
          <div className="sc" onClick={e => e.stopPropagation()} style={{ background:C.surf, border:`1px solid ${C.b}`, borderRadius:22, padding:28, width:540, maxWidth:"94vw", maxHeight:"90vh", overflowY:"auto", boxShadow:"0 44px 100px rgba(0,0,0,0.75)" }}>
            <div style={{ textAlign:"center", marginBottom:22 }}>
              <div style={{ fontSize:50, marginBottom:8 }}>👑</div>
              <div className="grad-gold" style={{ fontSize:26, fontWeight:900, letterSpacing:-0.8, marginBottom:5 }}>PRINTBOT PRO</div>
              <div style={{ fontSize:13, color:C.sub, lineHeight:1.65 }}>Acceso ilimitado. Sin esperas. Sin límites.<br />La experiencia de diseño 3D definitiva.</div>
            </div>

            {/* Blocked state */}
            {!freeStatus.canGen && freeStatus.nextAt && (
              <div style={{ background:"rgba(248,113,113,0.08)", border:"1px solid rgba(248,113,113,0.22)", borderRadius:12, padding:"12px 16px", marginBottom:18, textAlign:"center" }}>
                <div style={{ fontSize:12, color:C.red, fontWeight:700, marginBottom:6 }}>🚫 {FREE_LIMIT} intentos gratuitos agotados</div>
                <div style={{ fontSize:10, color:C.sub, marginBottom:8 }}>Próximo intento gratuito en:</div>
                <Countdown targetMs={freeStatus.nextAt} />
              </div>
            )}

            {/* Plans */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:9, marginBottom:20 }}>
              {Object.entries(PLANS).map(([key, plan]) => (
                <div key={key} style={{ background:key==="yearly"?`${C.gold}09`:C.card, border:`2px solid ${key==="yearly"?C.gold:C.b}`, borderRadius:14, padding:"14px 12px", position:"relative", overflow:"hidden" }}>
                  {plan.badge && (
                    <div style={{ position:"absolute", top:8, right:-22, background:key==="lifetime"?"linear-gradient(135deg,#9d6ef8,#f472b6)":"linear-gradient(135deg,#ffc107,#ffd54f)", color:key==="lifetime"?"#fff":"#000", fontSize:7, fontWeight:900, padding:"3px 28px", transform:"rotate(45deg)", letterSpacing:0.5 }}>{plan.badge}</div>
                  )}
                  <div style={{ fontSize:11, fontWeight:800, color:key==="yearly"?C.gold:C.sub, marginBottom:4 }}>{plan.label}</div>
                  <div style={{ marginBottom:2 }}>
                    <span style={{ fontSize:20, fontWeight:900, color:C.tx }}>${plan.price}</span>
                    <span style={{ fontSize:9, color:C.dim }}>/{key==="lifetime"?"único":"mes"}</span>
                  </div>
                  <div style={{ fontSize:9, color:C.dim, marginBottom:10 }}>{plan.sub}</div>
                  <button onClick={() => activatePro(key)} style={{ width:"100%", padding:"8px", borderRadius:9, border:"none", background:key==="yearly"?"linear-gradient(135deg,#ffc107,#ffd54f)":key==="lifetime"?"linear-gradient(135deg,#9d6ef8,#f472b6)":"rgba(255,255,255,0.08)", color:key==="monthly"?C.tx:"#000", fontSize:11, fontWeight:800, cursor:"pointer", fontFamily:"'Outfit',sans-serif" }}>
                    {key==="lifetime"?"Comprar":"Suscribir"}
                  </button>
                </div>
              ))}
            </div>

            {/* Feature table */}
            <div style={{ background:C.card, border:`1px solid ${C.b}`, borderRadius:14, padding:"14px 16px", marginBottom:16 }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 80px 80px", gap:0 }}>
                <div style={{ fontSize:9, fontWeight:700, color:C.dim, letterSpacing:1.5, textTransform:"uppercase", marginBottom:10 }}>Feature</div>
                <div style={{ textAlign:"center", fontSize:10, fontWeight:700, color:C.sub }}>Gratis</div>
                <div style={{ textAlign:"center", fontSize:10, fontWeight:800, color:C.gold }}>PRO 👑</div>
                {[
                  ["Diseños",`${FREE_LIMIT} totales`,"Ilimitados"],
                  ["Cadencia","1/semana","Sin espera"],
                  ["Refinamiento","Consume intento","Ilimitado"],
                  ["Wireframe + vistas","Básico","Completo"],
                  ["Estadísticas","Básicas","Avanzadas"],
                  ["Comparar diseños","✗","✓"],
                  ["Exportar JSON","✓","✓"],
                  ["Exportar G-Code","✓","✓"],
                  ["Soporte","Comunidad","Prioritario"],
                ].map(([feat, free, pro]) => [
                  <div key={feat+"f"} style={{ fontSize:10, color:C.sub, padding:"5px 0", borderBottom:`1px solid ${C.b}` }}>{feat}</div>,
                  <div key={feat+"fr"} style={{ fontSize:10, color:C.dim, textAlign:"center", padding:"5px 0", borderBottom:`1px solid ${C.b}` }}>{free}</div>,
                  <div key={feat+"pr"} style={{ fontSize:10, color:C.grn, textAlign:"center", padding:"5px 0", borderBottom:`1px solid ${C.b}`, fontWeight:700 }}>{pro}</div>,
                ])}
              </div>
            </div>

            <button onClick={() => setModal(null)} style={{ width:"100%", padding:"10px", borderRadius:10, border:`1px solid ${C.b}`, background:"transparent", color:C.dim, fontSize:12, fontWeight:600 }}>
              Continuar gratis ({freeStatus.left} intentos restantes)
            </button>
            <div style={{ textAlign:"center", marginTop:10, fontSize:9, color:C.dim, lineHeight:1.7 }}>✓ Cancela cuando quieras · ✓ Datos en tu dispositivo · ✓ Sin sorpresas</div>
          </div>
        </div>
      )}

      {/* ═══════════════ SETTINGS MODAL ═════════════════════════════ */}
      {modal === "settings" && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.82)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(12px)" }} onClick={() => setModal(null)}>
          <div className="sc" onClick={e => e.stopPropagation()} style={{ background:C.surf, border:`1px solid ${C.b}`, borderRadius:20, padding:24, width:510, maxWidth:"94vw", maxHeight:"90vh", overflowY:"auto", boxShadow:"0 32px 80px rgba(0,0,0,0.75)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
              <div style={{ fontSize:17, fontWeight:900, letterSpacing:-0.5 }}>⚙️ Configuración</div>
              <button onClick={() => setModal(null)} style={{ width:26, height:26, borderRadius:7, border:`1px solid ${C.b}`, background:"rgba(255,255,255,0.05)", color:C.sub, fontSize:14, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
            </div>

            {/* Dimensions */}
            <div style={{ fontSize:8, fontWeight:700, color:C.dim, letterSpacing:1.8, textTransform:"uppercase", marginBottom:6 }}>📐 Dimensiones objetivo (mm)</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:7, marginBottom:16 }}>
              {[["w","Ancho"],["h","Alto"],["d","Profundo"]].map(([ax, lbl]) => (
                <div key={ax}>
                  <label style={{ fontSize:9, color:C.dim, display:"block", marginBottom:4, textTransform:"uppercase", fontWeight:600, letterSpacing:0.5 }}>{lbl}</label>
                  <input type="number" min={5} max={500} value={params[ax]} onChange={e => setParams(p => ({ ...p, [ax]:+e.target.value }))}
                    style={{ width:"100%", background:"rgba(255,255,255,0.06)", border:`1.5px solid ${C.b}`, borderRadius:8, color:C.tx, fontSize:15, fontWeight:800, padding:"8px", textAlign:"center", fontFamily:"'JetBrains Mono',monospace", transition:"all .2s" }}
                    onFocus={e => { e.target.style.borderColor = C.or; }}
                    onBlur={e  => { e.target.style.borderColor = C.b; }} />
                </div>
              ))}
            </div>

            {/* Material */}
            <div style={{ fontSize:8, fontWeight:700, color:C.dim, letterSpacing:1.8, textTransform:"uppercase", marginBottom:6 }}>🧱 Material</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6, marginBottom:16 }}>
              {Object.entries(MATS).map(([m, info]) => (
                <div key={m} onClick={() => setParams(p => ({ ...p, material:m }))}
                  style={{ padding:"10px", borderRadius:9, cursor:"pointer", background:params.material===m?`${info.c}12`:"rgba(255,255,255,0.03)", border:`1.5px solid ${params.material===m?info.c:C.b}`, transition:"all .14s" }}>
                  <div style={{ fontSize:18, marginBottom:3 }}>{info.icon}</div>
                  <div style={{ fontSize:11, fontWeight:900, color:params.material===m?info.c:C.tx }}>{m}</div>
                  <div style={{ fontSize:8, color:C.dim, marginTop:1, lineHeight:1.4 }}>{info.tag}</div>
                  <div style={{ fontSize:8, color:C.dim, marginTop:2, fontFamily:"'JetBrains Mono',monospace" }}>{info.t}°C · {info.b}°C</div>
                </div>
              ))}
            </div>

            {/* Sliders */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                  <span style={{ fontSize:9, color:C.dim, fontWeight:700, letterSpacing:0.5, textTransform:"uppercase" }}>Relleno</span>
                  <span style={{ fontSize:12, fontWeight:900, color:C.or, fontFamily:"'JetBrains Mono',monospace" }}>{params.infill}%</span>
                </div>
                <input type="range" min={5} max={100} value={params.infill} onChange={e => setParams(p => ({ ...p, infill:+e.target.value }))} style={{ width:"100%" }} />
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:8, color:C.dim, marginTop:2 }}><span>5% rápido</span><span>100% sólido</span></div>
              </div>
              <div>
                <div style={{ fontSize:9, color:C.dim, fontWeight:700, letterSpacing:0.5, textTransform:"uppercase", marginBottom:5 }}>Capa</div>
                <select value={params.layerH} onChange={e => setParams(p => ({ ...p, layerH:+e.target.value }))}
                  style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:`1.5px solid ${C.b}`, borderRadius:8, color:C.tx, padding:"8px 10px", fontSize:11, fontFamily:"'Outfit',sans-serif" }}>
                  {[[0.1,"Ultra fino"],[0.15,"Fino"],[0.2,"Normal"],[0.25,"Draft"],[0.3,"Rápido"]].map(([v, l]) => <option key={v} value={v}>{l} — {v}mm</option>)}
                </select>
              </div>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9, marginBottom:14 }}>
              <div>
                <div style={{ fontSize:9, color:C.dim, fontWeight:700, letterSpacing:0.5, textTransform:"uppercase", marginBottom:5 }}>Adhesión de cama</div>
                <select value={params.bedAdhesion} onChange={e => setParams(p => ({ ...p, bedAdhesion:e.target.value }))}
                  style={{ width:"100%", background:"rgba(255,255,255,0.05)", border:`1.5px solid ${C.b}`, borderRadius:8, color:C.tx, padding:"8px 10px", fontSize:11, fontFamily:"'Outfit',sans-serif" }}>
                  {[["none","Ninguna"],["skirt","Skirt"],["brim","Brim ✓"],["raft","Raft"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:9, color:C.dim, fontWeight:700, letterSpacing:0.5, textTransform:"uppercase", marginBottom:5 }}>Color preferido</div>
                <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                  <input type="color" value={params.color} onChange={e => setParams(p => ({ ...p, color:e.target.value }))}
                    style={{ width:42, height:34, borderRadius:7, border:`1px solid ${C.b}`, background:"transparent", cursor:"pointer", padding:3 }} />
                  <div style={{ flex:1, height:34, borderRadius:7, background:params.color, border:"1px solid rgba(255,255,255,0.1)", boxShadow:`0 4px 14px ${params.color}55` }} />
                </div>
              </div>
            </div>

            {/* Toggles */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:16 }}>
              {[
                { key:"supports", label:"Soportes", icon:"🏗️", desc:"Para voladizos >45°" },
              ].map(({ key, label, icon, desc }) => (
                <div key={key} onClick={() => setParams(p => ({ ...p, [key]:!p[key] }))}
                  style={{ padding:"9px 11px", borderRadius:9, cursor:"pointer", background:params[key]?"rgba(255,101,51,0.1)":"rgba(255,255,255,0.03)", border:`1.5px solid ${params[key]?C.or:C.b}`, display:"flex", gap:8, alignItems:"center", transition:"all .14s" }}>
                  <span style={{ fontSize:16 }}>{icon}</span>
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:params[key]?C.or:C.tx }}>{label}</div>
                    <div style={{ fontSize:9, color:C.dim }}>{params[key]?"Activado":"Desactivado"} · {desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Account */}
            <div style={{ background:C.card, border:`1px solid ${C.b}`, borderRadius:11, padding:"13px 15px", marginBottom:14 }}>
              <div style={{ fontSize:8, fontWeight:700, color:C.dim, letterSpacing:1.8, textTransform:"uppercase", marginBottom:8 }}>👤 Cuenta</div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:800, color:proActive?C.gold:C.sub }}>{proActive ? "👑 PRO Activo" : "🆓 Plan Gratuito"}</div>
                  {proActive && proExpDate && <div style={{ fontSize:10, color:C.dim }}>Expira: {proExpDate}</div>}
                  {!proActive && <div style={{ fontSize:10, color:C.dim }}>{freeStatus.left}/{FREE_LIMIT} intentos semanales disponibles</div>}
                </div>
                {!proActive
                  ? <button onClick={() => setModal("upgrade")} style={{ padding:"6px 14px", borderRadius:8, border:"1px solid rgba(255,193,7,0.28)", background:"rgba(255,193,7,0.09)", color:C.gold, fontSize:11, fontWeight:800 }}>Mejorar →</button>
                  : <button onClick={() => { if (window.confirm("¿Cancelar suscripción PRO?")) { setIsPro(false); setProExp(null); addToast("PRO cancelado", "warn", "😢"); setModal(null); } }} style={{ padding:"5px 10px", borderRadius:7, border:`1px solid ${C.b}`, background:"transparent", color:C.dim, fontSize:10 }}>Cancelar</button>}
              </div>
              {!proActive && freeStatus.nextAt && (
                <div style={{ marginTop:8, fontSize:10, color:C.sub }}>
                  Próximo intento libre: <Countdown targetMs={freeStatus.nextAt} compact />
                </div>
              )}
            </div>

            <button onClick={() => setModal(null)} style={sBtn("linear-gradient(135deg,#ff6533,#f472b6)", "#fff", { boxShadow:"0 4px 20px rgba(255,101,51,0.32)" })}>
              ✓ Guardar configuración
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════ GALLERY MODAL ══════════════════════════════ */}
      {modal === "gallery" && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.92)", zIndex:200, display:"flex", flexDirection:"column", backdropFilter:"blur(12px)" }}>
          <div style={{ padding:"13px 20px", borderBottom:`1px solid ${C.b}`, display:"flex", alignItems:"center", gap:12, background:"rgba(7,9,15,0.97)", backdropFilter:"blur(16px)", flexShrink:0 }}>
            <div style={{ fontSize:16, fontWeight:900, letterSpacing:-0.5 }}>◈ Galería de diseños</div>
            <div style={{ fontSize:10, color:C.sub }}>{history.length} diseños · {favs.length} favoritos</div>
            <div style={{ marginLeft:"auto", display:"flex", gap:7 }}>
              <button onClick={() => { if (window.confirm("¿Limpiar galería?")) { setHistory([]); setModal(null); } }}
                style={{ padding:"4px 11px", borderRadius:7, border:"1px solid rgba(248,113,113,0.22)", background:"rgba(248,113,113,0.07)", color:C.red, fontSize:10, fontWeight:600 }}>🗑 Limpiar</button>
              <button onClick={() => setModal(null)} style={{ padding:"4px 13px", borderRadius:7, border:`1px solid ${C.b}`, background:"rgba(255,255,255,0.05)", color:C.sub, fontSize:10, fontWeight:600 }}>✕ Cerrar</button>
            </div>
          </div>
          <div style={{ flex:1, overflowY:"auto", padding:20 }}>
            {history.length === 0 ? (
              <div style={{ textAlign:"center", padding:"100px 20px" }}>
                <div style={{ fontSize:70, marginBottom:14, opacity:0.07 }}>🖼️</div>
                <div style={{ fontSize:20, fontWeight:900, marginBottom:8, opacity:0.2 }}>Galería vacía</div>
                <div style={{ fontSize:13, color:C.dim }}>Genera diseños y aparecerán aquí automáticamente</div>
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(175px,1fr))", gap:12, maxWidth:1200, margin:"0 auto" }}>
                {history.map((h, i) => (
                  <div key={h.id || i} className="hl" style={{ background:C.card, border:`1px solid ${C.b}`, borderRadius:14, overflow:"hidden", cursor:"pointer", animation:`fadeUp .4s ease ${i*0.035}s both` }}
                    onClick={() => { setDesign(h.design); setModal(null); setRightTab("info"); }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = h.design?.primaryColor || C.or; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = C.b; }}>
                    <div style={{ height:95, background:`linear-gradient(135deg,${h.design?.primaryColor||"#333"}26,${h.design?.secondaryColor||"#555"}26)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:46, position:"relative" }}>
                      {h.design?.emoji || "🎨"}
                      {favs.includes(h.design?.name) && <div style={{ position:"absolute", top:6, right:8, fontSize:12, color:C.gold }}>★</div>}
                      {h.rating > 0 && <div style={{ position:"absolute", bottom:5, right:7, fontSize:9, color:C.gold }}>{"★".repeat(h.rating)}</div>}
                    </div>
                    <div style={{ padding:"9px 11px" }}>
                      <div style={{ fontSize:11, fontWeight:800, marginBottom:1, letterSpacing:-0.2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{h.design?.name}</div>
                      <div style={{ fontSize:9, color:C.sub, marginBottom:6, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{h.design?.tagline}</div>
                      <div style={{ display:"flex", gap:3, flexWrap:"wrap" }}>
                        <span style={{ fontSize:8, padding:"2px 6px", borderRadius:9, background:MATS[h.design?.material]?.c?`${MATS[h.design.material].c}16`:"rgba(255,255,255,0.05)", color:MATS[h.design?.material]?.c||C.sub, fontWeight:700 }}>{h.design?.material}</span>
                        <span style={{ fontSize:8, padding:"2px 6px", borderRadius:9, background:"rgba(255,255,255,0.04)", color:C.dim }}>{h.design?.printTime}</span>
                        {h.design?.costUSD && <span style={{ fontSize:8, padding:"2px 6px", borderRadius:9, background:"rgba(46,232,154,0.1)", color:C.grn, fontWeight:700 }}>${h.design.costUSD}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
