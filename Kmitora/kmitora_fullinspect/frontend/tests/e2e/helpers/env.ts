import path from "node:path";

export const urls = {
  ui: process.env.KMITORA_UI_URL ?? "http://127.0.0.1:5173",
  core: process.env.KMITORA_CORE_URL ?? "http://127.0.0.1:8080",
  source: process.env.KMITORA_SOURCE_URL ?? "http://127.0.0.1:8081",
  target: process.env.KMITORA_TARGET_URL ?? "http://127.0.0.1:8082",
};

export const goldenSourceDir =
  process.env.KMITORA_GOLDEN_SOURCE_DIR ??
  path.resolve(process.cwd(), "../TEST_DATA/E2E_GOLDEN/source/happy");

export const targetConfig = {
  name: process.env.KMITORA_E2E_TARGET_NAME ?? "KMITORA E2E DEV Target",
  type: process.env.KMITORA_E2E_TARGET_TYPE ?? "postgresql",
  environment: process.env.KMITORA_E2E_TARGET_ENV ?? "DEV",
  host: process.env.KMITORA_E2E_TARGET_HOST ?? "127.0.0.1",
  port: Number(process.env.KMITORA_E2E_TARGET_PORT ?? "5432"),
  database: process.env.KMITORA_E2E_TARGET_DATABASE ?? "",
  schema: process.env.KMITORA_E2E_TARGET_SCHEMA ?? "public",
  username: process.env.KMITORA_E2E_TARGET_USERNAME ?? "",
  password: process.env.KMITORA_E2E_TARGET_PASSWORD ?? "",
};

export const hasRealTargetCredentials =
  Boolean(targetConfig.database && targetConfig.username);
