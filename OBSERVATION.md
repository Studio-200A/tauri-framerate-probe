# Observation: WebKitGTK rAF Frequency at Half the Display Refresh Rate

**Test date: October 2, 2026 (2026-10-02).**

In the Linux tests described below, GNOME Web delivered approximately **82.5 requestAnimationFrame callbacks per second at 165 Hz** and **60 callbacks per second after the display was switched to 120 Hz**. Idle, Canvas and DOM scenes all showed this behavior in those browser runs. Firefox and Chromium approached the full 165 Hz rate on the same test page.

This document records an observed callback scheduling pattern, not a confirmed WebKitGTK defect or a measurement of frames physically presented on the display. Results are anonymized; raw exports and identifying environment records are excluded from Git.

## Measurement method

A minimal Tauri application was built with plain HTML, CSS and JavaScript. The same `frontend/` files were then served over a local HTTP connection and tested in browsers. No frontend framework or framework rendering loop was involved.

The page runs three scenes sequentially:

1. **Idle rAF:** schedules callbacks without drawing animation content.
2. **Canvas:** draws 200 moving particles per callback, using a canvas scaled to the device pixel ratio.
3. **DOM:** updates the transforms of 200 elements per callback.

Each scene warms up for two seconds. Most measurements then sample for 15 seconds; the Chromium comparison uses five seconds per scene. Average callback FPS is calculated as:

```text
FPS = number of positive rAF timestamp intervals × 1000 / sum of intervals in milliseconds
```

Exports include raw intervals, percentiles, initial focus, visibility and focus changes. The statistics panel updates once per second. Completed exports were checked by recomputing their statistics from the raw intervals. The calculation unit tests also passed.

The refresh-rate input is a manually entered target for the long-interval threshold. It does not configure or detect the physical display mode, and does not affect calculated FPS.

## Test sequence

### 1. Establish a Tauri baseline at 165 Hz

The initial native application used Tauri 2.12.1 and its GTK3/WebKitGTK 4.1 integration. The WebKitGTK engine release was 2.54.0. The release binary was used for measurements.

The desktop session used Wayland, but the application backend was subsequently selected explicitly and verified as `GdkX11Display` or `GdkWaylandDisplay` rather than inferred from the session type.

| Native run | Idle FPS | Canvas FPS | DOM FPS |
| --- | ---: | ---: | ---: |
| Initial automatic backend selection | 82.50 | 60.00 | 60.00 |
| Explicit X11 | 82.50 | 82.50 | 81.90 |
| Explicit Wayland | 82.50 | 60.00 | 60.00 |

The initial run did not record its actual backend, and its DOM scene had a brief focus change. It was retained as an exploratory observation rather than treated as a clean backend comparison. The explicit X11 and Wayland runs had no focus changes.

These results already argued against a universal fixed 60 FPS ceiling: the X11 animation scenes exceeded 60 FPS. They did not establish which component caused the approximately half-refresh idle rate.

### 2. Test the near-60-FPS preference hypothesis

Source inspection identified WebKit's `PreferPageRenderingUpdatesNear60FPS` preference and a nearby frame-rate selection calculation as possible explanations for the observed rate. A numerical resemblance to an internal target near 82 FPS was a hypothesis, not evidence of the runtime cause.

The application was extended to toggle this preference through the public WebKitGTK feature API. The library reported a default value of `true`. Setting it to `false` was verified by reading the setting back before sampling.

To address initialization timing, additional runs applied the setting and reloaded the page before warmup. For disabled-preference reload runs, the setting readback was `true → false` before reload and `false → false` after reload. This verifies the native setting and document reload sequence, but does not inspect the Web process's internal scheduler state directly.

The following comparisons completed without focus changes or overlapping builds:

| Backend | Preference | Reload after setting | Idle FPS | Canvas FPS | DOM FPS |
| --- | --- | --- | ---: | ---: | ---: |
| X11 | On | No | 82.50 | 82.29 | 82.17 |
| X11 | Off | No | 82.50 | 82.43 | 82.49 |
| Wayland | On | Yes | 82.50 | 60.00 | 60.00 |
| Wayland | Off | Yes | 80.90 | 60.00 | 60.00 |

An additional X11 run with the preference disabled and the page reloaded measured **82.50 / 82.50 / 82.43 FPS**, again without restoring the full refresh rate. A Wayland baseline with the preference enabled and no reload measured **82.50 / 60.00 / 60.00 FPS**.

One exploratory Wayland run overlapped a build, and another had a focus change during its idle scene. They were excluded from the main comparison and replaced by clean measurements.

**Outcome:** disabling this preference did not restore 165 FPS. The source-based preference hypothesis was not confirmed as a sufficient explanation or workaround.

### 3. Compare Firefox and Chromium at 165 Hz

The same frontend was opened in Firefox and Chromium. Both exports completed with initial focus, visible pages and no focus changes.

| Browser | Sampling per scene | Idle FPS | Canvas FPS | DOM FPS |
| --- | --- | ---: | ---: | ---: |
| Firefox | 15 seconds | 166.81 | 164.20 | 164.12 |
| Chromium | 5 seconds | 165.21 | 165.00 | 164.60 |

Firefox's P50/P95 intervals were approximately **6 / 7 ms** across the scenes. Chromium's corresponding intervals were approximately **6.1 / 6.1 ms**. Firefox's idle estimate slightly exceeded the nominal refresh rate; this is a callback statistic, not evidence that the display presented more frames than its refresh rate.

The browser viewports and device pixel ratios differed from the Tauri runs. These differences matter for drawing load and prevent a strict engine performance ranking. Nevertheless, the idle scene provides evidence that full-rate callback scheduling was achievable on the same display setup.

### 4. Test GNOME Web with GTK4

The page was then tested in GNOME Web. Inspection of its installed Flatpak package and runtime established that this application used GTK4 and the WebKitGTK 6.0 API, with the same WebKitGTK engine release, 2.54.0. The API number `6.0` refers to the GTK4 interface, not a newer engine release than `2.54.0`.

At 165 Hz, all scenes completed without focus changes and produced the same statistics:

| Scene | FPS | Interval samples | Total interval duration | P50 | P95 | Maximum |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Idle | 82.5003 | 1,238 | 15,006 ms | 12 ms | 13 ms | 13 ms |
| Canvas | 82.5003 | 1,238 | 15,006 ms | 12 ms | 13 ms | 13 ms |
| DOM | 82.5003 | 1,238 | 15,006 ms | 12 ms | 13 ms | 13 ms |

The identical frequency across different workloads supports a scheduling-cadence explanation more strongly than a workload-dependent drawing bottleneck. Reproducing the pattern outside Tauri and with GTK4 also weakens explanations specific to Tauri or exclusively to GTK3.

This GNOME Web test used its browser defaults. The native application's explicit preference toggle was not applied to GNOME Web, and its actual X11/Wayland backend was not recorded in the page export.

### 5. Switch the display to 120 Hz and repeat GNOME Web

The tester manually switched the display from 165 Hz to 120 Hz and repeated the GNOME Web measurement with the same viewport, device pixel ratio and 15-second sampling duration. The export completed without focus changes.

| Scene | FPS | Interval samples | Total interval duration | P50 | P95 | Maximum |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Idle | 60.0000 | 900 | 15,000 ms | 17 ms | 17 ms | 17 ms |
| Canvas | 60.0027 | 901 | 15,016 ms | 17 ms | 17 ms | 17 ms |
| DOM | 60.0000 | 900 | 15,000 ms | 17 ms | 17 ms | 17 ms |

The export's manually entered `targetHz` remained at 165. This does not invalidate the FPS calculation, but its long-interval percentages must not be interpreted against a 120 Hz budget. The physical 120 Hz setting is reported by the tester; the export does not contain a contemporaneous compositor display-mode snapshot, and a later inspection occurred after the display had returned to 165 Hz.

The resulting relationship was:

```text
165 Hz display setting → approximately 82.5 rAF callbacks/s
120 Hz display setting → approximately 60.0 rAF callbacks/s
```

This is consistent with callbacks being delivered once per two display refresh cycles, rather than an unconditional 60 FPS cap. It does not prove that every other physical presentation was skipped or identify where in the pipeline the callback frequency was reduced. The recorded timestamp precision also limits conclusions about sub-millisecond jitter.

## Interpretation and remaining questions

The evidence points toward a WebKitGTK-related refresh scheduling or synchronization path in the tested Linux configuration:

- Firefox and Chromium approached the full 165 Hz callback rate on the same frontend.
- The approximately half-refresh pattern appeared in both a GTK3 Tauri integration and a GTK4 GNOME Web application.
- GNOME Web's three workloads shared an exceptionally regular callback cadence.
- Changing the reported physical display setting changed that cadence from approximately 82.5 to 60 callbacks per second.
- Disabling the tested near-60-FPS preference in Tauri did not restore full-rate scheduling.

These observations do **not** establish a universal WebKitGTK limitation, a confirmed upstream bug, a particular faulty source line, or a guaranteed GTK4 workaround. Display notification handling, compositor/driver interactions, WebKit process scheduling and presentation feedback remain possible contributors. The Tauri Wayland animation rate also differed from GNOME Web's animation rate, so a single mechanism should not be assumed to explain every result.

The most useful follow-up investigations would be to compare native GTK frame-clock ticks with WebView callbacks, record the nominal refresh rate and preference actually used by the Web process, and trace refresh notifications and frame-completion feedback. Those investigations have not yet been performed.

## Reproduction outline

See [README.md](README.md) for build requirements and native diagnostic options.

1. Build the release application or serve the unchanged `frontend/` directory over local HTTP.
2. Select the physical display refresh rate using the desktop settings, and record the compositor's actual mode during the measurement.
3. Enter that same refresh rate in the page, and use a consistent sampling duration.
4. Run all three scenes with the window visible and focused. Keep viewport, scaling and background workload consistent between comparisons.
5. Compare Tauri's explicitly selected X11 and Wayland backends, then Firefox, Chromium and GNOME Web.
6. Repeat GNOME Web at another physical refresh rate. The existing two-point observation suggests looking for a callback rate near half that setting.
7. Inspect raw intervals and focus events, and recompute the statistics before drawing conclusions.

The numeric tables above summarize verified exports; the original files remain outside the published Git content.
