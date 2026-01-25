import type { VattsConfigFunction } from 'vatts';

const hightConfig: VattsConfigFunction = (phase, { defaultConfig }) => {
    return {
        ...defaultConfig,
        pathRouter: true
    };
};

export default hightConfig;