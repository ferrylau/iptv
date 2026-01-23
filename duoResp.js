/**
 * DUOLIN 嵌套解析版
 * 专门解决 responses[0].body 内部数据的解析与修改
 */

// if (typeof $response !== 'undefined' && $response.body) {
//     console.log("[DUOLIN] 原始包大小: " + ($response.body.length / 1024 / 1024).toFixed(2) + " MB");

//     let obj = JSON.parse($response.body);

//     // 1. 检查是否存在 responses 数组且第一个元素有 body
//     if (obj.responses && obj.responses[0] && obj.responses[0].body) {
//         try {
//             // 2. 将嵌套的字符串解析为真正的 JSON 对象
//             let innerBody = JSON.parse(obj.responses[0].body);
//             console.log("[DUOLIN] 📥 内部 Body 解析成功");

//             // 3. 在这里执行精准修改
//             // 修改宝石
//             // if (innerBody.gems !== undefined) innerBody.gems = 8888;
            
//             // 修改等级与视觉
//             innerBody.subscriberLevel = "PLUSSUPER";
//             // innerBody.plus_super_branding = true;
//             innerBody.hasPlus = true;

//             // 修改体力 (处理嵌套的 energyConfig)
//             if (innerBody.energyConfig) {
//                 innerBody.energyConfig.energy = 700;
//                 innerBody.energyConfig.maxEnergy = 555;
//             }            

//             // 关闭广告开关
//             // innerBody.allowPersonalizedAds = false;
//             // innerBody.trackingProperties.disable_ads_and_tracking_consent = true;
//             innerBody.trackingProperties.has_item_premium_subscription  = true

//             // 删除字段
//             innerBody.plusDiscounts = undefined;
//             innerBody.adsConfig = undefined;

//             // 4. 将修改后的对象重新封包成字符串
//             obj.responses[0].body = JSON.stringify(innerBody);            

//             console.log("[DUOLIN] ✅ 内部数据注入完成");

//         } catch (e) {
//             console.log("[DUOLIN] ❌ 内部 Body 解析失败: " + e);
//         }
//     }

//     // 5. 最后导出完整的 body
//     $done({ body: JSON.stringify(obj) });
// } else {
//     $done({});
// }

/**
 * DUOLIN 超轻量正则修改版 (专治 10.7M 大包)
 */

if (typeof $response !== 'undefined' && $response.body) {
    let body = $response.body;

    // // --- 修改等级 ---
    // body = body.replace(/"subscriberLevel":"\w*?"/g, '"subscriberLevel":"SUPER"');
    // body = body.replace(/"plus_super_branding":false/g, '"plus_super_branding":true');
    // body = body.replace(/"hasPlus":false/g, '"hasPlus":true');

    // --- 修改体力 ---
    body = body.replace(/"energy":\d+/g, '"energy":555');
    body = body.replace(/"maxEnergy":\d+/g, '"maxEnergy":555');

    // --- 修改宝石 ---
    // body = body.replace(/"gems":\d+/g, '"gems":8888');

    // --- 移除广告配置 (可选，有助于进一步精简) ---
    // 这里直接把 allowPersonalizedAds 设为 false
    // body = body.replace(/"allowPersonalizedAds":true/g, '"allowPersonalizedAds":false');

    $done({ body: body });
} else {
    $done({});
}