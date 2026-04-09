import { useLang } from '../context/LanguageContext';

const BENEFITS = [
  { icon: '\ud83d\udd2c', titleKey: 'benefits.b1title', descKey: 'benefits.b1desc' },
  { icon: '\ud83c\udf3e', titleKey: 'benefits.b2title', descKey: 'benefits.b2desc' },
  { icon: '\ud83d\udee1\ufe0f', titleKey: 'benefits.b3title', descKey: 'benefits.b3desc' },
  { icon: '\ud83c\udf38', titleKey: 'benefits.b4title', descKey: 'benefits.b4desc' },
  { icon: '\ud83d\udeab', titleKey: 'benefits.b5title', descKey: 'benefits.b5desc' },
  { icon: '\u267b\ufe0f', titleKey: 'benefits.b6title', descKey: 'benefits.b6desc' },
];

export default function Benefits() {
  const { t, tHtml } = useLang();

  return (
    <section className="benefits section" id="benefits">
      <div className="container">
        <div className="section-header light">
          <span className="section-tag">{t('benefits.tag')}</span>
          <h2 dangerouslySetInnerHTML={{ __html: tHtml('benefits.h2') }} />
          <p>{t('benefits.sub')}</p>
        </div>
        <div className="benefits-grid">
          {BENEFITS.map(({ icon, titleKey, descKey }) => (
            <div className="benefit-card" key={titleKey}>
              <div className="benefit-icon">{icon}</div>
              <h4>{t(titleKey)}</h4>
              <p>{t(descKey)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
