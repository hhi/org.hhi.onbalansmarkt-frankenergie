# Repository Guidelines

## Project Structure & Module Organization
Scripts sit at the repository root so they can be pasted into Homey Advanced Flows. `homey-onbalansmarkt-frankenergie.js` aggregates battery metrics and pushes them to Onbalansmarkt. Setup scripts (`sessy-setup.js`, `alphaESS-setup.js`, `sigEnergy-setup.js`) populate battery tags, while the `battery-*.js` helpers compute averages, daily deltas, and previous values that the main script expects. Run `frank-onbalans-scriptvars.js` first to seed Frank Energie credentials in Homey variables. Use `CLAUDE.md`, `batteries.md`, and the PNG screenshots when wiring or debugging flows.

## Build, Test, and Development Commands
This legacy solution has no local build or package manifest; all execution happens in the Homey Script runtime. Edit JavaScript locally, then paste it into `developer.athom.com/tools/homey-script` or attach it to an Advanced Flow card. Use Homey's `Run once` for quick validation, then schedule flows as documented (e.g. `battery-update-prevs.js` at 23:59 followed by the 15-minute loop of setup, averages, deltas, and main reporting scripts).

## Coding Style & Naming Conventions
Keep the existing two-space indentation inside classes and functions. Use camelCase for variables and helpers, PascalCase for classes such as `FrankEnergie`, and uppercase snake case for constants like `DATA_URL`. Prefer `async`/`await` around network calls, guard API responses before dereferencing, and remove temporary `console.log` statements that expose secrets before pushing.

## Testing Guidelines
Automated tests are not available, so rely on staged runs in Homey. Execute the relevant setup script, then `battery-calculate-averages.js`, `battery-update-deltas.js`, and finally `homey-onbalansmarkt-frankenergie.js`, checking the console output. Confirm that Onbalansmarkt receives the expected period totals and that the annotated sample payload in the main script header still matches the live GraphQL response shape.

## Commit & Pull Request Guidelines
Write imperative commit subjects that focus on the behaviour change (e.g. `Fix delta tag for SigEnergy flow`). Group unrelated adjustments into separate commits for simple rollbacks. Pull requests should list the scripts touched, note any Homey variables or schedules operators must update, link related issues, and include screenshots or console snippets when the exported metrics change.

## Security & Configuration Tips
Inject credentials via `frank-onbalans-scriptvars.js` and keep API keys out of version control. Scrub auth tokens from logs, rotate them after testing against production devices, and avoid leaving debug prints that could surface secrets in the Homey timeline.
