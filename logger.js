/**
 * DUOLIN 全路径诊断脚本
 * 目标：追踪 gems 到底在哪里，并尝试修改
 */

let body = $response.body;
if (!body) {
    console.log("[DUOLIN_LOG] ❌ 响应体为空，跳过");
    $done({});
}

try {
    // 检查是否为 JSON 格式
    if (!body.trim().startsWith('{') && !body.trim().startsWith('[')) {
        console.log("[DUOLIN_LOG] ⏩ 非 JSON 格式，跳过解析");
        $done({});
    }

    let obj = JSON.parse(body);
    let isModified = false;

    // --- 递归查找并修改 gems 的核心函数 ---
    const deepSearchAndPatch = (data, path) => {
        let changed = false;
        if (!data || typeof data !== 'object') return false;

        // 打印当前扫描的路径（调试用）
        if (data.gems !== undefined) {
            console.log(`[DUOLIN_LOG] 🎯 命中！在路径 [${path}] 找到 gems: ${data.gems} -> 尝试改为 888888`);
            data.gems = 888888;
            changed = true;
        }

        // 递归遍历所有属性
        for (let key in data) {
            if (typeof data[key] === 'object') {
                if (deepSearchAndPatch(data[key], `${path}.${key}`)) {
                    changed = true;
                }
            }
        }
        return changed;
    };

    console.log("[DUOLIN_LOG] 📥 开始解析主响应体...");

    // 分支 1: 处理 Batch 响应 (responses 数组)
    if (obj.responses && Array.isArray(obj.responses)) {
        console.log(`[DUOLIN_LOG] 📦 进入 Batch 分支, 子响应数量: ${obj.responses.length}`);
        obj.responses.forEach((res, index) => {
            if (res.body && typeof res.body === 'string' && res.body.trim().startsWith('{')) {
                console.log(`[DUOLIN_LOG] 🔍 正在解包 Batch[${index}] 的 body 字符串...`);
                try {
                    let subObj = JSON.parse(res.body);
                    if (deepSearchAndPatch(subObj, `Batch[${index}].body`)) {
                        res.body = JSON.stringify(subObj);
                        isModified = true;
                    }
                } catch (e) {
                    console.log(`[DUOLIN_LOG] ⚠️ Batch[${index}] body 解析失败: ${e.message}`);
                }
            } else {
                // 有些 batch 里的 body 直接就是对象
                if (deepSearchAndPatch(res.body, `Batch[${index}].direct_body`)) {
                    isModified = true;
                }
            }
        });
    } 
    // 分支 2: 处理普通单体 JSON
    else {
        console.log("[DUOLIN_LOG] 📄 进入普通单体请求分支");
        if (deepSearchAndPatch(obj, "Root")) {
            isModified = true;
        }
    }

    if (isModified) {
        console.log("[DUOLIN_LOG] ✅ 修改成功，准备写回数据");
        $done({ body: JSON.stringify(obj) });
    } else {
        console.log("[DUOLIN_LOG] 🧊 未发现 gems 字段，保持原样");
        $done({});
    }

} catch (e) {
    console.log(`[DUOLIN_LOG] ❌ 脚本执行崩溃: ${e.message}`);
    $done({});
}
