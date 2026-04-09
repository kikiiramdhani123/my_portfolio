import { useState, useEffect } from 'react';

export function useScrollSpy(sectionIds) {
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    const onScroll = () => {
      let current = '';
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el && window.scrollY >= el.offsetTop - 100) {
          current = id;
        }
      }
      setActiveId(current);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [sectionIds]);

  return activeId;
}
