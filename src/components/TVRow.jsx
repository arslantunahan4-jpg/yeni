import React, { memo, useState, useRef, useEffect, useCallback } from 'react';
import { SmartImage, POSTER_IMG } from './Shared';
import { SoundManager } from '../hooks/useAppLogic';
import { ImageCache } from '../services/imageCache';

const CARD_WIDTH = 180;
const CARD_GAP = 16;
const TRANSITION_DURATION = 300;
const FRAME_LEFT_OFFSET = 24;
const PRELOAD_THRESHOLD = 5;
const PAGINATION_THRESHOLD = 3;

export const TVRow = memo(({ 
    title, 
    data, 
    onSelect, 
    rowId, 
    onLoadMore, 
    hasMore = false,
    isLoading = false 
}) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isFocused, setIsFocused] = useState(false);
    const focusRef = useRef(null);
    const carouselRef = useRef(null);
    const loadMoreTriggeredRef = useRef(false);
    
    const itemCount = data?.length || 0;
    
    const getTransformX = useCallback((index) => {
        return -(index * (CARD_WIDTH + CARD_GAP));
    }, []);
    
    useEffect(() => {
        if (!data || data.length === 0) return;
        
        const preloadImages = async () => {
            const start = Math.max(0, selectedIndex - PRELOAD_THRESHOLD);
            const end = Math.min(data.length, selectedIndex + PRELOAD_THRESHOLD + 1);
            
            const urls = [];
            for (let i = start; i < end; i++) {
                const item = data[i];
                if (item) {
                    const posterPath = item.poster_path || item.backdrop_path;
                    if (posterPath) {
                        urls.push(POSTER_IMG + posterPath);
                    }
                }
            }
            
            await ImageCache.preloadBatch(urls);
        };
        
        preloadImages();
    }, [data, selectedIndex]);
    
    useEffect(() => {
        if (hasMore && onLoadMore && !isLoading && itemCount > 0) {
            const remainingItems = itemCount - selectedIndex - 1;
            
            if (remainingItems <= PAGINATION_THRESHOLD && !loadMoreTriggeredRef.current) {
                loadMoreTriggeredRef.current = true;
                onLoadMore();
            }
        }
    }, [selectedIndex, itemCount, hasMore, onLoadMore, isLoading]);
    
    useEffect(() => {
        if (!isLoading) {
            loadMoreTriggeredRef.current = false;
        }
    }, [isLoading, itemCount]);
    
    const navigateToIndex = useCallback((newIndex) => {
        if (itemCount === 0) return;
        
        let targetIndex = newIndex;
        
        if (targetIndex < 0) {
            targetIndex = 0;
        } else if (targetIndex >= itemCount) {
            if (hasMore && onLoadMore && !isLoading) {
                onLoadMore();
            }
            targetIndex = itemCount - 1;
        }
        
        if (targetIndex !== selectedIndex) {
            setSelectedIndex(targetIndex);
            SoundManager.playHover();
        }
    }, [itemCount, selectedIndex, hasMore, onLoadMore, isLoading]);
    
    const handleKeyDown = useCallback((e) => {
        if (!isFocused) return;
        
        const key = e.key;
        const keyCode = e.keyCode;
        
        const isLeft = key === 'ArrowLeft' || key === 'Left' || keyCode === 37;
        const isRight = key === 'ArrowRight' || key === 'Right' || keyCode === 39;
        const isEnter = key === 'Enter' || key === 'Select' || keyCode === 13;
        const isSpace = key === ' ' || keyCode === 32;
        
        if (isLeft) {
            e.preventDefault();
            e.stopPropagation();
            navigateToIndex(selectedIndex - 1);
            return false;
        } else if (isRight) {
            e.preventDefault();
            e.stopPropagation();
            navigateToIndex(selectedIndex + 1);
            return false;
        } else if ((isEnter || isSpace) && data?.[selectedIndex]) {
            e.preventDefault();
            e.stopPropagation();
            SoundManager.playSelect();
            onSelect?.(data[selectedIndex]);
            return false;
        }
    }, [isFocused, selectedIndex, navigateToIndex, data, onSelect]);
    
    useEffect(() => {
        const element = focusRef.current;
        if (!element) return;
        
        element.addEventListener('keydown', handleKeyDown, { capture: true });
        return () => element.removeEventListener('keydown', handleKeyDown, { capture: true });
    }, [handleKeyDown]);
    
    const handleFocus = useCallback(() => {
        setIsFocused(true);
    }, []);
    
    const handleBlur = useCallback(() => {
        setIsFocused(false);
    }, []);
    
    const handleItemClick = useCallback((movie, index) => {
        if (focusRef.current) {
            focusRef.current.focus();
        }
        if (index !== selectedIndex) {
            setSelectedIndex(index);
            SoundManager.playHover();
        } else {
            SoundManager.playSelect();
            onSelect?.(movie);
        }
    }, [selectedIndex, onSelect]);
    
    if (!data || data.length === 0) {
        return null;
    }
    
    const transformX = getTransformX(selectedIndex);
    const currentMovie = data[selectedIndex];
    
    return (
        <div className="tv-row-wrapper" data-row-id={rowId}>
            <h3 className="tv-row-header">{title}</h3>
            
            <div className="tv-row-container">
                <button
                    ref={focusRef}
                    className={`tv-focus-frame focusable ${isFocused ? 'tv-focus-frame-active' : ''}`}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    tabIndex={0}
                    aria-label={`${title} - ${currentMovie?.title || currentMovie?.name || 'Item'} - ${selectedIndex + 1} of ${itemCount}`}
                >
                    <div className="tv-focus-frame-inner" />
                    <div className="tv-focus-frame-glow" />
                    <div className="tv-focus-frame-content">
                        {currentMovie && (
                            <SmartImage 
                                src={POSTER_IMG + (currentMovie.poster_path || currentMovie.backdrop_path)} 
                                alt={currentMovie.title || currentMovie.name}
                                style={{ 
                                    width: '100%', 
                                    height: '100%', 
                                    objectFit: 'cover',
                                    borderRadius: '12px'
                                }}
                            />
                        )}
                        <div className="tv-focus-frame-overlay">
                            <span className="tv-focus-frame-title">
                                {currentMovie?.title || currentMovie?.name}
                            </span>
                            {currentMovie?.vote_average > 0 && (
                                <span className="tv-focus-frame-rating">
                                    <i className="fas fa-star"></i>
                                    {currentMovie.vote_average.toFixed(1)}
                                </span>
                            )}
                        </div>
                    </div>
                </button>
                
                <div 
                    ref={carouselRef}
                    className="tv-row-carousel"
                    style={{
                        transform: `translate3d(${transformX}px, 0, 0)`,
                        transition: `transform ${TRANSITION_DURATION}ms cubic-bezier(0.33, 1, 0.68, 1)`,
                        marginLeft: `${CARD_WIDTH + CARD_GAP + FRAME_LEFT_OFFSET}px`
                    }}
                >
                    {data.map((movie, index) => {
                        const isBeforeOrSelected = index <= selectedIndex;
                        const distanceFromSelected = index - selectedIndex;
                        const isVisible = distanceFromSelected > 0 && distanceFromSelected <= 8;
                        
                        if (isBeforeOrSelected) {
                            return (
                                <div 
                                    key={`${movie.id}-${index}`}
                                    className="tv-row-item"
                                    style={{
                                        width: CARD_WIDTH,
                                        height: 270,
                                        flexShrink: 0,
                                        opacity: 0,
                                        pointerEvents: 'none'
                                    }}
                                />
                            );
                        }
                        
                        if (!isVisible) {
                            return (
                                <div 
                                    key={`${movie.id}-${index}`}
                                    className="tv-row-item"
                                    style={{
                                        width: CARD_WIDTH,
                                        height: 270,
                                        flexShrink: 0,
                                        visibility: 'hidden'
                                    }}
                                />
                            );
                        }
                        
                        const opacity = distanceFromSelected <= 3 ? 1 - ((distanceFromSelected - 1) * 0.15) : 0.4;
                        const scale = distanceFromSelected <= 2 ? 1 - ((distanceFromSelected - 1) * 0.03) : 0.94;
                        
                        return (
                            <div 
                                key={`${movie.id}-${index}`}
                                className="tv-row-item"
                                onClick={() => handleItemClick(movie, index)}
                                style={{
                                    opacity,
                                    transform: `scale(${scale})`,
                                    transition: `opacity ${TRANSITION_DURATION}ms ease, transform ${TRANSITION_DURATION}ms ease`
                                }}
                            >
                                <div className="tv-row-item-poster">
                                    <SmartImage 
                                        src={POSTER_IMG + (movie.poster_path || movie.backdrop_path)} 
                                        alt={movie.title || movie.name}
                                        style={{ 
                                            width: '100%', 
                                            height: '100%', 
                                            objectFit: 'cover',
                                            borderRadius: '10px'
                                        }}
                                    />
                                    <div className="tv-row-item-overlay">
                                        <span className="tv-row-item-title">{movie.title || movie.name}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    
                    {isLoading && (
                        <div className="tv-row-loading">
                            <div className="tv-row-loading-spinner" />
                        </div>
                    )}
                </div>
            </div>
            
            {isFocused && (
                <div className="tv-row-indicator">
                    <span className="tv-row-position">
                        {selectedIndex + 1} / {itemCount}{hasMore ? '+' : ''}
                    </span>
                    <div className="tv-row-nav-hint">
                        <span><i className="fas fa-arrow-left"></i> <i className="fas fa-arrow-right"></i> Navigate</span>
                        <span><i className="fas fa-check"></i> Select</span>
                    </div>
                </div>
            )}
        </div>
    );
});

TVRow.displayName = 'TVRow';

export default TVRow;
