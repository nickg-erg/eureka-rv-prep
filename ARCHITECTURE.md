# ERG Recipe Viewer — Architecture & Operations

**Status:** Live — Eureka, La Popular, Amalfi Llama.
**Audience:** future maintainers (human or LLM). Source of truth for how the whole system fits
together. If this disagrees with memory or an old chat, trust this file (and verify against the live
system).

---

## 1. What this is

A back-of-house recipe viewer for Eureka Restaurant Group (ERG) kitchens, served on iPad-mini
kiosks. Culinary authors recipes in a Google Sheet; a "Publish" button bakes that data into a static
page on GitHub Pages — one page per brand. Photos are uploaded via a Drive drop folder and
committed to the repo by a separate "Sync" step.

A corporate brand-selector landing page at the repo root lets the culinary team navigate to any
brand from a single URL.

Two guiding properties:
- **Recipe data is offline-capable** — embedded in the HTML at publish time, so the viewer works
  without a network once loaded. Images load over wifi and fail gracefully if offline.
- **Everything is a deliberate manual action** — publishing recipes and syncing photos are both
  menu-triggered. Nothing runs automatically.

---

## 2. System at a glance

```
Google Sheet  ──(Recipe Viewer ▸ [Brand] ▸ Publish)──►  GitHub repo: nickg-erg/erg-recipe-viewer
(Recipes / Ingredients / Steps)                            /<brand>/index.html  (data spliced in)
              │  bound Apps Script (recipe-viewer.gs)      /index.html          (brand selector)
              │                                            /<brand>/images/     (photos)
              │                                                     │
Google Drive  │ (Recipe Viewer ▸ [Brand] ▸ Sync new photos now)    ▼
"Add New      └──► Apps Script ──────────────────────────► GitHub Pages (auto-deploy ~1 min)
 Photos Here"       resize + commit          https://nickg-erg.github.io/erg-recipe-viewer/
```

| Component | What it is | Where |
|---|---|---|
| Recipe Sheet | Authoring DB: Recipes / Ingredients / Steps tabs | Kitchen Ops shared drive → Recipe Viewer → Recipe Viewer Source |
| Apps Script | All logic — publish, photo sync, validation, menus | Single project bound to the Sheet (`Extensions > Apps Script`) |
| Repo | Template, per-brand `index.html`, images, logos, this doc | github.com/nickg-erg/erg-recipe-viewer (`main`) |
| Brand selector | Root `index.html` — links to all three brand viewers | `https://nickg-erg.github.io/erg-recipe-viewer/` |
| Live viewers | iPad kiosks per brand | `…/eureka/`, `…/lapopular/`, `…/amalfillama/` |
| Photo folders | Drop / done / review per brand | Kitchen Ops → Recipe Viewer → Recipe Viewer Photos → [Brand] |

---

## 3. Roles — who does what

| Role | Responsibilities | Touches |
|---|---|---|
| **Culinary (authors)** | Add/edit recipes in Sheet; drop photos in Drive | Sheet + Drive only — never GitHub |
| **Recipe manager / publisher** | Runs Publish and Sync from the Sheet menu | Sheet menu |
| **IT / Admin** | GitHub token, dropdown setup, image cleanup | Admin (IT) submenu (email-gated) |

---

## 4. The data — Google Sheet

File: **Recipe Viewer Source** in the Kitchen Ops shared drive.
All three brands share one Sheet. The `concept` column partitions rows by brand.
Columns are read **by header name**, not position — column order can change freely.

### Recipes tab (one row per recipe)
| column | meaning |
|---|---|
| `concept` | `Eureka` / `La Popular` / `Amalfi Llama`. **Required** — blank = skipped. |
| `slug` | Unique key, lowercase-hyphen (e.g. `poke-bowl`). Joins to Ingredients/Steps. |
| `name` | Display name |
| `type` | `prep` or `plate` |
| `yield_1x`, `yield_2x` | Batch yields |
| `prep_time` | Estimated prep time |
| `shelf_life` | Shelf life |
| `plate` | Plating/serving note |
| `image_url` | Unused by viewer (images found by slug); reserved for future use |
| `note` | Free-text note shown on the detail page |
| `status` | `live` or `draft`. Only `live` rows publish. |
| `category` | Grouping label (e.g. "Signature Burgers") |

### Ingredients tab
`concept`, `slug`, `order` (sort), `ingredient`, `qty_1x`, `qty_2x`, `uom`, `step_group`,
`links_to` (points a "PREP …" row at its prep recipe's slug).

### Steps tab
`concept`, `slug`, `step_no` (sort), `text`, `step_group`.

### UOM Config tab (auto-created)
Column A: `uom` header + list of allowed UOM values. Culinary edits this list directly.
Re-run **Admin (IT) → Set up dropdowns** after changing it.

### Auxiliary tabs (auto-generated)
- **Photo Cheat Sheet** — every recipe's exact required filename + uploaded yes/no.
- **Image Sync Log** — audit trail of each photo sync run.

---

## 5. Apps Script — single bound project

**File in repo:** `apps-script/recipe-viewer.gs` (repo mirror for version history — live code is
in the Sheet's bound Apps Script project).

One file, one project. No library dependency. Token stored in the bound project's own
Script Properties (`GITHUB_TOKEN`).

### Key sections
| Section | What it does |
|---|---|
| `BRANDS` config | Per-brand colors, paths, Drive folder IDs, source photo folder IDs |
| `onOpen` / menu | Builds the Recipe Viewer menu on Sheet load |
| `publishToSite` | Fetch template → build recipes → diff → confirm → commit HTML |
| `syncDropPhotos` | Drive drop → match slugs → resize → commit JPEGs to GitHub + Drive Done |
| `importSourcePhotos` | Bulk import from a source Drive folder; token-matched + renamed to slugs. **Not in menu** — run manually if ever needed for a new brand. |
| `setupValidation` | Apply dropdowns (UOM, type, status, concept) to all tabs |
| `generateImageCheatSheet` | Write/refresh the Photo Cheat Sheet tab |
| `refreshReadme` | Rewrite the README tab with current instructions and formatting |
| `deleteNonJpgImages` | Remove orphaned non-.jpg files from a brand's GitHub images dir |
| `cleanDropFolder*` / `cleanAmalfiReviewFolder` | One-time cleanup functions (run once after initial migration) |

### Updating the script
Edit `apps-script/recipe-viewer.gs` in this repo and push to `main` — a GitHub Action
(`.github/workflows/clasp-push.yml`) automatically syncs the file to the bound Apps Script
project via CLASP. Reload the Sheet to pick up the new menu.

Manual fallback: open the Sheet → **Extensions > Apps Script** → select all → paste → **Ctrl+S** → reload Sheet.

---

## 6. The template — `template/index.html`

Shared HTML for all brands. Publish fetches it, injects tokens and recipe JSON, commits to
`/<brand>/index.html`.

### Token placeholders
| Placeholder | Replaced with |
|---|---|
| `{{BRAND_NAME}}` | `Eureka` / `La Popular` / `Amalfi Llama` |
| `{{BRAND_PRIMARY}}` | Hex color |
| `{{BRAND_ACCENT}}` | Hex color |
| `{{BRAND_LOGO_SVG}}` | Inline SVG from `/<brand>/logo.svg` |

### Recipe data markers (must not be removed)
```js
/* RECIPES:START */
  const RECIPES = [ … ];
/* RECIPES:END */
```

### Viewer behavior
- Filter sidebar: type (PREP/PLATE), search, category grouping.
- Detail page: name, metadata pills, note, ingredients table (1x/2x, empty columns hide), steps.
- **Hero image** — viewer looks for `<brand>/images/<slug>.jpg` for ALL recipe types. Container
  starts `display:none`, revealed on `load`, stays hidden on `error`. No re-publish needed after
  syncing a new photo — the image appears automatically.
- Sized for iPad-mini kiosks; responsive for other devices.

---

## 7. Publish pipeline

### Flow (`publishToSite`)
1. Read `GITHUB_TOKEN` from Script Properties.
2. Build recipes: filter Sheet by `concept` + `status=live`, join ingredients + steps by slug.
3. Fetch `template/index.html` and `/<brand>/logo.svg` from repo.
4. Fetch current `/<brand>/index.html` (sha + content; 404 ok on first publish).
5. Diff new vs live — show confirmation dialog (added / changed / removed counts).
6. Inject brand tokens + recipe JSON into template.
7. PUT to GitHub. Pages redeploys in ~1 minute.

`Preview what will publish` runs steps 2–5 only (no commit).

---

## 8. Photo pipeline

### Drive folder structure
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
Folder IDs are permanent — folders can be renamed or moved freely.

### Sync flow (`syncDropPhotos`)
1. Load recipe index for this brand (all slugs + slugified names).
2. For each file in **Add New Photos Here**:
   - Slugify the filename (lowercase, strip extension, non-alphanumeric → hyphen).
   - Token-based fuzzy match against recipe slugs (falls back to Levenshtein).
   - **No match** → move to **Upload Failed - Needs Review**; email bounce with closest-slug suggestion.
   - **Match found** → resize to 1200px wide JPEG via Drive thumbnail endpoint (converts HEIC too) → commit to `<brand>/images/<slug>.jpg` on GitHub → save same resized file to **Successfully Uploaded Photos** → trash original.
3. Email bounce summary if any files failed. Append to **Image Sync Log**.

### Image sizing
- Drive thumbnail endpoint: `https://drive.google.com/thumbnail?id=<fileId>&sz=w1200`
- Returns a JPEG regardless of source format (converts HEIC/PNG automatically).
- Both GitHub and Drive Done folder receive the same resized file — they are always 1:1.
- Format is JPEG. WebP would require an external CDN/image proxy.

### Slug matching
File naming doesn't need to be exact. The fuzzy matcher:
1. Tokenizes both filename and slug on hyphens.
2. Scores by shared token count ÷ max token count (ignores stop words and numbers).
3. Accepts if score ≥ 0.5. Falls back to Levenshtein for short close names.

Examples that match automatically: `CHICKEN FAJITAS.jpg` → `chicken-fajitas`, `Salmon Bravo.jpg` → `salmon-bravo`, `SALSA TOREADO 7.10.44 AM.jpg` → `salsa-toreado`.

For exact filename requirements, run **Admin (IT) → Refresh photo cheat sheet**.

---

## 9. ✅ Culinary photo workflow (day-to-day)

### Adding a new recipe with a photo
1. Add the recipe row(s) to the Sheet (Recipes + Ingredients + Steps tabs). Set `status = live`.
2. Run **Recipe Viewer → [Brand] → Publish to site**.
3. Drop the photo into **Add New Photos Here** for that brand in Drive. Any common image format works (JPEG, PNG, HEIC). Name it anything close to the dish name — exact slug not required.
4. Run **Recipe Viewer → [Brand] → Sync new photos now**.
5. Done. Site updates within ~1 minute. No re-publish needed after syncing.

### Adding a photo to an existing recipe
1. Drop the photo in **Add New Photos Here**.
2. Run **Sync new photos now**. That's it — no publish needed.

### If a photo lands in "Upload Failed - Needs Review"
You'll receive an email with the reason and a suggested slug. Either:
- Rename the file to the suggested slug (keep the extension), move it back to **Add New Photos Here**, re-sync.
- Or check the **Photo Cheat Sheet** tab in the Sheet for the exact required filename.

### Replacing a photo
Drop a new photo with the same name into **Add New Photos Here** and re-sync. It overwrites the existing image on the site.

---

## 10. Secrets & permissions

- **GitHub PAT** — fine-grained, `erg-recipe-viewer` repo only, Contents R/W. Stored in bound
  Script Properties as `GITHUB_TOKEN`. Rotate via **Admin (IT) → Set/update GitHub token**.
- **Google auth** — runs as the authorizing ERG Workspace user. First run prompts Drive + UrlFetch
  + Mail scopes (expected).
- **Site is fully public** — GitHub Pages has no access control. Anything published is world-readable.

---

## 11. Constraints & gotchas

- **`concept` required on all Recipes rows** — blank = skipped at publish.
- **Slug uniqueness** — slugs must be unique per brand; join + matching depend on this.
- **Images referenced by slug** — viewer looks for `<brand>/images/<slug>.jpg` directly; `image_url` column in the Sheet is not used.
- **Only `.jpg` files are served** — the sync always commits as `.jpg`. Non-`.jpg` files in the images dir are orphaned. Use **Admin (IT) → Delete .jpeg duplicates** to clean up.
- **UOM validation** — rejects values not on the UOM Config tab list. Edit UOM Config tab, then re-run **Set up dropdowns**.
- **Drive thumbnail endpoint** — used for HEIC conversion and resizing. If it ever breaks (rare), files will land in Review with a "couldn't read" error; fallback is a real image service.
- **Apps Script 6-minute limit** — large photo sync runs (50+ files) may time out. If so, re-run; already-committed files just overwrite harmlessly.

---

## 12. Common tasks

| Task | Steps |
|---|---|
| Add/edit a recipe | Edit Sheet rows → Preview → Publish |
| Add a photo | Drop in **Add New Photos Here** → Sync |
| Replace a photo | Drop new file (same name) → Sync |
| Add a UOM | Edit UOM Config tab column A → **Admin (IT) → Set up dropdowns** |
| Rotate GitHub token | **Admin (IT) → Set/update GitHub token** |
| Clean up orphaned images | **Admin (IT) → Delete .jpeg duplicates — [Brand]** |
| Update the script | Edit `apps-script/recipe-viewer.gs` in repo → push to `main` → CLASP auto-deploys → reload Sheet |
| Add a new brand | Add `brand_(…)` entry in script, create Drive folders, add concept to `setupValidation`, add logo SVG + brand subdir to repo, re-run Set up dropdowns |
| Bulk import existing photos | Call `importSourcePhotos(brand)` directly in Apps Script editor → Sync |

---

## 13. Quick reference

| Thing | Value |
|---|---|
| Repo | github.com/nickg-erg/erg-recipe-viewer · `main` |
| Brand selector | `…github.io/erg-recipe-viewer/` |
| Live — Eureka | `…github.io/erg-recipe-viewer/eureka/` |
| Live — La Popular | `…github.io/erg-recipe-viewer/lapopular/` |
| Live — Amalfi Llama | `…github.io/erg-recipe-viewer/amalfillama/` |
| Sheet | Kitchen Ops → Recipe Viewer → Recipe Viewer Source |
| Apps Script | Bound to Sheet (`Extensions > Apps Script`) |
| Script | `apps-script/recipe-viewer.gs` — source of truth; CLASP auto-deploys on push to `main` |
| Token | Script Properties → `GITHUB_TOKEN` (fine-grained PAT, Contents R/W) |
| Template | `template/index.html` |
| Eureka drop/done/review | `183AGv_ol_pDT-06u4b9ogk2fNFnzmrsr` / `1gHU5PMr2TU6-h0rj-TBcMOYhN-WY5msN` / `1Y64622PugB9_6wzVqnC1c4kAtNdhCN5U` |
| La Popular drop/done/review | `1MVyGWQSy3nqvKSg-MVSjslpFUPiTE2eH` / `1Ggk9tCneneUkf8tIdYiOA5m_Ocwn4AuI` / `1fe3QTTuu7K1Ad8pAuuNs9ABkm_wLrFPX` |
| Amalfi Llama drop/done/review | `1fB5BqCoveXFxCv91pkeJQaJnZ9Ft2c2b` / `1YXPXJSfYMOhaKs_8QWcgcuYF70AclHjj` / `1JSLmUgSCHYopDeOFHhGuFK3aqpPVpRaG` |
| La Popular source photos | `1kkKillNpDiSZxYg81NbVDvp4PE-1DzPI` |
| Amalfi Llama source photos | `13v7GMV3RM3ucmJr2vq8CbHc5u9U8h2W-` |

*Keep this file updated whenever the system changes — it's the first thing a future maintainer (or LLM) should read.*
