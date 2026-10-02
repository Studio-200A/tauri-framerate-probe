# Tauri Frame Probe

A minimal Tauri 2 application with plain HTML, CSS and JavaScript for measuring frontend `requestAnimationFrame` scheduling. No frontend framework or development server is required for the desktop application. The same frontend can be served in a browser for comparison.

See [OBSERVATION.md](OBSERVATION.md) for the dated, anonymized test sequence and the observed half-refresh callback pattern on Linux.

## Requirements and setup

This project targets Linux with existing Rust, Node.js/npm, GTK3 and WebKitGTK runtime libraries. **WebKitGTK 2.54 or newer is required** for the native feature lookup API. The desktop application uses the WebKitGTK 4.1 API for GTK3; API numbers such as 4.1 and 6.0 are distinct from the WebKitGTK release version.

For Fedora x86_64, the optional helper downloads development RPMs and extracts them into this project without installing packages or running RPM scriptlets. It requires existing `dnf`, `rpm2cpio`, `cpio`, Python and `pkg-config` tools, as well as the corresponding runtime libraries already installed on the host.

```sh
bash scripts/prepare-linux-deps.sh
npm ci --cache "$PWD/.cache/npm"
npm run build
npm start
```

The helper is specific to Fedora x86_64. It is not a runtime-library installer and does not replace system libraries. On other distributions, compatible development files must already be available or supplied locally; adapt the environment wrapper to their location.

## Running measurements

Enter the **actual display refresh rate** before testing. The input defaults to a generic 60 Hz; it sets the comparison budget and does not change the display mode. Keep the window visible, avoid resizing it or switching displays, and minimize competing CPU/GPU workloads.

```sh
# Open the interactive measurement interface.
npm start

# Automatically run all three scenes (about 53 seconds).
npm start -- --auto

# Explicitly select the backend for this process. Run these sequentially.
npm start -- --auto --backend=x11
npm start -- --auto --backend=wayland

# Compare WebKit's near-60-FPS preference on and off.
npm start -- --auto --backend=x11 --near60=on
npm start -- --auto --backend=x11 --near60=off

# Set the preference, reload the page, then sample on Wayland.
npm start -- --auto --backend=wayland --near60=on --reload-after-setting --exit-after-test
npm start -- --auto --backend=wayland --near60=off --reload-after-setting --exit-after-test

# Recompute and verify saved statistics from their raw intervals.
npm run results

# Rebuild after changing source files; check the metric calculations.
npm run build
npm run test:metrics
```

Automatic runs use the refresh-rate input's default value. For a different target budget, run interactively and edit the input. The measured FPS itself does not depend on this target value.

Desktop results are saved as new JSON files under `results/`. The directory and browser export filenames are ignored by Git. Existing results are not overwritten. Browser exports may contain environment details; review them before sharing.

### Scenes and statistics

- **Idle rAF:** measures callback scheduling without animation drawing.
- **Canvas:** draws 200 particles per frame at the actual device pixel ratio.
- **DOM:** updates the transforms of 200 elements per frame.
- Each scene warms up for 2 seconds, then samples for 15 seconds by default.
- Average FPS is the number of interval samples divided by their cumulative duration in seconds. Results include P50/P95/P99, maximum interval and all raw intervals.
- Long intervals exceed `1.5 × 1000 / target Hz`. This percentage is not a measured dropped-frame count.
- The statistics panel updates once per second. Hiding the window cancels the run; initial focus and focus changes are recorded. Repeat runs affected by focus or window-size changes.

**rAF frequency is not actual presentation FPS.** High callback frequency does not prove every frame reached the display. Low frequency alone cannot identify a GTK, WebKit, driver or compositor bottleneck. Compare the same display, viewport, device pixel ratio, sample duration and system load. On Wayland, `xrandr` describes the XWayland view; use the compositor's display configuration to confirm the physical mode.

### Native diagnostic options

`--backend=x11|wayland` selects the backend before GTK initializes. Results record the actual `GdkX11Display` or `GdkWaylandDisplay` type; a Wayland desktop session does not guarantee that the application uses Wayland.

`--near60=default|on|off` controls `PreferPageRenderingUpdatesNear60FPS` for this WebView only. Omitting it preserves WebKit's default. The application sets the preference before sampling, reads it back, and records the default, previous and effective values. An unavailable feature or failed readback prevents automatic sampling.

The Rust bindings do not expose these feature APIs, so `src-tauri/src/frame_preference.rs` wraps the public WebKitGTK C interfaces. Feature toggling was introduced in 2.42; the feature lookup used here was introduced in 2.54.

`--reload-after-setting` reloads the document once after applying the preference. A result with `configuredBeforeDocumentReload: true` confirms this sequence. It does not directly inspect the Web process's internal scheduler state.

`--exit-after-test` closes the application after a complete measurement has been saved.

## Browser comparison

```sh
python3 -m http.server 8080 --bind 127.0.0.1 --directory frontend
```

Open http://127.0.0.1:8080 in the browser, set the correct refresh-rate budget and sample duration, run the test, and export JSON. Downloads follow the browser's settings. Browser runs do not apply the native WebKit preference switch or record a native backend type.

Raw measurement exports are excluded from this repository. [OBSERVATION.md](OBSERVATION.md) records anonymized observations, not a confirmed diagnosis of a rendering engine.

## Local dependencies and caches

`scripts/local-env.sh` sets Cargo/npm caches, the build directory, XDG application directories and a temporary directory for its child process only. It does not edit shell profiles or persistent user/system environment variables. Build output, downloaded packages, runtime data, research material and results are ignored by Git.

No `sudo`, user-level `cargo install` or system package installation is required by the provided workflow. Rust and JavaScript dependencies are locked by `src-tauri/Cargo.lock` and `package-lock.json`.

Reference: [Tauri Linux prerequisites](https://v2.tauri.app/start/prerequisites/).
