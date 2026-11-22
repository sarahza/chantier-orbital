# 🤖 LeftControl dans Minecraft

Ce petit programme fait entrer **LeftControl** dans ton monde Minecraft. Il construit tout seul les plans que tu prépares sur la page LeftControl (onglet ⛏️ Minecraft).

```
Page LeftControl  ──►  ce programme (sur ton ordinateur)  ──►  Minecraft
```

## 1. Installer (une seule fois)

1. Installe **Node.js** (version 22 ou plus) depuis https://nodejs.org (bouton « LTS »).
2. Télécharge le dossier `leftcontrol-bot` (ou tout le projet) sur ton ordinateur.
3. Ouvre un terminal **dans ce dossier** et tape :

   ```
   npm install
   ```

## 2a. Minecraft Bedrock (Windows, Minecraft Education) — le plus simple

1. Dans le terminal : `npm run bedrock`
2. Dans Minecraft : **Paramètres → Général**, désactive **« Exiger des WebSockets chiffrés »**.
3. Ouvre ton monde avec les **triches activées**, puis tape dans le chat :

   ```
   /connect localhost:3000
   ```

   Le message « LeftControl est arrivé ! » s'affiche dans le jeu.

Les constructions apparaissent devant **toi** (2 blocs plus loin).

## 2b. Minecraft Java

Le robot entre dans le monde comme un vrai joueur, appelé **LeftControl**.

⚠️ Il n'a pas de compte Minecraft, donc il faut un monde qui accepte les joueurs sans compte :

- **Le plus simple : un serveur** sur ton ordinateur (le serveur officiel gratuit de Minecraft). Dans son fichier `server.properties`, mets `online-mode=false`, démarre-le, puis tape dans la console du serveur : `op LeftControl`.
- **Monde solo ouvert en LAN** : Minecraft le refuse normalement pour les joueurs sans compte. Il faut un mod comme « Custom LAN » pour désactiver le « mode en ligne ».

Ensuite, dans le terminal :

```
npm run java -- --port 25565
```

(remplace `25565` par le port de ton serveur ou celui affiché quand tu ouvres le monde en LAN).

Écris **« viens »** dans le chat du jeu : LeftControl se téléporte à côté de toi. Il construit à l'endroit où il se trouve.

## 3. Construire

1. Sur la page LeftControl, onglet **⛏️ Minecraft**, prépare un plan (avec l'IA ou un plan tout prêt).
2. Clique sur **🔌 Connecter le robot**. Si le navigateur demande l'autorisation d'accéder au réseau local, accepte.
3. Clique sur **🏗️ Construire dans Minecraft**. Tu peux l'arrêter à tout moment avec **⏹**.

## Sécurité

- Le robot n'accepte **que** des commandes de construction (`fill` et `setblock`). Toutes les autres sont refusées.
- Il n'accepte que la page LeftControl officielle (`https://sarahza.github.io`) ou un fichier ouvert depuis ton ordinateur. Pour une autre adresse : `--origine https://mon-adresse`.
- Pour l'arrêter : `Ctrl + C` dans le terminal.
