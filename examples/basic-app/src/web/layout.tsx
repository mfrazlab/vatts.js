import React from 'react';
import {Metadata, router} from "vatts/react"
import './globals.css';
import {AnimatePresence, motion} from "framer-motion";
import {SessionProvider} from "@vatts/auth/react";

interface LayoutProps {
    children: React.ReactNode;
}


export const metadata: Metadata = {
    title: "Vatts JS | The Fast and Simple Web Framework for React",
    description: "The fastest and simplest web framework for React! Start building high-performance web applications today with Vatts JS.",
    keywords: ["Vatts JS", "web framework", "React", "JavaScript", "TypeScript", "web development", "fast", "simple", "SSR", "frontend"],
    author: "Vatts JS Team",
};

export default function Layout({ children }: LayoutProps) {
    return (
        <>{children}</>
    );
}
