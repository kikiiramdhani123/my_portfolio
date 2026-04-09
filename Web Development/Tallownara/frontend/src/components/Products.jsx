import { useLang } from '../context/LanguageContext';
import ProductCard from './ProductCard';

const STATIC_PRODUCTS = [
  {
    id: 1, name: 'Pure Tallow Balm',
    description_en: 'Our flagship product. Unscented, pure rendered tallow \u2014 a deeply nourishing moisturizer for face, body, and hands.',
    description_id: 'Produk unggulan kami. Tanpa wewangian, tallow murni yang diproses \u2014 pelembap yang sangat menutrisi untuk wajah, tubuh, dan tangan.',
    variants: ['60g', '120g'], price: 'Rp 00.000', image_url: '', rating_star: 5, sold: 0,
    shopee_url: 'https://shopee.co.id/tallownara_id',
  },
  {
    id: 2, name: 'Baby Tallow Cream',
    description_en: 'Extra-gentle formula specially made for newborn and infant skin \u2014 soothes diaper rash, cradle cap, and dry patches.',
    description_id: 'Formula sangat lembut yang khusus dibuat untuk kulit bayi baru lahir \u2014 meredakan ruam popok, cradle cap, dan kulit kering.',
    variants: ['60g'], price: 'Rp 00.000', image_url: '', rating_star: 5, sold: 0,
    shopee_url: 'https://shopee.co.id/tallownara_id',
  },
  {
    id: 3, name: 'Healing Salve',
    description_en: 'Medicinal-grade tallow blended with calendula and beeswax \u2014 formulated to accelerate wound healing, eczema, and burns.',
    description_id: 'Tallow berkualitas medis yang dipadukan dengan calendula dan beeswax \u2014 diformulasikan untuk mempercepat penyembuhan luka dan eksim.',
    variants: ['30g', '60g'], price: 'Rp 00.000', image_url: '', rating_star: 5, sold: 0,
    shopee_url: 'https://shopee.co.id/tallownara_id',
  },
  {
    id: 4, name: 'Whipped Tallow',
    description_en: 'Light, airy texture \u2014 same powerful benefits in a fluffy consistency that melts instantly on contact with the skin.',
    description_id: 'Tekstur ringan dan lembut \u2014 manfaat yang sama dalam konsistensi fluffy yang langsung meleleh saat menyentuh kulit.',
    variants: ['80g'], price: 'Rp 00.000', image_url: '', rating_star: 5, sold: 0,
    shopee_url: 'https://shopee.co.id/tallownara_id',
  },
];

export default function Products({ products }) {
  const { t, tHtml } = useLang();
  const items = products.length > 0 ? products : STATIC_PRODUCTS;

  return (
    <section className="products section" id="products">
      <div className="container">
        <div className="section-header">
          <span className="section-tag">{t('products.tag')}</span>
          <h2 dangerouslySetInnerHTML={{ __html: tHtml('products.h2') }} />
          <p>{t('products.sub')}</p>
        </div>
        <div className="products-grid">
          {items.map((p, i) => (
            <ProductCard key={p.id} product={p} featured={i === 0} />
          ))}
        </div>
      </div>
    </section>
  );
}
