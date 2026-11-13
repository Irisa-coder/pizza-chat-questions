import { strToU8, zipSync } from "fflate";
import { TOPPINGS, localTime, type Question } from "./event";

const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const worksheetNs = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const relationshipNs = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const packageNs = "http://schemas.openxmlformats.org/package/2006/relationships";

function escapeXml(text: string) {
  return Array.from(text.replace(/[<>&"'\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, char => {
    const escaped: Record<string, string> = { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" };
    return escaped[char] ?? "";
  })).join("");
}

export function questionsWorkbook(questions: Question[]) {
  const table = [
    ["序号", "问题原文", "提交时间（北京时间）", "同意整理到知乎", "披萨口味"],
    ...questions.map(q => [
      String(q.id), q.question, localTime(q.createdAt, true), q.allowShare ? "是" : "否", TOPPINGS[q.topping].name,
    ]),
  ];
  const rows = table.map((row, index) => {
    const number = index + 1;
    const cells = row.map((value, column) =>
      '<c r="' + "ABCDE"[column] + number + '" t="inlineStr"><is><t xml:space="preserve">' + escapeXml(value) + "</t></is></c>",
    ).join("");
    return '<row r="' + number + '">' + cells + "</row>";
  }).join("");
  const entries: Record<string, string> = {
    "[Content_Types].xml": xml + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    "_rels/.rels": xml + '<Relationships xmlns="' + packageNs + '"><Relationship Id="rId1" Type="' +
      relationshipNs + '/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    "xl/workbook.xml": xml + '<workbook xmlns="' + worksheetNs + '" xmlns:r="' + relationshipNs +
      '"><sheets><sheet name="Pizza Chat 投稿" sheetId="1" r:id="rId1"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels": xml + '<Relationships xmlns="' + packageNs + '"><Relationship Id="rId1" Type="' +
      relationshipNs + '/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    "xl/worksheets/sheet1.xml": xml + '<worksheet xmlns="' + worksheetNs + '">' +
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
      '<cols><col min="1" max="1" width="10" customWidth="1"/><col min="2" max="2" width="76" customWidth="1"/>' +
      '<col min="3" max="5" width="22" customWidth="1"/></cols><sheetData>' + rows + '</sheetData>' +
      '<autoFilter ref="A1:E' + table.length + '"/></worksheet>',
  };
  return zipSync(Object.fromEntries(Object.entries(entries).map(([key, value]) => [key, strToU8(value)])));
}
