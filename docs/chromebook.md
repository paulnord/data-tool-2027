# Chromebook and browser version

**[Open Data Tool 2027 in your browser](https://paulnord.github.io/data-tool-2027/)**

Use a current version of Chrome on a Chromebook or another computer. There is no desktop installer, Linux environment or account requirement. Fitting and data handling happen locally in the browser; measurement files are not uploaded. GitHub Pages serves the application files.

1. Open the browser link.
2. Choose **Data → Load file** and select a CSV, Tracker file or saved session from your Chromebook's Files picker. Pasting data also works.
3. Inspect the graph, choose the fit, and save a session or copy/print the report. Saved files go through your browser's download workflow; reopen the downloaded session to continue later.

**[Download example files](https://paulnord.github.io/data-tool-2027/examples.zip)**, extract the ZIP in Files, then select an ordinary file through Data → Load file. Unlike the desktop app, a website cannot set the browser's file picker to a bundled examples folder. There is no example-selection menu in the app.

Chrome can open the site in its own app window using **Install page as app** in the browser menu, when available. See [Google's web-app instructions](https://support.google.com/chrome/answer/9658361). A managed school Chromebook may restrict sites or installation; using the site in a browser tab does not require installation.

An internet connection is needed to open or reload the application. Offline startup is not implemented. Installing a shortcut does not automatically save your analysis: save sessions/download data before closing the tab. Multi-interval and collision setups still cannot be saved as sessions; copy or print their reports before closing.

The browser version uses the same scientific core and file validation as the desktop app. It cannot receive Tracker's native process-launch/acknowledgment integration. Printing uses the browser print dialog; spreadsheet paste uses the browser clipboard permissions.

## Validation and deployment

The production build is tested in Chrome at 1366×768 under the actual /data-tool-2027/ URL prefix, including all three fit workers, clipboard report export, session download/reopen, the app manifest and example archive. This is browser compatibility testing, not a claim of testing on physical Chromebook hardware or every school's device policy.

The GitHub Pages workflow builds and validates main before deploying. npm run build:web creates the hosted build; npm run test:web tests it through the preview server. DATA_TOOL_WEB_URL can point the same checks at the deployed site. The ordinary npm run build remains the desktop build.
