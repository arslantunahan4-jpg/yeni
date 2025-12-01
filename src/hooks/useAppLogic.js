import { useState, useEffect, useRef, useCallback } from 'react';

// --- API UTILS ---
const API_KEY_KEY = 'tmdb_api_key_v3';
const WATCHED_KEY = 'watched_items';
const CONTINUE_KEY = 'continue_watching';

export const fetchTMDB = async (endpoint, key) => {
    try {
        const symbol = endpoint.includes('?') ? '&' : '?';
        const res = await fetch(`https://api.themoviedb.org/3${endpoint}${symbol}api_key=${key}&language=tr-TR`);
        return res.ok ? await res.json() : null;
    } catch (e) { return null; }
};

export const getStorageData = (key) => { try { return JSON.parse(localStorage.getItem(key) || (key === CONTINUE_KEY ? '[]' : '{}')); } catch { return key === CONTINUE_KEY ? [] : {}; } };
export const markAsWatched = (movieId, season = null, episode = null) => {
    const watched = getStorageData(WATCHED_KEY);
    const key = season && episode ? `${movieId}_s${season}e${episode}` : `${movieId}`;
    watched[key] = { timestamp: Date.now(), season, episode };
    localStorage.setItem(WATCHED_KEY, JSON.stringify(watched));
};
export const isWatched = (movieId, season = null, episode = null) => {
    const watched = getStorageData(WATCHED_KEY);
    return !!watched[season && episode ? `${movieId}_s${season}e${episode}` : `${movieId}`];
};
export const saveContinueWatching = (movie, season = null, episode = null, progress = 0) => {
    const items = getStorageData(CONTINUE_KEY);
    const existing = items.findIndex(i => i.id === movie.id && i.season === season && i.episode === episode);
    const item = { ...movie, season, episode, progress, timestamp: Date.now() };
    if (existing >= 0) items[existing] = item; else items.unshift(item);
    localStorage.setItem(CONTINUE_KEY, JSON.stringify(items.slice(0, 20)));
};

// --- SOUND MANAGER ---
export const SoundManager = {
    ctx: null, lastHover: 0, lastSelect: 0,
    init: () => { if (!SoundManager.ctx) SoundManager.ctx = new (window.AudioContext || window.webkitAudioContext)(); },
    playHover: () => {
        const now = Date.now(); if (now - SoundManager.lastHover < 50) return;
        SoundManager.lastHover = now; if (!SoundManager.ctx) SoundManager.init();
        if (SoundManager.ctx.state === 'suspended') SoundManager.ctx.resume().catch(()=>{});
        const osc = SoundManager.ctx.createOscillator(); const gain = SoundManager.ctx.createGain();
        osc.type = 'sine'; osc.frequency.setValueAtTime(300, SoundManager.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, SoundManager.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.02, SoundManager.ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, SoundManager.ctx.currentTime + 0.1);
        osc.connect(gain); gain.connect(SoundManager.ctx.destination); osc.start(); osc.stop(SoundManager.ctx.currentTime + 0.1);
    },
    playSelect: () => {
        const now = Date.now(); if (now - SoundManager.lastSelect < 100) return;
        SoundManager.lastSelect = now; if (!SoundManager.ctx) SoundManager.init();
        if (SoundManager.ctx.state === 'suspended') SoundManager.ctx.resume().catch(()=>{});
        const osc = SoundManager.ctx.createOscillator(); const gain = SoundManager.ctx.createGain();
        osc.type = 'triangle'; osc.frequency.setValueAtTime(400, SoundManager.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, SoundManager.ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.04, SoundManager.ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, SoundManager.ctx.currentTime + 0.15);
        osc.connect(gain); gain.connect(SoundManager.ctx.destination); osc.start(); osc.stop(SoundManager.ctx.currentTime + 0.15);
    }
};

// --- DEVICE HOOKS ---
export const useSmartMouse = () => {
    const timerRef = useRef(null);
    const lastMoveRef = useRef(0);
    const isVisibleRef = useRef(true);
    
    useEffect(() => {
        const handleMouseMove = () => {
            const now = Date.now();
            if (now - lastMoveRef.current < 100) return;
            lastMoveRef.current = now;
            
            if (!isVisibleRef.current) {
                document.body.style.cursor = 'auto';
                isVisibleRef.current = true;
            }
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => { 
                document.body.style.cursor = 'none'; 
                isVisibleRef.current = false;
            }, 3000);
        };
        const handleMouseOver = (e) => {
            const target = e.target.closest('.focusable');
            if (target && target !== document.activeElement) {
                target.focus({ preventScroll: true });
                SoundManager.playHover();
            }
        };
        window.addEventListener('mousemove', handleMouseMove, { passive: true });
        window.addEventListener('mouseover', handleMouseOver, { passive: true });
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseover', handleMouseOver);
            if(timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);
};

export const useTVNavigation = (isModalOpen, isPlayerOpen) => {
    const lastFocus = useRef(null);
    useEffect(() => {
        const handleKeyDown = (e) => {
            const getDirection = (key, keyCode) => {
                if (['ArrowUp', 'Up'].includes(key) || keyCode === 38) return 'up';
                if (['ArrowDown', 'Down'].includes(key) || keyCode === 40) return 'down';
                if (['ArrowLeft', 'Left'].includes(key) || keyCode === 37) return 'left';
                if (['ArrowRight', 'Right'].includes(key) || keyCode === 39) return 'right';
                return null;
            };
            const direction = getDirection(e.key, e.keyCode);
            
            const activeTag = document.activeElement?.tagName;
            const isInInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag);
            
            const backKeyCodes = [10009, 461, 27, 10182, 166];
            const isBackKey = ['Escape', 'Esc', 'XF86Back', 'BrowserBack'].includes(e.key) || backKeyCodes.includes(e.keyCode);
            const isBackspace = e.key === 'Backspace' || e.keyCode === 8;
            
            if (isBackKey || (isBackspace && !isInInput)) {
                e.preventDefault(); 
                window.history.back(); 
                return;
            }
            if (activeTag === 'IFRAME') return;
            
            const enterKeyCodes = [13, 195];
            const isEnterKey = ['Enter', 'Select'].includes(e.key) || enterKeyCodes.includes(e.keyCode);
            const isSpaceKey = e.key === ' ' || e.keyCode === 32;
            
            if (isEnterKey || (isSpaceKey && !isInInput)) {
                if (document.activeElement?.classList.contains('focusable') && !isInInput) {
                    e.preventDefault();
                    SoundManager.playSelect(); 
                    document.activeElement.click();
                }
                return;
            }
            if (!direction) return;
            if (document.activeElement.tagName === 'INPUT' && (direction === 'left' || direction === 'right')) return;

            e.preventDefault();
            let scopeSelector = isPlayerOpen ? '#player-container .focusable' : isModalOpen ? '.detail-view-container .focusable' : '.focusable';
            let currentElement = document.activeElement;
            if (!currentElement || !currentElement.classList.contains('focusable')) {
                const first = document.querySelector(scopeSelector);
                if (first) first.focus(); return;
            }

            const currentRect = currentElement.getBoundingClientRect();
            const validFocusables = Array.from(document.querySelectorAll(scopeSelector)).filter(el => {
                if(!isPlayerOpen && !isModalOpen && (el.closest('.detail-view-container') || el.closest('#player-container'))) return false;
                const style = window.getComputedStyle(el);
                return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
            });

            let closest = null, minDistance = Infinity;
            const getDist = (r1, r2, dir) => {
                const c1 = { x: r1.left + r1.width/2, y: r1.top + r1.height/2 };
                const c2 = { x: r2.left + r2.width/2, y: r2.top + r2.height/2 };
                return (dir==='left'||dir==='right') ? Math.abs(c1.x-c2.x)+(Math.abs(c1.y-c2.y)*4) : Math.abs(c1.y-c2.y)+(Math.abs(c1.x-c2.x)*4);
            };

            validFocusables.forEach(el => {
                if (el === currentElement) return;
                const rect = el.getBoundingClientRect();
                let isCandidate = false;
                switch (direction) {
                    case 'right': isCandidate = rect.left >= currentRect.left + (currentRect.width * 0.1); break;
                    case 'left':  isCandidate = rect.right <= currentRect.right - (currentRect.width * 0.1); break;
                    case 'down':  isCandidate = rect.top >= currentRect.top + (currentRect.height * 0.1); break;
                    case 'up':    isCandidate = rect.bottom <= currentRect.bottom - (currentRect.height * 0.1); break;
                }
                if (isCandidate) {
                    const dist = getDist(currentRect, rect, direction);
                    if (dist < minDistance) { minDistance = dist; closest = el; }
                }
            });

            if (closest) {
                if (closest !== lastFocus.current) { SoundManager.playHover(); lastFocus.current = closest; }
                closest.focus(); closest.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            }
        };
        const recoveryInterval = setInterval(() => {
            const active = document.activeElement;
            if (!active || active === document.body) {
                if (isPlayerOpen) document.getElementById('video-frame')?.focus();
                else if (isModalOpen) document.querySelector('.detail-view-container .focusable')?.focus();
                else document.querySelector('.nav-btn.btn-active')?.focus();
            }
        }, 800);
        window.addEventListener('keydown', handleKeyDown);
        return () => { window.removeEventListener('keydown', handleKeyDown); clearInterval(recoveryInterval); };
    }, [isModalOpen, isPlayerOpen]);
};

export const useGamepadNavigation = () => {
    const lastPress = useRef(0);
    const reqRef = useRef(null);
    useEffect(() => {
        const triggerKey = (key) => window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        const scanGamepads = () => {
            const gp = (navigator.getGamepads ? navigator.getGamepads() : [])[0];
            if (gp) {
                const now = Date.now();
                if (now - lastPress.current > 150) {
                    if (gp.axes[1] < -0.5 || gp.buttons[12]?.pressed) { triggerKey('ArrowUp'); lastPress.current = now; }
                    else if (gp.axes[1] > 0.5 || gp.buttons[13]?.pressed) { triggerKey('ArrowDown'); lastPress.current = now; }
                    else if (gp.axes[0] < -0.5 || gp.buttons[14]?.pressed) { triggerKey('ArrowLeft'); lastPress.current = now; }
                    else if (gp.axes[0] > 0.5 || gp.buttons[15]?.pressed) { triggerKey('ArrowRight'); lastPress.current = now; }
                    else if (gp.buttons[0]?.pressed) { if(document.activeElement) document.activeElement.click(); lastPress.current = now + 150; }
                    else if (gp.buttons[1]?.pressed) { triggerKey('Escape'); lastPress.current = now + 150; }
                }
            }
            reqRef.current = requestAnimationFrame(scanGamepads);
        };
        window.addEventListener("gamepadconnected", scanGamepads);
        scanGamepads();
        return () => cancelAnimationFrame(reqRef.current);
    }, []);
};

