/**
 * DUOLIN 终极全量诊断与注入脚本
 * 功能：分段打印 Body + 强制字段注入
 */

let body = $response.body;
let url = $request.url;

if (!body || body.length < 5) {
    console.log(`[DUOLIN] ⚠️ 拦截到空响应或超短响应 | URL: ${url}`);
    $done({});
}

// --- 1. 分段打印函数 (解决日志截断问题) ---
const longLog = (str, label = "DATA") => {
    let size = 2500; // 小火箭单行建议字符
    console.log(`[DUOLIN] >>> 开始打印 ${label} (总长: ${str.length}) <<<`);
    for (let i = 0; i < str.length; i += size) {
        console.log(`[${label}_PART] ${str.substring(i, i + size)}`);
    }
    console.log(`[DUOLIN] <<< ${label} 打印结束 >>>`);
};

// --- 2. 字段强制注入函数 ---
const injectFields = (obj, tag) => {
    let changed = false;
    const targets = {
        'gems': 999999,
        'totalGems': 999999,
        'subscriberLevel': "MAX",
        'hasPlus': true,
        'isMax': true,
        'energy': 5,
        'unlimitedEnergyAvailable': true
    };

    for (let key in targets) {
        // 如果字段存在则修改，不存在则强行添加
        if (obj[key] !== targets[key]) {
            obj[key] = targets[key];
            changed = true;
        }
    }
    
    // 如果有 user 对象，递归进去改
    if (obj.user && typeof obj.user === 'object') {
        if (injectFields(obj.user, `${tag}.user`)) changed = true;
    }
    return changed;
};

try {
    let mainObj = JSON.parse(body);
    let isModified = false;

    console.log(`[DUOLIN] 📥 拦截成功 URL: ${url}`);

    // --- 3. 处理 Batch 结构 ---
    if (mainObj.responses && Array.isArray(mainObj.responses)) {
        console.log(`[DUOLIN] 📦 检测到 Batch 结构, 包含 ${mainObj.responses.length} 个子响应`);
        
        mainObj.responses.forEach((res, index) => {
            if (res.body && typeof res.body === 'string' && res.body.trim().startsWith('{')) {
                try {
                    let subObj = JSON.parse(res.body);
                    console.log(`[DUOLIN] 🔍 正在处理 Batch[${index}] 的嵌套字符串...`);
                    
                    // 修改前先打印出来看一眼（建议只在调试时开启，包太大可能会刷屏）
                    longLog(res.body, `Batch_${index}_Original`);
                    
                    if (injectFields(subObj, `Batch[${index}]`)) {
                        res.body = JSON.stringify(subObj);
                        isModified = true;
                    }
                } catch (e) {
                    console.log(`[DUOLIN] ⚠️ Batch[${index}] 内部 JSON 解析失败`);
                }
            } else if (res.body && typeof res.body === 'object') {
                if (injectFields(res.body, `Batch[${index}]_Obj`)) isModified = true;
            }
        });
    } else {
        // --- 4. 处理普通 JSON ---
        longLog(body, "Single_Body");
        if (injectFields(mainObj, "Root")) isModified = true;
    }

    if (isModified) {
        console.log("[DUOLIN] ✅ 数据已注入并缝合");
        $done({ body: JSON.stringify(mainObj) });
    } else {
        console.log("[DUOLIN] 🧊 未发现目标字段，保持原样");
        $done({});
    }

} catch (e) {
    console.log(`[DUOLIN] ❌ 脚本执行异常: ${e.message}`);
    // 即使解析失败，也把原始 body 打印出来看看
    longLog(body, "Raw_Body_Error");
    $done({});
}
