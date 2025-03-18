import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

// ビルドを実行する関数
async function build() {
  console.log("ビルドを開始します...");

  // 必要なファイルのリスト
  const sourceFiles = [
    "index.mjs",
    "config.mjs",
    "clients.mjs",
    "ai.mjs",
    "api.mjs",
    "spreadsheet.mjs",
    "handlers.mjs",
  ];

  try {
    // すべてのファイルが存在するか確認
    for (const file of sourceFiles) {
      if (!fs.existsSync(file)) {
        throw new Error(`ファイル ${file} が見つかりません。`);
      }
    }

    // 古いZIPファイルがあれば削除
    if (fs.existsSync("function.zip")) {
      fs.unlinkSync("function.zip");
      console.log("古いZIPファイルを削除しました。");
    }

    // ZIPファイルを作成
    const filesToZip = [...sourceFiles, "node_modules"].join(" ");
    await execPromise(`zip -r function.zip ${filesToZip}`);
    console.log("ZIPファイルを作成しました。");

    console.log("ビルドが完了しました。");
  } catch (error) {
    console.error("ビルドエラー:", error);
    process.exit(1);
  }
}

// スクリプトが直接実行された場合にのみビルドを実行
if (process.argv[1] === new URL(import.meta.url).pathname) {
  build();
}

export default build;
