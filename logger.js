/**
 * DUOLIN 最终优化版
 * 目标：精确修改 energyConfig 内部的 energy 字段
 */

if (typeof $response !== 'undefined') {
    let body = $response.body;
    
    if (!body || body.length < 5) {
        $done({});
    } else {
        console.log(`[DUOLIN_FIX] 📥 拦截响应 (长度: ${body.length})`);

        // --- 1. 修改基础字段 (宝石与会员) ---
        let modifiedBody = body
            .replace(/"gems":\s*\d+/g, '"gems":999999')
            .replace(/"totalGems":\s*\d+/g, '"totalGems":999999')
            .replace(/"subscriberLevel":\s*".*?"/g, '"subscriberLevel":"MAX"')
            .replace(/"unlimitedEnergyAvailable":\s*\w+/g, '"unlimitedEnergyAvailable":true')
            .replace(/"hasPlus":\s*\w+/g, '"hasPlus":true');

        // --- 2. 修改 energyConfig 内部的 energy (普通格式) ---
        // 匹配逻辑：找到 "energyConfig":{... "energy":X ...}
        // 使用正则 lookahead 确保只改配置里的 energy
        modifiedBody = modifiedBody.replace(/("energyConfig"\s*:\s*\{[^\}]*"energy"\s*:\s*)\d+/g, '$1100');

        // --- 3. 修改 Batch 转义格式内的 energy ---
        // 匹配逻辑：\\"energyConfig\\":{... \\"energy\\":X ...}
        if (body.includes('"responses"')) {
            // 修改嵌套内的宝石和等级
            modifiedBody = modifiedBody
                .replace(/\\"gems\\":\s*\d+/g, '\\"gems\\":999999')
                .replace(/\\"subscriberLevel\\":\s*\\".*?\\"/g, '\\"subscriberLevel\\":\\"MAX\\"');
            
            // 精确修改嵌套内的 energy
            modifiedBody = modifiedBody.replace(/(\\"energyConfig\\"\s*:\s*\{[^\}]*\\"energy\\"\s*:\s*)\d+/g, '$1100');
        }

        console.log(`[DUOLIN_FIX] ✅ 注入完成 (宝石:999999, 体力:100)`);
        $done({ body: modifiedBody });
    }
} else {
    $done({});
}