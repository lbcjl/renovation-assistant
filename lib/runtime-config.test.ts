/**
 * Tests for runtime provider configuration.
 *
 * Ports the behavioral contracts from `backend/tests/test_provider_settings.py`
 * that live at the service layer: key masking, file-overrides-env, empty
 * values falling back to env defaults, and section isolation when saving.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  loadProviderConfig,
  maskApiKey,
  saveProviderConfig,
  type ProviderEnvDefaults,
} from "@/lib/runtime-config";

function makeSettings(overrides: Partial<ProviderEnvDefaults> = {}): ProviderEnvDefaults {
  return {
    llmBaseUrl: "https://relay.example/v1",
    llmApiKey: "test-llm-key-1234567890",
    llmModel: "claude-opus-4-6",
    imageBaseUrl: "https://image.example/v1",
    imageApiKey: "test-image-key-1234567890",
    imageModel: "gpt-image-2",
    ...overrides,
  };
}

let tempDir: string;
let configPath: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "runtime-config-test-"));
  configPath = path.join(tempDir, "provider_config.json");
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("maskApiKey", () => {
  it("returns empty string for empty key", () => {
    expect(maskApiKey("")).toBe("");
  });

  it("returns *** for short keys (<= 12 chars)", () => {
    expect(maskApiKey("short")).toBe("***");
    expect(maskApiKey("123456789012")).toBe("***");
  });

  it("returns first6...last4 for longer keys", () => {
    expect(maskApiKey("test-llm-key-1234567890")).toBe("test-l...7890");
    expect(maskApiKey("1234567890123")).toBe("123456...0123");
  });

  it("never contains the middle of the key", () => {
    expect(maskApiKey("test-llm-key-1234567890")).not.toContain("test-llm-key");
  });
});

describe("loadProviderConfig", () => {
  it("returns env defaults when no file exists", () => {
    const config = loadProviderConfig("llm", makeSettings(), configPath);
    expect(config).toEqual({
      baseUrl: "https://relay.example/v1",
      apiKey: "test-llm-key-1234567890",
      model: "claude-opus-4-6",
    });
  });

  it("uses image defaults for the image section", () => {
    const config = loadProviderConfig("image", makeSettings(), configPath);
    expect(config).toEqual({
      baseUrl: "https://image.example/v1",
      apiKey: "test-image-key-1234567890",
      model: "gpt-image-2",
    });
  });

  it("file values override env defaults", () => {
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        llm: {
          base_url: "https://new-relay.example/v1",
          api_key: "new-key-abcdefghijkl",
          model: "gpt-5.4",
        },
      }),
      "utf-8",
    );

    const config = loadProviderConfig("llm", makeSettings(), configPath);
    expect(config).toEqual({
      baseUrl: "https://new-relay.example/v1",
      apiKey: "new-key-abcdefghijkl",
      model: "gpt-5.4",
    });
  });

  it("empty-string file values fall back to env defaults", () => {
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        llm: { base_url: "https://new-relay.example/v1", api_key: "", model: "" },
      }),
      "utf-8",
    );

    const config = loadProviderConfig("llm", makeSettings(), configPath);
    expect(config.baseUrl).toBe("https://new-relay.example/v1");
    expect(config.apiKey).toBe("test-llm-key-1234567890");
    expect(config.model).toBe("claude-opus-4-6");
  });

  it("ignores a corrupt config file and returns env defaults", () => {
    fs.writeFileSync(configPath, "not json at all", "utf-8");

    const config = loadProviderConfig("llm", makeSettings(), configPath);
    expect(config.baseUrl).toBe("https://relay.example/v1");
  });
});

describe("saveProviderConfig", () => {
  it("persists a section and load reflects it", () => {
    saveProviderConfig(
      "llm",
      { baseUrl: "https://new-relay.example/v1", apiKey: "saved-key-abcdefghij", model: "gpt-5.4" },
      configPath,
    );

    const config = loadProviderConfig("llm", makeSettings(), configPath);
    expect(config.baseUrl).toBe("https://new-relay.example/v1");
    expect(config.apiKey).toBe("saved-key-abcdefghij");
    expect(config.model).toBe("gpt-5.4");
  });

  it("saving llm keeps the image section intact", () => {
    saveProviderConfig(
      "image",
      {
        baseUrl: "https://new-image.example/v1",
        apiKey: "image-key-abcdefghij",
        model: "gpt-image-3",
      },
      configPath,
    );
    saveProviderConfig(
      "llm",
      { baseUrl: "https://new-relay.example/v1", apiKey: "llm-key-abcdefghijkl", model: "gpt-5.4" },
      configPath,
    );

    const imageConfig = loadProviderConfig("image", makeSettings(), configPath);
    expect(imageConfig.baseUrl).toBe("https://new-image.example/v1");
    expect(imageConfig.model).toBe("gpt-image-3");

    const llmConfig = loadProviderConfig("llm", makeSettings(), configPath);
    expect(llmConfig.baseUrl).toBe("https://new-relay.example/v1");
  });

  it("writes snake_case keys on disk (compatible with the existing file format)", () => {
    saveProviderConfig(
      "llm",
      { baseUrl: "https://new-relay.example/v1", apiKey: "llm-key-abcdefghijkl", model: "gpt-5.4" },
      configPath,
    );

    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8")) as Record<string, unknown>;
    expect(raw["llm"]).toEqual({
      base_url: "https://new-relay.example/v1",
      api_key: "llm-key-abcdefghijkl",
      model: "gpt-5.4",
    });
  });

  it("creates parent directories when missing", () => {
    const nestedPath = path.join(tempDir, "nested", "dir", "provider_config.json");
    saveProviderConfig(
      "llm",
      { baseUrl: "https://relay.example/v1", apiKey: "key-abcdefghijklmnop", model: "gpt-5.4" },
      nestedPath,
    );

    expect(fs.existsSync(nestedPath)).toBe(true);
  });
});
