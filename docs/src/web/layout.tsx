import React from 'react';
import {Metadata, router} from "vatts/react"
import './globals.css';
import {AnimatePresence, motion} from "framer-motion";
import 'prismjs/themes/prism-tomorrow.css'; // Tema escuro do Prism
interface LayoutProps {
    children: React.ReactNode;
}

export const metadata: Metadata = {
    title: "Vatts.js | The Fastest Framework for React",
    description: "The fastest and simplest web framework for React! Start building high-performance web applications today with Vatts.js.",
    favicon: '/logo.png',
    scripts: {
        "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2662588853991140": {
            "crossorigin": 'anonymous',
            "async": ""
        }
    }
};

export default function Layout({ children }: LayoutProps) {
    // Animação Modernizada: Leve escala (zoom in/out) com desfoque
    const variants = {
        hidden: { opacity: 0, scale: 0.98, filter: "blur(5px)" },
        enter: { opacity: 1, scale: 1, filter: "blur(0px)" },
        exit: { opacity: 0, scale: 0.98, filter: "blur(5px)" },
    };

    return (
        <AnimatePresence
            mode="wait"
            onExitComplete={() => window.scrollTo(0, 0)}
        >
            <motion.div
                key={router.pathname}
                variants={variants}
                initial="hidden"
                animate="enter"
                exit="exit"
                // Curva de transição mais fluida e um pouco mais rápida
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className={"bg-black"}
            >
                {children}
            </motion.div>
        </AnimatePresence>
    );
}