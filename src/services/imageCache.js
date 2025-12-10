const imageCache = new Map();
const loadingPromises = new Map();
const MAX_CACHE_SIZE = 500;

export const ImageCache = {
    preload: (url) => {
        if (!url || imageCache.has(url)) return Promise.resolve(imageCache.get(url));
        
        if (loadingPromises.has(url)) {
            return loadingPromises.get(url);
        }
        
        const promise = new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                if (imageCache.size >= MAX_CACHE_SIZE) {
                    const firstKey = imageCache.keys().next().value;
                    imageCache.delete(firstKey);
                }
                imageCache.set(url, img);
                loadingPromises.delete(url);
                resolve(img);
            };
            img.onerror = () => {
                loadingPromises.delete(url);
                reject(new Error('Failed to load image'));
            };
            img.src = url;
        });
        
        loadingPromises.set(url, promise);
        return promise;
    },
    
    get: (url) => imageCache.get(url),
    
    has: (url) => imageCache.has(url),
    
    preloadBatch: async (urls) => {
        const uniqueUrls = [...new Set(urls.filter(url => url && !imageCache.has(url)))];
        await Promise.allSettled(uniqueUrls.map(url => ImageCache.preload(url)));
    },
    
    preloadAround: async (items, currentIndex, range = 5, imageExtractor) => {
        if (!items || items.length === 0) return;
        
        const start = Math.max(0, currentIndex - range);
        const end = Math.min(items.length, currentIndex + range + 1);
        
        const urls = [];
        for (let i = start; i < end; i++) {
            const url = imageExtractor(items[i]);
            if (url) urls.push(url);
        }
        
        await ImageCache.preloadBatch(urls);
    },
    
    getCacheStats: () => ({
        size: imageCache.size,
        maxSize: MAX_CACHE_SIZE,
        loading: loadingPromises.size
    }),
    
    clear: () => {
        imageCache.clear();
        loadingPromises.clear();
    }
};

export default ImageCache;
