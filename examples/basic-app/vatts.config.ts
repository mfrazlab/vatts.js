import type { VattsConfigFunction } from 'vatts';

const vattsConfig: VattsConfigFunction = (phase, { defaultConfig }) => {
    return {
        ...defaultConfig,
        pathRouter: true,
        port: 443,
        ssl: {
            redirectPort: 80,
            key: '../../certs/localhost-key.pem',
            cert: '../../certs/localhost.pem',
        }
    };
};

export default vattsConfig;
