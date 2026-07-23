# Déploiement en production — VPS Hostinger

Ce guide part d'un VPS Hostinger tout neuf (Ubuntu 24.04 LTS) jusqu'à l'application accessible
en HTTPS sur votre nom de domaine.

## 0. Prérequis

- Un VPS Hostinger avec Ubuntu 24.04 LTS (ou 22.04), accès root en SSH (adresse IP + mot de passe,
  ou clé SSH — visibles dans hPanel → VPS → votre serveur → "Vue d'ensemble").
- Un nom de domaine dont vous pouvez modifier les DNS (chez Hostinger ou ailleurs).
- Vos vraies valeurs sous la main : clé API OpenRouter, identifiants IMAP (mot de passe
  d'application iCloud, jamais le mot de passe Apple principal).

## 1. Pointer le domaine vers le VPS

Dans la zone DNS de votre domaine (hPanel → Domaines → DNS / Nameservers, ou chez votre
registrar si le domaine n'est pas chez Hostinger), ajoutez un enregistrement :

```
Type: A
Nom : @ (ou "gestion" si vous préférez un sous-domaine, ex: gestion.votredomaine.fr)
Valeur : <IP de votre VPS>
TTL : par défaut
```

La propagation peut prendre de quelques minutes à quelques heures.

## 2. Se connecter au VPS et préparer le serveur

```bash
ssh root@<IP_DU_VPS>
```

Puis, sur le serveur :

```bash
apt update && apt upgrade -y

# Pare-feu : n'autoriser que SSH, HTTP et HTTPS
apt install -y ufw
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Docker (script officiel)
curl -fsSL https://get.docker.com | sh
```

## 3. Récupérer le code sur le serveur

Si le code est déjà sur un dépôt Git (GitHub/GitLab) :

```bash
cd /opt
git clone <URL_DE_VOTRE_DEPOT> le-tandoor
cd le-tandoor
```

Sinon, depuis votre machine, envoyez le dossier au serveur :

```bash
rsync -avz --exclude node_modules --exclude .git \
  "/Users/skandarmohammad/Desktop/projet IA RESTO/" root@<IP_DU_VPS>:/opt/le-tandoor/
```

## 4. Configurer les secrets

Sur le serveur :

```bash
cd /opt/le-tandoor/infra
cp .env.example .env
nano .env
```

Renseignez au minimum :

| Variable | Valeur |
|---|---|
| `POSTGRES_PASSWORD` | un mot de passe fort et unique |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | générez avec `openssl rand -base64 48` (une fois chacun) |
| `SEED_ADMIN_EMAIL` | l'email du compte admin |
| `SEED_ADMIN_PASSWORD` | un mot de passe fort — vous pourrez le changer depuis l'application après |
| `OPENROUTER_API_KEY` | votre clé API OpenRouter (pour Conseils et l'Assistant IA) |
| `IMAP_USER` / `IMAP_PASSWORD` | votre adresse iCloud et un **mot de passe d'application** (Réglages Apple ID → Sécurité → Mots de passe pour applications) |
| `CORS_ORIGIN` | laissez `*` — sans effet ici car frontend et backend sont servis sur le même domaine |

`ORDER_EMAIL_SENDER` et `ORDER_EMAIL_SUBJECT_PATTERN` ont déjà les bonnes valeurs par défaut.

## 5. Lancer l'application

```bash
cd /opt/le-tandoor/infra
docker compose --env-file .env up -d --build
```

Premier build : quelques minutes. Vérifiez ensuite :

```bash
docker compose ps          # les 3 services doivent être "Up" / "healthy"
docker compose logs -f backend   # Ctrl+C pour quitter — cherchez la ligne
                                  # "[email-orders] écoute IMAP active sur ..." sans erreur
```

À ce stade, l'application répond déjà sur `http://<IP_DU_VPS>:8080` — mais sans HTTPS.

## 6. Mettre en place le HTTPS (nginx + certbot sur l'hôte)

```bash
apt install -y nginx certbot python3-certbot-nginx

cat > /etc/nginx/sites-available/le-tandoor <<'EOF'
server {
    listen 80;
    server_name votredomaine.fr;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

ln -s /etc/nginx/sites-available/le-tandoor /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# Remplacez votredomaine.fr par votre vrai domaine (doit déjà pointer vers ce VPS)
certbot --nginx -d votredomaine.fr
```

Certbot configure automatiquement le certificat et le renouvellement (vérifiez avec
`certbot renew --dry-run`). Votre site est maintenant sur `https://votredomaine.fr`.

## 7. Première connexion

1. Ouvrez `https://votredomaine.fr`.
2. Connectez-vous avec `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` définis à l'étape 4.
3. **Changez immédiatement le mot de passe** : cliquez sur votre nom en haut à droite →
   "Changer mon mot de passe".
4. Allez dans Administration pour créer les comptes du personnel (serveur, cuisine, caisse),
   configurer les imprimantes (assistant guidé), les tables et le menu si besoin d'ajustements.

## 8. Sauvegardes automatiques

Le script `infra/backup/backup.sh` sauvegarde la base de données (compressée, avec purge
automatique après 14 jours). Planifiez-le via cron :

```bash
crontab -e
```

Ajoutez (sauvegarde tous les jours à 3h du matin) :

```
0 3 * * * /opt/le-tandoor/infra/backup/backup.sh >> /var/log/tandoor-backup.log 2>&1
```

Les fichiers sont stockés dans `infra/backup/dumps/`. Pour restaurer une sauvegarde :

```bash
cd /opt/le-tandoor/infra/backup
./restore.sh dumps/tandoor_2026-07-23_03-00-00.sql.gz
```

**Conseil** : copiez aussi périodiquement le dossier `dumps/` hors du VPS (autre machine,
stockage cloud) — une sauvegarde qui reste sur le même serveur ne protège pas contre une panne
du serveur lui-même.

## 9. Mettre à jour l'application plus tard

```bash
cd /opt/le-tandoor
git pull                      # ou renvoyer les fichiers modifiés par rsync
cd infra
docker compose --env-file .env up -d --build
```

Les migrations de base de données et la vérification du compte admin se font automatiquement
au démarrage du conteneur backend.

## Dépannage courant

- **`docker compose ps` montre un service qui redémarre en boucle** :
  `docker compose logs backend` (ou `postgres`/`frontend`) pour voir l'erreur exacte.
- **L'IMAP ne se connecte pas** : vérifiez que `IMAP_PASSWORD` est bien un mot de passe
  d'application iCloud (pas votre mot de passe Apple), et que l'adresse est correcte.
- **Les Conseils / l'Assistant IA renvoient une erreur** : vérifiez `OPENROUTER_API_KEY` dans
  `infra/.env`, puis `docker compose up -d --build backend` pour recharger la variable.
- **Certificat HTTPS non renouvelé** : `certbot renew --dry-run` pour tester,
  `systemctl status certbot.timer` pour vérifier que le renouvellement automatique est actif.
