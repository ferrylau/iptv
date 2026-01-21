/**
 * DUOLIN Master Script
 * 功能：1. 请求端根据特征分配延迟，强行错开并发 2. 响应端执行注入
 */

const isRequest = typeof $request !== 'undefined' && typeof $response === 'undefined';

if (isRequest) {
    // --- 【请求阶段：制造时差】 ---
    (async () => {
        const url = $request.url;
        const body = $request.body || "";
        
        // 根据请求体特征分配延迟，确保三个 batch 不会撞在一起
        let delay = 0;
        if (body.includes("getConfig")) {
            delay = 0;      // 第一个包不延迟
        } else if (body.includes("getGems")) {
            delay = 800;    // 第二个包延迟 0.8s
        } else {
            delay = 1500;   // 其他包延迟 1.5s
        }

        console.log(`[DUOLIN_DELAY] ⏳ 探测到并发，强行延迟 ${delay}ms: ${url}`);
        
        // 异步等待
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // 关键：修改 Header 进一步防止复用
        let headers = $request.headers;
        headers['Connection'] = 'close';
        
        $done({ headers });
    })();

} else {
    // --- 【响应阶段：数据注入】 ---
    let body = $response.body;
    if (!body || body.length < 5) $done({});

    console.log(`[DUOLIN_FIX] 📥 拦截到响应 (长度: ${body.length})`);

    // 执行正则注入
    let modifiedBody = body
        .replace(/"gems":\s*\d+/g, '"gems":999999')
        .replace(/"totalGems":\s*\d+/g, '"totalGems":999999')
        .replace(/"subscriberLevel":\s*".*?"/g, '"subscriberLevel":"MAX"')
        .replace(/"unlimitedEnergyAvailable":\s*\w+/g, '"unlimitedEnergyAvailable":true')
        .replace(/"hasPlus":\s*\w+/g, '"hasPlus":true');

    // 处理 Batch 嵌套
    if (body.includes('"responses"')) {
        modifiedBody = modifiedBody
            .replace(/\\"gems\\":\s*\d+/g, '\\"gems\\":999999')
            .replace(/\\"subscriberLevel\\":\s*\\".*?\\"/g, '\\"subscriberLevel\\":\\"MAX\\"');
    }

    $done({ body: modifiedBody });
}
