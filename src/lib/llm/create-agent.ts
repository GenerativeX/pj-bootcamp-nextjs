import { Agent } from "@openai/agents";
import type {
  AgentOptions as CoreAgentOptions,
  AgentOutputType,
  Tool,
} from "@openai/agents";
import type { RunContext } from "@openai/agents";
import { getAgentModel } from "@/lib/llm/ai-sdk";
import type { ReasoningEffort } from "@/lib/llm/model-options";
import { ReasoningEffortSchema } from "@/lib/llm/model-options";
import { z } from "zod";

// ================================
// 1. 型定義・スキーマセクション
// ================================

/**
 * Agent作成オプションのZodスキーマ
 * - バリデーション用（実行時チェック）
 */
const CreateAgentOptionsSchema = z.object({
  name: z.string(),
  instructions: z.union([z.string(), z.function()]),
  tools: z.array(z.unknown()).optional(),
  model: z.string().optional(),
  provider: z.string().optional(),
  reasoningEffort: ReasoningEffortSchema.optional(),
  outputType: z.unknown().optional(),
});

/**
 * Agent作成オプションのTypeScript型
 * - 実際のAPI用（型推論と補完のため明示的に定義）
 *
 * @template TContext Agent実行時のコンテキスト型
 * @template TOutput Agent出力の型（デフォルトは汎用的なAgentOutputType）
 */
export interface CreateAgentOptions<
  TContext = unknown,
  TOutput extends AgentOutputType = AgentOutputType,
> {
  /** Agentの名前 */
  name: string;
  /** Agentへの指示（文字列または動的生成関数） */
  instructions: string | ((context: TContext) => string);
  /** Agentが使用可能なツール一覧 */
  tools?: Tool<TContext>[];
  /** モデル名（例: "gpt-5.2", "o3"） */
  model?: string;
  /** プロバイダー名（未指定でOpenAI） */
  provider?: string;
  /** 推論の労力レベル（推論モデル用） */
  reasoningEffort?: ReasoningEffort;
  /** 出力型定義（構造化出力用） */
  outputType?: TOutput;
}

// ================================
// 2. Instructions変換セクション
// ================================

/**
 * instructions関数をOpenAI Agents SDK形式に変換
 *
 * ユーザーAPI形式: (context: TContext) => string
 * OpenAI SDK形式: (runContext: RunContext<TContext>) => string
 *
 * RunContextからcontextを抽出してユーザー関数に渡す。
 *
 * @param instructions 文字列または関数
 * @returns OpenAI SDK形式のinstructions
 */
function convertInstructions<TContext>(
  instructions: string | ((context: TContext) => string),
): string | ((runContext: RunContext<TContext>) => string) {
  if (typeof instructions === "function") {
    return (runContext: RunContext<TContext>) =>
      instructions(runContext.context as TContext);
  }
  return instructions;
}

// ================================
// 3. Agent作成セクション
// ================================

/**
 * OpenAI Agents SDKを使用してAgentを作成
 *
 * 処理フロー:
 * 1. オプションのバリデーション（Zod）
 * 2. 基本設定の構築（name, instructions, tools, outputType）
 * 3. モデルの解決（model/provider/reasoningEffortから自動解決、ai-sdk.tsに委譲）
 * 4. Agentインスタンスの生成
 *
 * @template TContext Agent実行時のコンテキスト型
 * @template TOutput Agent出力の型
 * @param options Agent作成オプション
 * @returns 設定済みのAgentインスタンス
 */
export function createAgent<
  TContext = unknown, // コンテキスト型
  TOutput extends AgentOutputType = AgentOutputType, // 出力型
>(options: CreateAgentOptions<TContext, TOutput>): Agent<TContext, TOutput> {
  // オプションのバリデーション（Zod）
  CreateAgentOptionsSchema.parse(options);

  const {
    name,
    instructions,
    tools = [],
    model,
    provider,
    reasoningEffort,
    outputType,
  } = options;

  // Agent設定を構築してインスタンスを生成
  const agentConfig: CoreAgentOptions<TContext, TOutput> = {
    name,
    instructions: convertInstructions(instructions),
    tools,
    model: getAgentModel(model, provider, reasoningEffort),
    ...(outputType && { outputType }),
  };

  return new Agent(agentConfig);
}
