#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# gacha_v2.html 生成スクリプト

import re

def js(text):
    """日本語をJavaScript Unicodeエスケープに変換"""
    out = []
    for c in text:
        if ord(c) > 127:
            out.append('\\u{:04x}'.format(ord(c)))
        else:
            out.append(c)
    return ''.join(out)

def jsarr(items):
    entries = []
    for name, comment in items:
        entries.append("['" + js(name) + "','" + js(comment) + "']")
    return '[\n    ' + ',\n    '.join(entries) + '\n  ]'

def jsmsgarr(msgs):
    return '[' + ','.join(["'" + js(m) + "'" for m in msgs]) + ']'

# ========================
# 献立データ (100件)
# ========================
daigichi_dinners = [
    ("ローストチキン",           "オーブンに任せれば意外と簡単。今日はいつもより頑張って♪"),
    ("ビーフシチュー",           "じっくり煮込んで、おうちが最高のレストランに♪"),
    ("手作り餃子",               "家族みんなで包めば楽しさが具になる♪"),
    ("チキンステーキきのこソース","焼くだけなのに豪華に見える魔法のレシピ♪"),
    ("海老チリ",                 "冷凍エビで十分。本格派の顔して実は簡単♪"),
    ("豚の角煮",                 "ほったらかしでOK。待つのも楽しみ♪"),
    ("牛肉とブロッコリーのオイスターソース炒め", "5分でできる超時短豪華飯♪"),
    ("鶏もも肉のガリバタソテー", "にんにくバターの香りで家族が起きてくる♪"),
    ("手巻き寿司",               "みんなで囲む食卓は最高のごちそう♪"),
    ("すき焼き",                 "特別な日じゃなくてもいいじゃない。今日が特別♪"),
    ("帆立のバター醤油焼き",     "缶詰帆立でも本格的。罪悪感ゼロ♪"),
    ("豚ロース生姜焼き定食",     "定番の王者。飽きない味が一番♪"),
    ("クリームシチュー",         "パンに付けて食べてください。絶対おいしい♪"),
    ("タンドリーチキン",         "漬けて焼くだけ。インド料理が家で出来ちゃう♪"),
    ("鮭のムニエル",             "フライパン一つで洋食屋さんの味♪"),
    ("鶏肉のトマト煮込み",       "イタリアンっぽく見えてお財布に優しい♪"),
    ("ポークソテーマスタードソース","ちょっとオシャレな気分で食べてみて♪"),
]
kichi_dinners = [
    ("肉じゃが",                 "丁寧に作ると違うよ。ゆっくり煮含めてね♪"),
    ("だし巻き卵",               "卵3個で幸せになれる。丁寧に巻いてみて♪"),
    ("鶏の唐揚げ",               "下味をしっかり30分。この一手間が全然違う♪"),
    ("ぶり大根",                 "冬の定番。煮汁をたっぷり絡めて♪"),
    ("肉豆腐",                   "ご飯に乗せても最高。甘辛い味が染みてる♪"),
    ("鶏ごぼうの炊き込みご飯",   "炊飯器に任せて。炊き上がりの香りで幸せ♪"),
    ("さばの味噌煮",             "ちゃんと生姜を入れて。それだけで格段に美味しくなる♪"),
    ("豚汁",                     "具だくさんにして。豚汁は愛情の量で決まる♪"),
    ("筑前煮",                   "根菜をしっかり炒めてから煮てね。それがコツ♪"),
    ("鶏そぼろ丼",               "三色にすると見た目もバッチリ。卵と絹さやも忘れずに♪"),
    ("ハンバーグ",               "玉ねぎをしっかり炒めてから混ぜてね。それが美味しさの秘訣♪"),
    ("茶碗蒸し",                 "蒸し器がなくてもフライパンで出来るよ♪"),
    ("麻婆豆腐",                 "豆板醤の量で辛さ調整。自分好みが手料理の醍醐味♪"),
    ("豚のしょうが焼き",         "玉ねぎをたっぷり入れて一緒に焼いてね♪"),
    ("鶏のゆず塩鍋",             "出汁をしっかり取ると上品な味になるよ♪"),
    ("さつまいもの天ぷら",       "甘くてホクホク。季節を食べる感じ♪"),
    ("根菜の煮物盛り合わせ",     "丁寧な仕事が光る。ゆっくり作ってね♪"),
]
chukichi_dinners = [
    ("豚こまキャベツ炒め",       "キャベツをどっさり入れてごま油で仕上げると最高♪"),
    ("野菜たっぷりカレー",       "冷蔵庫の余り野菜を全部入れて。それが一番おいしいカレー♪"),
    ("蒸し鶏と野菜のサラダ",     "ポン酢ドレッシングでさっぱりと♪"),
    ("鮭と野菜のホイル焼き",     "アルミホイルに包んで蒸すだけ。洗い物も少ない♪"),
    ("豚しゃぶサラダ",           "茹でた豚肉を野菜の上に。ポン酢でどうぞ♪"),
    ("切り干し大根の煮物",       "地味だけどすごく体に良い。地味の勝利♪"),
    ("ほうれん草と豆腐の味噌汁定食","お味噌汁って偉大だなと思う今日この頃♪"),
    ("ひじきの煮物",             "多めに作って翌日も食べてね。鉄分補給♪"),
    ("ブロッコリーとゆで卵のサラダ","シンプルだけど飽きない組み合わせ♪"),
    ("鶏むね肉と野菜のスープ",   "コトコト煮込んで体を温めて♪"),
    ("根菜の豚汁",               "大根・にんじん・ごぼうを大きめに切って存在感を出して♪"),
    ("レンコンのきんぴら",       "シャキシャキ食感が楽しい。ごまをたっぷりかけてね♪"),
    ("なすと豚肉の味噌炒め",     "夏野菜の王者。甘めの味噌が合う♪"),
    ("かぼちゃの煮物",           "ほっくり甘くて癒される。おまんぼ的に好き♪"),
    ("小松菜と油揚げの炒め煮",   "地味にうまい。これぞ家庭の味♪"),
    ("玉ねぎたっぷりオニオンスープ","じっくり炒めた玉ねぎが甘くなる魔法♪"),
    ("野菜炒め定食",             "強火で手早く。シャキシャキが命♪"),
]
shokichi_dinners = [
    ("卵かけご飯デラックス",     "醤油だけじゃなくてごま油も垂らして。世界が変わる♪"),
    ("焼きそば",                 "冷蔵庫の残り物を全部炒めればOK。今日の晩ごはん完成♪"),
    ("チャーハン",               "残りご飯と卵があればできる。強火が命♪"),
    ("うどん鍋",                 "白菜と豚肉だけあればいい。シンプルに生きよう♪"),
    ("納豆ご飯定食",             "今日はそれでいい。体が休みたがってるサイン♪"),
    ("冷しゃぶ",                 "茹でるだけ。野菜を並べると豪華に見える♪"),
    ("オムライス",               "ケチャップライスを巻けばできあがり。子供心を忘れずに♪"),
    ("ナポリタン",               "冷蔵庫の野菜をケチャップで炒めるだけ♪"),
    ("焼きうどん",               "麺と野菜があれば5分で完成。手軽さに感謝♪"),
    ("レトルトカレートッピング祭り","目玉焼きとらっきょうと福神漬けを全力トッピング♪"),
    ("豆腐とわかめの味噌汁定食", "汁物があれば心が落ち着く♪"),
    ("そうめん",                 "夏の定番。めんつゆに薬味をたっぷり♪"),
    ("たまご丼",                 "出汁と卵と玉ねぎ。シンプルなのに泣ける美味しさ♪"),
    ("塩焼きそば",               "醤油じゃなく塩で作ると大人っぽい♪"),
    ("おにぎり定食",             "握るだけでご飯になる。おにぎりの形がかわいい♪"),
    ("ピザトースト",             "食パンに具材を乗せて焼くだけ。アレンジの勝利♪"),
    ("親子丼",                   "鶏肉と卵と玉ねぎだけ。シンプルで最強♪"),
]
suekichi_dinners = [
    ("お茶漬け",                 "梅干しとのりと三つ葉で。シンプルが最強♪"),
    ("雑炊",                     "残りご飯があれば10分で完成。お腹も心もほっこり♪"),
    ("白身魚の煮付け",           "たらや鰈でさっぱりと。胃が喜ぶよ♪"),
    ("冷やしトマト",             "トマトに塩だけ。夏はこれで十分♪"),
    ("湯豆腐",                   "ポン酢でどうぞ。ゆっくり食べる日♪"),
    ("具だくさん味噌汁定食",     "今日は汁物に全力を注いで♪"),
    ("そばとおにぎり",           "軽く食べたい日にピッタリ♪"),
    ("鶏のさっぱり煮",           "酢を入れることで酸味がマイルドに。消化も良い♪"),
    ("かき玉うどん",             "優しい味で体が癒される♪"),
    ("キャベツの浅漬け定食",     "塩もみキャベツとご飯と納豆。シンプル最高♪"),
    ("豆腐のあんかけ",           "片栗粉でとろみをつけるだけで上品になる♪"),
    ("蒸し鶏のスープ",           "鶏むねをゆっくり蒸す。スープも飲んでね♪"),
    ("春雨スープ",               "軽くてほっこり。お腹に優しい♪"),
    ("大根おろしそば",           "大根おろしをたっぷり。すっきりする♪"),
    ("素うどん",                 "出汁をしっかり取れば、シンプルなのに感動する♪"),
    ("酢の物定食",               "きゅうりとわかめの酢の物。さっぱりリセット♪"),
    ("ひと口おにぎりと味噌汁",   "食べ過ぎた翌日にちょうどいい♪"),
]
kyo_dinners = [
    ("今日はコンビニでいい",     "たまには自分を甘やかして。コンビニには愛がある♪"),
    ("冷蔵庫の残り物全部炒め",   "名前のない料理が一番おいしかったりする♪"),
    ("昨日の残りを温める",       "残り物には福がある。立派なリサイクル♪"),
    ("ふりかけご飯",             "今日は体を休める日。ふりかけは偉大♪"),
    ("インスタント味噌汁とご飯", "これが一番ほっとするかも。シンプルな幸せ♪"),
    ("冷凍餃子を焼くだけ",       "罪悪感より感謝。冷凍技術に感謝♪"),
    ("レトルトカレー",           "何も考えずに食べていい。今日はそういう日♪"),
    ("卵かけご飯だけでいい",     "シンプルイズベスト。卵は完全栄養食♪"),
    ("今日は食べたいものを食べる","自分の心に従おう。直感メシが最高♪"),
    ("うどんをゆでるだけ",       "それで十分な日もある。うどんは優しい♪"),
    ("お惣菜を買ってくる",       "毎日作らなくていいよ。賢い選択♪"),
    ("お茶漬けの素でOK",         "今日は自分に優しくする日♪"),
    ("パンとスープだけ",         "手を抜くことも大切なこと。体が求めてるよ♪"),
    ("納豆とご飯とお味噌汁",     "これだけで栄養バランスOK。日本食の底力♪"),
    ("デリバリーの日",           "今夜は届けてもらおう。たまにはそれでいい♪"),
]

fortune_msgs = {
    'daigichi': [
        "最高の運気到来！今日はチャンスを逃さずに♪",
        "大吉は年に何回もない。今日を思いっきり楽しんで♪",
        "運気MAX！感謝の気持ちを大切に過ごしてね♪",
    ],
    'kichi': [
        "今日は丁寧に、ゆっくり進もう♪",
        "コツコツが吉。急がず丁寧にいこう♪",
        "いつも通りが一番。それが積み重なって運になる♪",
    ],
    'chukichi': [
        "中くらいがちょうどいい。バランスが大事♪",
        "無理せず自分のペースで。それが一番の運気♪",
        "今日は体と心に優しく過ごしてね♪",
    ],
    'shokichi': [
        "小さな幸せを見つける日。足元に宝がある♪",
        "今日はシンプルに、大切なことだけやろう♪",
        "焦らなくていい。小さく確実に進んでね♪",
    ],
    'suekichi': [
        "末の字を信じて。これからが上向き♪",
        "今日は休息の日。明日につながる休みを♪",
        "ゆっくりさっぱりいこう。焦らないのが吉♪",
    ],
    'kyo': [
        "凶だって悪くない。これ以上悪くならないから！♪",
        "今日は無理しない日。のんびりいこう♪",
        "大丈夫。凶の後には必ず上向きになる♪",
    ],
}

# ========================
# 新しいJavaScript生成
# ========================
new_js = r"""<script>
// ===== おまんぼガチャ v2.0 =====
// 開発履歴は末尾HTMLコメント参照

var DAILY_LIMIT   = 3;
var BONUS_WORD    = 'おまんぼ';
var COUPON_SECRET = 'OMBN2026GCH';
var COUPON_LETS   = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

// URLパラメータ: ?g=ポイント_日付_使用回数_ボーナス
var _mem = { points: 0, usedToday: 0, usedDate: '', bonusUsed: false };

// ===== 運勢テーブル =====
var fortunes = [
  { key:'daigichi', label:'大吉', color:'#ffbb00', emoji:'🌟', couponLabel:'30%OFF', hasCoupon:true,  pt:50, weight:1  },
  { key:'kichi',    label:'吉',       color:'#ff8833', emoji:'✨',       couponLabel:'20%OFF', hasCoupon:true,  pt:10, weight:4  },
  { key:'chukichi', label:'中吉', color:'#44aaff', emoji:'🍀', couponLabel:'10%OFF', hasCoupon:true,  pt:5,  weight:10 },
  { key:'shokichi', label:'小吉', color:'#44cc88', emoji:'🌱', couponLabel:'送料無料', hasCoupon:true,  pt:3,  weight:20 },
  { key:'suekichi', label:'末吉', color:'#bb99ff', emoji:'🌺', couponLabel:'5%OFF',  hasCoupon:true,  pt:1,  weight:30 },
  { key:'kyo',      label:'凶',       color:'#888888', emoji:'😅', couponLabel:'',       hasCoupon:false, pt:0,  weight:35 }
];

// ===== ポイント交換景品 =====
var exchangeItems = [
  { name:'おまんぼステッカー',                               emoji:'⭐',           cost:30   },
  { name:'缶バッジ',                                                              emoji:'🌟',     cost:80   },
  { name:'ポストカードセット',                               emoji:'📍',     cost:200  },
  { name:'アクリルキーホルダー',                         emoji:'🔑',     cost:500  },
  { name:'レーザー彫刻キーホルダー（名入り）', emoji:'🏆', cost:1800 }
];

""" + \
"// ===== 献立データ (100件) =====\n" + \
"var dinnerMenus = {\n" + \
"  daigichi: " + jsarr(daigichi_dinners) + ",\n" + \
"  kichi:    " + jsarr(kichi_dinners) + ",\n" + \
"  chukichi: " + jsarr(chukichi_dinners) + ",\n" + \
"  shokichi: " + jsarr(shokichi_dinners) + ",\n" + \
"  suekichi: " + jsarr(suekichi_dinners) + ",\n" + \
"  kyo:      " + jsarr(kyo_dinners) + "\n" + \
"};\n\n" + \
"// ===== 運勢メッセージ =====\n" + \
"var fortuneMsgs = {\n" + \
"  daigichi: " + jsmsgarr(fortune_msgs['daigichi']) + ",\n" + \
"  kichi:    " + jsmsgarr(fortune_msgs['kichi']) + ",\n" + \
"  chukichi: " + jsmsgarr(fortune_msgs['chukichi']) + ",\n" + \
"  shokichi: " + jsmsgarr(fortune_msgs['shokichi']) + ",\n" + \
"  suekichi: " + jsmsgarr(fortune_msgs['suekichi']) + ",\n" + \
"  kyo:      " + jsmsgarr(fortune_msgs['kyo']) + "\n" + \
"};\n\n" + \
r"""
// ===== URLパラメータ永続化 =====
function getTodayStr() {
  var d = new Date();
  return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
}
function getEffectiveLimit() {
  return DAILY_LIMIT + (_mem.bonusUsed ? 1 : 0);
}
function saveToURL() {
  var today = getTodayStr();
  if (!_mem.usedDate) _mem.usedDate = today;
  var param = _mem.points + '_' + _mem.usedDate + '_' + _mem.usedToday + '_' + (_mem.bonusUsed ? '1' : '0');
  if (window.history && window.history.replaceState) {
    try { window.history.replaceState(null, '', '?g=' + param); } catch(e) {}
  }
}
function loadFromURL() {
  var search = window.location.search;
  if (!search) return;
  var match = search.match(/[?&]g=([^&]*)/);
  if (!match) return;
  var parts = decodeURIComponent(match[1]).split('_');
  if (parts.length < 4) return;
  var pts  = parseInt(parts[0], 10);
  var date = parts[1];
  var used = parseInt(parts[2], 10);
  var bon  = parts[3] === '1';
  if (!isNaN(pts)  && pts  >= 0) _mem.points   = pts;
  if (date)                       _mem.usedDate  = date;
  if (!isNaN(used) && used >= 0) _mem.usedToday = used;
  _mem.bonusUsed = bon;
  var today = getTodayStr();
  if (_mem.usedDate && _mem.usedDate !== today) {
    _mem.usedToday = 0; _mem.usedDate = today; _mem.bonusUsed = false;
  }
}

// ===== ポイント管理 =====
function getUsedCount() {
  var today = getTodayStr();
  if (_mem.usedDate !== today) {
    _mem.usedToday = 0; _mem.usedDate = today; _mem.bonusUsed = false; saveToURL();
  }
  return _mem.usedToday;
}
function incrementUsed()  { getUsedCount(); _mem.usedToday++; saveToURL(); }
function getPoints()      { return _mem.points; }
function addPoints(pt)    { _mem.points += pt; updatePointDisplay(); saveToURL(); }
function spendPoints(pt)  {
  if (_mem.points < pt) return false;
  _mem.points -= pt; updatePointDisplay(); saveToURL(); return true;
}
function updatePointDisplay() {
  document.getElementById('point-display').textContent = _mem.points;
}
function updateRemainingDisplay() {
  var rem = Math.max(0, getEffectiveLimit() - getUsedCount());
  document.getElementById('remaining-count').textContent = rem;
  if (rem === 0) {
    document.getElementById('remaining-bar').style.color = '#ff6666';
    document.getElementById('hint').classList.add('hidden');
  } else {
    document.getElementById('remaining-bar').style.color = '';
  }
  var bb = document.getElementById('bonus-bar');
  if (bb && _mem.bonusUsed) bb.style.display = 'none';
}

// ===== 合言葉ボーナス =====
function doBonus() {
  var input = document.getElementById('bonus-input');
  var msg   = document.getElementById('bonus-msg');
  getUsedCount();
  if (_mem.bonusUsed) {
    msg.textContent = '本日分は使用済みです';
    msg.style.color = '#ff6666'; return;
  }
  if (input.value === BONUS_WORD) {
    _mem.bonusUsed = true; saveToURL(); input.value = '';
    msg.textContent = 'ボーナス！+1回ゲット！';
    msg.style.color = '#44ff88';
    updateRemainingDisplay();
    setTimeout(function() {
      var bar = document.getElementById('bonus-bar');
      if (bar) bar.style.display = 'none';
    }, 2000);
  } else {
    msg.textContent = '合言葉が違います';
    msg.style.color = '#ff6666';
  }
}

// ===== クーポンコード生成 (日付ハッシュ方式) =====
function djb2(str) {
  var h = 5381;
  for (var i = 0; i < str.length; i++) {
    h = (((h * 33) ^ str.charCodeAt(i)) >>> 0);
  }
  return h;
}
function genCode(fortuneKey) {
  var d = new Date();
  var ds = '' + d.getFullYear() + (d.getMonth()+1) + d.getDate();
  var h = djb2(ds + fortuneKey + COUPON_SECRET);
  var alpha = '';
  alpha += COUPON_LETS[h % COUPON_LETS.length];
  alpha += COUPON_LETS[(h >>> 5)  % COUPON_LETS.length];
  alpha += COUPON_LETS[(h >>> 10) % COUPON_LETS.length];
  alpha += COUPON_LETS[(h >>> 15) % COUPON_LETS.length];
  var digits = ('0000' + (h % 10000)).slice(-4);
  return alpha + '-' + digits;
}

// ===== おみくじ抽選 =====
function pickFortune() {
  var total = 0;
  for (var i = 0; i < fortunes.length; i++) total += fortunes[i].weight;
  var r = Math.random() * total;
  for (var j = 0; j < fortunes.length; j++) { r -= fortunes[j].weight; if (r <= 0) return fortunes[j]; }
  return fortunes[fortunes.length-1];
}

function timeUntilMidnight() {
  var now = new Date();
  var midnight = new Date(now); midnight.setHours(24,0,0,0);
  var ms = midnight - now;
  var h = Math.floor(ms/3600000);
  var m = Math.floor((ms%3600000)/60000);
  return h + '時間' + m + '分後にリセット';
}

var busy = false;

function doGacha() {
  if (busy) return;
  if (getUsedCount() >= getEffectiveLimit()) {
    document.getElementById('limit-time').textContent = timeUntilMidnight();
    document.getElementById('limit-popup').classList.add('show');
    return;
  }
  busy = true;
  incrementUsed();
  updateRemainingDisplay();
  document.getElementById('hint').classList.add('hidden');
  var fortune = pickFortune();
  document.getElementById('eye-spin').classList.add('spinning');
  setTimeout(function() {
    document.getElementById('capsule-top').style.background    = fortune.color;
    document.getElementById('capsule-bottom').style.background = fortune.color;
    document.getElementById('capsule').classList.add('launch');
    var glow = document.getElementById('mouth-glow');
    glow.classList.add('active');
    spawnSparkles(161, 268);
    setTimeout(function() { glow.classList.remove('active'); }, 900);
    setTimeout(function() { showResult(fortune); }, 1800);
  }, 1100);
}

function showResult(fortune) {
  addPoints(fortune.pt);
  var dList = dinnerMenus[fortune.key];
  var dItem = dList[Math.floor(Math.random() * dList.length)];
  var msgs  = fortuneMsgs[fortune.key];
  var fmsg  = msgs[Math.floor(Math.random() * msgs.length)];

  var lbl = document.getElementById('fortune-label');
  lbl.textContent  = fortune.label;
  lbl.style.color  = fortune.color;
  lbl.style.textShadow = '0 0 24px ' + fortune.color + ', 0 0 48px ' + fortune.color;
  document.getElementById('popup-emoji').textContent  = fortune.emoji;
  document.getElementById('fortune-msg').textContent  = fmsg;
  document.getElementById('dinner-name').textContent  = dItem[0];
  document.getElementById('dinner-cmt').textContent   = dItem[1];

  var couponSec = document.getElementById('coupon-section');
  if (fortune.hasCoupon) {
    document.getElementById('popup-code').textContent      = genCode(fortune.key);
    document.getElementById('coupon-discount').textContent = fortune.couponLabel;
    couponSec.style.display = 'block';
  } else {
    couponSec.style.display = 'none';
  }

  var ptEl = document.getElementById('popup-pt-gain');
  if (fortune.pt > 0) {
    ptEl.textContent = '+' + fortune.pt + ' pt ゲット！';
    ptEl.style.color = '#44ff88';
  } else {
    ptEl.textContent = 'また明日！🌙';
    ptEl.style.color = '#888888';
  }
  document.getElementById('result-popup').classList.add('show');
  spawnConfetti(fortune.key === 'daigichi' || fortune.key === 'kichi');
}

function resetAll() {
  document.getElementById('result-popup').classList.remove('show');
  var spin = document.getElementById('eye-spin');
  var cap  = document.getElementById('capsule');
  spin.classList.remove('spinning');
  cap.classList.remove('launch');
  document.getElementById('mouth-glow').classList.remove('active');
  var x = spin.offsetWidth; x = cap.offsetWidth;
  if (getUsedCount() < getEffectiveLimit()) {
    document.getElementById('hint').classList.remove('hidden');
  }
  setTimeout(function() { busy = false; }, 50);
}

// ===== 景品交換 =====
function buildExchangeList() {
  var list = document.getElementById('exchange-list');
  list.innerHTML = '';
  var pt = getPoints();
  for (var i = 0; i < exchangeItems.length; i++) {
    (function(item) {
      var div = document.createElement('div');
      div.className = 'exchange-item';
      var canAfford = pt >= item.cost;
      var btn = document.createElement('button');
      btn.className = 'ex-btn';
      btn.textContent = '交換';
      if (!canAfford) btn.disabled = true;
      btn.onclick = function() {
        if (spendPoints(item.cost)) {
          var msg = document.getElementById('exchange-msg');
          msg.textContent = item.emoji + ' ' + item.name + ' と交換しました！スタッフに画面を見せてください。';
          msg.style.display = 'block';
          buildExchangeList();
        }
      };
      var nameSpan = document.createElement('span');
      nameSpan.className = 'ex-name';
      nameSpan.textContent = item.emoji + ' ' + item.name;
      var costSpan = document.createElement('span');
      costSpan.className = 'ex-cost';
      costSpan.textContent = item.cost + 'pt';
      div.appendChild(nameSpan); div.appendChild(costSpan); div.appendChild(btn);
      list.appendChild(div);
    })(exchangeItems[i]);
  }
}

// ===== エフェクト =====
function spawnSparkles(cx, cy) {
  var wrapper = document.getElementById('face-wrapper');
  var emojis  = ['✨','💥','⭐','🌟','💫'];
  for (var i = 0; i < 8; i++) {
    (function(idx) {
      var el = document.createElement('div');
      el.className = 'sparkle burst';
      var angle = (idx/8) * Math.PI * 2;
      var dist  = 40 + Math.random()*35;
      el.style.left = cx + 'px'; el.style.top = cy + 'px';
      el.style.setProperty('--tx', (Math.cos(angle)*dist).toFixed(1)+'px');
      el.style.setProperty('--ty', (Math.sin(angle)*dist).toFixed(1)+'px');
      el.style.setProperty('--dur', (0.5+Math.random()*0.4).toFixed(2)+'s');
      el.textContent = emojis[Math.floor(Math.random()*5)];
      wrapper.appendChild(el);
      setTimeout(function() { el.parentNode && el.parentNode.removeChild(el); }, 1200);
    })(i);
  }
}
function spawnConfetti(fancy) {
  var n    = fancy ? 65 : 18;
  var cols = fancy ? ['#f0a020','#e05080','#3a8fd8','#44cc88','#ff6644','#cc55ee'] : ['#aaa','#ccc'];
  for (var i = 0; i < n; i++) {
    (function(delay) {
      setTimeout(function() {
        var el = document.createElement('div');
        el.className = 'cp';
        el.style.left   = (Math.random()*100)+'vw';
        el.style.width  = (6+Math.random()*10)+'px';
        el.style.height = el.style.width;
        el.style.background   = cols[Math.floor(Math.random()*cols.length)];
        el.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
        el.style.animationDuration = (1.6+Math.random()*2)+'s';
        document.body.appendChild(el);
        setTimeout(function() { el.parentNode && el.parentNode.removeChild(el); }, 4500);
      }, delay);
    })(i * 28);
  }
}

// ===== マーキーライト =====
(function() {
  var colors = ['#ffe566','#ff4488','#00ddff','#ff8800','#cc44ff','#44ff88','#ffffff'];
  function buildStrip(el) {
    var n = Math.floor(window.innerWidth / 20);
    for (var i = 0; i < n; i++) {
      var b = document.createElement('div');
      b.className = 'bulb';
      var c = colors[i % colors.length];
      b.style.background = c; b.style.boxShadow = '0 0 6px 2px '+c;
      b.style.animation  = 'bulbBlink 1s '+(i*0.07).toFixed(2)+'s ease-in-out infinite alternate';
      el.appendChild(b);
    }
  }
  var t = document.getElementById('marquee-top');
  var bb = document.getElementById('marquee-bottom');
  if (t)  buildStrip(t);
  if (bb) buildStrip(bb);
})();

// ===== 浮遊絵文字 =====
(function() {
  var floatEmojis = ['🎰','✨','🎊','🌟','💫','🎁','🎉','⭐','🎆','💥'];
  function spawn() {
    var el = document.createElement('div');
    el.textContent = floatEmojis[Math.floor(Math.random()*floatEmojis.length)];
    el.style.position = 'fixed'; el.style.left = (Math.random()*100)+'vw';
    el.style.bottom = '-60px'; el.style.fontSize = (1.2+Math.random()*1.6).toFixed(2)+'rem';
    el.style.opacity = '0'; el.style.pointerEvents = 'none'; el.style.zIndex = '5';
    el.style.animation = 'floatUp '+(5+Math.random()*5).toFixed(2)+'s ease-out forwards';
    document.body.appendChild(el);
    setTimeout(function() { el.parentNode && el.parentNode.removeChild(el); }, 12000);
  }
  setInterval(spawn, 1200); spawn(); spawn(); spawn();
})();

// ===== イベントリスナー =====
document.getElementById('eye-hitarea').addEventListener('click', doGacha);
document.getElementById('popup-close').addEventListener('click', resetAll);
document.getElementById('popup-backdrop').addEventListener('click', resetAll);
document.getElementById('limit-close').addEventListener('click', function() {
  document.getElementById('limit-popup').classList.remove('show');
});
document.getElementById('exchange-btn').addEventListener('click', function() {
  document.getElementById('exchange-msg').style.display = 'none';
  buildExchangeList();
  document.getElementById('exchange-popup').classList.add('show');
});
document.getElementById('exchange-close').addEventListener('click', function() {
  document.getElementById('exchange-popup').classList.remove('show');
});
document.getElementById('ex-backdrop').addEventListener('click', function() {
  document.getElementById('exchange-popup').classList.remove('show');
});
document.getElementById('bonus-btn').addEventListener('click', doBonus);
document.getElementById('bonus-input').addEventListener('keydown', function(e) {
  if (e.keyCode === 13) doBonus();
});

// ===== 初期化 =====
loadFromURL();
updatePointDisplay();
updateRemainingDisplay();
</script>"""

# ========================
# 追加CSS (おみくじスタイル)
# ========================
new_css = """
/* ===== OMIKUJI RESULT ===== */
.fortune-label {
  font-size: 2.6rem; font-weight: 900; letter-spacing: 0.3em;
  margin-bottom: 4px; display: block;
}
.fortune-msg {
  font-size: 0.82rem; color: #ffccaa; line-height: 1.65;
  margin-bottom: 10px; white-space: pre-line;
}
.dinner-box {
  background: rgba(255,180,0,0.08);
  border: 1.5px solid rgba(255,180,0,0.3);
  border-radius: 12px; padding: 10px 14px;
  margin-bottom: 10px; text-align: left;
}
.dinner-hdr  { font-size: 0.68rem; color: #ffaa44; font-weight: 700; letter-spacing: 0.1em; margin-bottom: 5px; }
.dinner-name { font-size: 1.05rem; font-weight: 900; color: #ffe566; margin-bottom: 4px; }
.dinner-cmt  { font-size: 0.78rem; color: #cc99aa; line-height: 1.5; }
.coupon-section { margin-bottom: 10px; }
.coupon-discount { font-size: 0.85rem; font-weight: 900; color: #44ff88; margin-bottom: 6px; letter-spacing: 0.08em; }
.coupon-expire { font-size: 0.68rem; color: #ff9966; font-weight: 700; margin-top: 4px; }
.popup-code  { display: block; background: rgba(255,180,0,0.1); border: 2px dashed rgba(255,180,0,0.6); border-radius: 10px; padding: 8px 12px; font-size: 1.1rem; font-weight: 900; letter-spacing: 0.2em; color: #ffe566; margin-bottom: 4px; }
.popup-pt-gain { font-size: 0.95rem; font-weight: 900; margin-bottom: 14px; }
"""

# ========================
# HTMLファイル変換
# ========================
target = "/Users/omanbosan/Desktop/omanbosan/開発/デジタルおまんぼガチャ/gacha_v2.html"

with open(target, 'r', encoding='utf-8') as f:
    html = f.read()

# 1) 旧ランクCSSを削除し新おみくじCSSを追加
old_rank_css = """.rank-common { background:#444; color:#aaa; }
.rank-rare   { background:linear-gradient(135deg,#1166bb,#0088ff); color:#fff; }
.rank-super  { background:linear-gradient(135deg,#aa0000,#ff4444); color:#fff; }
.rank-ultra  { background:linear-gradient(135deg,#cc8800,#ff4499); color:#fff; }"""

html = html.replace(old_rank_css, new_css.strip())

# popup-rank CSS行を更新（デコレーション保持しつつ縮小）
html = html.replace(
    '.popup-rank { font-size:0.68rem; font-weight:900; letter-spacing:0.25em; text-transform:uppercase; padding:3px 12px; border-radius:20px; display:inline-block; margin-bottom:10px; }',
    '/* popup-rank replaced by fortune-label */'
)

# 2) popup-card内HTMLをおみくじ形式に置換
old_popup_card_content = """    <span class="popup-rank"  id="popup-rank"></span>
    <span class="popup-emoji" id="popup-emoji"></span>
    <div  class="popup-title" id="popup-title"></div>
    <div  class="popup-desc"  id="popup-desc"></div>
    <span class="popup-code"  id="popup-code"></span>
    <div  class="popup-pt-gain" id="popup-pt-gain"></div>
    <button class="popup-btn" id="popup-close">もう一回まわす！</button>"""

new_popup_card_content = """    <span class="fortune-label" id="fortune-label">大吉</span>
    <span class="popup-emoji"  id="popup-emoji">🌟</span>
    <div  class="fortune-msg"  id="fortune-msg"></div>
    <div  class="dinner-box">
      <div class="dinner-hdr">🍳 今夜の晉ごはん</div>
      <div class="dinner-name" id="dinner-name"></div>
      <div class="dinner-cmt"  id="dinner-cmt"></div>
    </div>
    <div class="coupon-section" id="coupon-section">
      <div class="coupon-discount" id="coupon-discount"></div>
      <code class="popup-code" id="popup-code"></code>
      <div class="coupon-expire">📅 本日限り有効</div>
    </div>
    <div  class="popup-pt-gain" id="popup-pt-gain"></div>
    <button class="popup-btn" id="popup-close">閉じる</button>"""

html = html.replace(old_popup_card_content, new_popup_card_content)

# 3) <script>〜</script>を丸ごと置換
script_start = html.index('<script>')
# 最後の</script>の手前の<!-- 開発履歴 -->コメントも含めて置換するため
# まず</script>の位置を見つける
script_end_tag = '</script>'
# 開発履歴コメントも新しいバージョンのものに差し替えるため
# <script>から最初の</script>までを置換
first_script_end = html.index(script_end_tag, script_start) + len(script_end_tag)

html = html[:script_start] + new_js + html[first_script_end:]

# 4) 開発履歴コメントを更新
old_history = """<!--
===== 開発履歴 =====
v1.0 (2025): 初期リリース"""

new_history = """<!--
===== 開発履歴 =====
v1.0 (2025): 初期リリース"""

# タイトル更新
html = html.replace('<title>おまんぼガチャ</title>', '<title>おまんぼおみくじ</title>')

# サブタイトル更新
html = html.replace(
    '<p class="subtitle">左目をタップしてまわそう</p>',
    '<p class="subtitle">左目をタップしておみくじを引こう</p>'
)

# v1.1の開発履歴コメント末尾に v2.0 を追記
html = html.replace(
    '  - getEffectiveLimit() で実効上限を動的計算\n=================\n-->',
    '  - getEffectiveLimit() で実効上限を動的計算\nv2.0 (2026-05-02): おみくじ形式 & BASEクーポン対応\n  - 運勢テーブル（大吉/吉/中吉/小吉/末吉/凶）に刷新\n  - 日付ハッシュ方式クーポンコード生成（OMBN2026GCH + 日付 + 運勢キー）\n  - 献立データ100件追加（運勢別・おまんぼさんコメント付き）\n  - ポイント交換景品を非食品グッズに更新\n  - 6ヶ月継続（約1900pt）で最高景品（レーザー彫刻キーホルダー）と交換可能\n=================\n-->'
)

with open(target, 'w', encoding='utf-8') as f:
    f.write(html)

print("gacha_v2.html 生成完了！")

# 検証
with open(target, 'r', encoding='utf-8') as f:
    content = f.read()
total = (content.count("daigichi_dinners") + 1) * 0  # just read check
lines = content.count('\n')
print("行数:", lines)
print("fortune-label 存在:", 'fortune-label' in content)
print("dinner-box 存在:", 'dinner-box' in content)
print("coupon-section 存在:", 'coupon-section' in content)
print("dinnerMenus 存在:", 'dinnerMenus' in content)
print("genCode 存在:", 'genCode' in content)
print("fortunes 配列存在:", "var fortunes" in content)
print("exchangeItems 存在:", "var exchangeItems" in content)
