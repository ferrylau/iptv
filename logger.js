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
 * DUOLINGO 请求体精准精简脚本
 * 逻辑：URL解码 -> 字符串转JSON对象 -> 剔除大字段 -> 还原回URL
 */

if (typeof $request !== 'undefined' && $request.body) {
    try {
        let root = JSON.parse($request.body);
        
        if (root.requests && root.requests[0] && root.requests[0].url) {
            let url = root.requests[0].url;
            let parts = url.split('fields=');
            
            if (parts.length === 2) {
                let baseUrl = parts[0];
                // 1. URL 解码
                let decodedFields = decodeURIComponent(parts[1]);

                // 2. 将字段字符串转换为 JSON 对象
                let fieldsObj = fieldsToJson(decodedFields);
                if (fieldsObj.gems) {
                    // delete fieldsObj.gems; 
                    delete fieldsObj.energyConfig; 
                    delete fieldsObj.courses; 
                    
                    // 4. 将 JSON 对象还原为字符串并重新编码
                    let newFields = jsonToFields(fieldsObj);
                    root.requests[0].url = baseUrl + "fields=" + encodeURIComponent(newFields);
                    
                    console.log("[DUO-REQ] ✅ 字段精简成功，已剔除 experiments 等大字段");
                }
            }
        }
        $done({ body: JSON.stringify(root) });
    } catch (e) {
        console.log("[DUO-REQ] ❌ 修改失败: " + e);
        $done({});
    }
} else {
    $done({});
}

// --- 核心转换工具函数 ---

// 1. 字符串转 JSON (解析大括号嵌套)
function fieldsToJson(str) {
    let root = {};
    let stack = [root];
    let currentKey = "";

    for (let i = 0; i < str.length; i++) {
        let char = str[i];
        if (char === '{') {
            let newObj = {};
            stack[stack.length - 1][currentKey] = newObj;
            stack.push(newObj);
            currentKey = "";
        } else if (char === '}') {
            if (currentKey) stack[stack.length - 1][currentKey] = true;
            stack.pop();
            currentKey = "";
        } else if (char === ',') {
            if (currentKey) stack[stack.length - 1][currentKey] = true;
            currentKey = "";
        } else {
            currentKey += char;
        }
    }
    if (currentKey) root[currentKey] = true;
    return root;
}

// 2. JSON 转字符串 (还原多邻国语法)
function jsonToFields(obj) {
    let parts = [];
    for (let key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            parts.push(`${key}{${jsonToFields(obj[key])}}`);
        } else {
            parts.push(key);
        }
    }
    return parts.join(',');
}
