# Sharing Data Tool 2027

The source repository and distributable applications serve different audiences. Teachers and students should receive a direct browser link or an installer download, without having to build the source.

## Recommended distribution

- **Web:** GitHub Pages, deploying the Vite build through GitHub Actions. This app does its fitting locally in the browser; it does not need a data-processing server. Configure the Vite base path for the repository URL, test worker loading under that path, and provide ordinary example files as downloads. Browser file pickers and downloads replace the native desktop file dialogs and Tracker launch integration. The [browser version](https://paulnord.github.io/data-tool-2027/) is deployed through the Chromebook and web app workflow. See [Chromebook instructions](chromebook.md).
- **Desktop:** versioned GitHub Releases with release notes and platform-specific downloads. Start with a clearly marked Mac preview. The first preview provides a universal Intel/Apple Silicon Mac DMG, Windows x64 setup installer, and Linux x64 DEB/AppImage. The Mac build is ad-hoc signed, not Developer ID signed or notarized. For general classroom distribution, provide a signed and notarized Mac DMG, ideally with both Intel and Apple Silicon support. Windows and Linux packages have passed native builds and host tests; interactive platform checks remain before calling them classroom-supported.
- **Source:** keep source, examples, scientific tests, license and compatibility documentation together. Tag the exact source revision used for each binary release. Keep built applications out of Git history and attach them to Releases.

Recommended references: [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases), [Vite deployment to GitHub Pages](https://vite.dev/guide/static-deploy), and [Tauri macOS signing](https://v2.tauri.app/distribute/sign/macos/).

## Future Open Source Physics inclusion

Retain the inherited license and extraction history, and keep the Tracker integration contract documented. Prepare a stable release, a browser demonstration, example lab exercises and a short explanation of how this independent tool complements Tracker. Then approach the OSP maintainers about a collection listing and, separately, whether they want organizational hosting or maintenance. A listing does not require assuming that the repository must move.

The [OSP project page](https://www.compadre.org/osp/webdocs/About.cfm) provides its staff contact route. No OSP submission or endorsement has been requested. The project remains an independent development draft.


## Automated desktop previews

Run **Actions → Desktop preview → Run workflow** in the public repository. The workflow runs scientific and browser checks alongside builds of Windows x64 NSIS, universal macOS DMG (Intel and Apple Silicon), and Linux x64 DEB/AppImage on native GitHub runners. Each platform runs the Rust host tests. Packages are attached to a draft prerelease. Publish only after all validation and packaging jobs pass.

The Mac deployment target is macOS 12.3 or newer because the frontend uses modern WebKit APIs such as structuredClone; this is a build target, not a claim that every OS version has been tested. Linux packages are built on Ubuntu 22.04 and require a compatible desktop/WebKit environment. Windows uses WebView2. ARM Windows and ARM Linux are not part of this first matrix.

The first preview uses tag v0.1.0-preview.1; choose a new version and tag before publishing another release. Signing/notarization credentials are not configured. Do not label these previews as signed production installers.


## First published preview

[Download v0.1.0-preview.1](https://github.com/paulnord/data-tool-2027/releases/tag/v0.1.0-preview.1). The [final build](https://github.com/paulnord/data-tool-2027/actions/runs/34510013729) passed scientific tests, browser workflows, the web build, native host tests on all three platforms, and all packaging jobs. The downloaded Mac DMG checksum, ad-hoc signature, both executable architectures and bundled examples were also checked locally. No Windows or Linux interactive desktop validation is claimed.

Before a future release run, create its draft release at the full source commit SHA through an authorized maintainer account, then use that tag in the workflow. This avoids the workflow token's restriction on creating releases/tags at commits containing workflow changes. Keep the draft until checks and packaging pass. The optional build_packages input allows validation-only runs after test changes.
