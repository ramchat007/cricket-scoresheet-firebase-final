#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="${ROOT_DIR}/backups/${TS}"
EXECUTE_REMOTE=0

usage() {
  cat <<USAGE
Usage: $(basename "$0") [--execute-remote]

Creates a Step-1C backup package for CricSyncLive:
  - git metadata snapshot + git bundle
  - key config files copy
  - manifest with checksums
  - optional remote exports (Firebase/Supabase) when --execute-remote is set

Environment variables for remote exports:
  FIREBASE_PROJECT_ID    Required for Firestore export
  FIREBASE_STORAGE_BUCKET Optional gs:// bucket to snapshot object listing
  BACKUP_GCS_BUCKET      Optional gs:// target bucket to mirror backup artifacts

  SUPABASE_DB_URL        Optional PostgreSQL connection URL for pg_dump
USAGE
}

log() { printf '[step1c] %s\n' "$*"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --execute-remote) EXECUTE_REMOTE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1"; usage; exit 1 ;;
  esac
done

mkdir -p "$OUT_DIR"

log "Backup folder: $OUT_DIR"

# 1) Git baseline snapshot
log "Collecting git baseline"
git -C "$ROOT_DIR" rev-parse --abbrev-ref HEAD > "$OUT_DIR/git_branch.txt"
git -C "$ROOT_DIR" rev-parse HEAD > "$OUT_DIR/git_commit.txt"
git -C "$ROOT_DIR" tag --points-at HEAD > "$OUT_DIR/git_tags_at_head.txt" || true
git -C "$ROOT_DIR" status --short > "$OUT_DIR/git_status_short.txt"
git -C "$ROOT_DIR" bundle create "$OUT_DIR/repo.bundle" --all

# 2) Copy critical configs (non-secret)
log "Copying key config files"
for f in .env.example firebase.json .firebaserc package.json README.md; do
  if [[ -f "$ROOT_DIR/$f" ]]; then
    cp "$ROOT_DIR/$f" "$OUT_DIR/$(echo "$f" | tr '/' '_')"
  fi
done

# 3) Optional remote exports
if [[ "$EXECUTE_REMOTE" -eq 1 ]]; then
  log "Remote export mode enabled"

  if [[ -n "${FIREBASE_PROJECT_ID:-}" ]]; then
    if command -v gcloud >/dev/null 2>&1; then
      FIRESTORE_URI="gs://${FIREBASE_PROJECT_ID}-step1c-backups/firestore-${TS}"
      log "Exporting Firestore to $FIRESTORE_URI"
      gcloud firestore export "$FIRESTORE_URI" --project "$FIREBASE_PROJECT_ID" > "$OUT_DIR/firestore_export.log" 2>&1 || true
    else
      log "gcloud not installed; skipping Firestore export"
    fi
  else
    log "FIREBASE_PROJECT_ID not set; skipping Firestore export"
  fi

  if [[ -n "${FIREBASE_STORAGE_BUCKET:-}" ]]; then
    if command -v gsutil >/dev/null 2>&1; then
      log "Capturing object listing from $FIREBASE_STORAGE_BUCKET"
      gsutil ls -r "$FIREBASE_STORAGE_BUCKET/**" > "$OUT_DIR/firebase_storage_listing.txt" 2>&1 || true
    else
      log "gsutil not installed; skipping storage listing"
    fi
  else
    log "FIREBASE_STORAGE_BUCKET not set; skipping storage listing"
  fi

  if [[ -n "${SUPABASE_DB_URL:-}" ]]; then
    if command -v pg_dump >/dev/null 2>&1; then
      log "Dumping Supabase schema"
      pg_dump "$SUPABASE_DB_URL" --schema-only > "$OUT_DIR/supabase_schema.sql" 2> "$OUT_DIR/supabase_schema.log" || true
      log "Dumping Supabase data"
      pg_dump "$SUPABASE_DB_URL" --data-only > "$OUT_DIR/supabase_data.sql" 2> "$OUT_DIR/supabase_data.log" || true
    else
      log "pg_dump not installed; skipping Supabase export"
    fi
  else
    log "SUPABASE_DB_URL not set; skipping Supabase export"
  fi

  if [[ -n "${BACKUP_GCS_BUCKET:-}" ]] && command -v gsutil >/dev/null 2>&1; then
    log "Uploading backup folder to $BACKUP_GCS_BUCKET/$TS"
    gsutil -m cp -r "$OUT_DIR" "$BACKUP_GCS_BUCKET/$TS" > "$OUT_DIR/upload.log" 2>&1 || true
  fi
else
  log "Remote export mode disabled. Re-run with --execute-remote when credentials are ready."
fi

# 4) Manifest + checksums
log "Generating manifest"
{
  echo "timestamp_utc=$TS"
  echo "remote_exports_executed=$EXECUTE_REMOTE"
  echo "branch=$(cat "$OUT_DIR/git_branch.txt")"
  echo "commit=$(cat "$OUT_DIR/git_commit.txt")"
} > "$OUT_DIR/manifest.txt"

(
  cd "$OUT_DIR"
  sha256sum * > SHA256SUMS.txt || true
)

log "Done. Backup artifact folder: $OUT_DIR"
