import { useState, useEffect } from 'react';
import { useLang } from '../context/LanguageContext';
import { useScrollSpy } from '../hooks/useScrollSpy';

const SECTION_IDS = ['about', 'products', 'benefits', 'process', 'testimonials', 'contact'];

export default function Navbar() {
  const { lang, setLang, t } = useLang();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const activeSection = useScrollSpy(SECTION_IDS);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (!e.target.closest('.navbar')) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('click', onClickOutside);
    return () => document.removeEventListener('click', onClickOutside);
  }, []);

  const closeMenu = () => setMenuOpen(false);

  const navItems = [
    { href: '#about', key: 'nav.about' },
    { href: '#products', key: 'nav.products' },
    { href: '#benefits', key: 'nav.benefits' },
    { href: '#process', key: 'nav.process' },
    { href: '#testimonials', key: 'nav.reviews' },
  ];

  return (
    <header className={`navbar${scrolled ? ' scrolled' : ''}`} id="navbar">
      <div className="container nav-inner">
        <a href="#" className="logo">
          <span className="logo-icon">{'\u2726'}</span>
          Tallownara
        </a>

        <nav className={`nav-links${menuOpen ? ' open' : ''}`}>
          {navItems.map(({ href, key }) => (
            <a
              key={key}
              href={href}
              className={activeSection === href.slice(1) ? 'active' : ''}
              onClick={closeMenu}
            >
              {t(key)}
            </a>
          ))}
          <a href="#contact" className="btn btn-nav" onClick={closeMenu}>
            {t('nav.order')}
          </a>
        </nav>

        <div className="lang-switcher">
          <button
            className={`lang-btn${lang === 'en' ? ' active' : ''}`}
            onClick={() => setLang('en')}
          >
            EN
          </button>
          <span className="lang-divider">|</span>
          <button
            className={`lang-btn${lang === 'id' ? ' active' : ''}`}
            onClick={() => setLang('id')}
          >
            ID
          </button>
        </div>

        <button
          className={`hamburger${menuOpen ? ' open' : ''}`}
          aria-label="Toggle menu"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span></span><span></span><span></span>
        </button>
      </div>
    </header>
  );
}
