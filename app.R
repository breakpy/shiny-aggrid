library(shiny)
library(jsonlite)

# Initial sample data
make_df <- function(n=8){
  dates <- as.character(Sys.Date() + sample(0:60, n, TRUE))
  empty_idx <- sample(seq_len(n), size = max(1, floor(n * 0.3)))
  dates[empty_idx] <- ""

  data.frame(
    id = seq_len(n),
    category = sample(c("A","B","C"), n, TRUE),
    short_text = paste0("Item ", seq_len(n)),
    amount = round(runif(n, 1, 90), 2),
    date = dates,
    notes = rep("Long text sample: double-click to edit in popup.", n),
    stringsAsFactors = FALSE
  )
}

ui <- navbarPage(
  "Shiny + ag-Grid Examples",
  tabPanel("Home",
    fluidRow(
      column(8, h3("ag-Grid row-level editing"), p("Full-row editing with validation: dropdowns, numbers, dates and long-text popup editors. Edits are validated when you commit a row.")),
      column(4, wellPanel(h4("Rules"), tags$ul(tags$li("Amount: 0 – 90"), tags$li("Date: today or future (YYYY-MM-DD)"), tags$li("Short text: required"))))
    )
  ),
  tabPanel("Row-level editing",
    fluidRow(
      column(12, div(id = "grid2", class = "ag-theme-alpine my-grid", style = "height:500px;width:100%;")),
      column(12, br(), actionButton("refresh2", "Reload data"), span("\u2003"),
             tags$small("Double-click a row to edit · Tab between cells · Enter to commit · Esc to cancel"),
             span(" "), textOutput("status2"))
    )
  ),
  theme = NULL,
  header = tagList(
    tags$head(
      {
        # prefer local copies if present to avoid browser tracking-prevention blocking CDN
        local_js <- file.exists(file.path('www','ag-grid-community.min.noStyle.js')) || file.exists(file.path('www','ag-grid-community.min.js'))
        local_css1 <- file.exists(file.path('www','ag-grid.css'))
        local_css2 <- file.exists(file.path('www','ag-theme-alpine.css'))

        tagList(
          if (local_css1) tags$link(rel = "stylesheet", href = "ag-grid.css") else tags$link(rel = "stylesheet", href = "https://cdn.jsdelivr.net/npm/ag-grid-community/dist/styles/ag-grid.css"),
          if (local_css2) tags$link(rel = "stylesheet", href = "ag-theme-alpine.css") else tags$link(rel = "stylesheet", href = "https://cdn.jsdelivr.net/npm/ag-grid-community/dist/styles/ag-theme-alpine.css"),
          tags$link(rel = "stylesheet", href = "styles.css"),
          if (local_js) tags$script(src = if (file.exists(file.path('www','ag-grid-community.min.noStyle.js'))) 'ag-grid-community.min.noStyle.js' else 'ag-grid-community.min.js') else tags$script(src = "https://cdn.jsdelivr.net/npm/ag-grid-community/dist/ag-grid-community.min.noStyle.js"),
          tags$script(src = "aggrid-app.js")
        )
      }
    )
  )
)

server <- function(input, output, session){
  normalize_date <- function(x){
    if (is.null(x) || length(x) == 0) return("")
    gsub("[[:space:]]+", "", as.character(x)[1])
  }

  is_valid_date_value <- function(x){
    val <- normalize_date(x)
    if (identical(val, "")) return(TRUE)
    if (!grepl("^[0-9]{4}-[0-9]{2}-[0-9]{2}$", val)) return(FALSE)
    d <- as.Date(val, format = "%Y-%m-%d")
    if (is.na(d)) return(FALSE)
    d >= Sys.Date()
  }

  is_valid_amount_value <- function(x){
    if (is.null(x) || length(x) == 0) return(FALSE)
    v <- suppressWarnings(as.numeric(x)[1])
    if (is.na(v)) return(FALSE)
    v >= 0 && v <= 90
  }

  # reactive storage
  rv <- reactiveValues(
    data2 = make_df(12)
  )

  # send data to client on load and on refresh
  send_all <- function(){
    session$sendCustomMessage("initGrids", list(
      grid2 = unname(lapply(split(rv$data2, seq_len(nrow(rv$data2))), function(r) as.list(r)))
    ))
  }

  # initial send once the session is ready
  observeEvent(session$clientData, { send_all() }, once = TRUE)

  observeEvent(input$refresh2, { rv$data2 <- make_df(12); send_all() })

  # Receive updates from JS when a row or cell is saved/validated
  observeEvent(input$aggrid_updates, {
    msg <- input$aggrid_updates
    isolate({
      if (!is.null(msg$grid) && !is.null(msg$row)){
        gridname <- msg$grid
        row <- msg$row
        if (!is.list(row)) return()
        row <- lapply(row, function(x){
          if (is.null(x) || length(x) == 0) return(NA)
          x
        })
        # convert to data.frame single-row
        rdf <- as.data.frame(row, stringsAsFactors = FALSE)
        if (!"id" %in% names(rdf) || is.na(rdf$id[1])) return()
        # make sure numeric/date types preserved
        if (!is.null(rdf$amount)) {
          if (!is_valid_amount_value(rdf$amount[1])) {
            showNotification("Amount must be numeric and between 0 and 90.00.", type = "error")
            return()
          }
          rdf$amount <- as.numeric(rdf$amount)
        }
        if (!is.null(rdf$date)) {
          rdf$date <- vapply(rdf$date, normalize_date, character(1))
          if (!is_valid_date_value(rdf$date[1])) {
            showNotification("Date must be YYYY-MM-DD and not earlier than today.", type = "error")
            return()
          }
        }

        if (gridname == "grid2"){
          idx <- which(rv$data2$id == rdf$id)
          if (length(idx)) rv$data2[idx, names(rdf)] <- rdf
        }
        showNotification(sprintf("Saved row id %s", rdf$id), type = "message")
      }
    })
  }, ignoreNULL = TRUE)

  output$status2 <- renderText({ sprintf("Rows: %d", nrow(rv$data2)) })
}

suppressWarnings(shinyApp(ui, server))
