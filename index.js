#!/usr/bin/env node

// Keep crawlee's storage out of the working directory
process.env.CRAWLEE_STORAGE_DIR = "/tmp/wwwgrep-" + process.pid;

const { CheerioCrawler, log: crawleeLog } = require( "crawlee" ),
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
      showUsage = () => console.log( `${ name } <url> <keyword> [options]

where:

<url>              base URL (e.g. https://dsheiko.com)
<keyword>          keyword or regex pattern to search for
-i                 case-insensitive match
--regex            treat keyword as a regular expression
--depth N          limit crawl depth (default: unlimited)
--concurrency N    parallel pages (default: 1)
--max N            stop after N pages
--timeout N        page timeout in seconds (default: 10)
--output file      write matched URLs to a file
--help, -h         show this help
` );

crawleeLog.setLevel( crawleeLog.LEVELS.OFF );

if ( argv.help || argv.h ) {
  showUsage();
  process.exit( 0 );
}

async function main( startUrl, keyword, opts ) {
  const { caseInsensitive, useRegex, depth, concurrency, maxPages, timeout, outputFile, debug } = opts,
        dbg = debug ? ( msg ) => process.stderr.write( msg + "\n" ) : () => {},
        discovered = new Set( [ startUrl ] ),
        results = [],
        errors = [],
        startTime = Date.now(),
        startHostname = new URL( startUrl ).hostname,
        pattern = useRegex
          ? new RegExp( keyword, caseInsensitive ? "i" : "" )
          : null,
        matches = ( text ) => pattern
          ? pattern.test( text )
          : caseInsensitive
            ? text.toLowerCase().includes( keyword.toLowerCase() )
            : text.includes( keyword );

  const bar = isTTY
    ? new cliProgress.SingleBar( {
        format: " {bar} {percentage}% | {value}/{total} | ETA: {eta_formatted} | {url}"
      }, cliProgress.Presets.shades_classic )
    : null;

  if ( isTTY ) { console.log( `looking for "${ keyword }" at ${ startUrl }` ); }
  if ( bar ) { bar.start( 1, 0, { url: truncateUrl( startUrl ) } ); }

  const crawler = new CheerioCrawler( {
    maxRequestsPerCrawl: maxPages,
    maxConcurrency: concurrency,
    maxRequestRetries: 0,
    navigationTimeoutSecs: timeout,
    requestHandlerTimeoutSecs: 10,
    ignoreSslErrors: true,

    requestHandler: async ( { request, $, enqueueLinks } ) => {
      const currentDepth = request.userData.depth || 0;

      if ( matches( $( "body" ).text() ) ) {
        results.push( request.url );
      }

      if ( depth === undefined || currentDepth < depth ) {
        await enqueueLinks( {
          strategy: "same-hostname",
          transformRequestFunction: ( req ) => {
            const normalized = normalizeLink( req.url );
            let hostname;
            try { hostname = new URL( normalized ).hostname; } catch ( e ) { return null; }
            if ( hostname !== startHostname ) {
              dbg( `[skip:domain]  ${ normalized }` );
              return null;
            }
            if ( NON_HTML.test( normalized ) ) {
              dbg( `[skip:nonhtml] ${ normalized }` );
              return null;
            }
            if ( discovered.has( normalized ) ) {
              dbg( `[skip:seen]    ${ normalized }` );
              return null;
            }
            dbg( `[queue]        ${ normalized }` );
            discovered.add( normalized );
            req.url = normalized;
            req.userData = { depth: currentDepth + 1 };
            if ( bar ) { bar.setTotal( discovered.size ); }
            return req;
          },
        } );
      }

      if ( bar ) { bar.increment( 1, { url: truncateUrl( request.url ) } ); }
    },

    failedRequestHandler: async ( { request } ) => {
      errors.push( request.url );
      if ( bar ) { bar.increment( 1, { url: `[error] ${ truncateUrl( request.url ) }` } ); }
    },
  } );

  const cleanup = () => {
    try { fs.rmSync( process.env.CRAWLEE_STORAGE_DIR, { recursive: true, force: true } ); } catch ( e ) { /* ignore */ }
  };

  let summarized = false;
  const printSummary = () => {
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
    console.log( `\n${ discovered.size } links processed in ${ elapsed }s` );
  };

  process.on( "SIGINT", async () => {
    try { await crawler.teardown(); } catch ( e ) { /* already closing */ }
    printSummary();
    cleanup();
    process.exit( 0 );
  } );

  await crawler.run( [ { url: startUrl, userData: { depth: 0 } } ] );
  printSummary();
  cleanup();
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
    timeout:         argv.timeout != null ? parseInt( argv.timeout, 10 ) : 10,
    outputFile:      argv.output || null,
    debug:           !!argv.debug,
  } );
} else {
  showUsage();
}
