import express from 'express';
import cors from 'cors';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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

const normalizeUrl = (src) => {
  if (!src) return null;
  let url = src.trim();
  if (url.startsWith('//')) url = 'https:' + url;
  if (!url.startsWith('http')) return null;
  if (!url.includes('?')) url += '?ap=1';
  else if (!url.includes('ap=')) url += '&ap=1';
  return url;
};

const searchWithQuery = async (query) => {
  const searchUrl = `https://www.hdfilmizle.life/?s=${encodeURIComponent(query)}`;
  console.log(`[HDFilmizle] Searching: ${searchUrl}`);
  
  try {
    const searchResponse = await axios.get(searchUrl, {
      headers: { ...headers, Referer: 'https://www.hdfilmizle.life/' },
      timeout: 15000,
      validateStatus: (status) => status < 500
    });
    
    // Accept 404 if it contains content (hdfilmizle sometimes returns 404 for search pages)
    if (searchResponse.status === 200 || searchResponse.status === 404) {
      const html = searchResponse.data;
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

      console.log(`[HDFilmizle] Found ${results.length} results.`);
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

app.get('/api/scrape-iframe', async (req, res) => {
  const { site, slug, title: titleParam, original, s: season, e: episode } = req.query;
  const title = titleParam || slug;
  const originalTitle = original || title;

  try {
    let iframeSrc = null;
    let moviePageUrl = null;

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
        // console.log(`[HDFilmizle] Found ${results.length} results for "${term}"`);
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
            if ((resp.status === 200 || resp.status === 404) && (resp.data.includes('iframe') || resp.data.includes('player'))) {
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
              
              if (epResponse.status === 200 || epResponse.status === 404) {
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
            timeout: 15000,
            validateStatus: (status) => status < 500
          });
          
          const html = response.data;
          moviePageUrl = contentUrl;
          
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
      res.json({ success: true, url: iframeSrc, moviePage: moviePageUrl });
    } else {
      console.log(`[Scraper] No iframe found for ${site}/${slug}`);
      res.json({ success: false, error: 'Iframe bulunamadı', moviePage: moviePageUrl });
    }
  } catch (error) {
    console.error('[Scraper] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/video-proxy', async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ error: 'URL gerekli' });
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

    // Forward range header if present
    if (req.headers.range) {
        proxyHeaders['Range'] = req.headers.range;
    }

    console.log(`[VideoProxy] Fetching: ${targetUrl}`);

    const response = await axios.get(targetUrl, {
      headers: proxyHeaders,
      timeout: 30000,
      responseType: 'arraybuffer',
      maxRedirects: 5,
      validateStatus: () => true
    });

    const contentType = response.headers['content-type'] || 'text/html';
    console.log(`[VideoProxy] Response Content-Type: ${contentType}, Status: ${response.status}`);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');
    res.status(response.status);
    
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
      res.send(html);
    } else {
      res.setHeader('Content-Type', contentType);
      if (response.headers['content-length']) {
        res.setHeader('Content-Length', response.headers['content-length']);
      }
      if (response.headers['content-range']) {
        res.setHeader('Content-Range', response.headers['content-range']);
      }
      if (response.headers['accept-ranges']) {
        res.setHeader('Accept-Ranges', response.headers['accept-ranges']);
      }

      res.send(response.data);
    }
  } catch (error) {
    console.error('[VideoProxy] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.use(express.static(join(__dirname, 'dist'), {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache');
  }
}));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
