import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SmartImage, ORIGINAL_IMG, BACKDROP_IMG, POSTER_IMG } from './Shared';
import { fetchTMDB, isWatched, markAsWatched, saveContinueWatching } from '../hooks/useAppLogic';
import { scrapeHdfilmizle, isNativePlatform } from '../services/nativeHttp';

// --- YENİ EKLENEN: Slug Oluşturucu Yardımcı Fonksiyon ---
// Film ismini botun anlayacağı URL formatına çevirir (Örn: "Hızlı ve Öfkeli" -> "hizli-ve-ofkeli")
const createSlug = (text) => {
    if (!text) return "";
    const trMap = { 'ç': 'c', 'ğ': 'g', 'ş': 's', 'ü': 'u', 'ı': 'i', 'ö': 'o', 'Ç': 'c', 'Ğ': 'g', 'Ş': 's', 'Ü': 'u', 'İ': 'i', 'Ö': 'o' };
    return text.split('').map(char => trMap[char] || char).join('')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Harf rakam dışını sil
        .replace(/\s+/g, '-')         // Boşlukları tire yap
        .replace(/-+/g, '-');         // Çift tireleri düzelt
};

export const DetailModal = ({ movie, onClose, onPlay, onOpenDetail, apiKey }) => {
    const [details, setDetails] = useState(null);
    const [seasons, setSeasons] = useState([]);
    const [episodes, setEpisodes] = useState([]);
    const [selectedSeason, setSelectedSeason] = useState(1);
    const [similar, setSimilar] = useState([]);
    const [trailer, setTrailer] = useState(null);
    const [showTrailer, setShowTrailer] = useState(false);
    const isSeries = movie.media_type === 'tv' || movie.first_air_date;

    const episodesRef = useRef(null);
    const similarRef = useRef(null);

    const handleScroll = (ref, direction) => {
        if (ref.current) {
            const scrollAmount = window.innerWidth * 0.7;
            ref.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    useEffect(() => { 
        setTimeout(() => { 
            document.querySelector('.detail-play-btn')?.focus(); 
        }, 300); 
    }, []);
    
    useEffect(() => {
        const type = isSeries ? 'tv' : 'movie';
        fetchTMDB(`/${type}/${movie.id}?append_to_response=credits,similar,videos`, apiKey).then(d => {
            setDetails(d);
            if (d?.similar?.results) setSimilar(d.similar.results.slice(0, 12));
            if (d?.videos?.results) {
                const t = d.videos.results.find(v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'));
                if (t) setTrailer(t.key);
            }
            if (isSeries && d) setSeasons(Array.from({ length: d.number_of_seasons }, (_, i) => i + 1));
        });
    }, [movie, apiKey, isSeries]);

    useEffect(() => { 
        if (isSeries) {
            fetchTMDB(`/tv/${movie.id}/season/${selectedSeason}`, apiKey).then(d => { 
                if (d) setEpisodes(d.episodes || []); 
            }); 
        }
    }, [selectedSeason, isSeries, movie.id, apiKey]);

    const handlePlayEpisode = useCallback((s, e) => { 
        markAsWatched(movie.id, s, e); 
        setTimeout(() => onPlay(movie, s, e), 50); 
    }, [movie, onPlay]);
    
    const handlePlayMovie = useCallback(() => { 
        markAsWatched(movie.id); 
        onPlay(movie, 1, 1); 
    }, [movie, onPlay]);
    
    return (
        <motion.div 
            className="detail-view-container" 
            initial={{ opacity: 0, y: '100%' }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: '30%' }} 
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
        >
            <div className="detail-hero-wrapper">
                <SmartImage 
                    src={ORIGINAL_IMG + (movie.backdrop_path || movie.poster_path)} 
                    className="detail-hero-img" 
                    alt={movie.title || movie.name} 
                />
            </div>
            
            <div className="detail-content-layer">
                <button 
                    tabIndex="0" 
                    onClick={onClose} 
                    className="focusable detail-back-btn"
                >
                    <i className="fas fa-arrow-left"></i>
                </button>
                
                <div style={{ maxWidth: '1200px' }}>
                    <motion.h1 
                        initial={{ y: 30, opacity: 0 }} 
                        animate={{ y: 0, opacity: 1 }} 
                        transition={{ delay: 0.2, duration: 0.6 }} 
                        style={{
                            fontSize: 'clamp(28px, 6vw, 72px)',
                            fontWeight: '800',
                            marginBottom: '12px',
                            lineHeight: 1.1,
                            letterSpacing: '-0.03em',
                            textShadow: '0 4px 40px rgba(0,0,0,0.8)'
                        }}
                    >
                        {movie.title || movie.name}
                    </motion.h1>
                    
                    <motion.div 
                        initial={{ y: 20, opacity: 0 }} 
                        animate={{ y: 0, opacity: 1 }} 
                        transition={{ delay: 0.3, duration: 0.6 }} 
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '16px',
                            flexWrap: 'wrap'
                        }}
                    >
                        <span style={{
                            fontWeight: '700',
                            fontSize: '16px',
                            color: 'rgba(255,255,255,0.85)'
                        }}>
                            {(movie.release_date || movie.first_air_date || '').split('-')[0]}
                        </span>
                        <span className="meta-tag">{isSeries ? 'DİZİ' : 'FİLM'}</span>
                        <span className="meta-tag" style={{ color: '#30d158' }}>
                            <i className="fas fa-star" style={{ marginRight: '4px', fontSize: '10px' }}></i>
                            {(movie.vote_average || 0).toFixed(1)}
                        </span>
                        {details?.runtime && (
                            <span className="meta-tag">
                                <i className="fas fa-clock" style={{ marginRight: '4px', fontSize: '10px' }}></i>
                                {details.runtime} dk
                            </span>
                        )}
                    </motion.div>
                    
                    <motion.p 
                        initial={{ y: 20, opacity: 0 }} 
                        animate={{ y: 0, opacity: 1 }} 
                        transition={{ delay: 0.4, duration: 0.6 }} 
                        style={{
                            fontSize: 'clamp(14px, 2vw, 20px)',
                            color: 'rgba(255,255,255,0.75)',
                            lineHeight: '1.7',
                            marginBottom: '24px',
                            maxWidth: '800px'
                        }}
                    >
                        {movie.overview}
                    </motion.p>
                    
                    <motion.div 
                        initial={{ y: 20, opacity: 0 }} 
                        animate={{ y: 0, opacity: 1 }} 
                        transition={{ delay: 0.5, duration: 0.6 }}
                        style={{ display: 'flex', gap: '12px', marginBottom: '40px', flexWrap: 'wrap' }}
                    >
                        <button 
                            tabIndex="0" 
                            onClick={handlePlayMovie} 
                            className="focusable detail-play-btn"
                        >
                            <i className="fas fa-play"></i>
                            <span>Oynat</span>
                        </button>
                        {trailer && (
                            <button 
                                tabIndex="0" 
                                onClick={() => setShowTrailer(true)} 
                                className="focusable glass-button"
                            >
                                <i className="fas fa-film"></i>
                                <span>Fragman</span>
                            </button>
                        )}
                    </motion.div>
                    
                    {isSeries && (
                        <div style={{ marginBottom: '32px' }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '16px',
                                marginBottom: '16px',
                                borderBottom: '1px solid rgba(255,255,255,0.1)',
                                paddingBottom: '12px',
                                flexWrap: 'wrap'
                            }}>
                                <h3 style={{ fontSize: '20px', fontWeight: '700' }}>Bölümler</h3>
                                {seasons.length > 0 && (
                                    <select 
                                        value={selectedSeason} 
                                        onChange={(e) => setSelectedSeason(Number(e.target.value))} 
                                        className="focusable season-select"
                                    >
                                        {seasons.map(s => (
                                            <option key={s} value={s}>{s}. Sezon</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                            <div style={{ position: 'relative' }}>
                                <button
                                    className="scroll-btn left"
                                    onClick={() => handleScroll(episodesRef, 'left')}
                                    tabIndex="-1"
                                >
                                    <i className="fas fa-chevron-left"></i>
                                </button>
                                <div ref={episodesRef} className="row-scroll-container" style={{ paddingLeft: 0, marginLeft: '-16px', paddingRight: '16px' }}>
                                    {episodes.map(ep => (
                                        <button
                                            key={ep.id}
                                            tabIndex="0"
                                            onClick={() => handlePlayEpisode(selectedSeason, ep.episode_number)}
                                            className="focusable episode-card"
                                            style={{ padding: 0 }}
                                        >
                                            {isWatched(movie.id, selectedSeason, ep.episode_number) && (
                                                <div className="watched-badge">
                                                    <i className="fas fa-check"></i>
                                                </div>
                                            )}
                                            <div style={{ aspectRatio: '16/9', position: 'relative' }}>
                                                <SmartImage
                                                    src={ep.still_path ? BACKDROP_IMG + ep.still_path : ''}
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                />
                                                <div style={{
                                                    position: 'absolute',
                                                    bottom: '8px',
                                                    left: '8px',
                                                    background: 'rgba(0,0,0,0.75)',
                                                    backdropFilter: 'blur(10px)',
                                                    padding: '4px 8px',
                                                    borderRadius: '6px',
                                                    fontSize: '12px',
                                                    color: 'white',
                                                    fontWeight: '600'
                                                }}>
                                                    {ep.episode_number}. Bölüm
                                                </div>
                                            </div>
                                            <div style={{ padding: '14px', position: 'relative', zIndex: 2 }}>
                                                <div style={{
                                                    fontWeight: '700',
                                                    color: 'white',
                                                    marginBottom: '6px',
                                                    fontSize: '14px'
                                                }}>
                                                    {ep.name}
                                                </div>
                                                <p style={{
                                                    fontSize: '12px',
                                                    color: 'rgba(255,255,255,0.6)',
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden',
                                                    lineHeight: '1.4'
                                                }}>
                                                    {ep.overview || "Özet bulunmuyor."}
                                                </p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                                <button
                                    className="scroll-btn right"
                                    onClick={() => handleScroll(episodesRef, 'right')}
                                    tabIndex="-1"
                                >
                                    <i className="fas fa-chevron-right"></i>
                                </button>
                            </div>
                        </div>
                    )}
                    
                    {similar.length > 0 && (
                        <div style={{ marginBottom: '32px' }}>
                            <h3 style={{ 
                                fontSize: '20px', 
                                fontWeight: '700', 
                                marginBottom: '16px' 
                            }}>
                                Benzerleri
                            </h3>
                            <div style={{ position: 'relative' }}>
                                <button
                                    className="scroll-btn left"
                                    onClick={() => handleScroll(similarRef, 'left')}
                                    tabIndex="-1"
                                >
                                    <i className="fas fa-chevron-left"></i>
                                </button>
                                <div ref={similarRef} className="row-scroll-container" style={{ paddingLeft: 0, marginLeft: '-16px', paddingRight: '16px' }}>
                                    {similar.map(s => s.poster_path && (
                                        <button
                                            key={s.id}
                                            tabIndex="0"
                                            onClick={() => {
                                                const similarItem = {
                                                    ...s,
                                                    media_type: isSeries ? 'tv' : 'movie'
                                                };
                                                onClose();
                                                setTimeout(() => {
                                                    if (onOpenDetail) {
                                                        onOpenDetail(similarItem);
                                                    }
                                                }, 300);
                                            }}
                                            className="focusable poster-card card-portrait"
                                        >
                                            <SmartImage
                                                src={POSTER_IMG + s.poster_path}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                            <div className="card-overlay">
                                                <span className="card-title">{s.title || s.name}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                                <button
                                    className="scroll-btn right"
                                    onClick={() => handleScroll(similarRef, 'right')}
                                    tabIndex="-1"
                                >
                                    <i className="fas fa-chevron-right"></i>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            <AnimatePresence>
                {showTrailer && trailer && (
                    <motion.div 
                        className="trailer-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <button 
                            className="focusable trailer-close" 
                            onClick={() => setShowTrailer(false)}
                        >
                            <i className="fas fa-times"></i>
                        </button>
                        <iframe 
                            src={`https://www.youtube.com/embed/${trailer}?autoplay=1`} 
                            className="trailer-iframe"
                            allowFullScreen
                            title="Trailer"
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export const Player = ({ movie, onClose, initialSeason, initialEpisode }) => {
    const [source, setSource] = useState('hdfilmizle');
    const [showControls, setShowControls] = useState(true);
    const [scrapedUrls, setScrapedUrls] = useState({});
    const [loadingSource, setLoadingSource] = useState(null);
    const [iframeError, setIframeError] = useState(false);
    const controlsTimeout = useRef(null);
    const isSeries = movie.media_type === 'tv' || movie.first_air_date;

    const scrapeIframeUrl = useCallback(async (site) => {
        if (scrapedUrls[site]) return scrapedUrls[site];
        
        setLoadingSource(site);
        const movieTitle = movie.title || movie.name;
        const originalTitle = movie.original_title || movie.original_name || movieTitle;
        const slug = createSlug(movieTitle);
        const year = (movie.release_date || movie.first_air_date || '').split('-')[0];
        
        try {
            console.log(`[Player] Scraping ${site} for: ${movieTitle} (${slug})`);
            
            if (site === 'hdfilmizle' && isNativePlatform()) {
                console.log(`[Player] Using native HTTP for scraping`);
                const result = await scrapeHdfilmizle(
                    movieTitle, 
                    year, 
                    isSeries, 
                    isSeries ? initialSeason : null, 
                    isSeries ? initialEpisode : null
                );
                
                if (result.success && result.iframeUrl) {
                    console.log(`[Player] ✅ Found iframe (native): ${result.iframeUrl}`);
                    setScrapedUrls(prev => ({ ...prev, [site]: result.iframeUrl }));
                    setLoadingSource(null);
                    return result.iframeUrl;
                } else {
                    console.log(`[Player] ❌ No iframe found (native)`, result);
                    setLoadingSource(null);
                    return null;
                }
            }
            
            const params = new URLSearchParams({ site, slug, title: movieTitle, original: originalTitle });
            if (isSeries) {
                params.append('s', initialSeason);
                params.append('e', initialEpisode);
            }
            
            const res = await fetch(`/api/scrape-iframe?${params}`);
            const data = await res.json();
            
            if (data.success && data.url) {
                console.log(`[Player] ✅ Found iframe: ${data.url}`);
                setScrapedUrls(prev => ({ ...prev, [site]: data.url }));
                setLoadingSource(null);
                return data.url;
            } else {
                console.log(`[Player] ❌ No iframe found for ${site}`, data);
                setLoadingSource(null);
                return null;
            }
        } catch (err) {
            console.error(`[Player] Scrape error:`, err);
            setLoadingSource(null);
            return null;
        }
    }, [movie, isSeries, initialSeason, initialEpisode, scrapedUrls]);

    useEffect(() => {
        if (source === 'hdfilmizle' || source === 'yabancidizibox') {
            if (!scrapedUrls[source]) {
                scrapeIframeUrl(source);
            }
        }
    }, [source, scrapeIframeUrl, scrapedUrls]);

    const SOURCES = [
        { id: 'yabancidizibox', name: '🇹🇷 TR Dublaj' },
        { id: 'hdfilmizle', name: '🇹🇷 TR Altyazı' },
        { id: 'multiembed', name: 'MultiEmbed' },
        { id: 'vidsrc.cc', name: 'VidSrc CC' }, 
        { id: 'vsrc.su', name: 'VSrc SU' }, 
        { id: 'vidsrcme.ru', name: 'VidSrc Me' }, 
        { id: 'vidsrc-embed.su', name: 'VidSrc Embed' }
    ];
    
    const getUrl = useCallback(() => {
        if ((source === 'hdfilmizle' || source === 'yabancidizibox') && scrapedUrls[source]) {
            if (isNativePlatform()) {
                return scrapedUrls[source];
            }
            return `/api/video-proxy?url=${encodeURIComponent(scrapedUrls[source])}`;
        }

        if (source === 'multiembed') {
            return isSeries 
                ? `https://multiembed.mov/directstream.php?video_id=${movie.id}&tmdb=1&s=${initialSeason}&e=${initialEpisode}` 
                : `https://multiembed.mov/directstream.php?video_id=${movie.id}&tmdb=1`;
        } else if (source === 'vidsrc.cc') {
            return isSeries 
                ? `https://vidsrc.cc/v2/embed/tv/${movie.id}/${initialSeason}/${initialEpisode}` 
                : `https://vidsrc.cc/v2/embed/movie/${movie.id}`;
        } else if (source === 'vsrc.su') {
            return isSeries 
                ? `https://vsrc.su/embed/tv?tmdb=${movie.id}&season=${initialSeason}&episode=${initialEpisode}` 
                : `https://vsrc.su/embed/movie?tmdb=${movie.id}`;
        }
        return isSeries 
            ? `https://${source}/embed/tv/${movie.id}/${initialSeason}/${initialEpisode}` 
            : `https://${source}/embed/movie/${movie.id}`;
    }, [source, isSeries, movie.id, initialSeason, initialEpisode, scrapedUrls]);

    const getDirectUrl = useCallback(() => {
        if ((source === 'hdfilmizle' || source === 'yabancidizibox') && scrapedUrls[source]) {
            return scrapedUrls[source];
        }
        return null;
    }, [source, scrapedUrls]);

    const openInNewWindow = useCallback(() => {
        const directUrl = getDirectUrl();
        if (directUrl) {
            window.open(directUrl, '_blank', 'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no');
        }
    }, [getDirectUrl]);

    useEffect(() => {
        setIframeError(false);
    }, [source, scrapedUrls]);
    
    const handleActivity = useCallback(() => { 
        setShowControls(true); 
        if (controlsTimeout.current) clearTimeout(controlsTimeout.current); 
        controlsTimeout.current = setTimeout(() => { 
            setShowControls(false); 
            document.getElementById('video-frame')?.focus(); 
        }, 4000); 
    }, []);
    
    useEffect(() => { 
        saveContinueWatching(movie, initialSeason, initialEpisode, 30); 
        handleActivity(); 
        
        const handleKeyDown = (e) => { 
            handleActivity(); 
            if (e.key === 'Backspace' || e.key === 'Escape' || e.keyCode === 10009 || e.keyCode === 461) { 
                e.preventDefault(); 
                onClose(); 
            } 
        }; 
        
        window.addEventListener('keydown', handleKeyDown); 
        window.addEventListener('mousemove', handleActivity); 
        window.addEventListener('touchstart', handleActivity);
        
        return () => { 
            window.removeEventListener('keydown', handleKeyDown); 
            window.removeEventListener('mousemove', handleActivity); 
            window.removeEventListener('touchstart', handleActivity);
            if (controlsTimeout.current) clearTimeout(controlsTimeout.current); 
        }; 
    }, [onClose, handleActivity, movie, initialSeason, initialEpisode]);
    
    useEffect(() => { 
        if (showControls) document.getElementById('player-back')?.focus(); 
    }, [showControls]);
    
    return (
        <div className="player-container">
            <div className={`player-controls ${!showControls ? 'hidden' : ''}`}>
                <div className="player-header">
                    <button 
                        id="player-back" 
                        tabIndex="0" 
                        onClick={onClose} 
                        className="focusable glass-button"
                    >
                        <i className="fas fa-arrow-left"></i>
                        <span>ÇIKIŞ</span>
                    </button>
                    
                    <div className="source-selector">
                        {SOURCES.map(s => (
                            <button 
                                key={s.id} 
                                tabIndex="0" 
                                onClick={() => setSource(s.id)} 
                                className={`focusable source-btn ${source === s.id ? 'active' : ''}`}
                                style={s.id === 'hdfilmizle' ? {
                                    background: 'linear-gradient(135deg, #e91e63 0%, #9c27b0 100%)', 
                                    color: '#fff', 
                                    fontWeight: '700',
                                    boxShadow: '0 0 15px rgba(233, 30, 99, 0.4)'
                                } : s.id === 'yabancidizibox' ? {
                                    background: 'linear-gradient(135deg, #FF512F 0%, #DD2476 100%)',
                                    color: '#fff',
                                    fontWeight: '700',
                                    boxShadow: '0 0 15px rgba(255, 81, 47, 0.4)'
                                } : {}}
                            >
                                {s.name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            
            {loadingSource ? (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    color: 'white'
                }}>
                    <div style={{
                        width: '50px',
                        height: '50px',
                        border: '3px solid rgba(255,255,255,0.2)',
                        borderTop: '3px solid #e91e63',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 16px'
                    }}></div>
                    <p style={{ fontSize: '16px', opacity: 0.8 }}>
                        Türkçe kaynak aranıyor...
                    </p>
                </div>
            ) : getUrl() ? (
                <>
                    <iframe 
                        id="video-frame" 
                        className="focusable" 
                        key={source + (scrapedUrls[source] || '')} 
                        src={getUrl()} 
                        style={{ width: '100%', height: '100%', border: 'none' }} 
                        allowFullScreen 
                        allow="autoplay; encrypted-media" 
                        title="Video Player"
                        onError={() => setIframeError(true)}
                    />
                    {(source === 'hdfilmizle' || source === 'yabancidizibox') && getDirectUrl() && (
                        <div style={{
                            position: 'absolute',
                            bottom: '100px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            zIndex: 1000,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '12px'
                        }}>
                            <p style={{ 
                                fontSize: '14px', 
                                color: 'rgba(255,255,255,0.7)',
                                textAlign: 'center',
                                textShadow: '0 2px 8px rgba(0,0,0,0.8)'
                            }}>
                                Video yüklenmiyor mu?
                            </p>
                            <button
                                onClick={openInNewWindow}
                                className="focusable"
                                style={{
                                    padding: '12px 24px',
                                    background: 'linear-gradient(135deg, #e91e63 0%, #9c27b0 100%)',
                                    border: 'none',
                                    borderRadius: '12px',
                                    color: 'white',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    boxShadow: '0 4px 20px rgba(233, 30, 99, 0.4)'
                                }}
                            >
                                <i className="fas fa-external-link-alt"></i>
                                Yeni Pencerede Aç
                            </button>
                        </div>
                    )}
                </>
            ) : (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    color: 'white'
                }}>
                    <i className="fas fa-exclamation-triangle" style={{ fontSize: '48px', marginBottom: '16px', color: '#ff6b6b' }}></i>
                    <p style={{ fontSize: '16px', opacity: 0.8 }}>Bu kaynak için video bulunamadı</p>
                    <p style={{ fontSize: '14px', opacity: 0.5, marginTop: '8px' }}>Lütfen başka bir kaynak deneyin</p>
                    {(source === 'hdfilmizle' || source === 'yabancidizibox') && getDirectUrl() && (
                        <button
                            onClick={openInNewWindow}
                            className="focusable"
                            style={{
                                marginTop: '20px',
                                padding: '12px 24px',
                                background: 'linear-gradient(135deg, #e91e63 0%, #9c27b0 100%)',
                                border: 'none',
                                borderRadius: '12px',
                                color: 'white',
                                fontSize: '14px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                boxShadow: '0 4px 20px rgba(233, 30, 99, 0.4)'
                            }}
                        >
                            <i className="fas fa-external-link-alt"></i>
                            Yeni Pencerede Aç
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};
