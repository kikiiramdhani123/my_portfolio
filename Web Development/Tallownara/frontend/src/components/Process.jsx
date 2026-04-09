import { useLang } from '../context/LanguageContext';

const STEPS = [
  { num: '01', icon: '\ud83d\udc04', titleKey: 'process.s1title', descKey: 'process.s1desc' },
  { num: '02', icon: '\ud83d\udd25', titleKey: 'process.s2title', descKey: 'process.s2desc' },
  { num: '03', icon: '\ud83e\uddea', titleKey: 'process.s3title', descKey: 'process.s3desc' },
  { num: '04', icon: '\ud83e\ude87', titleKey: 'process.s4title', descKey: 'process.s4desc' },
];

export default function Process() {
  const { t, tHtml } = useLang();

  return (
    <section className="process section" id="process">
      <div className="container">
        <div className="section-header">
          <span className="section-tag">{t('process.tag')}</span>
          <h2 dangerouslySetInnerHTML={{ __html: tHtml('process.h2') }} />
          <p>{t('process.sub')}</p>
        </div>
        <div className="process-steps">
          {STEPS.map((step, i) => (
            <span key={step.num} style={{ display: 'contents' }}>
              <div className="process-step">
                <div className="step-number">{step.num}</div>
                <div className="step-image">
                  <div className="placeholder-image small">
                    <div className="placeholder-label">
                      <span className="ph-icon">{step.icon}</span>
                      <span>{t(step.titleKey)}</span>
                    </div>
                  </div>
                </div>
                <div className="step-text">
                  <h4>{t(step.titleKey)}</h4>
                  <p>{t(step.descKey)}</p>
                </div>
              </div>
              {i < STEPS.length - 1 && <div className="process-connector"></div>}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
