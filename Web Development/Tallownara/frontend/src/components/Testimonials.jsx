import { useState } from 'react';
import { useLang } from '../context/LanguageContext';

const STATIC_TESTIMONIALS = [
  {
    id: 1, reviewer: 'Nama Pembeli', stars: 5,
    text: 'Tulis ulasan pembeli di sini...',
    product_name: 'Pure Tallow Balm', location: '',
  },
];

function TestimonialCard({ review, featured }) {
  const { lang, t } = useLang();
  const [expanded, setExpanded] = useState(false);

  const stars = '\u2605'.repeat(review.stars || 5) + '\u2606'.repeat(5 - (review.stars || 5));
  const initial = (review.reviewer || 'P')[0].toUpperCase();

  const locationStr = review.location
    ? `${review.product_name || ''} \u00b7 ${review.location} \u00b7 ${t('verifiedCustomer')}`
    : `${review.product_name || ''} \u00b7 ${t('verifiedCustomer')}`;

  return (
    <div className={`testimonial-card${featured ? ' featured' : ''}`}>
      <div className="stars">{stars}</div>
      <div className={`desc-clamp${expanded ? ' expanded' : ''}`}>
        <p>&ldquo;{review.text}&rdquo;</p>
      </div>
      <button className="read-more-btn" onClick={() => setExpanded(!expanded)}>
        {expanded ? t('showLess') : t('readMore')}
      </button>
      <div className="testimonial-author">
        <div className="author-avatar">{initial}</div>
        <div>
          <strong>{review.reviewer || 'Pelanggan'}</strong>
          <small>{locationStr}</small>
        </div>
      </div>
    </div>
  );
}

export default function Testimonials({ reviews }) {
  const { t, tHtml } = useLang();
  const items = reviews.length > 0 ? reviews : STATIC_TESTIMONIALS;

  return (
    <section className="testimonials section" id="testimonials">
      <div className="container">
        <div className="section-header">
          <span className="section-tag">{t('testimonials.tag')}</span>
          <h2 dangerouslySetInnerHTML={{ __html: tHtml('testimonials.h2') }} />
        </div>
        <div className="testimonials-grid">
          {items.map((r, i) => (
            <TestimonialCard key={r.id} review={r} featured={i === 1} />
          ))}
        </div>
      </div>
    </section>
  );
}
