# Eureka Recipe Viewer — Architecture & Operations

**Status:** Live (Eureka brand). Single-brand today; a 3-brand refactor is planned (see §13).
**Audience:** future maintainers (human or LLM). Source of truth for how the whole system fits
together — Google Sheet → Apps Script → GitHub → GitHub Pages, plus the Drive photo pipeline.
If this disagrees with memory or an old chat, trust this file (and verify against the live system).

## 1. What this is
A back-of-house recipe viewer for Eureka Restaurant Group (ERG) kitchens, on iPad-mini kiosks.
Culinary authors recipes in a Google Sheet; a "Publish" button bakes that data into a single
static page on GitHub Pages. Plate (menu) recipes also get a photo via a Google Drive drop folder.

Two guiding properties:
- **Recipe data is offline-capable** — embedded in the HTML, so the viewer works without a
  network once loaded. (Images load over wifi; see §5.)
- **Everything is a deliberate manual action** — publishing recipes and photos are both button
  clicks. Nothing runs automatically in the background today.

## 2. System at a glance
```
                 Google Sheet  ──(Recipe Viewer ▸ Publish)──►  GitHub repo: nickg-erg/eureka-rv
   (Recipes / Ingredients / Steps)            Apps Script        index.html  (data spliced in)
                 │  bound Apps Script project  (publish.gs)               │
                 │                                                        ▼
                 │                                                GitHub Pages (auto-deploy)
                 │                                        https://nickg-erg.github.io/eureka-rv/
                 │                                                        ▲
   Google Drive  │  (Recipe Viewer ▸ Sync new photos now)                │ images/<slug>.jpg
   "Add New Photos Here" ──► Apps Script (image-sync.gs) ────────────────┘
        (drop a photo named like the dish)     normalize + commit
```

| Component | What it is | Where |
|---|---|---|
| Recipe Source (Sheet) | Authoring DB: Recipes/Ingredients/Steps | Sheet `1SIa3itLid9uSIWH1ViEqWjgX1_jH6VmkW9pPgcsspCU` |
| Apps Script project | Publish engine + photo sync, bound to the Sheet | Extensions ▸ Apps Script on that Sheet |
| Repo | Holds `index.html` and `images/` | github.com/nickg-erg/eureka-rv (branch `main`) |
| Live site | The kiosk viewer | https://nickg-erg.github.io/eureka-rv/ |
| Photo folders | Drop / archive / review for dish photos | Drive: EUREKA ▸ DISH PICS ▸ Recipe Viewer Photos |

## 3. Roles — who does what
- **Culinary (authors):** add/edit rows in the Sheet (Recipes, Ingredients, Steps); take and
  name dish photos; drop them in the photo folder. They touch the Sheet and Drive only — never GitHub.
- **Recipe manager / publisher** (culinary lead or IT): runs **Publish to site** and **Sync new
  photos now** from the Sheet menu when changes are ready.
- **IT / Admin:** owns the GitHub token, the Apps Script, the dropdowns, and troubleshooting.
  These are hidden behind an email-gated **Admin (IT)** submenu (§7); admins are listed in the
  `ADMINS` array in `publish.gs`.
- **The system (Apps Script):** on Publish, reads the Sheet and commits data into the repo; on
  Sync, reads the drop folder, normalizes photos, commits them. Pages redeploys on every commit.

## 4. The data — Google Sheet
File: "Recipe Viewer - Eureka - Recipe Source", ID `1SIa3itLid9uSIWH1ViEqWjgX1_jH6VmkW9pPgcsspCU`,
in a Shared Drive. The Apps Script project is **bound** to this Sheet (Extensions ▸ Apps Script).

### Core tabs (read by Publish)
Joined by **`slug`** (unique recipe key). Columns are read **by header name**, not position —
column order can change safely, but header text must match.

**Recipes** (one row per recipe):
| column | meaning |
|---|---|
| `slug` | unique key, lowercase-hyphen (e.g. `poke-bowl`). Joins to Ingredients/Steps. |
| `name` | display name |
| `concept` | brand/concept (e.g. "Eureka") |
| `type` | **`prep`** or **`plate`** (was `menu`; renamed). Drives filtering + whether it gets a photo. |
| `yield_1x`, `yield_2x` | batch yields |
| `prep_time` | est. prep time |
| `shelf_life` | shelf life |
| `plate` | plating/serving note |
| `image_url` | **vestigial** — unused (viewer derives the path from the slug). Safe to delete. |
| `note` | free-text note shown on the detail page |
| `status` | **`live`** or **`draft`**. Only `live` recipes publish. |
| `category` | grouping (e.g. "Signature Burgers", "Sides", "Misc") |

**Ingredients** (many rows per recipe): `slug`, `order` (sort), `ingredient`, `qty_1x`,
`qty_2x`, `uom`, `step_group`, `links_to` (points a "PREP …" ingredient at its prep recipe's slug).

**Steps** (many rows per recipe): `slug`, `step_no` (sort), `text`, `step_group`.

### Validation (dropdowns) — rebuilt by `setupValidation`
- Ingredients **col F (`uom`)** — unit list; **rejects off-list values** (`allowInvalid:false`).
  Adding a new unit requires clearing/extending the validation first (bit us twice).
- Recipes **col D (`type`)** — `prep` / `plate`.
- Recipes **col L (`status`)** — `live` / `draft`.

### Auxiliary tabs (auto-generated; not read by Publish)
- **Photo Cheat Sheet** — every Plate's exact filename + uploaded yes/no (`generateImageCheatSheet`).
- **Image Sync Log** — audit trail of each photo sync (`logSync_`).
- **Data Gaps** — recipes missing ingredients/steps (`findMissingData`, diagnostic).
- **README** — operator quick-guide for culinary.

## 5. The viewer — `index.html`
A **single static HTML file** in the repo. Recipe data is embedded between two markers:
```
/* RECIPES:START */
  const RECIPES = [ … ];
/* RECIPES:END */
```
Publish only rewrites text **between these markers**; the rest (markup, styles, logic) is
hand-maintained. **Do not remove or rename the markers.**

Behavior:
- **List / search sidebar** — grouped alphabetically; each row shows a muted category subline
  (`TYPE · CATEGORY`; the `TYPE ·` prefix drops when a type filter is active).
- **Type filter** — PREP vs PLATE.
- **Detail page** — name, metadata pills (prep time, shelf life, yields), note, ingredients
  table (1x/2x columns, empty columns hide), steps.
- **Plate hero image** — for `type === 'plate'` only, loads `images/<slug>.jpg`. `.dish-hero`:
  `aspect-ratio:4/3`, `object-fit:cover`, `max-height:42vh`, `border-radius:4px`; container
  starts `display:none`, revealed on `load`, left hidden on `error` (404). Plates without a
  photo and all preps show nothing — no gap, no broken icon. Preps never request an image.
- **Offline:** data is embedded (works offline once loaded); images fetch over network and
  fail gracefully if offline.
- Eureka-branded; sized for iPad-mini kiosks.

Viewer code changes happen directly in `index.html`. Publish never touches anything outside the markers.

## 6a. Editing surfaces — what's editable where (and with which tool)

The system spans two codebases that do NOT share a filesystem. Knowing which side a thing
lives on tells you which tool to reach for.

### GitHub side — Claude Code works here
Everything in the repo (`github.com/nickg-erg/eureka-rv`):
- `index.html` — the entire viewer: layout, styles, list/search, detail page, plate hero
  image logic, branding. All hand-editable.
- `images/<slug>.jpg` — the photos.
- `ARCHITECTURE.md` — this doc.

Anything about how the viewer *looks or behaves* is here, so Claude Code (or direct GitHub
editing) is the right tool. The planned config-driven `index.html` template for 3-brand is
also GitHub-side.

### Apps Script side — Claude Code CANNOT reach this
The bound Apps Script project on the Sheet:
- `publish.gs` — publish pipeline, the Recipe Viewer menu, GitHub commit logic, validation/dropdowns.
- `image-sync.gs` — the photo drop → normalize → commit pipeline.
- (`one-time-import.gs` / `maintenance.gs` — migration + diagnostics.)

These are not in the repo and there's no local filesystem for them. Edits happen in the
Apps Script editor — paste full-file replacements. Claude Code has no access here.

> The one bridge: the `.gs` scripts *write into* the GitHub repo (they commit `index.html`
> and `images/`), but the script source itself is Apps Script-side, not in the repo.

### Rule of thumb
- Viewer / template / UI / branding → **GitHub repo (Claude Code).**
- Publish logic, photo-sync logic, menu, validation → **Apps Script editor (paste full files).**
- The 3-brand shared library (§13) is **Apps Script-side**; its config-driven `index.html`
  template is **GitHub-side**.

## 7. Publish pipeline — `publish.gs`
Bound to the Sheet. Builds recipe data and commits it into `index.html`.

### Menu (`onOpen`) — title "Recipe Viewer"
Everyone: **Publish to site** (`publishToSite`), **Preview what will publish** (`previewPublish`),
**Sync new photos now** (`syncDropPhotos`, §8).
Admins only (email in `ADMINS`) → **Admin (IT)** submenu: Build/refresh photo cheat sheet
(`generateImageCheatSheet`), Install photo sync hourly (`installImageSyncTrigger`, optional —
currently not installed), Set/update GitHub token (`setGithubToken`), Set up dropdowns
(`setupValidation`).

### Token
`setGithubToken` stores a GitHub **fine-grained PAT** (this repo, **Contents: R/W**) in
**Script Properties** key **`GITHUB_TOKEN`** — never in code or the Sheet.

### Publish flow (`publishToSite`)
1. Read token; abort if missing.
2. `buildRecipes_()` — read the three tabs (`readObjects_` → `groupBy_` by slug), keep only
   `status==='live'`, attach sorted ingredients + steps, `clean_` away empty fields.
3. `fetchCurrentHtml_()` — GET current `index.html` (text + sha).
4. `extractLiveRecipes_()` + `diffRecipes_()` — New/Changed/Removed summary; confirm.
5. Splice new JSON between the markers.
6. PUT back with the sha (a commit). Pages redeploys.
`previewPublish` runs steps 2–4 only (dry run).

### GitHub helpers
`ghApi_`, `ghHeaders_`, `fetchCurrentHtml_`, `extractLiveRecipes_`, `canon_`, `diffRecipes_`, `diffSummary_`.

### CONFIG (top of `publish.gs`)
`owner:'nickg-erg'`, `repo:'eureka-rv'` (← update from `'eureka-rv-prep'`), `path:'index.html'`,
`branch:'main'`, `recipesTab:'Recipes'`, `ingredientsTab:'Ingredients'`, `stepsTab:'Steps'`.

## 8. Image pipeline — `image-sync.gs` + Drive folders
### Folder tree (photo Shared Drive)
```
EUREKA  (10CBaEOZdHdsReETVvgk4AE-RKh93urSr)
└─ DISH PICS  (1XYwHoMlvr40xq8fiZd-ngRdrZ22TdrwW)
   ├─ CURRENT  (1vYqhdRs-YVFJj7VT_RnefdlXXjEfRcAq)   ← originals library (raw phone photos)
   └─ Recipe Viewer Photos  (1ZdbiC2haa6nlBvr8hjV8sXywQmso7iHM)
      ├─ Add New Photos Here          (183AGv_ol_pDT-06u4b9ogk2fNFnzmrsr)  = DROP_FOLDER_ID
      ├─ Successfully Uploaded Photos  (1gHU5PMr2TU6-h0rj-TBcMOYhN-WY5msN)  = DONE_FOLDER_ID
      └─ Upload Failed - Needs Review  (1Y64622PugB9_6wzVqnC1c4kAtNdhCN5U)  = REVIEW_FOLDER_ID
```
Folder IDs are permanent — rename/move folders freely without touching the script.

### End-to-end flow (`syncDropPhotos`, run from the menu)
1. Read `GITHUB_TOKEN`.
2. `loadRecipeIndex_()` — index every recipe by slug **and** slugified name; note which are plates.
3. For each file in **Add New Photos Here**:
   - `slugify_(filename)` (lowercase, strip extension, non-alphanumeric → hyphen).
   - **No matching recipe** → move to **Upload Failed - Needs Review**; record a bounce with a
     "did you mean `<closest-slug>`?" suggestion (Levenshtein).
   - **Matches a prep (non-plate)** → bounce ("photos only show on Plate recipes").
   - **Matches a plate** → `getThumbnailJpeg_()` → `commitImage_()` → rename original to
     `<slug>.<ext>` and move to **Successfully Uploaded Photos**.
4. Append to **Image Sync Log**; if anything bounced, email a clear linked summary to `NOTIFY_EMAIL`.

### The normalize trick (and why)
Phone photos are HEIC/large; the viewer needs web JPEG, and Apps Script can't transcode/resize.
The Drive **REST API** (`thumbnailLink`) would work but needs the Drive API enabled on the
Apps Script project's Cloud project — a **locked, Google-managed project we can't access** (the
"request access / Project Mover" screen is a dead end). So we use the Drive **web** thumbnail
endpoint, which needs no Drive API:
```
https://drive.google.com/thumbnail?id=<fileId>&sz=w1600
```
`getThumbnailJpeg_` fetches it (unauthenticated, then `Bearer ScriptApp.getOAuthToken()`),
yielding a ~1600px JPEG (~0.5 MB). This is the keystone of the no-extra-service design; if it
ever breaks, the fallback is a real image service (e.g. Cloudinary).

### Commit (`commitImage_`)
Always writes **`images/<slug>.jpg`** regardless of source extension (GET sha if present → PUT;
overwrite = update). A re-drop simply updates the live image.

### Cheat sheet (`generateImageCheatSheet` + `listRepoImages_`)
Writes the **Photo Cheat Sheet** tab: each Plate's name → exact filename (`<slug>.jpg`) →
uploaded yes/no (one GitHub directory listing). Preps don't appear (no photos).

### Scheduling
**Manual only** — no active trigger. `installImageSyncTrigger` is an opt-in (hourly) escape
hatch, deliberately left uninstalled so photos publish on a click like recipes.

### `image-sync.gs` constants
`DROP_FOLDER_ID`, `DONE_FOLDER_ID`, `REVIEW_FOLDER_ID` (above); `NOTIFY_EMAIL` (currently Nick's
address; becomes `culinary@…, nick…` at ship); `IMAGE_DIR='images'`; `THUMB_WIDTH=1600`. Reuses
`CONFIG`, `ghHeaders_`, `readObjects_`, `GITHUB_TOKEN` from `publish.gs` (same project).

## 9. Secrets, permissions, accounts
- **GitHub PAT** — fine-grained, this repo only, Contents R/W. In Script Properties as
  `GITHUB_TOKEN`. Rotate via Admin ▸ Set/update GitHub token.
- **Google auth** — the Apps Script runs as the authorizing ERG Workspace user; first runs
  prompt for Drive + external-request + Mail scopes (expected).
- **Site is fully public** — GitHub Pages has no access control. Anything published is world-readable (§13).

## 10. Constraints, gotchas & known issues
- **UOM validation rejects off-list values** — clear/extend Ingredients col-F before writing a new unit.
- **Slug uniqueness matters** — matching + join assume unique slugs. Known dup to clean up:
  `side-caesar-salad` vs `sides-caesar-salad`.
- **Images are Plate-only** — viewer renders a hero only for `type==='plate'`; sync refuses preps.
- **Drive-API path unavailable** (locked Cloud project) — web thumbnail endpoint is the workaround (§8).
- **Repo rename redirect** — `eureka-rv-prep` → `eureka-rv`; update `CONFIG.repo`.
- **Folder renames/moves are ID-safe** — cosmetic, never touch the script.
- **`image_url` column is vestigial** — viewer derives `images/<slug>.jpg` from the slug.
- **First publish from a fresh file** can't compute a diff — normal.

## 11. Common tasks
- **Add/edit a recipe:** rows in Recipes (+ Ingredients/Steps by slug); set `type` and `status`;
  Preview → Publish. New recipes start `draft`.
- **Add a photo (Plate only):** name file the dish (Photo Cheat Sheet = exact name) → drop in
  **Add New Photos Here** → **Sync new photos now** → lands in **Successfully Uploaded Photos**,
  live next deploy.
- **A photo bounced** (email + Upload Failed - Needs Review): rename to exact/suggested slug,
  confirm it's a Plate, move back to **Add New Photos Here**, re-sync.
- **Check what's missing:** run `findMissingData` → **Data Gaps** tab.
- **Rotate token:** Admin ▸ Set/update GitHub token.

## 12. Migration scripts (one-time, historical)
`one-time-import.gs` held the original migration (`importMenuData` + source IDs),
`verifyMenuImport`, `backfillMiscIngredients`, the `menu`→`plate` rename (`renamePlateType`),
plus the still-useful `findMissingData`. Migration jobs are **spent** — recommended: keep
`findMissingData` (move to `maintenance.gs`), retire the rest. Recommended project name: **"Eureka Recipe Viewer"**.

## 13. Roadmap
- **3-brand replication (next major work)** — La Popular + Amalfi Llama. Shared **Apps Script
  Library**; each brand's Sheet = thin bound `CONFIG` calling the library (fix once, bump
  version, all three update). Make `index.html` **config-driven** (one template; publish writes
  per-brand branding + data per repo). Photo folders + sync are already brand-generic by ID/CONFIG.
- **Guided recipe entry (maybe)** — a plain Google Form can't capture variable-length
  ingredients/steps; **AppSheet** (same Sheet, native parent→child) fits if pursued.
- **Password protection (parked)** — Pages is public; client-side passwords are weak; real
  gating needs something like Cloudflare Access.

## 14. Quick reference
| Thing | Value |
|---|---|
| Live site | https://nickg-erg.github.io/eureka-rv/ |
| Repo | github.com/nickg-erg/eureka-rv · `main` · `index.html` + `images/` |
| Sheet | `1SIa3itLid9uSIWH1ViEqWjgX1_jH6VmkW9pPgcsspCU` (bound Apps Script) |
| Token | Script Property `GITHUB_TOKEN` (fine-grained PAT, Contents R/W) |
| Drop folder | Add New Photos Here · `183AGv_ol_pDT-06u4b9ogk2fNFnzmrsr` |
| Done folder | Successfully Uploaded Photos · `1gHU5PMr2TU6-h0rj-TBcMOYhN-WY5msN` |
| Review folder | Upload Failed - Needs Review · `1Y64622PugB9_6wzVqnC1c4kAtNdhCN5U` |
| Photos parent | Recipe Viewer Photos · `1ZdbiC2haa6nlBvr8hjV8sXywQmso7iHM` |
| Originals | CURRENT · `1vYqhdRs-YVFJj7VT_RnefdlXXjEfRcAq` |
| Apps Script files | `publish.gs`, `image-sync.gs` (+ retire `one-time-import.gs` → `maintenance.gs`) |
| Image path | `images/<slug>.jpg` (always JPEG, any source format) |

*Keep this file updated whenever the system changes — it's the first thing a future maintainer (or LLM) should read.*
