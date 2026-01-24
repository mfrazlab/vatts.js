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
    // Se a imagem for Base64 (pequena) ou externa (http), não otimizamos via backend local
    const isOptimizable = src && !src.startsWith('data:') && !src.startsWith('http');

    let optimizedSrc = src;

    if (isOptimizable) {
        const params = new URLSearchParams();
        params.set('url', src);

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