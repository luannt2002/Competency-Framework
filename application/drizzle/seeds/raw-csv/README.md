# Raw CSV from Google Sheets

Đặt 2 file CSV ở đây sau khi export từ Google Sheets:

## Sheet 1 — Skills Matrix
- **URL:** https://docs.google.com/spreadsheets/d/1mejAsbHOU2c2GEQ3hTs2_sQyXD4vxgtttsuy7dRbTvw/edit?gid=1970847068
- **Filename:** `skills.csv`
- **Expected columns:**

| Column | Required | DB field |
|---|---|---|
| Category | yes | `skill_categories.name` |
| Skill | yes | `skills.name` |
| Description | no | `skills.description` |
| Tags | no | `skills.tags` (comma-separated) |
| Display Order | no | `skills.display_order` |

## Sheet 2 — Competency Levels
- **URL:** https://docs.google.com/spreadsheets/d/1mejAsbHOU2c2GEQ3hTs2_sQyXD4vxgtttsuy7dRbTvw/edit?gid=1890838692
- **Filename:** `levels.csv`
- **Expected columns:**

| Column | Required | DB field |
|---|---|---|
| Code | yes (XS/S/M/L) | `competency_levels.code` |
| Label | yes | `competency_levels.label` |
| Numeric | yes (0..100) | `competency_levels.numeric_value` |
| Description | no | `competency_levels.description` |
| Examples | no | `competency_levels.examples` |

## Cách export

1. Mở Google Sheet → click vào tab cần export.
2. `File → Download → Comma Separated Values (.csv)`.
3. Rename file thành `skills.csv` / `levels.csv` rồi đặt vào thư mục này.

## Sau khi đặt CSV

```bash
pnpm gen:seed-from-csv
pnpm db:seed
```

Script `gen:seed-from-csv` sẽ merge data CSV vào `drizzle/seeds/devops.json` (giữ nguyên tracks/weeks/lessons/exercises, chỉ replace categories+skills+levels).
