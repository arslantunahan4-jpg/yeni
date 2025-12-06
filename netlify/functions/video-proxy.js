const axios = require('axios');

exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': '*'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const params = event.queryStringParameters || {};
  const targetUrl = params.url;
  const targetReferer = params.referer || 'https://www.hdfilmizle.life/';
  const targetOrigin = params.origin || (targetReferer ? new URL(targetReferer).origin : 'https://www.hdfilmizle.life');

  // Extract domain from referer for document.domain mocking
  let targetDomain = 'hdfilmizle.life';
  try {
      if (targetReferer) {
        targetDomain = new URL(targetReferer).hostname.replace('www.', '');
      }
  } catch (e) {}

  if (!targetUrl) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'URL gerekli' })
    };
  }

  try {
    const parsedUrl = new URL(targetUrl);

    // If it's a relative URL being passed (which shouldn't happen if frontend handles it, but just in case)
    // we would handle it here, but we expect absolute URLs.

    const proxyHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'iframe',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'cross-site',
      'Sec-Fetch-User': '?1',
      'Sec-Ch-Ua': '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Referer': targetReferer,
      'Origin': targetOrigin,
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Dnt': '1'
    };

    console.log(`[VideoProxy] Fetching: ${targetUrl} (Referer: ${targetReferer})`);

    const response = await axios.get(targetUrl, {
      headers: proxyHeaders,
      timeout: 30000,
      responseType: 'arraybuffer',
      maxRedirects: 5,
      validateStatus: () => true
    });

    const contentType = response.headers['content-type'] || 'text/html';
    console.log(`[VideoProxy] Response Content-Type: ${contentType}`);

    if (contentType.includes('text/html')) {
      let html = response.data.toString('utf-8');
      
      const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
      
      // Inject our powerful interception script
      // This script intercepts Fetch and XHR to rewrite URLs to go through the proxy
      const interceptorScript = `
        <script>
          (function() {
            const PROXY_URL = '/api/video-proxy';
            const ORIGINAL_REFERER = '${targetReferer}';
            const BASE_URL = '${baseUrl}';

            // Helper to rewrite URL
            function rewriteUrl(url) {
              if (!url) return url;
              if (url.startsWith('data:') || url.startsWith('blob:')) return url;

              // Resolve relative URLs
              let absoluteUrl = url;
              if (url.startsWith('//')) {
                absoluteUrl = 'https:' + url;
              } else if (url.startsWith('/')) {
                absoluteUrl = BASE_URL + url;
              } else if (!url.startsWith('http')) {
                absoluteUrl = BASE_URL + '/' + url;
              }

              // Check if already proxied
              if (absoluteUrl.includes(PROXY_URL)) return absoluteUrl;

              // Encode and proxy
              return PROXY_URL + '?url=' + encodeURIComponent(absoluteUrl) + '&referer=' + encodeURIComponent(ORIGINAL_REFERER);
            }

            // --- Intercept Fetch ---
            const originalFetch = window.fetch;
            window.fetch = function(input, init) {
              let url = input;
              if (typeof input === 'string') {
                url = rewriteUrl(input);
              } else if (input instanceof Request) {
                // Clone the request with new URL
                url = rewriteUrl(input.url);
                // We might need to recreate the Request object, but simpler for now to just pass the string URL if possible
                // or just modify the url property if it was mutable (it's not).
                // Let's just pass the string url to the new fetch
              }

              return originalFetch(url, init);
            };

            // --- Intercept XMLHttpRequest ---
            const originalOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
              const newUrl = rewriteUrl(url);
              return originalOpen.apply(this, [method, newUrl, async, user, password]);
            };

            // --- Spoof Document Properties ---
            Object.defineProperty(document, 'referrer', { get: () => ORIGINAL_REFERER });
            try {
               // Only if not same origin, which it won't be in the proxy
               Object.defineProperty(window, 'origin', { get: () => '${targetOrigin}' });
            } catch(e){}

          })();
        </script>
        <base href="${baseUrl}/">
      `;

      if (html.includes('<head')) {
        html = html.replace('<head>', '<head>' + interceptorScript);
      } else {
        html = interceptorScript + html;
      }
      
      // Clean up other absolute links if they exist in static HTML (img src, etc)
      // The script above handles dynamic requests, but we should also try to fix static tags
      // However, regex replacement is brittle. Ideally, the base tag handles relative ones.
      // But for absolute ones pointing to the original domain, they will bypass proxy if not rewritten.
      // Let's rely on the base tag for relative, and maybe some regex for absolute?
      // Actually, standard `src` tags (img, script) won't use the JS interceptor.
      // So we MUST rewrite them in HTML too.

      // Rewrite src and href attributes in the HTML string
      // Note: This regex is simple and might miss edge cases or break strings.
      // 1. Rewrite relative paths that might be confused? Base tag handles this.
      // 2. Rewrite absolute paths (http/https) to use proxy.
      
      // We'll stick to the previous simple replacements plus the script injection for JS calls.
      
      html = html.replace(/src=["']\/\//g, 'src="https://');
      html = html.replace(/href=["']\/\//g, 'href="https://');

      // Attempt to rewrite absolute URLs in src to proxy (risky but needed for some assets)
      // Regex to find src="https://..." and wrap it
      // html = html.replace(/src="https?:\/\/([^"]+)"/g, (match, url) => {
      //   if (url.includes('google') || url.includes('facebook')) return match; // skip analytics
      //   return `src="/api/video-proxy?url=${encodeURIComponent('https://' + url)}&referer=${encodeURIComponent(targetReferer)}"`;
      // });

      // Keeping it safe: just the script injection + base tag is a huge improvement.
      // The previous code had manual replacements for relative paths, let's keep those but update them
      // to use the proxy if they were absolute-path-relative (starting with /)

      // Actually, relying on <base> is better for relative paths.
      // But if we want *everything* proxied, <base> just points them to original.
      // If we want them proxied, we must rewrite them to /api/video-proxy...

      // Let's rely on the injected script for XHR/Fetch (video player logic).
      // For static assets (images, css), if they fail CORS, they fail. But video players usually use XHR/Fetch for segments.

      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html; charset=utf-8'
        },
        body: html
      };
    } else {
      // For non-HTML (m3u8, ts, js, etc), just return it.
      // The browser's request to *this* proxy endpoint already succeeded.
      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': contentType
        },
        body: response.data.toString('base64'),
        isBase64Encoded: true
      };
    }
  } catch (error) {
    console.error('[VideoProxy] Error:', error.message);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message })
    };
  }
};
