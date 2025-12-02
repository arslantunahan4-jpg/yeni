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

  if (!targetUrl) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'URL gerekli' })
    };
  }

  try {
    const parsedUrl = new URL(targetUrl);
    const hdfilmizleReferer = 'https://www.hdfilmizle.life/';
    const hdfilmizleOrigin = 'https://www.hdfilmizle.life';

    const proxyHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'iframe',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'cross-site',
      'Sec-Fetch-User': '?1',
      'Sec-CH-UA': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
      'Sec-CH-UA-Mobile': '?0',
      'Sec-CH-UA-Platform': '"Windows"',
      'Referer': hdfilmizleReferer,
      'Origin': hdfilmizleOrigin,
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };

    console.log(`[VideoProxy] Fetching: ${targetUrl}`);

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
      
      if (!html.includes('<base')) {
        html = html.replace(/<head([^>]*)>/i, `<head$1><base href="${baseUrl}/">`);
      }
      
      html = html.replace(/document\.referrer/g, `"${hdfilmizleReferer}"`);
      html = html.replace(/window\.location\.ancestorOrigins/g, `["${hdfilmizleOrigin}"]`);
      html = html.replace(/parent\.location/g, `{href:"${hdfilmizleReferer}",origin:"${hdfilmizleOrigin}"}`);
      html = html.replace(/top\.location/g, `{href:"${hdfilmizleReferer}",origin:"${hdfilmizleOrigin}"}`);
      
      html = html.replace(
        /<head([^>]*)>/i,
        `<head$1>
        <script>
          Object.defineProperty(document, 'referrer', {
            get: function() { return '${hdfilmizleReferer}'; }
          });
          Object.defineProperty(document, 'domain', {
            get: function() { return 'hdfilmizle.life'; },
            set: function() {}
          });
          window.__originalFetch = window.fetch;
          window.fetch = function(url, options) {
            options = options || {};
            options.headers = options.headers || {};
            if (typeof url === 'string' && !url.startsWith('data:')) {
              options.headers['X-Requested-With'] = 'XMLHttpRequest';
            }
            return window.__originalFetch(url, options);
          };
        </script>`
      );
      
      html = html.replace(/src=["']\/\//g, 'src="https://');
      html = html.replace(/href=["']\/\//g, 'href="https://');
      html = html.replace(/src=["'](?!https?:\/\/|data:|\/api)\/([^"']+)["']/g, `src="${baseUrl}/$1"`);
      html = html.replace(/href=["'](?!https?:\/\/|data:|#|javascript:)\/([^"']+)["']/g, `href="${baseUrl}/$1"`);

      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html; charset=utf-8'
        },
        body: html
      };
    } else {
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
