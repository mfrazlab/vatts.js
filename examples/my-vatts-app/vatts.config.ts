import type { VattsConfigFunction } from 'vatts';

const vattsConfig: VattsConfigFunction = (phase, { defaultConfig }) => {
    return {
        ...defaultConfig,
        pathRouter: true,
        port: 3001,
    };
};

export default vattsConfig;
