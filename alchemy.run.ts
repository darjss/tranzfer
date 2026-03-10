import crypto from "node:crypto";
import { rm, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import alchemy from "alchemy";
import { GitHubComment } from "alchemy/github";
import { CloudflareStateStore } from "alchemy/state";
import { Astro, D1Database, KVNamespace, R2Bucket } from "alchemy/cloudflare";

const APP_NAME = "saas-starter";

type EncryptedSecret = {
  ciphertext: string;
  iv: string;
  salt: string;
  tag: string;
  version: "v1";
};

const KEY_LEN = 32;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const ALGO = "aes-256-gcm";

function isLocalDevCommand() {
  return (
    process.argv.includes("dev") ||
    process.argv.includes("--dev") ||
    process.env.npm_lifecycle_event === "dev"
  );
}

function getAlchemyStage() {
  return process.env.ALCHEMY_STAGE || process.env.USER || process.env.USERNAME || "local";
}

function collectEncryptedSecrets(value: unknown, secrets: EncryptedSecret[] = []) {
  if (!value || typeof value !== "object") {
    return secrets;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectEncryptedSecrets(item, secrets);
    }

    return secrets;
  }

  const candidate = value as Record<string, unknown>;
  const encrypted = candidate["@secret"];

  if (
    encrypted &&
    typeof encrypted === "object" &&
    "ciphertext" in encrypted &&
    "iv" in encrypted &&
    "salt" in encrypted &&
    "tag" in encrypted
  ) {
    secrets.push(encrypted as EncryptedSecret);
  }

  for (const nestedValue of Object.values(candidate)) {
    collectEncryptedSecrets(nestedValue, secrets);
  }

  return secrets;
}

async function deriveScryptKey(passphrase: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(
      passphrase,
      salt,
      KEY_LEN,
      {
        N: SCRYPT_N,
        p: SCRYPT_P,
        r: SCRYPT_R,
      },
      (error, key) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(key);
      },
    );
  });
}

async function decryptSecret(secret: EncryptedSecret, password: string) {
  const key = await deriveScryptKey(password, Buffer.from(secret.salt, "base64"));
  const decipher = crypto.createDecipheriv(
    ALGO,
    key,
    Buffer.from(secret.iv, "base64"),
  );

  decipher.setAuthTag(Buffer.from(secret.tag, "base64"));
  Buffer.concat([
    decipher.update(Buffer.from(secret.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

async function resetIncompatibleLocalState() {
  if (process.env.ALCHEMY_STATE_TOKEN || !isLocalDevCommand()) {
    return;
  }

  const password = process.env.ALCHEMY_PASSWORD;

  if (!password) {
    return;
  }

  const stateDir = path.join(".alchemy", APP_NAME, getAlchemyStage());
  let stateFiles: string[];

  try {
    stateFiles = (await readdir(stateDir))
      .filter((fileName) => fileName.endsWith(".json"))
      .map((fileName) => path.join(stateDir, fileName));
  } catch {
    return;
  }

  for (const stateFile of stateFiles) {
    const stateContent = await readFile(stateFile, "utf8");
    const secrets = collectEncryptedSecrets(JSON.parse(stateContent));

    try {
      for (const secret of secrets) {
        await decryptSecret(secret, password);
      }
    } catch {
      await rm(stateDir, { force: true, recursive: true });
      await rm(path.join(".alchemy", "local", "wrangler.jsonc"), { force: true });
      console.warn(
        `Reset local Alchemy state in ${stateDir} because encrypted secrets no longer match ALCHEMY_PASSWORD.`,
      );
      return;
    }
  }
}

await resetIncompatibleLocalState();

const app = await alchemy(APP_NAME, {
  stateStore: process.env.ALCHEMY_STATE_TOKEN
    ? (scope) => new CloudflareStateStore(scope)
    : undefined,
});

const db = await D1Database("db", {
  name: "saas-starter-db",
  migrationsDir: "./drizzle/migrations",
  migrationsTable: "drizzle_migrations",
});

const bucket = await R2Bucket("bucket", {
  name: "saas-starter-bucket",
});

const cache = await KVNamespace("cache", {
  title: "saas-starter-cache",
});

const session = await KVNamespace("session", {
  title: "saas-starter-session",
});

export const worker = await Astro("website", {
  bindings: {
    DB: db,
    BUCKET: bucket,
    CACHE: cache,
    SESSION: session,
    BETTER_AUTH_SECRET: alchemy.secret(
      process.env.BETTER_AUTH_SECRET,
      "BETTER_AUTH_SECRET",
    ),
    ...(process.env.BETTER_AUTH_URL
      ? { BETTER_AUTH_URL: process.env.BETTER_AUTH_URL }
      : {}),
    ...(process.env.TRUSTED_ORIGINS
      ? { TRUSTED_ORIGINS: process.env.TRUSTED_ORIGINS }
      : {}),
    POLAR_ACCESS_TOKEN: alchemy.secret(
      process.env.POLAR_ACCESS_TOKEN,
      "POLAR_ACCESS_TOKEN",
    ),
    POLAR_WEBHOOK_SECRET: alchemy.secret(
      process.env.POLAR_WEBHOOK_SECRET,
      "POLAR_WEBHOOK_SECRET",
    ),
    ...(process.env.POLAR_SERVER
      ? { POLAR_SERVER: process.env.POLAR_SERVER }
      : {}),
    ...(process.env.POLAR_PRODUCT_STARTER_ID
      ? { POLAR_PRODUCT_STARTER_ID: process.env.POLAR_PRODUCT_STARTER_ID }
      : {}),
    ...(process.env.POLAR_PRODUCT_PRO_ID
      ? { POLAR_PRODUCT_PRO_ID: process.env.POLAR_PRODUCT_PRO_ID }
      : {}),
  },
  compatibilityDate: "2026-03-09",
  compatibilityFlags: ["nodejs_als"],
  dev: {
    command: "astro dev --host 127.0.0.1 --port 4321",
  },
  observability: {
    enabled: true,
  },
  url: true,
});

console.log({
  url: worker.url,
});

if (process.env.PULL_REQUEST) {
  const previewUrl = worker.url;

  await GitHubComment("pr-preview-comment", {
    owner: process.env.GITHUB_REPOSITORY_OWNER || "your-username",
    repository: process.env.GITHUB_REPOSITORY_NAME || "saas-starter",
    issueNumber: Number(process.env.PULL_REQUEST),
    body: `
## 🚀 Preview Deployed

Your preview is ready!

**Preview URL:** ${previewUrl}

This preview was built from commit ${process.env.GITHUB_SHA}

---
<sub>🤖 This comment will be updated automatically when you push new commits to this PR.</sub>`,
  });
}

await app.finalize();
