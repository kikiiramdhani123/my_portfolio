import { useState, useEffect } from 'react';

export function useApi() {
  const [products, setProducts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/products').then(r => r.json()),
      fetch('/api/reviews?landing=1').then(r => r.json()),
    ])
      .then(([prods, revs]) => {
        setProducts(prods);
        setReviews(revs.slice(0, 3));
        setLoaded(true);
      })
      .catch(() => {
        console.info('API not available, using static content.');
        setLoaded(true);
      });
  }, []);

  return { products, reviews, loaded };
}
