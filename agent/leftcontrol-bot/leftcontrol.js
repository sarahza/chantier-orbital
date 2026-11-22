#!/usr/bin/env node
// LeftControl dans Minecraft !
// Ce programme fait le lien entre la page LeftControl (dans ton navigateur) et ton jeu Minecraft.
//
//   Bedrock : node leftcontrol.js bedrock          puis, dans le jeu : /connect localhost:3000
//   Java    : node leftcontrol.js java --port 25565 [--hote localhost] [--version 1.21.4]
//
// Ensuite, sur la page LeftControl, onglet Minecraft : « Connecter le robot ».

import { WebSocketServer } from "ws";
import { randomUUID } from "node:crypto";

// ---------- Options ----------
const args = process.argv.slice(2);
const edition = args[0];
const opt = (nom, def) => { const i = args.indexOf("--" + nom); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
if (!["java", "bedrock"].includes(edition)) {
  console.log(`Utilisation :
  node leftcontrol.js bedrock                 (Minecraft Bedrock : Windows, Education)
  node leftcontrol.js java --port 25565       (Minecraft Java : serveur ou monde ouvert en LAN)
Options : --hote <adresse> (Java, défaut localhost)  --version <1.21.4> (Java)  --nom <LeftControl> (Java)`);
  process.exit(1);
}
const PORT_PAGE = 3007;      // la page LeftControl se connecte ici
const PORT_BEDROCK = 3000;   // Minecraft Bedrock se connecte ici avec /connect
const ORIGINES = new Set(["https://sarahza.github.io", "null", "http://localhost:8000", "http://127.0.0.1:8000", ...opt("origine", "").split(",").filter(Boolean)]);

// Seules les commandes de construction sont autorisées (sécurité).
const COMMANDE_OK = /^(fill|setblock) (~-?\d*\s){3}((~-?\d*\s){3})?[a-z_]+$/;
const PAUSE_MS = edition === "java" ? 120 : 0;

const dire = (...m) => console.log("🤖", ...m);

const pages = new Set(); // pages LeftControl connectées

// ---------- Connexion au jeu ----------
let jeu = { connecte: false, texte: "", executer: async () => { throw new Error("Minecraft n'est pas connecté."); } };

function changerEtat(connecte, texte) {
  jeu.connecte = connecte; jeu.texte = texte;
  dire(texte);
  diffuser({ type: "etat", connecte, edition, texte });
}

if (edition === "bedrock") {
  // Minecraft Bedrock se connecte lui-même à ce serveur grâce à la commande /connect.
  const wss = new WebSocketServer({ port: PORT_BEDROCK });
  const enAttente = new Map();
  wss.on("connection", (ws) => {
    changerEtat(true, "✅ Minecraft Bedrock est connecté ! LeftControl est prêt à construire.");
    jeu.executer = (cmd) => new Promise((resolve) => {
      const requestId = randomUUID();
      const minuteur = setTimeout(() => { enAttente.delete(requestId); resolve({ ok: false, message: "pas de réponse" }); }, 5000);
      enAttente.set(requestId, (body) => { clearTimeout(minuteur); resolve({ ok: (body?.statusCode ?? 0) >= 0, message: body?.statusMessage }); });
      ws.send(JSON.stringify({
        header: { version: 1, requestId, messagePurpose: "commandRequest", messageType: "commandRequest" },
        body: { version: 1, commandLine: cmd, origin: { type: "player" } },
      }));
    });
    ws.on("message", (data) => {
      let m; try { m = JSON.parse(data); } catch { return; }
      const cb = enAttente.get(m?.header?.requestId);
      if (cb) { enAttente.delete(m.header.requestId); cb(m.body); }
    });
    ws.on("close", () => changerEtat(false, "Minecraft Bedrock s'est déconnecté. Retape /connect localhost:3000 dans le jeu."));
    jeu.executer("say §dLeftControl est arrivé ! Va sur la page LeftControl pour lui donner une construction.");
  });
  changerEtat(false, `En attente de Minecraft Bedrock… Dans le jeu, tape : /connect localhost:${PORT_BEDROCK}`);
} else {
  const { createBot } = await import("mineflayer");
  const hote = opt("hote", "localhost"), port = Number(opt("port", "25565")), nom = opt("nom", "LeftControl");
  const demarrer = () => {
    changerEtat(false, `Connexion à Minecraft Java (${hote}:${port})…`);
    const robot = createBot({ host: hote, port, username: nom, auth: "offline", version: opt("version", false) });
    robot.once("spawn", () => {
      changerEtat(true, `✅ ${nom} est entré dans le monde Minecraft ! Il construit là où il se trouve. Écris « viens » dans le chat pour qu'il te rejoigne.`);
      robot.chat("Bonjour ! Je suis LeftControl. Écris « viens » et je te rejoins.");
      jeu.executer = async (cmd) => { robot.chat("/" + cmd); return { ok: true }; };
    });
    robot.on("chat", (joueur, message) => {
      if (joueur === robot.username) return;
      if (/^viens\b/i.test(message.trim())) robot.chat(`/tp ${robot.username} ${joueur}`);
    });
    robot.on("kicked", (raison) => dire("Expulsé du serveur :", typeof raison === "string" ? raison : JSON.stringify(raison)));
    robot.on("error", (e) => dire(e.code === "ECONNREFUSED" ? `Aucun Minecraft trouvé sur ${hote}:${port}. Vérifie le numéro de port.` : "Erreur : " + e.message));
    robot.on("end", () => {
      changerEtat(false, "Déconnecté de Minecraft Java. Nouvelle tentative dans 10 secondes…");
      jeu.executer = async () => { throw new Error("Minecraft n'est pas connecté."); };
      setTimeout(demarrer, 10000);
    });
  };
  demarrer();
}

// ---------- Connexion avec la page LeftControl ----------
function diffuser(msg) { const s = JSON.stringify(msg); for (const p of pages) if (p.readyState === 1) p.send(s); }

let travail = null; // construction en cours

const serveurPage = new WebSocketServer({
  port: PORT_PAGE,
  verifyClient: ({ origin }) => {
    const ok = ORIGINES.has(origin ?? "null");
    if (!ok) dire(`Connexion refusée depuis ${origin} (ajoute --origine ${origin} si c'est bien ta page).`);
    return ok;
  },
});

serveurPage.on("connection", (page) => {
  pages.add(page);
  dire("La page LeftControl est connectée.");
  page.send(JSON.stringify({ type: "etat", connecte: jeu.connecte, edition, texte: jeu.texte }));
  page.on("close", () => pages.delete(page));
  page.on("message", async (data) => {
    let m; try { m = JSON.parse(data); } catch { return; }
    if (m.type === "arreter") { if (travail) travail.stop = true; return; }
    if (m.type !== "construire" || !Array.isArray(m.commandes)) return;
    if (travail) return page.send(JSON.stringify({ type: "erreur", texte: "Une construction est déjà en cours." }));
    if (!jeu.connecte) return page.send(JSON.stringify({ type: "erreur", texte: "Minecraft n'est pas encore connecté au robot." }));
    const cmds = m.commandes.map(String).filter((c) => COMMANDE_OK.test(c));
    if (cmds.length !== m.commandes.length) dire(`${m.commandes.length - cmds.length} commande(s) refusée(s) car non autorisée(s).`);
    if (cmds.length > 5000) return page.send(JSON.stringify({ type: "erreur", texte: "Construction trop grande (plus de 5000 commandes)." }));

    travail = { stop: false };
    dire(`Construction de « ${m.nom} » : ${cmds.length} commandes.`);
    let erreurs = 0;
    try {
      for (let i = 0; i < cmds.length; i++) {
        if (travail.stop) { diffuser({ type: "fini", texte: `⏹ Construction arrêtée (${i} / ${cmds.length}).` }); return; }
        const r = await jeu.executer(cmds[i]);
        if (r && r.ok === false) { erreurs++; if (erreurs <= 3) dire("Commande refusée par le jeu :", cmds[i], "→", r.message); }
        if (i % 5 === 0 || i === cmds.length - 1) diffuser({ type: "progres", fait: i + 1, total: cmds.length });
        if (PAUSE_MS) await new Promise((r) => setTimeout(r, PAUSE_MS));
      }
      diffuser({ type: "fini", texte: erreurs ? `Terminé, mais ${erreurs} commande(s) ont échoué (les triches sont-elles activées ?).` : `✅ « ${m.nom} » est construit !` });
    } catch (e) {
      diffuser({ type: "erreur", texte: e.message });
    } finally { travail = null; }
  });
});

dire(`Page LeftControl : en attente sur ws://localhost:${PORT_PAGE}`);
