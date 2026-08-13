// ============================================================
//  おまんぼガチャ — 専用バックエンド (GAS)
//  marche-system(受注管理システム)とは完全に独立したプロジェクト。
//
//  ・ポイントの記録、抽選（何等が当たるか）、1日の残り回数チェックは
//    すべてこのサーバー側で行う。クライアントは結果を自己申告できない。
//  ・データ保存先のスプレッドシートは初回アクセス時に自動作成し、
//    Script Properties に SPREADSHEET_ID を保存して以後使い回す。
//  ・管理者画面はスタッフ共通の1つのパスワードで判定する（2026-08-09、Googleアカウント
//    認証から変更。モバイルSafari等でのGoogleログインの不安定さを避けるため）。
//    パスワードはソースに直書きせず Script Properties の ADMIN_PASSWORD に保存する。
//    このデプロイは2種類のURLで公開しているが、上記の変更によりどちらも
//    access="ANYONE_ANONYMOUS"（匿名アクセス可）で問題なくなった。
//      1) 公開用 → お客様のガチャ本体から呼ぶ
//      2) 管理者用 → 2026-08-13以前はこのURLを直接開くとHtmlServiceで管理画面(admin.html)を
//         返していたが、GAS HtmlServiceが自動生成するsandbox iframeがcamera権限を委譲せず
//         QRスキャンが原理的に不可能だったため、管理画面自体をGitHub Pages
//         (https://omanbosan.github.io/digital-omanbosan-gacha/admin.html、iframeに包まれない
//         純粋な静的ページ)へ全面移転した。このデプロイはもう管理画面HTMLを返さず、
//         gachaAdminStats/gachaAdminLookup/gachaAdminRedeemのJSON APIとしてのみ使う
//         （すべてcheckAdminPasswordで保護）。旧URLを直接開いた場合は移転先へ自動転送する。
// ============================================================

const GACHA_FORTUNES = [
  { key:'daigichi', pt:300, weight:10  },
  { key:'kichi',    pt:100, weight:50  },
  { key:'chukichi', pt:10,  weight:100 },
  { key:'shokichi', pt:5,   weight:150 },
  { key:'suekichi', pt:3,   weight:200 },
  { key:'kyo',      pt:1,   weight:490 },
];
// 列: id, code, points, createdAt, updatedAt, usedDate, usedToday, bonusUsed, baseCouponShown
const GACHA_HEADERS = ['id','code','points','createdAt','updatedAt','usedDate','usedToday','bonusUsed','baseCouponShown'];
const GACHA_SHEET_NAME = 'gacha_points';

// 2026-08限定・初回プレイ記念のBASEクーポン機能。
// コード本体はソースに直書きせず Script Properties の BASE_COUPON_CODE に保存する
// （ADMIN_PASSWORDと同じ運用方針。キャンペーン終了時はここを空にするだけでOFFにできる）。
// BASE側の「クーポンApp」で実際にこのコードのクーポンを作成し、有効期限・発行枚数・
// 1人1回制限を設定しておくこと（同じコードを使い回すため、複数回利用の防止はBASE側に任せる）。
const GACHA_BASE_COUPON_PROP = 'BASE_COUPON_CODE';
// 8月限定キャンペーンのため、この日時(JST)以降は自動的に配布を停止する。
// BASE側のクーポン自体の有効期限は8/31 23:59までだが、ガチャでの配布はそれより
// 前に締め切りたい(21:00)とのことなのでこちらは別に設定する。
// Script Propertiesの値を消し忘れてもこの日時を過ぎれば自動でOFFになる二重の安全策。
const GACHA_BASE_COUPON_END = '2026-08-31 21:00';
function getBaseCouponCode() {
  var nowJST = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm');
  if (nowJST >= GACHA_BASE_COUPON_END) return '';
  return (PropertiesService.getScriptProperties().getProperty(GACHA_BASE_COUPON_PROP) || '').trim();
}

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

    // action指定が無ければ、管理画面の移転先(GitHub Pages)を案内するだけの軽いページを返す。
    // 2026-08-13判明: GAS HtmlServiceはページ本体を独自のsandbox iframe(script.googleusercontent.com、
    // 別オリジン)で包んで配信しており、そのiframeのallow属性にcamera/microphoneが含まれない
    // (ALLOWALLはX-Frame-Optionsの話でこれとは無関係)。そのためGAS上でHTMLを直接ホストする限り
    // QRスキャンが原理的に常に失敗する。管理画面自体をGitHub Pages(admin.html、iframeに包まれない)
    // に全面移転し、このGASデプロイは純粋なJSON APIとしてのみ使う構成に変更した。
    if (!action) {
      var html = '<!doctype html><html lang="ja"><head><meta charset="utf-8">'
        + '<meta http-equiv="refresh" content="0; url=https://omanbosan.github.io/digital-omanbosan-gacha/admin.html">'
        + '<title>おまんぼガチャ 管理</title></head><body style="font-family:sans-serif;text-align:center;padding:40px 20px;">'
        + '管理画面は移転しました。自動的に移動しない場合は<a href="https://omanbosan.github.io/digital-omanbosan-gacha/admin.html">こちら</a>を開いてください。'
        + '</body></html>';
      return HtmlService.createHtmlOutput(html).setTitle('おまんぼガチャ 管理');
    }

    var data = {};
    try { data = JSON.parse(e.parameter.d || '{}'); } catch(ex) { data = {}; }

    switch (action) {
      case 'ping':              return ok({ pong: true });
      case 'gachaRegister':     return handleGachaRegister(data);
      case 'gachaSync':         return handleGachaSync(data);
      case 'gachaSpin':         return handleGachaSpin(data);
      case 'gachaRestore':      return handleGachaRestore(data);
      case 'gachaAdminStats':   return handleGachaAdminStats(data);
      case 'gachaAdminLookup':  return handleGachaAdminLookup(data);
      case 'gachaAdminRedeem':  return handleGachaAdminRedeem(data);
      default:                  return err('Unknown action: ' + action);
    }
  } catch(ex) {
    return err(ex.toString());
  }
}

function doPost(e) { return err('GETを使用してください'); }

// ============================================================
//  認証（スタッフ共通の1パスワード。Script PropertiesのADMIN_PASSWORDと照合）
// ============================================================
const GACHA_ADMIN_PASSWORD_PROP = 'ADMIN_PASSWORD';

function checkAdminPassword(password) {
  var expected = PropertiesService.getScriptProperties().getProperty(GACHA_ADMIN_PASSWORD_PROP);
  if (!expected) throw new Error('管理者パスワードが未設定です（Script Propertiesを確認してください）');
  if ((password || '') !== expected) throw new Error('パスワードが違います');
}

// 2026-08-13: 管理画面をGitHub Pages(admin.html)へ全面移転したことに伴い、
// google.script.run専用だった管理者用関数を、password必須の生JSON APIに置き換えた。
// パスワード照合(checkAdminPassword)がある限り、匿名デプロイ経由で公開しても
// 生のgachaLookup/gachaRedeemを直接公開するのと違って誰でも使える状態にはならない。
function handleGachaAdminStats(data) {
  try { checkAdminPassword(data.password); } catch (ex) { return err(ex.message); }
  return handleGachaStats();
}
function handleGachaAdminLookup(data) {
  try { checkAdminPassword(data.password); } catch (ex) { return err(ex.message); }
  return handleGachaLookup({ code: data.code });
}
// マルシェ現地でのクーポン利用（ポイント消費）。1pt=1円、100pt単位でのみ実行可能。
// 2026-08-09以降、誰が処理したかはredemptionsシートに記録しない(Googleアカウント認証廃止のため)。
function handleGachaAdminRedeem(data) {
  try { checkAdminPassword(data.password); } catch (ex) { return err(ex.message); }
  return handleGachaRedeem({ code: data.code, amount: data.amount });
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
  // 列追加マイグレーション: 後からGACHA_HEADERSに列を足した場合、既存シートのヘッダーが
  // 追いついていなければ自動で追記する（baseCouponShown列の追加時に導入）。
  if (sh.getLastColumn() < GACHA_HEADERS.length) {
    sh.getRange(1, 1, 1, GACHA_HEADERS.length).setValues([GACHA_HEADERS]);
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
               usedDate: usedDate, usedToday: usedToday, bonusUsed: bonusUsed,
               baseCouponShown: !!rows[i][8] };
    }
  }

  var code = genGachaCode(sh);
  var now  = new Date();
  sh.appendRow([id, code, 0, now, now, today, 0, false, false]);
  return { rowIndex: sh.getLastRow(), code: code, points: 0, usedDate: today, usedToday: 0, bonusUsed: false,
           baseCouponShown: false };
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
  sh.appendRow([id, code, initPoints, now, now, today, 0, false, false]);
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
  const effectiveLimit = 1; // 合言葉ボーナス機能は廃止したため常に1日1回

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

  // 2026-08限定・初回プレイ記念のBASEクーポン。
  // 「このidにとって生まれて初めてのgachaSpinかどうか」で判定する(baseCouponShownは
  // 新規行では必ずfalseから始まるため、register経由で既存ポイントを引き継いだ人でも
  // 実際に1回でも回すまでは初回扱いになる)。付与は1回きり、以後は二度と返さない。
  var baseCoupon = null;
  var couponCode = getBaseCouponCode();
  if (couponCode && !row.baseCouponShown) {
    baseCoupon = couponCode;
    sh.getRange(row.rowIndex, 9).setValue(true);
  }

  return ok({
    key: fortune.key, pt: fortune.pt, points: newPoints, code: row.code,
    usedToday: newUsedToday, effectiveLimit: effectiveLimit,
    baseCoupon: baseCoupon
  });
}

// data: { code: お客様が入力した6桁コード, newId: 今の端末の新しいcid }
// iPhone Safariで「履歴とWebサイトデータの消去」等によりlocalStorageが消え、
// 元のidを失った端末を救済するための復元機能。コードを知っている＝本人とみなし、
// 台帳のid列を今の端末のcidに付け替える(所有権の再紐付け)。
// マルシェでのコード提示による現地交換と同じ信頼モデル(コードを知っていれば本人扱い)。
function handleGachaRestore(data) {
  const code  = (data.code  || '').toString().trim().toUpperCase();
  const newId = (data.newId || '').toString().trim();
  if (!code)  return err('コードが必要です');
  if (!newId) return err('端末IDの取得に失敗しました');

  const sh = ensureGachaSheet();
  const rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if ((rows[i][1] || '').toString().toUpperCase() === code) {
      sh.getRange(i+1, 1).setValue(newId);
      sh.getRange(i+1, 5).setValue(new Date());
      return ok({ code: rows[i][1], points: Number(rows[i][2]) || 0 });
    }
  }
  return err('そのコードは見つかりません');
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
