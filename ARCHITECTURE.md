# ERG Recipe Viewer — Architecture & Operations

**Status:** Live (Eureka). La Popular + Amalfi Llama scaffolded; publish ready once their recipes
are tagged in the Sheet.
**Audience:** future maintainers (human or LLM). Source of truth for how the whole system fits
together — Google Sheet → Apps Script → GitHub → GitHub Pages, plus the Drive photo pipeline.
If this disagrees with memory or an old chat, trust this file (and verify against the live system).

## 1. What this is
A back-of-house recipe viewer for Eureka Restaurant Group (ERG) kitchens, on iPad-mini kiosks.
Culinary authors recipes in a Google Sheet; a "Publish" button bakes that data into a static page
on GitHub Pages — one page per brand. Plate (menu) recipes also get a photo via a Drive drop folder.

Two guiding properties:
- **Recipe data is offline-capable** — embedded in the HTML, so the viewer works without a
  network once loaded. (Images load over wifi; see §5.)
- **Everything is a deliberate manual action** — publishing recipes and photos are both button
  clicks. Nothing runs automatically in the background.

## 2. System at a glance

```
              Google Sheet  ──(Recipe Viewer ▸ [Brand] ▸ Publish)──►  GitHub repo: nickg-erg/erg-recipe-viewer
  (Recipes / Ingredients / Steps)        Apps Script (RVLib library)    /<brand>/index.html  (data spliced in)
              │  bound Apps Script project (recipe-viewer-bound.gs)                │
              │  library project          (recipe-viewer-library.gs)              ▼
              │                                                           GitHub Pages (auto-deploy)
              │                                              https://nickg-erg.github.io/erg-recipe-viewer/<brand>/
              │                                                                   ▲
  Google Drive  (Recipe Viewer ▸ [Brand] ▸ Sync new photos now)                  │ <brand>/images/<slug>.jpg
  "Add New Photos Here" ──► Apps Script ────────────────────────────────────────┘
       (drop a photo named like the dish)    normalize + commit
```

| Component | What it is | Where |
|---|---|---|
| Recipe Source (Sheet) | Authoring DB: Recipes / Ingredients / Steps | Kitchen Ops shared drive → Recipe Viewer → Recipe Viewer Source |
| Bound Apps Script | Menu wiring + per-brand CONFIG, delegates to RVLib | Extensions ▸ Apps Script on that Sheet (project: "ERG Recipe Viewer") |
| Library Apps Script | All publish + photo-sync logic | Standalone project "recipe-viewer-library"; attached as `RVLib` |
| Repo | Template, per-brand `index.html`, images, this doc | github.com/nickg-erg/erg-recipe-viewer (`main`) |
| Live sites | Kiosk viewers | `…github.io/erg-recipe-viewer/eureka/`, `/lapopular/`, `/amalfillama/` |
| Photo folders | Drop / done / review per brand | Kitchen Ops → Recipe Viewer → Recipe Viewer Photos → [Brand] |

## 3. Roles — who does what
- **Culinary (authors):** add/edit rows in the Sheet; name and drop dish photos. Touch Sheet + Drive only — never GitHub.
- **Recipe manager / publisher** (culinary lead or IT): runs **Publish to site** and **Sync new photos now** from the Sheet menu.
- **IT / Admin:** owns the GitHub token, Apps Script versions, dropdowns. Hidden behind an email-gated **Admin (IT)** submenu; admins are listed in `ADMINS` in the bound script.
- **The system (Apps Script):** on Publish, reads the Sheet and commits per-brand `index.html`; on Sync, reads the drop folder, normalizes photos, commits them. Pages redeploys on every commit.

## 4. The data — Google Sheet

File: **Recipe Viewer Source** in the Kitchen Ops shared drive.
The Apps Script project "ERG Recipe Viewer" is **bound** to this Sheet.

All three brands share one Sheet. The `concept` column partitions rows by brand.

### Core tabs (read by Publish)
Joined by **`slug`** (unique recipe key). Columns are read **by header name**, not position —
column order can change safely, but header text must match.

**Recipes** (one row per recipe):
| column | meaning |
|---|---|
| `slug` | unique key, lowercase-hyphen (e.g. `poke-bowl`). Joins to Ingredients/Steps. |
| `name` | display name |
| `concept` | brand — `Eureka` / `La Popular` / `Amalfi Llama`. **Required** — rows without a concept are skipped at publish. |
| `type` | `prep` or `plate`. Drives filtering + whether a row gets a photo. |
| `yield_1x`, `yield_2x` | batch yields |
| `prep_time` | est. prep time |
| `shelf_life` | shelf life |
| `plate` | plating/serving note |
| `note` | free-text note shown on the detail page |
| `status` | `live` or `draft`. Only `live` rows publish. |
| `category` | grouping (e.g. "Signature Burgers", "Sides") |

**Ingredients** (many rows per recipe): `slug`, `order` (sort), `ingredient`, `qty_1x`,
`qty_2x`, `uom`, `step_group`, `links_to` (points a "PREP …" ingredient at its prep recipe's slug), `concept`.

**Steps** (many rows per recipe): `slug`, `step_no` (sort), `text`, `step_group`, `concept`.

> Child rows (Ingredients/Steps) with a blank `concept` are treated as legacy and attached to
> any brand that owns the parent recipe. Tag them to avoid ambiguity.

### Validation (dropdowns) — rebuilt by `Admin (IT) → Set up dropdowns`
- Ingredients `uom` — unit list; rejects off-list values (`allowInvalid:false`).
- Recipes `type` — `prep` / `plate`.
- Recipes `status` — `live` / `draft`.
- All tabs `concept` — `Eureka` / `La Popular` / `Amalfi Llama`.

### Auxiliary tabs (auto-generated; not read by Publish)
- **Photo Cheat Sheet** — every Plate's exact filename + uploaded yes/no (`generateImageCheatSheet`).
- **Image Sync Log** — audit trail of each photo sync.

## 5. The template — `template/index.html`
A single shared HTML template in the repo. Each brand's publish fetches it, injects brand tokens
and that brand's recipe JSON, and commits the result to `/<brand>/index.html`.

### Token placeholders (replaced at publish)
| Placeholder | Replaced with |
|---|---|
| `{{BRAND_NAME}}` | e.g. `Eureka` |
| `{{BRAND_PRIMARY}}` | hex colour (e.g. `#FF671D`) |
| `{{BRAND_ACCENT}}` | hex colour |
| `{{BRAND_LOGO_SVG}}` | inline SVG content from `/<brand>/logo.svg` |

### Recipe data markers (must not be removed)
```js
/* RECIPES:START */
  const RECIPES = [ … ];
/* RECIPES:END */
```
Publish only rewrites text between these markers; the rest is hand-maintained.

### Viewer behaviour
- **List / search sidebar** — grouped alphabetically; category subline; type filter (PREP / PLATE).
- **Detail page** — name, metadata pills (prep time, shelf life, yields), note, ingredients table
  (1x/2x columns, empty columns hide), steps.
- **Plate hero image** — for `type === 'plate'` only, loads `<brand>/images/<slug>.jpg`.
  Container starts `display:none`, revealed on `load`, stays hidden on `error` (404). Preps never
  request an image.
- **Offline:** data is embedded (works offline once loaded); images fetch over network and fail
  gracefully if offline.
- Sized for iPad-mini kiosks.

## 6. Apps Script — two projects

### 6a. Bound project — "ERG Recipe Viewer"
File: `apps-script/recipe-viewer-bound.gs` (repo mirror only — live code is in Apps Script).

Thin layer: per-brand `BRANDS` CONFIG objects + menu wiring. All real logic delegates to `RVLib`.

**Key constants:**
- `REPO` — `owner`, `repo`, `branch`, `templatePath` (shared by all brands).
- `TABS` — `recipesTab`, `ingredientsTab`, `stepsTab` (shared).
- `ADMINS` — email list for the Admin (IT) submenu gate.
- `NOTIFY_EMAIL` — bounce notification recipient.
- `BRANDS.eureka / .lapopular / .amalfi` — per-brand: colours, paths, Drive folder IDs.

### 6b. Library project — "recipe-viewer-library"
File: `apps-script/recipe-viewer-library.gs` (repo mirror only).

Attached to the bound project as identifier `RVLib`. Contains all logic:
- `publishToSite(cfg)` / `previewPublish(cfg)` — fetch template, build recipes, diff, confirm, commit.
- `syncDropPhotos(cfg)` — Drive drop → normalize → commit pipeline.
- `setupValidation(opts)` — apply dropdowns to all tabs.
- `generateImageCheatSheet(cfgs)` — write the Photo Cheat Sheet tab.
- `setGithubToken()` — store PAT in library Script Properties (shared by all brands).

Token is stored in the **library's** Script Properties (`GITHUB_TOKEN`) so one PAT serves all brands.

### 6c. Editing surfaces
| What | Where to edit | Tool |
|---|---|---|
| Viewer look/feel, template HTML | `template/index.html` in repo | Claude Code / GitHub |
| Brand logos | `eureka/logo.svg`, `lapopular/logo.svg`, `amalfillama/logo.svg` | GitHub file upload |
| Per-brand CONFIG, folder IDs | `apps-script/recipe-viewer-bound.gs` → paste into Apps Script editor | Apps Script editor |
| Publish/sync/validation logic | `apps-script/recipe-viewer-library.gs` → paste into library project, deploy new version, bump version in bound project | Apps Script editor |
| Recipe data | Google Sheet | Sheet UI |

> Apps Script source is mirrored in `apps-script/` for version history only. Edits there don't
> take effect until pasted into the Apps Script editor (and, for the library, a new version deployed).

## 7. Publish pipeline
### Menu (`onOpen`)
Per-brand submenus: **Publish to site**, **Preview what will publish**, **Sync new photos now**.
Top-level: **Publish ALL brands**.
Admins only: **Admin (IT)** → Refresh photo cheat sheet, Set/update GitHub token, Set up dropdowns.

### Publish flow (`publishToSite(cfg)`)
1. Read token from library Script Properties; abort if missing.
2. `buildRecipes_(cfg)` — read the three tabs, filter by `concept` + `status=live`, attach sorted ingredients + steps, strip empty fields.
3. Fetch `template/index.html` and `/<brand>/logo.svg` from the repo.
4. Fetch current `/<brand>/index.html` (sha + text; 404 ok on first publish).
5. `diffRecipes_()` — compute new/changed/removed; show confirmation dialog.
6. `renderTemplate_()` — inject brand tokens + recipe JSON.
7. PUT rendered HTML back to the repo (commit). Pages redeploys in ~1 minute.

`previewPublish` runs steps 2–5 only (dry run, no commit).

## 8. Photo pipeline

### Drive folder tree
```
Kitchen Ops (shared drive)
└─ Recipe Viewer
   └─ Recipe Viewer Photos
      ├─ Eureka
      │   ├─ Add New Photos Here          (183AGv_ol_pDT-06u4b9ogk2fNFnzmrsr)
      │   ├─ Successfully Uploaded Photos  (1gHU5PMr2TU6-h0rj-TBcMOYhN-WY5msN)
      │   └─ Upload Failed - Needs Review  (1Y64622PugB9_6wzVqnC1c4kAtNdhCN5U)
      ├─ La Popular
      │   ├─ Add New Photos Here          (1MVyGWQSy3nqvKSg-MVSjslpFUPiTE2eH)
      │   ├─ Successfully Uploaded Photos  (1Ggk9tCneneUkf8tIdYiOA5m_Ocwn4AuI)
      │   └─ Upload Failed - Needs Review  (1fe3QTTuu7K1Ad8pAuuNs9ABkm_wLrFPX)
      └─ Amalfi Llama
          ├─ Add New Photos Here          (1fB5BqCoveXFxCv91pkeJQaJnZ9Ft2c2b)
          ├─ Successfully Uploaded Photos  (1YXPXJSfYMOhaKs_8QWcgcuYF70AclHjj)
          └─ Upload Failed - Needs Review  (1JSLmUgSCHYopDeOFHhGuFK3aqpPVpRaG)
```
Folder IDs are permanent — rename/move folders freely.

### End-to-end flow (`syncDropPhotos(cfg)`)
1. Read token.
2. `loadRecipeIndex_(cfg)` — index brand's recipes by slug + slugified name.
3. For each file in **Add New Photos Here**:
   - `slugify_(filename)` — lowercase, strip extension, non-alphanumeric → hyphen.
   - **No match** → move to **Upload Failed - Needs Review**; email a bounce with closest-slug suggestion (Levenshtein).
   - **Matches a prep** → bounce ("photos only show on Plate recipes").
   - **Matches a plate** → `getThumbnailJpeg_()` → `commitImage_()` → rename + move to **Successfully Uploaded Photos**.
4. Append to **Image Sync Log**; email bounce summary if anything failed.

### The normalize trick
Apps Script can't transcode HEIC/large photos. The Drive web thumbnail endpoint yields a ~1600px JPEG without needing the Drive API:
```
https://drive.google.com/thumbnail?id=<fileId>&sz=w1600
```
`getThumbnailJpeg_` fetches unauthenticated then falls back to `Bearer ScriptApp.getOAuthToken()`.
If this endpoint ever breaks, the fallback is a real image service (e.g. Cloudinary).

### Image commit
Always writes `<brand>/images/<slug>.jpg` regardless of source extension. Re-dropping a photo updates the live image.

## 9. Secrets & permissions
- **GitHub PAT** — fine-grained, `erg-recipe-viewer` repo only, Contents R/W. Stored in **library** Script Properties as `GITHUB_TOKEN`. Rotate via Admin (IT) → Set/update GitHub token.
- **Google auth** — runs as the authorizing ERG Workspace user; first run prompts Drive + UrlFetch + Mail scopes (expected).
- **Site is fully public** — GitHub Pages has no access control. Anything published is world-readable.

## 10. Constraints & gotchas
- **`concept` is required on Recipes rows** — blank concept = skipped at publish.
- **Child rows with blank `concept`** are treated as legacy and matched to any brand owning that slug. Tag them.
- **UOM validation rejects off-list values** — clear/extend the dropdown before writing a new unit.
- **Slug uniqueness matters** — join + matching assume unique slugs per brand.
- **Images are Plate-only** — viewer renders a hero only for `type==='plate'`; sync refuses preps.
- **Drive API path unavailable** (locked Cloud project) — web thumbnail endpoint is the workaround.
- **Library version must be bumped** after editing library code — bound project pins a specific version; "latest" is only an option during development.

## 11. Common tasks
- **Add/edit a recipe:** rows in Recipes (+ Ingredients/Steps by slug); set `concept`, `type`, `status`; Preview → Publish.
- **Add a photo (Plate only):** name file to exact slug (Photo Cheat Sheet shows the exact name) → drop in brand's **Add New Photos Here** → **Sync new photos now**.
- **A photo bounced:** rename to exact/suggested slug, confirm it's a Plate, move back to **Add New Photos Here**, re-sync.
- **Rotate token:** Admin (IT) → Set/update GitHub token.
- **Update library logic:** paste new code into the library Apps Script project → Deploy → New deployment (Library) → note new version number → open bound project → Libraries → bump `RVLib` to new version → Save.
- **Add a new brand:** add a `brand_(...)` entry in the bound script, create Drive folders, add a `concept` value to `setupValidation`, add logo SVG and brand subdir to repo, re-run Set up dropdowns.

## 12. Quick reference
| Thing | Value |
|---|---|
| Repo | github.com/nickg-erg/erg-recipe-viewer · `main` |
| Live — Eureka | `…github.io/erg-recipe-viewer/eureka/` |
| Live — La Popular | `…github.io/erg-recipe-viewer/lapopular/` |
| Live — Amalfi Llama | `…github.io/erg-recipe-viewer/amalfillama/` |
| Sheet | Kitchen Ops shared drive → Recipe Viewer → Recipe Viewer Source |
| Token | Library Script Property `GITHUB_TOKEN` (fine-grained PAT, Contents R/W) |
| Bound script project | "ERG Recipe Viewer" (bound to Sheet) |
| Library script project | "recipe-viewer-library" (identifier `RVLib`) |
| Template | `template/index.html` |
| Eureka drop/done/review | `183AGv_ol_pDT-06u4b9ogk2fNFnzmrsr` / `1gHU5PMr2TU6-h0rj-TBcMOYhN-WY5msN` / `1Y64622PugB9_6wzVqnC1c4kAtNdhCN5U` |
| La Popular drop/done/review | `1MVyGWQSy3nqvKSg-MVSjslpFUPiTE2eH` / `1Ggk9tCneneUkf8tIdYiOA5m_Ocwn4AuI` / `1fe3QTTuu7K1Ad8pAuuNs9ABkm_wLrFPX` |
| Amalfi Llama drop/done/review | `1fB5BqCoveXFxCv91pkeJQaJnZ9Ft2c2b` / `1YXPXJSfYMOhaKs_8QWcgcuYF70AclHjj` / `1JSLmUgSCHYopDeOFHhGuFK3aqpPVpRaG` |
| Apps Script mirror | `apps-script/` in repo (version history only — not live code) |

*Keep this file updated whenever the system changes — it's the first thing a future maintainer (or LLM) should read.*
