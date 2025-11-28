import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTVNavigation, useGamepadNavigation, useSmartMouse, fetchTMDB, getStorageData } from './hooks/useAppLogic';
import { NavBar, MobileNav, SmartImage, POSTER_IMG } from './components/Shared';
import { HeroCarousel, Row } from './components/HomeWidgets';
import { DetailModal, Player } from './components/Modals';
import './index.css';

const GENRE_TRANSLATIONS = {
    actionMovies: 'Aksiyon Filmleri',
    comedyMovies: 'Komedi Filmleri',
    horrorMovies: 'Korku Filmleri',
    romanticMovies: 'Romantik Filmler',
    scifiMovies: 'Bilim Kurgu Filmleri',
    popularMovies: 'Popüler Filmler',
    crimeTV: 'Suç Dizileri',
    comedyTV: 'Komedi Dizileri',
    dramaTV: 'Dram Dizileri',
    scifiTV: 'Bilim Kurgu Dizileri',
    popularTV: 'Popüler Diziler',
    trending: 'Trend Olanlar'
};

const App = () => {
    const [apiKey, setApiKey] = useState(localStorage.getItem('tmdb_api_key_v3'));
    const [activeTab, setActiveTab] = useState('Ana Sayfa');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [error, setError] = useState(null);
    const [data, setData] = useState({
        hero: [], 
        continue: [], 
        trending: { results: [], page: 1, total_pages: 1 },
        popularMovies: { results: [], page: 1, total_pages: 1 }, 
        actionMovies: { results: [], page: 1, total_pages: 1 },
        comedyMovies: { results: [], page: 1, total_pages: 1 }, 
        horrorMovies: { results: [], page: 1, total_pages: 1 },
        romanticMovies: { results: [], page: 1, total_pages: 1 }, 
        scifiMovies: { results: [], page: 1, total_pages: 1 },
        popularTV: { results: [], page: 1, total_pages: 1 }, 
        crimeTV: { results: [], page: 1, total_pages: 1 },
        comedyTV: { results: [], page: 1, total_pages: 1 }, 
        dramaTV: { results: [], page: 1, total_pages: 1 }, 
        scifiTV: { results: [], page: 1, total_pages: 1 }
    });
    const [loading, setLoading] = useState(false);
    const [selectedMovie, setSelectedMovie] = useState(null);
    const [playingMovie, setPlayingMovie] = useState(null);
    const [playParams, setPlayParams] = useState({ s: 1, e: 1 });

    useTVNavigation(!!selectedMovie, !!playingMovie);
    useGamepadNavigation();
    useSmartMouse();

    useEffect(() => { 
        const continueItems = getStorageData('continue_watching'); 
        setData(prev => ({ ...prev, continue: continueItems })); 
    }, [activeTab]);
    
    useEffect(() => { 
        window.scrollTo({ top: 0 }); 
        const activeBtn = document.querySelector('.nav-btn.btn-active'); 
        if (activeBtn) activeBtn.focus(); 
    }, [activeTab]);
    
    useEffect(() => {
        window.history.replaceState({ page: 'home' }, '', '');
        const handlePopState = () => { 
            if (playingMovie) setPlayingMovie(null); 
            else if (selectedMovie) setSelectedMovie(null); 
            else if (activeTab !== 'Ana Sayfa') setActiveTab('Ana Sayfa'); 
        };
        window.addEventListener('popstate', handlePopState); 
        return () => window.removeEventListener('popstate', handlePopState);
    }, [playingMovie, selectedMovie, activeTab]);

    const handleTabChange = useCallback((newTab) => { 
        if (activeTab !== newTab) { 
            window.history.pushState({ page: 'tab', name: newTab }, '', ''); 
            setActiveTab(newTab); 
        } 
    }, [activeTab]);
    
    const openDetail = useCallback((movie) => { 
        window.history.pushState({ page: 'detail', id: movie.id }, '', ''); 
        setSelectedMovie(movie); 
    }, []);
    
    const openPlayer = useCallback((movie, s, e) => { 
        window.history.pushState({ page: 'player', id: movie.id }, '', ''); 
        setPlayParams({ s, e }); 
        setPlayingMovie(movie); 
    }, []);
    
    const handleCloseUI = useCallback(() => { 
        window.history.back(); 
    }, []);

    const loadData = useCallback(async (key, endpoint, page) => {
        setLoading(true); 
        const res = await fetchTMDB(endpoint + (endpoint.includes('?') ? '&' : '?') + `page=${page}`, apiKey); 
        setLoading(false);
        if (res && res.results) {
            setData(prev => ({ 
                ...prev, 
                [key]: { 
                    results: page === 1 ? res.results : [...prev[key].results, ...res.results], 
                    page: page, 
                    total_pages: res.total_pages || 1 
                } 
            }));
            if (key === 'trending' && page === 1) {
                setData(prev => ({ ...prev, hero: res.results.slice(0, 6) }));
            }
        }
    }, [apiKey]);

    useEffect(() => {
        if (apiKey) {
            loadData('trending', '/trending/all/day', 1); 
            loadData('popularMovies', '/movie/popular', 1); 
            loadData('popularTV', '/tv/popular', 1);
            loadData('actionMovies', '/discover/movie?with_genres=28', 1); 
            loadData('comedyMovies', '/discover/movie?with_genres=35', 1);
            loadData('horrorMovies', '/discover/movie?with_genres=27', 1); 
            loadData('romanticMovies', '/discover/movie?with_genres=10749', 1);
            loadData('scifiMovies', '/discover/movie?with_genres=878', 1); 
            loadData('crimeTV', '/discover/tv?with_genres=80', 1);
            loadData('comedyTV', '/discover/tv?with_genres=35', 1); 
            loadData('dramaTV', '/discover/tv?with_genres=18', 1); 
            loadData('scifiTV', '/discover/tv?with_genres=10765', 1);
        }
    }, [apiKey, loadData]);

    useEffect(() => {
        const timer = setTimeout(() => { 
            if (searchQuery.length > 2) {
                fetchTMDB(`/search/multi?query=${searchQuery}`, apiKey).then(d => d && setSearchResults(d.results || [])); 
            } else {
                setSearchResults([]); 
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery, apiKey]);

    const [apiKeyInput, setApiKeyInput] = useState('');
    const [validating, setValidating] = useState(false);
    const [apiError, setApiError] = useState('');

    const validateAndSetApiKey = async (key) => {
        if (key.length < 10) return;
        setValidating(true);
        setApiError('');
        try {
            const response = await fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${key}&page=1`);
            if (response.ok) {
                localStorage.setItem('tmdb_api_key_v3', key);
                setApiKey(key);
            } else {
                setApiError('Geçersiz API anahtarı. Lütfen kontrol edip tekrar deneyin.');
            }
        } catch (err) {
            setApiError('Bağlantı hatası. Lütfen tekrar deneyin.');
        }
        setValidating(false);
    };

    const handleLogout = useCallback(() => {
        localStorage.removeItem('tmdb_api_key_v3');
        setApiKey(null);
        setApiKeyInput('');
        setApiError('');
        setData({
            hero: [], continue: [], 
            trending: { results: [], page: 1, total_pages: 1 },
            popularMovies: { results: [], page: 1, total_pages: 1 }, 
            actionMovies: { results: [], page: 1, total_pages: 1 },
            comedyMovies: { results: [], page: 1, total_pages: 1 }, 
            horrorMovies: { results: [], page: 1, total_pages: 1 },
            romanticMovies: { results: [], page: 1, total_pages: 1 }, 
            scifiMovies: { results: [], page: 1, total_pages: 1 },
            popularTV: { results: [], page: 1, total_pages: 1 }, 
            crimeTV: { results: [], page: 1, total_pages: 1 },
            comedyTV: { results: [], page: 1, total_pages: 1 }, 
            dramaTV: { results: [], page: 1, total_pages: 1 }, 
            scifiTV: { results: [], page: 1, total_pages: 1 }
        });
    }, []);

    if (!apiKey) {
        return (
            <div className="api-key-container">
                <img src="/noxis-logo.svg" alt="Noxis" className="api-key-logo" style={{ width: '280px', height: 'auto', marginBottom: '24px' }} />
                <h1 className="api-key-title" style={{ display: 'none' }}>Noxis</h1>
                <input 
                    type="text" 
                    value={apiKeyInput}
                    onChange={e => setApiKeyInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && validateAndSetApiKey(apiKeyInput)}
                    className="focusable api-key-input" 
                    placeholder="TMDB API Anahtarınızı Girin" 
                    autoFocus 
                    disabled={validating}
                />
                <button 
                    onClick={() => validateAndSetApiKey(apiKeyInput)}
                    disabled={validating || apiKeyInput.length < 10}
                    style={{
                        marginTop: '16px',
                        padding: '12px 32px',
                        background: validating ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, rgba(138,43,226,0.8), rgba(75,0,130,0.8))',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '12px',
                        color: 'white',
                        fontSize: '15px',
                        fontWeight: '600',
                        cursor: validating ? 'wait' : 'pointer',
                        transition: 'all 0.3s ease'
                    }}
                >
                    {validating ? 'Doğrulanıyor...' : 'Giriş Yap'}
                </button>
                {apiError && (
                    <p style={{ 
                        marginTop: '16px', 
                        color: '#ff6b6b', 
                        fontSize: '14px',
                        textAlign: 'center'
                    }}>
                        {apiError}
                    </p>
                )}
                <p style={{ 
                    marginTop: '24px', 
                    color: 'rgba(255,255,255,0.5)', 
                    fontSize: '14px',
                    maxWidth: '320px',
                    textAlign: 'center',
                    lineHeight: '1.5',
                    padding: '0 16px'
                }}>
                    TMDB API anahtarınızı <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer" style={{ color: '#0a84ff' }}>themoviedb.org</a> adresinden alabilirsiniz.
                </p>
            </div>
        );
    }

    return (
        <div style={{
            background: 'var(--bg-primary)',
            minHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            color: 'white',
            overflow: 'hidden'
        }}>
            <NavBar activeTab={activeTab} onTabChange={handleTabChange} onLogout={handleLogout} />
            <MobileNav activeTab={activeTab} onTabChange={handleTabChange} onLogout={handleLogout} />
            
            {error && (
                <div style={{ 
                    position: 'fixed', 
                    top: '80px', 
                    left: '50%', 
                    transform: 'translateX(-50%)', 
                    background: 'rgba(239, 68, 68, 0.9)',
                    backdropFilter: 'blur(20px)',
                    padding: '12px 24px', 
                    borderRadius: '12px',
                    zIndex: 1000,
                    border: '1px solid rgba(255,255,255,0.1)',
                    fontSize: '14px'
                }}>
                    Hata: {error}
                </div>
            )}

            <div className="content-wrapper" style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                scrollBehavior: 'smooth',
                paddingTop: '60px',
                WebkitOverflowScrolling: 'touch'
            }}>
                <AnimatePresence mode="wait">
                    <motion.div 
                        key={activeTab} 
                        initial={{ opacity: 0, y: 20 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        exit={{ opacity: 0, y: -20 }} 
                        transition={{ duration: 0.4, ease: "easeOut" }}
                    >
                        {activeTab === 'Ana Sayfa' && (
                            <>
                                <HeroCarousel 
                                    movies={data.hero} 
                                    onPlay={(m) => openPlayer(m, 1, 1)} 
                                    onDetails={openDetail} 
                                />
                                <div style={{ background: 'var(--bg-primary)', paddingTop: '24px' }}>
                                    {data.continue.length > 0 && (
                                        <Row 
                                            title="Kaldığın Yerden Devam Et" 
                                            data={data.continue} 
                                            onSelect={(m) => setTimeout(() => openPlayer(m, m.season || 1, m.episode || 1), 50)} 
                                            layout="landscape" 
                                        />
                                    )}
                                    <Row 
                                        title={GENRE_TRANSLATIONS.trending} 
                                        data={data.trending.results} 
                                        onSelect={openDetail} 
                                        onLoadMore={() => loadData('trending', '/trending/all/day', data.trending.page + 1)} 
                                        hasMore={data.trending.page < data.trending.total_pages} 
                                        isLoadingMore={loading} 
                                    />
                                    <Row 
                                        title={GENRE_TRANSLATIONS.popularMovies} 
                                        data={data.popularMovies.results} 
                                        onSelect={openDetail} 
                                        onLoadMore={() => loadData('popularMovies', '/movie/popular', data.popularMovies.page + 1)} 
                                        hasMore={data.popularMovies.page < data.popularMovies.total_pages} 
                                    />
                                    <Row 
                                        title={GENRE_TRANSLATIONS.popularTV} 
                                        data={data.popularTV.results} 
                                        onSelect={openDetail} 
                                        onLoadMore={() => loadData('popularTV', '/tv/popular', data.popularTV.page + 1)} 
                                        hasMore={data.popularTV.page < data.popularTV.total_pages} 
                                    />
                                </div>
                            </>
                        )}
                        
                        {(activeTab === 'Filmler' || activeTab === 'Diziler') && (
                            <div>
                                <div style={{ padding: '24px 16px 16px 16px' }}>
                                    <h1 style={{ 
                                        fontSize: '32px', 
                                        fontWeight: '800',
                                        letterSpacing: '-0.02em',
                                        background: 'linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.8) 100%)',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                        backgroundClip: 'text'
                                    }}>
                                        {activeTab}
                                    </h1>
                                </div>
                                <div style={{ paddingBottom: '100px' }}>
                                    {activeTab === 'Filmler' ?
                                        ['actionMovies', 'comedyMovies', 'horrorMovies', 'romanticMovies', 'scifiMovies'].map(k => (
                                            <Row key={k} title={GENRE_TRANSLATIONS[k]} data={data[k].results} onSelect={openDetail} />
                                        )) :
                                        ['crimeTV', 'comedyTV', 'dramaTV', 'scifiTV'].map(k => (
                                            <Row key={k} title={GENRE_TRANSLATIONS[k]} data={data[k].results} onSelect={openDetail} />
                                        ))
                                    }
                                </div>
                            </div>
                        )}
                        
                        {activeTab === 'Ara' && (
                            <div>
                                <div style={{ padding: '24px 16px 16px 16px' }}>
                                    <h1 style={{ 
                                        fontSize: '28px', 
                                        fontWeight: '800', 
                                        marginBottom: '16px',
                                        letterSpacing: '-0.02em',
                                        background: 'linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.8) 100%)',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                        backgroundClip: 'text'
                                    }}>
                                        Ara
                                    </h1>
                                    <div className="search-input-container">
                                        <i className="fas fa-search search-icon"></i>
                                        <input 
                                            autoFocus 
                                            type="text" 
                                            className="focusable search-input" 
                                            placeholder="Film, dizi veya oyuncu ara..." 
                                            value={searchQuery} 
                                            onChange={e => setSearchQuery(e.target.value)} 
                                        />
                                    </div>
                                </div>
                                {searchQuery.length > 2 && (
                                    <div className="search-grid">
                                        {searchResults.map(m => m.poster_path && (
                                            <button 
                                                key={m.id} 
                                                tabIndex="0" 
                                                onClick={() => openDetail(m)} 
                                                className="focusable poster-card search-grid-card"
                                            >
                                                <SmartImage 
                                                    src={POSTER_IMG + m.poster_path} 
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                                />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
            
            <AnimatePresence>
                {selectedMovie && (
                    <DetailModal 
                        movie={selectedMovie} 
                        apiKey={apiKey} 
                        onClose={handleCloseUI} 
                        onPlay={openPlayer} 
                    />
                )}
            </AnimatePresence>
            
            {playingMovie && (
                <Player 
                    movie={playingMovie} 
                    initialSeason={playParams.s} 
                    initialEpisode={playParams.e} 
                    onClose={handleCloseUI} 
                />
            )}
        </div>
    );
};

export default App;
