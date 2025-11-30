import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const IntroAnimation = ({ onComplete }) => {
  const [phase, setPhase] = useState(0);
  const [showLetter, setShowLetter] = useState({ N: false, O: false, X: false, I: false, S: false });
  const [currentSubtitle, setCurrentSubtitle] = useState('');
  const [showFinalLogo, setShowFinalLogo] = useState(false);
  const [introComplete, setIntroComplete] = useState(false);
  const [timers, setTimers] = useState([]);

  const handleSkip = () => {
    timers.forEach(clearTimeout);
    setIntroComplete(true);
    onComplete && onComplete();
  };

  useEffect(() => {
    const timeline = [
      { time: 0, action: () => setPhase(1) },
      { time: 2000, action: () => setPhase(2) },
      { time: 5000, action: () => setPhase(3) },
      { time: 6000, action: () => { setShowLetter(p => ({ ...p, N: true })); setCurrentSubtitle('New'); } },
      { time: 6300, action: () => setCurrentSubtitle('') },
      { time: 6800, action: () => { setShowLetter(p => ({ ...p, O: true })); setCurrentSubtitle('Ocular'); } },
      { time: 7100, action: () => setCurrentSubtitle('') },
      { time: 7600, action: () => { setShowLetter(p => ({ ...p, X: true })); setCurrentSubtitle('eXperience'); } },
      { time: 7900, action: () => setCurrentSubtitle('') },
      { time: 8400, action: () => { setShowLetter(p => ({ ...p, I: true })); setCurrentSubtitle('Is'); } },
      { time: 8700, action: () => setCurrentSubtitle('') },
      { time: 9200, action: () => { setShowLetter(p => ({ ...p, S: true })); setCurrentSubtitle('Starting'); } },
      { time: 9500, action: () => setCurrentSubtitle('') },
      { time: 10000, action: () => { setPhase(4); setShowFinalLogo(true); } },
      { time: 12000, action: () => setIntroComplete(true) },
      { time: 12500, action: () => onComplete && onComplete() }
    ];

    const newTimers = timeline.map(({ time, action }) => setTimeout(action, time));
    setTimers(newTimers);
    return () => newTimers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {!introComplete && (
        <motion.div
          className="intro-container"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            position: 'fixed',
            inset: 0,
            background: '#000000',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
          }}
        >
          {phase >= 1 && <SparkPhase phase={phase} />}
          {phase >= 2 && <GeometricShapes phase={phase} />}
          {phase >= 3 && (
            <LetterSequence 
              showLetter={showLetter} 
              currentSubtitle={currentSubtitle}
              showFinalLogo={showFinalLogo}
            />
          )}
          {phase >= 4 && <FinalLogo show={showFinalLogo} />}
          <ParticleField phase={phase} />
          
          <motion.button
            className="intro-skip-btn"
            onClick={handleSkip}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            whileHover={{ opacity: 1, scale: 1.05 }}
            transition={{ delay: 1, duration: 0.5 }}
          >
            Atla
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const SparkPhase = ({ phase }) => {
  return (
    <>
      <motion.div
        className="spark-core"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ 
          scale: phase >= 2 ? [1, 1.5, 0.8] : [0, 1, 1.2, 1],
          opacity: phase >= 3 ? 0 : 1
        }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        style={{
          position: 'absolute',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, #C8A2C8 0%, #9370DB 50%, #8A2BE2 100%)',
          boxShadow: `
            0 0 20px #C8A2C8,
            0 0 40px #9370DB,
            0 0 60px #8A2BE2,
            0 0 80px rgba(138, 43, 226, 0.5)
          `,
          zIndex: 10
        }}
      />
      
      <motion.div
        className="spark-pulse"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ 
          scale: [0, 3, 6],
          opacity: [0.8, 0.4, 0]
        }}
        transition={{ duration: 2, ease: "easeOut", delay: 0.3 }}
        style={{
          position: 'absolute',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          border: '2px solid #C8A2C8',
          zIndex: 5
        }}
      />

      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          className="dust-particle"
          initial={{ 
            x: 0, 
            y: 0, 
            scale: 0, 
            opacity: 0 
          }}
          animate={{ 
            x: Math.cos(i * 30 * Math.PI / 180) * (50 + Math.random() * 100),
            y: Math.sin(i * 30 * Math.PI / 180) * (50 + Math.random() * 100),
            scale: [0, 1, 0.5],
            opacity: [0, 0.8, 0]
          }}
          transition={{ 
            duration: 2, 
            delay: 0.5 + i * 0.05,
            ease: "easeOut"
          }}
          style={{
            position: 'absolute',
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            background: 'rgba(200, 162, 200, 0.6)',
            boxShadow: '0 0 10px rgba(200, 162, 200, 0.8)',
            zIndex: 8
          }}
        />
      ))}
    </>
  );
};

const GeometricShapes = ({ phase }) => {
  const shapes = [
    { x: -150, y: -80, rotation: 45, delay: 0, size: 60 },
    { x: 120, y: -100, rotation: -30, delay: 0.2, size: 80 },
    { x: -100, y: 100, rotation: 60, delay: 0.4, size: 50 },
    { x: 180, y: 60, rotation: -45, delay: 0.3, size: 70 },
    { x: 0, y: -150, rotation: 15, delay: 0.1, size: 55 },
    { x: -200, y: 0, rotation: -60, delay: 0.5, size: 45 },
    { x: 200, y: -50, rotation: 30, delay: 0.25, size: 65 },
    { x: 50, y: 120, rotation: -15, delay: 0.35, size: 75 }
  ];

  return (
    <>
      {shapes.map((shape, i) => (
        <motion.div
          key={i}
          initial={{ 
            x: shape.x * 3,
            y: shape.y * 3,
            rotate: shape.rotation,
            opacity: 0,
            scale: 0.3
          }}
          animate={{ 
            x: phase >= 3 ? 0 : shape.x,
            y: phase >= 3 ? 0 : shape.y,
            rotate: phase >= 3 ? 0 : shape.rotation + 360,
            opacity: phase >= 3 ? 0 : [0, 0.7, 0.5],
            scale: phase >= 3 ? 0 : [0.3, 1, 0.9]
          }}
          transition={{ 
            duration: phase >= 3 ? 0.5 : 2,
            delay: shape.delay,
            ease: "easeOut"
          }}
          style={{
            position: 'absolute',
            width: shape.size,
            height: shape.size,
            borderRadius: i % 3 === 0 ? '20%' : i % 3 === 1 ? '50%' : '10%',
            background: `linear-gradient(
              135deg,
              rgba(200, 162, 200, 0.15) 0%,
              rgba(147, 112, 219, 0.1) 50%,
              rgba(138, 43, 226, 0.05) 100%
            )`,
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(200, 162, 200, 0.3)',
            boxShadow: `
              0 0 20px rgba(138, 43, 226, 0.2),
              inset 0 0 20px rgba(200, 162, 200, 0.1)
            `,
            zIndex: 6
          }}
        />
      ))}
      
      <motion.div
        className="dna-helix"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ 
          opacity: phase >= 3 ? 0 : [0, 0.6, 0.4],
          scale: phase >= 3 ? 0 : 1,
          rotate: phase >= 3 ? 180 : 0
        }}
        transition={{ duration: phase >= 3 ? 0.5 : 2, delay: 0.3 }}
        style={{
          position: 'absolute',
          width: '200px',
          height: '200px',
          border: '2px solid transparent',
          borderImage: 'linear-gradient(45deg, rgba(200, 162, 200, 0.5), transparent) 1',
          borderRadius: '50%',
          zIndex: 7
        }}
      />
    </>
  );
};

const LetterSequence = ({ showLetter, currentSubtitle, showFinalLogo }) => {
  const letterData = [
    { char: 'N', show: showLetter.N },
    { char: 'O', show: showLetter.O },
    { char: 'X', show: showLetter.X },
    { char: 'I', show: showLetter.I },
    { char: 'S', show: showLetter.S }
  ];

  return (
    <motion.div
      style={{
        position: 'absolute',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        zIndex: 20
      }}
      animate={{
        opacity: showFinalLogo ? 0 : 1,
        scale: showFinalLogo ? 0.8 : 1,
        y: showFinalLogo ? -50 : 0
      }}
      transition={{ duration: 0.5 }}
    >
      <div style={{ 
        display: 'flex', 
        gap: '8px',
        marginBottom: '20px'
      }}>
        {letterData.map((letter, i) => (
          <motion.div
            key={letter.char}
            initial={{ 
              scale: 0,
              opacity: 0,
              y: 50,
              rotateX: -90
            }}
            animate={letter.show ? {
              scale: [0, 1.3, 1],
              opacity: 1,
              y: 0,
              rotateX: 0
            } : {}}
            transition={{
              duration: 0.4,
              ease: [0.25, 0.46, 0.45, 0.94]
            }}
            style={{
              position: 'relative'
            }}
          >
            {letter.show && (
              <motion.div
                className="impact-flash"
                initial={{ scale: 0, opacity: 1 }}
                animate={{ scale: [0, 3], opacity: [1, 0] }}
                transition={{ duration: 0.3 }}
                style={{
                  position: 'absolute',
                  inset: '-20px',
                  background: 'radial-gradient(circle, rgba(200, 162, 200, 0.8) 0%, transparent 70%)',
                  borderRadius: '50%',
                  zIndex: -1
                }}
              />
            )}
            <span
              style={{
                fontSize: 'clamp(48px, 12vw, 120px)',
                fontWeight: '800',
                fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
                letterSpacing: '-0.02em',
                background: letter.char === 'X' 
                  ? 'linear-gradient(135deg, #E6E6FA 0%, #C8A2C8 50%, #9370DB 100%)'
                  : 'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(200, 162, 200, 0.8) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                textShadow: 'none',
                filter: `drop-shadow(0 0 20px rgba(200, 162, 200, 0.5)) 
                         drop-shadow(0 0 40px rgba(138, 43, 226, 0.3))`,
                display: 'block'
              }}
            >
              {letter.char}
            </span>
          </motion.div>
        ))}
      </div>
      
      <AnimatePresence mode="wait">
        {currentSubtitle && (
          <motion.div
            key={currentSubtitle}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 0.6, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            style={{
              fontSize: 'clamp(14px, 3vw, 24px)',
              fontWeight: '300',
              letterSpacing: '0.3em',
              color: 'rgba(200, 162, 200, 0.7)',
              textTransform: 'uppercase',
              fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
            }}
          >
            {currentSubtitle}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const FinalLogo = ({ show }) => {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={show ? { 
        scale: [0, 1.1, 1],
        opacity: 1
      } : {}}
      transition={{ 
        duration: 0.8,
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
      style={{
        position: 'absolute',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        zIndex: 30
      }}
    >
      <motion.div
        className="logo-glow"
        initial={{ opacity: 0 }}
        animate={show ? { opacity: [0, 1, 0.7] } : {}}
        transition={{ duration: 1, delay: 0.3 }}
        style={{
          position: 'absolute',
          width: '300px',
          height: '300px',
          background: 'radial-gradient(circle, rgba(200, 162, 200, 0.3) 0%, rgba(138, 43, 226, 0.1) 50%, transparent 70%)',
          borderRadius: '50%',
          filter: 'blur(30px)',
          zIndex: -1
        }}
      />
      
      <motion.svg 
        viewBox="0 0 50 53" 
        style={{ 
          width: 'clamp(80px, 15vw, 140px)',
          height: 'auto',
          marginBottom: '20px'
        }}
        initial={{ filter: 'drop-shadow(0 0 0px rgba(200, 162, 200, 0))' }}
        animate={show ? { 
          filter: 'drop-shadow(0 0 30px rgba(200, 162, 200, 0.8))'
        } : {}}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <defs>
          <linearGradient id="introLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#C8A2C8', stopOpacity: 1 }} />
            <stop offset="50%" style={{ stopColor: '#9370DB', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#8A2BE2', stopOpacity: 1 }} />
          </linearGradient>
          <linearGradient id="introRibbonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#E6E6FA', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#C8A2C8', stopOpacity: 1 }} />
          </linearGradient>
        </defs>
        <g transform="translate(0, 0)">
          <path 
            d="M5 45 L5 8 Q5 5 8 5 L12 5 Q15 5 15 8 L15 32 L32 8 Q34 5 38 5 L42 5 Q45 5 45 8 L45 45 Q45 48 42 48 L38 48 Q35 48 35 45 L35 20 L18 44 Q16 48 12 48 L8 48 Q5 48 5 45 Z" 
            fill="url(#introLogoGrad)"
          />
          <path 
            d="M38 5 Q50 15 45 30 Q42 40 35 45" 
            stroke="url(#introRibbonGrad)" 
            strokeWidth="3" 
            fill="none" 
            strokeLinecap="round"
          />
          <path 
            d="M28 20 L40 28 L28 36 Z" 
            fill="url(#introRibbonGrad)" 
            opacity="0.8"
          />
        </g>
      </motion.svg>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={show ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, delay: 0.6 }}
        style={{
          fontSize: 'clamp(32px, 8vw, 56px)',
          fontWeight: '300',
          letterSpacing: '0.4em',
          background: 'linear-gradient(180deg, #fff 0%, rgba(200, 162, 200, 0.9) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
        }}
      >
        NOXIS
      </motion.div>
      
      <motion.div
        initial={{ opacity: 0, scaleX: 0 }}
        animate={show ? { opacity: 0.5, scaleX: 1 } : {}}
        transition={{ duration: 0.8, delay: 0.8 }}
        style={{
          marginTop: '16px',
          fontSize: 'clamp(10px, 2vw, 14px)',
          fontWeight: '400',
          letterSpacing: '0.3em',
          color: 'rgba(200, 162, 200, 0.6)',
          textTransform: 'uppercase',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
        }}
      >
        New Ocular Experience Is Starting
      </motion.div>
    </motion.div>
  );
};

const ParticleField = ({ phase }) => {
  const particles = [...Array(30)].map((_, i) => ({
    x: (Math.random() - 0.5) * window.innerWidth,
    y: (Math.random() - 0.5) * window.innerHeight,
    size: Math.random() * 3 + 1,
    delay: Math.random() * 2,
    duration: Math.random() * 3 + 2
  }));

  return (
    <>
      {particles.map((p, i) => (
        <motion.div
          key={i}
          initial={{ 
            x: p.x,
            y: p.y,
            opacity: 0,
            scale: 0
          }}
          animate={phase >= 1 ? {
            opacity: [0, 0.5, 0],
            scale: [0, 1, 0],
            y: [p.y, p.y - 100]
          } : {}}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            repeatDelay: Math.random() * 2
          }}
          style={{
            position: 'absolute',
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: 'rgba(200, 162, 200, 0.6)',
            boxShadow: '0 0 6px rgba(200, 162, 200, 0.8)',
            zIndex: 1
          }}
        />
      ))}
    </>
  );
};

export default IntroAnimation;
