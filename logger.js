/**
 * DUOLIN 宝石修改测试脚本
 */

let body = $response.body;
if (!body || !body.trim().startsWith('{')) {
    $done({});
}

try {
    let obj = JSON.parse(body);
    let isModified = false;

    // 修改逻辑：专门对付 gems
    const patchGems = (data, source) => {
        if (data && typeof data === 'object' && data.gems !== undefined) {
            console.log(`[DUOLIN_TEST] 找到宝石字段(${source}): ${data.gems} -> 999999`);
            data.gems = 999999;
            return true;
        }
        return false;
    };

    // 处理 Batch 嵌套
    if (obj.responses && Array.isArray(obj.responses)) {
        obj.responses.forEach((res, index) => {
            if (res.body && res.body.trim().startsWith('{')) {
                try {
                    let subData = JSON.parse(res.body);
                    if (patchGems(subData, `Batch_${index}`)) {
                        res.body = JSON.stringify(subData);
                        isModified = true;
                    }
                } catch (e) {}
            }
        });
    } else {
        // 处理普通单请求
        if (patchGems(obj, "Single")) {
            isModified = true;
            body = JSON.stringify(obj);
        }
    }

    if (isModified) {
        console.log(`[DUOLIN_TEST] ✅ 宝石数据已注入`);
        $done({ body: Array.isArray(obj.responses) ? JSON.stringify(obj) : body });
    } else {
        $done({});
    }

} catch (e) {
    $done({});
}
