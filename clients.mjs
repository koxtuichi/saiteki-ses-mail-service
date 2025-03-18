import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { SSMClient, GetParametersCommand } from "@aws-sdk/client-ssm";
import OpenAI from "openai";
import { google } from "googleapis";
import { GoogleAuth } from "google-auth-library";

// クライアントとキーの初期化
let keys = undefined;
const s3Client = new S3Client();
const ssmClient = new SSMClient();
let openAIClient = undefined;
let spreadsheetClient = undefined;

// キーの取得
export const getKeys = async () => {
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

// S3からメールを取得
export const getMail = async (bucket, key) => {
  try {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
    const body = await response.Body.transformToString();
    const { simpleParser } = await import("mailparser");
    const parsed = await simpleParser(body);

    return parsed;
  } catch (err) {
    console.log(err);
    const message = `Error: failed to get/parse object = ${key}, bucket = ${bucket} err = ${err}`;
    console.log(message);
    throw new Error(message);
  }
};

// OpenAIクライアントの初期化と取得
export const getOpenAIClient = async () => {
  try {
    if (openAIClient === undefined) {
      await getKeys();
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

// Google Spreadsheetクライアントの初期化と取得
export const getSpreadsheetClient = async () => {
  try {
    if (spreadsheetClient === undefined) {
      await getKeys();
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

// Make.comのAPIキーを取得
export const getMakeKey = async () => {
  await getKeys();
  return keys["make-key"];
};
