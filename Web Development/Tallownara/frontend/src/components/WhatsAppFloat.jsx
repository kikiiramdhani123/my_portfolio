import { useLang } from '../context/LanguageContext';

export default function WhatsAppFloat() {
  const { t } = useLang();

  return (
    <a
      href="https://wa.me/628158192911"
      target="_blank"
      rel="noopener noreferrer"
      className="wa-float"
      aria-label="Chat with us on WhatsApp"
    >
      <i className="fa-brands fa-whatsapp"></i>
      <span className="wa-float-label">{t('wa.label')}</span>
    </a>
  );
}
