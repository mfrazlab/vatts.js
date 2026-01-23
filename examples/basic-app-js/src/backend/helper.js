import os from 'os';
import Expose from "vatts/rpc";
import {VattsRequest} from "vatts";


function getOSName() {
    const platform = os.platform();

    switch (platform) {
        case 'win32':
            return 'Windows';
        case 'linux':
            return 'Linux';
        case 'darwin':
            return 'macOS';
        case 'freebsd':
            return 'FreeBSD';
        case 'aix':
            return 'AIX';
        default:
            return `Unknown (${platform})`;
    }
}

export async function getServerDiagnostics(_req, message) {
    const freeMem = os.freemem() / 1024 / 1024;
    const totalMem = os.totalmem() / 1024 / 1024;
    console.log(message)
    return {
        hostname: os.hostname(),
        platform: getOSName(),
        memoryUsage: `${Math.round(totalMem - freeMem)}MB / ${Math.round(totalMem)}MB`,
        cpuModel: os.cpus()[0]?.model ?? 'Unknown',
        serverTime: new Date().toLocaleTimeString(),
        secretHash: 'SERVER_SECRET_' + Math.random().toString(36).substring(7)
    };
}

export function getPackageVersion() {
    const packageJson = require('../../node_modules/vatts/package.json');
    return packageJson.version || 'unknown';
}

Expose(getServerDiagnostics, getPackageVersion)
