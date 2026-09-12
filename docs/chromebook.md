# Chromebook and browser version

**[Open Data Tool 2027 in your browser](https://paulnord.github.io/data-tool-2027/)**

Use a current version of Chrome on a Chromebook or another computer. There is no desktop installer, Linux environment or account requirement. Fitting and data handling happen locally in the browser; measurement files are not uploaded. GitHub Pages serves the application files.

1. Open the browser link.
2. Choose **Data → Load file** and select a CSV, Tracker file or saved session from your Chromebook's Files picker. Pasting data also works.
3. Inspect the graph, choose the fit, and save a session or copy/print the report. Saved files go through your browser's download workflow; reopen the downloaded session to continue later.

Use the **Examples** menu to open one of the built-in or published datasets directly. You can still use **[Download example files](https://paulnord.github.io/data-tool-2027/examples.zip)** to keep a copy in Files or browse additional files through Data → Load file.

Chrome can open the site in its own app window using **Install page as app** in the browser menu, when available. See [Google's web-app instructions](https://support.google.com/chrome/answer/9658361). A managed school Chromebook may restrict sites or installation; using the site in a browser tab does not require installation.

An internet connection is needed to open or reload the application. Offline startup is not implemented. Installing a shortcut does not automatically save your analysis: save sessions/download data before closing the tab. Multi-interval and collision setups still cannot be saved as sessions; copy or print their reports before closing.

The browser version uses the same scientific core and file validation as the desktop app. It cannot receive Tracker's native process-launch/acknowledgment integration. Printing uses the browser print dialog; spreadsheet paste uses the browser clipboard permissions.

For a larger single-fit figure, open **Print** and select **Full-page graph** in the preview. The preview updates immediately; the same option is also available under **Settings → Full-page graph when printing**. The graph and residuals rotate together on the first portrait Letter sheet, exactly as shown in the preview. Their horizontal scales and frame widths match, with the shared X labels beneath the residual plot. Tables and source notes start on subsequent upright pages. Keep the printer orientation at **Portrait**; no mixed page orientations are needed.

Use **Display** for interface size and graph appearance. Colors, marker size, and marker style update all graphs immediately, including print output. Solid markers have no white border; **Open circle** has a transparent center. These are viewing preferences and do not change the observations, fit, or saved session. **Reset appearance** restores the graph defaults while keeping the interface size.

The **X axis** and **Y axis** triangles above a single-fit graph contain each axis's logarithmic scale, zoom, and minimum/maximum limits. Select **Auto** on each axis to restore its automatic range. X limits apply to both the data and residual plots. Changing the view does not change which observations are included in the fit.

**Export graph** in the top toolbar downloads **SVG**, **PDF**, or **PNG** with the displayed colors and markers. For collision and multi-interval analyses, the visible graphs are stacked in one figure. SVG keeps editable vector artwork and text. PDF contains a cropped vector figure with embedded fonts; it is the simplest option for inserting a sharp graph into an Overleaf paper. PNG is rendered at up to three times the displayed graph dimensions for applications that require an image. Figure exports contain the graphs and axes; use **Print** for the complete report.

In LaTeX, load `\usepackage{graphicx}` and insert the PDF with `\includegraphics[width=\linewidth]{graph.pdf}`. LaTeX can size and place the figure but does not automatically change the fonts or line styles inside it. Edit the SVG before converting to PDF when a publication needs more detailed changes. See [Overleaf's image-format guidance](https://docs.overleaf.com/writing-and-editing/inserting-images/advanced-latex-image-topics).

## Validation and deployment

The production build is tested in Chrome at 1366×768 under the actual /data-tool-2027/ URL prefix, including all three fit workers, clipboard report export, session download/reopen, the app manifest and example archive. This is browser compatibility testing, not a claim of testing on physical Chromebook hardware or every school's device policy.

The GitHub Pages workflow builds and validates main before deploying. npm run build:web creates the hosted build; npm run test:web tests it through the preview server. DATA_TOOL_WEB_URL can point the same checks at the deployed site. The ordinary npm run build remains the desktop build.
