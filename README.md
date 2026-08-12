# pj-bootcamp

boot-campで利用する、ローカル利用を前提とした開発用プロジェクトです。
Cursorを使いエージェントモードで編集します。

## プロジェクト概要

- 変更・機能追加の主な作業対象: `src/` 配下
- 画面確認: `http://localhost:3000`
- API仕様確認: `http://localhost:3000/api/ui`
- スタック: yarn / Next.js 16 / Chakra UI / OpenAI Agents SDK
- 外部検索: SerpAPI（`SERP_API_KEY`）
- **データの永続化はしない**（DB・Prisma・サーバー側ストレージは使わない）

## 先に押さえるポイント

- ローカル専用のため、公開環境前提の設定は不要
- セッションや履歴はフロントの state / localStorage 程度に留め、サーバーへ保存しない
- ファイルIOはなるべくフロントエンドで完結する
- LLM呼び出しは既存の API（`/api/llm/chat` や Agent 用エンドポイント）を使う

## ローカル起動手順

```bash
cp .env.example .env   # なければ .env を用意
# OPENAI_API_KEY / ANTHROPIC_API_KEY / SERP_API_KEY を設定
yarn install
yarn dev
```

必要なら別ターミナルで:

```bash
yarn orval   # OpenAPI クライアント再生成（devサーバー起動中に実行）
```

## 日常作業コマンド

```bash
yarn dev      # 開発サーバー起動
yarn lint     # Biome チェック
yarn format   # Biome フォーマット
```

## Agent を速く作るプラクティス

既存の Web検索Agent（`/web-search-agent`）を雛形にして、同じ薄い構成で増やす。

### 方針

1. **永続化しない** — DB・ユーザーデータ保存・サーバー側履歴は作らない。会話は画面の state で持つ
2. **既存部品を再利用** — `createAgent`（`src/lib/llm/create-agent.ts`）と `@openai/agents` の `tool` / `run`
3. **役割を分けすぎない** — controller（実行）→ router（API）→ page（UI）の3点セットで十分
4. **ツールは必要最小限** — 検索なら SerpAPI、本文取得なら既存 `WebController` など、既にある実装を呼ぶ
5. **指示文は短く具体的に** — 役割・やること・やらないこと（断定禁止など）を数行で書く
6. **余計な抽象化をしない** — 共通基盤の拡張より、動く1本の Agent を先に通す

### 追加するファイルの型

| 層 | 置き場 | やること |
| --- | --- | --- |
| 実行ロジック | `src/controllers/*-agent-controller.ts` | `tool` 定義、`createAgent`、`run` |
| API | `src/routers/*-agent.ts` | Zod + OpenAPI で `/run` を生やす |
| 画面 | `src/app/<name>/page.tsx` | メッセージ state を持ち API を叩く |

あわせて:

- `src/routers/main.ts` に route をマウント
- `src/lib/constant.ts` の `LinkItems` にサイドバーリンクを追加

### 参考実装

- Agent: `src/controllers/web-search-agent-controller.ts`
- API: `src/routers/web-search-agent.ts`
- UI: `src/app/web-search-agent/page.tsx`

### やらないこと

- Prisma / DB / サーバーサイドの履歴保存
- 認証・マルチテナントなどの本番向け基盤
- ツールや Agent 基底クラスの過剰な共通化
- 動かす前の大規模リファクタ
