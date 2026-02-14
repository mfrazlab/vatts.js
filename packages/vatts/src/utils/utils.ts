import Console, {Colors} from "../api/console";

export async function showTitle(){
    const currentVersion = require('../../package.json').version;

    async function verifyVersion(): Promise<string> {
        // node fetch
        try {
            const response = await fetch('https://registry.npmjs.org/vatts/latest');
            const data = await response.json();
            return data.version;
        } catch (error) {
            Console.error('Could not check for the latest Vatts.js version:', error);
            return currentVersion; // Retorna a versão atual em caso de erro
        }
    }
    const latestVersion = await verifyVersion();
    const isUpToDate = latestVersion === currentVersion;
    let message;
    if (!isUpToDate) {
        message = `${Colors.FgRed}   A new version is available (v${latestVersion})${Colors.FgMagenta}`
    } else {
        message = `${Colors.FgGreen}   You are on the latest version${Colors.FgMagenta}`
    }
    // JS STICK LETTERS

    console.log(`${Colors.Bright + Colors.FgCyan}
${Colors.Bright + Colors.FgCyan}              ___ ___  __    ${Colors.FgWhite}        __  
${Colors.Bright + Colors.FgCyan}    \\  /  /\\   |   |  /__\`${Colors.FgWhite}        | /__\`    ${Colors.Bright + Colors.FgCyan}Vatts${Colors.FgWhite}.js ${Colors.FgGray}(v${currentVersion}) - mfraz
${Colors.Bright + Colors.FgCyan}     \\/  /~~\\  |   |  .__/ .${Colors.FgWhite}   \\__/ .__/ ${message}
                                     
                                     `)
}