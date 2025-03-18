import { getSpreadsheetClient } from "./clients.mjs";

// スプレッドシートにデータを追加する
export const appendToSpreadsheet = async (spreadsheetId, range, values) => {
  const spreadsheetClient = await getSpreadsheetClient();
  return await spreadsheetClient.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values,
    },
  });
};
