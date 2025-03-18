/* global fetch */

import { getMail } from "./clients.mjs";
import { predictClassification } from "./ai.mjs";
import { handleClassification } from "./handlers.mjs";

// Lambda関数のエントリーポイント
export const handler = async (event, context) => {
  try {
    // S3オブジェクト情報を取得
    const bucket = event.Records[0].s3.bucket.name;
    const key = decodeURIComponent(
      event.Records[0].s3.object.key.replace(/\+/g, " ")
    );
    const fileUrl =
      "https://saiteki-email.s3.ap-northeast-1.amazonaws.com/" + key;
    console.log(`handling object = ${key}, bucket = ${bucket}`);

    // メールを取得して処理
    const mail = await getMail(bucket, key);
    console.log(`subject: ${mail.subject}`);

    // メールの分類を予測
    const classification = await predictClassification(mail.subject);
    console.log(`predicted classification: ${classification}`);

    // 分類に基づいて処理
    await handleClassification(classification, mail, fileUrl);
  } catch (err) {
    const message = `Error: object = ${event?.Records?.[0]?.s3?.object?.key}, bucket = ${event?.Records?.[0]?.s3?.bucket?.name} err = ${err}`;
    console.log(message);
    throw new Error(message);
  }
};
