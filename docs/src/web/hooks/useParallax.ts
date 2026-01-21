import { useEffect } from 'react';

type ParallaxOptions = {
    /** Max translate in px at full scroll progress of the page. */
    intensity?: number;
    /** Axis to move. */
    axis?: 'y' | 'x';
    /** If true, invert movement direction. */
    invert?: boolean;
};

/**
 * rAF-based parallax for a single element.
 * Applies `transform: translate3d(...)` inline for best perf.
 */
export function useParallax(
    ref: React.RefObject<HTMLElement | null>,
    enabled: boolean,
    { intensity = 24, axis = 'y', invert = false }: ParallaxOptions = {}
) {
    useEffect(() => {
        if (!enabled) return;
        const el = ref.current;
        if (!el) return;
        if (typeof window === 'undefined') return;

        let raf = 0;

        const update = () => {
            raf = 0;
            const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
            const progress = window.scrollY / maxScroll;
            const value = (invert ? -1 : 1) * (progress - 0.5) * 2 * intensity;

            if (axis === 'x') {
                el.style.transform = `translate3d(${value.toFixed(2)}px, 0, 0)`;
            } else {
                el.style.transform = `translate3d(0, ${value.toFixed(2)}px, 0)`;
            }
        };

        const onScroll = () => {
            if (raf) return;
            raf = window.requestAnimationFrame(update);
        };

        update();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);

        return () => {
            if (raf) window.cancelAnimationFrame(raf);
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener('resize', onScroll);
        };
    }, [axis, enabled, intensity, invert, ref]);
}
