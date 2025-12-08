const axios = require('axios');

exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const params = event.queryStringParameters || {};
  const targetUrl = params.url;

  // Dynamic Referer Handling
  let targetReferer = params.referer;
  if (!targetReferer) {
      if (targetUrl && (targetUrl.includes('vidmody') || targetUrl.includes('vidmoly'))) {
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

    // Headers to send to the video provider
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

    // Forward Range header if present (Critical for video playback)
    if (event.headers['range'] || event.headers['Range']) {
      proxyHeaders['Range'] = event.headers['range'] || event.headers['Range'];
    }

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

    // If text/html, we rewrite content
    if (contentType.includes('text/html')) {
      let html = response.data.toString('utf-8');
      
      const PROXY_ENDPOINT = '/api/video-proxy';

      // Helper to generate proxy URL
      const makeProxyUrl = (url) => {
          if (!url) return '';
          if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('magnet:')) return url;

          let absoluteUrl = url;
          try {
            if (url.startsWith('//')) {
              absoluteUrl = 'https:' + url;
            } else if (url.startsWith('/')) {
              absoluteUrl = new URL(url, baseUrl).href;
            } else if (!url.startsWith('http')) {
               absoluteUrl = new URL(url, targetUrl).href;
            }
          } catch(e) { return url; }

          return `${PROXY_ENDPOINT}?url=${encodeURIComponent(absoluteUrl)}&referer=${encodeURIComponent(targetUrl)}`;
      };

      // Rewrite src attributes
      html = html.replace(/<script([^>]*)src=["']([^"']+)["']([^>]*)>/gi, (match, p1, src, p3) => {
          return `<script${p1}src="${makeProxyUrl(src)}"${p3}>`;
      });
      html = html.replace(/<link([^>]*)href=["']([^"']+)["']([^>]*)>/gi, (match, p1, href, p3) => {
          return `<link${p1}href="${makeProxyUrl(href)}"${p3}>`;
      });
      html = html.replace(/<iframe([^>]*)src=["']([^"']+)["']([^>]*)>/gi, (match, p1, src, p3) => {
           return `<iframe${p1}src="${makeProxyUrl(src)}"${p3}>`;
      });

      const interceptorScript = `
        <script>
          (function() {
            const PROXY_URL = '/api/video-proxy';
            const ORIGINAL_REFERER = '${targetReferer}';
            const BASE_URL = '${baseUrl}';
            const CURRENT_PAGE_URL = '${targetUrl}';

            function rewriteUrl(url) {
              if (!url) return url;
              if (url.startsWith('data:') || url.startsWith('blob:')) return url;

              let absoluteUrl = url;
              try {
                  if (url.startsWith('//')) {
                    absoluteUrl = 'https:' + url;
                  } else if (url.startsWith('/')) {
                    absoluteUrl = new URL(url, BASE_URL).href;
                  } else if (!url.startsWith('http')) {
                    absoluteUrl = new URL(url, CURRENT_PAGE_URL).href;
                  }
              } catch(e) {
                  return url;
              }

              if (absoluteUrl.includes(PROXY_URL)) return absoluteUrl;
              return PROXY_URL + '?url=' + encodeURIComponent(absoluteUrl) + '&referer=' + encodeURIComponent(CURRENT_PAGE_URL);
            }

            // Intercept XHR/Fetch
            const originalFetch = window.fetch;
            window.fetch = function(input, init) {
              if (input instanceof Request) {
                try {
                    const newUrl = rewriteUrl(input.url);
                    // Cloning request with new URL is not directly possible via constructor if body is used
                    // But for video segments (GET), it works.
                    // If method is POST, body might be lost if we don't handle it, but Request(newUrl, input) copies it.
                    const newRequest = new Request(newUrl, input);
                    return originalFetch(newRequest, init);
                } catch(e) {
                    return originalFetch(input, init);
                }
              }
              return originalFetch(rewriteUrl(input), init);
            };

            const originalOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
              const newUrl = rewriteUrl(url);
              return originalOpen.apply(this, [method, newUrl, async, user, password]);
            };

            // Intercept Dynamic Element Creation (Scripts, Iframes)
            const interceptNode = (node) => {
                if (!node) return;
                if (node.tagName === 'SCRIPT' && node.src) {
                    node.src = rewriteUrl(node.src);
                } else if (node.tagName === 'IFRAME' && node.src) {
                    node.src = rewriteUrl(node.src);
                } else if (node.tagName === 'LINK' && node.href) {
                    node.href = rewriteUrl(node.href);
                } else if (node.tagName === 'IMG' && node.src) {
                    node.src = rewriteUrl(node.src);
                }
            };

            const originalAppendChild = Node.prototype.appendChild;
            Node.prototype.appendChild = function(node) {
              interceptNode(node);
              return originalAppendChild.call(this, node);
            };

            const originalInsertBefore = Node.prototype.insertBefore;
            Node.prototype.insertBefore = function(node, child) {
              interceptNode(node);
              return originalInsertBefore.call(this, node, child);
            };

            // Also intercept setAttribute for src/href
            const originalSetAttribute = Element.prototype.setAttribute;
            Element.prototype.setAttribute = function(name, value) {
                if ((this.tagName === 'SCRIPT' || this.tagName === 'IFRAME' || this.tagName === 'IMG') && name.toLowerCase() === 'src') {
                    return originalSetAttribute.call(this, name, rewriteUrl(value));
                }
                if (this.tagName === 'LINK' && name.toLowerCase() === 'href') {
                    return originalSetAttribute.call(this, name, rewriteUrl(value));
                }
                return originalSetAttribute.call(this, name, value);
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

      return {
        statusCode: response.status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html; charset=utf-8'
        },
        body: html
      };
    } else {
      // Return binary data (images, m3u8, ts segments, etc.)
      const headers = {
        ...corsHeaders,
        'Content-Type': contentType
      };

      if (response.headers['content-length']) headers['Content-Length'] = response.headers['content-length'];
      if (response.headers['content-range']) headers['Content-Range'] = response.headers['content-range'];
      if (response.headers['accept-ranges']) headers['Accept-Ranges'] = response.headers['accept-ranges'];

      return {
        statusCode: response.status,
        headers: headers,
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
