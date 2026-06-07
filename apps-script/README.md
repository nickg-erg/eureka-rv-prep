# Apps Script — ERG Recipe Viewer

Mirror of the Apps Script source for version history. **Live code runs in the
Apps Script editor bound to the recipe Google Sheet — edits here do not take
effect until pasted in there.**

---

## Overview

`recipe-viewer.gs` is a single Apps Script file that powers all three ERG
brand viewers (Eureka, La Popular, Amalfi Llama). It:

- Reads recipe data from the Google Sheet
- Renders brand-specific HTML and commits it to GitHub Pages via the API
- Manages a photo pipeline: source Drive folder → Drop folder → GitHub images + Drive Done folder

---

## Menu structure

The script adds a **Recipe Viewer** menu to the Sheet.

| Menu item | What it does |
|-----------|-------------|
| **Publish to site** | Renders the full recipe page and pushes `index.html` to GitHub |
| **Preview what will publish** | Same render but shows a popup instead of committing |
| **Sync new photos now** | Processes files in the Drop folder: resize to JPEG → commit to GitHub `images/` → save copy to Done folder → trash original |
| **Stage source photos → Drop** | Copies files from the brand's source Drive folder into the Drop folder with slug-matched filenames |
| **Publish ALL brands** | Runs Publish for all three brands in sequence |

Admin-only items (shown only to addresses in `ADMINS`):

| Menu item | What it does |
|-----------|-------------|
| Refresh photo cheat sheet | Rebuilds the Photo Cheat Sheet tab with current slug → image status |
| Clean LP drop folder (one-time) | Renames/deletes La Popular drop files that staged with wrong names |
| Clean Amalfi drop folder (one-time) | Renames/deletes Amalfi Llama drop files that staged with wrong names; reports duplicates |
| Delete .jpeg duplicates — \<Brand\> | Removes non-`.jpg` images from GitHub `images/` dir (cleanup after a mixed-extension run) |
| Set / update GitHub token | Stores a PAT in Script Properties for GitHub API calls |
| Set up dropdowns | Creates Sheet data-validation dropdowns for UOM, type, etc. |

---

## Photo pipeline

```
Source Drive folder (read-only)
        │  Stage source photos → Drop
        ▼
    Drop folder
        │  Sync new photos now
        ├─► GitHub Pages  images/<slug>.jpg   (1200 px wide JPEG, committed via API)
        ├─► Drive Done    <slug>.jpg           (same resized blob saved here)
        └─► original file trashed
                          ↕
              Review folder  (files that didn't match any slug bounce here)
```

Resize / conversion uses the Drive thumbnail endpoint
(`https://drive.google.com/thumbnail?id=X&sz=w1200`), which handles HEIC,
JPEG, PNG, etc. and outputs a JPEG at the requested width.

---

## Slug matching

When staging, each source file's name (minus extension, lowercased,
spaces → hyphens) is matched against the list of recipe slugs pulled from the
Sheet using token-based fuzzy scoring:

1. Split both the file key and slug into tokens; remove stop words and pure numbers.
2. Count shared tokens (plural-aware: `cake` ≈ `cakes`).
3. Score = shared / max(key tokens, slug tokens). Match if ≥ 0.5.
4. Fallback to Levenshtein distance if no token match passes threshold.

Files that score below threshold are sent to the Review folder.

---

## Configuration (BRANDS object)

Each brand entry in `BRANDS` contains:

| Field | Description |
|-------|-------------|
| `brandName` | Display name |
| `concept` | Used in Sheet queries |
| `brandPrimary` / `brandAccent` | Hex colors for the rendered page |
| `outputPath` | GitHub path for the published HTML |
| `logoPath` | GitHub path to the brand logo SVG |
| `imageDir` | GitHub path prefix for recipe images |
| `sourceFolderId` | Drive folder ID for raw/source photos |
| `dropFolderId` | Drive folder ID for the staging queue |
| `doneFolderId` | Drive folder ID for successfully synced resized images |
| `reviewFolderId` | Drive folder ID for unmatched/bounced files |

---

## Setup checklist (new environment)

1. Create a GitHub PAT with `repo` scope and run **Set / update GitHub token** from the Admin menu.
2. Verify `REPO_OWNER`, `REPO_NAME`, and `BRANCH` constants at the top of the script match the target repo.
3. Add operator email addresses to the `ADMINS` array to enable the Admin submenu.
4. Confirm the four Drive folder IDs per brand are correct.
5. Run **Set up dropdowns** once to initialize Sheet validation.
