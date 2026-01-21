/**
 * DUOLIN 终极会员补丁 - 容错加强版
 * 解决 "Unexpected identifier login/control" 报错
 */

let body = $response.body;
// 前置检查：如果没内容，或者内容明显不是 JSON（不以 { 开头），直接跳过
if (!body || !body.trim().startsWith('{')) {
    $done({});
}

try {
    let obj = JSON.parse(body);
    let modifiedCount = 0;

    // --- 核心修改逻辑 ---
    const patchData = (data, sourceTag) => {
        if (!data || typeof data !== 'object') return false;
        let isChanged = false;

        // 1. 修改身份等级
        if (data.subscriberLevel !== undefined) {
            console.log(`[DUOLIN_DEBUG] [${sourceTag}] 发现等级: ${data.subscriberLevel} -> MAX`);
            data.subscriberLevel = "MAX";
            isChanged = true;
        }

        // 2. 能量/红心数值修改
        if (data.energy !== undefined) {
            data.energy = 5;
            isChanged = true;
        }
        if (data.unlimitedEnergyAvailable !== undefined) {
            data.unlimitedEnergyAvailable = true;
            isChanged = true;
        }

        // 3. 注入会员权限
        if (data.hasPlus === false || data.isMax === false) {
            data.hasPlus = true;
            data.isMax = true;
            isChanged = true;
        }

        // 4. 兼容 Hearts 模式
        if (data.health) {
            data.health.unlimitedHeartsAvailable = true;
            data.health.hearts = 5;
            isChanged = true;
        }

        return isChanged;
    };

    // --- 逻辑分流 ---
    if (obj.responses && Array.isArray(obj.responses)) {
        // 处理 Batch 套娃
        obj.responses.forEach((res, index) => {
            if (res.body && typeof res.body === 'string') {
                const trimmed = res.body.trim();
                // 关键容错：只有子 body 是 JSON 对象时才解析
                if (trimmed.startsWith('{')) {
                    try {
                        let subData = JSON.parse(trimmed);
                        if (patchData(subData, `Batch_Index_${index}`)) {
                            res.body = JSON.stringify(subData);
                            modifiedCount++;
                        }
                    } catch (e) { /* 静默跳过非 JSON 子项 */ }
                }
            }
        });
    } else {
        // 处理单请求
        if (patchData(obj, "Single_Request")) {
            modifiedCount++;
            body = JSON.stringify(obj);
        }
    }

    if (modifiedCount > 0) {
        console.log(`[DUOLIN_DEBUG] 🎉 成功修改 ${modifiedCount} 处数据`);
        $done({ body: Array.isArray(obj.responses) ? JSON.stringify(obj) : body });
    } else {
        $done({});
    }

} catch (e) {
    // 捕获真正的 JSON 结构异常，但不再为非 JSON 内容报警
    $done({});
}
