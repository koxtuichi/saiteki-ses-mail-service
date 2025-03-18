import { ANKEN, SPREADSHEET_ID, YOIN } from "./config.mjs";
import { summarizeAnken, summarizeYoin } from "./ai.mjs";
import { postAnken, postYoin } from "./api.mjs";
import { appendToSpreadsheet } from "./spreadsheet.mjs";

// 分類に基づいてメールを処理する
export const handleClassification = async (classification, mail, fileUrl) => {
  switch (classification) {
    case YOIN:
      return await handleYoinClassification(mail, fileUrl);
    case ANKEN:
      return await handleAnkenClassification(mail);
    default:
      console.log(
        `other classification = ${classification}, subject = ${mail.subject}`
      );
  }
};

// 要員情報を処理する
const handleYoinClassification = async (mail, fileUrl) => {
  const yoin = await summarizeYoin(
    mail.subject,
    mail.text,
    mail.from.value[0].address,
    mail.to.value[0].address
  );
  console.log(`yoin summary: ${JSON.stringify(yoin)}`);
  await postYoin(yoin, mail, fileUrl);
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
    ],
  ]);
  return yoin;
};

// 案件情報を処理する
const handleAnkenClassification = async (mail) => {
  const anken = await summarizeAnken(
    mail.subject,
    mail.text,
    mail.from.value[0].address,
    mail.to.value[0].address
  );
  console.log(`anken summary: ${JSON.stringify(anken)}`);
  await postAnken(anken, mail);
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
    ],
  ]);
  return anken;
};
