/**
 * DUOLIN 针对图片结构的精准宝石补丁
 */

let body = $response.body;
if (!body || !body.trim().startsWith('{')) {
    $done({});
}

try {
    let obj = JSON.parse(body);
    let isModified = false;

    // --- 核心：修改 JSON 对象的宝石数值 ---
    const patchGems = (data, tag) => {
        let changed = false;
        // 1. 如果当前层级有 gems
        if (data.gems !== undefined) {
            console.log(`[DUOLIN_TRACE] 🎯 找到宝石字段 [${tag}]: ${data.gems} -> 888888`);
            data.gems = 888888;
            changed = true;
        }
        
        // 2. 递归向下查找（处理 body 内部可能的嵌套，如 data.user.gems）
        for (let key in data) {
            if (data[key] && typeof data[key] === 'object') {
                if (patchGems(data[key], `${tag}.${key}`)) changed = true;
            }
        }
        return changed;
    };

    // --- 逻辑分支开始 ---
    console.log("[DUOLIN_TRACE] 📥 接收到响应，进入解析流程...");

    if (obj.responses && Array.isArray(obj.responses)) {
        console.log(`[DUOLIN_TRACE] 📂 分支: [Batch] | 子响应数: ${obj.responses.length}`);
        
        obj.responses.forEach((res, index) => {
            // 根据你的图片，gems 藏在 res.body 这个字符串里
            if (res.body && typeof res.body === 'string' && res.body.includes('"gems"')) {
                console.log(`[DUOLIN_TRACE] 🔗 发现关键字 "gems" 位于 Batch[${index}].body 字符串中`);
                try {
                    let subObj = JSON.parse(res.body);
                    if (patchGems(subObj, `Batch[${index}]`)) {
                        res.body = JSON.stringify(subObj);
                        console.log(`[DUOLIN_TRACE] ✅ Batch[${index}].body 字符串已缝合`);
                        isModified = true;
                    }
                } catch (e) {
                    console.log(`[DUOLIN_TRACE] ❌ Batch[${index}] 内部 JSON 解析失败: ${e.message}`);
                }
            } else {
                console.log(`[DUOLIN_TRACE] ⏩ Batch[${index}] 未发现 "gems" 关键字，略过`);
            }
        });
    } else {
        console.log("[DUOLIN_TRACE] 📄 分支: [Single_JSON] (非 Batch 结构)");
        if (patchGems(obj, "Root")) isModified = true;
    }

    if (isModified) {
        console.log("[DUOLIN_TRACE] 🏁 所有修改已完成，准备返回结果");
        $done({ body: JSON.stringify(obj) });
    } else {
        console.log("[DUOLIN_TRACE] 🧊 本次响应未命中任何宝石修改逻辑");
        $done({});
    }

} catch (e) {
    console.log(`[DUOLIN_TRACE] 💀 脚本全局异常: ${e.message}`);
    $done({});
}
