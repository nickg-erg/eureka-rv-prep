/**
 * Bound to the shared ERG recipe Sheet. THIN: per-brand CONFIG + menu wiring only.
 * ALL logic lives in the RVLib library.
 *
 * ONE-TIME SETUP
 *  1. Project Settings > Libraries > add the library by its Script ID,
 *     set the identifier to  RVLib , pick the latest version.
 *  2. Reload the Sheet. Use Recipe Viewer > Admin (IT) > Set / update GitHub token (once).
 *  3. Recipe Viewer > Admin (IT) > Set up dropdowns.
 *  4. Publish per brand from each brand's submenu.
 *
 * Token is stored in the LIBRARY (shared by all brands) — one PAT covers the
 * single repo erg-recipe-viewer.
 */

// Shared across every brand (one repo, one shared sheet):
const REPO = { owner: 'nickg-erg', repo: 'erg-recipe-viewer', branch: 'main', templatePath: 'template/index.html' };
const TABS = { recipesTab: 'Recipes', ingredientsTab: 'Ingredients', stepsTab: 'Steps' };
const ADMINS = ['nick.giangregorio@eurekarestaurantgroup.com'];
const NOTIFY_EMAIL = 'nick.giangregorio@eurekarestaurantgroup.com'; // switch to it@ when ready

// Merge shared defaults into each brand's CONFIG.
function brand_(o) {
  return Object.assign({}, REPO, TABS, { notifyEmail: NOTIFY_EMAIL, thumbWidth: 1600 }, o);
}

const BRANDS = {
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
    brandPrimary: '#C99D66', brandAccent: '#2E6E73',   // accent = PLACEHOLDER (no official secondary)
    outputPath: 'lapopular/index.html', logoPath: 'lapopular/logo.svg', imageDir: 'lapopular/images',
    dropFolderId:   '1MVyGWQSy3nqvKSg-MVSjslpFUPiTE2eH',
    doneFolderId:   '1Ggk9tCneneUkf8tIdYiOA5m_Ocwn4AuI',
    reviewFolderId: '1fe3QTTuu7K1Ad8pAuuNs9ABkm_wLrFPX'
  }),
  amalfi: brand_({
    brandName: 'Amalfi Llama', concept: 'Amalfi Llama',
    brandPrimary: '#1A1A1A', brandAccent: '#8A8A8A',   // B&W; accent = PLACEHOLDER
    outputPath: 'amalfillama/index.html', logoPath: 'amalfillama/logo.svg', imageDir: 'amalfillama/images',
    dropFolderId:   '1fB5BqCoveXFxCv91pkeJQaJnZ9Ft2c2b',
    doneFolderId:   '1YXPXJSfYMOhaKs_8QWcgcuYF70AclHjj',
    reviewFolderId: '1JSLmUgSCHYopDeOFHhGuFK3aqpPVpRaG'
  })
};
const ALL = [BRANDS.eureka, BRANDS.lapopular, BRANDS.amalfi];

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const menu = ui.createMenu('Recipe Viewer');

  [['Eureka', 'Eureka'], ['La Popular', 'LaPopular'], ['Amalfi Llama', 'Amalfi']].forEach(function (p) {
    menu.addSubMenu(ui.createMenu(p[0])
      .addItem('Publish to site', 'publish' + p[1])
      .addItem('Preview what will publish', 'preview' + p[1])
      .addItem('Sync new photos now', 'sync' + p[1]));
  });
  menu.addSeparator().addItem('Publish ALL brands', 'publishAll');

  let admin = false;
  try { admin = ADMINS.indexOf(Session.getEffectiveUser().getEmail()) !== -1; } catch (e) {}
  if (admin) {
    menu.addSeparator().addSubMenu(ui.createMenu('Admin (IT)')
      .addItem('Refresh photo cheat sheet', 'refreshCheatSheet')
      .addSeparator()
      .addItem('Set / update GitHub token', 'setToken')
      .addItem('Set up dropdowns', 'setupDropdowns'));
  }
  menu.addToUi();
}

/* Menu handlers must be functions in THIS (container) script; they delegate to RVLib. */
function publishEureka()    { RVLib.publishToSite(BRANDS.eureka); }
function previewEureka()    { RVLib.previewPublish(BRANDS.eureka); }
function syncEureka()       { RVLib.syncDropPhotos(BRANDS.eureka); }

function publishLaPopular() { RVLib.publishToSite(BRANDS.lapopular); }
function previewLaPopular() { RVLib.previewPublish(BRANDS.lapopular); }
function syncLaPopular()    { RVLib.syncDropPhotos(BRANDS.lapopular); }

function publishAmalfi()    { RVLib.publishToSite(BRANDS.amalfi); }
function previewAmalfi()    { RVLib.previewPublish(BRANDS.amalfi); }
function syncAmalfi()       { RVLib.syncDropPhotos(BRANDS.amalfi); }

function publishAll()       { RVLib.publishAll(ALL); }
function refreshCheatSheet(){ RVLib.generateImageCheatSheet(ALL); }
function setToken()         { RVLib.setGithubToken(); }
function setupDropdowns()   { RVLib.setupValidation({
  recipesTab: TABS.recipesTab, ingredientsTab: TABS.ingredientsTab, stepsTab: TABS.stepsTab,
  concepts: ['Eureka', 'La Popular', 'Amalfi Llama']
}); }
