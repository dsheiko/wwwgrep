🔎 wwwgrep – A Command-Line Tool for Web Scraping & Searching

`wwwgrep` is a lightweight command-line tool that fetches and searches content directly from web pages using regular expressions. It allows you to extract, filter, and analyze online data efficiently, making it a powerful tool for developers, researchers, and automation tasks.

✨ Features:

- Fetches web page content via HTTP(S)
- Supports flexible regex-based searching and filtering
- Outputs structured results for easy parsing
- Simple, fast, and dependency-free

## Examples

```sh
wwwgrep https://dsheiko.com "Puppetry 3"
```

This example will return a list of all the pages that contain the given keyword.

![Example](https://github.com/dsheiko/wwwgrep/blob/master/docs/wwwgrep.gif)

## Usage

```sh
wwwgrep <url> <keyword>
```

where:

<url>           base URL (e.g. https://dsheiko.com)
<keyword>       keyword to look for (e.g. Puppetry)

## Install

Install using npm - we recommend a global install:

```sh
npm install -g wwwgrep
```

NOTE: If you install under `sudo`, do not forget about access permissions:
```sh
sudo chown -R $(whoami) $(npm config get prefix)/{lib/node_modules,bin,share}
```
See details at http://npm.github.io/installation-setup-docs/installing/a-note-on-permissions.html
