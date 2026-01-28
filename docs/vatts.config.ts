import type { VattsConfigFunction } from 'vatts';

const vattsConfig: VattsConfigFunction = (phase, { defaultConfig }) => {
    return {
        ...defaultConfig,
        pathRouter: true,
        port: 443,
        ssl: {
            backendPort: 3000,
            redirectPort: 80,
            key: '../certs/localhost-key.pem',
            cert: '../certs/localhost.pem',
        }
    };
};

export default vattsConfig;