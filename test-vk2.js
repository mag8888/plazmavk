import vm from 'vm';

async function test() {
    const res = await fetch('https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js');
    const text = await res.text();
    const sandbox = { 
        window: { location: { search: '' } }, 
        console: console,
        location: { search: '' }
    };
    try {
        const script = new vm.Script(text);
        script.runInNewContext(sandbox);
        console.log("Global vkBridge:", typeof sandbox.vkBridge);
        console.log("window.vkBridge:", typeof sandbox.window.vkBridge);
        console.log("vkBridge keys:", Object.keys(sandbox.vkBridge || {}));
    } catch(e) { console.error(e) }
}
test();
