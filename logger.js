/**
 * DUOLIN 针对 2023-05-23/batch 接口的专项补丁
 * 逻辑：解析 responses[0].body 字符串 -> 修改 -> 重新转为字符串
 */

let body = $response.body;
let url = $request.url;

if (!body || !body.trim().startsWith('{')) {
    $done({});
}

try {
    let obj = JSON.parse(body);
    let isModified = false;
    console.log(`[DUOLIN_BATCH] 🚀 拦截成功: ${url}`);

    // --- 核心修改逻辑 ---
    const patchData = (data, tag) => {
        let changed = false;
        
        // 1. 修改宝石 (Gems)
        if (data.gems !== undefined) {
            console.log(`[DUOLIN_BATCH] 🎯 [${tag}] 发现宝石: ${data.gems} -> 改为 999999`);
            data.gems = 999999;
            changed = true;
        }

        // 2. 修改等级与能量 (Subscriber & Energy)
        if (data.subscriberLevel !== undefined) {
            console.log(`[DUOLIN_BATCH] 🎯 [${tag}] 发现等级: ${data.subscriberLevel} -> 改为 MAX`);
            data.subscriberLevel = "MAX";
            changed = true;
        }
        
        if (data.energy !== undefined) {
            data.energy = 5;
            data.unlimitedEnergyAvailable = true;
            changed = true;
        }

        // 3. 会员标识
        data.hasPlus = true;
        data.isMax = true;

        // 4. 递归检查内部 (如 data.user.gems)
        for (let key in data) {
            if (data[key] && typeof data[key] === 'object') {
                if (patchData(data[key], `${tag}.${key}`)) changed = true;
            }
        }
        return changed;
    };

    // --- 处理 Batch 数组 ---
    if (obj.responses && Array.isArray(obj.responses)) {
        obj.responses.forEach((res, index) => {
            // 关键点：处理嵌套在 body 字段里的 JSON 字符串
            if (res.body && typeof res.body === 'string' && res.body.trim().startsWith('{')) {
                console.log(`[DUOLIN_BATCH] 🔍 正在解包 Batch[${index}].body 字符串...`);
                try {
                    let subObj = JSON.parse(res.body);
                    if (patchData(subObj, `Batch[${index}]`)) {
                        // 修改后必须重新转回字符串缝合回去
                        res.body = JSON.stringify(subObj);
                        isModified = true;
                    }
                } catch (e) {
                    console.log(`[DUOLIN_BATCH] ❌ Batch[${index}] 解析失败: ${e.message}`);
                }
            }
        });
    }

    if (isModified) {
        console.log("[DUOLIN_BATCH] ✅ 补丁应用成功，正在下发修改后的数据");
        $done({ body: JSON.stringify(obj) });
    } else {
        console.log("[DUOLIN_BATCH] 🧊 未发现可修改字段");
        $done({});
    }

} catch (e) {
    console.log(`[DUOLIN_BATCH] 💀 脚本异常: ${e.message}`);
    $done({});
}
