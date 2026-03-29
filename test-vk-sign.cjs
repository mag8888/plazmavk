const crypto = require('crypto');

function checkVkSign(paramsString, secret) {
    if (!paramsString || !secret) return false;
    const queryString = paramsString.startsWith('?') ? paramsString.slice(1) : paramsString;
    const urlParams = new URLSearchParams(queryString);
    const sign = urlParams.get('sign');
    if (!sign) return false;

    const queryParams = {};
    for (const [key, value] of urlParams.entries()) {
        if (key.startsWith('vk_')) {
            queryParams[key] = value;
        }
    }

    const signParams = Object.keys(queryParams)
        .sort()
        .reduce((acc, key) => {
            acc.push(`${key}=${queryParams[key]}`);
            return acc;
        }, [])
        .join('&');

    const cryptoSign = crypto
        .createHmac('sha256', secret)
        .update(signParams)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=$/g, '');

    console.log("Expected :", sign);
    console.log("Generated:", cryptoSign);
    console.log("Raw String:", signParams);
    return cryptoSign === sign;
}

// VK Example from docs:
const secret = 'test_secret';
const signParamsRaw = 'vk_app_id=7152064&vk_is_app_user=1&vk_language=ru&vk_platform=desktop_web&vk_ts=1569305105&vk_user_id=123456';
const generatedSign = crypto.createHmac('sha256', secret).update(signParamsRaw).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=$/g, '');

const testString = `?${signParamsRaw}&sign=${generatedSign}`;
console.log("Test OK?", checkVkSign(testString, secret));
