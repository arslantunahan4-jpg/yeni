import React, { memo, useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { isWatched, fetchTMDB } from '../hooks/useAppLogic';
import { ImageCache } from '../services/imageCache';

export const BASE_IMG = "https://image.tmdb.org/t/p/w500";
export const POSTER_IMG = "https://image.tmdb.org/t/p/w780";
export const BACKDROP_IMG = "https://image.tmdb.org/t/p/w1280";
export const ORIGINAL_IMG = "https://image.tmdb.org/t/p/original";

const TRAILER_DELAY = 4000;

export const SmartImage = memo(({ src, alt, style, className }) => {
    const cachedImage = ImageCache.get(src);
    const [loaded, setLoaded] = useState(() => !!cachedImage);
    const [error, setError] = useState(false);
    const imgSrc = cachedImage ? cachedImage.src : src;
    
    useEffect(() => {
        if (src && !loaded && !error) {
            const cached = ImageCache.get(src);
            if (cached) {
                setLoaded(true);
            } else {
                ImageCache.preload(src)
                    .then(() => setLoaded(true))
                    .catch(() => setError(true));
            }
        }
    }, [src, loaded, error]);
    
    return (
        <div className={className} style={{ 
            ...style, 
            position: 'relative', 
            backgroundColor: '#0a0a0a', 
            overflow: 'hidden' 
        }}>
            {!loaded && !error && (
                <div className="skeleton" style={{ position: 'absolute', inset: 0 }} />
            )}
            {error && (
                <div style={{
                    position: 'absolute', 
                    inset: 0, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    color: 'rgba(255,255,255,0.3)',
                    fontSize: '2rem'
                }}>
                    <i className="fas fa-film"></i>
                </div>
            )}
            <img 
                src={imgSrc} 
                alt={alt} 
                onLoad={() => setLoaded(true)} 
                onError={() => setError(true)}
                style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'cover', 
                    opacity: loaded ? 1 : 0, 
                    transition: loaded && cachedImage ? 'none' : 'opacity 0.5s ease-out, transform 0.5s ease-out', 
                    transform: loaded ? 'scale(1)' : 'scale(1.03)' 
                }} 
            />
        </div>
    );
});

const NAV_ITEMS = [
    { id: 'Ana Sayfa', icon: 'fas fa-home', label: 'Ana Sayfa' },
    { id: 'Filmler', icon: 'fas fa-film', label: 'Filmler' },
    { id: 'Diziler', icon: 'fas fa-tv', label: 'Diziler' },
    { id: 'Ara', icon: 'fas fa-search', label: 'Ara' }
];

export const NavBar = memo(({ activeTab, onTabChange, onLogout }) => {
    const menuRef = useRef(null);
    const buttonsRef = useRef({});
    const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0, opacity: 0 });
    const [hoveredTab, setHoveredTab] = useState(null);

    useLayoutEffect(() => {
        const updateIndicator = (tabId) => {
            const button = buttonsRef.current[tabId];
            const menu = menuRef.current;
            if (button && menu) {
                const menuRect = menu.getBoundingClientRect();
                const buttonRect = button.getBoundingClientRect();
                setIndicatorStyle({
                    left: buttonRect.left - menuRect.left,
                    width: buttonRect.width,
                    opacity: 1
                });
            }
        };
        
        const targetTab = hoveredTab || activeTab;
        updateIndicator(targetTab);
    }, [activeTab, hoveredTab]);

    const getButtonScale = (itemId) => {
        const targetTab = hoveredTab || activeTab;
        if (itemId === targetTab) return 1.02;
        
        const targetIndex = NAV_ITEMS.findIndex(i => i.id === targetTab);
        const currentIndex = NAV_ITEMS.findIndex(i => i.id === itemId);
        const distance = Math.abs(targetIndex - currentIndex);
        
        if (distance === 1) return 0.97;
        return 0.94;
    };

    const getButtonOpacity = (itemId) => {
        const targetTab = hoveredTab || activeTab;
        if (itemId === targetTab) return 1;
        
        const targetIndex = NAV_ITEMS.findIndex(i => i.id === targetTab);
        const currentIndex = NAV_ITEMS.findIndex(i => i.id === itemId);
        const distance = Math.abs(targetIndex - currentIndex);
        
        if (distance === 1) return 0.7;
        return 0.5;
    };

    return (
        <nav className="navbar-container">
            <div className="nav-logo">
                <img src="/noxis-logo.svg" alt="Noxis" style={{ height: '28px', width: 'auto' }} />
            </div>
            
            <div className="nav-menu" ref={menuRef}>
                <div 
                    className="nav-indicator"
                    style={{
                        position: 'absolute',
                        top: '4px',
                        bottom: '4px',
                        left: indicatorStyle.left,
                        width: indicatorStyle.width,
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.12) 100%)',
                        borderRadius: '18px',
                        border: '1px solid rgba(255,255,255,0.30)',
                        boxShadow: '0 0 20px rgba(255,255,255,0.12), inset 0 1px 0 rgba(255,255,255,0.25)',
                        transition: 'left 0.35s cubic-bezier(0.4, 0, 0.2, 1), width 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease',
                        opacity: indicatorStyle.opacity,
                        pointerEvents: 'none',
                        zIndex: 0,
                        overflow: 'hidden'
                    }}
                >
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '45%',
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.30) 0%, transparent 100%)',
                        borderRadius: '18px 18px 50% 50%',
                        pointerEvents: 'none'
                    }} />
                </div>
                
                {NAV_ITEMS.map(item => (
                    <button 
                        key={item.id}
                        ref={el => buttonsRef.current[item.id] = el}
                        tabIndex="0" 
                        onClick={() => onTabChange(item.id)}
                        onMouseEnter={() => setHoveredTab(item.id)}
                        onMouseLeave={() => setHoveredTab(null)}
                        className="focusable nav-btn"
                        style={{
                            transform: `scale(${getButtonScale(item.id)})`,
                            opacity: getButtonOpacity(item.id),
                            color: (hoveredTab === item.id || activeTab === item.id) ? 'white' : 'rgba(255,255,255,0.65)',
                            fontWeight: (hoveredTab === item.id || activeTab === item.id) ? 700 : 600,
                            zIndex: 1
                        }}
                    >
                        {item.label}
                    </button>
                ))}
            </div>
            
            <div className="nav-profile">
                {onLogout && (
                    <button 
                        tabIndex="0"
                        onClick={onLogout}
                        className="focusable nav-logout-btn"
                        title="Çıkış Yap"
                    >
                        <i className="fas fa-power-off"></i>
                    </button>
                )}
            </div>
        </nav>
    );
});

export const MobileNav = memo(({ activeTab, onTabChange, onLogout }) => (
    <nav className="mobile-nav">
        {NAV_ITEMS.map(item => (
            <button 
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`mobile-nav-btn ${activeTab === item.id ? 'active' : ''}`}
            >
                <i className={item.icon}></i>
                <span>{item.label}</span>
            </button>
        ))}
        {onLogout && (
            <button 
                onClick={onLogout}
                className="mobile-nav-btn mobile-logout-btn"
                title="Çıkış Yap"
            >
                <i className="fas fa-power-off"></i>
                <span>Çıkış</span>
            </button>
        )}
    </nav>
));

export const Card = memo(({ movie, onSelect, layout = 'portrait', progress = 0 }) => {
    const isLandscape = layout === 'landscape';
    const [isExpanded, setIsExpanded] = useState(false);
    const [trailerKey, setTrailerKey] = useState(null);
    const [showTrailer, setShowTrailer] = useState(false);
    const [backdropLoaded, setBackdropLoaded] = useState(false);
    
    const cardRef = useRef(null);
    const hoverTimerRef = useRef(null);
    const trailerTimerRef = useRef(null);
    const debounceRef = useRef(null);
    
    const posterPath = movie.poster_path || movie.backdrop_path;
    const backdropPath = movie.backdrop_path || movie.poster_path;
    const watched = isWatched(movie.id, movie.season, movie.episode);
    const hasValidPoster = posterPath && posterPath !== 'null' && posterPath !== 'undefined';
    const hasValidBackdrop = backdropPath && backdropPath !== 'null' && backdropPath !== 'undefined';
    
    const fetchTrailer = useCallback(async () => {
        if (trailerKey) return;
        const apiKey = localStorage.getItem('tmdb_api_key_v3');
        if (!apiKey) return;
        
        const mediaType = movie.first_air_date ? 'tv' : 'movie';
        const videos = await fetchTMDB(`/${mediaType}/${movie.id}/videos`, apiKey);
        
        if (videos?.results) {
            const trailer = videos.results.find(v => 
                v.type === 'Trailer' && v.site === 'YouTube'
            ) || videos.results.find(v => 
                v.site === 'YouTube'
            );
            if (trailer) {
                setTrailerKey(trailer.key);
            }
        }
    }, [movie.id, movie.first_air_date, trailerKey]);
    
    const handleExpand = useCallback(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        
        debounceRef.current = setTimeout(() => {
            setIsExpanded(true);
            fetchTrailer();
            
            if (trailerTimerRef.current) clearTimeout(trailerTimerRef.current);
            trailerTimerRef.current = setTimeout(() => {
                setShowTrailer(true);
            }, TRAILER_DELAY);
        }, 50);
    }, [fetchTrailer]);
    
    const handleCollapse = useCallback(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        if (trailerTimerRef.current) clearTimeout(trailerTimerRef.current);
        
        setIsExpanded(false);
        setShowTrailer(false);
    }, []);
    
    useEffect(() => {
        return () => {
            if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
            if (trailerTimerRef.current) clearTimeout(trailerTimerRef.current);
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, []);
    
    useEffect(() => {
        if (isExpanded && hasValidBackdrop) {
            const img = new Image();
            img.onload = () => setBackdropLoaded(true);
            img.src = BACKDROP_IMG + backdropPath;
        } else if (!isExpanded) {
            setBackdropLoaded(false);
        }
    }, [isExpanded, hasValidBackdrop, backdropPath]);
    
    const cardClassName = `poster-card focusable ${isLandscape ? 'card-landscape' : 'card-portrait'} ${isExpanded ? 'poster-card-expanded' : ''}`;
    
    return (
        <button 
            ref={cardRef}
            tabIndex="0" 
            onClick={() => onSelect(movie)} 
            onFocus={handleExpand}
            onBlur={handleCollapse}
            onMouseEnter={handleExpand}
            onMouseLeave={handleCollapse}
            className={cardClassName}
        >
            {watched && (
                <div className="watched-badge">
                    <i className="fas fa-check"></i>
                    <span>İzlendi</span>
                </div>
            )}
            {progress > 0 && !watched && (
                <div className="continue-progress">
                    <div className="continue-progress-bar" style={{ width: `${progress}%` }}></div>
                </div>
            )}
            
            <div className="card-image-container">
                {hasValidPoster && (
                    <SmartImage 
                        src={isLandscape ? BACKDROP_IMG + backdropPath : POSTER_IMG + posterPath} 
                        alt={movie.title || movie.name} 
                        className={`card-poster-image ${isExpanded && backdropLoaded ? 'card-image-hidden' : ''}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />
                )}
                
                {isExpanded && hasValidBackdrop && (
                    <div className={`card-backdrop-image ${backdropLoaded ? 'card-image-visible' : ''}`}>
                        <img 
                            src={BACKDROP_IMG + backdropPath}
                            alt={movie.title || movie.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    </div>
                )}
                
                {!hasValidPoster && !hasValidBackdrop && (
                    <div style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'linear-gradient(135deg, #1c1c1e 0%, #2c2c2e 100%)',
                        color: 'rgba(255,255,255,0.3)',
                        fontSize: '2.5rem'
                    }}>
                        <i className="fas fa-film"></i>
                    </div>
                )}
            </div>
            
            {showTrailer && trailerKey && isExpanded && (
                <div className="card-trailer-container">
                    <iframe
                        src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=0&controls=0&modestbranding=1&rel=0&showinfo=0&loop=1&playlist=${trailerKey}`}
                        title="Trailer"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="card-trailer-iframe"
                    />
                    <div className="card-trailer-overlay" />
                </div>
            )}
            
            <div className="card-overlay">
                <div className="card-info-expanded">
                    <span className="card-title">{movie.title || movie.name}</span>
                    {isExpanded && (
                        <div className="card-meta-expanded">
                            {movie.vote_average > 0 && (
                                <span className="card-rating">
                                    <i className="fas fa-star"></i> {movie.vote_average.toFixed(1)}
                                </span>
                            )}
                            {(movie.release_date || movie.first_air_date) && (
                                <span className="card-year">
                                    {new Date(movie.release_date || movie.first_air_date).getFullYear()}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </button>
    );
});

export const SkeletonRow = () => (
    <div className="row-wrapper" style={{ marginBottom: '3rem' }}>
        <div 
            className="skeleton" 
            style={{ 
                width: '18rem', 
                height: '1.8rem', 
                marginBottom: '1.2rem', 
                borderRadius: '8px' 
            }}
        />
        <div className="row-scroll-container" style={{ overflow: 'hidden' }}>
            {[1, 2, 3, 4, 5, 6].map(i => (
                <div 
                    key={i} 
                    className="skeleton card-portrait" 
                    style={{ flexShrink: 0 }}
                />
            ))}
        </div>
    </div>
);
