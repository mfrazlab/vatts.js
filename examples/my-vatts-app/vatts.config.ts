import type { VattsConfigFunction } from 'vatts';

const vattsConfig: VattsConfigFunction = (phase, { defaultConfig }) => {
    return {
        ...defaultConfig,
        port: 443,
        ssl: {
            http3Port: 8443,
            redirectPort: 80,
            key: '../../certs/localhost-key.pem',
            cert: '../../certs/localhost.pem',
        }
    };
};

export default vattsConfig;
