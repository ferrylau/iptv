/**
 * DUOLIN 深度扫描补丁
 */

let body = $response.body;
let url = $request.url;

if (!body || !body.trim().startsWith('{')) $done({});

try {
    let obj = JSON.parse(body);
    let isModified = false;

    // --- 修改函数：涵盖所有已知字段 ---
    const patchEverything = (data, tag) => {
        let changed = false;
        
        // 打印该层级的 Key，确认我们是否进对了地方
        console.log(`[DUOLIN_TRACE] 🔎 [${tag}] 字段预览: ${Object.keys(data).slice(0,10).join(", ")}`);

        // 宝石/货币修改
        const gemKeys = ['gems', 'totalGems', 'rupees', 'currencyReward'];
        gemKeys.forEach(k => {
            if (data[k] !== undefined) {
                console.log(`[DUOLIN_TRACE] 🎯 命中宝石 [${k}]: ${data[k]} -> 999999`);
                data[k] = 999999;
                changed = true;
            }
        });

        // 会员等级与能量修改
        if (data.subscriberLevel !== undefined) {
            console.log(`[DUOLIN_TRACE] 🎯 命中等级: ${data.subscriberLevel} -> MAX`);
            data.subscriberLevel = "MAX";
            changed = true;
        }

        if (data.energy !== undefined) {
            data.energy = 5;
            data.unlimitedEnergyAvailable = true;
            changed = true;
        }

        // 递归查找子项 (如 user.gems)
        for (let key in data) {
            if (data[key] && typeof data[key] === 'object') {
                if (patchEverything(data[key], `${tag}.${key}`)) changed = true;
            }
        }
        return changed;
    };

    console.log(`[DUOLIN_TRACE] 🚀 处理 URL: ${url.split('?')[0]}`);

    if (obj.responses && Array.isArray(obj.responses)) {
        obj.responses.forEach((res, index) => {
            if (res.body && typeof res.body === 'string' && res.body.trim().startsWith('{')) {
                console.log(`[DUOLIN_TRACE] 📦 解析 Batch[${index}] Body 字符串内容...`);
                try {
                    let subObj = JSON.parse(res.body);
                    if (patchEverything(subObj, `Batch[${index}]`)) {
                        res.body = JSON.stringify(subObj);
                        isModified = true;
                    }
                } catch (e) {
                    console.log(`[DUOLIN_TRACE] ⚠️ 解析 Batch[${index}] 失败: ${e.message}`);
                }
            }
        });
    } else {
        if (patchEverything(obj, "Single")) isModified = true;
    }

    if (isModified) {
        console.log("[DUOLIN_TRACE] ✅ 修改成功，数据已注入。");
        $done({ body: JSON.stringify(obj) });
    } else {
        $done({});
    }

} catch (e) {
    console.log(`[DUOLIN_TRACE] ❌ 异常: ${e.message}`);
    $done({});
}
