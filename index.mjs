/* global fetch */

import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { SSMClient, GetParametersCommand } from "@aws-sdk/client-ssm";
import { simpleParser } from "mailparser";
import OpenAI from "openai";
import { google } from "googleapis";
import { GoogleAuth } from "google-auth-library";
import path from "path";
import crypto from "crypto";
import querystring from "querystring";

const YOIN = "要員";
const ANKEN = "案件";

const SPREADSHEET_ID = "1qwV_yNutfk7QpKQ2qQPRQx7wym0u4px5h5dIqDacy4s";

// 添付ファイル関連の設定
const ATTACHMENT_PREFIX = "attachments/";
const REGION = "ap-northeast-1";
const OFFICE_VIEWER_URL = "https://view.officeapps.live.com/op/view.aspx?src=";
const SUPPORTED_EXTENSIONS = [
  ".xlsx",
  ".xls",
  ".docx",
  ".doc",
  ".pptx",
  ".ppt",
  ".pdf",
];

let keys = undefined;
const s3Client = new S3Client({ region: REGION });
const ssmClient = new SSMClient({ region: REGION });
let openAIClient = undefined;
let spreadsheetClient = undefined;
let fileUrl = undefined;

export const handler = async (event, context) => {
  await init();

  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(
    event.Records[0].s3.object.key.replace(/\+/g, " ")
  );
  fileUrl = `https://${bucket}.s3.${REGION}.amazonaws.com/${key}`;
  console.log(`handling object = ${key}, bucket = ${bucket}`);

  try {
    const mail = await getMail(bucket, key);
    console.log(`subject: ${mail.subject}`);

    // メールの添付ファイルを処理
    const attachmentUrls = await processAttachments(bucket, mail);
    console.log(`Processed ${attachmentUrls.length} attachments`);

    const classification = await predictClassification(mail.subject);
    console.log(`predicted classification: ${classification}`);

    await handleClassification(classification, mail, attachmentUrls);
  } catch (err) {
    const message = `Error: object = ${key}, bucket = ${bucket} err = ${err}`;
    console.log(message);
    throw new Error(message);
  }
};

// メールから添付ファイルを抽出し、Office Web ViewerのURLを生成する関数
const processAttachments = async (bucket, mail) => {
  const attachmentUrls = [];

  if (mail.attachments && mail.attachments.length > 0) {
    console.log(`Found ${mail.attachments.length} attachments in email`);

    for (const attachment of mail.attachments) {
      try {
        const filename = attachment.filename;
        const extension = path.extname(filename).toLowerCase();

        // サポートされている拡張子かチェック
        if (SUPPORTED_EXTENSIONS.includes(extension)) {
          console.log(`Processing supported attachment: ${filename}`);

          // S3に保存するためのユニークなキーを生成
          const timestamp = new Date().getTime();
          const randomStr = crypto.randomBytes(8).toString("hex");
          const s3Key = `${ATTACHMENT_PREFIX}${timestamp}_${randomStr}_${filename}`;

          // S3に添付ファイルを保存
          await s3Client.send(
            new PutObjectCommand({
              Bucket: bucket,
              Key: s3Key,
              Body: attachment.content,
              ContentType: attachment.contentType || "application/octet-stream",
            })
          );

          // 署名付きURLを生成（1週間有効）
          const command = new GetObjectCommand({
            Bucket: bucket,
            Key: s3Key,
          });

          const signedUrl = await getSignedUrl(s3Client, command, {
            expiresIn: 604800,
          }); // 7日間 = 604800秒

          // Office Web ViewerのURLを生成
          const encodedUrl = encodeURIComponent(signedUrl);
          const officeViewerUrl = `${OFFICE_VIEWER_URL}${encodedUrl}`;

          attachmentUrls.push({
            filename,
            contentType: attachment.contentType,
            size: attachment.size,
            s3Key,
            signedUrl,
            officeViewerUrl,
          });

          console.log(`Generated Office Web Viewer URL for ${filename}`);
        } else {
          console.log(`Skipping unsupported attachment: ${filename}`);
        }
      } catch (error) {
        console.error(`Error processing attachment: ${error}`);
      }
    }
  }

  return attachmentUrls;
};

const init = async () => {
  try {
    await getKeys();
    await getOpenAIClient();
    await getSpreadsheetClient();
  } catch (err) {
    console.log(err);
    const message = `Error: failed to initialize, err = ${err}`;
    console.log(message);
    throw new Error(message);
  }
};

const getKeys = async () => {
  if (keys === undefined) {
    try {
      const response = await ssmClient.send(
        new GetParametersCommand({
          Names: ["openai-key", "make-key", "spreadsheets-credentials"],
          WithDecryption: true,
        })
      );
      keys = response.Parameters.reduce((acc, parameter) => {
        acc[parameter.Name] =
          parameter.Name === "spreadsheets-credentials"
            ? JSON.parse(parameter.Value)
            : parameter.Value;
        return acc;
      }, {});
    } catch (err) {
      console.log(err);
      const message = `Error: failed to get parameters. err = ${err}`;
      console.log(message);
      throw new Error(message);
    }
  }
  return keys;
};

const getMail = async (bucket, key) => {
  try {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
    const body = await response.Body.transformToString();
    const parsed = await simpleParser(body);

    return parsed;
  } catch (err) {
    console.log(err);
    const message = `Error: failed to get/parse object = ${key}, bucket = ${bucket} err = ${err}`;
    console.log(message);
    throw new Error(message);
  }
};

const predictClassification = async (subject) => {
  try {
    const chatCompletion = await openAIClient.chat.completions.create({
      messages: [
        {
          role: "assistant",
          content: `あなたは送られてきたメールの件名を見て、「案件の情報」か「要員の情報」かを判別して仕分けするアシスタントです。

プロンプトの後に入力するメールの件名を読み取り、続くルールに則って仕分けして最終出力フォーマットに出力してください。

# 参考情報
・「要員」はエンジニアの紹介で、「案件」はエンジニアが働く現場での求人情報です。
・「案件」メールは要員を募集する目的で送信されています。
・「要員」メールはエンジニアが案件を探す目的で送信されています。

# 例

## 案件の例
【エンド直 / 複数名募集】フロントエンドエンジニア / フルリモート（全国勤務可）/ 転職・採用支援サービスのフロントエンドエンジニア
【swiftフルリモ案件/即日】swift 4年/基本設計〜

## 要員の例
【ネイティブアプリスペシャリスト（歴10年）/即日】リーダー◎/要件定義/顧客折衝◎/Swift/Kotlin
案件ください！！【弊社社員/8月〜/React・Next/基本設計〜運用・保守】AR（28歳・女性・戸田）

# 仕分け方法
出力の{classification}の値を下記のように代入します。

案件の場合: 案件
要員の場合: 要員
要員でも案件でもない場合: 不明

# 出力フォーマット（JSONファイルとして出力してください）
{
"classification" : "{classification}"
}

# メールの件名

${subject}`,
        },
      ],
      model: "gpt-4o-mini",
    });
    const response = chatCompletion.choices[0].message.content;
    return JSON.parse(response).classification;
  } catch (err) {
    console.log(err);
    const message = `Error: failed to predict classification, subject = ${subject} err = ${err}`;
    console.log(message);
    throw new Error(message);
  }
};

const handleClassification = async (classification, mail, attachmentUrls) => {
  switch (classification) {
    case YOIN:
      return await handleYoinClassification(mail, attachmentUrls);
    case ANKEN:
      return await handleAnkenClassification(mail, attachmentUrls);
    default:
      console.log(
        `other classification = ${classification}, subject = ${mail.subject}`
      );
  }
};

const handleAnkenClassification = async (mail, attachmentUrls) => {
  const anken = await summarizeAnken(
    mail.subject,
    mail.text,
    mail.from.value[0].address,
    mail.to.value[0].address
  );
  console.log(`anken summary: ${JSON.stringify(anken)}`);
  await postAnken(anken, mail, attachmentUrls);
  await appendToSpreadsheet(SPREADSHEET_ID, "案件!A2:A", [
    [
      mail.date,
      anken.reward,
      anken.location,
      anken.start_time,
      anken.remote,
      anken.domain,
      anken.email,
      anken.age,
      anken.subject,
      attachmentUrls.length > 0 ? "あり" : "なし",
    ],
  ]);
  return anken;
};

const handleYoinClassification = async (mail, attachmentUrls) => {
  const yoin = await summarizeYoin(
    mail.subject,
    mail.text,
    mail.from.value[0].address,
    mail.to.value[0].address
  );
  console.log(`yoin summary: ${JSON.stringify(yoin)}`);
  await postYoin(yoin, mail, attachmentUrls);
  await appendToSpreadsheet(SPREADSHEET_ID, "要員!A2:A", [
    [
      mail.date,
      yoin.reward,
      yoin.location,
      yoin.start_time,
      yoin.domain,
      yoin.email,
      yoin.remote,
      yoin.age,
      yoin.subject,
      attachmentUrls.length > 0 ? "あり" : "なし",
    ],
  ]);
  return yoin;
};

const summarizeYoin = async (subject, text, from, to) => {
  try {
    const chatCompletion = await openAIClient.chat.completions.create({
      response_format: {
        type: "json_object",
      },
      messages: [
        {
          role: "assistant",
          content: `あなたは要員の情報を読み取り必要な情報をJSONファイルへ変換するアシスタントです。
プロンプトの後に入力するメールの本文等の参考情報を読み取り、続くルールに則って仕分けして最終出力フォーマットに出力してください。

#用意してほしい変数
*{subject}
*{email}
*{remote}
*{date_and_time}
*{location}
*{start_time}
*{reward}
*{age}
*{domain}

#各種ルール
*{subject}は、${subject}を入力してください。
*{email}は、${from}を入力してください。
*{remote}は、メールの本文から要員がリモート勤務に対してどのような希望を持っているか読み取って"常駐可能"か"基本リモート"か"一部リモート"か"フルリモート"のいずれかの文字を入力してください。
*{location}は、メールの本文からエンジニアの最寄駅を読み取って駅名や地域を入力してください。
*{start_time}は、メールの本文から稼働の開始時期を入力してください。
*{reward}は、メールの本文から希望の報酬額を読み取り「万円」単位で表示した際の数字部分のみを2桁か3桁で入力してください（例：450,000円は45、1,000,000円は100）。範囲指定されている場合は、下限の金額のみを入力してください（例：40〜50万円は、40）。
*{age}は、メールの本文からエンジニアの年齢を読み取って入力してください。
*{domain}には${to} のうち@より後の部分を表示してください。

# 最終出力フォーマットは下記をvalidなJSONとして出力してください。「json」という文字は絶対に出力しないでください。
{
"subject" : "{subject}",
"email" : "{email}",
"remote" : "{remote}",
"date_and_time" : "{date_and_time}",
"location" : "{location}",
"start_time" : "{start_time}",
"reward" : "{reward}",
"age" : "{age}",
"domain":"{domain}"
}

#参考情報
メールの件名：${subject}
メールの内容：${text}
メールの送信元：${from}
メールの送信先：${to}`,
        },
      ],
      model: "gpt-4o-mini",
    });
    const response = chatCompletion.choices[0].message.content;
    console.log(`response: ${response}`);
    return JSON.parse(response);
  } catch (err) {
    console.log(err);
    const message = `Error: failed to summarize yoin, subject = ${subject}, text = ${text}, from = ${from}, to = ${to}, err = ${err}`;
    console.log(message);
    throw new Error(message);
  }
};

const summarizeAnken = async (subject, text, from, to) => {
  try {
    const chatCompletion = await openAIClient.chat.completions.create({
      response_format: {
        type: "json_object",
      },
      messages: [
        {
          role: "assistant",
          content: `あなたは案件の情報を読み取り必要な情報をJSONファイルへ変換するアシスタントです。
プロンプトの後に入力するメールの本文等の参考情報を読み取り、続くルールに則って仕分けして最終出力フォーマットに出力してください。

#用意してほしい変数
*{subject}
*{email}
*{remote}
*{date_and_time}
*{location}
*{start_time}
*{reward}
*{age}
*{domain}

#各種ルール
*{subject}は、${subject}を入力してください。
*{email}は、${from}を入力してください。
*{remote}は、メールの本文から案件情報を読み取り、リモート勤務に対してどのような要請のある案件かを読み取って"常駐"か"基本リモート"か"一部リモート"か"フルリモート"のいずれかの文字を入力してください。
*{location}は、メールの本文から案件の稼働現場を読み取って駅名や地域を入力してください。
*{start_time}は、メールの本文から稼働の開始時期を入力してください。
**{reward}は、メールの本文から希望の報酬額を読み取り「万円」単位で表示した際の数字部分のみを2桁か3桁で入力してください（例：450,000円は45、1,000,000円は100）。範囲指定されている場合は、上限の金額のみを入力してください（例：40〜50万円は、50）。
*{age}は、メールの本文から募集しているエンジニアの年齢制限を読み取って入力してください。
*{domain}には${to} のうち@より後の部分を表示してください。

# 最終出力フォーマットは下記をvalidなJSONとして出力してください。「json」という文字は絶対に出力しないでください。
{
"subject" : "{subject}",
"email" : "{email}",
"remote" : "{remote}",
"date_and_time" : "{date_and_time}",
"location" : "{location}",
"start_time" : "{start_time}",
"reward" : "{reward}",
"age" : "{age}",
"domain":"{domain}"
}

#参考情報
メールの件名：${subject}
メールの内容：${text}
メールの送信元：${from}
メールの送信先：${to}`,
        },
      ],
      model: "gpt-4o-mini",
    });
    const response = chatCompletion.choices[0].message.content;
    console.log(`response: ${response}`);
    return JSON.parse(response);
  } catch (err) {
    console.log(err);
    const message = `Error: failed to summarize anken, subject = ${subject}, text = ${text}, from = ${from}, to = ${to}, err = ${err}`;
    console.log(message);
    throw new Error(message);
  }
};

const getOpenAIClient = async () => {
  try {
    if (openAIClient === undefined) {
      openAIClient = new OpenAI({
        apiKey: keys["openai-key"],
      });
    }
    return openAIClient;
  } catch (err) {
    console.log(err);
    const message = `Error: failed to get OpenAI Client, err = ${err}`;
    console.log(message);
    throw new Error(message);
  }
};

const getSpreadsheetClient = async () => {
  try {
    if (spreadsheetClient === undefined) {
      const auth = new GoogleAuth({
        credentials: keys["spreadsheets-credentials"],
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });
      spreadsheetClient = google.sheets({ version: "v4", auth });
    }
    return spreadsheetClient;
  } catch (err) {
    console.log(err);
    const message = `Error: failed to get spreadsheet Client, err = ${err}`;
    console.log(message);
    throw new Error(message);
  }
};

const post = async (url, data) => {
  return await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${keys["make-key"]}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
};

const postYoin = async (summary, mail, attachmentUrls = []) => {
  return await post(
    "https://app.saitekiinc.com/version-test/api/1.1/obj/要員情報",
    {
      報酬: summary.reward,
      場所: summary.location,
      本文: mail.text || mail.textAsHtml,
      開始時期: summary.start_time,
      メール受信日時: mail.date,
      送信先ドメイン名: summary.domain,
      メールアドレス: summary.email,
      リモート可否: summary.remote,
      年齢制限: summary.age,
      件名: summary.subject,
      メールurl: fileUrl,
      添付ファイル数: attachmentUrls.length,
      添付ファイル情報:
        attachmentUrls.length > 0
          ? JSON.stringify(
              attachmentUrls.map((a) => ({
                filename: a.filename,
                officeViewerUrl: a.officeViewerUrl,
              }))
            )
          : null,
    }
  );
};

const postAnken = async (summary, mail, attachmentUrls = []) => {
  return await post(
    "https://app.saitekiinc.com/version-test/api/1.1/obj/案件情報",
    {
      報酬: summary.reward,
      場所: summary.location,
      本文: mail.text || mail.textAsHtml,
      開始時期: summary.start_time,
      リモート可否: summary.remote,
      メール受信日時: mail.date,
      送信先ドメイン名: summary.domain,
      メールアドレス: summary.email,
      年齢制限: summary.age,
      件名: summary.subject,
      メールurl: fileUrl,
      添付ファイル数: attachmentUrls.length,
      添付ファイル情報:
        attachmentUrls.length > 0
          ? JSON.stringify(
              attachmentUrls.map((a) => ({
                filename: a.filename,
                officeViewerUrl: a.officeViewerUrl,
              }))
            )
          : null,
    }
  );
};

const appendToSpreadsheet = async (spreadsheetId, range, values) => {
  return await spreadsheetClient.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values,
    },
  });
};
