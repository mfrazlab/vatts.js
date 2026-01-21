import { useEffect, useState } from 'react';

/**
 * Lightweight prefers-reduced-motion hook.
 * Defaults to `false` on the server and updates after hydration.
 */
export function usePrefersReducedMotion() {
    const [reduced, setReduced] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return;

        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        const update = () => setReduced(!!media.matches);

        update();

        // Safari < 14 fallback
        if (typeof media.addEventListener === 'function') {
            media.addEventListener('change', update);
            return () => media.removeEventListener('change', update);
        }


        media.addListener(update);

        return () => media.removeListener(update);
    }, []);

    return reduced;
}
