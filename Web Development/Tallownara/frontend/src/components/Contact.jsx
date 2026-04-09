import { useState } from 'react';
import { useLang } from '../context/LanguageContext';

export default function Contact({ products }) {
  const { t, tHtml } = useLang();
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSending(true);
    setTimeout(() => {
      setSubmitted(true);
      setSending(false);
    }, 1000);
  };

  return (
    <section className="contact section" id="contact">
      <div className="container contact-grid">
        <div className="contact-text">
          <span className="section-tag">{t('contact.tag')}</span>
          <h2 dangerouslySetInnerHTML={{ __html: tHtml('contact.h2') }} />
          <p>{t('contact.sub')}</p>
          <div className="contact-channels">
            <div className="channel">
              <a href="https://wa.me/628158192911" target="_blank" rel="noopener noreferrer" className="channel-link">
                <span className="channel-icon channel-icon-brand" style={{ color: '#25d366' }}>
                  <i className="fa-brands fa-whatsapp"></i>
                </span>
                <div>
                  <strong>WhatsApp</strong>
                  <small>+62 895-391-334-398</small>
                </div>
              </a>
            </div>
            <div className="channel">
              <a href="https://www.instagram.com/tallownara" target="_blank" rel="noopener noreferrer" className="channel-link">
                <span className="channel-icon channel-icon-brand">
                  <i className="fa-brands fa-instagram"></i>
                </span>
                <div>
                  <strong>Instagram</strong>
                  <small>@tallownara</small>
                </div>
              </a>
            </div>
            <div className="channel">
              <a href="https://shopee.co.id/tallownara_id" target="_blank" rel="noopener noreferrer" className="channel-link">
                <span className="channel-icon channel-icon-brand">
                  <img src="https://cdn.simpleicons.org/shopee/ee4d2d" alt="Shopee" className="social-icon-img" />
                </span>
                <div>
                  <strong>Shopee</strong>
                  <small>tallownara_id</small>
                </div>
              </a>
            </div>
          </div>
        </div>

        <div className="contact-form-wrap">
          {!submitted ? (
            <form className="contact-form" onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="name">{t('contact.labelName')}</label>
                  <input type="text" id="name" placeholder={t('contact.placeholderName')} required />
                </div>
                <div className="form-group">
                  <label htmlFor="phone">{t('contact.labelPhone')}</label>
                  <input type="tel" id="phone" placeholder="+62 812 xxxx xxxx" />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="product">{t('contact.labelProduct')}</label>
                <select id="product">
                  <option value="">{t('contact.optDefault')}</option>
                  {(products.length > 0 ? products : [
                    { id: 1, name: 'Pure Tallow Balm' },
                    { id: 2, name: 'Baby Tallow Cream' },
                    { id: 3, name: 'Healing Salve' },
                    { id: 4, name: 'Whipped Tallow' },
                  ]).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                  <option>{t('contact.optInfo')}</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="message">{t('contact.labelMessage')}</label>
                <textarea id="message" rows="4" placeholder={t('contact.placeholderMessage')}></textarea>
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={sending}>
                {sending ? t('sending') : t('contact.send')}
              </button>
            </form>
          ) : (
            <div className="form-success visible">
              <span>{'\u2713'}</span>
              <strong>{t('contact.successTitle')}</strong>
              <p>{t('contact.successSub')}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
