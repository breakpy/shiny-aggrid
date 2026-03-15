# Shiny + ag-Grid examples

This small project demonstrates two ag-Grid tables embedded inside a Shiny app:

- A single-cell editing grid with in-cell editors (dropdown, numeric, date, long-text popup).
- A full-row / popup editing grid that validates and saves rows when editing stops or rows are dragged.

Requirements
- R (4.x+)
- R package: `shiny`

Run

In R console:

```r
install.packages('shiny')
shiny::runApp('c:/Users/alpa_/shinyaggrid')
```

Notes
- The app uses ag-Grid via CDN and communicates edits back to the server using Shiny inputs.
- Validation occurs client-side (simple checks) and server updates the in-memory dataset and shows a notification.
