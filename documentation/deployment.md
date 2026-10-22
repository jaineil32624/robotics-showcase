# Deployment

The website is a fully static export (`output: "export"`), so any static host works.

## GitHub Pages (default)

`.github/workflows/ci.yml` builds with `NEXT_PUBLIC_BASE_PATH=/robotics-showcase`, uploads `website/out` and
deploys it with `actions/deploy-pages` on every push to `main`.

One-time setup: *Settings → Pages → Build and deployment → Source: GitHub Actions*.

Live URL: <https://jaineil32624.github.io/robotics-showcase/>

## Vercel

1. Import the repository, set **Root Directory** to `website`.
2. Framework preset: Next.js (build `npm run build`, output `out`).
3. Leave `NEXT_PUBLIC_BASE_PATH` empty when deploying at a domain root.

## Netlify / any CDN

```bash
cd website && npm install && npm run build
# upload website/out
```

## Notes

- The GLB is served from `/models/argo_q4.glb` (≈ 6.4 MB). Hosts compress it with gzip/brotli automatically;
  enable long-term caching for `/models/*`.
- All pages are pre-rendered; WebGL initialises client-side only.
