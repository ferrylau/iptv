/*
 * 叮咚农场自动任务 (签到 + 喂食) - 多账号支持版
 * 兼容 Quantumult X, Surge, Shadowrocket (小火箭)
 *
 * 最后更新: 2026-02-02
 *
 * 此版本支持多账号, 并已适配 Shadowrocket。
 * 1. 自动抓取: 默认第一个账号使用 ddxq_header_catcher.js 自动抓取的信息 (包括喂食ID)。
 * 2. 手动配置: 你可以在 configs 数组中添加更多账号。
 */

// --- 多账号配置 ---
const configs = [
    // ==================================================================
    // 账号一: 自动抓取 (主账号)
    // 此配置会自动从 $persistentStore 读取所有信息, 无需任何手动填写。
    {
        name: "主账号 (自动抓取)",
        useStore: true,
    },

    // ==================================================================
    // 账号二: 手动配置 (示例)
    // 在这里填入你为别人手机抓包获取的信息。
    {
        name: "朋友的账号 (手动)",
        useStore: false,
        cookie: '在此填入抓包获取的Cookie',
        userAgent: '在此填入抓包获取的User-Agent',
        
        // --- 以下所有 ddmc- 开头的参数都需要从抓包数据中获取 ---
        deviceToken: '', // ddmc-device-token
        stationId: '',   // ddmc-station-id
        uid: '',         // ddmc-uid
        deviceId: '',    // ddmc-device-id
        lat: '',         // ddmc-latitude
        lng: '',         // ddmc-longitude
        cityNumber: '',  // ddmc-city-number

        // --- 喂食ID也需要单独从抓包中获取 ---
        propsId: '', 
        seedId: ''   
    },
    // ==================================================================
];

// --- 脚本核心逻辑 (以下部分无需修改) ---

const ddxq_session_key = "ddxq_session";
const apiHost = 'https://farm.api.ddxq.mobi';

// 统一API的通知函数
const notify = (accountName, title, subtitle, body) => {
  const finalTitle = `[${accountName}] ${title}`;
  if (typeof $notify !== 'undefined') {
    $notify(finalTitle, subtitle, body);
  } else if (typeof $notification !== 'undefined') {
    $notification.post(finalTitle, subtitle, body);
  } else {
    console.log(`
---
${finalTitle}
${subtitle}
${body}
---`);
  }
};

// 统一API的请求函数
function sendRequest(options) {
    return new Promise((resolve, reject) => {
        if (typeof $task !== 'undefined') {
            $task.fetch(options).then(response => {
                if (response.statusCode >= 200 && response.statusCode < 300) resolve(JSON.parse(response.body));
                else reject(`HTTP Error: ${response.statusCode}`);
            }, reason => reject(`Request Failed: ${reason.error}`));
        } else if (typeof $httpClient !== 'undefined') {
            $httpClient.get(options, (error, response, data) => {
                if (error) reject(`Request Failed: ${error}`);
                else {
                    if (response.status >= 200 && response.status < 300) resolve(JSON.parse(data));
                    else reject(`HTTP Error: ${response.status}`);
                }
            });
        } else {
            reject("Unsupported environment for network requests.");
        }
    });
}

// 从URL中提取参数的辅助函数
function getURLParam(url, name) {
    if (!url) return null;
    const reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)");
    const match = url.substr(url.indexOf("?") + 1).match(reg);
    if (match) return decodeURIComponent(match[2]);
    return null;
}

// 加载和处理配置
function processConfigs() {
    const processed = [];
    const sessionStr = typeof $persistentStore !== 'undefined' ? $persistentStore.read(ddxq_session_key) : null;

    for (const cfg of configs) {
        if (cfg.useStore) {
            if (sessionStr) {
                console.log(`[${cfg.name}] 检测到已保存的会话信息, 将进行处理。`);
                const session = JSON.parse(sessionStr);
                const storedHeaders = session.headers;
                const storedUrl = session.url;

                const getHeader = (key) => {
                    const headerKey = Object.keys(storedHeaders).find(h => h.toLowerCase() === key.toLowerCase());
                    return headerKey ? storedHeaders[headerKey] : null;
                };

                const newConfig = {
                    ...cfg,
                    cookie: getHeader('cookie'),
                    userAgent: getHeader('user-agent'),
                    deviceToken: getHeader('ddmc-device-token') || getURLParam(storedUrl, 'device_token'),
                    stationId: getHeader('ddmc-station-id') || getURLParam(storedUrl, 'station_id'),
                    uid: getHeader('ddmc-uid') || getURLParam(storedUrl, 'uid'),
                    deviceId: getHeader('ddmc-device-id') || getURLParam(storedUrl, 'DeviceId'),
                    lat: getHeader('ddmc-latitude') || getURLParam(storedUrl, 'lat'),
                    lng: getHeader('ddmc-longitude') || getURLParam(storedUrl, 'lng'),
                    cityNumber: getHeader('ddmc-city-number') || getURLParam(storedUrl, 'city_number'),
                    propsId: session.propsId, // 从session中自动获取
                    seedId: session.seedId,   // 从session中自动获取
                };
                processed.push(newConfig);
            } else {
                console.log(`[${cfg.name}] 配置为自动抓取, 但未找到已保存的信息, 跳过此账号。`);
            }
        } else {
             if (cfg.cookie && cfg.cookie !== '在此填入抓包获取的Cookie') {
                processed.push(cfg);
            } else {
                console.log(`[${cfg.name}] 配置为手动模式, 但未填写Cookie, 跳过此账号。`);
            }
        }
    }
    return processed;
}


// --- 业务逻辑函数 ---
async function executeTask(taskFn, taskName, config, headers) {
    try {
        const result = await taskFn(config, headers);
        console.log(`[${config.name}] ${taskName} 结果: ${result}`);
        return result;
    } catch (error) {
        const errorMsg = `[${config.name}] ${taskName} 异常: ${error}`;
        console.log(errorMsg);
        return errorMsg;
    }
}

async function dailySign(config, headers) {
    const url = `${apiHost}/api/v2/task/achieve?api_version=9.1.0&app_client_id=1&station_id=${config.stationId}&uid=${config.uid}&device_id=${config.deviceId}&latitude=${config.lat}&longitude=${config.lng}&device_token=${config.deviceToken}&gameId=1&taskCode=DAILY_SIGN`;
    const data = await sendRequest({ url, headers });
    if (data.success && data.data.rewards && data.data.rewards.length > 0) return `✅ 每日签到成功, 获得${data.data.rewards[0].amount}g饲料`;
    if (data.code === 2002 || (data.msg && data.msg.includes("已完成"))) return `ℹ️ 每日签到: 今日已签,无需重复`;
    return `❌ 每日签到失败: ${data.msg || '未知错误'}`;
}

async function continuousSign(config, headers) {
    const url = `${apiHost}/api/v2/task/achieve?api_version=9.1.0&app_client_id=1&station_id=${config.stationId}&uid=${config.uid}&device_id=${config.deviceId}&latitude=${config.lat}&longitude=${config.lng}&device_token=${config.deviceToken}&gameId=1&taskCode=CONTINUOUS_SIGN`;
    const data = await sendRequest({ url, headers });
    if (data.success && data.data.rewards && data.data.rewards.length > 0) return `✅ 连续签到成功, 获得${data.data.rewards[0].amount}g饲料`;
    if (data.code === 2002 || (data.msg && data.msg.includes("已完成"))) return `ℹ️ 连续签到: 今日已签,无需重复`;
    return `❌ 连续签到失败: ${data.msg || '未知错误'}`;
}

async function claimQuizReward(config, headers) {
    const url = `${apiHost}/api/v2/task/reward?api_version=9.1.0&app_client_id=1&station_id=${config.stationId}&uid=${config.uid}&device_id=${config.deviceId}&latitude=${config.lat}&longitude=${config.lng}&device_token=${config.deviceToken}&gameId=1&missionId=7385&missionInstanceId=558400&examSerialNo=5000006200094&taskCode=QUIZ1`;
    const data = await sendRequest({ url, headers });
    if (data.success && data.data.rewards && data.data.rewards.length > 0) return `✅ 答题奖励领取成功, 获得${data.data.rewards[0].amount}g饲料`;
    if (data.msg && (data.msg.includes("已领取") || data.msg.includes("已完成"))) return `ℹ️ 答题奖励: ${data.msg}`;
    return `❌ 答题奖励领取失败: ${data.msg || '未知错误'}`;
}

async function claimLotteryReward(config, headers) {
    const url = `${apiHost}/api/v2/task/achieve?api_version=9.1.0&app_client_id=1&station_id=${config.stationId}&uid=${config.uid}&device_id=${config.deviceId}&latitude=${config.lat}&longitude=${config.lng}&device_token=${config.deviceToken}&gameId=1&taskCode=LOTTERY`;
    const data = await sendRequest({ url, headers });
    if (data.success && data.data.rewards && data.data.rewards.length > 0) return `✅ 三餐福袋领取成功, 获得${data.data.rewards[0].amount}g饲料`;
    if (data.code === 2002 || (data.msg && (data.msg.includes("不在活动时间") || data.msg.includes("已完成")))) return `ℹ️ 三餐福袋: ${data.msg || '今日已完成/不在活动时间'}`;
    return `❌ 三餐福袋领取失败: ${data.msg || '未知错误'}`;
}

async function fetchTaskList(config, headers) {
    const url = `${apiHost}/api/v2/task/list?api_version=9.1.0&app_client_id=1&station_id=${config.stationId}&uid=${config.uid}&device_id=${config.deviceId}&latitude=${config.lat}&longitude=${config.lng}&device_token=${config.deviceToken}&gameId=1`;
    try {
        const data = await sendRequest({ url, headers });
        if (data.success && data.data && data.data.userTasks) return data.data.userTasks;
    } catch (e) { console.log(`[${config.name}] 获取任务列表异常: ${e}`); }
    return [];
}

async function claimAnyOrderReward(config, headers) {
    const taskList = await fetchTaskList(config, headers);
    const anyOrderTask = taskList.find(task => task.taskCode === "ANY_ORDER");
    if (!anyOrderTask || !anyOrderTask.userTaskLogId) return `ℹ️ 任意下单任务: 未在任务列表中找到`;
    
    const url = `${apiHost}/api/v2/task/reward?api_version=9.1.0&app_client_id=1&station_id=${config.stationId}&uid=${config.uid}&device_id=${config.deviceId}&latitude=${config.lat}&longitude=${config.lng}&device_token=${config.deviceToken}&gameId=1&userTaskLogId=${anyOrderTask.userTaskLogId}`;
    const data = await sendRequest({ url, headers });
    if (data.success && data.data.rewards && data.data.rewards.length > 0) return `✅ 任意下单奖励领取成功, 获得${data.data.rewards[0].amount}g饲料`;
    if ((data.data && data.data.taskStatus === "REWARDED") || (data.msg && data.msg.includes("已领取"))) return `ℹ️ 任意下单奖励: ${data.msg || '今日已领取'}`;
    return `ℹ️ 任意下单奖励: ${data.msg || '无法领取'}`;
}

async function feed(config, headers) {
    let successCount = 0;
    const maxFeeds = 20;
    let finalMsg = "未开始喂食或饲料不足";
    if (!config.propsId || !config.seedId) return "ℹ️ 未配置喂食ID (propsId/seedId), 跳过喂食";
    
    for (let i = 0; i < maxFeeds; i++) {
        const url = `${apiHost}/api/v2/props/feed?api_version=9.1.0&app_client_id=1&station_id=${config.stationId}&uid=${config.uid}&device_id=${config.deviceId}&latitude=${config.lat}&longitude=${config.lng}&device_token=${config.deviceToken}&gameId=1&propsId=${config.propsId}&seedId=${config.seedId}&triggerMultiFeed=0`;
        try {
            const data = await sendRequest({ url, headers });
            if (data.success) { successCount++; finalMsg = data.data.msg; } 
            else { finalMsg = data.msg; break; }
        } catch (e) { finalMsg = `❌ 喂食异常: ${e}`; break; }
        if (i < maxFeeds - 1) await new Promise(resolve => setTimeout(resolve, 2000));
    }
    return successCount > 0 ? `✅ 成功喂食 ${successCount} 次。提示: ${finalMsg}` : `ℹ️ 未执行喂食或失败: ${finalMsg}`;
}

// --- 主执行函数 ---
(async () => {
    const accountsToRun = processConfigs();
    if (accountsToRun.length === 0) {
        console.log("没有找到有效的账号配置, 脚本结束。");
        notify("叮咚农场", "无有效账号", "请检查脚本中的configs配置或确认是否已成功抓取主账号信息。");
        return;
    }

    console.log(`共找到 ${accountsToRun.length} 个有效账号, 开始执行任务...`);

    for (let i = 0; i < accountsToRun.length; i++) {
        const config = accountsToRun[i];
        console.log(`
=============== 开始为账号 [${config.name}] 执行任务 ===============`);

        if (!config.cookie || !config.userAgent) {
            console.log(`[${config.name}] 配置不完整 (缺少cookie或userAgent), 跳过。`);
            notify(config.name, '配置不完整', '请检查脚本中的账号配置。');
            continue;
        }

        const commonHeaders = {
            'Host': 'farm.api.ddxq.mobi', 'Cookie': config.cookie, 'User-Agent': config.userAgent,
            'ddmc-device-token': config.deviceToken, 'ddmc-station-id': config.stationId, 'ddmc-uid': config.uid,
            'ddmc-device-id': config.deviceId, 'ddmc-latitude': config.lat, 'ddmc-longitude': config.lng,
            'ddmc-city-number': config.cityNumber, 'ddmc-api-version': '9.1.0', 'ddmc-app-client-id': '1',
            'Origin': 'https://game.m.ddxq.mobi', 'Referer': 'https://game.m.ddxq.mobi/',
        };

        const results = [];
        results.push(await executeTask(dailySign, "每日签到", config, commonHeaders));
        results.push(await executeTask(continuousSign, "连续签到", config, commonHeaders));
        results.push(await executeTask(claimQuizReward, "答题奖励", config, commonHeaders));
        results.push(await executeTask(claimLotteryReward, "三餐福袋", config, commonHeaders));
        results.push(await executeTask(claimAnyOrderReward, "任意下单奖励", config, commonHeaders));
        results.push(await executeTask(feed, "自动喂食", config, commonHeaders));

        const summary = results.filter(res => res).join('\n');
        notify(config.name, '叮咚农场任务报告', summary);
        
        console.log(`=============== 账号 [${config.name}] 任务执行完毕 ===============`);
        
        if (i < accountsToRun.length - 1) {
            console.log(`
等待5秒后处理下一个账号...
`);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
    console.log("\n所有账号任务执行完毕。");
})().finally(() => {
    if (typeof $done !== 'undefined') {
        $done();
    }
});