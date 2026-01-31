import type { VattsConfigFunction } from 'vatts';

const vattsConfig: VattsConfigFunction = (phase, { defaultConfig }) => {
    return {
        ...defaultConfig,
        pathRouter: true,
        port: 3000,
    };
};

export default vattsConfig;
