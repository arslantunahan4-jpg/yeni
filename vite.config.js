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
          const season = url.searchParams.get('s');
          const episode = url.searchParams.get('e');

          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');

          try {
            let targetUrl = '';
            let iframeSrc = null;

            if (site === 'hdfilmizle') {
              if (season && episode) {
                targetUrl = `https://www.hdfilmizle.life/${slug}-${season}-sezon-${episode}-bolum-izle/`;
              } else {
                targetUrl = `https://www.hdfilmizle.life/${slug}-izle-hd/`;
              }
            } else if (site === 'selcukflix') {
              if (season && episode) {
                targetUrl = `https://selcukflix.net/dizi/${slug}/${season}-sezon-${episode}-bolum`;
              } else {
                targetUrl = `https://selcukflix.net/film/${slug}/izle`;
              }
            }

            if (targetUrl) {
              console.log(`[Scraper] Fetching: ${targetUrl}`);
              
              const response = await axios.get(targetUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                  'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
                  'Referer': site === 'hdfilmizle' ? 'https://www.hdfilmizle.life/' : 'https://selcukflix.net/'
                },
                timeout: 15000
              });

              const $ = cheerio.load(response.data);
              
              $('iframe').each((i, el) => {
                const src = $(el).attr('src') || $(el).attr('data-src');
                if (src && (
                  src.includes('vidrame') || 
                  src.includes('rapid') ||
                  src.includes('player') ||
                  src.includes('embed') ||
                  src.includes('watch') ||
                  src.includes('stream')
                )) {
                  iframeSrc = src.startsWith('//') ? 'https:' + src : src;
                }
              });

              if (!iframeSrc) {
                const scriptContent = $('script').text();
                const iframeMatch = scriptContent.match(/iframe[^>]*src=["']([^"']+)["']/i) ||
                                   scriptContent.match(/playerUrl\s*[:=]\s*["']([^"']+)["']/i) ||
                                   scriptContent.match(/videoUrl\s*[:=]\s*["']([^"']+)["']/i) ||
                                   scriptContent.match(/embedUrl\s*[:=]\s*["']([^"']+)["']/i);
                if (iframeMatch) {
                  iframeSrc = iframeMatch[1].startsWith('//') ? 'https:' + iframeMatch[1] : iframeMatch[1];
                }
              }

              if (iframeSrc) {
                console.log(`[Scraper] Found iframe: ${iframeSrc}`);
                res.end(JSON.stringify({ success: true, url: iframeSrc }));
              } else {
                console.log(`[Scraper] No iframe found for: ${targetUrl}`);
                res.end(JSON.stringify({ success: false, error: 'Iframe bulunamadı', fallbackUrl: targetUrl }));
              }
            } else {
              res.end(JSON.stringify({ success: false, error: 'Geçersiz site parametresi' }));
            }
          } catch (error) {
            console.error(`[Scraper] Error:`, error.message);
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
