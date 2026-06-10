/**
 * Runtime provider configuration: editable from the settings page, persisted to JSON.
 *
 * Port of `backend/app/services/runtime_config.py`.
 *
 * One file (`data/provider_config.json`) stores per-provider sections:
 *
 *     {"llm": {"base_url": ..., "api_key": ..., "model": ...}, "image": {...}}
 *
 * Saved values override the env defaults so the relay base URL / API key /
 * model for both chat and image generation can be changed from the UI without
 * a restart. The file stores API keys in plain text, same as `.env.local`;
 * both are local, git-ignored files. The on-disk keys stay snake_case so the
 * existing `provider_config.json` written by the FastAPI backend keeps working.
 */

import fs from "node:fs";
import path from "node:path";

import { getSettings, type Settings } from "@/lib/config";

export type ProviderSection = "llm" | "image";

/** Effective connection settings for one provider (file overrides env). */
export interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

/** The subset of Settings the runtime config needs for env fallbacks. */
export type ProviderEnvDefaults = Pick<
  Settings,
  "llmBaseUrl" | "llmApiKey" | "llmModel" | "imageBaseUrl" | "imageApiKey" | "imageModel"
>;

function envDefaults(section: ProviderSection, settings: ProviderEnvDefaults): ProviderConfig {
  if (section === "llm") {
    return {
      baseUrl: settings.llmBaseUrl,
      apiKey: settings.llmApiKey,
      model: settings.llmModel,
    };
  }
  return {
    baseUrl: settings.imageBaseUrl,
    apiKey: settings.imageApiKey,
    model: settings.imageModel,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readFile(filePath: string): Record<string, unknown> {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      console.warn(`Ignoring unreadable provider config file: ${filePath}`);
    }
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? parsed : {};
  } catch {
    console.warn(`Ignoring unreadable provider config file: ${filePath}`);
    return {};
  }
}

/** Return the saved runtime config for a provider, falling back to env defaults. */
export function loadProviderConfig(
  section: ProviderSection,
  settings: ProviderEnvDefaults = getSettings(),
  configPath: string = getSettings().providerConfigPath,
): ProviderConfig {
  const defaults = envDefaults(section, settings);
  const rawSection = readFile(configPath)[section];
  if (!isRecord(rawSection)) {
    return defaults;
  }
  const overrides: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawSection)) {
    if (typeof value === "string") {
      overrides[key] = value;
    }
  }
  // Empty-string values fall back to the env defaults (Python `or` semantics).
  return {
    baseUrl: overrides["base_url"] || defaults.baseUrl,
    apiKey: overrides["api_key"] || defaults.apiKey,
    model: overrides["model"] || defaults.model,
  };
}

/** Persist one provider's runtime config, keeping other sections intact. */
export function saveProviderConfig(
  section: ProviderSection,
  config: ProviderConfig,
  configPath: string = getSettings().providerConfigPath,
): void {
  const data = readFile(configPath);
  data[section] = {
    base_url: config.baseUrl,
    api_key: config.apiKey,
    model: config.model,
  };
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2), "utf-8");
}

/** Return a display-safe preview of an API key (never the full value). */
export function maskApiKey(key: string): string {
  if (!key) {
    return "";
  }
  if (key.length <= 12) {
    return "***";
  }
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}
