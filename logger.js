/**
 * DUOLIN 终极会员补丁 - 详细日志加强版
 */

let body = $response.body;
if (!body) $done({});

try {
    let obj = JSON.parse(body);
    let modifiedCount = 0;

    // --- 核心修改逻辑函数 ---
    const patchData = (data, sourceTag) => {
        if (!data || typeof data !== 'object') return false;
        let isChanged = false;

        // 1. 修改身份等级 (核心字段)
        if (data.subscriberLevel !== undefined) {
            console.log(`[DUOLIN_DEBUG] [${sourceTag}] 发现等级字段: ${data.subscriberLevel} -> MAX`);
            data.subscriberLevel = "MAX";
            isChanged = true;
        }

        // 2. 能量系统 (Energy)
        if (data.energy !== undefined) {
            console.log(`[DUOLIN_DEBUG] [${sourceTag}] 修正能量数值: ${data.energy} -> 5`);
            data.energy = 5;
            isChanged = true;
        }
        if (data.unlimitedEnergyAvailable !== undefined) {
            console.log(`[DUOLIN_DEBUG] [${sourceTag}] 开启无限能量开关: ${data.unlimitedEnergyAvailable} -> true`);
            data.unlimitedEnergyAvailable = true;
            isChanged = true;
        }

        // 3. 兼容性红心字段 (Hearts)
        if (data.health) {
            console.log(`[DUOLIN_DEBUG] [${sourceTag}] 发现红心系统，正在执行全量解锁...`);
            data.health.unlimitedHeartsAvailable = true;
            data.health.hearts = 5;
            if (data.health.predictionContext) {
                data.health.predictionContext.isUnlimitedHeartsEnabled = true;
            }
            isChanged = true;
        }

        // 4. 强制注入会员标识
        if (data.hasPlus === false || data.isMax === false) {
            data.hasPlus = true;
            data.isMax = true;
            console.log(`[DUOLIN_DEBUG] [${sourceTag}] 已强制开启 hasPlus/isMax 权限`);
            isChanged = true;
        }

        return isChanged;
    };

    // --- 解析逻辑 ---
    if (obj.responses && Array.isArray(obj.responses)) {
        console.log(`[DUOLIN_DEBUG] 检测到 Batch 请求，包含 ${obj.responses.length} 个子响应`);
        
        obj.responses.forEach((res, index) => {
            if (res.body && typeof res.body === 'string') {
                const trimmed = res.body.trim();
                if (trimmed.startsWith('{')) { // 只解析 JSON 对象
                    try {
                        let subData = JSON.parse(trimmed);
                        if (patchData(subData, `Batch_Index_${index}`)) {
                            res.body = JSON.stringify(subData);
                            modifiedCount++;
                        }
                    } catch (e) {
                        // 即使子 Body 解析失败也不打断流程
                    }
                }
            }
        });
    } else {
        // 处理非 Batch 的普通 JSON 请求
        if (patchData(obj, "Single_Request")) {
            modifiedCount++;
            body = JSON.stringify(obj);
        }
    }

    // --- 最终结算日志 ---
    if (modifiedCount > 0) {
        console.log(`[DUOLIN_DEBUG] 🎉 成功！共修改了 ${modifiedCount} 处数据，准备返回修改后的响应体。`);
        $done({ body: Array.isArray(obj.responses) ? JSON.stringify(obj) : body });
    } else {
        // 如果没有找到需要修改的字段，直接返回原始数据，不消耗资源
        $done({});
    }

} catch (e) {
    console.log(`[DUOLIN_DEBUG] ❌ 脚本运行出错: ${e.message}`);
    $done({});
}
