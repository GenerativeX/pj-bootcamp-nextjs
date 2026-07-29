# pj-bootcamp

boot-campで利用する、ローカル利用を前提とした開発用プロジェクトです。
Cursorを使いエージェントモードで編集します。

## プロジェクト概要

- 変更・機能追加の主な作業対象: `src/` 配下
- 画面確認: `http://localhost:3000`
- API仕様確認: `http://localhost:3000/api/ui`

## 先に押さえるポイント

- ローカル専用のため、公開環境前提の設定は不要

## ローカル起動手順

```bash
cp .env.example .env.local   # 利用するプロバイダのAPIキーを設定
yarn install
yarn dev
```

`.env.local` を設定しなくても起動できます。その場合、LLMは外部APIを呼ばずに
モック応答を返すため、画面やUIの確認はAPIキー無しで行えます。

## 日常作業コマンド

```bash
yarn dev        # 開発サーバー起動（http://localhost:3000）
yarn build      # 本番ビルド
yarn start      # 本番ビルドの起動
yarn lint       # Biome によるチェック
yarn format     # Biome による自動整形
yarn kill-port  # ポート3000を掴んでいるプロセスを終了
```

## 必要な環境

- Node.js 23 以上
- Yarn 4.9.1（corepack により自動で用意されます）

データベース・Docker・外部インフラは不要です。
