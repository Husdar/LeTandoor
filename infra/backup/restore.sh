#!/bin/bash
set -euo pipefail

# Restaure une sauvegarde .sql.gz créée par backup.sh. ATTENTION : écrase les données actuelles.
# Usage : ./restore.sh dumps/tandoor_2026-07-23_10-00-00.sql.gz

if [ $# -ne 1 ]; then
  echo "Usage: $0 <fichier_sauvegarde.sql.gz>"
  exit 1
fi

BACKUP_FILE="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Fichier introuvable : $BACKUP_FILE"
  exit 1
fi

read -r -p "ATTENTION : ceci va ECRASER la base de données actuelle avec le contenu de $BACKUP_FILE. Continuer ? (oui/non) " CONFIRM
if [ "$CONFIRM" != "oui" ]; then
  echo "Annulé."
  exit 0
fi

cd "$INFRA_DIR"
gunzip -c "$BACKUP_FILE" | docker compose exec -T postgres psql -U tandoor -d tandoor

echo "Restauration terminée."
