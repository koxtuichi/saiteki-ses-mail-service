import { API_ANKEN_URL, API_YOIN_URL } from "./config.mjs";
import { getMakeKey } from "./clients.mjs";

// Make.comのAPIにデータをPOSTする
export const post = async (url, data) => {
  const makeKey = await getMakeKey();
  return await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${makeKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
};

// 要員情報をAPIに送信する
export const postYoin = async (summary, mail, fileUrl) => {
  return await post(API_YOIN_URL, {
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
  });
};

// 案件情報をAPIに送信する
export const postAnken = async (summary, mail) => {
  return await post(API_ANKEN_URL, {
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
  });
};
