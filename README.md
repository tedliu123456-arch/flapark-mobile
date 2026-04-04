# flapark-mobile

Mobile-first landing page for FLAPARK, created as a separate project so the original site remains unchanged.

## Admin

- Admin path: `./admin/`
- First login: set your own PIN in browser localStorage.
- You can edit title/subtitle, 6 menu cards, and store info links.

## Local preview

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

## Deploy suggestion

- Enable GitHub Pages from `main` branch root.
- Then map custom path/domain as needed (e.g. flapark.com/m via reverse proxy/CDN rule).
