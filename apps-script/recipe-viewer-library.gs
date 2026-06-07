/**
 * ERG Recipe Viewer — shared LIBRARY (all logic lives here)
 * ---------------------------------------------------------------------------
 * Used as an Apps Script Library by the thin script bound to the shared recipe
 * Sheet. Add it via the bound project's Project Settings > Libraries with the
 * identifier  RVLib . Every brand is just a CONFIG object passed into these
 * functions — fix once here, bump the library version, all brands update.
 *
 * KEY MECHANICS (Apps Script library context):
 *  - SpreadsheetApp.getActiveSpreadsheet() / getUi() here resolve to the CALLING
 *    (bound) script's sheet + UI — i.e. the shared recipe Sheet. Good.
 *  - PropertiesService.getScriptProperties() here resolves to THIS library's
 *    properties — so the GitHub token is stored ONCE and shared by all brands.
 *    That's correct because one fine-grained PAT on the single repo
 *    (erg-recipe-viewer, Contents R/W) covers every brand's subpath.
 *
 * PUBLISH MODEL: build -> render (not splice-in-place). Each publish fetches the
 * shared /template/index.html, injects the brand's tokens + that brand's recipe
 * JSON, and commits the whole file to /<brand>/index.html. Offline-by-embedding
 * is preserved (data is still baked into each generated file).
 */

/* ============================== token ============================== */

function setGithubToken() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt(
    'GitHub token',
    'Paste your GitHub PAT (Contents: Read & Write on erg-recipe-viewer).\n' +
    'Stored privately in the LIBRARY Script Properties — shared by all brands.',
    ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  const token = res.getResponseText().trim();
  if (!token) { ui.alert('No token entered.'); return; }
  PropertiesService.getScriptProperties().setProperty('GITHUB_TOKEN', token);
  ui.alert('Token saved (shared by all brands).');
}

function token_() {
  return PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
}

/* ============================== publish ============================== */

/* Dry run — DIFF vs what's live for this brand, without publishing. */
function previewPublish(cfg) {
  const ui = SpreadsheetApp.getUi();
  const recipes = buildRecipes_(cfg);
  const tok = token_();
  let live = null;
  if (tok) {
    try {
      const cur = fetchRepoFile_(tok, cfg, cfg.outputPath, true);
      live = cur.text ? extractLiveRecipes_(cur.text) : null;
    } catch (e) { live = null; }
  }
  const d = diffRecipes_(recipes, live);
  ui.alert('Preview — ' + cfg.brandName, diffSummary_(d), ui.ButtonSet.OK);
}

/* Build data, render the template, diff vs live, confirm, commit to /<brand>/. */
function publishToSite(cfg) {
  const ui = SpreadsheetApp.getUi();
  const tok = token_();
  if (!tok) { ui.alert('No GitHub token set. Run Admin > Set / update GitHub token first.'); return; }

  const recipes = buildRecipes_(cfg);
  if (!recipes.length) {
    ui.alert('Nothing to publish for ' + cfg.brandName +
             ' — no live recipes (check status = live, and concept = ' + cfg.concept + ').');
    return;
  }

  const template = fetchRepoFile_(tok, cfg, cfg.templatePath, false).text;     // must exist
  const logoSvg  = cfg.logoPath ? (fetchRepoFile_(tok, cfg, cfg.logoPath, true).text || '') : '';
  const cur      = fetchRepoFile_(tok, cfg, cfg.outputPath, true);             // 404 ok (first publish)
  const live     = cur.text ? extractLiveRecipes_(cur.text) : null;
  const d        = diffRecipes_(recipes, live);

  if (d.hasLive && !d.added.length && !d.changed.length && !d.removed.length) {
    ui.alert(cfg.brandName + ': nothing to publish — the site already matches the Sheet (' + d.total + ' live).');
    return;
  }
  const ok = ui.alert('Publish ' + cfg.brandName + '?', diffSummary_(d), ui.ButtonSet.OK_CANCEL);
  if (ok !== ui.Button.OK) return;

  const rendered = renderTemplate_(template, cfg, logoSvg, recipes);
  if (cur.text && rendered === cur.text) { ui.alert(cfg.brandName + ': no changes detected.'); return; }

  const code = putRepoFile_(tok, cfg, cfg.outputPath, rendered, cur.sha,
    'Publish ' + cfg.brandName + ': ' + recipes.length + ' recipes (' + new Date().toISOString() + ')');
  if (code === 200 || code === 201) {
    ui.alert('Published ✅ — ' + cfg.brandName,
      d.added.length + ' new, ' + d.changed.length + ' changed, ' + d.removed.length + ' removed.\n' +
      recipes.length + ' recipes now live at /' + cfg.outputPath.replace(/index\.html$/, '') + '\n' +
      'Site updates in ~1 minute.', ui.ButtonSet.OK);
  } else {
    throw new Error('GitHub PUT failed (' + code + ') for ' + cfg.outputPath);
  }
}

/* Publish many brands back-to-back (each still confirms individually). */
function publishAll(cfgs) {
  cfgs.forEach(function (cfg) { publishToSite(cfg); });
}

/* Token replacement + recipe-data splice. */
function renderTemplate_(template, cfg, logoSvg, recipes) {
  let out = template;
  out = out.split('{{BRAND_NAME}}').join(cfg.brandName);
  out = out.split('{{BRAND_PRIMARY}}').join(cfg.brandPrimary);
  out = out.split('{{BRAND_ACCENT}}').join(cfg.brandAccent);
  out = out.split('{{BRAND_LOGO_SVG}}').join(logoSvg);

  const re = /(\/\* RECIPES:START[^\n]*\*\/)[\s\S]*?(\/\* RECIPES:END \*\/)/;
  if (!re.test(out)) throw new Error('Template missing RECIPES:START / RECIPES:END markers.');
  const json = JSON.stringify(recipes, null, 2);
  out = out.replace(re, function (m, start, end) {
    return start + '\n  const RECIPES = ' + json + ';\n  ' + end;
  });
  return out;
}

/* ========================= GitHub helpers ========================= */

function ghHeaders_(token) {
  return { Authorization: 'token ' + token, Accept: 'application/vnd.github+json' };
}
function ghContentsUrl_(cfg, path) {
  return 'https://api.github.com/repos/' + cfg.owner + '/' + cfg.repo + '/contents/' + encodeURI(path);
}

/* GET a repo file. Returns {text, sha}. 404 + allowMissing -> {null, null}. */
function fetchRepoFile_(token, cfg, path, allowMissing) {
  const res = UrlFetchApp.fetch(ghContentsUrl_(cfg, path) + '?ref=' + encodeURIComponent(cfg.branch),
                                { headers: ghHeaders_(token), muteHttpExceptions: true });
  const code = res.getResponseCode();
  if (code === 404 && allowMissing) return { text: null, sha: null };
  if (code !== 200) throw new Error('GitHub GET ' + path + ' failed (' + code + '): ' + res.getContentText());
  const meta = JSON.parse(res.getContentText());
  const text = Utilities.newBlob(
    Utilities.base64Decode(meta.content.replace(/\s/g, ''))).getDataAsString('UTF-8');
  return { text: text, sha: meta.sha };
}

/* PUT text content (create or update). */
function putRepoFile_(token, cfg, path, text, sha, message) {
  const payload = { message: message, content: Utilities.base64Encode(text, Utilities.Charset.UTF_8), branch: cfg.branch };
  if (sha) payload.sha = sha;
  const res = UrlFetchApp.fetch(ghContentsUrl_(cfg, path), {
    method: 'put', headers: ghHeaders_(token), contentType: 'application/json',
    payload: JSON.stringify(payload), muteHttpExceptions: true });
  return res.getResponseCode();
}

/* PUT raw bytes (images). */
function putRepoBytes_(token, cfg, path, bytes, sha, message) {
  const payload = { message: message, content: Utilities.base64Encode(bytes), branch: cfg.branch };
  if (sha) payload.sha = sha;
  const res = UrlFetchApp.fetch(ghContentsUrl_(cfg, path), {
    method: 'put', headers: ghHeaders_(token), contentType: 'application/json',
    payload: JSON.stringify(payload), muteHttpExceptions: true });
  return res.getResponseCode();
}

/* ===================== diff helpers (unchanged logic) ===================== */

function extractLiveRecipes_(htmlText) {
  try {
    const m = htmlText.match(/\/\* RECIPES:START[^\n]*\*\//  + '[\s\S]*?' + '\/\* RECIPES:END \*\//');
    if (!m) return null;
    const inner = m[1];
    const a = inner.indexOf('['), b = inner.lastIndexOf(']');
    if (a < 0 || b < 0 || b < a) return null;
    return JSON.parse(inner.slice(a, b + 1));
  } catch (e) {
    return null;
  }
}

function canon_(v) {
  if (Array.isArray(v)) return v.map(canon_);
  if (v && typeof v === 'object') {
    const o = {};
    Object.keys(v).sort().forEach(function (k) { o[k] = canon_(v[k]); });
    return o;
  }
  return v;
}

function diffRecipes_(next, live) {
  const result = { added: [], changed: [], removed: [], total: next.length, hasLive: false };
  if (!live) return result;
  result.hasLive = true;
  const liveBySlug = {}, nextBySlug = {};
  live.forEach(function (r) { if (r && r.slug) liveBySlug[r.slug] = r; });
  next.forEach(function (r) { if (r && r.slug) nextBySlug[r.slug] = r; });
  next.forEach(function (r) {
    if (!r.slug) return;
    if (!liveBySlug.hasOwnProperty(r.slug)) {
      result.added.push(r.name || r.slug);
    } else if (JSON.stringify(canon_(r)) !== JSON.stringify(canon_(liveBySlug[r.slug]))) {
      result.changed.push(r.name || r.slug);
    }
  });
  live.forEach(function (r) {
    if (r && r.slug && !nextBySlug.hasOwnProperty(r.slug)) result.removed.push(r.name || r.slug);
  });
  return result;
}

function diffSummary_(d) {
  if (!d.hasLive) {
    return d.total + ' live recipe(s) total.\n\n' +
           '(Couldn’t read the current site to compute exact changes — normal on the ' +
           'first publish to a new brand path. After that: new / changed / removed.)';
  }
  const head = d.added.length + ' new, ' + d.changed.length + ' changed, ' +
               d.removed.length + ' removed.\n' + d.total + ' recipe(s) live after publish.';
  function block(label, arr) {
    if (!arr.length) return '';
    return '\n\n' + label + ':\n' + arr.map(function (n) { return '• ' + n; }).join('\n');
  }
  return head + block('New', d.added) + block('Changed', d.changed) + block('Removed', d.removed);
}

/* ===================== data assembly (brand-scoped) ===================== */

function buildRecipes_(cfg) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const concept = cfg.concept ? String(cfg.concept).trim().toLowerCase() : null;

  // Child rows (Ingredients/Steps): include if the tab has no concept column yet
  // (pre-migration), if blank (untagged legacy row), or if it matches this brand.
  const childMatch = function (o) {
    if (!concept) return true;
    if (!('concept' in o)) return true;
    const c = String(o.concept || '').trim().toLowerCase();
    return c === '' || c === concept;
  };

  const recipes = readObjects_(ss, cfg.recipesTab).filter(function (r) {
    if (!r.slug || String(r.status).trim().toLowerCase() !== 'live') return false;
    if (concept && String(r.concept || '').trim().toLowerCase() !== concept) return false;
    return true;
  });
  const ingredients = readObjects_(ss, cfg.ingredientsTab).filter(childMatch);
  const steps       = readObjects_(ss, cfg.stepsTab).filter(childMatch);

  const ingBySlug  = groupBy_(ingredients, 'slug');
  const stepBySlug = groupBy_(steps, 'slug');

  return recipes.map(function (r) {
    const ings = (ingBySlug[r.slug] || [])
      .sort(function (a, b) { return num_(a.order) - num_(b.order); })
      .map(function (i) {
        return clean_({
          ingredient: i.ingredient, qty_1x: str_(i.qty_1x), qty_2x: str_(i.qty_2x),
          uom: i.uom, step_group: i.step_group, links_to: i.links_to
        });
      });
    const stps = (stepBySlug[r.slug] || [])
      .sort(function (a, b) { return num_(a.step_no) - num_(b.step_no); })
      .map(function (s) { return clean_({ text: s.text, step_group: s.step_group }); });
    return clean_({
      slug: r.slug, name: r.name, concept: r.concept, type: r.type || 'prep',
      yield_1x: r.yield_1x, yield_2x: r.yield_2x,
      prep_time: r.prep_time, shelf_life: r.shelf_life,
      plate: r.plate, image_url: r.image_url, note: r.note, category: r.category,
      status: 'live', ingredients: ings, steps: stps
    });
  });
}

function readObjects_(ss, tabName) {
  const sh = ss.getSheetByName(tabName);
  if (!sh) throw new Error('Missing tab: ' + tabName);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(function (h) { return String(h).trim(); });
  return values.slice(1)
    .filter(function (row) { return row.some(function (c) { return String(c).trim() !== ''; }); })
    .map(function (row) {
      const o = {};
      headers.forEach(function (h, i) { if (h) o[h] = row[i]; });
      return o;
    });
}

function groupBy_(arr, key) {
  const m = {};
  arr.forEach(function (o) {
    const k = String(o[key]).trim();
    if (!k) return;
    (m[k] = m[k] || []).push(o);
  });
  return m;
}

function num_(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
function str_(v) { return (v === '' || v == null) ? '' : String(v); }

function clean_(o) {
  const out = {};
  Object.keys(o).forEach(function (k) {
    const v = o[k];
    if (Array.isArray(v)) { out[k] = v; return; }
    if (v === '' || v == null) return;
    out[k] = v;
  });
  return out;
}

/* ===================== validation / dropdowns ===================== */

var CONFIG_TAB_     = 'Config';
var DEFAULT_UOMS_   = ['oz-wt','oz-fl','lbs','ltr','tsp','tbsp','pint','qt',
                       'gal','grs','kg','cup','ea','bunch','pinch','slices',
                       'sprig','a/n','serving'];

/**
 * Returns the UOM list from the Config tab (column A, skipping header).
 * Creates the Config tab with defaults if it doesn't exist yet.
 */
function getOrCreateUomList_(ss) {
  var tab = ss.getSheetByName(CONFIG_TAB_);
  if (!tab) {
    tab = ss.insertSheet(CONFIG_TAB_);
    tab.getRange(1, 1).setValue('uom');
    tab.getRange(2, 1, DEFAULT_UOMS_.length, 1).setValues(DEFAULT_UOMS_.map(function(u){ return [u]; }));
    tab.getRange(1, 1).setFontWeight('bold');
    SpreadsheetApp.flush();
  }
  var vals = tab.getRange(2, 1, tab.getLastRow() - 1, 1).getValues();
  return vals.map(function(r){ return String(r[0]).trim(); }).filter(function(v){ return v; });
}

/* opts: { recipesTab, ingredientsTab, stepsTab, concepts: [..] } */
function setupValidation(opts) {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var rec = ss.getSheetByName(opts.recipesTab);
  var ing = ss.getSheetByName(opts.ingredientsTab);
  var stp = ss.getSheetByName(opts.stepsTab);
  if (!rec || !ing) throw new Error('Missing Recipes or Ingredients tab.');

  var uoms = getOrCreateUomList_(ss);
  applyListByHeader_(ing, 'uom',    uoms);
  applyListByHeader_(rec, 'type',   ['prep','plate']);
  applyListByHeader_(rec, 'status', ['live','draft']);

  applyListByHeader_(rec, 'concept', opts.concepts);
  applyListByHeader_(ing, 'concept', opts.concepts);
  if (stp) applyListByHeader_(stp, 'concept', opts.concepts);

  SpreadsheetApp.getUi().alert(
    '✅  Dropdowns updated\n\n' +
    '• UOM list: ' + uoms.length + ' units loaded from the Config tab\n' +
    '• Recipes: type and status dropdowns set\n' +
    '• All tabs: concept/brand dropdown set\n\n' +
    'To add a new unit of measure, edit the Config tab (column A) and re-run this menu item.');
}

function headerCol_(sheet, header) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return 0;
  var hdr = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var i = 0; i < hdr.length; i++) {
    if (String(hdr[i]).trim().toLowerCase() === header.toLowerCase()) return i + 1;
  }
  return 0;
}

function applyListByHeader_(sheet, header, values) {
  var col = headerCol_(sheet, header);
  if (!col) { Logger.log('Header "' + header + '" not found on ' + sheet.getName() + ' — skipped.'); return; }
  var lastRow = sheet.getMaxRows();
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(values, true).setAllowInvalid(false).build();
  sheet.getRange(2, col, lastRow - 1, 1).setDataValidation(rule);
}

/* ===================== image sync (brand-scoped) ===================== */

function syncDropPhotos(cfg) {
  const ui = SpreadsheetApp.getUi();
  const tok = token_();
  if (!tok) { ui.alert('No GitHub token set — run Admin > Set / update GitHub token first.'); return; }
  if (!cfg.dropFolderId || !cfg.doneFolderId || !cfg.reviewFolderId) {
    ui.alert(cfg.brandName + ': photo folders not configured yet (dropFolderId / doneFolderId / reviewFolderId).');
    return;
  }

  const idx = loadRecipeIndex_(cfg);
  const done = DriveApp.getFolderById(cfg.doneFolderId);
  const review = DriveApp.getFolderById(cfg.reviewFolderId);
  const committed = [], bounced = [];

  const files = DriveApp.getFolderById(cfg.dropFolderId).getFiles();
  while (files.hasNext()) {
    const f = files.next(), name = f.getName(), key = slugify_(name);
    const rec = idx.byKey[key];

    if (!rec) {
      const guess = closestSlug_(key, idx.plateSlugs);
      f.moveTo(review);
      bounced.push({ name: name, url: f.getUrl(), reason: 'No ' + cfg.brandName + ' recipe matches “' + key + '”.',
        fix: guess ? 'Did you mean “' + guess + '”? Rename the file to ' + guess + ' (keep the extension) and move it back to Add New Photos Here.'
                   : 'Rename the file to the dish’s exact slug, then move it back to Add New Photos Here.' });
      continue;
    }
    if (rec.type !== 'plate' && rec.type !== 'menu') {
      f.moveTo(review);
      bounced.push({ name: name, url: f.getUrl(),
        reason: '“' + rec.slug + '” is a ' + (rec.type || 'non-plate') + ' recipe; photos only show on Plate recipes.',
        fix: 'If it should be a Plate, set its type to “plate” in the Recipes tab, then move the file back. Otherwise remove it.' });
      continue;
    }

    const blob = getThumbnailJpeg_(f.getId(), cfg.thumbWidth || 1600);
    if (!blob) {
      f.moveTo(review);
      bounced.push({ name: name, url: f.getUrl(), reason: 'Couldn’t read this file as an image.',
        fix: 'Make sure it’s a normal photo (JPEG/HEIC/PNG), then move it back to Add New Photos Here.' });
      continue;
    }

    const code = commitImage_(tok, cfg, rec.slug, blob);
    if (code === 200 || code === 201) {
      const ext = (name.match(/\.[^.]+$/) || ['.jpg'])[0];
      f.setName(rec.slug + ext);
      f.moveTo(done);
      committed.push({ name: name, slug: rec.slug });
    } else {
      f.moveTo(review);
      bounced.push({ name: name, url: f.getUrl(), reason: 'GitHub rejected the upload (HTTP ' + code + ').', fix: 'Leave it here — IT will look.' });
    }
  }

  logSync_(cfg, committed, bounced);
  if (bounced.length) notifyBounces_(cfg, bounced, committed);
  Logger.log(cfg.brandName + ' sync done. committed=' + committed.length + '  bounced=' + bounced.length);
}

function loadRecipeIndex_(cfg) {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), byKey = {}, plateSlugs = [];
  const concept = cfg.concept ? String(cfg.concept).trim().toLowerCase() : null;
  readObjects_(ss, cfg.recipesTab).forEach(function (r) {
    if (concept && String(r.concept || '').trim().toLowerCase() !== concept) return;
    const slug = String(r.slug || '').trim(); if (!slug) return;
    const type = String(r.type || '').trim().toLowerCase();
    const rec = { slug: slug, type: type, name: String(r.name || '').trim() };
    byKey[slug] = rec;
    const nk = slugify_(rec.name); if (nk) byKey[nk] = rec;
    if (type === 'plate' || type === 'menu') plateSlugs.push(slug);
  });
  return { byKey: byKey, plateSlugs: plateSlugs };
}

function slugify_(s) {
  return String(s).replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function closestSlug_(key, slugs) {
  let best = '', bestD = 1e9;
  slugs.forEach(function (s) { const d = lev_(key, s); if (d < bestD) { bestD = d; best = s; } });
  return bestD <= Math.max(3, Math.floor(key.length / 3)) ? best : '';
}

function lev_(a, b) {
  const m = a.length, n = b.length, dp = Array.from({ length: m + 1 }, function (_, i) { return [i].concat(new Array(n).fill(0)); });
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[m][n];
}

function getThumbnailJpeg_(id, width) {
  const url = 'https://drive.google.com/thumbnail?id=' + id + '&sz=w' + (width || 1600);
  let res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200 || res.getBlob().getContentType().indexOf('image/') !== 0)
    res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200 || res.getBlob().getContentType().indexOf('image/') !== 0) return null;
  return res.getBlob();
}

function commitImage_(token, cfg, slug, blob) {
  const path = cfg.imageDir + '/' + slug + '.jpg';
  let sha = null;
  const get = UrlFetchApp.fetch(ghContentsUrl_(cfg, path) + '?ref=' + encodeURIComponent(cfg.branch),
                                { headers: ghHeaders_(token), muteHttpExceptions: true });
  if (get.getResponseCode() === 200) sha = JSON.parse(get.getContentText()).sha;
  return putRepoBytes_(token, cfg, path, blob.getBytes(), sha, 'Image: ' + path + ' (' + new Date().toISOString() + ')');
}

function logSync_(cfg, committed, bounced) {
  if (!committed.length && !bounced.length) return;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('Image Sync Log') || ss.insertSheet('Image Sync Log');
  if (sh.getLastRow() === 0) sh.appendRow(['when', 'brand', 'result', 'detail']);
  const ts = new Date();
  committed.forEach(function (c) { sh.appendRow([ts, cfg.brandName, 'committed', c.name + ' → ' + cfg.imageDir + '/' + c.slug + '.jpg']); });
  bounced.forEach(function (b) { sh.appendRow([ts, cfg.brandName, 'needs review', b.name + ' — ' + b.reason]); });
}

function notifyBounces_(cfg, bounced, committed) {
  const folder = 'https://drive.google.com/drive/folders/' + cfg.reviewFolderId;
  let html = '<p>' + cfg.brandName + ': ' + bounced.length + ' photo(s) moved to <a href="' + folder +
             '">Upload Failed - Needs Review</a> and need a quick fix:</p>';
  bounced.forEach(function (b) {
    html += '<p style="margin:0 0 14px">• <a href="' + b.url + '"><b>' + b.name + '</b></a><br>' +
            '&nbsp;&nbsp;<b>Why:</b> ' + b.reason + '<br>&nbsp;&nbsp;<b>Fix:</b> ' + b.fix + '</p>';
  });
  if (committed.length) html += '<p>(' + committed.length + ' other photo(s) published fine.)</p>';
  MailApp.sendEmail({ to: cfg.notifyEmail, subject: cfg.brandName + ' photo sync — ' + bounced.length + ' need review', htmlBody: html });
}

/* Photo cheat sheet across all supplied brands. cfgs = array of brand CONFIGs. */
function generateImageCheatSheet(cfgs) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tok = token_();
  const rows = [['Brand', 'Dish (Plate only)', 'Name the photo file exactly', 'Uploaded?']];
  cfgs.forEach(function (cfg) {
    const have = tok ? listRepoImages_(tok, cfg) : null;
    const concept = cfg.concept ? String(cfg.concept).trim().toLowerCase() : null;
    readObjects_(ss, cfg.recipesTab)
      .filter(function (r) {
        if (concept && String(r.concept || '').trim().toLowerCase() !== concept) return false;
        const t = String(r.type || '').trim().toLowerCase();
        return r.slug && (t === 'plate' || t === 'menu');
      })
      .sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); })
      .forEach(function (r) {
        const slug = String(r.slug).trim();
        rows.push([cfg.brandName, r.name, slug + '.jpg', !have ? '(token not set)' : (have.has(slug + '.jpg') ? 'yes' : 'no')]);
      });
  });
  const sh = ss.getSheetByName('Photo Cheat Sheet') || ss.insertSheet('Photo Cheat Sheet');
  sh.clear();
  sh.getRange(1, 1, rows.length, 4).setValues(rows);
  sh.setFrozenRows(1);
  ss.toast((rows.length - 1) + ' plates listed across brands.', 'Photo Cheat Sheet updated');
}

function listRepoImages_(token, cfg) {
  const u = ghContentsUrl_(cfg, cfg.imageDir) + '?ref=' + encodeURIComponent(cfg.branch);
  const res = UrlFetchApp.fetch(u, { headers: ghHeaders_(token), muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return new Set();
  return new Set(JSON.parse(res.getContentText()).map(function (f) { return f.name; }));
}
