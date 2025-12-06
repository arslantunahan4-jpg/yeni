import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import axios from "axios";
import * as cheerio from "cheerio";

const createSlug = (text) => {
    if (!text) return "";
    const trMap = { 'ç': 'c', 'ğ': 'g', 'ş': 's', 'ü': 'u', 'ı': 'i', 'ö': 'o', 'Ç': 'c', 'Ğ': 'g', 'Ş': 's', 'Ü': 'u', 'İ': 'i', 'Ö': 'o' };
    return text.split('').map(char => trMap[char] || char).join('')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
};

function scraperPlugin() {
  return {
    name: 'scraper-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        
        if (req.url.startsWith('/api/video-proxy')) {
          const url = new URL(req.url, 'http://localhost');
          const targetUrl = url.searchParams.get('url');
          const targetReferer = url.searchParams.get('referer') || 'https://www.hdfilmizle.life/';
          const targetOrigin = url.searchParams.get('origin') || (targetReferer ? new URL(targetReferer).origin : 'https://www.hdfilmizle.life');
          
          let targetDomain = 'hdfilmizle.life';
          try {
              targetDomain = new URL(targetReferer).hostname.replace('www.', '');
          } catch (e) {}

          if (!targetUrl) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'URL gerekli' }));
            return;
          }

          try {
            const parsedUrl = new URL(targetUrl);
            const targetHost = parsedUrl.host;
            
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
              
              html = html.replace(/document\.referrer/g, `"${targetReferer}"`);
              html = html.replace(/window\.location\.ancestorOrigins/g, `["${targetOrigin}"]`);
              html = html.replace(/parent\.location/g, `{href:"${targetReferer}",origin:"${targetOrigin}"}`);
              html = html.replace(/top\.location/g, `{href:"${targetReferer}",origin:"${targetOrigin}"}`);
              
              html = html.replace(
                /<head([^>]*)>/i,
                `<head$1>
                <script>
                  Object.defineProperty(document, 'referrer', {
                    get: function() { return '${targetReferer}'; }
                  });
                  Object.defineProperty(document, 'domain', {
                    get: function() { return '${targetDomain}'; },
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

            if (site === 'yabancidizibox') {
                console.log(`[YabanciDiziBox] Searching for: "${title}" / "${originalTitle}" (slug: ${slug})`);

                const isTvSeries = season && episode;
                const searchUrl = `https://yabancidizibox.com/?s=${encodeURIComponent(title)}`;

                try {
                    const searchResponse = await axios.get(searchUrl, {
                        headers: { ...headers, Referer: 'https://yabancidizibox.com/' },
                        timeout: 10000
                    });

                    let contentUrl = null;
                    if (searchResponse.status === 200) {
                        const $ = cheerio.load(searchResponse.data);
                        const results = [];
                        $('.result-item, .poster, .movie, article').each((i, el) => {
                            const $el = $(el);
                            const link = $el.find('a').attr('href');
                            const resultTitle = $el.text().toLowerCase();
                            if (link) {
                                results.push({ link, title: resultTitle });
                            }
                        });

                        const normalizeTitle = (t) => t.toLowerCase().replace(/[^a-z0-9]/g, '');
                        const normalizedTitle = normalizeTitle(title);
                        const bestMatch = results.find(r => normalizeTitle(r.title).includes(normalizedTitle));

                        if (bestMatch) {
                            contentUrl = bestMatch.link;
                        }
                    }

                    if (!contentUrl) {
                        const baseSlug = createSlug ? createSlug(originalTitle || title) : slug;
                        if (isTvSeries) {
                            contentUrl = `https://yabancidizibox.com/dizi/${baseSlug}`;
                        } else {
                            contentUrl = `https://yabancidizibox.com/film/${baseSlug}`;
                        }
                    }

                    if (contentUrl && isTvSeries) {
                        if (!contentUrl.includes('sezon-') && !contentUrl.includes('bolum-')) {
                            const cleanUrl = contentUrl.endsWith('/') ? contentUrl.slice(0, -1) : contentUrl;
                            contentUrl = `${cleanUrl}/sezon-${season}-bolum-${episode}`;
                        }
                    }

                    console.log(`[YabanciDiziBox] Fetching content from: ${contentUrl}`);

                    const contentResponse = await axios.get(contentUrl, {
                        headers: { ...headers, Referer: 'https://yabancidizibox.com/' },
                        timeout: 10000,
                        validateStatus: (status) => status < 500
                    });

                    if (contentResponse.status === 200) {
                        moviePageUrl = contentUrl;
                        const html = contentResponse.data;
                        const $ = cheerio.load(html);

                        const normalizeUrl = (src) => {
                          if (!src) return null;
                          let url = src.trim();
                          if (url.startsWith('//')) url = 'https:' + url;
                          if (!url.startsWith('http')) return null;
                          if (!url.includes('?')) url += '?ap=1';
                          else if (!url.includes('ap=')) url += '&ap=1';
                          return url;
                        };

                        $('iframe').each((i, el) => {
                            if (iframeSrc) return;
                            const src = $(el).attr('src') || $(el).attr('data-src');
                            if (src && !src.includes('facebook') && !src.includes('google')) {
                                iframeSrc = normalizeUrl(src);
                                console.log(`[YabanciDiziBox] Found iframe: ${iframeSrc}`);
                            }
                        });

                        if (!iframeSrc) {
                            const match = html.match(/(?:source|src|file|video_url)["']?\s*:\s*["']([^"']+)["']/i);
                            if (match) {
                                iframeSrc = normalizeUrl(match[1]);
                                console.log(`[YabanciDiziBox] Found source in script: ${iframeSrc}`);
                            }
                        }
                    }

                } catch (e) {
                    console.log(`[YabanciDiziBox] Error: ${e.message}`);
                }

            } else if (site === 'hdfilmizle') {
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
                  
                  const normalizeUrl = (src) => {
                    if (!src) return null;
                    let url = src.trim();
                    if (url.startsWith('//')) url = 'https:' + url;
                    if (!url.startsWith('http')) return null;
                    if (!url.includes('?')) url += '?ap=1';
                    else if (!url.includes('ap=')) url += '&ap=1';
                    return url;
                  };
                  
                  const vidramaMatch = html.match(/https?:\/\/vidrame\.pro\/[^\s"'<>\]\\]+/i);
                  if (vidramaMatch) {
                    let url = vidramaMatch[0].replace(/\\+/g, '');
                    iframeSrc = normalizeUrl(url);
                    console.log(`[HDFilmizle] Found vidrame.pro direct: ${iframeSrc}`);
                  }
                  
                  if (!iframeSrc) {
                    const vidframeMatch = html.match(/https?:\/\/vidframe[^\s"'<>\]\\]+/i);
                    if (vidframeMatch) {
                      let url = vidframeMatch[0].replace(/\\+/g, '');
                      iframeSrc = normalizeUrl(url);
                      console.log(`[HDFilmizle] Found vidframe direct: ${iframeSrc}`);
                    }
                  }
                  
                  if (!iframeSrc) {
                    const protocolRelativeMatch = html.match(/\/\/vidrame\.pro\/[^\s"'<>\]\\]+/i);
                    if (protocolRelativeMatch) {
                      let url = 'https:' + protocolRelativeMatch[0].replace(/\\+/g, '');
                      iframeSrc = normalizeUrl(url);
                      console.log(`[HDFilmizle] Found vidrame.pro (protocol-relative): ${iframeSrc}`);
                    }
                  }
                  
                  if (!iframeSrc) {
                    const partsMatch = html.match(/let\s+parts\s*=\s*(\[[\s\S]*?\]);/);
                    if (partsMatch) {
                      const partsContent = partsMatch[1];
                      console.log(`[HDFilmizle] Found parts array, length: ${partsContent.length}`);
                      
                      const vidrameSrcMatch = partsContent.match(/vidrame\.pro[^\s"'<>\]\\]*/i);
                      if (vidrameSrcMatch) {
                        let url = 'https://' + vidrameSrcMatch[0].replace(/\\+/g, '');
                        iframeSrc = normalizeUrl(url);
                        console.log(`[HDFilmizle] Found in parts: ${iframeSrc}`);
                      }
                    }
                  }
                  
                  if (!iframeSrc) {
                    const $ = cheerio.load(html);
                    $('iframe').each((i, el) => {
                      if (iframeSrc) return;
                      const src = $(el).attr('data-src') || $(el).attr('src');
                      if (src && (src.includes('vidrame') || src.includes('vidframe'))) {
                        iframeSrc = normalizeUrl(src);
                        console.log(`[HDFilmizle] Found iframe element: ${iframeSrc}`);
                      }
                    });
                  }
                  
                  if (!iframeSrc) {
                    const $ = cheerio.load(html);
                    $('script').each((i, el) => {
                      if (iframeSrc) return;
                      const scriptContent = $(el).html() || '';
                      const vidrameSrcMatch = scriptContent.match(/https?:\/\/vidrame\.pro\/[^\s"'<>\]\\]+/i);
                      if (vidrameSrcMatch) {
                        iframeSrc = normalizeUrl(vidrameSrcMatch[0].replace(/\\+/g, ''));
                        console.log(`[HDFilmizle] Found in script tag: ${iframeSrc}`);
                      }
                    });
                  }
                  
                  if (!iframeSrc) {
                    console.log(`[HDFilmizle] No vidrame found. HTML sample (first 2000 chars):`);
                    console.log(html.substring(0, 2000));
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
