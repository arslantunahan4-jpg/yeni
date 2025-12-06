import React, { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SmartImage, ORIGINAL_IMG, Card, SkeletonRow } from './Shared';

export const HeroCarousel = memo(({ movies, onPlay, onDetails }) => {
    const [index, setIndex] = useState(0);
    
    useEffect(() => {
        if (!movies?.length) return;
        const timer = setInterval(() => setIndex(p => (p + 1) % movies.length), 7000);
        return () => clearInterval(timer);
    }, [movies]);

    if (!movies?.length) {
        return (
            <div 
                className="hero-section skeleton" 
                style={{ margin: '0', borderRadius: '0' }}
            />
        );
    }
    
    const movie = movies[index];

    return (
        <div className="hero-section">
            <AnimatePresence mode="wait">
                <motion.div 
                    key={movie.id} 
                    initial={{ opacity: 0, scale: 1.05 }} 
                    animate={{ opacity: 1, scale: 1 }} 
                    exit={{ opacity: 0 }} 
                    transition={{ duration: 1.2, ease: "easeOut" }} 
                    style={{ position: 'absolute', inset: 0 }}
                >
                    <SmartImage 
                        src={ORIGINAL_IMG + (movie.backdrop_path || movie.poster_path)} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />
                    <div className="hero-gradient"></div>
                    <div className="hero-gradient-side"></div>
                </motion.div>
            </AnimatePresence>
            
            <div className="hero-content">
                <motion.div 
                    key={`content-${movie.id}`} 
                    initial={{ opacity: 0, y: 40 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
                >
                    <h1 className="hero-title">{movie.title || movie.name}</h1>
                    <p className="hero-overview">{movie.overview}</p>
                    <div className="hero-buttons">
                        <button 
                            tabIndex="0" 
                            onClick={() => onPlay(movie)} 
                            className="focusable hero-button"
                        >
                            <i className="fas fa-play"></i>
                            <span>Oynat</span>
                        </button>
                        <button 
                            tabIndex="0" 
                            onClick={() => onDetails(movie)} 
                            className="focusable hero-button secondary"
                        >
                            <i className="fas fa-info-circle"></i>
                            <span>Daha Fazla</span>
                        </button>
                    </div>
                </motion.div>
            </div>
            
            <div style={{
                position: 'absolute',
                bottom: '2rem',
                right: '3vw',
                display: 'flex',
                gap: '0.5rem',
                zIndex: 30
            }}>
                {movies.map((_, i) => (
                    <button
                        key={i}
                        onClick={() => setIndex(i)}
                        style={{
                            width: i === index ? '2rem' : '0.5rem',
                            height: '0.5rem',
                            borderRadius: '4px',
                            background: i === index 
                                ? 'rgba(255, 255, 255, 0.9)' 
                                : 'rgba(255, 255, 255, 0.3)',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.4s ease'
                        }}
                    />
                ))}
            </div>
        </div>
    );
});

export const Row = memo(({ title, data, onSelect, onLoadMore, isLoadingMore, hasMore = true, layout = 'portrait' }) => {
    const scrollRef = React.useRef(null);

    const handleScroll = (direction) => {
        if (scrollRef.current) {
            const { current } = scrollRef;
            const scrollAmount = window.innerWidth * 0.8;
            current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    if (!data || data.length === 0) return <SkeletonRow />;
    
    return (
        <div className="row-wrapper" style={{ position: 'relative' }}>
            <h3 className="row-header">{title}</h3>

            <button
                className="scroll-btn left"
                onClick={() => handleScroll('left')}
                tabIndex="-1"
                aria-label="Sola kaydır"
            >
                <i className="fas fa-chevron-left"></i>
            </button>

            <div className="row-scroll-container" ref={scrollRef}>
                {data.map((m, i) => (
                    <Card 
                        key={`${m.id}-${i}`} 
                        movie={m} 
                        onSelect={onSelect} 
                        layout={layout} 
                        progress={m.progress || 0} 
                    />
                ))}
                {onLoadMore && hasMore && (
                    <button 
                        tabIndex="0" 
                        onClick={onLoadMore} 
                        disabled={isLoadingMore} 
                        className={`poster-card focusable load-more-card ${layout === 'landscape' ? 'card-landscape' : 'card-portrait'}`}
                    >
                        {isLoadingMore ? (
                            <i 
                                className="fas fa-circle-notch fa-spin" 
                                style={{ fontSize: '2rem', color: 'rgba(255,255,255,0.6)' }}
                            />
                        ) : (
                            <>
                                <div className="load-more-icon">
                                    <i className="fas fa-plus" style={{ fontSize: '1.3rem' }}></i>
                                </div>
                                <span style={{ fontWeight: '600', fontSize: '1rem' }}>Daha Fazla</span>
                            </>
                        )}
                    </button>
                )}
            </div>

            <button
                className="scroll-btn right"
                onClick={() => handleScroll('right')}
                tabIndex="-1"
                aria-label="Sağa kaydır"
            >
                <i className="fas fa-chevron-right"></i>
            </button>
        </div>
    );
});
