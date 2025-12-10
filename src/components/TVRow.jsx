import React, { memo, useState, useRef, useEffect, useCallback } from 'react';
import { SmartImage, POSTER_IMG, BACKDROP_IMG } from './Shared';
import { SoundManager } from '../hooks/useAppLogic';

const CARD_WIDTH = 180;
const CARD_GAP = 16;
const TRANSITION_DURATION = 300;
const FRAME_LEFT_OFFSET = 24;

export const TVRow = memo(({ title, data, onSelect, rowId }) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isFocused, setIsFocused] = useState(false);
    const focusRef = useRef(null);
    const carouselRef = useRef(null);
    
    const itemCount = data?.length || 0;
    
    const getTransformX = useCallback((index) => {
        return -(index * (CARD_WIDTH + CARD_GAP));
    }, []);
    
    const navigateToIndex = useCallback((newIndex) => {
        if (itemCount === 0) return;
        
        let wrappedIndex = newIndex;
        if (wrappedIndex < 0) {
            wrappedIndex = itemCount - 1;
        } else if (wrappedIndex >= itemCount) {
            wrappedIndex = 0;
        }
        
        setSelectedIndex(wrappedIndex);
        SoundManager.playHover();
    }, [itemCount]);
    
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
                        const isSelected = index === selectedIndex;
                        const distance = Math.abs(index - selectedIndex);
                        const opacity = isSelected ? 0 : distance <= 3 ? 1 - (distance * 0.15) : 0.4;
                        const scale = isSelected ? 0.9 : distance <= 2 ? 1 - (distance * 0.03) : 0.94;
                        
                        return (
                            <div 
                                key={`${movie.id}-${index}`}
                                className={`tv-row-item ${isSelected ? 'tv-row-item-selected' : ''}`}
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
                </div>
            </div>
            
            {isFocused && (
                <div className="tv-row-indicator">
                    <span className="tv-row-position">
                        {selectedIndex + 1} / {itemCount}
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
