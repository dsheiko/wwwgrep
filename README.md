# wwwgrep

`wwwrep` is a command line tool (web-crawler) for searching text in entire website.

## Examples

```sh
wwwgrep https://dsheiko.com "Puppetry 3"
```

This example will return a list of all the pages that contain the given keyword.

## Usage

```sh
wgrep <url> <keyword>
```

where:

<url>           base URL (e.g. https://dsheiko.com)
<keyword>       keyword to look for (e.g. Puppetry)

## Install

Install using npm - we recommend a global install:

```sh
npm install -g wgrep
```
