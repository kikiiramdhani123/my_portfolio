import { useLang } from '../context/LanguageContext';

export default function Footer({ products }) {
  const { t, tHtml } = useLang();

  const productNames = products.length > 0
    ? products.map(p => p.name)
    : ['Pure Tallow Balm', 'Baby Tallow Cream', 'Healing Salve', 'Whipped Tallow'];

  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <a href="#" className="logo">
            <span className="logo-icon">{'\u2726'}</span>
            Tallownara
          </a>
          <p dangerouslySetInnerHTML={{ __html: tHtml('footer.tagline') }} />
          <div className="footer-socials">
            <a href="https://www.instagram.com/tallownara" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <i className="fa-brands fa-instagram"></i>
            </a>
            <a href="https://shopee.co.id/tallownara_id" target="_blank" rel="noopener noreferrer" aria-label="Shopee">
              <img src="https://cdn.simpleicons.org/shopee/ffffff" alt="Shopee" className="social-icon-img" />
            </a>
            <a href="https://wa.me/628158192911" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
              <i className="fa-brands fa-whatsapp"></i>
            </a>
          </div>
        </div>
        <div className="footer-links">
          <div className="footer-col">
            <strong>{t('footer.col1title')}</strong>
            {productNames.map(name => (
              <a href="#products" key={name}>{name}</a>
            ))}
          </div>
          <div className="footer-col">
            <strong>{t('footer.col2title')}</strong>
            <a href="#about">{t('footer.col2about')}</a>
            <a href="#process">{t('footer.col2process')}</a>
            <a href="#benefits">{t('footer.col2benefits')}</a>
            <a href="#testimonials">{t('footer.col2reviews')}</a>
          </div>
          <div className="footer-col">
            <strong>{t('footer.col3title')}</strong>
            <a href="#contact">{t('footer.col3contact')}</a>
            <a href="#">{t('footer.col3shipping')}</a>
            <a href="#">FAQ</a>
            <a href="#">{t('footer.col3returns')}</a>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="container">
          <small>{t('footer.copyright')}</small>
        </div>
      </div>
    </footer>
  );
}
