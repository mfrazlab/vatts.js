import type { VattsConfigFunction } from 'vatts';

const vattsConfig: VattsConfigFunction = (phase, { defaultConfig }) => {
    return {
        ...defaultConfig,
        pathRouter: true,
        port: 443,
        ssl: {
            redirectPort: 80,
            key: '/etc/letsencrypt/live/beta.int.mfraz.ovh/privkey.pem',
            cert: '/etc/letsencrypt/live/beta.int.mfraz.ovh/fullchain.pem',
        }
    };
};

export default vattsConfig;
