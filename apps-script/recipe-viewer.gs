/**
 * ERG Recipe Viewer — single Apps Script project bound to the shared recipe Sheet.
 * Auto-deployed via GitHub Actions + CLASP. Test 3.
 *
 * ONE-TIME SETUP
 *  1. Open the recipe Sheet → Extensions > Apps Script
 *  2. Paste this entire file (replace any existing code), save.
 *  3. Reload the Sheet. Run Recipe Viewer > Admin (IT) > Set / update GitHub token.
 *  4. Run Recipe Viewer > Admin (IT) > Set up dropdowns
 *     (creates the Config tab with the UOM list on first run).
 *  5. Publish each brand from its submenu.
 *
 * UOM MANAGEMENT: add or remove units directly in the Config sheet tab (column A),
 * then re-run "Set up dropdowns" — no script changes needed.
 */

/* ============================================================
   CONFIGURATION — edit brand details here
   ============================================================ */

var REPO          = { owner: 'nickg-erg', repo: 'erg-recipe-viewer', branch: 'main', templatePath: 'template/index.html' };
var TABS          = { recipesTab: 'Recipes', ingredientsTab: 'Ingredients', stepsTab: 'Steps' };
var ADMINS        = ['nick.giangregorio@eurekarestaurantgroup.com'];
var NOTIFY_EMAIL  = 'nick.giangregorio@eurekarestaurantgroup.com';

function brand_(o) {
  return Object.assign({}, REPO, TABS, { notifyEmail: NOTIFY_EMAIL, thumbWidth: 1200 }, o);
}

var BRANDS = {
  eureka: brand_({
    brandName: 'Eureka', concept: 'Eureka',
    brandPrimary: '#FF671D', brandAccent: '#0369A1',
    outputPath: 'eureka/index.html', logoPath: 'eureka/logo.svg', imageDir: 'eureka/images',
    dropFolderId:   '183AGv_ol_pDT-06u4b9ogk2fNFnzmrsr',
    doneFolderId:   '1gHU5PMr2TU6-h0rj-TBcMOYhN-WY5msN',
    reviewFolderId: '1Y64622PugB9_6wzVqnC1c4kAtNdhCN5U'
  }),
  lapopular: brand_({
    brandName: 'La Popular', concept: 'La Popular',
    brandPrimary: '#C99D66', brandAccent: '#2E6E73',
    outputPath: 'lapopular/index.html', logoPath: 'lapopular/logo.svg', imageDir: 'lapopular/images',
    sourceFolderId: '1kkKillNpDiSZxYg81NbVDvp4PE-1DzPI',
    dropFolderId:   '1MVyGWQSy3nqvKSg-MVSjslpFUPiTE2eH',
    doneFolderId:   '1Ggk9tCneneUkf8tIdYiOA5m_Ocwn4AuI',
    reviewFolderId: '1fe3QTTuu7K1Ad8pAuuNs9ABkm_wLrFPX'
  }),
  amalfi: brand_({
    brandName: 'Amalfi Llama', concept: 'Amalfi Llama',
    brandPrimary: '#1A1A1A', brandAccent: '#910707',
    outputPath: 'amalfillama/index.html', logoPath: 'amalfillama/logo.svg', imageDir: 'amalfillama/images',
    sourceFolderId: '13v7GMV3RM3ucmJr2vq8CbHc5u9U8h2W-',
    dropFolderId:   '1fB5BqCoveXFxCv91pkeJQaJnZ9Ft2c2b',
    doneFolderId:   '1YXPXJSfYMOhaKs_8QWcgcuYF70AclHjj',
    reviewFolderId: '1JSLmUgSCHYopDeOFHhGuFK3aqpPVpRaG'
  })
};
var ALL = [BRANDS.eureka, BRANDS.lapopular, BRANDS.amalfi];

/* ============================================================
   MENU
   ============================================================ */

function onOpen() {
  var ui   = SpreadsheetApp.getUi();
  var menu = ui.createMenu('Recipe Viewer');

  [['Eureka', 'Eureka'], ['La Popular', 'LaPopular'], ['Amalfi Llama', 'Amalfi']].forEach(function (p) {
    menu.addSubMenu(ui.createMenu(p[0])
      .addItem('Publish to site',              'publish' + p[1])
      .addItem('Preview what will publish',    'preview' + p[1])
      .addItem('Sync new photos now',          'sync'    + p[1])
      .addItem('Stage source photos → Drop',   'stage'   + p[1]));
  });
  menu.addSeparator().addItem('Publish ALL brands', 'publishAll');

  var admin = false;
  try { admin = ADMINS.indexOf(Session.getEffectiveUser().getEmail()) !== -1; } catch (e) {}
  if (admin) {
    menu.addSeparator().addSubMenu(ui.createMenu('Admin (IT)')
      .addItem('Refresh photo cheat sheet',          'refreshCheatSheet')
      .addItem('Clean LP drop folder (one-time)',    'cleanDropFolderLaPopular')
      .addItem('Clean Amalfi drop folder (one-time)','cleanDropFolderAmalfi')
      .addItem('Clean Amalfi review folder (one-time)','cleanAmalfiReviewFolder')
      .addItem('Delete .jpeg duplicates — Eureka',   'cleanJpegDupsEureka')
      .addItem('Delete .jpeg duplicates — La Popular','cleanJpegDupsLaPopular')
      .addItem('Delete .jpeg duplicates — Amalfi',   'cleanJpegDupsAmalfi')
      .addSeparator()
      .addItem('Set / update GitHub token',          'setToken')
      .addItem('Set up dropdowns',           'setupDropdowns'));
  }
  menu.addToUi();
}

function publishEureka()    { publishToSite(BRANDS.eureka); }
function previewEureka()    { previewPublish(BRANDS.eureka); }
function syncEureka()       { syncDropPhotos(BRANDS.eureka); }
function stageEureka()      { importSourcePhotos(BRANDS.eureka); }

function publishLaPopular() { publishToSite(BRANDS.lapopular); }
function previewLaPopular() { previewPublish(BRANDS.lapopular); }
function syncLaPopular()    { syncDropPhotos(BRANDS.lapopular); }
function stageLaPopular()   { importSourcePhotos(BRANDS.lapopular); }

function publishAmalfi()    { publishToSite(BRANDS.amalfi); }
function previewAmalfi()    { previewPublish(BRANDS.amalfi); }
function syncAmalfi()       { syncDropPhotos(BRANDS.amalfi); }
function stageAmalfi()      { importSourcePhotos(BRANDS.amalfi); }

function publishAll()          { ALL.forEach(function (cfg) { publishToSite(cfg); }); }
function refreshCheatSheet()   { generateImageCheatSheet(ALL); }
function cleanJpegDupsEureka() { deleteNonJpgImages(BRANDS.eureka); }
function cleanJpegDupsLaPopular() { deleteNonJpgImages(BRANDS.lapopular); }
function cleanJpegDupsAmalfi() { deleteNonJpgImages(BRANDS.amalfi); }
function setToken()         { setGithubToken(); }
function setupDropdowns()   {
  setupValidation({
    recipesTab:     TABS.recipesTab,
    ingredientsTab: TABS.ingredientsTab,
    stepsTab:       TABS.stepsTab,
    concepts:       ['Eureka', 'La Popular', 'Amalfi Llama']
  });
}

/* ============================================================
   GITHUB TOKEN
   ============================================================ */

function setGithubToken() {
  var ui  = SpreadsheetApp.getUi();
  var res = ui.prompt(
    'GitHub token',
    'Paste your GitHub PAT (Contents: Read & Write on erg-recipe-viewer).',
    ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  var token = res.getResponseText().trim();
  if (!token) { ui.alert('No token entered.'); return; }
  PropertiesService.getScriptProperties().setProperty('GITHUB_TOKEN', token);
  ui.alert('Token saved.');
}

function token_() {
  return PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
}

/* ============================================================
   PUBLISH
   ============================================================ */

function previewPublish(cfg) {
  var ui      = SpreadsheetApp.getUi();
  var recipes = buildRecipes_(cfg);
  var tok     = token_();
  var live    = null;
  if (tok) {
    try {
      var cur = fetchRepoFile_(tok, cfg, cfg.outputPath, true);
      live = cur.text ? extractLiveRecipes_(cur.text) : null;
    } catch (e) { live = null; }
  }
  ui.alert('Preview — ' + cfg.brandName, diffSummary_(diffRecipes_(recipes, live)), ui.ButtonSet.OK);
}

function publishToSite(cfg) {
  var ui  = SpreadsheetApp.getUi();
  var tok = token_();
  if (!tok) { ui.alert('No GitHub token — run Admin > Set / update GitHub token first.'); return; }

  var recipes = buildRecipes_(cfg);
  if (!recipes.length) {
    ui.alert('Nothing to publish for ' + cfg.brandName +
             ' — no live recipes (check status = live and concept = ' + cfg.concept + ').');
    return;
  }

  var template = fetchRepoFile_(tok, cfg, cfg.templatePath, false).text;
  var logoSvg  = cfg.logoPath ? (fetchRepoFile_(tok, cfg, cfg.logoPath, true).text || '') : '';
  var cur      = fetchRepoFile_(tok, cfg, cfg.outputPath, true);
  var live     = cur.text ? extractLiveRecipes_(cur.text) : null;
  var d        = diffRecipes_(recipes, live);

  if (d.hasLive && !d.added.length && !d.changed.length && !d.removed.length) {
    ui.alert(cfg.brandName + ': nothing to publish — site already matches the Sheet (' + d.total + ' live).');
    return;
  }
  if (ui.alert('Publish ' + cfg.brandName + '?', diffSummary_(d), ui.ButtonSet.OK_CANCEL) !== ui.Button.OK) return;

  var rendered = renderTemplate_(template, cfg, logoSvg, recipes);
  if (cur.text && rendered === cur.text) { ui.alert(cfg.brandName + ': no changes detected.'); return; }

  var code = putRepoFile_(tok, cfg, cfg.outputPath, rendered, cur.sha,
    'Publish ' + cfg.brandName + ': ' + recipes.length + ' recipes (' + new Date().toISOString() + ')');
  if (code === 200 || code === 201) {
    ui.alert('Published ✅ — ' + cfg.brandName,
      d.added.length + ' new, ' + d.changed.length + ' changed, ' + d.removed.length + ' removed.\n' +
      recipes.length + ' recipes now live.\nSite updates in ~1 minute.', ui.ButtonSet.OK);
  } else {
    throw new Error('GitHub PUT failed (' + code + ') for ' + cfg.outputPath);
  }
}

function renderTemplate_(template, cfg, logoSvg, recipes) {
  var out = template
    .split('{{BRAND_NAME}}').join(cfg.brandName)
    .split('{{BRAND_PRIMARY}}').join(cfg.brandPrimary)
    .split('{{BRAND_ACCENT}}').join(cfg.brandAccent)
    .split('{{BRAND_LOGO_SVG}}').join(logoSvg);
  var re = /(\/\* RECIPES:START[^\n]*\*\/)[\s\S]*?(\/\* RECIPES:END \*\/)/;
  if (!re.test(out)) throw new Error('Template missing RECIPES:START / RECIPES:END markers.');
  var json = JSON.stringify(recipes, null, 2);
  return out.replace(re, function (m, start, end) {
    return start + '\n  const RECIPES = ' + json + ';\n  ' + end;
  });
}

/* ============================================================
   GITHUB HELPERS
   ============================================================ */

function ghHeaders_(token) {
  return { Authorization: 'token ' + token, Accept: 'application/vnd.github+json' };
}
function ghContentsUrl_(cfg, path) {
  return 'https://api.github.com/repos/' + cfg.owner + '/' + cfg.repo + '/contents/' + encodeURI(path);
}

function fetchRepoFile_(token, cfg, path, allowMissing) {
  var res = UrlFetchApp.fetch(
    ghContentsUrl_(cfg, path) + '?ref=' + encodeURIComponent(cfg.branch),
    { headers: ghHeaders_(token), muteHttpExceptions: true });
  var code = res.getResponseCode();
  if (code === 404 && allowMissing) return { text: null, sha: null };
  if (code !== 200) throw new Error('GitHub GET ' + path + ' failed (' + code + '): ' + res.getContentText());
  var meta = JSON.parse(res.getContentText());
  return {
    text: Utilities.newBlob(Utilities.base64Decode(meta.content.replace(/\s/g, ''))).getDataAsString('UTF-8'),
    sha:  meta.sha
  };
}

function putRepoFile_(token, cfg, path, text, sha, message) {
  var payload = { message: message, content: Utilities.base64Encode(text, Utilities.Charset.UTF_8), branch: cfg.branch };
  if (sha) payload.sha = sha;
  return UrlFetchApp.fetch(ghContentsUrl_(cfg, path), {
    method: 'put', headers: ghHeaders_(token), contentType: 'application/json',
    payload: JSON.stringify(payload), muteHttpExceptions: true
  }).getResponseCode();
}

function putRepoBytes_(token, cfg, path, bytes, sha, message) {
  var payload = { message: message, content: Utilities.base64Encode(bytes), branch: cfg.branch };
  if (sha) payload.sha = sha;
  return UrlFetchApp.fetch(ghContentsUrl_(cfg, path), {
    method: 'put', headers: ghHeaders_(token), contentType: 'application/json',
    payload: JSON.stringify(payload), muteHttpExceptions: true
  }).getResponseCode();
}

/* ============================================================
   DIFF HELPERS
   ============================================================ */

function extractLiveRecipes_(html) {
  try {
    var m = html.match(/\/\* RECIPES:START[\s\S]*?const RECIPES = (\[[\s\S]*?\]);\s*\/\* RECIPES:END \*\//);
    return m ? JSON.parse(m[1]) : null;
  } catch (e) { return null; }
}

function canon_(v) {
  if (Array.isArray(v)) return v.map(canon_);
  if (v && typeof v === 'object') {
    var o = {};
    Object.keys(v).sort().forEach(function (k) { o[k] = canon_(v[k]); });
    return o;
  }
  return v;
}

function diffRecipes_(next, live) {
  var result = { added: [], changed: [], removed: [], total: next.length, hasLive: !!live };
  if (!live) return result;
  var liveBySlug = {}, nextBySlug = {};
  live.forEach(function (r) { if (r && r.slug) liveBySlug[r.slug] = r; });
  next.forEach(function (r) { if (r && r.slug) nextBySlug[r.slug] = r; });
  next.forEach(function (r) {
    if (!r.slug) return;
    if (!liveBySlug.hasOwnProperty(r.slug)) result.added.push(r.name || r.slug);
    else if (JSON.stringify(canon_(r)) !== JSON.stringify(canon_(liveBySlug[r.slug]))) result.changed.push(r.name || r.slug);
  });
  live.forEach(function (r) {
    if (r && r.slug && !nextBySlug.hasOwnProperty(r.slug)) result.removed.push(r.name || r.slug);
  });
  return result;
}

function diffSummary_(d) {
  if (!d.hasLive) {
    return d.total + ' live recipe(s) ready to publish.\n\n' +
           '(No existing site to diff against — normal on first publish for a new brand.)';
  }
  var head = d.added.length + ' new, ' + d.changed.length + ' changed, ' +
             d.removed.length + ' removed.\n' + d.total + ' recipe(s) live after publish.';
  function block(label, arr) {
    return arr.length ? '\n\n' + label + ':\n' + arr.map(function (n) { return '• ' + n; }).join('\n') : '';
  }
  return head + block('New', d.added) + block('Changed', d.changed) + block('Removed', d.removed);
}

/* ============================================================
   DATA ASSEMBLY
   ============================================================ */

function buildRecipes_(cfg) {
  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var concept = cfg.concept ? String(cfg.concept).trim().toLowerCase() : null;

  function childMatch(o) {
    if (!concept) return true;
    var c = String(o.concept || '').trim().toLowerCase();
    return c === '' || c === concept;
  }

  var recipes     = readObjects_(ss, cfg.recipesTab).filter(function (r) {
    if (!r.slug || String(r.status).trim().toLowerCase() !== 'live') return false;
    if (concept && String(r.concept || '').trim().toLowerCase() !== concept) return false;
    return true;
  });
  var ingredients = readObjects_(ss, cfg.ingredientsTab).filter(childMatch);
  var steps       = readObjects_(ss, cfg.stepsTab).filter(childMatch);
  var ingBySlug   = groupBy_(ingredients, 'slug');
  var stepBySlug  = groupBy_(steps, 'slug');

  return recipes.map(function (r) {
    var ings = (ingBySlug[r.slug] || [])
      .sort(function (a, b) { return num_(a.order) - num_(b.order); })
      .map(function (i) {
        return clean_({ ingredient: i.ingredient, qty_1x: str_(i.qty_1x), qty_2x: str_(i.qty_2x),
                        uom: i.uom, step_group: i.step_group, links_to: i.links_to });
      });
    var stps = (stepBySlug[r.slug] || [])
      .sort(function (a, b) { return num_(a.step_no) - num_(b.step_no); })
      .map(function (s) { return clean_({ text: s.text, step_group: s.step_group }); });
    return clean_({
      slug: r.slug, name: r.name, concept: r.concept, type: r.type || 'prep',
      yield_1x: r.yield_1x, yield_2x: r.yield_2x, prep_time: r.prep_time, shelf_life: r.shelf_life,
      plate: r.plate, image_url: r.image_url, note: r.note, category: r.category,
      status: 'live', ingredients: ings, steps: stps
    });
  });
}

function readObjects_(ss, tabName) {
  var sh = ss.getSheetByName(tabName);
  if (!sh) throw new Error('Missing tab: ' + tabName);
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0].map(function (h) { return String(h).trim(); });
  return values.slice(1)
    .filter(function (row) { return row.some(function (c) { return String(c).trim() !== ''; }); })
    .map(function (row) {
      var o = {};
      headers.forEach(function (h, i) { if (h) o[h] = row[i]; });
      return o;
    });
}

function groupBy_(arr, key) {
  var m = {};
  arr.forEach(function (o) {
    var k = String(o[key]).trim();
    if (k) (m[k] = m[k] || []).push(o);
  });
  return m;
}

function num_(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }
function str_(v) { return (v === '' || v == null) ? '' : String(v); }

function clean_(o) {
  var out = {};
  Object.keys(o).forEach(function (k) {
    var v = o[k];
    if (Array.isArray(v)) { out[k] = v; return; }
    if (v !== '' && v != null) out[k] = v;
  });
  return out;
}

/* ============================================================
   VALIDATION / DROPDOWNS
   ============================================================ */

var CONFIG_TAB_   = 'Config';
var DEFAULT_UOMS_ = [
  'oz-wt','oz-fl','lbs','ltr','tsp','tbsp','pint','qt',
  'gal','grs','kg','cup','ea','bunch','pinch','slices',
  'sprig','a/n','serving'
];

/*
 * Returns UOMs from the Config tab (column A, below header).
 * Auto-creates the tab with DEFAULT_UOMS_ if it doesn't exist yet.
 */
function getOrCreateUomList_(ss) {
  var tab = ss.getSheetByName(CONFIG_TAB_);
  if (!tab) {
    tab = ss.insertSheet(CONFIG_TAB_);
    tab.getRange(1, 1).setValue('uom').setFontWeight('bold');
    tab.getRange(2, 1, DEFAULT_UOMS_.length, 1)
       .setValues(DEFAULT_UOMS_.map(function (u) { return [u]; }));
    SpreadsheetApp.flush();
  }
  return tab.getRange(2, 1, Math.max(tab.getLastRow() - 1, 1), 1)
    .getValues()
    .map(function (r) { return String(r[0]).trim(); })
    .filter(function (v) { return v; });
}

function setupValidation(opts) {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var rec = ss.getSheetByName(opts.recipesTab);
  var ing = ss.getSheetByName(opts.ingredientsTab);
  var stp = ss.getSheetByName(opts.stepsTab);
  if (!rec || !ing) throw new Error('Missing Recipes or Ingredients tab.');

  var uoms = getOrCreateUomList_(ss);
  applyListByHeader_(ing, 'uom',     uoms);
  applyListByHeader_(rec, 'type',    ['prep', 'plate']);
  applyListByHeader_(rec, 'status',  ['live', 'draft']);
  applyListByHeader_(rec, 'concept', opts.concepts);
  applyListByHeader_(ing, 'concept', opts.concepts);
  if (stp) applyListByHeader_(stp, 'concept', opts.concepts);

  SpreadsheetApp.getUi().alert(
    '✅  Dropdowns updated\n\n' +
    '• UOM: ' + uoms.length + ' units (from Config tab — edit that tab to add more)\n' +
    '• Recipes: type, status dropdowns set\n' +
    '• All tabs: concept/brand dropdown set');
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
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(values, true).setAllowInvalid(false).build();
  sheet.getRange(2, col, sheet.getMaxRows() - 1, 1).setDataValidation(rule);
}

/* ============================================================
   PHOTO SYNC
   ============================================================ */

function syncDropPhotos(cfg) {
  var ui  = SpreadsheetApp.getUi();
  var tok = token_();
  if (!tok) { ui.alert('No GitHub token — run Admin > Set / update GitHub token first.'); return; }
  if (!cfg.dropFolderId || !cfg.doneFolderId || !cfg.reviewFolderId) {
    ui.alert(cfg.brandName + ': photo folders not configured (dropFolderId / doneFolderId / reviewFolderId).'); return;
  }

  var idx       = loadRecipeIndex_(cfg);
  var done      = DriveApp.getFolderById(cfg.doneFolderId);
  var review    = DriveApp.getFolderById(cfg.reviewFolderId);
  var committed = [], bounced = [];
  var files     = DriveApp.getFolderById(cfg.dropFolderId).getFiles();

  while (files.hasNext()) {
    var f    = files.next();
    var name = f.getName();
    var key  = slugify_(name);
    var rec  = idx.byKey[key];

    if (!rec) {
      var guess = closestSlug_(key, idx.plateSlugs);
      f.moveTo(review);
      bounced.push({ name: name, url: f.getUrl(),
        reason: 'No ' + cfg.brandName + ' recipe matches "' + key + '".',
        fix: guess
          ? 'Did you mean "' + guess + '"? Rename to ' + guess + ' (keep extension) and move back to Add New Photos Here.'
          : 'Rename the file to the dish\'s exact slug, then move it back to Add New Photos Here.' });
      continue;
    }

    var ext    = (name.match(/(\.[^.]+)$/) || ['.jpg'])[0].toLowerCase();
    var isHeic = ext === '.heic' || ext === '.heif';
    // Always go through the thumbnail endpoint — resizes to target width AND converts HEIC→JPEG
    var blob = getThumbnailJpeg_(f.getId(), cfg.thumbWidth || 1600);
    if (!blob) {
      f.moveTo(review);
      bounced.push({ name: name, url: f.getUrl(),
        reason: 'Couldn\'t read this file as an image.',
        fix: 'Make sure it\'s a normal photo (JPEG/HEIC/PNG), then move it back to Add New Photos Here.' });
      continue;
    }

    // Commit resized JPEG to GitHub
    var code = commitImage_(tok, cfg, rec.slug, blob, '.jpg');
    if (code === 200 || code === 201) {
      // Save resized JPEG to Done folder (matches GitHub exactly), trash the original
      blob.setName(rec.slug + '.jpg').setContentType('image/jpeg');
      done.createFile(blob);
      f.setTrashed(true);
      committed.push({ name: name, slug: rec.slug });
    } else {
      f.moveTo(review);
      bounced.push({ name: name, url: f.getUrl(),
        reason: 'GitHub rejected the upload (HTTP ' + code + ').',
        fix: 'Leave it here — IT will investigate.' });
    }
  }

  logSync_(cfg, committed, bounced);
  if (bounced.length) notifyBounces_(cfg, bounced, committed);
  Logger.log(cfg.brandName + ' sync done. committed=' + committed.length + ' bounced=' + bounced.length);
}

function loadRecipeIndex_(cfg) {
  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var byKey   = {}, plateSlugs = [];
  var concept = cfg.concept ? String(cfg.concept).trim().toLowerCase() : null;
  readObjects_(ss, cfg.recipesTab).forEach(function (r) {
    if (concept && String(r.concept || '').trim().toLowerCase() !== concept) return;
    var slug = String(r.slug || '').trim(); if (!slug) return;
    var type = String(r.type  || '').trim().toLowerCase();
    var rec  = { slug: slug, type: type, name: String(r.name || '').trim() };
    byKey[slug] = rec;
    var nk = slugify_(rec.name); if (nk) byKey[nk] = rec;
    if (type === 'plate' || type === 'menu') plateSlugs.push(slug);
  });
  return { byKey: byKey, plateSlugs: plateSlugs };
}

function slugify_(s) {
  return String(s).replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function closestSlug_(key, slugs) {
  if (!slugs.length) return '';
  var keyTokens = filterTokens_(key.split('-'));
  if (!keyTokens.length) return '';

  var best = '', bestScore = -1;
  slugs.forEach(function (slug) {
    var score = tokenScore_(keyTokens, slug);
    if (score > bestScore) { bestScore = score; best = slug; }
  });
  if (bestScore >= 0.5) return best;

  // Fallback: Levenshtein for short, similar names
  var bestLev = '', bestD = 1e9;
  slugs.forEach(function (s) { var d = lev_(key, s); if (d < bestD) { bestD = d; bestLev = s; } });
  return bestD <= Math.max(3, Math.floor(key.length / 3)) ? bestLev : '';
}

var STOP_TOKENS_ = { of:1, and:1, the:1, a:1, an:1, in:1, on:1, am:1, pm:1, with:1 };

function filterTokens_(tokens) {
  return tokens.filter(function (t) {
    return t && !STOP_TOKENS_[t] && !/^\d+$/.test(t);
  });
}

function tokenScore_(keyTokens, slug) {
  var slugTokens = filterTokens_(slug.split('-'));
  if (!slugTokens.length) return 0;
  var shared = 0;
  keyTokens.forEach(function (kt) {
    if (slugTokens.some(function (st) { return tokenMatch_(kt, st); })) shared++;
  });
  return shared / Math.max(keyTokens.length, slugTokens.length);
}

function tokenMatch_(a, b) {
  return a === b || a + 's' === b || a === b + 's';
}

function lev_(a, b) {
  var m = a.length, n = b.length;
  var dp = Array.from({ length: m + 1 }, function (_, i) { return [i].concat(new Array(n).fill(0)); });
  for (var j = 1; j <= n; j++) dp[0][j] = j;
  for (var i = 1; i <= m; i++) for (var j = 1; j <= n; j++)
    dp[i][j] = Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
  return dp[m][n];
}

function getThumbnailJpeg_(id, width) {
  var url = 'https://drive.google.com/thumbnail?id=' + id + '&sz=w' + (width || 1600);
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200 || res.getBlob().getContentType().indexOf('image/') !== 0)
    res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200 || res.getBlob().getContentType().indexOf('image/') !== 0) return null;
  return res.getBlob();
}

function commitImage_(token, cfg, slug, blob, ext) {
  var path = cfg.imageDir + '/' + slug + (ext || '.jpg');
  var sha  = null;
  var get  = UrlFetchApp.fetch(
    ghContentsUrl_(cfg, path) + '?ref=' + encodeURIComponent(cfg.branch),
    { headers: ghHeaders_(token), muteHttpExceptions: true });
  if (get.getResponseCode() === 200) sha = JSON.parse(get.getContentText()).sha;
  return putRepoBytes_(token, cfg, path, blob.getBytes(), sha,
    'Image: ' + path + ' (' + new Date().toISOString() + ')');
}

function logSync_(cfg, committed, bounced) {
  if (!committed.length && !bounced.length) return;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Image Sync Log') || ss.insertSheet('Image Sync Log');
  if (sh.getLastRow() === 0) sh.appendRow(['when', 'brand', 'result', 'detail']);
  var ts = new Date();
  committed.forEach(function (c) {
    sh.appendRow([ts, cfg.brandName, 'committed', c.name + ' → ' + cfg.imageDir + '/' + c.slug + '.jpg']);
  });
  bounced.forEach(function (b) {
    sh.appendRow([ts, cfg.brandName, 'needs review', b.name + ' — ' + b.reason]);
  });
}

function notifyBounces_(cfg, bounced, committed) {
  var folder = 'https://drive.google.com/drive/folders/' + cfg.reviewFolderId;
  var html = '<p>' + cfg.brandName + ': ' + bounced.length +
             ' photo(s) moved to <a href="' + folder + '">Upload Failed - Needs Review</a>:</p>';
  bounced.forEach(function (b) {
    html += '<p style="margin:0 0 14px">• <a href="' + b.url + '"><b>' + b.name + '</b></a><br>' +
            '&nbsp;&nbsp;<b>Why:</b> ' + b.reason + '<br>&nbsp;&nbsp;<b>Fix:</b> ' + b.fix + '</p>';
  });
  if (committed.length) html += '<p>(' + committed.length + ' other photo(s) published fine.)</p>';
  MailApp.sendEmail({
    to: cfg.notifyEmail,
    subject: cfg.brandName + ' photo sync — ' + bounced.length + ' need review',
    htmlBody: html
  });
}

/* ============================================================
   SOURCE PHOTO STAGING
   ============================================================ */

/*
 * Copies images from an arbitrary Drive folder into cfg.dropFolderId,
 * renaming each file to the best-matching recipe slug for this brand.
 * Run this once to bulk-import an existing photo library, then run
 * "Sync new photos now" to process the drop folder as normal.
 */
function importSourcePhotos(cfg) {
  var ui       = SpreadsheetApp.getUi();
  var folderId = cfg.sourceFolderId || null;

  if (!folderId) {
    var res = ui.prompt(
      'Stage source photos — ' + cfg.brandName,
      'Paste the Google Drive folder URL (or just the folder ID) that contains your existing photos:',
      ui.ButtonSet.OK_CANCEL);
    if (res.getSelectedButton() !== ui.Button.OK) return;
    folderId = extractFolderId_(res.getResponseText().trim());
    if (!folderId) { ui.alert('Could not parse a folder ID from that input. Try pasting just the folder ID.'); return; }
  }

  var srcFolder, dropFolder;
  try { srcFolder  = DriveApp.getFolderById(folderId); }
  catch (e) { ui.alert('Could not open that folder — make sure it\'s shared with this Google account.'); return; }
  try { dropFolder = DriveApp.getFolderById(cfg.dropFolderId); }
  catch (e) { ui.alert('Drop folder not accessible: ' + cfg.dropFolderId); return; }

  var idx      = loadRecipeIndex_(cfg);
  var allSlugs = Object.keys(idx.byKey).filter(function (k) { return idx.byKey[k].slug === k; });

  var matched = [], unmatched = [], skipped = [];
  var allFiles = collectFilesRecursive_(srcFolder);

  for (var fi = 0; fi < allFiles.length; fi++) {
    var f    = allFiles[fi];
    var name = f.getName();
    var mime = f.getMimeType();

    if (mime.indexOf('image/') !== 0 && !isImageByName_(name)) { skipped.push(name); continue; }

    var key   = slugify_(name);
    var rec   = idx.byKey[key];
    var slug  = rec ? rec.slug : closestSlug_(key, allSlugs);
    var ext   = (name.match(/(\.[^.]+)$/) || ['.jpg'])[0].toLowerCase();
    var dest  = (slug || key) + ext;

    f.makeCopy(dest, dropFolder);

    if (slug) matched.push({ orig: name, dest: dest });
    else      unmatched.push({ orig: name, dest: dest });
  }  // end for

  var msg = matched.length + ' photos staged to the drop folder with matched slug names.\n';
  if (unmatched.length) msg += unmatched.length + ' photos staged but no slug match found (they\'ll land in Review during sync).\n';
  if (skipped.length)   msg += skipped.length   + ' non-image files skipped.\n';
  msg += '\nRun "Sync new photos now" to process them.';

  if (matched.length > 0) {
    var detail = matched.slice(0, 20).map(function (r) { return '• ' + r.orig + ' → ' + r.dest; }).join('\n');
    if (matched.length > 20) detail += '\n… and ' + (matched.length - 20) + ' more';
    msg += '\n\nMatched:\n' + detail;
  }
  if (unmatched.length > 0) {
    msg += '\n\nNo slug match:\n' + unmatched.map(function (r) { return '• ' + r.orig; }).join('\n');
  }
  ui.alert('Stage source photos — ' + cfg.brandName, msg, ui.ButtonSet.OK);
}

function collectFilesRecursive_(folder) {
  var result = [];
  var files = folder.getFiles();
  while (files.hasNext()) result.push(files.next());
  var subs = folder.getFolders();
  while (subs.hasNext()) {
    var sub = collectFilesRecursive_(subs.next());
    for (var i = 0; i < sub.length; i++) result.push(sub[i]);
  }
  return result;
}

function extractFolderId_(input) {
  var m = input.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{10,}$/.test(input)) return input;
  return null;
}

function isImageByName_(name) {
  return /\.(jpe?g|png|gif|webp|heic|heif|tiff?|bmp|avif)$/i.test(name);
}

/* ============================================================
   PHOTO CHEAT SHEET
   ============================================================ */

function generateImageCheatSheet(cfgs) {
  var ss   = SpreadsheetApp.getActiveSpreadsheet();
  var tok  = token_();
  var rows = [['Brand', 'Dish (Plate only)', 'Name the photo file exactly', 'Uploaded?']];
  cfgs.forEach(function (cfg) {
    var have    = tok ? listRepoImages_(tok, cfg) : null;
    var concept = cfg.concept ? String(cfg.concept).trim().toLowerCase() : null;
    readObjects_(ss, cfg.recipesTab)
      .filter(function (r) {
        if (concept && String(r.concept || '').trim().toLowerCase() !== concept) return false;
        var t = String(r.type || '').trim().toLowerCase();
        return r.slug && (t === 'plate' || t === 'menu');
      })
      .sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); })
      .forEach(function (r) {
        var slug = String(r.slug).trim();
        rows.push([cfg.brandName, r.name, slug + '.jpg',
          !have ? '(token not set)' : (have.has(slug + '.jpg') ? 'yes' : 'no')]);
      });
  });
  var sh = ss.getSheetByName('Photo Cheat Sheet') || ss.insertSheet('Photo Cheat Sheet');
  sh.clear();
  sh.getRange(1, 1, rows.length, 4).setValues(rows);
  sh.setFrozenRows(1);
  ss.toast((rows.length - 1) + ' plates listed.', 'Photo Cheat Sheet updated');
}

function listRepoImages_(token, cfg) {
  var res = UrlFetchApp.fetch(
    ghContentsUrl_(cfg, cfg.imageDir) + '?ref=' + encodeURIComponent(cfg.branch),
    { headers: ghHeaders_(token), muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return new Set();
  return new Set(JSON.parse(res.getContentText()).map(function (f) { return f.name; }));
}

/* ============================================================
   IMAGE DUPLICATE CLEANUP
   ============================================================ */

/*
 * Deletes any non-.jpg image files from the brand's GitHub imageDir.
 * The template hardcodes slug.jpg so .jpeg/.png duplicates are orphaned.
 */
function deleteNonJpgImages(cfg) {
  var ui  = SpreadsheetApp.getUi();
  var tok = token_();
  if (!tok) { ui.alert('No GitHub token.'); return; }

  var res = UrlFetchApp.fetch(
    ghContentsUrl_(cfg, cfg.imageDir) + '?ref=' + encodeURIComponent(cfg.branch),
    { headers: ghHeaders_(tok), muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) { ui.alert('Could not list ' + cfg.imageDir); return; }

  var files   = JSON.parse(res.getContentText());
  var toDelete = files.filter(function (f) { return f.type === 'file' && !/\.jpg$/i.test(f.name); });
  if (!toDelete.length) { ui.alert(cfg.brandName + ': no non-.jpg files found — nothing to delete.'); return; }

  var deleted = [], failed = [];
  toDelete.forEach(function (f) {
    var payload = JSON.stringify({
      message: 'Remove duplicate ' + f.name,
      sha: f.sha,
      branch: cfg.branch
    });
    var code = UrlFetchApp.fetch(ghContentsUrl_(cfg, f.path), {
      method: 'delete', headers: ghHeaders_(tok),
      contentType: 'application/json', payload: payload, muteHttpExceptions: true
    }).getResponseCode();
    if (code === 200) deleted.push(f.name); else failed.push(f.name + ' (' + code + ')');
  });

  var msg = deleted.length + ' file(s) deleted.';
  if (failed.length) msg += '\nFailed: ' + failed.join(', ');
  msg += '\n\n' + deleted.map(function (n) { return '• ' + n; }).join('\n');
  ui.alert('Cleaned ' + cfg.brandName + ' images', msg, ui.ButtonSet.OK);
}

/* ============================================================
   ONE-TIME DROP FOLDER CLEANUP — LA POPULAR
   ============================================================ */

function cleanDropFolderLaPopular() {
  var ui     = SpreadsheetApp.getUi();
  var folder = DriveApp.getFolderById(BRANDS.lapopular.dropFolderId);

  // Files in drop folder (after staging) that need renaming to correct slug
  var RENAME = {
    'salsa-toreado-7-10-44-am.jpeg': 'salsa-toreado.jpeg',
    'salsa-lorenzo-7-10-44-am.jpeg': 'salsa-lorenza.jpeg',   // note: lorenzA
    'creamy-shrimp.jpeg':            'creamy-shrimp-tacos.jpeg',
    'tajin-fries-in-tin.heic':       'tajin-fries.heic',
    'avocado-side.jpeg':             'side-of-avocado.jpeg',
    'eggs-side.jpeg':                'side-of-eggs.jpeg',
    'pancakes.jpeg':                 'buttermilk-pancakes.jpeg',
    'conchas.jpeg':                  'concha-duo.jpeg',
    'chicken-tinga.jpeg':            'chicken-tinga-tacos.jpeg',
    'carnitas.jpeg':                 'carnitas-tacos.jpeg',
    'steak-fajita-grilled.jpeg':     'steak-fajitas.jpeg',
    'baja-taco-shrimp-tempura.jpeg': 'baja-shrimp-tacos.jpeg',
    'baja-taco-fish-tempura.jpeg':   'baja-mahi-mahi-tacos.jpeg'
  };

  // Files to trash — no matching slug, duplicates, or catering/kids not in viewer
  var DELETE = [
    'caser-salad-side.jpeg',          // house-salad already matched
    'queso-fundido-chorizo.jpeg',      // queso-fundido already matched
    'chicken-fajita-grilled.jpeg',     // chicken-fajitas already matched
    'baja-taco-shrimp-grilled.jpeg',   // keeping tempura version above
    'baja-taco-fish-grilled.jpeg',     // keeping tempura version above
    'burrito.jpeg',                    // no generic burrito slug
    'burrito-wet.jpeg',                // no slug
    'salsa-verde.jpeg',                // no plain salsa-verde plate slug
    'toreado.jpeg',                    // ambiguous — multiple toreado preps, no plate slug
    'birria.jpeg',                     // only prep slugs (birria-cooking, birria-marinade)
    'colorado-enchilada.jpeg',         // no matching slug
    'half-rice-beans.jpeg',            // no slug
    'corn-off-the-cob-salad.jpeg',     // only catering-corn-off-the-cob (prep)
    'nachos-2-0.jpeg',                 // version number, no nachos slug
    'nachos-green-2-0.jpeg',           // same
    'costra-style.jpeg',               // LTO, no slug
    'smoked-brisket.png',              // LTO, no slug
    'octopus-taco.png',                // LTO, no slug
    'goshujang-tacos.png',             // LTO, no slug
    'chorizo-tacos.jpeg',              // no slug
    'chorizo-and-egg-taquitos.jpeg',   // no slug
    'tortillas.jpeg',                  // prep only
    'catering-taco-bar-toppings.jpeg', // catering, not in viewer
    'catering-taco-bar.jpeg',
    'catering-salad.jpeg',
    'beo.png',
    'kids-burrito.jpeg',
    'kids-bowl.jpeg',
    'kids-snack.jpeg',
    'kids-taco.jpeg'
  ];

  // Build a name → [files] map (Drive allows duplicate names)
  var fileMap = {};
  var iter = folder.getFiles();
  while (iter.hasNext()) {
    var f = iter.next();
    var n = f.getName();
    if (!fileMap[n]) fileMap[n] = [];
    fileMap[n].push(f);
  }

  var renamed = [], deleted = [], notFound = [];

  // Handle ribeye-tacos duplicate — second copy becomes a-la-carte-tacos
  if (fileMap['ribeye-tacos.jpeg'] && fileMap['ribeye-tacos.jpeg'].length > 1) {
    fileMap['ribeye-tacos.jpeg'][1].setName('a-la-carte-tacos.jpeg');
    renamed.push('ribeye-tacos.jpeg (duplicate) → a-la-carte-tacos.jpeg');
    fileMap['ribeye-tacos.jpeg'].splice(1, 1);
  }

  Object.keys(RENAME).forEach(function (from) {
    if (fileMap[from] && fileMap[from].length > 0) {
      fileMap[from][0].setName(RENAME[from]);
      renamed.push(from + ' → ' + RENAME[from]);
    } else {
      notFound.push(from);
    }
  });

  DELETE.forEach(function (name) {
    if (fileMap[name] && fileMap[name].length > 0) {
      fileMap[name].forEach(function (f) { f.setTrashed(true); });
      deleted.push(name);
    }
  });

  var msg = renamed.length + ' renamed, ' + deleted.length + ' deleted.\n';
  if (notFound.length) msg += '\nNot found (may not have staged): ' + notFound.join(', ') + '\n';
  msg += '\nRenamed:\n' + renamed.map(function (r) { return '• ' + r; }).join('\n');
  ui.alert('LP drop folder cleaned', msg, ui.ButtonSet.OK);
}

function cleanDropFolderAmalfi() {
  var ui     = SpreadsheetApp.getUi();
  var folder = DriveApp.getFolderById(BRANDS.amalfi.dropFolderId);

  // Files that staged to a wrong slug and need correcting
  var RENAME = {
    'butter-cake.jpeg':          'crab-cakes.jpeg',       // CRAB CAKE was wrongly matched to butter-cake
    'woodfired-shrimp.jpeg':     'wood-roasted-shrimp.jpeg',
    'rigatoni-bolognaise.jpeg':  'bolognese.jpeg'
  };

  // Files with no matching slug — catering variants, timestamp names, LTOs, etc.
  var DELETE = [
    // timestamp-suffixed originals that re-staged with date in name
    'hamburger-11-1-24.jpeg',
    'burger-11-1-24.jpeg',
    // event/catering/tray-pass variants (no viewer slug)
    'catering-antipasto-board.jpeg',
    'catering-charcuterie-board.jpeg',
    'catering-passed-apps.jpeg',
    'catering-bruschetta-platter.jpeg',
    'event-bruschetta.jpeg',
    'event-apps.jpeg',
    'tray-pass-bruschetta.jpeg',
    'tray-pass-apps.jpeg',
    'tray-pass-arancini.jpeg',
    // platter/board shots that don't correspond to a plate slug
    'antipasto-board.jpeg',
    'charcuterie-board.jpeg',
    'dessert-board.jpeg',
    'family-style-platter.jpeg'
  ];

  // Build a name → [files] map
  var fileMap = {};
  var iter = folder.getFiles();
  while (iter.hasNext()) {
    var f = iter.next();
    var n = f.getName();
    if (!fileMap[n]) fileMap[n] = [];
    fileMap[n].push(f);
  }

  var renamed = [], deleted = [], notFound = [], duplicates = [];

  // Report duplicate slugs so user can manually pick best before Sync
  Object.keys(fileMap).forEach(function (name) {
    if (fileMap[name].length > 1) duplicates.push(name + ' ×' + fileMap[name].length);
  });

  Object.keys(RENAME).forEach(function (from) {
    if (fileMap[from] && fileMap[from].length > 0) {
      fileMap[from][0].setName(RENAME[from]);
      renamed.push(from + ' → ' + RENAME[from]);
    } else {
      notFound.push(from);
    }
  });

  DELETE.forEach(function (name) {
    if (fileMap[name] && fileMap[name].length > 0) {
      fileMap[name].forEach(function (f) { f.setTrashed(true); });
      deleted.push(name);
    }
  });

  var msg = renamed.length + ' renamed, ' + deleted.length + ' deleted.\n';
  if (notFound.length) msg += '\nNot found (skipped): ' + notFound.join(', ') + '\n';
  if (duplicates.length) {
    msg += '\n⚠️ Duplicate files — manually keep one and delete the rest in Drive before running Sync:\n';
    msg += duplicates.map(function (d) { return '• ' + d; }).join('\n');
  }
  msg += '\nRenamed:\n' + renamed.map(function (r) { return '• ' + r; }).join('\n');
  ui.alert('Amalfi drop folder cleaned', msg, ui.ButtonSet.OK);
}

function cleanAmalfiReviewFolder() {
  var ui     = SpreadsheetApp.getUi();
  var folder = DriveApp.getFolderById(BRANDS.amalfi.reviewFolderId);

  // One file that can be salvaged — rename and move to Drop for re-sync
  var dropFolder = DriveApp.getFolderById(BRANDS.amalfi.dropFolderId);
  var MOVE_TO_DROP = {
    'empanada-3-55-42-pm.jpeg': 'empanadas.jpeg'
  };

  // All others: no matching slug (catering, boards, platters, LTOs, timestamps, modifiers)
  var DELETE = [
    'spaghetti-10-22-34-am.jpeg',
    'shrimp-scampi2-1-25.jpeg',
    'angel-hair-ai-frutti-di-mari.jpeg',
    'brunch-avocado-toast.jpeg',
    'hollandaise.jpeg',
    'mini-tuna-board.jpeg',
    'mini-tuna-platter.jpeg',
    'burrata-tomato-board.jpeg',
    'artichoke-prosciutto-board.jpeg',
    'mini-hamachi-platter.jpeg',
    'burrata-tomato-platter.jpeg',
    'artichoke-prosciutto-solo.jpeg',
    'surf-n-turf.jpeg',
    'salsa-trio.jpeg',
    'turkey.jpeg',
    'seafood-platter.jpeg',
    'blue-cheese-steak.jpeg',
    'caesar-add-protein.jpeg',
    'steak-and-eggs-all-concepts.jpeg'
  ];

  var fileMap = {};
  var iter = folder.getFiles();
  while (iter.hasNext()) {
    var f = iter.next();
    var n = f.getName();
    if (!fileMap[n]) fileMap[n] = [];
    fileMap[n].push(f);
  }

  var moved = [], deleted = [], notFound = [];

  Object.keys(MOVE_TO_DROP).forEach(function (from) {
    var to = MOVE_TO_DROP[from];
    if (fileMap[from] && fileMap[from].length > 0) {
      var file = fileMap[from][0];
      file.setName(to);
      file.moveTo(dropFolder);
      moved.push(from + ' → Drop as ' + to);
    } else {
      notFound.push(from);
    }
  });

  DELETE.forEach(function (name) {
    if (fileMap[name] && fileMap[name].length > 0) {
      fileMap[name].forEach(function (f) { f.setTrashed(true); });
      deleted.push(name);
    }
  });

  var msg = moved.length + ' moved to Drop, ' + deleted.length + ' deleted.\n';
  if (notFound.length) msg += '\nNot found (skipped): ' + notFound.join(', ') + '\n';
  if (moved.length) msg += '\nMoved to Drop:\n' + moved.map(function (r) { return '• ' + r; }).join('\n');
  msg += '\n\nRun Sync again to pick up the moved file.';
  ui.alert('Amalfi review folder cleaned', msg, ui.ButtonSet.OK);
}
