const vm = require('vm');
const https = require('https');

https.get('https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const sandbox = { window: {} };
        try {
            const script = new vm.Script(data);
            script.runInNewContext(sandbox);
            console.log("Keys in window:", Object.keys(sandbox.window));
            console.log("Global vkBridge:", !!sandbox.vkBridge);
            console.log("Global vkontakte:", !!sandbox.vkontakte);
        } catch(e) { console.error(e) }
    });
});
