import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import axios from "axios";
import * as cheerio from "cheerio";

function scraperPlugin() {
  return {
    name: 'scraper-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
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
              const urlVariations = [
                `https://www.hdfilmizle.life/${slug}-izle-hd/`,
                `https://www.hdfilmizle.life/${slug}-izle/`,
                `https://www.hdfilmizle.life/${slug}-hd-izle/`,
                `https://www.hdfilmizle.life/${slug}-full-izle/`,
                `https://www.hdfilmizle.life/${slug}-turkce-dublaj-izle/`,
                `https://www.hdfilmizle.life/${slug}/`
              ];
              
              for (const tryUrl of urlVariations) {
                try {
                  console.log(`[HDFilmizle] Trying: ${tryUrl}`);
                  const response = await axios.get(tryUrl, { 
                    headers: { ...headers, Referer: 'https://www.hdfilmizle.life/' },
                    timeout: 10000,
                    validateStatus: (status) => status < 500
                  });
                  
                  if (response.status === 200 && response.data.includes('iframe')) {
                    moviePageUrl = tryUrl;
                    const html = response.data;
                    
                    const partsMatch = html.match(/let\s+parts\s*=\s*(\[[\s\S]*?\]);/);
                    if (partsMatch) {
                      try {
                        const partsJson = partsMatch[1]
                          .replace(/\\"/g, '"')
                          .replace(/\\\//g, '/');
                        const srcMatch = partsJson.match(/src=\\"([^"\\]+)\\"/);
                        if (srcMatch) {
                          iframeSrc = srcMatch[1] + '?ap=1';
                          console.log(`[HDFilmizle] Found in parts: ${iframeSrc}`);
                          break;
                        }
                      } catch (e) {
                        console.log(`[HDFilmizle] Parts parse error:`, e.message);
                      }
                    }
                    
                    const $ = cheerio.load(html);
                    $('iframe').each((i, el) => {
                      const src = $(el).attr('data-src') || $(el).attr('src');
                      if (src && (src.includes('vidrame') || src.includes('rapid') || src.includes('player'))) {
                        iframeSrc = src.startsWith('//') ? 'https:' + src : src;
                        if (!iframeSrc.includes('?ap=')) iframeSrc += '?ap=1';
                        console.log(`[HDFilmizle] Found iframe: ${iframeSrc}`);
                      }
                    });
                    
                    if (iframeSrc) break;
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
