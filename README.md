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
cp .env.example .env.local
yarn install
yarn dev
yarn orval           # 別ターミナルで実行（devサーバー起動中に実行する必要あり）
```

## 日常作業コマンド
