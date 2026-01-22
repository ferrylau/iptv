/**
 * DUOLIN 最终优化版 (针对 max-size=-1 环境)
 * 功能：1. 屏蔽请求端干扰 2. 响应端注入宝石、体力、会员等级
 */

// 检查是否为响应阶段
if (typeof $response !== 'undefined') {
    let body = $response.body;
    
    // 如果没有内容，直接结束
    if (!body || body.length < 5) {
        $done({});
    } else {
        console.log(`[DUOLIN_FINAL] 📥 拦截响应 (长度: ${body.length})`);

        // --- 1. 执行非转义字段正则注入 ---
        let modifiedBody = body
            // .replace(/"gems":\s*\d+/g, '"gems":999999')
            // .replace(/"energy":\s*\d+/g, '"energy":999') // 修改体力为 100
            // .replace(/"subscriberLevel":\s*".*?"/g, '"subscriberLevel":"1"');

        // --- 2. 处理 Batch 特有的转义嵌套字段 ---
        // 这一步是为了确保在复杂 JSON 字符串中也能改掉数值
        if (body.includes('"responses"')) {
            modifiedBody = modifiedBody
                .replace(/\\"gems\\":\s*\d+/g, '\\"gems\\":999999')
                .replace(/\\"energy\\":\s*\d+/g, '\\"energy\\":777') // 转义体力修改
                .replace(/\\"subscriberLevel\\":\s*\\".*?\\"/g, '\\"subscriberLevel\\":\\"SUPER\\"')
                .replace(/\\"allowPersonalizedAds\\"\s*:\s*true/g, '\\"allowPersonalizedAds\\":false');
        }

        console.log(`[DUOLIN_FINAL] ✅ 注入完成 (宝石:999999, 体力:100)`);
        $done({ body: modifiedBody });
    }
} else {
    // 请求端直接跳过，不加延迟，不改 Header
    $done({});
}