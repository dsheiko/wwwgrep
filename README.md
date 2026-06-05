![wwwgrep](https://github.com/dsheiko/wwwgrep/blob/master/docs/banner.svg)

Sometimes you need to verify that a specific phrase no longer appears on a website. For example, the Legal team may ask you to confirm that a trademarked term, outdated disclaimer, or compliance-related statement has been removed from all public pages.

Searching the underlying content sources is often difficult or impossible. Instead, wwwgrep searches the published website itself. It crawls all publicly accessible pages (ignoring robots.txt) and looks for the specified keywords or substrings.

Use it to verify content removals, compliance updates, rebranding efforts, or any large-scale text changes directly on the live website.

![Demo](https://github.com/dsheiko/wwwgrep/blob/master/docs/wwwgrep.gif)

## Install

```sh
npm install -g wwwgrep
```

If installing under `sudo`, fix permissions first:

```sh
sudo chown -R $(whoami) $(npm config get prefix)/{lib/node_modules,bin,share}
```

## Usage

```sh
wwwgrep <url> <keyword> [options]
```

| Argument / Option | Description |
|---|---|
| `<url>` | Base URL to start crawling from (e.g. `https://example.com`) |
| `<keyword>` | Text or regex pattern to search for |
| `-i` | Case-insensitive match |
| `--regex` | Treat keyword as a regular expression |
| `--depth N` | Limit crawl depth (default: unlimited) |
| `--concurrency N` | Number of pages to crawl in parallel (default: 1) |
| `--max N` | Stop after N pages |
| `--timeout N` | Page load timeout in seconds (default: 15) |
| `--wait N` | Extra milliseconds to wait after page load for JS rendering (default: 0) |
| `--output file` | Write matched URLs to a file |
| `--dump-body` | Print the body text of the first page and stop (useful for debugging) |
| `--help`, `-h` | Show help |

## Examples

Search for a keyword across a site:

```sh
wwwgrep https://dsheiko.com "Puppetry 3"
```

Case-insensitive search, limited to 2 levels deep:

```sh
wwwgrep https://dsheiko.com puppetry -i --depth 2
```

Find pages containing an email address (regex):

```sh
wwwgrep https://example.com "\w+@\w+\.\w+" --regex
```

Sample the first 20 pages, save matches to a file:

```sh
wwwgrep https://example.com "login" --max 20 --output results.txt
```

Faster crawl with parallel pages, piped output for scripting:

```sh
wwwgrep https://example.com "TODO" --concurrency 4 | grep https
```

## Notes

**WSL2 / Docker**: the tool runs headless Chromium with `--no-sandbox` automatically, which is required in containerized environments.

**JavaScript-rendered pages**: because it uses a real browser, content injected by JavaScript is visible to the search — unlike curl-based tools.

**Piped output**: when stdout is not a terminal, the progress bar is suppressed and only matched URLs are printed, making it easy to pipe results into other tools.
