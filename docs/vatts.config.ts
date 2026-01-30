import type { VattsConfigFunction } from 'vatts';

const vattsConfig: VattsConfigFunction = (phase, { defaultConfig }) => {
    return {
        ...defaultConfig,
        pathRouter: true,
        port: 8080,
       
    };
};

export default vattsConfig;
