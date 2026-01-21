/**
 * DUOLIN 并发破解与全量注入脚本
 * 逻辑：
 * 1. Request 阶段：强制设置 Connection: close，尝试拆分 HTTP/2 并发流。
 * 2. Response 阶段：执行正则+JSON双重注入，确保即使合并包也能修改成功。
 */

const isRequest = typeof $request !== 'undefined' && typeof $response === 'undefined';

if (isRequest) {
    // --- 【请求阶段】 ---
    let headers = $request.headers;
    // 强制声明不重用连接，诱导服务器降级处理或拆分流
    headers['Connection'] = 'close';
    headers['Keep-Alive'] = 'timeout=0';
    
    console.log(`[DUOLIN_REQ] 🛰 已强制注入 Connection: close | URL: ${$request.url.split('/batch')[0]}`);
    $done({ headers });

} else {
    // --- 【响应阶段】 ---
    let body = $response.body;
    if (!body || body.length < 5) {
        console.log(`[DUOLIN_RES] ⚠️ 响应体为空，跳过`);
        $done({});
    }

    console.log(`[DUOLIN_RES] 📥 拦截响应 | 长度: ${body.length}`);

    // 1. 尝试暴力正则替换（最快，防止高并发下脚本超时）
    let modifiedBody = body
        .replace(/"gems":\s*\d+/g, '"gems":999999')
        .replace(/"totalGems":\s*\d+/g, '"totalGems":999999')
        .replace(/"subscriberLevel":\s*".*?"/g, '"subscriberLevel":"MAX"')
        .replace(/"energy":\s*\d+/g, '"energy":5')
        .replace(/"unlimitedEnergyAvailable":\s*\w+/g, '"unlimitedEnergyAvailable":true')
        .replace(/"hasPlus":\s*\w+/g, '"hasPlus":true')
        .replace(/"isMax":\s*\w+/g, '"isMax":true');

    // 2. 检查是否有 Batch 嵌套结构，如果有，进行深度注入
    if (body.includes('"responses"')) {
        try {
            let obj = JSON.parse(modifiedBody);
            if (obj.responses && Array.isArray(obj.responses)) {
                obj.responses.forEach((res, i) => {
                    if (res.body && typeof res.body === 'string' && res.body.includes('{')) {
                        // 这里的内部 body 也执行一次正则替换
                        res.body = res.body
                            .replace(/"gems":\s*\d+/g, '"gems":999999')
                            .replace(/"subscriberLevel":\s*".*?"/g, '"subscriberLevel":"MAX"');
                    }
                });
                modifiedBody = JSON.stringify(obj);
            }
        } catch (e) {
            console.log(`[DUOLIN_RES] ⚠️ JSON 深度解析失败，保持正则修改结果`);
        }
    }

    console.log(`[DUOLIN_RES] ✅ 注入完成`);
    $done({ body: modifiedBody });
}
