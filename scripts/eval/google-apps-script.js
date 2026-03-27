/**
 * Google Apps Script for Storybook Setup Evaluations
 *
 * Instructions:
 * 1. Create a new Google Sheet for eval results
 * 2. Go to Extensions > Apps Script
 * 3. Replace the contents with this code
 * 4. Click "Deploy" > "New deployment"
 * 5. Select type: "Web app"
 * 6. Execute as: "Me"
 * 7. Who has access: "Anyone"
 * 8. Click "Deploy" and copy the web app URL
 * 9. Set EVAL_GOOGLE_SHEETS_URL=<url> in your environment
 *
 * Authorization:
 * Run authorize() from the editor to trigger the authorization prompt.
 * Click "Review Permissions" → Select account → "Advanced" → "Go to [project] (unsafe)" → "Allow"
 */

function toTitleCase(key) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

function ensureHeaders(sheet, keys) {
  const firstHeaderCell = sheet.getRange(1, 1).getValue();
  if (firstHeaderCell === "") {
    const headers = keys.map(toTitleCase);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  }
}

function appendRow(sheet, keys, rowData) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(120000);
    var lastRow = sheet.getLastRow();
    var targetRow = lastRow < 1 ? 2 : lastRow + 1;
    sheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
    SpreadsheetApp.flush();
    return targetRow;
  } finally {
    lock.releaseLock();
  }
}

function prepareRowData(keys, data) {
  return keys.map(function (key) {
    var value = data[key];
    if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
    if (value === null || value === undefined) return "";
    return value;
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var keys = Object.keys(data);
    var rowData = prepareRowData(keys, data);

    ensureHeaders(sheet, keys);
    var targetRow = appendRow(sheet, keys, rowData);

    return ContentService.createTextOutput(
      JSON.stringify({ success: true, row: targetRow }),
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: error.toString() }),
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function authorize() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var file = DriveApp.getFileById(spreadsheet.getId());
  console.log("Authorized! File:", file.getName());
}
