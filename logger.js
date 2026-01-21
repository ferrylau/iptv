/**
 * DUOLIN 纯响应拦截版
 */
let body = $response.body;
if (!body || body.length < 5) $done({});

console.log(`[DUOLIN_FINAL] 📥 拦截响应 | 长度: ${body.length}`);

// 暴力正则替换，覆盖所有可能的宝石和等级字段
let modifiedBody = body
    .replace(/"gems":\s*\d+/g, '"gems":999999')
    .replace(/"totalGems":\s*\d+/g, '"totalGems":999999')
    .replace(/"subscriberLevel":\s*".*?"/g, '"subscriberLevel":"MAX"')
    .replace(/"energy":\s*\d+/g, '"energy":5')
    .replace(/"unlimitedEnergyAvailable":\s*\w+/g, '"unlimitedEnergyAvailable":true');

// 如果是 Batch 结构，对内部嵌套的字符串也洗一遍
if (body.includes('"responses"')) {
    modifiedBody = modifiedBody.replace(/\\"gems\\":\s*\d+/g, '\\"gems\\":999999');
    modifiedBody = modifiedBody.replace(/\\"subscriberLevel\\":\s*\\".*?\\"/g, '\\"subscriberLevel\\":\\"MAX\\"');
}

console.log(`[DUOLIN_FINAL] ✅ 尝试注入完成`);
$done({ body: modifiedBody });
