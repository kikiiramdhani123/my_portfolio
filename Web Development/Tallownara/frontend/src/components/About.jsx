import { useLang } from '../context/LanguageContext';
import AboutSlider from './AboutSlider';

const PILLARS = [
  { icon: '\ud83e\uddf4', titleKey: 'about.p1title', subKey: 'about.p1sub' },
  { icon: '\ud83d\udc8a', titleKey: 'about.p2title', subKey: 'about.p2sub' },
  { icon: '\ud83d\udc76', titleKey: 'about.p3title', subKey: 'about.p3sub' },
];

export default function About({ productImages }) {
  const { t, tHtml } = useLang();

  return (
    <section className="about section" id="about">
      <div className="container about-grid">
        <div className="about-image-wrap">
          <AboutSlider images={productImages} />
          <div className="about-badge-card">
            <span className="badge-icon">{'\ud83c\udf3f'}</span>
            <div>
              <strong>{t('about.badgeTitle')}</strong>
              <small>{t('about.badgeSub')}</small>
            </div>
          </div>
        </div>
        <div className="about-text">
          <span className="section-tag">{t('about.tag')}</span>
          <h2 dangerouslySetInnerHTML={{ __html: tHtml('about.h2') }} />
          <p>{t('about.p1')}</p>
          <p>{t('about.p2')}</p>
          <div className="about-pillars">
            {PILLARS.map(({ icon, titleKey, subKey }) => (
              <div className="pillar" key={titleKey}>
                <span className="pillar-icon">{icon}</span>
                <div>
                  <strong>{t(titleKey)}</strong>
                  <small>{t(subKey)}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
