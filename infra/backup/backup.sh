#!/bin/bash
set -euo pipefail

# Sauvegarde de la base PostgreSQL du Tandoor via pg_dump, exécuté à l'intérieur du conteneur
# postgres (aucune dépendance côté hôte à part Docker). Pense à planifier ce script via cron
# (voir docs/deploiement-vps.md).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKUP_DIR:-$SCRIPT_DIR/dumps}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date +%Y-%m-%d_%H-%M-%S)"
FILENAME="tandoor_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

cd "$INFRA_DIR"
docker compose exec -T postgres pg_dump -U tandoor tandoor | gzip > "$BACKUP_DIR/$FILENAME"

echo "Sauvegarde créée : $BACKUP_DIR/$FILENAME ($(du -h "$BACKUP_DIR/$FILENAME" | cut -f1))"

# Purge des sauvegardes plus anciennes que RETENTION_DAYS jours.
find "$BACKUP_DIR" -name "tandoor_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete
