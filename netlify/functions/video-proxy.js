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

  // Dynamic Referer Handling
  let targetReferer = params.referer;
  if (!targetReferer) {
      if (targetUrl && targetUrl.includes('vidmody')) {
          targetReferer = 'https://yabancidizibox.com/';
      } else {
          targetReferer = 'https://www.hdfilmizle.life/';
      }
  }

  let targetOrigin = params.origin;
  if (!targetOrigin && targetReferer) {
      try {
          targetOrigin = new URL(targetReferer).origin;
      } catch (e) {
          targetOrigin = 'https://www.hdfilmizle.life';
      }
  }

  if (!targetUrl) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'URL gerekli' })
    };
  }

  try {
    const parsedUrl = new URL(targetUrl);
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;

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
      'Referer': targetReferer,
      'Origin': targetOrigin,
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };

    console.log(`[VideoProxy] Fetching: ${targetUrl}`);
    console.log(`[VideoProxy] Using Referer: ${targetReferer}`);

    const response = await axios.get(targetUrl, {
      headers: proxyHeaders,
      timeout: 30000,
      responseType: 'arraybuffer',
      maxRedirects: 5,
      validateStatus: () => true
    });

    const contentType = response.headers['content-type'] || 'text/html';
    console.log(`[VideoProxy] Response Status: ${response.status}, Type: ${contentType}`);

    if (contentType.includes('text/html')) {
      let html = response.data.toString('utf-8');
      
      // Inject Interceptor Script
      // This script intercepts Fetch/XHR to rewrite URLs to point to this proxy
      // It also mocks document.referrer
      const interceptorScript = `
        <script>
          (function() {
            const PROXY_URL = '/api/video-proxy';
            const ORIGINAL_REFERER = '${targetReferer}';
            const BASE_URL = '${baseUrl}';

            console.log('[ProxyScript] Initialized for', BASE_URL);

            function rewriteUrl(url) {
              if (!url) return url;
              if (url.startsWith('data:') || url.startsWith('blob:')) return url;

              let absoluteUrl = url;
              if (url.startsWith('//')) {
                absoluteUrl = 'https:' + url;
              } else if (url.startsWith('/')) {
                absoluteUrl = BASE_URL + url;
              } else if (!url.startsWith('http')) {
                absoluteUrl = BASE_URL + '/' + url;
              }

              if (absoluteUrl.includes(PROXY_URL)) return absoluteUrl;

              // The magic: Recursively proxy sub-requests
              // Referer for sub-requests should be the current page's base url (the video host)
              // because players check if the m3u8 request comes from their own domain.
              return PROXY_URL + '?url=' + encodeURIComponent(absoluteUrl) + '&referer=' + encodeURIComponent(BASE_URL);
            }

            const originalFetch = window.fetch;
            window.fetch = function(input, init) {
              let url = input;
              if (typeof input === 'string') {
                url = rewriteUrl(input);
              } else if (input instanceof Request) {
                url = rewriteUrl(input.url);
              }
              return originalFetch(url, init);
            };

            const originalOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
              const newUrl = rewriteUrl(url);
              return originalOpen.apply(this, [method, newUrl, async, user, password]);
            };

            Object.defineProperty(document, 'referrer', { get: () => ORIGINAL_REFERER });
          })();
        </script>
        <base href="${baseUrl}/">
      `;

      if (html.includes('<head')) {
        html = html.replace('<head>', '<head>' + interceptorScript);
      } else {
        html = interceptorScript + html;
      }
      
      // Rewrite basic src/href to HTTPS to avoid mixed content warnings if they were protocol relative
      html = html.replace(/src=["']\/\//g, 'src="https://');
      html = html.replace(/href=["']\/\//g, 'href="https://');

      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html; charset=utf-8'
        },
        body: html
      };
    } else {
      // Return binary data (images, m3u8, ts segments, etc.)
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
