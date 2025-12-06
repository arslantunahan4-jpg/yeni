const axios = require('axios');
const cheerio = require('cheerio');

// Helper for slugs
const createSlug = (text) => {
    if (!text) return "";
    const trMap = { 'ç': 'c', 'ğ': 'g', 'ş': 's', 'ü': 'u', 'ı': 'i', 'ö': 'o', 'Ç': 'c', 'Ğ': 'g', 'Ş': 's', 'Ü': 'u', 'İ': 'i', 'Ö': 'o' };
    return text.split('').map(char => trMap[char] || char).join('')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
};

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
  const site = params.site;
  const slug = params.slug;
  const title = params.title || slug;
  const originalTitle = params.original || title;
  const season = params.s;
  const episode = params.e;

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
                    const vidmodyMatch = html.match(/https?:\/\/(?:player\.)?(?:vidmody\.com|vidmoly\.to)\/[a-zA-Z0-9_]+/);
                    if (vidmodyMatch) {
                        iframeSrc = normalizeUrl(vidmodyMatch[0]);
                        console.log(`[YabanciDiziBox] Found vidmody url: ${iframeSrc}`);
                    }

                    if (!iframeSrc) {
                        const match = html.match(/(?:source|src|file|video_url|url)["']?\s*:\s*["']([^"']+)["']/i);
                        if (match && (match[1].includes('vidmody') || match[1].includes('vidmoly') || match[1].includes('embed'))) {
                            iframeSrc = normalizeUrl(match[1]);
                            console.log(`[YabanciDiziBox] Found source in script: ${iframeSrc}`);
                        }
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
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, url: iframeSrc, moviePage: moviePageUrl })
      };
    } else {
      console.log(`[Scraper] No iframe found for ${site}/${slug}`);
      return {
        statusCode: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Iframe bulunamadı', moviePage: moviePageUrl })
      };
    }
  } catch (error) {
    console.error(`[Scraper] Error for ${site}:`, error.message);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
