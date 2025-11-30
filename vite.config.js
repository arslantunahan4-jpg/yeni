import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import axios from "axios";
import * as cheerio from "cheerio";

function scraperPlugin() {
  return {
    name: 'scraper-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        
        if (req.url.startsWith('/api/video-proxy')) {
          const url = new URL(req.url, 'http://localhost');
          const targetUrl = url.searchParams.get('url');
          
          if (!targetUrl) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'URL gerekli' }));
            return;
          }

          try {
            const parsedUrl = new URL(targetUrl);
            const targetHost = parsedUrl.host;
            
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
            console.log(`[VideoProxy] Using Referer: ${hdfilmizleReferer}`);

            const response = await axios.get(targetUrl, {
              headers: proxyHeaders,
              timeout: 30000,
              responseType: 'arraybuffer',
              maxRedirects: 5,
              validateStatus: () => true
            });

            const contentType = response.headers['content-type'] || 'text/html';
            console.log(`[VideoProxy] Response Content-Type: ${contentType}`);

            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', '*');
            res.removeHeader('X-Frame-Options');
            res.removeHeader('Content-Security-Policy');
            
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
              
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.end(html);
            } else {
              res.setHeader('Content-Type', contentType);
              if (response.headers['content-length']) {
                res.setHeader('Content-Length', response.headers['content-length']);
              }
              res.end(response.data);
            }
            
            console.log(`[VideoProxy] Successfully proxied: ${targetUrl}`);
          } catch (error) {
            console.error('[VideoProxy] Error:', error.message);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: error.message }));
          }
          return;
        }

        if (req.url.startsWith('/api/stream-proxy/')) {
          const urlPath = req.url.replace('/api/stream-proxy/', '');
          const targetUrl = decodeURIComponent(urlPath.split('?')[0]);
          
          if (!targetUrl.startsWith('http')) {
            res.statusCode = 400;
            res.end('Invalid URL');
            return;
          }

          try {
            const parsedUrl = new URL(targetUrl);
            
            const proxyHeaders = {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
              'Accept': '*/*',
              'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
              'Referer': 'https://www.hdfilmizle.life/',
              'Origin': 'https://www.hdfilmizle.life',
              'Sec-Fetch-Dest': 'video',
              'Sec-Fetch-Mode': 'cors',
              'Sec-Fetch-Site': 'cross-site'
            };

            if (req.headers.range) {
              proxyHeaders['Range'] = req.headers.range;
            }

            const response = await axios.get(targetUrl, {
              headers: proxyHeaders,
              responseType: 'stream',
              timeout: 60000,
              maxRedirects: 5,
              validateStatus: () => true
            });

            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Range');
            res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
            
            if (response.headers['content-type']) {
              res.setHeader('Content-Type', response.headers['content-type']);
            }
            if (response.headers['content-length']) {
              res.setHeader('Content-Length', response.headers['content-length']);
            }
            if (response.headers['content-range']) {
              res.setHeader('Content-Range', response.headers['content-range']);
            }
            if (response.headers['accept-ranges']) {
              res.setHeader('Accept-Ranges', response.headers['accept-ranges']);
            }
            
            res.statusCode = response.status;
            response.data.pipe(res);
          } catch (error) {
            console.error('[StreamProxy] Error:', error.message);
            res.statusCode = 500;
            res.end('Proxy error: ' + error.message);
          }
          return;
        }

        if (req.url.startsWith('/api/scrape-iframe')) {
          const url = new URL(req.url, 'http://localhost');
          const site = url.searchParams.get('site');
          const slug = url.searchParams.get('slug');
          const title = url.searchParams.get('title') || slug;
          const season = url.searchParams.get('s');
          const episode = url.searchParams.get('e');

          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');

          const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Cache-Control': 'max-age=0'
          };

          try {
            let iframeSrc = null;
            let moviePageUrl = null;

            if (site === 'hdfilmizle') {
              let urlVariations = [];
              
              const isTvSeries = season && episode;
              
              if (isTvSeries) {
                console.log(`[HDFilmizle] Searching for TV series: ${slug} S${season}E${episode}`);
                urlVariations = [
                  `https://www.hdfilmizle.life/dizi/${slug}/sezon-${season}/bolum-${episode}/`,
                  `https://www.hdfilmizle.life/dizi/${slug}/sezon-${season}/bolum-${episode}`,
                  `https://www.hdfilmizle.life/dizi/${slug}-izle/sezon-${season}/bolum-${episode}/`,
                  `https://www.hdfilmizle.life/dizi/${slug}/s${season}/e${episode}/`,
                  `https://www.hdfilmizle.life/${slug}/sezon-${season}/bolum-${episode}/`,
                  `https://www.hdfilmizle.life/${slug}-sezon-${season}-bolum-${episode}/`,
                  `https://www.hdfilmizle.life/${slug}-${season}-sezon-${episode}-bolum-izle/`,
                  `https://www.hdfilmizle.life/dizi/${slug}/`
                ];
              } else {
                console.log(`[HDFilmizle] Searching for movie: ${slug}`);
                urlVariations = [
                  `https://www.hdfilmizle.life/${slug}-izle-hd/`,
                  `https://www.hdfilmizle.life/${slug}-izle/`,
                  `https://www.hdfilmizle.life/${slug}-hd-izle/`,
                  `https://www.hdfilmizle.life/${slug}-full-izle/`,
                  `https://www.hdfilmizle.life/${slug}-turkce-dublaj-izle/`,
                  `https://www.hdfilmizle.life/${slug}/`,
                  `https://www.hdfilmizle.life/film/${slug}/`,
                  `https://www.hdfilmizle.life/film/${slug}-izle/`
                ];
              }
              
              for (const tryUrl of urlVariations) {
                try {
                  console.log(`[HDFilmizle] Trying: ${tryUrl}`);
                  const response = await axios.get(tryUrl, { 
                    headers: { ...headers, Referer: 'https://www.hdfilmizle.life/' },
                    timeout: 10000,
                    validateStatus: (status) => status < 500
                  });
                  
                  if (response.status === 200) {
                    const html = response.data;
                    
                    if (html.includes('iframe') || html.includes('player') || html.includes('video')) {
                      moviePageUrl = tryUrl;
                      console.log(`[HDFilmizle] Found page: ${tryUrl}`);
                      
                      const partsMatch = html.match(/let\s+parts\s*=\s*(\[[\s\S]*?\]);/);
                      if (partsMatch) {
                        try {
                          const partsJson = partsMatch[1]
                            .replace(/\\"/g, '"')
                            .replace(/\\\//g, '/');
                          const srcMatch = partsJson.match(/src=\\"([^"\\]+)\\"/);
                          if (srcMatch) {
                            iframeSrc = srcMatch[1];
                            if (!iframeSrc.includes('?')) iframeSrc += '?ap=1';
                            else if (!iframeSrc.includes('ap=')) iframeSrc += '&ap=1';
                            console.log(`[HDFilmizle] Found in parts: ${iframeSrc}`);
                            break;
                          }
                        } catch (e) {
                          console.log(`[HDFilmizle] Parts parse error:`, e.message);
                        }
                      }
                      
                      const iframeMatch = html.match(/iframe[^>]*src=["']([^"']+)["']/i);
                      if (iframeMatch) {
                        let src = iframeMatch[1];
                        if (src.startsWith('//')) src = 'https:' + src;
                        if (src.includes('vidframe') || src.includes('vidrame') || src.includes('rapid') || src.includes('player') || src.includes('embed')) {
                          iframeSrc = src;
                          if (!iframeSrc.includes('?')) iframeSrc += '?ap=1';
                          else if (!iframeSrc.includes('ap=')) iframeSrc += '&ap=1';
                          console.log(`[HDFilmizle] Found iframe via regex: ${iframeSrc}`);
                          break;
                        }
                      }
                      
                      const $ = cheerio.load(html);
                      $('iframe').each((i, el) => {
                        if (iframeSrc) return;
                        const src = $(el).attr('data-src') || $(el).attr('src');
                        if (src && (src.includes('vidframe') || src.includes('vidrame') || src.includes('rapid') || src.includes('player') || src.includes('embed'))) {
                          iframeSrc = src.startsWith('//') ? 'https:' + src : src;
                          if (!iframeSrc.includes('?')) iframeSrc += '?ap=1';
                          else if (!iframeSrc.includes('ap=')) iframeSrc += '&ap=1';
                          console.log(`[HDFilmizle] Found iframe via cheerio: ${iframeSrc}`);
                        }
                      });
                      
                      if (!iframeSrc) {
                        const dataPlayerMatch = html.match(/data-player=["']([^"']+)["']/i);
                        const embedMatch = html.match(/embed[Uu]rl\s*[:=]\s*["']([^"']+)["']/);
                        const playerMatch = html.match(/player[Uu]rl\s*[:=]\s*["']([^"']+)["']/);
                        const videoSrcMatch = html.match(/video[Ss]rc\s*[:=]\s*["']([^"']+)["']/);
                        
                        const foundMatch = dataPlayerMatch || embedMatch || playerMatch || videoSrcMatch;
                        if (foundMatch) {
                          let src = foundMatch[1];
                          if (src.startsWith('//')) src = 'https:' + src;
                          iframeSrc = src;
                          if (!iframeSrc.includes('?')) iframeSrc += '?ap=1';
                          else if (!iframeSrc.includes('ap=')) iframeSrc += '&ap=1';
                          console.log(`[HDFilmizle] Found via data attributes: ${iframeSrc}`);
                        }
                      }
                      
                      if (iframeSrc) break;
                    }
                  }
                } catch (e) {
                  console.log(`[HDFilmizle] Error trying ${tryUrl}:`, e.message);
                  continue;
                }
              }

            } else if (site === 'selcukflix') {
              const urlVariations = [
                `https://selcukflix.net/film/${slug}`,
                `https://selcukflix.net/film/${slug}/izle`,
                `https://selcukflix.net/${slug}`,
                `https://selcukflix.net/film/${slug}-izle`,
                `https://selcukflix.net/filmler/${slug}`
              ];
              
              for (const tryUrl of urlVariations) {
                try {
                  console.log(`[Selcukflix] Trying: ${tryUrl}`);
                  const response = await axios.get(tryUrl, { 
                    headers: { 
                      ...headers, 
                      Referer: 'https://selcukflix.net/',
                      Host: 'selcukflix.net'
                    },
                    timeout: 10000,
                    validateStatus: (status) => status < 500
                  });
                  
                  if (response.status === 200) {
                    moviePageUrl = tryUrl;
                    const html = response.data;
                    const $ = cheerio.load(html);
                    
                    $('iframe').each((i, el) => {
                      const src = $(el).attr('data-src') || $(el).attr('src');
                      if (src && !src.includes('google') && !src.includes('facebook') && !src.includes('ads')) {
                        iframeSrc = src.startsWith('//') ? 'https:' + src : src;
                        console.log(`[Selcukflix] Found iframe: ${iframeSrc}`);
                      }
                    });
                    
                    if (!iframeSrc) {
                      const playerMatch = html.match(/player[Uu]rl\s*[:=]\s*["']([^"']+)["']/);
                      const embedMatch = html.match(/embed[Uu]rl\s*[:=]\s*["']([^"']+)["']/);
                      const videoMatch = html.match(/video[Uu]rl\s*[:=]\s*["']([^"']+)["']/);
                      const match = playerMatch || embedMatch || videoMatch;
                      if (match) {
                        iframeSrc = match[1].startsWith('//') ? 'https:' + match[1] : match[1];
                        console.log(`[Selcukflix] Found player URL: ${iframeSrc}`);
                      }
                    }
                    
                    if (iframeSrc) break;
                  }
                } catch (e) {
                  console.log(`[Selcukflix] Error trying ${tryUrl}:`, e.message);
                  continue;
                }
              }
            }

            if (iframeSrc) {
              console.log(`[Scraper] Success! URL: ${iframeSrc}`);
              res.end(JSON.stringify({ success: true, url: iframeSrc, moviePage: moviePageUrl }));
            } else {
              console.log(`[Scraper] No iframe found for ${site}/${slug}`);
              res.end(JSON.stringify({ success: false, error: 'Iframe bulunamadı', moviePage: moviePageUrl }));
            }
          } catch (error) {
            console.error(`[Scraper] Error for ${site}:`, error.message);
            res.end(JSON.stringify({ success: false, error: error.message }));
          }
          return;
        }
        next();
      });
    }
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), scraperPlugin()],
  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
    strictPort: true,
    headers: {
      "Cache-Control": "no-cache"
    }
  }
});
