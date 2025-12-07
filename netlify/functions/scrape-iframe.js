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

  // Reduced headers to minimize blocking risk, but kept essential ones
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  };

  console.log(`[Scraper] Request: site=${site}, title=${title}, slug=${slug}`);

  try {
    let iframeSrc = null;
    let moviePageUrl = null;

    if (site === 'yabancidizibox') {
        console.log(`[YabanciDiziBox] Searching for: "${title}"`);

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
      
      console.log(`[HDFilmizle] Searching for: "${title}" (slug: ${slug})`);

      const normalizeTitle = (t) => t.toLowerCase()
        .replace(/[çÇ]/g, 'c').replace(/[ğĞ]/g, 'g').replace(/[şŞ]/g, 's')
        .replace(/[üÜ]/g, 'u').replace(/[ıİ]/g, 'i').replace(/[öÖ]/g, 'o')
        .replace(/[^a-z0-9]/g, '');

      const searchWithQuery = async (query) => {
        const searchUrl = 'https://www.hdfilmizle.life/search/';
        console.log(`[HDFilmizle] POST Search: ${query}`);

        try {
          // Use POST /search/ with x-www-form-urlencoded
          const params = new URLSearchParams();
          params.append('query', query);

          const searchResponse = await axios.post(searchUrl, params.toString(), {
            headers: {
              ...headers,
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
              'Referer': 'https://www.hdfilmizle.life/',
              'Origin': 'https://www.hdfilmizle.life',
              'X-Requested-With': 'XMLHttpRequest'
            },
            timeout: 10000,
            validateStatus: (status) => true // Accept all to debug
          });

          if (searchResponse.status === 200 && Array.isArray(searchResponse.data)) {
            const data = searchResponse.data;
            const results = data.map(item => {
                return {
                    link: `https://www.hdfilmizle.life/${item.slug}`,
                    title: item.name,
                    year: item.year
                };
            });

            console.log(`[HDFilmizle] Found ${results.length} results via POST search.`);
            return results;
          } else {
             console.log(`[HDFilmizle] POST Search failed. Status: ${searchResponse.status}. Data type: ${typeof searchResponse.data}`);
          }
        } catch (e) {
          console.log(`[HDFilmizle] Search error for "${query}":`, e.message);
        }
        return [];
      };

      let allResults = [];
      const searchTerms = [title];
      if (originalTitle && originalTitle !== title) {
        searchTerms.push(originalTitle);
      }
      
      for (const term of searchTerms) {
        const results = await searchWithQuery(term);
        allResults = [...allResults, ...results];
        if (results.length > 0) break; // Stop if we found something
      }
      
      // Filter duplicates
      const uniqueResults = allResults.filter((r, i, arr) => 
        arr.findIndex(x => x.link === r.link) === i
      );
      
      // Find best match
      let contentUrl = null;
      if (uniqueResults.length > 0) {
          // Simple fuzzy match
          const normalizedTarget = normalizeTitle(title);
          const match = uniqueResults.find(r => normalizeTitle(r.title).includes(normalizedTarget));
          if (match) {
              contentUrl = match.link;
              console.log(`[HDFilmizle] Best match found: ${contentUrl}`);
          } else {
              contentUrl = uniqueResults[0].link;
              console.log(`[HDFilmizle] No exact match, using first result: ${contentUrl}`);
          }
      }

      // Fallback: Direct URL guess
      if (!contentUrl) {
        console.log(`[HDFilmizle] No search results. Trying direct URL guessing.`);
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
            console.log(`[HDFilmizle] Trying direct URL: ${tryUrl}`);
            const resp = await axios.get(tryUrl, {
              headers: { ...headers, Referer: 'https://www.hdfilmizle.life/' },
              timeout: 5000,
              validateStatus: (status) => status < 500
            });
            if (resp.status === 200) {
              contentUrl = tryUrl;
              console.log(`[HDFilmizle] Direct URL valid: ${contentUrl}`);
              break;
            } else {
              console.log(`[HDFilmizle] Direct URL failed: ${tryUrl} (Status: ${resp.status})`);
            }
          } catch (e) {
            console.log(`[HDFilmizle] Direct URL error: ${tryUrl} (${e.message})`);
          }
        }
      }
      
      if (contentUrl) {
        // Handle TV Series Episodes
        if (isTvSeries) {
          // Try to construct episode URL from the series URL
          // Format usually: .../dizi/slug/sezon-X/bolum-Y/
          const baseSlug = contentUrl.replace('https://www.hdfilmizle.life/', '').replace('dizi/', '').replace(/\/$/, '');
          const episodeVariations = [
            `${contentUrl.replace(/\/$/, '')}/sezon-${season}/bolum-${episode}/`,
            `https://www.hdfilmizle.life/dizi/${baseSlug}/sezon-${season}/bolum-${episode}/`
          ];
          
          let episodeUrlFound = null;
          for (const epUrl of episodeVariations) {
            try {
              console.log(`[HDFilmizle] Checking episode URL: ${epUrl}`);
              const epResponse = await axios.head(epUrl, {
                 headers: { ...headers, Referer: contentUrl },
                 timeout: 5000,
                 validateStatus: (status) => status < 400
              });
              if (epResponse.status === 200) {
                  episodeUrlFound = epUrl;
                  break;
              }
            } catch (e) {}
          }
          if (episodeUrlFound) contentUrl = episodeUrlFound;
          else console.log(`[HDFilmizle] Could not verify episode URL, using base: ${contentUrl}`);
        }
        
        console.log(`[HDFilmizle] Fetching movie page: ${contentUrl}`);
        
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

          // Regex to find iframes/players
          const vidramaMatch = html.match(/https?:\/\/vidrame\.pro\/[^\s"'<>\]\\]+/i);
          if (vidramaMatch) {
            iframeSrc = normalizeUrl(vidramaMatch[0].replace(/\\+/g, ''));
            console.log(`[HDFilmizle] Found vidrame.pro: ${iframeSrc}`);
          }
          
          if (!iframeSrc) {
            const $ = cheerio.load(html);
            $('iframe').each((i, el) => {
              if (iframeSrc) return;
              const src = $(el).attr('data-src') || $(el).attr('src');
              if (src && (src.includes('vidrame') || src.includes('vidframe') || src.includes('player'))) {
                iframeSrc = normalizeUrl(src);
                console.log(`[HDFilmizle] Found iframe: ${iframeSrc}`);
              }
            });
          }
          
        } catch (e) {
          console.log(`[HDFilmizle] Error fetching content page:`, e.message);
        }
      } else {
          console.log(`[HDFilmizle] Failed to find any content URL.`);
      }

    } else if (site === 'selcukflix') {
        // ... (selcukflix implementation kept as is or minimal if not used)
    }

    if (iframeSrc) {
      console.log(`[Scraper] Success! URL: ${iframeSrc}`);
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, url: iframeSrc, moviePage: moviePageUrl })
      };
    } else {
      console.log(`[Scraper] No iframe found.`);
      return {
        statusCode: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Iframe bulunamadı', moviePage: moviePageUrl })
      };
    }
  } catch (error) {
    console.error(`[Scraper] Fatal Error:`, error.message);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
