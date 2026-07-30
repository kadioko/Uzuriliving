#!/usr/bin/env node
/**
 * Uzuri Living â€” PostgreSQL backup script
 *
 * Creates a gzipped pg_dump and (optionally) uploads it to S3-compatible
 * object storage (Cloudflare R2 / AWS S3) so a copy survives even a full
 * Supabase volume wipe.
 *
 * Usage:
 *   node scripts/backup.js
 *
 * Required env vars:
 *   DATABASE_URL â€” PostgreSQL connection URL (or DATABASE_MIGRATE_URL public proxy)
 *
 * Local backup (always runs):
 *   BACKUP_DIR          â€” Directory to write backups to (default: ./backups)
 *   BACKUP_RETAIN_DAYS  â€” Days to keep backups (default: 7)
 *
 * Off-site backup (runs only if BACKUP_S3_BUCKET is set):
 *   BACKUP_S3_BUCKET            â€” bucket name
 *   BACKUP_S3_ENDPOINT          â€” S3 endpoint. For R2:
 *                                 https://<account_id>.r2.cloudflarestorage.com
 *   BACKUP_S3_REGION            â€” region (default "auto", correct for R2)
 *   BACKUP_S3_ACCESS_KEY_ID     â€” access key id
 *   BACKUP_S3_SECRET_ACCESS_KEY â€” secret access key
 *   BACKUP_S3_PREFIX            â€” key prefix (default "uzuriliving-backups/")
 *
 * On Supabase: this runs as a daily cron (see Supabase.toml). The container
 * must have pg_dump available (the Dockerfile installs postgresql-client).
 */

require("dotenv").config();
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_MIGRATE_URL;
if (!DATABASE_URL) {
  console.error("[backup] ERROR: DATABASE_URL is not set");
  process.exit(1);
}

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, "..", "backups");
const RETAIN_DAYS = parseInt(process.env.BACKUP_RETAIN_DAYS || "7", 10);

// Ensure backup directory exists
fs.mkdirSync(BACKUP_DIR, { recursive: true });

const now = new Date();
const timestamp = now.toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
const filename = `uzuriliving-backup-${timestamp}.sql.gz`;
const filepath = path.join(BACKUP_DIR, filename);

console.log(`[backup] Starting backup at ${now.toISOString()}`);
console.log(`[backup] Output: ${filepath}`);

// Run pg_dump and gzip
const result = spawnSync(
  "sh",
  ["-c", `pg_dump "${DATABASE_URL}" | gzip > "${filepath}"`],
  { stdio: "inherit" }
);

if (result.status !== 0) {
  console.error("[backup] pg_dump failed with exit code:", result.status);
  if (result.error) console.error("[backup] Error:", result.error.message);
  process.exit(1);
}

const stat = fs.statSync(filepath);
const sizeMB = (stat.size / (1024 * 1024)).toFixed(2);
console.log(`[backup] Local backup complete: ${filename} (${sizeMB} MB)`);

// Delete local backups older than RETAIN_DAYS
const cutoff = Date.now() - RETAIN_DAYS * 24 * 60 * 60 * 1000;
let deleted = 0;
for (const file of fs.readdirSync(BACKUP_DIR)) {
  if (!file.startsWith("uzuriliving-backup-") || !file.endsWith(".sql.gz")) continue;
  const fullPath = path.join(BACKUP_DIR, file);
  const fileStat = fs.statSync(fullPath);
  if (fileStat.mtimeMs < cutoff) {
    fs.unlinkSync(fullPath);
    deleted++;
    console.log(`[backup] Deleted old local backup: ${file}`);
  }
}
console.log(`[backup] Local cleanup complete: ${deleted} old backup(s) removed`);

// â”€â”€ Off-site upload to S3 / Cloudflare R2 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function uploadToS3() {
  const bucket = process.env.BACKUP_S3_BUCKET;
  if (!bucket) {
    console.log("[backup] BACKUP_S3_BUCKET not set â€” skipping off-site upload.");
    return;
  }

  const {
    S3Client,
    PutObjectCommand,
    ListObjectsV2Command,
    DeleteObjectsCommand,
  } = require("@aws-sdk/client-s3");

  const prefix = process.env.BACKUP_S3_PREFIX || "uzuriliving-backups/";
  const client = new S3Client({
    region: process.env.BACKUP_S3_REGION || "auto",
    endpoint: process.env.BACKUP_S3_ENDPOINT || undefined,
    credentials: {
      accessKeyId: process.env.BACKUP_S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.BACKUP_S3_SECRET_ACCESS_KEY,
    },
  });

  const key = `${prefix}${filename}`;
  console.log(`[backup] Uploading to s3://${bucket}/${key} ...`);
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fs.createReadStream(filepath),
      ContentType: "application/gzip",
    })
  );
  console.log("[backup] Off-site upload complete.");

  // Retention on the bucket: delete objects older than RETAIN_DAYS
  const listed = await client.send(
    new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix })
  );
  const stale = (listed.Contents || []).filter(
    (o) => o.LastModified && o.LastModified.getTime() < cutoff
  );
  if (stale.length > 0) {
    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: stale.map((o) => ({ Key: o.Key })) },
      })
    );
    console.log(`[backup] Off-site cleanup: removed ${stale.length} old object(s).`);
  }
}

uploadToS3()
  .then(() => {
    console.log("[backup] Done.");
  })
  .catch((err) => {
    // Off-site upload failure should not silently pass â€” exit non-zero so the
    // cron is marked failed and you get alerted, but the local dump still exists.
    console.error("[backup] Off-site upload FAILED:", err.message);
    process.exit(1);
  });
