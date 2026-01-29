import type { VattsConfigFunction } from 'vatts';

const vattsConfig: VattsConfigFunction = (phase, { defaultConfig }) => {
    return {
        ...defaultConfig,
        pathRouter: true,
        port: 443,
        ssl: {
            backendPort: 3000,
            redirectPort: 80,
            key: '../certs/vatts.com-key.pem',
            cert: '../certs/vatts.com.pem',
        }
    };
};

export default vattsConfig;