// Le bâtisseur de LeftControl : transforme un plan de construction (JSON)
// en blocs, puis en commandes Minecraft (/fill et /setblock).

export const BLOCS = {
  stone: "#8a8a8a", cobblestone: "#7a7a7a", stone_bricks: "#7b7b7b", bricks: "#9a4a3a",
  oak_planks: "#b08850", spruce_planks: "#7a5a34", birch_planks: "#d6c58a", oak_log: "#6b5232",
  glass: "#cfeaf5", white_wool: "#eeeeee", red_wool: "#b02e26", blue_wool: "#3c44aa",
  yellow_wool: "#f9d23c", green_wool: "#5e7c16", black_wool: "#1d1d21", orange_wool: "#f9801d",
  pink_wool: "#f38baa", purple_wool: "#8932b8", white_concrete: "#cfd5d6", red_concrete: "#8e2121",
  blue_concrete: "#2c2e8f", sandstone: "#d8cb9b", sand: "#dbcfa3", quartz_block: "#ebe5de",
  gold_block: "#f5d54a", diamond_block: "#62e3d9", iron_block: "#dcdcdc", emerald_block: "#2ad665",
  obsidian: "#1a1028", glowstone: "#f9d58c", sea_lantern: "#c5dcd4", grass_block: "#6aa84f",
  dirt: "#866043", oak_leaves: "#4a7a2a", bookshelf: "#8a6a3a", water: "#3f76e4", lava: "#e8641a",
  snow_block: "#f5fafa", ice: "#a5c3f5", air: null,
};

// Noms différents dans Minecraft Bedrock.
const NOMS_BEDROCK = { bricks: "brick_block" };

export const FORMES = ["boite", "cylindre", "sphere", "pyramide", "toit"];
export const LIMITE = 64; // taille maximale d'une construction (dans chaque direction)

// Schéma JSON utilisé pour forcer l'IA à répondre avec un plan valide.
export const SCHEMA_PLAN = {
  type: "object",
  properties: {
    nom: { type: "string" },
    pieces: {
      type: "array",
      items: {
        type: "object",
        properties: {
          forme: { type: "string", enum: FORMES },
          bloc: { type: "string", enum: Object.keys(BLOCS) },
          x: { type: "integer" }, y: { type: "integer" }, z: { type: "integer" },
          largeur: { type: "integer" }, hauteur: { type: "integer" }, profondeur: { type: "integer" },
          creux: { type: "boolean" },
        },
        required: ["forme", "bloc", "x", "y", "z", "largeur", "hauteur", "profondeur", "creux"],
      },
    },
  },
  required: ["nom", "pieces"],
};

const entier = (v, d = 0) => (Number.isFinite(+v) ? Math.round(+v) : d);
const borne = (v, a, b) => Math.max(a, Math.min(b, v));

// Vérifie et corrige un plan (l'IA peut se tromper). Renvoie { plan, avertissements }.
export function nettoyerPlan(brut) {
  const avert = [];
  if (!brut || typeof brut !== "object" || !Array.isArray(brut.pieces)) throw new Error("Le plan n'a pas de liste « pieces ».");
  const pieces = [];
  for (const [i, p] of brut.pieces.entries()) {
    if (!p || typeof p !== "object") continue;
    const forme = FORMES.includes(p.forme) ? p.forme : "boite";
    let bloc = String(p.bloc || "").replace(/^minecraft:/, "");
    if (!(bloc in BLOCS)) { avert.push(`Pièce ${i + 1} : bloc « ${bloc} » inconnu, remplacé par de la pierre.`); bloc = "stone"; }
    pieces.push({
      forme, bloc,
      x: borne(entier(p.x), -LIMITE, LIMITE), y: borne(entier(p.y), -LIMITE, LIMITE), z: borne(entier(p.z), -LIMITE, LIMITE),
      largeur: borne(entier(p.largeur, 1), 1, LIMITE), hauteur: borne(entier(p.hauteur, 1), 1, LIMITE),
      profondeur: borne(entier(p.profondeur, 1), 1, LIMITE), creux: !!p.creux,
    });
  }
  if (!pieces.length) throw new Error("Le plan ne contient aucune pièce.");
  return { plan: { nom: String(brut.nom || "Construction").slice(0, 60), pieces }, avertissements: avert };
}

// Transforme le plan en une carte de blocs : Map "x,y,z" -> nom du bloc (y compris "air").
export function voxeliser(plan) {
  const carte = new Map();
  const poser = (x, y, z, b) => carte.set(`${x},${y},${z}`, b);
  for (const p of plan.pieces) {
    const { x, y, z, largeur: L, hauteur: H, profondeur: P, bloc, creux } = p;
    if (p.forme === "boite") {
      for (let i = 0; i < L; i++) for (let j = 0; j < H; j++) for (let k = 0; k < P; k++) {
        const bord = i === 0 || j === 0 || k === 0 || i === L - 1 || j === H - 1 || k === P - 1;
        poser(x + i, y + j, z + k, !creux || bord ? bloc : "air");
      }
    } else if (p.forme === "cylindre") {
      const r = L / 2, c = (L - 1) / 2;
      for (let i = 0; i < L; i++) for (let k = 0; k < L; k++) {
        const d = Math.hypot(i - c, k - c);
        if (d > r - 0.25) continue;
        const bord = d > r - 1.25;
        for (let j = 0; j < H; j++) poser(x + i, y + j, z + k, !creux || bord ? bloc : "air");
      }
    } else if (p.forme === "sphere") {
      const r = L / 2, c = (L - 1) / 2;
      for (let i = 0; i < L; i++) for (let j = 0; j < L; j++) for (let k = 0; k < L; k++) {
        const d = Math.hypot(i - c, j - c, k - c);
        if (d > r - 0.25) continue;
        poser(x + i, y + j, z + k, !creux || d > r - 1.6 ? bloc : "air");
      }
    } else if (p.forme === "pyramide") {
      for (let j = 0; j < H; j++) {
        const x1 = j, x2 = L - 1 - j, z1 = j, z2 = P - 1 - j;
        if (x1 > x2 || z1 > z2) break;
        for (let i = x1; i <= x2; i++) for (let k = z1; k <= z2; k++) {
          const bord = i === x1 || i === x2 || k === z1 || k === z2;
          poser(x + i, y + j, z + k, !creux || bord ? bloc : "air");
        }
      }
    } else if (p.forme === "toit") {
      // Toit à deux pentes : le faîte est parallèle à l'axe X.
      for (let j = 0; j < H; j++) {
        const z1 = j, z2 = P - 1 - j;
        if (z1 > z2) break;
        for (let i = 0; i < L; i++) for (let k = z1; k <= z2; k++) {
          const bord = k === z1 || k === z2 || i === 0 || i === L - 1;
          poser(x + i, y + j, z + k, !creux || bord ? bloc : "air");
        }
      }
    }
  }
  return carte;
}

// Regroupe les blocs identiques en grands rectangles pour faire peu de commandes.
export function regrouper(carte) {
  const parCouche = new Map();
  for (const [cle, b] of carte) {
    const [x, y, z] = cle.split(",").map(Number);
    if (!parCouche.has(y)) parCouche.set(y, new Map());
    parCouche.get(y).set(`${x},${z}`, b);
  }
  const ys = [...parCouche.keys()].sort((a, b) => a - b);
  const ouverts = new Map(); // signature -> boîte en cours sur les couches précédentes
  const boites = [];
  let yPrec = null;
  for (const y of ys) {
    const couche = parCouche.get(y);
    // 1) bandes le long de X
    const lignes = new Map(); // z -> [{x1,x2,b}]
    const pts = [...couche.keys()].map((k) => k.split(",").map(Number)).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    for (const [x, z] of pts) {
      const b = couche.get(`${x},${z}`);
      if (!lignes.has(z)) lignes.set(z, []);
      const l = lignes.get(z), der = l[l.length - 1];
      if (der && der.b === b && der.x2 === x - 1) der.x2 = x; else l.push({ x1: x, x2: x, b });
    }
    // 2) fusion des bandes identiques sur Z consécutifs
    const rects = [], enCours = new Map();
    for (const z of [...lignes.keys()].sort((a, b) => a - b)) {
      const vus = new Set();
      for (const s of lignes.get(z)) {
        const sig = `${s.x1},${s.x2},${s.b}`; vus.add(sig);
        const r = enCours.get(sig);
        if (r && r.z2 === z - 1) r.z2 = z; else { const n = { ...s, z1: z, z2: z }; enCours.set(sig, n); rects.push(n); }
      }
    }
    // 3) fusion des rectangles identiques sur Y consécutifs
    const nouveaux = new Map();
    for (const r of rects) {
      const sig = `${r.x1},${r.x2},${r.z1},${r.z2},${r.b}`;
      const o = ouverts.get(sig);
      if (o && yPrec === y - 1 && o.y2 === y - 1) { o.y2 = y; nouveaux.set(sig, o); }
      else { const n = { ...r, y1: y, y2: y }; boites.push(n); nouveaux.set(sig, n); }
    }
    ouverts.clear(); for (const [k, v] of nouveaux) ouverts.set(k, v);
    yPrec = y;
  }
  return boites;
}

// Produit les commandes (sans « / »). Les positions sont relatives au joueur (~),
// décalées de 2 blocs pour ne pas construire sur lui.
export function commandes(carte, edition = "java") {
  const nom = (b) => (edition === "bedrock" && NOMS_BEDROCK[b]) || b;
  const rel = (v) => (v === 0 ? "~" : `~${v}`);
  const out = [];
  // Les blocs d'air d'abord (pour vider), puis le reste.
  const boites = regrouper(carte).sort((a, b) => (a.b === "air" ? 0 : 1) - (b.b === "air" ? 0 : 1) || a.y1 - b.y1);
  for (const bx of boites) {
    const dx = 2, dz = 2;
    // Une commande fill ne peut pas dépasser 32768 blocs : on découpe en tranches si besoin.
    const surface = (bx.x2 - bx.x1 + 1) * (bx.z2 - bx.z1 + 1);
    const tranche = Math.max(1, Math.floor(32768 / surface));
    for (let y1 = bx.y1; y1 <= bx.y2; y1 += tranche) {
      const y2 = Math.min(bx.y2, y1 + tranche - 1);
      if (bx.x1 === bx.x2 && y1 === y2 && bx.z1 === bx.z2) out.push(`setblock ${rel(bx.x1 + dx)} ${rel(y1)} ${rel(bx.z1 + dz)} ${nom(bx.b)}`);
      else out.push(`fill ${rel(bx.x1 + dx)} ${rel(y1)} ${rel(bx.z1 + dz)} ${rel(bx.x2 + dx)} ${rel(y2)} ${rel(bx.z2 + dz)} ${nom(bx.b)}`);
    }
  }
  return out;
}

// ---------- Aperçu en 3D (vue isométrique) ----------
function teinte(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(Math.min(255, v * f)));
  return `rgb(${c.join(",")})`;
}

export function dessiner(canvas, carte) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const pleins = [...carte].filter(([, b]) => b !== "air").map(([k, b]) => [...k.split(",").map(Number), b]);
  if (!pleins.length) return;
  const iso = (x, y, z) => [(x - z), (x + z) / 2 - y];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y, z] of pleins) for (const [a, b, c] of [[x, y, z], [x + 1, y + 1, z + 1], [x + 1, y, z], [x, y, z + 1], [x, y + 1, z]]) {
    const [u, v] = iso(a, b, c); minX = Math.min(minX, u); maxX = Math.max(maxX, u); minY = Math.min(minY, v); maxY = Math.max(maxY, v);
  }
  const s = Math.min((W - 20) / (maxX - minX || 1), (H - 20) / (maxY - minY || 1), 24);
  const ox = (W - (maxX - minX) * s) / 2 - minX * s, oy = (H - (maxY - minY) * s) / 2 - minY * s;
  const P = (x, y, z) => { const [u, v] = iso(x, y, z); return [ox + u * s, oy + v * s]; };
  const face = (pts, col) => { ctx.beginPath(); pts.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); if (s > 5) { ctx.strokeStyle = "rgba(0,0,0,.18)"; ctx.lineWidth = 1; ctx.stroke(); } };
  pleins.sort((a, b) => (a[0] + a[2]) - (b[0] + b[2]) || a[1] - b[1]);
  for (const [x, y, z, b] of pleins) {
    const c = BLOCS[b] || "#888888";
    face([P(x, y + 1, z), P(x + 1, y + 1, z), P(x + 1, y + 1, z + 1), P(x, y + 1, z + 1)], teinte(c, 1.1));
    face([P(x, y, z + 1), P(x + 1, y, z + 1), P(x + 1, y + 1, z + 1), P(x, y + 1, z + 1)], teinte(c, 0.85));
    face([P(x + 1, y, z), P(x + 1, y, z + 1), P(x + 1, y + 1, z + 1), P(x + 1, y + 1, z)], teinte(c, 0.65));
  }
}

// ---------- Pack de données Java (fichier .zip sans compression) ----------
const TABLE_CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (u8) => { let c = 0xffffffff; for (const b of u8) c = TABLE_CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

export function zip(fichiers) {
  const enc = new TextEncoder(), parts = [], central = [];
  let offset = 0;
  for (const [nom, contenu] of Object.entries(fichiers)) {
    const n = enc.encode(nom), d = enc.encode(contenu), crc = crc32(d);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true);
    h.setUint16(12, 0x21, true); h.setUint32(14, crc, true); h.setUint32(18, d.length, true); h.setUint32(22, d.length, true); h.setUint16(26, n.length, true);
    parts.push(new Uint8Array(h.buffer), n, d);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint16(14, 0x21, true); c.setUint32(16, crc, true); c.setUint32(20, d.length, true); c.setUint32(24, d.length, true); c.setUint16(28, n.length, true);
    c.setUint32(42, offset, true);
    central.push(new Uint8Array(c.buffer), n);
    offset += 30 + n.length + d.length;
  }
  const taille = central.reduce((a, b) => a + b.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, Object.keys(fichiers).length, true); e.setUint16(10, Object.keys(fichiers).length, true);
  e.setUint32(12, taille, true); e.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: "application/zip" });
}

export function packDeDonnees(cmds) {
  const fonction = cmds.join("\n") + "\n";
  return zip({
    "pack.mcmeta": JSON.stringify({ pack: { pack_format: 48, supported_formats: [15, 99], description: "Constructions de LeftControl" } }, null, 2),
    // « function » pour Minecraft 1.21 et plus, « functions » pour les versions plus anciennes.
    "data/leftcontrol/function/construire.mcfunction": fonction,
    "data/leftcontrol/functions/construire.mcfunction": fonction,
  });
}

// ---------- Plans tout prêts ----------
export const PLANS = {
  maison: { nom: "Petite maison", pieces: [
    { forme: "boite", bloc: "cobblestone", x: 0, y: -1, z: 0, largeur: 9, hauteur: 1, profondeur: 7, creux: false },
    { forme: "boite", bloc: "oak_planks", x: 0, y: 0, z: 0, largeur: 9, hauteur: 4, profondeur: 7, creux: true },
    { forme: "boite", bloc: "oak_log", x: 0, y: 0, z: 0, largeur: 1, hauteur: 4, profondeur: 1, creux: false },
    { forme: "boite", bloc: "oak_log", x: 8, y: 0, z: 0, largeur: 1, hauteur: 4, profondeur: 1, creux: false },
    { forme: "boite", bloc: "oak_log", x: 0, y: 0, z: 6, largeur: 1, hauteur: 4, profondeur: 1, creux: false },
    { forme: "boite", bloc: "oak_log", x: 8, y: 0, z: 6, largeur: 1, hauteur: 4, profondeur: 1, creux: false },
    { forme: "boite", bloc: "air", x: 4, y: 0, z: 0, largeur: 1, hauteur: 2, profondeur: 1, creux: false },
    { forme: "boite", bloc: "glass", x: 2, y: 1, z: 0, largeur: 1, hauteur: 1, profondeur: 1, creux: false },
    { forme: "boite", bloc: "glass", x: 6, y: 1, z: 0, largeur: 1, hauteur: 1, profondeur: 1, creux: false },
    { forme: "boite", bloc: "glass", x: 0, y: 1, z: 3, largeur: 1, hauteur: 1, profondeur: 1, creux: false },
    { forme: "boite", bloc: "glass", x: 8, y: 1, z: 3, largeur: 1, hauteur: 1, profondeur: 1, creux: false },
    { forme: "toit", bloc: "bricks", x: -1, y: 4, z: -1, largeur: 11, hauteur: 5, profondeur: 9, creux: true },
  ] },
  tour: { nom: "Tour de magicien", pieces: [
    { forme: "cylindre", bloc: "stone_bricks", x: 0, y: 0, z: 0, largeur: 7, hauteur: 14, profondeur: 7, creux: true },
    { forme: "boite", bloc: "air", x: 3, y: 0, z: 0, largeur: 1, hauteur: 2, profondeur: 1, creux: false },
    { forme: "cylindre", bloc: "stone_bricks", x: -1, y: 14, z: -1, largeur: 9, hauteur: 1, profondeur: 9, creux: false },
    { forme: "pyramide", bloc: "purple_wool", x: -1, y: 15, z: -1, largeur: 9, hauteur: 5, profondeur: 9, creux: true },
    { forme: "boite", bloc: "glowstone", x: 3, y: 20, z: 3, largeur: 1, hauteur: 1, profondeur: 1, creux: false },
  ] },
  chateau: { nom: "Château fort", pieces: [
    { forme: "boite", bloc: "stone_bricks", x: 0, y: 0, z: 0, largeur: 21, hauteur: 6, profondeur: 21, creux: true },
    { forme: "boite", bloc: "air", x: 1, y: 5, z: 1, largeur: 19, hauteur: 1, profondeur: 19, creux: false },
    { forme: "boite", bloc: "air", x: 9, y: 0, z: 0, largeur: 3, hauteur: 4, profondeur: 1, creux: false },
    { forme: "cylindre", bloc: "cobblestone", x: -2, y: 0, z: -2, largeur: 5, hauteur: 9, profondeur: 5, creux: true },
    { forme: "cylindre", bloc: "cobblestone", x: 18, y: 0, z: -2, largeur: 5, hauteur: 9, profondeur: 5, creux: true },
    { forme: "cylindre", bloc: "cobblestone", x: -2, y: 0, z: 18, largeur: 5, hauteur: 9, profondeur: 5, creux: true },
    { forme: "cylindre", bloc: "cobblestone", x: 18, y: 0, z: 18, largeur: 5, hauteur: 9, profondeur: 5, creux: true },
    { forme: "boite", bloc: "red_wool", x: 0, y: 9, z: 0, largeur: 1, hauteur: 2, profondeur: 1, creux: false },
    { forme: "boite", bloc: "red_wool", x: 20, y: 9, z: 0, largeur: 1, hauteur: 2, profondeur: 1, creux: false },
    { forme: "boite", bloc: "red_wool", x: 0, y: 9, z: 20, largeur: 1, hauteur: 2, profondeur: 1, creux: false },
    { forme: "boite", bloc: "red_wool", x: 20, y: 9, z: 20, largeur: 1, hauteur: 2, profondeur: 1, creux: false },
  ] },
  pyramide: { nom: "Pyramide du désert", pieces: [
    { forme: "pyramide", bloc: "sandstone", x: 0, y: 0, z: 0, largeur: 21, hauteur: 11, profondeur: 21, creux: true },
    { forme: "boite", bloc: "air", x: 10, y: 0, z: 0, largeur: 1, hauteur: 2, profondeur: 2, creux: false },
    { forme: "boite", bloc: "gold_block", x: 10, y: 10, z: 10, largeur: 1, hauteur: 1, profondeur: 1, creux: false },
  ] },
};
