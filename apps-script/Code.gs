/**
 * Kakoomay – zentrale Bestenliste (Google Apps Script)
 *
 * Dieses Skript gehört in ein Google Sheet (Erweiterungen > Apps Script).
 * Es speichert die Ergebnisse in einem Tabellenblatt namens "Scores".
 * Verwalten kannst du die Bestenliste direkt in der Tabelle:
 *   - Zeile löschen        = Eintrag ist weg
 *   - Spalte "gesperrt" = TRUE  = Eintrag wird nicht mehr angezeigt (bleibt aber in der Tabelle)
 *
 * Spalten: id | zeitpunkt | rechenart | modus | stufe | kuerzel | zeit_ms | fehler | gesperrt
 *   rechenart: add oder mul      modus: solo (Einzelrunde) oder chain (Puzzle)
 *   stufe: 0 = Stufe 1, 1 = Stufe 2, ...  (Zufallsmix ist die letzte Stufe)
 *   zeit_ms: Zeit inklusive 3 Sekunden Strafe pro Fehler, in Millisekunden
 */

var SHEET_NAME = "Scores";
var HEADER = ["id", "zeitpunkt", "rechenart", "modus", "stufe", "kuerzel", "zeit_ms", "fehler", "gesperrt"];

// Diese Kürzel werden automatisch gesperrt (Spalte "gesperrt" = TRUE). Liste nach Bedarf ändern.
var BLOCKED = ["SEX", "ARS", "NAZ", "KKK", "FCK", "WTF"];

// Plausible Zeiten (Millisekunden). Alles außerhalb wird abgelehnt.
var MIN_MS = 2000;
var MAX_MS = 3600000;

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADER);
    sh.setFrozenRows(1);
    sh.getRange("A:A").setNumberFormat("@"); // id als Text
    sh.getRange("F:F").setNumberFormat("@"); // Kürzel als Text, damit "007" nicht zu 7 wird
  }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function validKey_(op, bm, lv) {
  return (op === "add" || op === "mul") && (bm === "solo" || bm === "chain") && /^[0-9]$/.test(lv);
}

// Bestenliste abrufen:  ...?op=add&bm=solo&lv=1
function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    var op = String(p.op || ""), bm = String(p.bm || ""), lv = String(p.lv || "");
    if (!validKey_(op, bm, lv)) return json_({ ok: false, error: "bad request" });
    var rows = sheet_().getDataRange().getValues();
    var list = [];
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      if (String(r[2]) === op && String(r[3]) === bm && String(r[4]) === lv &&
          String(r[8]).toUpperCase() !== "TRUE") {
        list.push({ id: String(r[0]), n: String(r[5]), t: Number(r[6]), m: Number(r[7]), row: i });
      }
    }
    list.sort(function (a, b) { return (a.t - b.t) || (a.row - b.row); });
    list = list.slice(0, 10).map(function (x) { return { id: x.id, n: x.n, t: x.t, m: x.m }; });
    return json_({ ok: true, list: list });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// Ergebnis speichern (JSON im Body)
function doPost(e) {
  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    var d = JSON.parse(e.postData.contents);
    var op = String(d.op), bm = String(d.bm), lv = String(d.lv);
    var id = String(d.id || "");
    var n = String(d.n || "").toUpperCase();
    var t = Math.round(Number(d.t)), m = Math.round(Number(d.m));
    if (!validKey_(op, bm, lv) || !/^[A-Z0-9ÄÖÜ]{3}$/.test(n) || !/^[a-z0-9]{4,40}$/.test(id) ||
        !(t >= MIN_MS && t <= MAX_MS) || !(m >= 0 && m <= 99)) {
      return json_({ ok: false, error: "invalid data" });
    }
    lock.waitLock(10000);
    locked = true;
    var sh = sheet_();
    var rows = sh.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === id) return json_({ ok: true, duplicate: true }); // schon gespeichert
    }
    sh.appendRow([id, new Date(), op, bm, lv, n, t, m, BLOCKED.indexOf(n) >= 0 ? "TRUE" : ""]);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    if (locked) { try { lock.releaseLock(); } catch (x) {} }
  }
}
