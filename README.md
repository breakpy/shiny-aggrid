# Shiny + AG Grid — Full-Row Editing

A Shiny application demonstrating AG Grid Community embedded in R/Shiny with full-row editing, client-side validation, and a Notes modal dialog.

## Features

- **Full-row editing** — double-click any cell to enter edit mode for the whole row
- **Custom date picker** — native `<input type="date">` cell editor; press Space/Enter to open the calendar
- **Notes modal** — long-text notes field opens a dedicated dialog (double-click cell or press Enter/Space when focused)
- **Per-cell validation** — red cell borders + tooltip on invalid fields (short text required, amount 0–90, date today or future)
- **Toast notifications** — non-blocking error/success messages
- **Row flash animation** — green flash on successful save, red flash on validation failure
- **Change detection** — row is only saved to the server if values actually changed
- **Server-side validation** — R re-validates amount and date as a final gate before persisting

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| Double-click | Start editing row / open Notes modal |
| Tab | Move between cells in the editing row |
| Enter | Commit row (or open date picker / Notes modal when on those cells) |
| Space | Open date picker / Notes modal when on those cells |
| Escape | Cancel row edit (restores original values) |

## Column rules

| Column | Rule |
|--------|------|
| Short text | Required |
| Amount | Numeric, 0 – 90 |
| Date | YYYY-MM-DD, today or future (blank allowed) |
| Notes | Free text up to 2 000 characters |

## Requirements

- R 4.x+
- R packages: `shiny`, `jsonlite`

```r
install.packages(c("shiny", "jsonlite"))
```

## Run

```r
shiny::runApp()
```

Or use the included helper:

```r
source("run_app.R")
```

## AG Grid

The app loads AG Grid Community from local `www/` files if present, otherwise falls back to the jsDelivr CDN automatically. No licence key required for AG Grid Community.

## Structure

```
app.R                   # Shiny UI + server
run_app.R               # Convenience launcher
www/
  aggrid-app.js         # AG Grid initialisation, editors, validation, save logic
  styles.css            # Flash animations, cell-error styles
  ag-grid-community...  # AG Grid vendor bundle (optional, ignored by git)
```

