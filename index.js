#!/usr/bin/env node

const puppeteer = require( "puppeteer" ),
      cliProgress = require( "cli-progress" ),
      fs = require( "fs" ),
      { name, version } = require( "./package.json" ),
      argv = require( "minimist" )( process.argv.slice( 2 ) ),
      normalizeLink = ( link ) => link.replace( /#.*$/, "" ).replace( /\?.*$/, "" ).replace( /([^:])\/\/+/g, "$1/" ).replace( /\/$/, "" ),
      truncateUrl = ( url, max = 55 ) => {
        if ( url.length <= max ) { return url; }
        const half = Math.floor( ( max - 3 ) / 2 );
        return url.slice( 0, half ) + "..." + url.slice( -half );
      },
      isTTY = !!process.stdout.isTTY,
      NON_HTML = /\.(zip|gz|tar|rar|7z|jpg|jpeg|png|gif|webp|svg|ico|pdf|mp3|mp4|avi|mov|css|js|woff|woff2|ttf|eot|xml|json|csv|doc|docx|xls|xlsx)$/i,
      showUsage = () => console.log( `${ name }@${ version } <url> <keyword> [options]

where:

<url>              base URL (e.g. https://dsheiko.com)
<keyword>          keyword or regex pattern to search for
-i                 case-insensitive match
--regex            treat keyword as a regular expression
--depth N          limit crawl depth (default: unlimited)
--concurrency N    parallel pages (default: 1)
--max N            stop after N pages
--timeout N        page timeout in seconds (default: 15)
--wait N           extra ms to wait after page load for JS rendering (default: 0)
--output file      write matched URLs to a file
--dump-body        print body text of the first page and stop
--help, -h         show this help
` );

if ( argv.help || argv.h ) {
  showUsage();
  process.exit( 0 );
}

async function crawlPage( page, url, timeout, waitMs ) {
  await page.goto( url, { waitUntil: "networkidle2", timeout: timeout * 1000 } );
  if ( waitMs > 0 ) { await new Promise( r => setTimeout( r, waitMs ) ); }
  return page.evaluate( () => document.body ? document.body.innerText : "" );
}

async function collectLinks( page, startHostname ) {
  const hrefs = await page.evaluate( () =>
    Array.from( document.querySelectorAll( "a[href]" ) ).map( a => a.href )
  );
  return hrefs
    .map( normalizeLink )
    .filter( href => {
      if ( !/^https?:\/\//i.test( href ) ) { return false; }
      try { return new URL( href ).hostname === startHostname; } catch ( e ) { return false; }
    } )
    .filter( href => !NON_HTML.test( href ) );
}

async function main( startUrl, keyword, opts ) {
  const { caseInsensitive, useRegex, depth, concurrency, maxPages, timeout, waitMs, outputFile, debug, dumpBody } = opts,
        dbg = debug ? ( msg ) => process.stderr.write( msg + "\n" ) : () => {},
        startHostname = new URL( startUrl ).hostname,
        pattern = useRegex
          ? new RegExp( keyword, caseInsensitive ? "i" : "" )
          : null,
        matches = ( text ) => pattern
          ? pattern.test( text )
          : caseInsensitive
            ? text.toLowerCase().includes( keyword.toLowerCase() )
            : text.includes( keyword );

  const discovered = new Set( [ normalizeLink( startUrl ) ] ),
        queue = [ { url: normalizeLink( startUrl ), depth: 0 } ],
        results = [],
        errors = [],
        startTime = Date.now();

  const bar = isTTY
    ? new cliProgress.SingleBar( {
        format: " {bar} {percentage}% | {value}/{total} | ETA: {eta_formatted} | {url}"
      }, cliProgress.Presets.shades_classic )
    : null;

  if ( isTTY ) { console.log( `looking for "${ keyword }" at ${ startUrl }` ); }

  const browser = await puppeteer.launch( {
    headless: true,
    ignoreHTTPSErrors: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-features=EncryptedClientHello,TLS13EarlyData",
      "--ssl-version-max=tls1.2",
      "--ignore-certificate-errors",
    ],
  } );

  const cleanup = async () => {
    try { await browser.close(); } catch ( e ) { /* ignore */ }
  };

  process.on( "SIGINT", async () => {
    printSummary();
    await cleanup();
    process.exit( 0 );
  } );

  if ( bar ) { bar.start( 1, 0, { url: truncateUrl( startUrl ) } ); }

  let processed = 0;

  while ( queue.length > 0 ) {
    const batch = queue.splice( 0, concurrency );

    await Promise.all( batch.map( async ( { url, depth: currentDepth } ) => {
      if ( maxPages != null && processed >= maxPages ) { return; }

      dbg( `[fetch] ${ url }` );
      let bodyText = "";
      try {
        const page = await browser.newPage();
        await page.setExtraHTTPHeaders( { "Accept-Language": "en-US,en;q=0.9" } );
        bodyText = await crawlPage( page, url, timeout, waitMs );

        if ( dumpBody ) {
          if ( bar ) { bar.stop(); }
          process.stderr.write( `[dump-body] url: ${ url }\n` );
          process.stderr.write( `[dump-body] body text length: ${ bodyText.length }\n` );
          process.stdout.write( bodyText );
          await page.close();
          await cleanup();
          process.exit( 0 );
        }

        if ( matches( bodyText ) ) {
          results.push( url );
        }

        if ( depth === undefined || currentDepth < depth ) {
          const links = await collectLinks( page, startHostname );
          for ( const link of links ) {
            if ( !discovered.has( link ) ) {
              dbg( `[queue] ${ link }` );
              discovered.add( link );
              queue.push( { url: link, depth: currentDepth + 1 } );
              if ( bar ) { bar.setTotal( discovered.size ); }
            } else {
              dbg( `[skip:seen] ${ link }` );
            }
          }
        }

        await page.close();
      } catch ( e ) {
        errors.push( url );
        dbg( `[error] ${ url }: ${ e.message }` );
      }

      processed++;
      if ( bar ) { bar.increment( 1, { url: truncateUrl( url ) } ); }
    } ) );
  }

  let summarized = false;
  function printSummary() {
    if ( summarized ) { return; }
    summarized = true;
    if ( bar ) {
      bar.update( discovered.size, { url: "" } );
      bar.stop();
    }
    const elapsed = ( ( Date.now() - startTime ) / 1000 ).toFixed( 1 );
    if ( results.length ) {
      console.log( `\nFound ${ results.length } match${ results.length === 1 ? "" : "es" }:` );
      results.forEach( url => console.log( `  ${ url }` ) );
      if ( outputFile ) {
        fs.writeFileSync( outputFile, results.join( "\n" ) + "\n" );
        console.log( `\nResults saved to ${ outputFile }` );
      }
    } else {
      console.log( `\nNo matches found.` );
    }
    if ( errors.length ) {
      console.log( `\nFailed to crawl (${ errors.length }):` );
      errors.forEach( url => console.log( `  ${ url }` ) );
    }
    console.log( `\n${ processed } pages processed in ${ elapsed }s` );
  }

  printSummary();
  await cleanup();
}

if ( isTTY ) {
  console.log( `${ name }@${ version } – A Command-Line Tool for Web Scraping & Searching\n` );
}

if ( argv._.length === 2 ) {
  const [ startUrl, keyword ] = argv._,
        normalized = normalizeLink( startUrl );

  if ( !/^https?:\/\//i.test( normalized ) ) {
    console.error( `Error: URL must use http:// or https://` );
    process.exit( 1 );
  }

  if ( argv.regex ) {
    try {
      new RegExp( keyword );
    } catch ( e ) {
      console.error( `Error: invalid regex — ${ e.message }` );
      process.exit( 1 );
    }
  }

  main( normalized, keyword, {
    caseInsensitive: !!argv.i,
    useRegex:        !!argv.regex,
    depth:           argv.depth != null ? parseInt( argv.depth, 10 ) : undefined,
    concurrency:     argv.concurrency != null ? parseInt( argv.concurrency, 10 ) : 1,
    maxPages:        argv.max != null ? parseInt( argv.max, 10 ) : undefined,
    timeout:         argv.timeout != null ? parseInt( argv.timeout, 10 ) : 15,
    waitMs:          argv.wait != null ? parseInt( argv.wait, 10 ) : 0,
    outputFile:      argv.output || null,
    debug:           !!argv.debug,
    dumpBody:        !!argv[ "dump-body" ],
  } );
} else {
  showUsage();
}
