# Step 1C — Backup Execution Runbook

Date: 2026-04-13

This runbook executes the backup-first migration policy by creating a reproducible backup package and (optionally) remote datastore exports.

## Script

Use:

```bash
bash scripts/step1c-backup.sh
```

This creates a timestamped folder under `backups/<UTC_TIMESTAMP>/` containing:
- git branch/commit/status snapshot
- complete git bundle (`repo.bundle`)
- key non-secret config files (`.env.example`, `firebase.json`, `.firebaserc`, `package.json`, `README.md`)
- checksum manifest (`SHA256SUMS.txt`)

## Optional remote exports

When credentials are available, run:

```bash
FIREBASE_PROJECT_ID=<id> \
FIREBASE_STORAGE_BUCKET=gs://<bucket> \
SUPABASE_DB_URL=postgresql://... \
BACKUP_GCS_BUCKET=gs://<backup-bucket> \
bash scripts/step1c-backup.sh --execute-remote
```

### Notes
- Firestore export requires `gcloud`.
- Storage listing/upload requires `gsutil`.
- Supabase SQL export requires `pg_dump`.
- If any dependency is missing, the script skips that export and keeps local artifacts.
