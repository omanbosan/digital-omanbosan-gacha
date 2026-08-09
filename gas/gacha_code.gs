// ============================================================
//  おまんぼガチャ — 専用バックエンド (GAS)
//  marche-system(受注管理システム)とは完全に独立したプロジェクト。
//
//  ・ポイントの記録、抽選（何等が当たるか）、1日の残り回数チェックは
//    すべてこのサーバー側で行う。クライアントは結果を自己申告できない。
//  ・データ保存先のスプレッドシートは初回アクセス時に自動作成し、
//    Script Properties に SPREADSHEET_ID を保存して以後使い回す。
//  ・管理者画面はパスワードではなく「ログイン中のGoogleアカウント」で判定する。
//    このデプロイは2種類のURLで公開する:
//      1) 公開用(誰でもアクセス可・Googleログイン不要) → お客様のガチャ本体から呼ぶ
//      2) 管理者用(Googleアカウントでのログインが必須) → gacha_v18.htmlではなく、
//         このURLを直接ブラウザで開くと管理画面(HTML)が表示される。
//    2)のURLでアクセスした場合のみ Session.getActiveUser().getEmail() で
//    ログイン中のメールアドレスが取得できる仕様を利用している
//    （1)の匿名アクセスでは常に空文字になるため、自然にアクセス不可になる）。
// ============================================================

// 管理画面へのアクセスを許可するGoogleアカウント一覧は、コード直書きではなく
// スプレッドシートの admin_users シートで管理する（初回だけこの値で自動登録する）。
const GACHA_ADMIN_EMAILS_SEED = ['omanbosan.lv@gmail.com'];
const GACHA_ADMIN_SHEET_NAME = 'admin_users';

const GACHA_BONUS_WORD = 'おまんぼ';
const GACHA_FORTUNES = [
  { key:'daigichi', pt:300, weight:10  },
  { key:'kichi',    pt:100, weight:50  },
  { key:'chukichi', pt:10,  weight:100 },
  { key:'shokichi', pt:5,   weight:150 },
  { key:'suekichi', pt:3,   weight:200 },
  { key:'kyo',      pt:1,   weight:490 },
];
// 列: id, code, points, createdAt, updatedAt, usedDate, usedToday, bonusUsed
const GACHA_HEADERS = ['id','code','points','createdAt','updatedAt','usedDate','usedToday','bonusUsed'];
const GACHA_SHEET_NAME = 'gacha_points';

function ok(data) {
  const o = ContentService.createTextOutput(JSON.stringify({ ok: true, data: data }));
  o.setMimeType(ContentService.MimeType.JSON);
  return o;
}
function err(msg, extra) {
  var payload = { ok: false, error: msg };
  if (extra) { for (var k in extra) payload[k] = extra[k]; }
  const o = ContentService.createTextOutput(JSON.stringify(payload));
  o.setMimeType(ContentService.MimeType.JSON);
  return o;
}

// ============================================================
//  エントリポイント
// ============================================================
function doGet(e) {
  try {
    const action = e.parameter.action || '';

    // action指定が無ければ「管理画面」を返す。
    // 公開デプロイ(匿名アクセス)でこの分岐に来ても、admin.html側の
    // google.script.run呼び出しがisAdminUser()で弾かれるだけで実害はない。
    if (!action) {
      // QRスキャン機能(getUserMedia)がGoogle標準のIFRAMEサンドボックス内だと
      // カメラ権限を委譲されずNotAllowedErrorになるため、ALLOWALLで生ページとして返す。
      return HtmlService.createHtmlOutputFromFile('admin')
        .setTitle('おまんぼガチャ 管理')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    var data = {};
    try { data = JSON.parse(e.parameter.d || '{}'); } catch(ex) { data = {}; }

    switch (action) {
      case 'ping':            return ok({ pong: true });
      case 'gachaRegister':   return handleGachaRegister(data);
      case 'gachaSync':       return handleGachaSync(data);
      case 'gachaSpin':       return handleGachaSpin(data);
      case 'gachaBonus':      return handleGachaBonus(data);
      default:                return err('Unknown action: ' + action);
    }
  } catch(ex) {
    return err(ex.toString());
  }
}

function doPost(e) { return err('GETを使用してください'); }

// ============================================================
//  認証（パスワードではなく、ログイン中のGoogleアカウントで判定）
// ============================================================
function ensureGachaAdminUsersSheet() {
  const ss = getSpreadsheet();
  var sh = ss.getSheetByName(GACHA_ADMIN_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(GACHA_ADMIN_SHEET_NAME);
    sh.getRange(1,1,1,2).setValues([['email','note']]);
    sh.getRange(1,1,1,2).setBackground('#1a1a2e').setFontColor('#c8a84a').setFontWeight('bold');
    sh.setFrozenRows(1);
    GACHA_ADMIN_EMAILS_SEED.forEach(function(email) { sh.appendRow([email, '初期登録']); });
  }
  return sh;
}

// admin_users シートのemail列を読み、許可されたGoogleアカウント一覧を返す
function getAllowedGachaAdminEmails() {
  const sh = ensureGachaAdminUsersSheet();
  const rows = sh.getDataRange().getValues();
  var emails = [];
  for (var i = 1; i < rows.length; i++) {
    var email = (rows[i][0] || '').toString().trim().toLowerCase();
    if (email) emails.push(email);
  }
  return emails;
}

function isAdminUser() {
  var email = (Session.getActiveUser().getEmail() || '').toLowerCase();
  return !!email && getAllowedGachaAdminEmails().indexOf(email) !== -1;
}

function getCurrentUserEmail() {
  return Session.getActiveUser().getEmail() || '';
}

// admin.html（HTML Service）から google.script.run 経由で呼ばれる関数。
// 生のJSON APIとしては公開しない（doGetのswitchに載せない）ことで、
// 匿名デプロイ経由での呼び出し自体をそもそも不可能にしている。
function getGachaStatsForAdmin() {
  if (!isAdminUser()) throw new Error('このアカウント(' + (getCurrentUserEmail() || '未ログイン') + ')には権限がありません');
  var parsed = JSON.parse(handleGachaStats().getContent());
  return parsed.data;
}
function getGachaLookupForAdmin(code) {
  if (!isAdminUser()) throw new Error('このアカウント(' + (getCurrentUserEmail() || '未ログイン') + ')には権限がありません');
  var parsed = JSON.parse(handleGachaLookup({ code: code }).getContent());
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.data;
}
// マルシェ現地でのクーポン利用（ポイント消費）。1pt=1円、100pt単位でのみ実行可能。
// 生のJSON APIとしては公開せず、管理画面(要Googleログイン)からのみ呼べるようにする。
function redeemGachaPointsForAdmin(code, amount) {
  if (!isAdminUser()) throw new Error('このアカウント(' + (getCurrentUserEmail() || '未ログイン') + ')には権限がありません');
  var parsed = JSON.parse(handleGachaRedeem({ code: code, amount: amount, staffEmail: getCurrentUserEmail() }).getContent());
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.data;
}

// ============================================================
//  スプレッドシート（初回アクセス時に自動作成）
// ============================================================
function getSpreadsheet() {
  const props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SPREADSHEET_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch(e) { /* IDが無効なら作り直す */ }
  }
  var ss = SpreadsheetApp.create('おまんぼガチャ 台帳');
  props.setProperty('SPREADSHEET_ID', ss.getId());
  return ss;
}

function ensureGachaSheet() {
  const ss = getSpreadsheet();
  var sh = ss.getSheetByName(GACHA_SHEET_NAME);
  if (!sh) {
    var sheets = ss.getSheets();
    // 新規作成直後で「空のデフォルトシートが1枚だけ」ならリネームして使う
    if (sheets.length === 1 && sheets[0].getLastRow() === 0) {
      sh = sheets[0];
      sh.setName(GACHA_SHEET_NAME);
    } else {
      sh = ss.insertSheet(GACHA_SHEET_NAME);
    }
    sh.getRange(1,1,1,GACHA_HEADERS.length).setValues([GACHA_HEADERS]);
    sh.getRange(1,1,1,GACHA_HEADERS.length).setBackground('#1a1a2e').setFontColor('#c8a84a').setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function todayJST() {
  return Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
}

function genGachaCode(sh) {
  // 紛らわしい文字(0/O, 1/I/L)を除いた6桁コード。重複時のみ再生成。
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const existing = sh.getLastRow() > 1
    ? sh.getRange(2,2,sh.getLastRow()-1,1).getValues().map(function(r){ return r[0]; })
    : [];
  for (var attempt = 0; attempt < 20; attempt++) {
    var code = '';
    for (var i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random()*chars.length));
    if (existing.indexOf(code) === -1) return code;
  }
  return Utilities.getUuid().slice(0,6).toUpperCase();
}

// id に対応する行を取得。無ければ0ポイントで新規作成。
// 日付が変わっていれば usedToday/bonusUsed を自動リセットしてシートにも反映する。
function getOrCreateGachaRow(sh, id) {
  const rows = sh.getDataRange().getValues();
  const today = todayJST();

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) {
      var usedDate  = rows[i][5];
      var usedToday = Number(rows[i][6]) || 0;
      var bonusUsed = !!rows[i][7];
      if (usedDate !== today) {
        usedDate = today; usedToday = 0; bonusUsed = false;
        sh.getRange(i+1, 6, 1, 3).setValues([[usedDate, usedToday, bonusUsed]]);
      }
      return { rowIndex: i+1, code: rows[i][1], points: Number(rows[i][2]) || 0,
               usedDate: usedDate, usedToday: usedToday, bonusUsed: bonusUsed };
    }
  }

  var code = genGachaCode(sh);
  var now  = new Date();
  sh.appendRow([id, code, 0, now, now, today, 0, false]);
  return { rowIndex: sh.getLastRow(), code: code, points: 0, usedDate: today, usedToday: 0, bonusUsed: false };
}

// data: { id: 端末ごとの識別子, initPoints: 端末に既に貯まっていたポイント }
// 冪等（何度呼ばれても加算されない）: 未登録なら initPoints で新規作成、
// 既に登録済みならそのまま現状を返すだけ（通信リトライで二重加算しない）。
// これにより「既存プレイヤーが既に貯めていたポイント」を安全に引き継げる。
function handleGachaRegister(data) {
  const id = (data.id || '').toString().trim();
  if (!id) return err('idが必要です');
  const initPoints = Math.max(0, Number(data.initPoints) || 0);

  const sh = ensureGachaSheet();
  const rows = sh.getDataRange().getValues();

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === id) {
      return ok({ code: rows[i][1], points: rows[i][2] });
    }
  }

  var code = genGachaCode(sh);
  var now  = new Date();
  var today = todayJST();
  sh.appendRow([id, code, initPoints, now, now, today, 0, false]);
  return ok({ code: code, points: initPoints });
}

// data: { id: 端末ごとの識別子, delta: 増減させたいポイント数 }
// 加算専用。景品交換（ポイント消費）など将来の用途向けに温存している保険的なAPIで、
// 通常のガチャ結果はgachaSpinがサーバー側で直接加算するのでここは通らない。
function handleGachaSync(data) {
  const id = (data.id || '').toString().trim();
  if (!id) return err('idが必要です');
  const delta = Number(data.delta) || 0;

  const sh = ensureGachaSheet();
  const row = getOrCreateGachaRow(sh, id);
  const newPoints = Math.max(0, row.points + delta);
  sh.getRange(row.rowIndex, 3).setValue(newPoints);
  sh.getRange(row.rowIndex, 5).setValue(new Date());
  return ok({ code: row.code, points: newPoints });
}

// data: { id: 端末ごとの識別子 }
// 抽選そのものをここで行う。クライアントは「回した」というリクエストを送るだけで、
// 何等が当たるか・何ポイント貰えるかはサーバーが決めて返す（自己申告不可）。
// 1日の残り回数もここでチェック・消費する（サーバー側が唯一の権威）。
function handleGachaSpin(data) {
  const id = (data.id || '').toString().trim();
  if (!id) return err('idが必要です');

  const sh  = ensureGachaSheet();
  const row = getOrCreateGachaRow(sh, id);
  const effectiveLimit = 1 + (row.bonusUsed ? 1 : 0);

  if (row.usedToday >= effectiveLimit) {
    return err('LIMIT', { usedToday: row.usedToday, effectiveLimit: effectiveLimit });
  }

  var total = 0;
  for (var i = 0; i < GACHA_FORTUNES.length; i++) total += GACHA_FORTUNES[i].weight;
  var r = Math.random() * total;
  var fortune = GACHA_FORTUNES[GACHA_FORTUNES.length - 1];
  for (var j = 0; j < GACHA_FORTUNES.length; j++) {
    r -= GACHA_FORTUNES[j].weight;
    if (r <= 0) { fortune = GACHA_FORTUNES[j]; break; }
  }

  const newPoints    = row.points + fortune.pt;
  const newUsedToday = row.usedToday + 1;

  sh.getRange(row.rowIndex, 3).setValue(newPoints);
  sh.getRange(row.rowIndex, 5).setValue(new Date());
  sh.getRange(row.rowIndex, 7).setValue(newUsedToday);

  return ok({
    key: fortune.key, pt: fortune.pt, points: newPoints, code: row.code,
    usedToday: newUsedToday, effectiveLimit: effectiveLimit
  });
}

// data: { id: 端末ごとの識別子, word: 入力された合言葉 }
// 合言葉の正誤判定もサーバー側で行う（1日+1回ボーナス）。
function handleGachaBonus(data) {
  const id = (data.id || '').toString().trim();
  if (!id) return err('idが必要です');
  const word = (data.word || '').toString();

  const sh  = ensureGachaSheet();
  const row = getOrCreateGachaRow(sh, id);

  if (word !== GACHA_BONUS_WORD) return ok({ granted: false });
  if (row.bonusUsed) return ok({ granted: false, alreadyUsed: true });

  sh.getRange(row.rowIndex, 8).setValue(true);
  return ok({ granted: true });
}

// data: { code: スタッフが端末画面で見せてもらう6桁コード }
function handleGachaLookup(data) {
  const code = (data.code || '').toString().trim().toUpperCase();
  if (!code) return err('コードが必要です');

  const sh = ensureGachaSheet();
  const rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if ((rows[i][1] || '').toString().toUpperCase() === code) {
      return ok({ code: rows[i][1], points: rows[i][2], updatedAt: rows[i][4] });
    }
  }
  return err('そのコードは見つかりません');
}

const GACHA_REDEMPTIONS_SHEET_NAME = 'redemptions';
const GACHA_REDEMPTIONS_HEADERS = ['id','code','amount','pointsAfter','staffEmail','createdAt'];

function ensureRedemptionsSheet() {
  const ss = getSpreadsheet();
  var sh = ss.getSheetByName(GACHA_REDEMPTIONS_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(GACHA_REDEMPTIONS_SHEET_NAME);
    sh.getRange(1,1,1,GACHA_REDEMPTIONS_HEADERS.length).setValues([GACHA_REDEMPTIONS_HEADERS]);
    sh.getRange(1,1,1,GACHA_REDEMPTIONS_HEADERS.length).setBackground('#1a1a2e').setFontColor('#c8a84a').setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

// data: { code, amount, staffEmail } — マルシェ現地でのクーポン利用（1pt=1円、100pt単位のみ）。
// amountが100の倍数か・残高が足りているかをここで検証し、消費と同時に redemptions シートへ記録する。
function handleGachaRedeem(data) {
  const code = (data.code || '').toString().trim().toUpperCase();
  const amount = Number(data.amount) || 0;
  if (!code) return err('コードが必要です');
  if (amount <= 0 || amount % 100 !== 0) return err('交換ポイントは100の倍数で指定してください');

  const sh = ensureGachaSheet();
  const rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if ((rows[i][1] || '').toString().toUpperCase() === code) {
      const currentPoints = Number(rows[i][2]) || 0;
      if (currentPoints < amount) {
        return err('ポイントが不足しています（保有: ' + currentPoints + 'pt）', { points: currentPoints });
      }
      const newPoints = currentPoints - amount;
      sh.getRange(i+1, 3).setValue(newPoints);
      sh.getRange(i+1, 5).setValue(new Date());

      const rSh = ensureRedemptionsSheet();
      rSh.appendRow([Utilities.getUuid(), code, amount, newPoints, data.staffEmail || '', new Date()]);

      return ok({ code: code, amount: amount, points: newPoints });
    }
  }
  return err('そのコードは見つかりません');
}

// 全体集計（プレイヤー数・合計ポイント・本日プレイ人数）。要ログイン。
function handleGachaStats() {
  const sh = ensureGachaSheet();
  const rows = sh.getDataRange().getValues();
  const today = todayJST();

  var count = 0, totalPoints = 0, todayActive = 0;
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    count++;
    totalPoints += Number(rows[i][2]) || 0;
    if (rows[i][5] === today && Number(rows[i][6]) > 0) todayActive++;
  }
  return ok({ count: count, totalPoints: totalPoints, todayActive: todayActive });
}

// ============================================================
//  診断ツール（問題発生時にApps Scriptエディタから手動実行）
// ============================================================
function diagnose() {
  const sh = ensureGachaSheet();
  Logger.log('スプレッドシートURL: ' + getSpreadsheet().getUrl());
  Logger.log('gacha_points データ行数: ' + (sh.getLastRow()-1));
  Logger.log('集計: ' + handleGachaStats().getContent());
}
