// Outils qui rendent LeftControl plus malin, quel que soit son cerveau :
// une calculatrice exacte et un banc d'essai qui lance ses programmes pour trouver les erreurs.

// ---------- Calculatrice sûre (aucun code n'est exécuté) ----------
// Nombres, + - * / % ^, parenthèses, sqrt, abs, round, floor, ceil, min, max, pi.
export function calculer(expr) {
  let src = String(expr).replace(/(\d)\s+(?=\d{3}\b)/g, "$1");
  // Virgule décimale à la française (10,5), sauf si l'expression utilise des fonctions comme max(a, b).
  if (!/[a-z]\s*\(/i.test(src)) src = src.replace(/,/g, ".");
  src = src.replace(/×/g, "*").replace(/(\d)\s*x\s*(?=[\d(])/g, "$1*").replace(/÷/g, "/").replace(/[€$%]\s*$/, "");
  let i = 0;
  const skip = () => { while (/\s/.test(src[i] ?? "")) i++; };
  const fns = { sqrt: Math.sqrt, racine: Math.sqrt, abs: Math.abs, round: Math.round, arrondi: Math.round, floor: Math.floor, ceil: Math.ceil, min: Math.min, max: Math.max };
  const attendre = (c) => { skip(); if (src[i] !== c) throw new Error(`« ${c} » attendu`); i++; };
  function primaire() {
    skip();
    if (src[i] === "(") { i++; const v = somme(); attendre(")"); return v; }
    if (src[i] === "-") { i++; return -facteur(); }
    if (src[i] === "+") { i++; return facteur(); }
    const n = /^\d+(\.\d+)?([eE][+-]?\d+)?/.exec(src.slice(i));
    if (n) { i += n[0].length; return parseFloat(n[0]); }
    const id = /^[a-zA-Z]+/.exec(src.slice(i));
    if (id) {
      i += id[0].length; const nom = id[0].toLowerCase();
      if (nom === "pi") return Math.PI;
      if (!fns[nom]) throw new Error("inconnu : " + nom);
      attendre("("); const args = [somme()];
      for (skip(); src[i] === ","; skip()) { i++; args.push(somme()); }
      attendre(")"); return fns[nom](...args);
    }
    throw new Error("expression invalide");
  }
  function facteur() { const b = primaire(); skip(); if (src[i] === "^") { i++; return b ** facteur(); } return b; }
  function produit() { let v = facteur(); for (;;) { skip(); const o = src[i]; if (o === "*") { i++; v *= facteur(); } else if (o === "/") { i++; v /= facteur(); } else if (o === "%") { i++; v %= facteur(); } else return v; } }
  function somme() { let v = produit(); for (;;) { skip(); const o = src[i]; if (o === "+") { i++; v += produit(); } else if (o === "-") { i++; v -= produit(); } else return v; } }
  const v = somme(); skip();
  if (i < src.length || !Number.isFinite(v)) throw new Error("calcul impossible");
  return v;
}

export function formaterNombre(v) {
  const r = Math.round(v * 100) / 100;
  return r.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

// Remplace chaque {{= expression }} écrit par l'IA par le résultat exact.
export function remplacerCalculs(texte) {
  return texte.replace(/\{\{\s*=\s*([^{}]+?)\s*\}\}/g, (tout, expr) => {
    try { return formaterNombre(calculer(expr)); } catch { return expr.trim(); }
  });
}

// ---------- Programmes ----------
// Renvoie le dernier bloc de code HTML ou JavaScript complet d'une réponse.
export function extraireCode(texte) {
  const blocs = [...texte.matchAll(/```([\w+-]*)\n([\s\S]*?)```/g)]
    .map((m) => ({ lang: (m[1] || "").toLowerCase(), code: m[2] }))
    .filter((b) => ["html", "javascript", "js"].includes(b.lang));
  return blocs.at(-1) || null;
}

export function pageDuProgramme(code, lang, espion = "") {
  if (lang !== "html") return `<!doctype html><html><head><meta charset="utf-8">${espion}</head><body><script>${code.replace(/<\/script/gi, "<\\/script")}<\/script></body></html>`;
  if (/<head[^>]*>/i.test(code)) return code.replace(/<head[^>]*>/i, (h) => h + espion);
  if (/<html[^>]*>/i.test(code)) return code.replace(/<html[^>]*>/i, (h) => h + espion);
  return espion + code;
}

// Petit script glissé dans le programme pendant le test : il renvoie toutes les erreurs à la page.
const ESPION = `<script>(function(){var n=0;function e(m){if(n++<5)parent.postMessage({lcTest:1,erreur:String(m).slice(0,300)},"*")}
window.addEventListener("error",function(ev){if(ev.message)e(ev.message+(ev.lineno?" (ligne "+ev.lineno+")":""));else if(ev.target&&ev.target!==window)e("Ressource introuvable : "+(ev.target.src||ev.target.href||ev.target.tagName))},true);
window.addEventListener("unhandledrejection",function(ev){e("Promesse rejetée : "+(ev.reason&&ev.reason.message||ev.reason))});
var ce=console.error;console.error=function(){e(Array.prototype.join.call(arguments," "));return ce.apply(console,arguments)};
window.addEventListener("load",function(){setTimeout(function(){
  try{var b=document.body;if(b&&!b.innerText.trim()&&!document.querySelector("canvas,svg,img,input,button,video"))e("La page est vide : rien ne s'affiche.")}catch(x){}
  parent.postMessage({lcTest:1,fin:1},"*")},1200)});})();<\/script>`;

// Lance le programme dans un bac à sable invisible et renvoie la liste des erreurs trouvées.
export function testerProgramme(code, lang, delaiMax = 4000) {
  return new Promise((resolve) => {
    const f = document.createElement("iframe");
    f.setAttribute("sandbox", "allow-scripts");
    f.style.cssText = "position:fixed;left:-9999px;top:0;width:800px;height:600px;visibility:hidden";
    const erreurs = [];
    const fin = () => { removeEventListener("message", recevoir); clearTimeout(minuteur); f.remove(); resolve([...new Set(erreurs)]); };
    const recevoir = (ev) => {
      if (ev.source !== f.contentWindow || !ev.data?.lcTest) return;
      if (ev.data.erreur) erreurs.push(ev.data.erreur);
      if (ev.data.fin) fin();
    };
    addEventListener("message", recevoir);
    const minuteur = setTimeout(fin, delaiMax);
    f.srcdoc = pageDuProgramme(code, lang, ESPION);
    document.body.appendChild(f);
  });
}
