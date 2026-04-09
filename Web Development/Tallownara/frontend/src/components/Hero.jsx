import { useLang } from '../context/LanguageContext';

export default function Hero() {
  const { t, tHtml } = useLang();

  return (
    <section className="hero" id="hero">
      <div className="hero-bg"></div>
      <div className="container hero-content">
        <span className="hero-badge">{t('hero.badge')}</span>
        <h1 dangerouslySetInnerHTML={{ __html: tHtml('hero.h1') }} />
        <p className="hero-sub">{t('hero.sub')}</p>
        <div className="hero-cta">
          <a href="#products" className="btn btn-primary">{t('hero.cta1')}</a>
          <a
            href="https://shopee.co.id/tallownara_id"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost"
          >
            {t('hero.cta2')}
          </a>
        </div>
        <div className="hero-stats">
          <div className="stat">
            <strong>100%</strong><span>{t('hero.stat1')}</span>
          </div>
          <div className="stat-divider"></div>
          <div className="stat">
            <strong>0</strong><span>{t('hero.stat2')}</span>
          </div>
          <div className="stat-divider"></div>
          <div className="stat">
            <strong>{t('hero.stat3val')}</strong><span>{t('hero.stat3')}</span>
          </div>
        </div>
      </div>
      <div className="hero-scroll-hint">
        <span>{t('hero.scroll')}</span>
        <div className="scroll-arrow"></div>
      </div>
    </section>
  );
}
