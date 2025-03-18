# Saiteki SES Mail Service

AWS の S3 に保存されたメールを処理し、案件情報と要員情報に分類する Lambda 関数です。また、メールの添付ファイルを抽出して Office Web Viewer で URL を生成する機能も備えています。

## 主な機能

- S3 に保存されたメールの自動処理
- メールの内容に基づいて「案件」と「要員」への分類（OpenAI API を使用）
- 添付ファイル（Excel、Word、PowerPoint、PDF）の抽出
- Office Web Viewer の URL 生成（7 日間有効）
- Google Spreadsheets へのデータ保存
- Make の API を使用したデータベースへの保存

## 開発環境のセットアップ

```bash
# 依存関係のインストール
npm install

# ローカルでのテスト
# テスト用のイベントJSONを作成し、node.jsで実行
```

## デプロイメント

AWS Lambda 関数としてデプロイします。必要な環境変数：

- `openai-key`: OpenAI API キー
- `make-key`: Make の API キー
- `spreadsheets-credentials`: Google Spreadsheets のアクセス用認証情報

## サポートするファイル形式

添付ファイルの抽出と Office Web Viewer 生成は以下のファイル形式をサポートしています：

- `.xlsx`, `.xls` (Excel ファイル)
- `.docx`, `.doc` (Word ファイル)
- `.pptx`, `.ppt` (PowerPoint ファイル)
- `.pdf` (PDF ファイル)

## ライセンス

プロプライエタリ - © 2025 Saiteki Inc.
