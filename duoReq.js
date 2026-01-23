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

                    delete fieldsObj.trackingProperties; 
                    delete fieldsObj.plusDiscounts;        
                    delete fieldsObj.inviteURL
                    delete fieldsObj.health             
                    delete fieldsObj.chinaUserModerationRecords
                    delete fieldsObj.adsConfig
                    delete fieldsObj.referralInfo
                    
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