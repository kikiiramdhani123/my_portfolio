import { useState, useEffect, useRef, useCallback } from 'react';

export default function AboutSlider({ images }) {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef(null);
  const sliderRef = useRef(null);
  const touchStartX = useRef(0);

  const count = images.length;

  const goTo = useCallback((idx) => {
    setCurrent(((idx % count) + count) % count);
  }, [count]);

  const startAuto = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => goTo(current + 1), 4000);
  }, [current, goTo]);

  useEffect(() => {
    if (count <= 1) return;
    timerRef.current = setInterval(() => {
      setCurrent(prev => (prev + 1) % count);
    }, 4000);
    return () => clearInterval(timerRef.current);
  }, [count]);

  const handlePrev = () => {
    goTo(current - 1);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setCurrent(prev => (prev + 1) % count), 4000);
  };

  const handleNext = () => {
    goTo(current + 1);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setCurrent(prev => (prev + 1) % count), 4000);
  };

  const handleDot = (idx) => {
    goTo(idx);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setCurrent(prev => (prev + 1) % count), 4000);
  };

  const handleMouseEnter = () => clearInterval(timerRef.current);
  const handleMouseLeave = () => {
    if (count > 1) {
      timerRef.current = setInterval(() => setCurrent(prev => (prev + 1) % count), 4000);
    }
  };

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      diff > 0 ? handleNext() : handlePrev();
    }
  };

  if (count === 0) {
    return (
      <div className="about-slider">
        <div className="placeholder-image large about-slider-fallback">
          <div className="placeholder-label">
            <span className="ph-icon">{'\ud83d\udc04'}</span>
            <span>Product / Brand Image</span>
          </div>
        </div>
      </div>
    );
  }

  if (count === 1) {
    return (
      <div className="about-slider">
        <img
          src={images[0]}
          alt="Tallownara product"
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit', display: 'block' }}
        />
      </div>
    );
  }

  return (
    <div
      className="about-slider"
      ref={sliderRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="about-slider-track"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {images.map((src, i) => (
          <div className="about-slider-slide" key={i}>
            <img src={src} alt="Tallownara product" loading="lazy" />
          </div>
        ))}
      </div>
      <button className="slider-btn prev" onClick={handlePrev} aria-label="Previous">{'\u2190'}</button>
      <button className="slider-btn next" onClick={handleNext} aria-label="Next">{'\u2192'}</button>
      <div className="slider-dots">
        {images.map((_, i) => (
          <button
            key={i}
            className={`slider-dot${i === current ? ' active' : ''}`}
            onClick={() => handleDot(i)}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
