# Changelog

## [0.1.0]

### New features

- **`--dump-body`** — prints the extracted body text of the first page to stdout and exits. Use this to verify what content the tool actually sees before running a full crawl.
- **`--wait N`** — waits an additional N milliseconds after `networkidle2` before extracting text. Useful for pages that finish loading assets but then run client-side rendering.
- **`-i` flag** — case-insensitive keyword matching.
- **`--regex` flag** — treat the keyword as a regular expression. Validates the pattern before launching Chrome and exits with a clear error on invalid input. Combines with `-i` for case-insensitive regex.
- **`--depth N`** — limit crawl to N levels deep.
- **`--concurrency N`** — crawl N pages in parallel (default: 1).
- **`--max N`** — stop after N pages.
- **`--timeout N`** — page load timeout in seconds (default: 15).
- **`--output file`** — write matched URLs to a file. Also writes partial results when interrupted with Ctrl+C.
- **`--help` / `-h` flag** — works as an explicit flag at any position.

### Bug fixes

- **ECH / Cloudflare TLS errors** — Chromium 117+ enables Encrypted Client Hello (ECH) by default and fails with `ERR_ECH_FALLBACK_CERTIFICATE_INVALID` on Cloudflare-fronted sites, particularly in WSL2. The browser now launches with `--disable-features=EncryptedClientHello,TLS13EarlyData`, `--ssl-version-max=tls1.2`, and `--ignore-certificate-errors` to work around this.
- **WSL2 / Docker sandbox** — headless Chromium requires `--no-sandbox` and `--disable-setuid-sandbox` in containerized environments. Without these flags, page navigation hangs silently.
- **Crawler never fired callbacks** — changed `waitUntil` from `"load"` to `"networkidle2"` so external scripts that never finish loading no longer block the crawl.
- **URL protocol validation** — exits with a clear error if the URL does not start with `http://` or `https://`.

### Improvements

- **Progress bar** — shows ETA, truncates long URLs to 55 characters (middle-ellipsis) to prevent line wrapping.
- **Elapsed time** — summary shows total crawl duration.
- **TTY detection** — banner, "looking for" log, and progress bar are suppressed when stdout is not a terminal. Piped output contains only matched URLs.
- **SIGINT handler** — Ctrl+C stops the crawler cleanly, prints partial results, and exits without leaving a zombie Chrome process.
- **Error tracking** — failed URLs are collected and printed in the summary with a count.
