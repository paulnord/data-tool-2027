# Sharing Data Tool 2027

The source repository and distributable applications serve different audiences. Teachers and students should receive a direct browser link or an installer download, without having to build the source.

## Recommended distribution

- **Web:** GitHub Pages, deploying the Vite build through GitHub Actions. This app does its fitting locally in the browser; it does not need a data-processing server. Configure the Vite base path for the repository URL, test worker loading under that path, and provide ordinary example files as downloads. Browser file pickers and downloads replace the native desktop file dialogs and Tracker launch integration. A hosted web release has not yet been configured.
- **Desktop:** versioned GitHub Releases with release notes and platform-specific downloads. Start with a clearly marked Mac preview. The current build is Apple Silicon and ad-hoc signed, not Developer ID signed or notarized. For general classroom distribution, provide a signed and notarized Mac DMG, ideally with both Intel and Apple Silicon support. Windows and Linux installers need their own builds and platform checks before being advertised as supported.
- **Source:** keep source, examples, scientific tests, license and compatibility documentation together. Tag the exact source revision used for each binary release. Keep built applications out of Git history and attach them to Releases.

Recommended references: [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases), [Vite deployment to GitHub Pages](https://vite.dev/guide/static-deploy), and [Tauri macOS signing](https://v2.tauri.app/distribute/sign/macos/).

## Future Open Source Physics inclusion

Retain the inherited license and extraction history, and keep the Tracker integration contract documented. Prepare a stable release, a browser demonstration, example lab exercises and a short explanation of how this independent tool complements Tracker. Then approach the OSP maintainers about a collection listing and, separately, whether they want organizational hosting or maintenance. A listing does not require assuming that the repository must move.

The [OSP project page](https://www.compadre.org/osp/webdocs/About.cfm) provides its staff contact route. No OSP submission or endorsement has been requested. The project remains an independent development draft.
