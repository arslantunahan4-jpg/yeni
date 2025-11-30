import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTVNavigation, useGamepadNavigation, useSmartMouse, fetchTMDB, getStorageData } from './hooks/useAppLogic';
import { NavBar, MobileNav, SmartImage, POSTER_IMG } from './components/Shared';
import { HeroCarousel, Row } from './components/HomeWidgets';
import { DetailModal, Player } from './components/Modals';
import IntroAnimation from './components/IntroAnimation';
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

const GENRES = {
    movie: [
        { id: 28, name: 'Aksiyon' }, { id: 12, name: 'Macera' }, { id: 16, name: 'Animasyon' },
        { id: 35, name: 'Komedi' }, { id: 80, name: 'Suç' }, { id: 99, name: 'Belgesel' },
        { id: 18, name: 'Dram' }, { id: 10751, name: 'Aile' }, { id: 14, name: 'Fantastik' },
        { id: 36, name: 'Tarih' }, { id: 27, name: 'Korku' }, { id: 10402, name: 'Müzik' },
        { id: 9648, name: 'Gizem' }, { id: 10749, name: 'Romantik' }, { id: 878, name: 'Bilim Kurgu' },
        { id: 53, name: 'Gerilim' }, { id: 10752, name: 'Savaş' }, { id: 37, name: 'Western' }
    ],
    tv: [
        { id: 10759, name: 'Aksiyon & Macera' }, { id: 16, name: 'Animasyon' }, { id: 35, name: 'Komedi' },
        { id: 80, name: 'Suç' }, { id: 99, name: 'Belgesel' }, { id: 18, name: 'Dram' },
        { id: 10751, name: 'Aile' }, { id: 10762, name: 'Çocuk' }, { id: 9648, name: 'Gizem' },
        { id: 10763, name: 'Haber' }, { id: 10764, name: 'Reality' }, { id: 10765, name: 'Bilim Kurgu & Fantastik' },
        { id: 10766, name: 'Pembe Dizi' }, { id: 10767, name: 'Talk Show' }, { id: 10768, name: 'Savaş & Politik' }, { id: 37, name: 'Western' }
    ]
};

const SORT_OPTIONS = [
    { id: 'popularity.desc', name: 'Popülerlik (Yüksek)' },
    { id: 'popularity.asc', name: 'Popülerlik (Düşük)' },
    { id: 'vote_average.desc', name: 'Puan (Yüksek)' },
    { id: 'vote_average.asc', name: 'Puan (Düşük)' },
    { id: 'primary_release_date.desc', name: 'Tarih (Yeni)' },
    { id: 'primary_release_date.asc', name: 'Tarih (Eski)' }
];

const App = () => {
    const [showIntro, setShowIntro] = useState(() => {
        const hasSeenIntro = sessionStorage.getItem('noxis_intro_seen');
        return !hasSeenIntro;
    });
    const [apiKey, setApiKey] = useState(localStorage.getItem('tmdb_api_key_v3'));
    const [activeTab, setActiveTab] = useState('Ana Sayfa');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [error, setError] = useState(null);

    const handleIntroComplete = useCallback(() => {
        sessionStorage.setItem('noxis_intro_seen', 'true');
        setShowIntro(false);
    }, []);
    
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({
        type: 'all',
        genre: '',
        minRating: 0,
        sortBy: 'popularity.desc',
        year: ''
    });
    const [discoverResults, setDiscoverResults] = useState([]);
    const [discoverPage, setDiscoverPage] = useState(1);
    const [discoverTotalPages, setDiscoverTotalPages] = useState(1);
    const [isDiscoverLoading, setIsDiscoverLoading] = useState(false);
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
                fetchTMDB(`/search/multi?query=${searchQuery}`, apiKey).then(d => {
                    if (d && d.results) {
                        const resultsWithType = d.results.map(item => ({
                            ...item,
                            media_type: item.media_type || (item.first_air_date ? 'tv' : 'movie')
                        }));
                        setSearchResults(resultsWithType);
                    }
                }); 
            } else {
                setSearchResults([]); 
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery, apiKey]);

    const discoverContent = useCallback(async (page = 1, resetResults = true) => {
        if (!apiKey) return;
        setIsDiscoverLoading(true);
        
        const buildParams = (type) => {
            let params = [];
            
            const sortBy = type === 'tv' 
                ? filters.sortBy.replace('primary_release_date', 'first_air_date')
                : filters.sortBy;
            params.push(`sort_by=${sortBy}`);
            
            if (filters.minRating > 0) {
                params.push(`vote_average.gte=${filters.minRating}`);
                params.push('vote_count.gte=100');
            }
            
            if (filters.year) {
                if (type === 'tv') {
                    params.push(`first_air_date_year=${filters.year}`);
                } else {
                    params.push(`primary_release_year=${filters.year}`);
                }
            }
            
            if (filters.genre) {
                params.push(`with_genres=${filters.genre}`);
            }
            
            return params.join('&');
        };
        
        if (filters.type === 'movie') {
            const res = await fetchTMDB(`/discover/movie?${buildParams('movie')}&page=${page}`, apiKey);
            if (res) {
                const results = (res.results || []).map(item => ({ ...item, media_type: 'movie' }));
                setDiscoverResults(resetResults ? results : prev => [...prev, ...results]);
                setDiscoverPage(page);
                setDiscoverTotalPages(res.total_pages || 1);
            }
        } else if (filters.type === 'tv') {
            const res = await fetchTMDB(`/discover/tv?${buildParams('tv')}&page=${page}`, apiKey);
            if (res) {
                const results = (res.results || []).map(item => ({ ...item, media_type: 'tv' }));
                setDiscoverResults(resetResults ? results : prev => [...prev, ...results]);
                setDiscoverPage(page);
                setDiscoverTotalPages(res.total_pages || 1);
            }
        } else {
            const [movieRes, tvRes] = await Promise.all([
                fetchTMDB(`/discover/movie?${buildParams('movie')}&page=${page}`, apiKey),
                fetchTMDB(`/discover/tv?${buildParams('tv')}&page=${page}`, apiKey)
            ]);
            
            const movies = (movieRes?.results || []).map(m => ({ ...m, media_type: 'movie' }));
            const tvShows = (tvRes?.results || []).map(t => ({ ...t, media_type: 'tv' }));
            const combined = [...movies, ...tvShows].sort((a, b) => {
                if (filters.sortBy.includes('popularity')) {
                    return filters.sortBy.includes('desc') ? b.popularity - a.popularity : a.popularity - b.popularity;
                }
                if (filters.sortBy.includes('vote_average')) {
                    return filters.sortBy.includes('desc') ? b.vote_average - a.vote_average : a.vote_average - b.vote_average;
                }
                if (filters.sortBy.includes('primary_release_date') || filters.sortBy.includes('first_air_date') || filters.sortBy.includes('release_date')) {
                    const dateA = new Date(a.release_date || a.first_air_date || '1900-01-01');
                    const dateB = new Date(b.release_date || b.first_air_date || '1900-01-01');
                    return filters.sortBy.includes('desc') ? dateB - dateA : dateA - dateB;
                }
                return 0;
            });
            
            setDiscoverResults(resetResults ? combined : prev => [...prev, ...combined]);
            setDiscoverPage(page);
            setDiscoverTotalPages(Math.max(movieRes?.total_pages || 1, tvRes?.total_pages || 1));
        }
        setIsDiscoverLoading(false);
    }, [apiKey, filters]);

    useEffect(() => {
        if (activeTab === 'Ara' && !searchQuery) {
            discoverContent(1, true);
        }
    }, [filters, activeTab, discoverContent, searchQuery]);

    const handleFilterChange = useCallback((key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setDiscoverPage(1);
    }, []);

    const clearFilters = useCallback(() => {
        setFilters({
            type: 'all',
            genre: '',
            minRating: 0,
            sortBy: 'popularity.desc',
            year: ''
        });
    }, []);

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
            <>
                {showIntro && <IntroAnimation onComplete={handleIntroComplete} />}
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
            </>
        );
    }

    return (
        <>
        {showIntro && <IntroAnimation onComplete={handleIntroComplete} />}
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
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                                        <h1 style={{ 
                                            fontSize: '28px', 
                                            fontWeight: '800', 
                                            letterSpacing: '-0.02em',
                                            background: 'linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.8) 100%)',
                                            WebkitBackgroundClip: 'text',
                                            WebkitTextFillColor: 'transparent',
                                            backgroundClip: 'text'
                                        }}>
                                            Keşfet
                                        </h1>
                                        <button 
                                            onClick={() => setShowFilters(!showFilters)}
                                            className="filter-toggle-btn"
                                        >
                                            <i className={`fas fa-${showFilters ? 'times' : 'sliders-h'}`}></i>
                                            <span>{showFilters ? 'Kapat' : 'Filtrele'}</span>
                                        </button>
                                    </div>
                                    
                                    <div className="search-input-container" style={{ marginBottom: '16px' }}>
                                        <i className="fas fa-search search-icon"></i>
                                        <input 
                                            type="text" 
                                            className="focusable search-input" 
                                            placeholder="Film, dizi veya oyuncu ara..." 
                                            value={searchQuery} 
                                            onChange={e => setSearchQuery(e.target.value)} 
                                        />
                                    </div>
                                    
                                    {showFilters && !searchQuery && (
                                        <motion.div 
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="filter-panel"
                                        >
                                            <div className="filter-row">
                                                <div className="filter-group">
                                                    <label className="filter-label">Tür</label>
                                                    <div className="filter-chips">
                                                        {[
                                                            { id: 'all', name: 'Tümü' },
                                                            { id: 'movie', name: 'Film' },
                                                            { id: 'tv', name: 'Dizi' }
                                                        ].map(t => (
                                                            <button 
                                                                key={t.id}
                                                                onClick={() => handleFilterChange('type', t.id)}
                                                                className={`filter-chip ${filters.type === t.id ? 'active' : ''}`}
                                                            >
                                                                {t.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                
                                                <div className="filter-group">
                                                    <label className="filter-label">Kategori</label>
                                                    <select 
                                                        value={filters.genre}
                                                        onChange={e => handleFilterChange('genre', e.target.value)}
                                                        className="filter-select"
                                                    >
                                                        <option value="">Tüm Kategoriler</option>
                                                        {(filters.type === 'tv' ? GENRES.tv : GENRES.movie).map(g => (
                                                            <option key={g.id} value={g.id}>{g.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            
                                            <div className="filter-row">
                                                <div className="filter-group">
                                                    <label className="filter-label">Min. Puan: {filters.minRating > 0 ? filters.minRating.toFixed(1) : 'Tümü'}</label>
                                                    <input 
                                                        type="range"
                                                        min="0"
                                                        max="9"
                                                        step="0.5"
                                                        value={filters.minRating}
                                                        onChange={e => handleFilterChange('minRating', parseFloat(e.target.value))}
                                                        className="filter-range"
                                                    />
                                                    <div className="range-labels">
                                                        <span>0</span>
                                                        <span>5</span>
                                                        <span>9+</span>
                                                    </div>
                                                </div>
                                                
                                                <div className="filter-group">
                                                    <label className="filter-label">Yıl</label>
                                                    <select 
                                                        value={filters.year}
                                                        onChange={e => handleFilterChange('year', e.target.value)}
                                                        className="filter-select"
                                                    >
                                                        <option value="">Tüm Yıllar</option>
                                                        {Array.from({ length: 50 }, (_, i) => new Date().getFullYear() - i).map(y => (
                                                            <option key={y} value={y}>{y}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                
                                                <div className="filter-group">
                                                    <label className="filter-label">Sıralama</label>
                                                    <select 
                                                        value={filters.sortBy}
                                                        onChange={e => handleFilterChange('sortBy', e.target.value)}
                                                        className="filter-select"
                                                    >
                                                        {SORT_OPTIONS.map(s => (
                                                            <option key={s.id} value={s.id}>{s.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            
                                            <div className="filter-actions">
                                                <button onClick={clearFilters} className="filter-clear-btn">
                                                    <i className="fas fa-undo"></i>
                                                    Filtreleri Temizle
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}
                                </div>
                                
                                {searchQuery.length > 2 ? (
                                    <div className="search-grid">
                                        {searchResults.filter(m => m.poster_path).map(m => (
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
                                                <div className="card-rating">
                                                    <i className="fas fa-star"></i>
                                                    {(m.vote_average || 0).toFixed(1)}
                                                </div>
                                                <div className="card-overlay">
                                                    <span className="card-title">{m.title || m.name}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="search-grid">
                                        {isDiscoverLoading && discoverResults.length === 0 ? (
                                            Array.from({ length: 12 }).map((_, i) => (
                                                <div key={i} className="skeleton search-grid-card"></div>
                                            ))
                                        ) : (
                                            <>
                                                {discoverResults.filter(m => m.poster_path).map(m => (
                                                    <button 
                                                        key={`${m.id}-${m.media_type}`} 
                                                        tabIndex="0" 
                                                        onClick={() => openDetail(m)} 
                                                        className="focusable poster-card search-grid-card"
                                                    >
                                                        <SmartImage 
                                                            src={POSTER_IMG + m.poster_path} 
                                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                                        />
                                                        <div className="card-rating">
                                                            <i className="fas fa-star"></i>
                                                            {(m.vote_average || 0).toFixed(1)}
                                                        </div>
                                                        <div className="card-type-badge">
                                                            {m.media_type === 'tv' ? 'Dizi' : 'Film'}
                                                        </div>
                                                        <div className="card-overlay">
                                                            <span className="card-title">{m.title || m.name}</span>
                                                        </div>
                                                    </button>
                                                ))}
                                                {discoverPage < discoverTotalPages && (
                                                    <button 
                                                        onClick={() => discoverContent(discoverPage + 1, false)}
                                                        className="focusable load-more-card search-grid-card"
                                                        disabled={isDiscoverLoading}
                                                    >
                                                        <div className="load-more-icon">
                                                            <i className={`fas fa-${isDiscoverLoading ? 'spinner fa-spin' : 'plus'}`}></i>
                                                        </div>
                                                        <span style={{ fontSize: '14px', fontWeight: '600' }}>
                                                            {isDiscoverLoading ? 'Yükleniyor...' : 'Daha Fazla'}
                                                        </span>
                                                    </button>
                                                )}
                                            </>
                                        )}
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
                        onOpenDetail={openDetail}
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
        </>
    );
};

export default App;
