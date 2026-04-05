import { useState, useEffect } from 'react';

export function useSmartNav() {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Determine if scrolled past the very top to trigger padding reduction/shadow
      setScrolled(currentScrollY > 20);

      // Determine visibility on mobile
      if (currentScrollY > lastScrollY && currentScrollY > 80) {
        // Scrolling down past threshold -> hide
        setHidden(true);
      } else if (currentScrollY < lastScrollY) {
        // Scrolling up -> show
        setHidden(false);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  return { scrolled, hidden };
}
