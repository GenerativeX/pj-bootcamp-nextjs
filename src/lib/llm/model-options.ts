import { z } from "zod";

// ================================
// 1. 基本型定義セクション
// ================================

/**
 * 利用可能なモデル名
 * - o3: OpenAIの推論モデル
 * - gpt-5.2: OpenAIの次世代モデル（派生）
 * - gpt-5.4-2026-03-05: OpenAIの次世代モデル（新）
 * - gpt-5.3-codex: OpenAIのコーディング最適化モデル
 * - claude-opus-4-6: Claude 4.6 Opus
 * - claude-sonnet-4-6: Claude 4.6 Sonnet (Bedrock)
 * - claude-haiku-4-5: Claude 4.5 Haiku (Bedrock)
 */
export const AvailableModelSchema = z.enum([
  "o3",
  "gpt-5.2",
  "gpt-5.4-2026-03-05",
  "gpt-5.3-codex",
  "claude-opus-4-6",
  "claude-sonnet-4-6",
  "claude-haiku-4-5",
]);
export const AVAILABLE_MODELS = AvailableModelSchema.options;
export type AvailableModel = z.infer<typeof AvailableModelSchema>;

/**
 * 利用可能なプロバイダー
 * - openai: OpenAI直接
 * - bedrock: AWS Bedrock
 */
export const AvailableProviderSchema = z.enum(["openai", "bedrock"]);
export const AVAILABLE_PROVIDERS = AvailableProviderSchema.options;
export type AvailableProvider = z.infer<typeof AvailableProviderSchema>;

/**
 * Reasoning Effort（推論の労力レベル）
 * - low: 高速・低コスト（推論が少ない）
 * - medium: 中速・中コスト（バランス型）
 * - high: 低速・高コスト（推論が多い、精度重視）
 *
 * 推論モデル（gpt-5.2, o3など）で使用される
 */
export const ReasoningEffortSchema = z.enum(["low", "medium", "high"]);
export const REASONING_EFFORTS = ReasoningEffortSchema.options;
export type ReasoningEffort = z.infer<typeof ReasoningEffortSchema>;

// ================================
// 2. モデル設定セクション
// ================================

/**
 * モデルの機能設定
 */
export const ModelCapabilitySchema = z.object({
  /** モデルの表示名 */
  label: z.string(),
  /** 対応するプロバイダー一覧 */
  providers: z.array(AvailableProviderSchema).readonly(),
  /** デフォルトのプロバイダー */
  defaultProvider: AvailableProviderSchema,
  /** Reasoning Effortをサポートするか */
  supportsEffort: z.boolean(),
  /** デフォルトのReasoning Effort */
  defaultEffort: ReasoningEffortSchema.optional(),
});
export type ModelCapability = z.infer<typeof ModelCapabilitySchema>;

export const ModelCapabilitiesSchema = z.record(
  AvailableModelSchema,
  ModelCapabilitySchema,
);
export type ModelCapabilities = z.infer<typeof ModelCapabilitiesSchema>;

/**
 * 各モデルの機能設定マップ
 */
export const MODEL_CAPABILITIES: ModelCapabilities =
  ModelCapabilitiesSchema.parse({
    o3: {
      label: "o3 (Reasoning)",
      providers: ["openai"],
      defaultProvider: "openai",
      supportsEffort: true,
      defaultEffort: "medium",
    },
    "gpt-5.2": {
      label: "GPT-5.2",
      providers: ["openai"],
      defaultProvider: "openai",
      supportsEffort: true,
      defaultEffort: "medium",
    },
    "gpt-5.4-2026-03-05": {
      label: "GPT-5.4",
      providers: ["openai"],
      defaultProvider: "openai",
      supportsEffort: true,
      defaultEffort: "medium",
    },
    "gpt-5.3-codex": {
      label: "GPT-5.3 Codex",
      providers: ["openai"],
      defaultProvider: "openai",
      supportsEffort: true,
      defaultEffort: "medium",
    },
    "claude-sonnet-4-6": {
      label: "Claude 4.6 Sonnet (Bedrock)",
      providers: ["bedrock"],
      defaultProvider: "bedrock",
      supportsEffort: false,
      defaultEffort: undefined,
    },
    "claude-opus-4-6": {
      label: "Claude 4.6 Opus (Bedrock)",
      providers: ["bedrock"],
      defaultProvider: "bedrock",
      supportsEffort: false,
      defaultEffort: undefined,
    },
    "claude-haiku-4-5": {
      label: "Claude 4.5 Haiku (Bedrock)",
      providers: ["bedrock"],
      defaultProvider: "bedrock",
      supportsEffort: false,
      defaultEffort: undefined,
    },
  });

// ================================
// 3. デフォルト値セクション
// ================================

/**
 * デフォルトモデル名
 * - モデル名が指定されない場合に使用される
 */
export const DEFAULT_MODEL: AvailableModel = "gpt-5.2";
