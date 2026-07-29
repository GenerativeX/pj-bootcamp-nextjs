import { openai } from "@ai-sdk/openai";
import { createAzure } from "@ai-sdk/azure";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { bedrock } from "@ai-sdk/amazon-bedrock";

import type {
  LanguageModelV2,
  SharedV2ProviderOptions,
} from "@ai-sdk/provider";
import { type ReasoningEffort, DEFAULT_MODEL } from "@/lib/llm/model-options";
import { aisdk } from "@openai/agents-extensions";
import type { Model } from "@openai/agents";

// ================================
// 1. 型定義・定数セクション
// ================================

/**
 * AI SDKのモデルプロバイダー型
 * - OpenAI, Azure OpenAI, Anthropic, Google, AWS Bedrockをサポート
 */
export type ModelProvider =
  | typeof openai
  | typeof anthropic
  | typeof google
  | typeof bedrock
  | ReturnType<typeof createAzure>;

/**
 * Azure OpenAI の既定APIバージョン
 * Responses API を利用するため 2025-04-01-preview 以降を既定とする
 */
export const DEFAULT_AZURE_API_VERSION = "2025-04-01-preview";

/**
 * Azure OpenAI の設定が揃っているか
 * APIキー・エンドポイント・デプロイ名の3つが必須（APIバージョンは既定値あり）
 */
export function hasAzureOpenAICredentials(): boolean {
  return !!(
    process.env.AZURE_OPENAI_API_KEY &&
    process.env.AZURE_OPENAI_ENDPOINT &&
    process.env.AZURE_OPENAI_DEPLOYMENT_NAME
  );
}

/**
 * Azure OpenAI のデプロイ名を取得
 * Azure ではモデル名ではなくデプロイ名でリクエストするため、
 * UI で選択されたモデル名に関わらずこの値が使われる
 */
export function getAzureDeploymentName(): string {
  return process.env.AZURE_OPENAI_DEPLOYMENT_NAME ?? "";
}

/**
 * 標準プロバイダー設定の型定義
 */
type StandardProviderConfig = {
  provider: ModelProvider;
  apiKeyName: string;
  errorMessage: string;
};

/**
 * 標準プロバイダーの設定（Gemini, OpenAI, Bedrock）
 */
const standardProviders: Record<string, StandardProviderConfig> = {
  gemini: {
    provider: google,
    apiKeyName: "GOOGLE_GENERATIVE_AI_API_KEY",
    errorMessage:
      "Google Generative AI APIキーが設定されていません。.env.localファイルを確認してください。",
  },
  openai: {
    provider: openai,
    apiKeyName: "OPENAI_API_KEY",
    errorMessage:
      "OpenAI APIキーが設定されていません。.env.localファイルを確認してください。",
  },
  anthropic: {
    provider: anthropic,
    apiKeyName: "ANTHROPIC_API_KEY",
    errorMessage:
      "Anthropic APIキーが設定されていません。.env.localファイルを確認してください。",
  },
  bedrock: {
    provider: bedrock,
    apiKeyName: "AWS_ACCESS_KEY_ID",
    errorMessage:
      "AWS認証情報が設定されていません。.env.localファイルを確認してください。",
  },
};

function isLocalAnthropicPreferred(): boolean {
  const isDev = process.env.NODE_ENV !== "production";
  return isDev && !!process.env.ANTHROPIC_API_KEY;
}

function hasClaudeProviderCredentials(): boolean {
  return (
    isLocalAnthropicPreferred() ||
    !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
  );
}

/**
 * Agent用: 設定済みの認証情報に合わせてモデル名を解決する。
 * Claude が選ばれていても Anthropic/Bedrock が無い場合は OpenAI 既定モデルへフォールバック。
 */
export function resolveModelForAgent(modelName?: string): string {
  const name = modelName ?? DEFAULT_MODEL;
  if (!name.startsWith("claude")) {
    return name;
  }
  if (hasClaudeProviderCredentials()) {
    return name;
  }
  console.warn(
    `[ai-sdk] Claude model "${name}" is unavailable (set ANTHROPIC_API_KEY or AWS credentials). Using OpenAI model "${DEFAULT_MODEL}".`,
  );
  return DEFAULT_MODEL;
}

/**
 * BedrockのmodelId（例: anthropic.claude-sonnet-4-6-v1:0）を、
 * Anthropic直接API用のモデル名（例: claude-sonnet-4-6）へ変換。
 */
function bedrockModelIdToAnthropicModelName(modelId: string): string {
  if (!modelId.startsWith("anthropic.")) return modelId;
  const withoutPrefix = modelId.slice("anthropic.".length);
  // Bedrockの末尾 "-v1:0" はAnthropic側では不要なことが多いので落とす
  return withoutPrefix.replace(/-v\d+:\d+$/, "");
}

// ================================
// 2. 環境変数検証セクション
// ================================

/**
 * 標準プロバイダーのAPIキーを検証
 *
 * @param providerKey プロバイダー名（claude, gemini, openai）
 * @throws APIキーが設定されていない場合
 */
function validateProviderApiKey(
  providerKey: keyof typeof standardProviders,
): void {
  const config = standardProviders[providerKey];
  if (!process.env[config.apiKeyName]) {
    throw new Error(config.errorMessage);
  }
}

// ================================
// 3. プロバイダー生成セクション
// ================================

/**
 * Azure OpenAIプロバイダーインスタンスを生成
 *
 * @returns Azure OpenAIプロバイダーインスタンス
 * @throws 必要な環境変数が不足している場合
 */
function createAzureProviderInstance(): ReturnType<typeof createAzure> {
  if (!hasAzureOpenAICredentials()) {
    throw new Error(
      "Azure OpenAIの環境変数が不足しています。AZURE_OPENAI_API_KEY / AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_DEPLOYMENT_NAME を .env.local に設定してください。",
    );
  }

  return createAzure({
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    baseURL: process.env.AZURE_OPENAI_ENDPOINT,
    apiVersion:
      process.env.AZURE_OPENAI_API_VERSION || DEFAULT_AZURE_API_VERSION,
  });
}

/**
 * Bedrockモデル名を実際のモデルIDにマッピング（APAC推論プロファイル使用）
 *
 * @param modelName フレンドリーなモデル名
 * @returns Bedrock APIで使用する実際のモデルID（APAC推論プロファイル）
 */
function mapBedrockModelId(modelName: string): string {
  const bedrockModelMap: Record<string, string> = {
    // Claude 系（Bedrock modelId / inference profile id）
    // UIや他の呼び出し元では alias / Claude API ID どちらも来うるため両方受ける
    "claude-opus-4-6": "anthropic.claude-opus-4-6-v1:0",
    "claude-sonnet-4-6": "anthropic.claude-sonnet-4-6-v1:0",
    "claude-haiku-4-5": "anthropic.claude-haiku-4-5-20251001-v1:0",
    "claude-haiku-4-5-20251001": "anthropic.claude-haiku-4-5-20251001-v1:0",
  };
  return bedrockModelMap[modelName] || modelName;
}

/**
 * モデル名から標準プロバイダーを取得
 *
 * @param modelName モデル名（プレフィックスでプロバイダーを判定）
 * @returns [プロバイダー, モデル名]
 */
function getStandardProvider(modelName: string): [ModelProvider, string] {
  // モデル名のプレフィックスからプロバイダーを判定
  let providerKey: keyof typeof standardProviders = "openai";
  let actualModelName = modelName;

  if (modelName.startsWith("claude")) {
    const prefersAnthropic = isLocalAnthropicPreferred();
    providerKey = prefersAnthropic ? "anthropic" : "bedrock";
    // "claude-*" のフレンドリー名は一旦 Bedrock の正規IDへ寄せてから、
    // ローカルAnthropicの場合はAnthropic向けモデル名に変換する。
    const bedrockModelId = mapBedrockModelId(modelName);
    actualModelName = prefersAnthropic
      ? bedrockModelIdToAnthropicModelName(bedrockModelId)
      : bedrockModelId;
  } else if (modelName.startsWith("gemini")) {
    providerKey = "gemini";
  } else if (
    modelName.startsWith("apac.anthropic") ||
    modelName.startsWith("us.anthropic") ||
    modelName.startsWith("global.anthropic") ||
    modelName.startsWith("anthropic.claude") ||
    modelName.startsWith("bedrock-")
  ) {
    const prefersAnthropic = isLocalAnthropicPreferred();
    providerKey = prefersAnthropic ? "anthropic" : "bedrock";
    if (prefersAnthropic && modelName.startsWith("anthropic.")) {
      actualModelName = bedrockModelIdToAnthropicModelName(modelName);
    }
  }

  // OpenAI系モデルは、Azure OpenAIの設定があればそちらを優先する。
  // Azureではモデル名ではなくデプロイ名でリクエストする点に注意。
  if (providerKey === "openai" && hasAzureOpenAICredentials()) {
    return [createAzureProviderInstance(), getAzureDeploymentName()];
  }

  validateProviderApiKey(providerKey);
  const config = standardProviders[providerKey];
  return [config.provider, actualModelName];
}

// ================================
// 4. メイン関数セクション
// ================================

/**
 * モデル名とプロバイダーからプロバイダーインスタンスとモデル名を取得
 *
 * 処理フロー:
 * 1. modelName未指定の場合: デフォルトモデルを使用（model-options.tsのDEFAULT_MODEL）
 * 2. それ以外: モデル名のプレフィックスから適切なプロバイダーを判定
 *
 * @param modelName モデル名（例: "gpt-5.2", "o3", "claude-opus-4-6", "gemini-pro"）
 * @param provider プロバイダー名（未使用、互換性のために保持）
 * @returns [プロバイダーインスタンス, モデル名]
 * @throws APIキーが設定されていない場合
 */
export function getProviderAndModel(
  modelName?: string,
  _provider?: string,
): [ModelProvider, string] {
  // モデル名未指定の場合はデフォルトを使用
  if (!modelName) {
    if (hasAzureOpenAICredentials()) {
      return [createAzureProviderInstance(), getAzureDeploymentName()];
    }
    validateProviderApiKey("openai");
    return [standardProviders.openai.provider, DEFAULT_MODEL];
  }

  // モデル名から標準プロバイダーを取得
  return getStandardProvider(modelName);
}

/**
 * モデル設定オプション
 */
export type ModelConfigOptions = {
  /** Reasoning Effort（推論の労力レベル: low, medium, high） */
  reasoningEffort?: ReasoningEffort;
};

/**
 * モデル設定を取得（reasoningEffortオプション対応）
 *
 * 処理フロー:
 * 1. プロバイダーとモデル名を取得
 * 2. 基本モデルインスタンスを生成
 * 3. reasoningEffortが指定されている場合は設定を適用
 *
 * @param modelName モデル名
 * @param provider プロバイダー名
 * @param options 追加オプション（reasoningEffortなど）
 * @returns 設定済みのLanguageModelV2インスタンス
 */
export function getModelConfig(
  modelName?: string,
  provider?: string,
  options?: ModelConfigOptions,
): LanguageModelV2 {
  const [providerInstance, model] = getProviderAndModel(modelName, provider);
  const baseModel = providerInstance(model) as LanguageModelV2;

  // reasoningEffortの設定が不要な場合は基本モデルをそのまま返す
  if (!options?.reasoningEffort) {
    return baseModel;
  }

  // reasoningEffortを適用したモデルを返す
  return withReasoningEffort(baseModel, options.reasoningEffort);
}

// ================================
// 5. Reasoning Effort設定セクション
// ================================

/**
 * モデルにreasoning effortを設定
 *
 * OpenAIのo3/o1などの推論モデルで使用される設定。
 * doGenerate/doStreamをラップして、providerOptionsにreasoningEffortを注入する。
 *
 * @param model 元のLanguageModelV2インスタンス
 * @param effort 推論の労力レベル（low, medium, high）
 * @returns reasoningEffortが設定されたモデルインスタンス
 */
function withReasoningEffort(
  model: LanguageModelV2,
  effort: ReasoningEffort,
): LanguageModelV2 {
  /**
   * 既存のproviderOptionsにreasoningEffortを追加
   */
  const ensureProviderOptions = (
    providerOptions?: SharedV2ProviderOptions,
  ): SharedV2ProviderOptions => {
    const existing = providerOptions ?? {};
    const openaiOptions = {
      ...(existing.openai ?? {}),
      reasoningEffort: effort,
    };
    return {
      ...existing,
      openai: openaiOptions,
    };
  };

  // モデルをラップしてproviderOptionsを注入
  const wrapped = Object.create(model) as LanguageModelV2;
  wrapped.doGenerate = async (options: any) =>
    model.doGenerate({
      ...options,
      providerOptions: ensureProviderOptions(options.providerOptions),
    });
  wrapped.doStream = async (options: any) =>
    model.doStream({
      ...options,
      providerOptions: ensureProviderOptions(options.providerOptions),
    });

  return wrapped;
}

// ================================
// 6. Agent用モデル解決セクション
// ================================

/**
 * Agent用のモデルインスタンスを解決
 *
 * フォールバック戦略:
 * 1. 認証情報に合わせてモデル名を解決（Claude 不可時は OpenAI 既定モデル）
 * 2. AI SDK 経由で Model を作成
 * 3. 失敗時は OPENAI_API_KEY があれば OpenAI 既定モデルで再試行
 *
 * @param model モデル名
 * @param provider プロバイダー名
 * @param reasoningEffort 推論の労力レベル
 * @returns Modelインスタンスまたはモデル名（文字列）
 */
export function getAgentModel(
  model?: string,
  provider?: string,
  reasoningEffort?: ReasoningEffort,
): Model | string {
  const resolvedModel = resolveModelForAgent(model);

  try {
    const modelConfig = getModelConfig(resolvedModel, provider, {
      reasoningEffort,
    });
    return aisdk(modelConfig);
  } catch (error) {
    console.warn(
      `Failed to create agent model, falling back to OpenAI default:`,
      error,
    );

    if (!process.env.OPENAI_API_KEY && !hasAzureOpenAICredentials()) {
      throw error instanceof Error ? error : new Error(String(error));
    }

    const openaiFallback = getModelConfig(DEFAULT_MODEL, "openai", {
      reasoningEffort,
    });
    return aisdk(openaiFallback);
  }
}
