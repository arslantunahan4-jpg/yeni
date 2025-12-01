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
          const originalTitle = url.searchParams.get('original') || title;
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
              const isTvSeries = season && episode;
              
              console.log(`[HDFilmizle] Searching for: "${title}" / "${originalTitle}" (slug: ${slug})`);
              
              const normalizeTitle = (t) => t.toLowerCase()
                .replace(/[çÇ]/g, 'c').replace(/[ğĞ]/g, 'g').replace(/[şŞ]/g, 's')
                .replace(/[üÜ]/g, 'u').replace(/[ıİ]/g, 'i').replace(/[öÖ]/g, 'o')
                .replace(/[^a-z0-9]/g, '');
              
              const searchWithQuery = async (query) => {
                const searchUrl = `https://www.hdfilmizle.life/?s=${encodeURIComponent(query)}`;
                console.log(`[HDFilmizle] Searching: ${searchUrl}`);
                
                try {
                  const searchResponse = await axios.get(searchUrl, {
                    headers: { ...headers, Referer: 'https://www.hdfilmizle.life/' },
                    timeout: 15000,
                    validateStatus: (status) => status < 500
                  });
                  
                  if (searchResponse.status === 200) {
                    const $ = cheerio.load(searchResponse.data);
                    const results = [];
                    
                    $('article, .movie-item, .film-item, .poster, .movie, a[href*="hdfilmizle.life"]').each((i, el) => {
                      const $el = $(el);
                      let link = $el.find('a').first().attr('href') || $el.attr('href');
                      let resultTitle = $el.find('.title, h2, h3, .movie-title, .film-title').first().text().trim() 
                                        || $el.find('a').first().attr('title') 
                                        || $el.find('img').first().attr('alt')
                                        || '';
                      
                      if (link && link.includes('hdfilmizle.life') && !link.includes('?s=') && resultTitle) {
                        results.push({ link, title: resultTitle });
                      }
                    });
                    
                    return results;
                  }
                } catch (e) {
                  console.log(`[HDFilmizle] Search error for "${query}":`, e.message);
                }
                return [];
              };
              
              const findBestMatch = (results, searchTerms) => {
                if (results.length === 0) return null;
                
                let bestMatch = null;
                let bestScore = 0;
                
                for (const searchTerm of searchTerms) {
                  const normalizedSearch = normalizeTitle(searchTerm);
                  
                  for (const result of results) {
                    const normalizedResult = normalizeTitle(result.title);
                    
                    if (normalizedResult === normalizedSearch) {
                      return result.link;
                    }
                    
                    let score = 0;
                    if (normalizedResult.includes(normalizedSearch)) {
                      score = (normalizedSearch.length / normalizedResult.length) * 100;
                    } else if (normalizedSearch.includes(normalizedResult)) {
                      score = (normalizedResult.length / normalizedSearch.length) * 80;
                    }
                    
                    if (score > bestScore) {
                      bestScore = score;
                      bestMatch = result;
                    }
                  }
                }
                
                if (bestMatch && bestScore > 30) {
                  console.log(`[HDFilmizle] Best match: "${bestMatch.title}" (score: ${bestScore.toFixed(1)}%) -> ${bestMatch.link}`);
                  return bestMatch.link;
                }
                
                return results[0]?.link || null;
              };
              
              let allResults = [];
              const searchTerms = [title];
              if (originalTitle && originalTitle !== title) {
                searchTerms.push(originalTitle);
              }
              
              for (const term of searchTerms) {
                const results = await searchWithQuery(term);
                console.log(`[HDFilmizle] Found ${results.length} results for "${term}"`);
                allResults = [...allResults, ...results];
                
                if (results.length > 0) {
                  const exactMatch = results.find(r => 
                    normalizeTitle(r.title) === normalizeTitle(term)
                  );
                  if (exactMatch) {
                    console.log(`[HDFilmizle] Exact match found: ${exactMatch.link}`);
                    allResults = [exactMatch];
                    break;
                  }
                }
              }
              
              const uniqueResults = allResults.filter((r, i, arr) => 
                arr.findIndex(x => x.link === r.link) === i
              );
              
              console.log(`[HDFilmizle] Total unique results: ${uniqueResults.length}`);
              
              let contentUrl = findBestMatch(uniqueResults, searchTerms);
              
              if (!contentUrl) {
                const urlVariations = isTvSeries ? [
                  `https://www.hdfilmizle.life/dizi/${slug}/`,
                  `https://www.hdfilmizle.life/dizi/${slug}-izle/`
                ] : [
                  `https://www.hdfilmizle.life/${slug}-izle-hd/`,
                  `https://www.hdfilmizle.life/${slug}-izle/`,
                  `https://www.hdfilmizle.life/${slug}/`
                ];
                
                for (const tryUrl of urlVariations) {
                  try {
                    const resp = await axios.get(tryUrl, {
                      headers: { ...headers, Referer: 'https://www.hdfilmizle.life/' },
                      timeout: 10000,
                      validateStatus: (status) => status < 500
                    });
                    if (resp.status === 200 && (resp.data.includes('iframe') || resp.data.includes('player'))) {
                      contentUrl = tryUrl;
                      break;
                    }
                  } catch (e) {
                    continue;
                  }
                }
              }
              
              if (contentUrl) {
                if (isTvSeries) {
                  const baseSlug = contentUrl.replace('https://www.hdfilmizle.life/', '').replace(/\/$/, '');
                  const episodeVariations = [
                    contentUrl.replace(/\/?$/, `/sezon-${season}/bolum-${episode}/`),
                    `https://www.hdfilmizle.life/dizi/${baseSlug}/sezon-${season}/bolum-${episode}/`,
                    `https://www.hdfilmizle.life/${baseSlug}/sezon-${season}/bolum-${episode}/`
                  ];
                  
                  for (const epUrl of episodeVariations) {
                    try {
                      console.log(`[HDFilmizle] Trying episode URL: ${epUrl}`);
                      const epResponse = await axios.get(epUrl, {
                        headers: { ...headers, Referer: 'https://www.hdfilmizle.life/' },
                        timeout: 10000,
                        validateStatus: (status) => status < 500
                      });
                      
                      if (epResponse.status === 200) {
                        contentUrl = epUrl;
                        break;
                      }
                    } catch (e) {
                      continue;
                    }
                  }
                }
                
                console.log(`[HDFilmizle] Fetching content from: ${contentUrl}`);
                
                try {
                  const response = await axios.get(contentUrl, {
                    headers: { ...headers, Referer: 'https://www.hdfilmizle.life/' },
                    timeout: 15000
                  });
                  
                  const html = response.data;
                  moviePageUrl = contentUrl;
                  
                  const vidrameDomains = ['vidrame.pro', 'vidframe', 'rapidvid', 'vidmoly', 'closeload', 'fastload', 'hdplayer', 'videoseyred', 'supervideo', 'vidsrc', 'streamtape', 'mixdrop'];
                  const excludeExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico', '.css', '.js', '.woff', '.woff2', '.ttf'];
                  const excludePatterns = ['/cover/', '/poster/', '/backdrop/', '/image/', '/img/', '/thumb/', '/avatar/'];
                  
                  const isValidPlayerUrl = (url) => {
                    if (!url) return false;
                    const lowerUrl = url.toLowerCase();
                    
                    if (excludeExtensions.some(ext => lowerUrl.includes(ext))) return false;
                    if (excludePatterns.some(pattern => lowerUrl.includes(pattern))) return false;
                    if (lowerUrl.includes('hdfilmizle.life/v/')) return false;
                    
                    return vidrameDomains.some(d => lowerUrl.includes(d));
                  };
                  
                  const normalizeUrl = (src) => {
                    if (!src) return null;
                    let url = src.trim();
                    if (url.startsWith('//')) url = 'https:' + url;
                    if (!url.startsWith('http')) return null;
                    if (!url.includes('?')) url += '?ap=1';
                    else if (!url.includes('ap=')) url += '&ap=1';
                    return url;
                  };
                  
                  const partsPatterns = [
                    /let\s+parts\s*=\s*(\[[\s\S]*?\]);/,
                    /var\s+parts\s*=\s*(\[[\s\S]*?\]);/,
                    /const\s+parts\s*=\s*(\[[\s\S]*?\]);/,
                    /parts\s*:\s*(\[[\s\S]*?\])/
                  ];
                  
                  for (const pattern of partsPatterns) {
                    if (iframeSrc) break;
                    const partsMatch = html.match(pattern);
                    if (partsMatch) {
                      try {
                        const partsJson = partsMatch[1].replace(/\\"/g, '"').replace(/\\\//g, '/').replace(/\\'/g, "'");
                        const srcPatterns = [
                          { pattern: /src=\\"([^"\\]+)\\"/g, hasGroup: true },
                          { pattern: /src=\\'([^'\\]+)\\'/g, hasGroup: true },
                          { pattern: /src="([^"]+)"/g, hasGroup: true },
                          { pattern: /src='([^']+)'/g, hasGroup: true },
                          { pattern: /"src"\s*:\s*"([^"]+)"/g, hasGroup: true },
                          { pattern: /'src'\s*:\s*'([^']+)'/g, hasGroup: true },
                          { pattern: /(https?:\/\/[^\s"'<>]+vidrame[^\s"'<>]*)/gi, hasGroup: true },
                          { pattern: /(https?:\/\/[^\s"'<>]+vidframe[^\s"'<>]*)/gi, hasGroup: true },
                          { pattern: /(\/\/[^\s"'<>]+vidrame[^\s"'<>]*)/gi, hasGroup: true }
                        ];
                        
                        for (const { pattern, hasGroup } of srcPatterns) {
                          let match;
                          while ((match = pattern.exec(partsJson)) !== null) {
                            const candidate = hasGroup ? (match[1] || match[0]) : match[0];
                            if (candidate && isValidPlayerUrl(candidate)) {
                              iframeSrc = normalizeUrl(candidate);
                              if (iframeSrc) {
                                console.log(`[HDFilmizle] Found in parts: ${iframeSrc}`);
                                break;
                              }
                            }
                          }
                          if (iframeSrc) break;
                        }
                      } catch (e) {
                        console.log(`[HDFilmizle] Parts parse error:`, e.message);
                      }
                    }
                  }
                  
                  if (!iframeSrc) {
                    const iframePatterns = [
                      /<iframe[^>]*src=["']([^"']+)["'][^>]*>/gi,
                      /<iframe[^>]*data-src=["']([^"']+)["'][^>]*>/gi,
                      /iframe[^>]*src=["']([^"']+)["']/gi
                    ];
                    
                    for (const pattern of iframePatterns) {
                      if (iframeSrc) break;
                      let match;
                      while ((match = pattern.exec(html)) !== null) {
                        if (isValidPlayerUrl(match[1])) {
                          iframeSrc = normalizeUrl(match[1]);
                          if (iframeSrc) {
                            console.log(`[HDFilmizle] Found iframe via regex: ${iframeSrc}`);
                            break;
                          }
                        }
                      }
                    }
                  }
                  
                  if (!iframeSrc) {
                    const $ = cheerio.load(html);
                    
                    $('iframe, .player-container iframe, #player iframe, .video-container iframe, [class*="player"] iframe').each((i, el) => {
                      if (iframeSrc) return;
                      const src = $(el).attr('data-src') || $(el).attr('src') || $(el).attr('data-lazy-src') || $(el).attr('data-original');
                      if (isValidPlayerUrl(src)) {
                        iframeSrc = normalizeUrl(src);
                        if (iframeSrc) console.log(`[HDFilmizle] Found iframe via cheerio: ${iframeSrc}`);
                      }
                    });
                    
                    if (!iframeSrc) {
                      $('[data-player], [data-src], [data-video], [data-embed]').each((i, el) => {
                        if (iframeSrc) return;
                        const src = $(el).attr('data-player') || $(el).attr('data-src') || $(el).attr('data-video') || $(el).attr('data-embed');
                        if (isValidPlayerUrl(src)) {
                          iframeSrc = normalizeUrl(src);
                          if (iframeSrc) console.log(`[HDFilmizle] Found via data attribute element: ${iframeSrc}`);
                        }
                      });
                    }
                  }
                  
                  if (!iframeSrc) {
                    const attrPatterns = [
                      /data-player=["']([^"']+)["']/gi,
                      /data-src=["']([^"']+)["']/gi,
                      /data-video=["']([^"']+)["']/gi,
                      /data-embed=["']([^"']+)["']/gi,
                      /embed[Uu]rl\s*[:=]\s*["']([^"']+)["']/g,
                      /player[Uu]rl\s*[:=]\s*["']([^"']+)["']/g,
                      /video[Ss]rc\s*[:=]\s*["']([^"']+)["']/g,
                      /videoUrl\s*[:=]\s*["']([^"']+)["']/g,
                      /streamUrl\s*[:=]\s*["']([^"']+)["']/g,
                      /"url"\s*:\s*"([^"]+vidrame[^"]+)"/gi,
                      /'url'\s*:\s*'([^']+vidrame[^']+)'/gi,
                      /"file"\s*:\s*"([^"]+)"/gi,
                      /"source"\s*:\s*"([^"]+)"/gi
                    ];
                    
                    for (const pattern of attrPatterns) {
                      if (iframeSrc) break;
                      let match;
                      while ((match = pattern.exec(html)) !== null) {
                        if (isValidPlayerUrl(match[1])) {
                          iframeSrc = normalizeUrl(match[1]);
                          if (iframeSrc) {
                            console.log(`[HDFilmizle] Found via data attributes: ${iframeSrc}`);
                            break;
                          }
                        }
                      }
                    }
                  }
                  
                  if (!iframeSrc) {
                    const directUrlPatterns = [
                      /https?:\/\/[^\s"'<>]*vidrame\.[^\s"'<>]+/gi,
                      /https?:\/\/[^\s"'<>]*vidframe\.[^\s"'<>]+/gi,
                      /\/\/[^\s"'<>]*vidrame\.[^\s"'<>]+/gi,
                      /\/\/[^\s"'<>]*vidframe\.[^\s"'<>]+/gi
                    ];
                    
                    for (const pattern of directUrlPatterns) {
                      if (iframeSrc) break;
                      const match = html.match(pattern);
                      if (match && match[0]) {
                        iframeSrc = normalizeUrl(match[0]);
                        if (iframeSrc) {
                          console.log(`[HDFilmizle] Found direct vidrame URL: ${iframeSrc}`);
                        }
                      }
                    }
                  }
                  
                  if (!iframeSrc) {
                    const $ = cheerio.load(html);
                    $('script').each((i, el) => {
                      if (iframeSrc) return;
                      const scriptContent = $(el).html() || '';
                      
                      const scriptPatterns = [
                        /["']([^"']*vidrame[^"']+)["']/gi,
                        /["']([^"']*vidframe[^"']+)["']/gi,
                        /src\s*[:=]\s*["']([^"']+)["']/gi,
                        /url\s*[:=]\s*["']([^"']+embed[^"']+)["']/gi
                      ];
                      
                      for (const pattern of scriptPatterns) {
                        if (iframeSrc) break;
                        let match;
                        while ((match = pattern.exec(scriptContent)) !== null) {
                          if (isValidPlayerUrl(match[1])) {
                            iframeSrc = normalizeUrl(match[1]);
                            if (iframeSrc) {
                              console.log(`[HDFilmizle] Found in script: ${iframeSrc}`);
                              break;
                            }
                          }
                        }
                      }
                    });
                  }
                } catch (e) {
                  console.log(`[HDFilmizle] Error fetching content:`, e.message);
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
