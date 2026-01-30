import introductionMd from "../docs/vatts/getting-started.md";
import installationMd from "../docs/vatts/installation.md";
import projectStructureMd from "../docs/vatts/project-structure.md";
import layoutMd from "../docs/vatts/layout.md";
import routingMd from "../docs/vatts/routing.md";
import rpcMd from "../docs/vatts/rpc.md";
import middlewaresMd from "../docs/vatts/middleware.md";
import componentsMd from "../docs/vatts/components.md";
import gettingStartAuthMd from "../docs/auth/getting-started.md";
import installationAuthMd from "../docs/auth/installation.md";
import providersAuthMd from "../docs/auth/providers.md";
import sessionsAuthMd from "../docs/auth/session.md";
import protectingRoutesAuthMd from "../docs/auth/protecting-routes.md";
import customProvidersAuthMd from "../docs/auth/custom-providers.md";


export type SearchDoc = {
    id: string;
    label: string;
    category?: string;
    href: string;
    content?: string;
};


export type SearchHit = {
    id: string;
    label: string;
    category?: string;
    href: string;
    score: number;
    snippet?: string;
};



function makeSnippet(content: string, queryNorm: string) {
    const normalized = content.replace(/\s+/g, ' ');
    const lower = normalize(normalized);
    const idx = lower.indexOf(queryNorm);
    if (idx === -1) return undefined;

    // Map idx in normalized/diacritics-stripped to original is hard; keep it simple:
    // use the raw lowercased index against raw lowercased string.
    const rawLower = normalized.toLowerCase();
    const rawIdx = rawLower.indexOf(queryNorm);
    if (rawIdx === -1) return undefined;

    const start = Math.max(0, rawIdx - 70);
    const end = Math.min(normalized.length, rawIdx + queryNorm.length + 90);
    const prefix = start > 0 ? '…' : '';
    const suffix = end < normalized.length ? '…' : '';
    return `${prefix}${normalized.slice(start, end)}${suffix}`;
}

export function searchDocs(docs: SearchDoc[], query: string, limit = 12): SearchHit[] {
    const q = normalize(query);
    if (!q) return [];

    const words = q.split(' ').filter(Boolean);

    const hits: SearchHit[] = [];

    for (const doc of docs) {
        const labelNorm = normalize(doc.label);
        const contentNorm = normalize(doc.content ?? '');
        const categoryNorm = normalize(doc.category ?? '');

        let score = 0;

        // Strong boost for label matches
        if (labelNorm.includes(q)) score += 40;

        // Category matches
        if (categoryNorm.includes(q)) score += 10;

        // Content matches
        if (contentNorm.includes(q)) score += 15;

        // Multi-word scoring
        for (const w of words) {
            if (labelNorm.includes(w)) score += 8;
            if (contentNorm.includes(w)) score += 2;
        }

        if (score <= 0) continue;

        hits.push({
            id: doc.id,
            label: doc.label,
            category: doc.category,
            href: doc.href,
            score,
            snippet: doc.content ? makeSnippet(doc.content, q) : undefined,
        });
    }

    return hits
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}

function normalize(text: string) {
    return text.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim();
}


// vue imports
import projectStructureVue from "../docs/vatts/vue/project-structure.md"
import layoutVue from "../docs/vatts/vue/layout.md"
import routingVue from "../docs/vatts/vue/routing.md"
import rpcVue from "../docs/vatts/vue/rpc.md"
import componentsVue from "../docs/vatts/vue/components.md"


import configFile from "../docs/vatts/configFile.md"

export const sidebarConfig = {
    sections: [
        {
            id: 'vatts',
            title: "Vatts.js",
            items: [
                {
                    id: "introduction",
                    icon: "FaHome",
                    label: "Introduction",
                    file: introductionMd // Compartilhado (string direta)
                },
                {
                    id: "installation",
                    icon: "FaDownload",
                    label: "Installation",
                    file: installationMd
                },
                {
                    id: "project-structure",
                    icon: "FaBox",
                    label: "Project Structure",
                    file: {
                        react: projectStructureMd,
                        vue: projectStructureVue
                    },
                },
                {id: 'configuration', icon: 'FaCog', label: 'Configuration', file: configFile},
                { id: "layout", icon: "FaDiagramProject", label: "Layout System", file: {
                    react: layoutMd,
                        vue: layoutVue
                    } },
                {
                    id: "routing",
                    icon: "FaCodeCompare",
                    label: "Routing",
                    file: {
                        react: routingMd,
                        vue: routingVue,
                    }
                },
                { id: "rpc", icon: "FaGlobe", label: "RPC System", file: {
                    react: rpcMd,
                        vue: rpcVue
                    } },
                { id: "middlewares", icon: "FaWrench", label: "Middlewares", file: middlewaresMd },
                {
                    id: 'components',
                    icon: 'FaCube',
                    label: 'Components',
                    file: {
                        react: componentsMd,
                        vue: componentsVue
                    }
                }
            ]
        },
        {
            id: 'auth',
            title: "Vatts Auth",
            items: [
                { id: 'introduction-auth', icon: 'FaShield', label: 'Overview', file: gettingStartAuthMd },
                { id: 'installation-auth', icon: 'FaDownload', label: 'Setup Auth', file: installationAuthMd },
                { id: "providers", icon: "FaBolt", label: "Providers", file: providersAuthMd },
                { id: "sessions", icon: "FaFile", label: "Sessions", file: sessionsAuthMd },
                { id: 'protecting-routes', icon: 'FaLock', label: 'Protecting Routes', file: protectingRoutesAuthMd },
                { id: 'custom-providers', icon: 'FaCode', label: 'Custom Providers', file: customProvidersAuthMd },
            ]
        }
    ]
};