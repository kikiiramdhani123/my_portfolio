import { useMemo } from 'react';
import { LanguageProvider } from './context/LanguageContext';
import { useApi } from './hooks/useApi';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import About from './components/About';
import Products from './components/Products';
import Benefits from './components/Benefits';
import Process from './components/Process';
import Testimonials from './components/Testimonials';
import Contact from './components/Contact';
import Footer from './components/Footer';
import WhatsAppFloat from './components/WhatsAppFloat';
import './App.css';

function AppContent() {
  const { products, reviews } = useApi();

  const productImages = useMemo(
    () => products.map(p => p.image_url).filter(Boolean),
    [products]
  );

  return (
    <>
      <Navbar />
      <Hero />
      <About productImages={productImages} />
      <Products products={products} />
      <Benefits />
      <Process />
      <Testimonials reviews={reviews} />
      <Contact products={products} />
      <Footer products={products} />
      <WhatsAppFloat />
    </>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}
