# Changelog

## [0.2.0]

### Breaking changes

- **Replaced `headless-chrome-crawler` with `crawlee`** — the crawler no longer launches a browser. `CheerioCrawler` makes plain HTTP requests and parses HTML with Cheerio, so `$("body").text()` works the same way but without Puppeteer or Chromium. Pages that require JavaScript to render content will not be searched.

### Bug fixes

- **WSL2/Docker compatibility** — no browser process means no sandbox flags, no Chromium binary, and no `/dev/shm` constraints. Works out of the box in containerized environments.
- **TLS errors gone** — `ignoreSslErrors: true` replaces the old `ignoreHTTPSErrors` workaround for the bundled 2018 Chromium cert store.
- **Startup race condition removed** — the 500ms delay before `onIdle()` is no longer needed; `crawler.run()` resolves only after all requests complete.

### Improvements

- **2-second page timeout** — `navigationTimeoutSecs: 2` treats slow or hanging pages as failures and moves on.
- **No storage pollution** — crawlee's request queue is written to `/tmp/wwwgrep-<pid>` and deleted on exit instead of creating a `storage/` directory in the working tree.
- **Crawlee log output suppressed** — internal crawlee progress messages are silenced; only the tool's own output is shown.

## [0.1.0]

### Bug fixes

- **Chrome hangs on navigation in WSL2/Docker** — headless Chromium requires `--no-sandbox` and `--disable-setuid-sandbox` in containerized environments. Without these flags, page navigation silently hung forever.
- **TLS errors on modern sites** — the bundled Chromium (Puppeteer 1.5.0, 2018) has an outdated root certificate store and rejects many valid Let's Encrypt certificates. Set `ignoreHTTPSErrors: true` as the default.
- **Crawler never fired callbacks** — changed `waitUntil` from `"load"` (waits for all resources) to `"domcontentloaded"` (fires on HTML parse). External scripts, images, and analytics that never finish loading no longer block the crawl.
- **Race condition on startup** — calling `crawler.onIdle()` immediately after `crawler.queue()` could resolve before the browser started the request, closing Chrome before any page loaded. Added a 500ms delay to let the internal queue register the item as in-flight.

### New features

- **`-i` flag** — case-insensitive keyword matching.
- **`--regex` flag** — treat the keyword as a regular expression. Validates the pattern before launching Chrome and exits with a clear error on invalid input. Combines with `-i` for case-insensitive regex.
- **`--depth N`** — limit crawl to N levels deep. Passes `maxDepth` to the crawler.
- **`--concurrency N`** — crawl N pages in parallel (default: 1). Passes `maxConcurrency` to the crawler.
- **`--max N`** — stop after N pages. Passes `maxRequest` to the crawler.
- **`--output file`** — write matched URLs to a file. Also writes partial results when the crawl is interrupted with Ctrl+C.

### Improvements

- **Progress bar** — shows ETA (`{eta_formatted}`), truncates long URLs to 55 characters (middle-ellipsis) to prevent line wrapping.
- **Elapsed time** — summary now shows total crawl duration.
- **Summary wording** — "Found N matches:" / "No matches found." instead of the previous awkward phrasing.
- **TTY detection** — banner, "looking for" log, and progress bar are suppressed when stdout is not a terminal. Piped output contains only matched URLs.
- **SIGINT handler** — Ctrl+C now stops the crawler cleanly, prints partial results (including any `--output` file), and exits. Chrome is not left as a zombie process.
- **`--help` / `-h` flag** — previously help only showed when arguments were missing. Now works as an explicit flag at any position.
- **URL protocol validation** — exits with a clear error if the URL does not start with `http://` or `https://`.
- **`getBaseUrl` rewrite** — replaced fragile string splitting with `new URL(url).origin`.
- **State scoped to `main()`** — `links`, `results`, `errors`, and the progress bar are now local variables instead of module-level globals.
- **Error tracking** — failed URLs are collected and printed in the summary with a count.
- **Dependencies updated** — `cli-progress` `3.11.2` → `3.12.0`, `minimist` `1.2.7` → `1.2.8`.
