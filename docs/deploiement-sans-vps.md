# Déploiement gratuit sans serveur à gérer (Supabase + Render + Netlify)

Alternative à un VPS : 3 services gratuits séparés, plus un service de "ping" pour éviter que
le backend ne s'endorme. Aucun serveur à administrer, mais plusieurs tableaux de bord au lieu
d'un seul.

**Important à savoir** : le plan gratuit de Render met le service en veille après 15 minutes
sans requête. On contourne ça avec un ping automatique toutes les 5 minutes (étape 4) — tant que
ce ping tourne, le service (et donc l'écoute des emails de commande) reste actif en continu.

## 1. Base de données — Supabase (gratuit)

1. Créez un compte sur [supabase.com](https://supabase.com), créez un nouveau projet (choisissez
   une région proche, ex: "West EU (Ireland/Paris)"). Notez le mot de passe de base de données
   que vous définissez à la création.
2. Une fois le projet prêt : **Project Settings → Database → Connection string → URI**.
   Copiez cette URL (elle ressemble à
   `postgresql://postgres:[MOT-DE-PASSE]@db.xxxxx.supabase.co:5432/postgres`).
   Remplacez `[MOT-DE-PASSE]` par le vrai mot de passe choisi à l'étape 1.
   → C'est votre `DATABASE_URL`.

## 2. Backend — Render (gratuit)

1. Poussez le code du projet sur un dépôt GitHub (si ce n'est pas déjà fait) — Render déploie
   depuis un dépôt Git.
2. Sur [render.com](https://render.com), créez un compte, puis **New → Web Service**, connectez
   votre dépôt GitHub.
3. Configuration du service :
   - **Environment** : `Docker`
   - **Dockerfile Path** : `apps/backend/Dockerfile`
   - **Docker Build Context Directory** : `.` (racine du dépôt)
   - **Instance Type** : Free
   - **Health Check Path** : `/api/health`
4. **Environment Variables** (onglet "Environment") — ajoutez :

   | Variable | Valeur |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | l'URL Supabase de l'étape 1 |
   | `JWT_SECRET` | générez avec `openssl rand -base64 48` |
   | `JWT_REFRESH_SECRET` | générez avec `openssl rand -base64 48` (différent du précédent) |
   | `CORS_ORIGIN` | l'URL de votre site Netlify (étape 3) — à renseigner après coup |
   | `SEED_ADMIN_EMAIL` | email du compte admin |
   | `SEED_ADMIN_PASSWORD` | mot de passe fort — à changer depuis l'app après |
   | `OPENROUTER_API_KEY` | votre clé API OpenRouter |
   | `OPENROUTER_MODEL` | `anthropic/claude-sonnet-5` |
   | `IMAP_HOST` | `imap.mail.me.com` |
   | `IMAP_PORT` | `993` |
   | `IMAP_USER` | votre adresse iCloud |
   | `IMAP_PASSWORD` | mot de passe d'application iCloud (pas le mot de passe Apple) |
   | `ORDER_EMAIL_SENDER` | `noreply@account.hostinger.com,noreply@store.hostinger.com` |
   | `ORDER_EMAIL_SUBJECT_PATTERN` | `commande` |

5. Déployez. Une fois en ligne, notez l'URL fournie par Render
   (ex: `https://le-tandoor-backend.onrender.com`).

## 3. Frontend — Netlify (gratuit)

1. Sur [netlify.com](https://netlify.com), **Add new site → Import an existing project**,
   connectez le même dépôt GitHub.
2. Configuration du build :
   - **Base directory** : (laisser vide)
   - **Build command** :
     `npm install && npm run build --workspace=packages/shared && npm run build --workspace=apps/frontend`
   - **Publish directory** : `apps/frontend/dist`
3. **Variables d'environnement** (Site settings → Environment variables) :

   | Variable | Valeur |
   |---|---|
   | `VITE_API_URL` | `https://le-tandoor-backend.onrender.com/api` (URL Render de l'étape 2 + `/api`) |
   | `VITE_WS_URL` | `wss://le-tandoor-backend.onrender.com/ws` (même URL en `wss://` + `/ws`) |

4. Déployez. Netlify vous donne une URL (ex: `https://le-tandoor.netlify.app`) — vous pourrez
   brancher votre propre nom de domaine dessus ensuite (Site settings → Domain management).
5. **Retournez sur Render** (étape 2) et mettez à jour la variable `CORS_ORIGIN` avec cette URL
   Netlify exacte (ex: `https://le-tandoor.netlify.app`), puis redéployez le service backend.

## 4. Garder le backend éveillé — UptimeRobot (gratuit)

1. Créez un compte sur [uptimerobot.com](https://uptimerobot.com).
2. **Add New Monitor** :
   - **Monitor Type** : HTTP(s)
   - **URL** : `https://le-tandoor-backend.onrender.com/api/health`
   - **Monitoring Interval** : 5 minutes
3. Sauvegardez. Ce ping régulier empêche Render de mettre le service en veille, donc l'écoute
   des emails de commande reste active en continu.

## 5. Première connexion

1. Ouvrez votre URL Netlify (ou votre domaine personnalisé une fois branché).
2. Connectez-vous avec `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.
3. Changez immédiatement le mot de passe (clic sur votre nom en haut à droite).

## Limites de cette approche à connaître

- **Imprimantes réseau** : le backend étant hébergé chez Render (pas chez vous), il ne peut PAS
  atteindre directement une imprimante sur le réseau Wi-Fi du restaurant (adresse IP privée type
  192.168.x.x, injoignable depuis internet). Un VPS classique a le même problème en réalité —
  dans les deux cas, il faudra un petit relais d'impression local (mentionné dans le plan initial
  du projet) pour transmettre les tickets aux imprimantes du restaurant. Ce point reste à
  construire, quel que soit l'hébergement choisi.
- **Espace disque Supabase gratuit** : 500 Mo, largement suffisant pour un seul restaurant
  pendant longtemps, mais à surveiller si le volume de commandes devient très important.
- **Sauvegardes** : Supabase gratuit ne fait pas de sauvegarde automatique. Le script
  `infra/backup/backup.sh` est prévu pour du Docker Compose local — pour Supabase, utilisez
  plutôt `pg_dump "VOTRE_DATABASE_URL" | gzip > sauvegarde.sql.gz` depuis votre ordinateur,
  à planifier manuellement ou via une tâche programmée.
