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
    const lastNavTime = useRef(0);
    const NAV_THROTTLE = 100;
    
    useEffect(() => {
        const handleKeyDown = (e) => {
            const now = Date.now();
            
            const isTVRowFocused = document.activeElement?.closest('.tv-focus-frame');
            
            const getDirection = (key, keyCode) => {
                if (['ArrowUp', 'Up'].includes(key) || keyCode === 38) return 'up';
                if (['ArrowDown', 'Down'].includes(key) || keyCode === 40) return 'down';
                if (['ArrowLeft', 'Left'].includes(key) || keyCode === 37) return 'left';
                if (['ArrowRight', 'Right'].includes(key) || keyCode === 39) return 'right';
                return null;
            };
            const direction = getDirection(e.key, e.keyCode);
            
            if (isTVRowFocused && (direction === 'left' || direction === 'right')) {
                return;
            }
            
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
            
            const isSyntheticEvent = !e.isTrusted;
            if (!isSyntheticEvent && now - lastNavTime.current < NAV_THROTTLE) {
                e.preventDefault();
                return;
            }
            if (!isSyntheticEvent) lastNavTime.current = now;

            e.preventDefault();
            let scopeSelector = isPlayerOpen ? '#player-container .focusable' : isModalOpen ? '.detail-view-container .focusable' : '.focusable';
            let currentElement = document.activeElement;
            if (!currentElement || !currentElement.classList.contains('focusable')) {
                const first = document.querySelector(scopeSelector);
                if (first) first.focus(); return;
            }

            const currentRect = currentElement.getBoundingClientRect();
            
            if (direction === 'up' && !isModalOpen && !isPlayerOpen) {
                const rowContainer = currentElement.closest('.row-scroll-container');
                const heroSection = currentElement.closest('.hero-section');
                const NAVBAR_THRESHOLD = 120;
                
                if (currentRect.top < NAVBAR_THRESHOLD && !heroSection) {
                    const navbarButtons = Array.from(document.querySelectorAll('.navbar-container .nav-btn.focusable, .navbar-container .nav-logout-btn.focusable'));
                    const visibleNavButtons = navbarButtons.filter(el => {
                        const style = window.getComputedStyle(el);
                        const rect = el.getBoundingClientRect();
                        return style.display !== 'none' && style.visibility !== 'hidden' && rect.height > 0 && rect.width > 0;
                    });
                    
                    if (visibleNavButtons.length > 0) {
                        let closestNavBtn = null;
                        let minHorizontalDist = Infinity;
                        const currentCenterX = currentRect.left + currentRect.width / 2;
                        
                        visibleNavButtons.forEach(btn => {
                            const btnRect = btn.getBoundingClientRect();
                            const btnCenterX = btnRect.left + btnRect.width / 2;
                            const horizontalDist = Math.abs(currentCenterX - btnCenterX);
                            
                            if (horizontalDist < minHorizontalDist) {
                                minHorizontalDist = horizontalDist;
                                closestNavBtn = btn;
                            }
                        });
                        
                        if (closestNavBtn) {
                            if (closestNavBtn !== lastFocus.current) { 
                                SoundManager.playHover(); 
                                lastFocus.current = closestNavBtn; 
                            }
                            closestNavBtn.focus({ preventScroll: true });
                            return;
                        }
                    }
                }
            }
            
            if (direction === 'down' && !isModalOpen && !isPlayerOpen) {
                const isInNavbar = currentElement.closest('.navbar-container');
                
                if (isInNavbar) {
                    const heroButtons = Array.from(document.querySelectorAll('.hero-section .hero-button.focusable'));
                    const visibleHeroButtons = heroButtons.filter(el => {
                        const style = window.getComputedStyle(el);
                        const rect = el.getBoundingClientRect();
                        return style.display !== 'none' && style.visibility !== 'hidden' && rect.height > 0 && rect.width > 0;
                    });
                    
                    if (visibleHeroButtons.length > 0) {
                        const firstHeroBtn = visibleHeroButtons[0];
                        if (firstHeroBtn !== lastFocus.current) {
                            SoundManager.playHover();
                            lastFocus.current = firstHeroBtn;
                        }
                        firstHeroBtn.focus();
                        return;
                    }
                    
                    const contentFocusables = Array.from(document.querySelectorAll('.content-wrapper .focusable'));
                    const visibleContentElements = contentFocusables.filter(el => {
                        if (el.closest('.detail-view-container') || el.closest('#player-container')) return false;
                        const style = window.getComputedStyle(el);
                        const rect = el.getBoundingClientRect();
                        return style.display !== 'none' && style.visibility !== 'hidden' && rect.height > 0 && rect.width > 0 && rect.top > 60;
                    });
                    
                    if (visibleContentElements.length > 0) {
                        visibleContentElements.sort((a, b) => {
                            const rectA = a.getBoundingClientRect();
                            const rectB = b.getBoundingClientRect();
                            return rectA.top - rectB.top || rectA.left - rectB.left;
                        });
                        
                        const firstElement = visibleContentElements[0];
                        if (firstElement !== lastFocus.current) {
                            SoundManager.playHover();
                            lastFocus.current = firstElement;
                        }
                        firstElement.focus();
                        firstElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                        return;
                    }
                }
            }

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
                lastNavTime.current = 0;
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
    const lastPressRef = useRef({});
    const reqRef = useRef(null);
    const axisHeldRef = useRef({ x: false, y: false });
    const repeatTimerRef = useRef({});
    
    useEffect(() => {
        const INITIAL_DELAY = 200;
        const REPEAT_DELAY = 120;
        const AXIS_THRESHOLD = 0.5;
        const BUTTON_COOLDOWN = 250;
        
        const triggerKey = (key) => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
            SoundManager.playHover();
        };
        
        const handleAction = (action, isPressed) => {
            const now = Date.now();
            const lastPress = lastPressRef.current[action] || 0;
            
            if (isPressed) {
                if (!repeatTimerRef.current[action]) {
                    if (now - lastPress > INITIAL_DELAY) {
                        if (action === 'select') {
                            const active = document.activeElement;
                            if (active && active.classList.contains('focusable')) {
                                SoundManager.playSelect();
                                active.click();
                            }
                        } else if (action === 'back') {
                            window.history.back();
                        } else {
                            triggerKey(action);
                        }
                        lastPressRef.current[action] = now;
                        
                        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(action)) {
                            repeatTimerRef.current[action] = setTimeout(function repeat() {
                                triggerKey(action);
                                lastPressRef.current[action] = Date.now();
                                repeatTimerRef.current[action] = setTimeout(repeat, REPEAT_DELAY);
                            }, INITIAL_DELAY);
                        }
                    }
                }
            } else {
                if (repeatTimerRef.current[action]) {
                    clearTimeout(repeatTimerRef.current[action]);
                    repeatTimerRef.current[action] = null;
                }
            }
        };
        
        const scanGamepads = () => {
            const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
            const gp = gamepads[0] || gamepads[1] || gamepads[2] || gamepads[3];
            
            if (gp) {
                const axisY = gp.axes[1] || 0;
                const axisX = gp.axes[0] || 0;
                
                const dpadUp = gp.buttons[12]?.pressed;
                const dpadDown = gp.buttons[13]?.pressed;
                const dpadLeft = gp.buttons[14]?.pressed;
                const dpadRight = gp.buttons[15]?.pressed;
                
                handleAction('ArrowUp', axisY < -AXIS_THRESHOLD || dpadUp);
                handleAction('ArrowDown', axisY > AXIS_THRESHOLD || dpadDown);
                handleAction('ArrowLeft', axisX < -AXIS_THRESHOLD || dpadLeft);
                handleAction('ArrowRight', axisX > AXIS_THRESHOLD || dpadRight);
                
                handleAction('select', gp.buttons[0]?.pressed);
                handleAction('back', gp.buttons[1]?.pressed);
                
                if (gp.buttons[2]?.pressed) {
                    handleAction('menu', true);
                } else {
                    handleAction('menu', false);
                }
                
                if (gp.buttons[4]?.pressed) {
                    handleAction('lb', true);
                }
                if (gp.buttons[5]?.pressed) {
                    handleAction('rb', true);
                }
            }
            
            reqRef.current = requestAnimationFrame(scanGamepads);
        };
        
        const handleGamepadConnected = (e) => {
            console.log('Gamepad connected:', e.gamepad.id);
            if (!reqRef.current) {
                scanGamepads();
            }
        };
        
        const handleGamepadDisconnected = (e) => {
            console.log('Gamepad disconnected:', e.gamepad.id);
        };
        
        window.addEventListener("gamepadconnected", handleGamepadConnected);
        window.addEventListener("gamepaddisconnected", handleGamepadDisconnected);
        
        if (navigator.getGamepads) {
            const gamepads = navigator.getGamepads();
            if (gamepads[0] || gamepads[1] || gamepads[2] || gamepads[3]) {
                scanGamepads();
            }
        }
        
        return () => {
            if (reqRef.current) {
                cancelAnimationFrame(reqRef.current);
            }
            Object.values(repeatTimerRef.current).forEach(timer => {
                if (timer) clearTimeout(timer);
            });
            window.removeEventListener("gamepadconnected", handleGamepadConnected);
            window.removeEventListener("gamepaddisconnected", handleGamepadDisconnected);
        };
    }, []);
};

