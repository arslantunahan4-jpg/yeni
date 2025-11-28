import React, { memo, useState } from 'react';
import { isWatched } from '../hooks/useAppLogic';

export const BASE_IMG = "https://image.tmdb.org/t/p/w500";
export const POSTER_IMG = "https://image.tmdb.org/t/p/w780";
export const BACKDROP_IMG = "https://image.tmdb.org/t/p/w1280";
export const ORIGINAL_IMG = "https://image.tmdb.org/t/p/original";

export const SmartImage = memo(({ src, alt, style, className }) => {
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);
    
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
                src={src} 
                alt={alt} 
                onLoad={() => setLoaded(true)} 
                onError={() => setError(true)}
                style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'cover', 
                    opacity: loaded ? 1 : 0, 
                    transition: 'opacity 0.5s ease-out, transform 0.5s ease-out', 
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

export const NavBar = memo(({ activeTab, onTabChange }) => (
    <nav className="navbar-container">
        <div className="nav-logo">
            <i className="fab fa-apple"></i>
            <span>tv+</span>
        </div>
        
        <div className="nav-menu">
            {NAV_ITEMS.map(item => (
                <button 
                    key={item.id} 
                    tabIndex="0" 
                    onClick={() => onTabChange(item.id)} 
                    className={`focusable nav-btn ${activeTab === item.id ? 'btn-active' : ''}`}
                >
                    {item.label}
                </button>
            ))}
        </div>
        
        <div className="nav-profile"></div>
    </nav>
));

export const MobileNav = memo(({ activeTab, onTabChange }) => (
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
    </nav>
));

export const Card = memo(({ movie, onSelect, layout = 'portrait', progress = 0 }) => {
    const isLandscape = layout === 'landscape';
    const imgPath = isLandscape 
        ? (movie.backdrop_path || movie.poster_path) 
        : (movie.poster_path || movie.backdrop_path);
    const watched = isWatched(movie.id, movie.season, movie.episode);
    const hasValidImage = imgPath && imgPath !== 'null' && imgPath !== 'undefined';
    
    return (
        <button 
            tabIndex="0" 
            onClick={() => onSelect(movie)} 
            className={`poster-card focusable ${isLandscape ? 'card-landscape' : 'card-portrait'}`}
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
            {hasValidImage ? (
                <SmartImage 
                    src={isLandscape ? BACKDROP_IMG + imgPath : POSTER_IMG + imgPath} 
                    alt={movie.title || movie.name} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
            ) : (
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
            <div className="card-overlay">
                <span className="card-title">{movie.title || movie.name}</span>
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
