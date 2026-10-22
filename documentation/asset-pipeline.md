# Asset pipeline

## Export

`export_all()` selects the `ARGO_Q4` and `Props` collections and calls the glTF exporter with:

| Setting | Value | Why |
|---|---|---|
| format | GLB | single file for web & mobile |
| animation mode | `SCENE` (fallback `ACTIVE_ACTIONS`) | the whole timeline baked once |
| force sampling / optimise size | on / on | exact poses, duplicate keys removed |
| extras | on | `part_title`, `part_category`, `part_group` on every node |
| textures / UVs | off | factor-only materials keep the file small |
| cameras / lights | off | the viewers provide their own |

Output (`assets/model/`):

| File | Size | Content |
|---|---|---|
| `argo_q4.glb` | ≈ 6.4 MB | 93 nodes, 71 meshes, 17 materials, 2 490 samples per animated channel |
| `parts.json` | 28 KB | catalogue: title, category, group, description, specs, mass |
| `clips.json` | 3 KB | fps, frame range and metadata of the 10 clips |
| `argo_q4.blend` | 2.8 MB | (saved in `blender/`) full source scene |

## Syncing

- **Website** — `npm run dev` / `npm run build` run `scripts/sync-assets.mjs`, which copies the GLB to
  `public/models/`, the JSON catalogues to `src/data/` and the renders to `public/renders/`.
- **Mobile** — `npm run build:viewer` bundles the renderer, writes `assets/viewer/model.js`
  (`window.ARGO_MODEL_B64 = "…"`) and refreshes `src/data/*.json`. The Expo config plugin copies
  `assets/viewer/` into the Android project's `assets/` during prebuild.

## Naming contract

Node names are the contract between Blender and the runtimes:

- `ARGO_Q4` — root (walking travel; zeroed for *in-place* mode)
- `Power_Level` — `scale.x` = power 0…1
- every key of `parts.json` — an inspectable component
- `Glow_Cyan`, `Glow_Amber` — emissive materials driven by power
