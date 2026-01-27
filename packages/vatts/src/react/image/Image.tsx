/*
 * This file is part of the Vatts.js Project.
 * Copyright (c) 2026 mfraz
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import React, { CSSProperties } from 'react';

interface VattsImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    src: string;
    width?: number | string;
    height?: number | string;
    quality?: number;
    priority?: boolean;
}

const Image: React.FC<VattsImageProps> = ({
                                                   src,
                                                   width,
                                                   height,
                                                   quality = 75,
                                                   priority = false,
                                                   className,
                                                   style,
                                                   alt = "",
                                                   ...props
                                               }) => {
    function getBaseUrl(): string | null {
        if (typeof window === "undefined") return null
        return window.location.origin
    }

    const baseUrl = getBaseUrl()
    // Se a imagem for Base64 (pequena) ou externa (http), não otimizamos via backend local
    const isOptimizable = src && src.startsWith && !src.startsWith('data:') && ((baseUrl && src.startsWith(baseUrl)) || !src.startsWith('http'));
    function optimizeSrc(src: string, baseUrl: string | null) {
        if (!baseUrl) return src

        if (src.startsWith(baseUrl)) {
            return src.slice(baseUrl.length) || '/'
        }

        return src
    }

    let optimizedSrc = optimizeSrc(src, baseUrl);
    if (isOptimizable) {
        const params = new URLSearchParams();
        params.set('url', optimizedSrc);

        // Tratamento inteligente para remover "px" se o usuário passar string
        if (width) {
            const w = String(width).replace('px', '');
            if (!isNaN(Number(w))) params.set('w', w);
        }


         if (height) {
           const h = String(height).replace('px', '');
           if (!isNaN(Number(h))) params.set('h', h);
        }

        if (quality) params.set('q', quality.toString());

        optimizedSrc = `/_vatts/image?${params.toString()}`;
    }

    // Estilos base para prevenir layout shift se dimensões forem fornecidas
    const baseStyle: CSSProperties = {
        // Se width for numérico, assume pixels, senão usa o valor string (ex: 100%)
        width: width ? (typeof width === 'number' ? `${width}px` : width) : 'auto',
        height: height ? (typeof height === 'number' ? `${height}px` : height) : 'auto',
        ...style,
    };

    return (
        <img
            {...props}
            src={optimizedSrc}
            alt={alt}
            loading={priority ? 'eager' : 'lazy'}
            decoding={priority ? 'sync' : 'async'}
            width={typeof width === 'string' ? width.replace('px', '') : width}
            height={typeof height === 'string' ? height.replace('px', '') : height}
            className={`vatts-image ${className || ''}`}
            style={baseStyle}
        />
    );
};

export default Image;