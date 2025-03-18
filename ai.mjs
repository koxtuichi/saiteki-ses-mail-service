import { getOpenAIClient } from "./clients.mjs";

// メールの件名から分類を予測する
export const predictClassification = async (subject) => {
  try {
    const openAIClient = await getOpenAIClient();
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

// 要員情報を要約する
export const summarizeYoin = async (subject, text, from, to) => {
  try {
    const openAIClient = await getOpenAIClient();
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

// 案件情報を要約する
export const summarizeAnken = async (subject, text, from, to) => {
  try {
    const openAIClient = await getOpenAIClient();
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
