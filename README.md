![wwwgrep](https://github.com/dsheiko/wwwgrep/blob/master/docs/banner.svg)

A command-line tool that crawls a website and searches every page for a keyword or regex pattern. Built on headless Chromium, so JavaScript-rendered content is included.

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
| `--output file` | Write matched URLs to a file |
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
