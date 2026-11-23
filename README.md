# Diplomacy · 1901 — browser prototype

An independent, experimental, seven-power **hot-seat Diplomacy** board, made as the foundation for adding AI negotiators.

## How to run

### Easiest: one file

Open `diplomacy-single-file.html` in a modern web browser. The entire interface, game data and rules run locally; there are no dependencies or API keys. Some mobile devices restrict running downloaded HTML files directly. If that happens, use the hosting instructions below.

### Publish on GitHub Pages

1. Create a new GitHub repository, such as `diplomacy-game`.
2. Upload `index.html`, `style.css`, `data.js`, `rules.js`, `ui.js`, and `favicon.svg` to the **root** of the repository (not into a nested folder).
3. Open **Settings → Pages**.
4. Under **Build and deployment**, select **Deploy from a branch**, choose **main**, and select the root `/` folder, then save.
5. Open the Pages URL shown in the GitHub settings.

GitHub Pages is adequate for **this** version, because it doesn't call any language models. Future AI negotiators will need a secure backend or managed server-side functions to keep credentials and private state separate.

## Playing

- Pick one of the seven powers on the right.
- Click one of its units to write a **Hold**, **Move**, **Support hold** or **Support move** order. As a shortcut, click a unit on the map, then click a highlighted adjacent province to order a move.
- Switch powers and set their orders. Any unit without an explicit order **holds**.
- Press **Resolve Spring 1901** to process all seven powers simultaneously. Successful moves, failed moves, cut/valid supports and illegal orders are shown in the dispatch report.
- If units are dislodged, select retreats or disband. Fall and winter are also implemented.
- Your progress autosaves in local browser storage. Use **Export save** and **Import save** to create portable JSON backups.

## Current boundaries

- The map is an **original schematic province map**, not a copy of a published Diplomacy board. Spatial layout is approximate, but province names, supply centers and adjacency graphs are intended to represent standard Diplomacy.
- There are **no AI opponents yet**. All seven countries are hot-seat controlled.
- **Convoy orders are not yet implemented**, so the game is not complete under full official rules. Support-cut chains, head-to-head contests, circular movements, dislodgements, retreats and winter builds/disbands have been implemented, with representative checks, but the adjudicator has not been certified against an exhaustive rules suite.
- This is not a tournament rules engine, and is not affiliated with Diplomacy's publisher.

## Developer layout

- `data.js` — powers, all 75 provinces, army and fleet adjacency, 1901 positions.
- `rules.js` — legal orders, conflict resolution, retreats and winter adjustment logic.
- `ui.js` — controls, SVG map, save/load and rendering.
- `style.css` — responsive layout and styling.
- `index.html` — entry point for GitHub Pages.

**Next milestone:** extend the adjudicator with convoy routing and convoy paradox handling, then test against published adjudication examples. Once the rules are sound, connect independently managed negotiating agents via a server-side API.
