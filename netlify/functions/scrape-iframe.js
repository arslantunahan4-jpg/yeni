const axios = require('axios');
const cheerio = require('cheerio');

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

exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
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

  try {
    let iframeSrc = null;

    if (site === 'hdfilmizle') {
      const isTvSeries = season && episode;
      
      console.log(`[HDFilmizle] Searching for: "${title}" / "${originalTitle}" (slug: ${slug})`);
      
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
          
          const partsMatch = html.match(/let\s+parts\s*=\s*(\[[\s\S]*?\]);/);
          if (partsMatch) {
            try {
              const partsJson = partsMatch[1].replace(/\\"/g, '"').replace(/\\\//g, '/');
              const srcMatch = partsJson.match(/src=\\"([^"\\]+)\\"/);
              if (srcMatch) {
                iframeSrc = srcMatch[1];
                if (!iframeSrc.includes('?')) iframeSrc += '?ap=1';
                else if (!iframeSrc.includes('ap=')) iframeSrc += '&ap=1';
                console.log(`[HDFilmizle] Found in parts: ${iframeSrc}`);
              }
            } catch (e) {
              console.log(`[HDFilmizle] Parts parse error:`, e.message);
            }
          }
          
          if (!iframeSrc) {
            const iframeMatch = html.match(/iframe[^>]*src=["']([^"']+)["']/i);
            if (iframeMatch) {
              let src = iframeMatch[1];
              if (src.startsWith('//')) src = 'https:' + src;
              if (src.includes('vidframe') || src.includes('vidrame') || src.includes('rapid') || src.includes('player') || src.includes('embed')) {
                iframeSrc = src;
                if (!iframeSrc.includes('?')) iframeSrc += '?ap=1';
                else if (!iframeSrc.includes('ap=')) iframeSrc += '&ap=1';
                console.log(`[HDFilmizle] Found iframe via regex: ${iframeSrc}`);
              }
            }
          }
          
          if (!iframeSrc) {
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
          }
          
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
        } catch (e) {
          console.log(`[HDFilmizle] Error fetching content:`, e.message);
        }
      }
    }

    if (iframeSrc) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true, url: iframeSrc })
      };
    } else {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: false, error: 'Iframe bulunamadı' })
      };
    }
  } catch (error) {
    console.error('[Scraper] Error:', error.message);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
