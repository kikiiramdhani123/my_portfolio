import { useState } from 'react';
import { useLang } from '../context/LanguageContext';

function getProductEmoji(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('baby') || n.includes('bayi')) return '\ud83d\udc76';
  if (n.includes('salve') || n.includes('salep')) return '\ud83e\ude79';
  if (n.includes('whipped') || n.includes('kocok')) return '\u2728';
  return '\ud83e\ude87';
}

function starStr(rating, count) {
  const full = Math.round(parseFloat(rating) || 5);
  const empty = 5 - full;
  return { stars: '\u2605'.repeat(full) + '\u2606'.repeat(empty), count };
}

export default function ProductCard({ product, featured }) {
  const { lang, t } = useLang();
  const [expanded, setExpanded] = useState(false);

  const emoji = getProductEmoji(product.name);
  const { stars, count } = starStr(product.rating_star, product.sold || 0);

  const description = lang === 'id'
    ? (product.description_id || product.description_en)
    : product.description_en;

  return (
    <div className={`product-card${featured ? ' featured' : ''}`}>
      {featured && <div className="product-badge">{t('products.bestseller')}</div>}
      <div
        className="placeholder-image medium"
        style={product.image_url ? { padding: 0, overflow: 'hidden' } : undefined}
      >
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div className="placeholder-label">
            <span className="ph-icon">{emoji}</span>
            <span>{product.name}</span>
          </div>
        )}
      </div>
      <div className="product-info">
        <h3>{product.name}</h3>
        <div className="product-rating-row">
          {stars}
          {count > 0 && <span className="sold-count">{'\u00b7'} {count} terjual</span>}
        </div>
        <div className={`desc-clamp${expanded ? ' expanded' : ''}`}>
          <p className="product-desc">{description}</p>
        </div>
        <button className="read-more-btn" onClick={() => setExpanded(!expanded)}>
          {expanded ? t('showLess') : t('readMore')}
        </button>
        <ul className="product-tags">
          {(product.variants || []).slice(0, 3).map((v, i) => (
            <li key={i}>{v}</li>
          ))}
          {product.price && <li className="price-tag">{product.price}</li>}
        </ul>
        <a
          href={product.shopee_url || 'https://shopee.co.id/tallownara_id'}
          target="_blank"
          rel="noopener noreferrer"
          className={`btn ${featured ? 'btn-primary' : 'btn-outline'} btn-sm`}
        >
          {t('products.order')}
        </a>
      </div>
    </div>
  );
}
