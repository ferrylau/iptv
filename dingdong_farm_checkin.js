/*
 * 叮咚农场自动任务 (签到 + 喂食) - 多账号支持版
 * 兼容 Quantumult X, Surge, Shadowrocket (小火箭)
 *
 * 最后更新: 2026-02-02
 *
 * 此版本通过两个脚本配合, 实现主账号完全自动化。
 * 1. 自动抓取: 主账号的所有信息 (包括喂食ID) 均会自动获取。
 * 2. 手动配置: 你仍可以在 configs 数组中添加更多手动配置的账号。
 */

const SCRIPT_TIMEOUT = 180; // 全局网络请求超时时间, 单位秒
const RETRY_COUNT = 3; // 请求失败后的重试次数
const RETRY_DELAY = 2000; // 每次重试的延迟, 单位毫秒

// --- 多账号配置 ---
const configs = [
    // ==================================================================
    // 账号一: 自动抓取 (主账号)
    // 此配置会自动读取所有信息, 无需任何手动填写。
    {
        name: "主账号 (自动抓取)",
        useStore: true,
    },

    // ==================================================================
    // 账号二: 手动配置 (示例)
    // 在这里填入你为别人手机抓包获取的所有信息。
    {
        name: "",
        useStore: false,
        cookie: '',
        userAgent: '',
        deviceToken: '',
        stationId: '',
        uid: '',
        deviceId: '',
        lat: '',
        lng: '',
        cityNumber: '',
        propsId: '', 
        seedId: ''   
    },
    // ==================================================================
];

// --- 脚本核心逻辑 (以下部分无需修改) ---

const ddxq_headers_key = "ddxq_headers";
const ddxq_url_key = "ddxq_url";
const ddxq_props_id_key = "ddxq_props_id";
const ddxq_seed_id_key = "ddxq_seed_id";
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
async function sendRequest(originalOptions) {
    const options = { timeout: SCRIPT_TIMEOUT, ...originalOptions };

    for (let i = 0; i < RETRY_COUNT; i++) {
        try {
            const data = await new Promise((resolve, reject) => {
                if (typeof $task !== 'undefined') {
                    $task.fetch(options).then(response => {
                        if (response.statusCode >= 200 && response.statusCode < 300) {
                            resolve(JSON.parse(response.body));
                        } else {
                            reject(`HTTP Error: ${response.statusCode}`);
                        }
                    }, reason => reject(`Request Failed: ${reason.error}`));
                } else if (typeof $httpClient !== 'undefined') {
                    $httpClient.get(options, (error, response, data) => {
                        if (error) {
                            reject(`Request Failed: ${error}`);
                        } else {
                            if (response.status >= 200 && response.status < 300) {
                                resolve(JSON.parse(data));
                            } else {
                                reject(`HTTP Error: ${response.status}`);
                            }
                        }
                    });
                } else {
                    reject("Unsupported environment for network requests.");
                }
            });
            return data; // 成功, 返回数据并退出循环
        } catch (error) {
            console.log(`请求失败, 尝试次数 ${i + 1}/${RETRY_COUNT}. 错误: ${error}`);
            if (i < RETRY_COUNT - 1) {
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY)); // 等待后重试
            } else {
                throw error; // 所有重试失败后, 抛出最后一次的错误
            }
        }
    }
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
    const p_store = typeof $persistentStore !== 'undefined' ? $persistentStore : null;
    if (!p_store) return processed;

    const storedHeadersStr = p_store.read(ddxq_headers_key);
    const storedUrl = p_store.read(ddxq_url_key);
    const storedPropsId = p_store.read(ddxq_props_id_key);
    const storedSeedId = p_store.read(ddxq_seed_id_key);

    for (const cfg of configs) {
        if (cfg.useStore) {
            if (storedHeadersStr && storedUrl) {
                console.log(`[${cfg.name}] 检测到已保存的会话信息, 将进行处理。`);
                const storedHeaders = JSON.parse(storedHeadersStr);

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
                    propsId: storedPropsId, // 自动获取
                    seedId: storedSeedId,   // 自动获取
                };
                processed.push(newConfig);
            } else {
                console.log(`[${cfg.name}] 配置为自动抓取, 但未找到已保存的会话信息, 跳过。`);
            }
        } else {
             if (cfg.cookie && cfg.cookie !== '在此填入抓包获取的Cookie') {
                processed.push(cfg);
            } else {
                console.log(`[${cfg.name}] 手动账号配置不完整, 跳过。`);
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

async function claimQuizReward(config, headers, taskList) {
    if (!taskList) return `ℹ️ 答题奖励: 任务列表为空,跳过`;

    const quizTask = taskList.find(task => task.taskCode === "QUIZ1");
    if (!quizTask) return `ℹ️ 答题奖励: 未在任务列表中找到`;

    // // 如果 buttonStatus 为 TO_ACHIEVE，说明用户还未答题
    // if (quizTask.buttonStatus === 'TO_ACHIEVE') {
    //     return `ℹ️ 答题奖励: 请先手动完成答题`;
    // }

    // 检查必要的ID是否存在
    const { missionId, missionInstanceId, examSerialNo } = quizTask;
    if (!missionId || !missionInstanceId || !examSerialNo) {
        return `ℹ️ 答题奖励: 任务缺少必要的ID参数,无法领取`;
    }

    console.log(`[${config.name}] 动态获取到答题任务ID: missionId=${missionId}, missionInstanceId=${missionInstanceId}, examSerialNo=${examSerialNo}`);

    const url = `${apiHost}/api/v2/task/reward?api_version=9.1.0&app_client_id=1&station_id=${config.stationId}&uid=${config.uid}&device_id=${config.deviceId}&latitude=${config.lat}&longitude=${config.lng}&device_token=${config.deviceToken}&gameId=1&missionId=${missionId}&missionInstanceId=${missionInstanceId}&examSerialNo=${examSerialNo}&taskCode=QUIZ1`;
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

async function claimAnyOrderReward(config, headers, taskList) {
    if (!taskList) return `ℹ️ 任意下单任务: 任务列表为空`;
    const anyOrderTask = taskList.find(task => task.taskCode === "ANY_ORDER");
    if (!anyOrderTask || !anyOrderTask.userTaskLogId) return `ℹ️ 任意下单任务: 未在任务列表中找到`;
    
    const url = `${apiHost}/api/v2/task/reward?api_version=9.1.0&app_client_id=1&station_id=${config.stationId}&uid=${config.uid}&device_id=${config.deviceId}&latitude=${config.lat}&longitude=${config.lng}&device_token=${config.deviceToken}&gameId=1&userTaskLogId=${anyOrderTask.userTaskLogId}`;
    const data = await sendRequest({ url, headers });
    if (data.success && data.data.rewards && data.data.rewards.length > 0) return `✅ 任意下单奖励领取成功, 获得${data.data.rewards[0].amount}g饲料`;
    if ((data.data && data.data.taskStatus === "REWARDED") || (data.msg && data.msg.includes("已领取"))) return `ℹ️ 任意下单奖励: ${data.msg || '今日已领取'}`;
    return `ℹ️ 任意下单奖励: ${data.msg || '无法领取'}`;
}

async function claimHardBoxReward(config, headers, taskList) {
    if (!taskList) return `ℹ️ 饲料收集器: 任务列表为空`;
    const hardBoxTask = taskList.find(task => task.taskCode === "HARD_BOX");
    if (!hardBoxTask) return `ℹ️ 饲料收集器: 未在任务列表中找到`;

    if (!hardBoxTask.userTaskLogId) return `ℹ️ 饲料收集器: 任务没有userTaskLogId`;

    const url = `${apiHost}/api/v2/task/reward?api_version=9.1.0&app_client_id=1&station_id=${config.stationId}&uid=${config.uid}&device_id=${config.deviceId}&latitude=${config.lat}&longitude=${config.lng}&device_token=${config.deviceToken}&gameId=1&userTaskLogId=${hardBoxTask.userTaskLogId}`;
    const data = await sendRequest({ url, headers });

    if (data.success && data.data.rewards && data.data.rewards.length > 0) {
        return `✅ 饲料收集器领取成功, 获得${data.data.rewards[0].amount}g饲料`;
    }
    if ((data.data && data.data.taskStatus === "REWARDED") || (data.msg && data.msg.includes("已领取"))) {
        return `ℹ️ 饲料收集器: ${data.msg || '今日已领取'}`;
    }
    return `❌ 饲料收集器领取失败: ${data.msg || '未知错误'}`;
}

async function claimBrowseGoods2Reward(config, headers, taskList) {
    if (!taskList) return `ℹ️ 浏览福利中心: 任务列表为空`;
    const task = taskList.find(t => t.taskCode === "BROWSE_GOODS2");
    if (!task) return `ℹ️ 浏览福利中心: 未在任务列表中找到`;
    
    if (!task.userTaskLogId) {
        return `ℹ️ 浏览福利中心: 缺少logId`;
    }

    const url = `${apiHost}/api/v2/task/reward?api_version=9.1.0&app_client_id=1&station_id=${config.stationId}&uid=${config.uid}&device_id=${config.deviceId}&latitude=${config.lat}&longitude=${config.lng}&device_token=${config.deviceToken}&gameId=1&userTaskLogId=${task.userTaskLogId}`;
    const data = await sendRequest({ url, headers });

    if (data.success && data.data.rewards && data.data.rewards.length > 0) {
        return `✅ 浏览福利中心领取成功, 获得${data.data.rewards[0].amount}g饲料`;
    }
    if ((data.data && data.data.taskStatus === "REWARDED") || (data.msg && (data.msg.includes("已领取") || data.msg.includes("已完成")))) {
        return `ℹ️ 浏览福利中心: ${data.msg || '奖励已领取'}`;
    }
    return `❌ 浏览福利中心领取失败: ${data.msg || '未知错误'}`;
}

async function doBrowseTask(config, headers, taskCode, taskDisplayName, pageUuid) {
    // Step 1: Call 'achieve' to complete the task with the full URL.
    const achieveUrl = `${apiHost}/api/v2/task/achieve?gameId=1&taskCode=${taskCode}&env=PE&native_version=12.16.0&h5_source=&page_type=2&pageUuid=${pageUuid}`;
    let userTaskLogId;

    try {
        console.log(`[${config.name}] 正在尝试完成任务: ${taskDisplayName}...`);
        const achieveData = await sendRequest({ url: achieveUrl, headers });
        
        if (achieveData.success && achieveData.data.userTaskLogId) {
            userTaskLogId = achieveData.data.userTaskLogId;
            console.log(`[${config.name}] 任务完成成功, 获得logId: ${userTaskLogId}`);
        } else if (achieveData.code === 2002 || (achieveData.msg && achieveData.msg.includes("已完成"))) {
            // Task already completed, but we don't have the logId from this call.
            // We must fetch it from the task list.
            console.log(`[${config.name}] 任务之前已完成, 正在查找logId...`);
            const taskList = await fetchTaskList(config, headers);
            const targetTask = taskList.find(t => t.taskCode === taskCode);
            if (targetTask && targetTask.userTaskLogId) {
                if(targetTask.taskStatus === 'REWARDED'){
                    return `ℹ️ ${taskDisplayName}: 奖励早已领取。`;
                }
                userTaskLogId = targetTask.userTaskLogId;
                console.log(`[${config.name}] 从任务列表找到logId: ${userTaskLogId}`);
            } else {
                 return `ℹ️ ${taskDisplayName}: 任务已完成但无法找到logId。`;
            }
        } else {
            // Other errors
            return `❌ ${taskDisplayName} (步骤1/2)失败: ${achieveData.msg || '未知错误'}`;
        }

    } catch (e) {
        return `❌ ${taskDisplayName} (步骤1/2)异常: ${e}`;
    }

    if (!userTaskLogId) {
        return `ℹ️ ${taskDisplayName}: 未能获取到logId, 无法领取奖励。`;
    }

    // Step 2: Claim the reward using the logId.
    console.log(`[${config.name}] 正在尝试为任务[${taskDisplayName}]领取奖励...`);
    const rewardUrl = `${apiHost}/api/v2/task/reward?api_version=9.1.0&app_client_id=1&station_id=${config.stationId}&uid=${config.uid}&device_id=${config.deviceId}&latitude=${config.lat}&longitude=${config.lng}&device_token=${config.deviceToken}&gameId=1&userTaskLogId=${userTaskLogId}`;
    try {
        const rewardData = await sendRequest({ url: rewardUrl, headers });
        if (rewardData.success && rewardData.data.rewards && rewardData.data.rewards.length > 0) {
            return `✅ ${taskDisplayName}领取成功, 获得${rewardData.data.rewards[0].amount}g饲料`;
        } else if (rewardData.msg && rewardData.msg.includes("已领取")) {
             return `ℹ️ ${taskDisplayName}: ${rewardData.msg}`;
        }
        else {
            return `❌ ${taskDisplayName} (步骤2/2)领取失败: ${rewardData.msg || '未知错误'}`;
        }
    } catch (e) {
        return `❌ ${taskDisplayName} (步骤2/2)领取奖励异常: ${e}`;
    }
}

async function fetchLatestIds(config, headers) {
    // Construct the URL using parameters from the config
    const url = `${apiHost}/api/v2/userguide/detail?api_version=9.1.0&app_client_id=1&station_id=${config.stationId}&uid=${config.uid}&device_id=${config.deviceId}&latitude=${config.lat}&longitude=${config.lng}&device_token=${config.deviceToken}&gameId=1&guideCode=FISHPOND_NEW`;
    try {
        const data = await sendRequest({ url, headers });
        if (data.success && data.data) {
            const propsId = data.data.feed?.propsId;
            const seedId = data.data.baseSeed?.seedId;

            if (propsId && seedId) {
                // Update the config object for the current run
                config.propsId = propsId.toString();
                config.seedId = seedId.toString();
                console.log(`[${config.name}] 成功动态获取ID: propsId=${propsId}, seedId=${seedId}`);
                return `✅ 动态获取喂食ID成功`;
            } else {
                const existingIds = config.propsId && config.seedId;
                return existingIds ? `ℹ️ 动态获取ID失败, 使用配置中的旧ID` : `❌ 动态获取喂食ID: 响应中未找到ID`;
            }
        } else {
            return `❌ 动态获取喂食ID失败: ${data.msg || '响应格式不正确'}`;
        }
    } catch (error) {
        return `❌ 动态获取喂食ID异常: ${error}`;
    }
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

async function checkFishProgress(config, headers) {
    const url = `${apiHost}/api/v2/userguide/detail?api_version=9.1.0&app_client_id=1&station_id=${config.stationId}&uid=${config.uid}&device_id=${config.deviceId}&latitude=${config.lat}&longitude=${config.lng}&device_token=${config.deviceToken}&gameId=1&guideCode=FISHPOND_NEW`;
    try {
        const data = await sendRequest({ url, headers });
        if (data.success && data.data && data.data.baseSeed) {
            const progressMsg = data.data.baseSeed.msg;
            const feedAmount = data.data.feed ? data.data.feed.amount : 'N/A';
            return `✅ 进度: ${progressMsg} | 剩余饲料: ${feedAmount}g`;
        } else {
            return `❌ 查询进度失败: ${data.msg || '响应格式不正确'}`;
        }
    } catch (error) {
        return `❌ 查询进度异常: ${error}`;
    }
}

// --- 主执行函数 ---
(async () => {
    const accountsToRun = processConfigs();
    if (accountsToRun.length === 0) {
        console.log("没有找到有效的账号配置, 脚本结束。");
        notify("叮咚农场", "无有效账号", "请确认是否已成功抓取主账号信息或手动填写了其他账号。");
        return;
    }

    console.log(`共找到 ${accountsToRun.length} 个有效账号, 开始执行任务...`);

    for (let i = 0; i < accountsToRun.length; i++) {
        const config = accountsToRun[i];
        console.log(`=============== 开始为账号 [${config.name}] 执行任务 ===============`);

        if (!config.cookie || !config.userAgent) {
            console.log(`[${config.name}] 配置不完整, 跳过。`);
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
        results.push(await executeTask(claimLotteryReward, "三餐福袋", config, commonHeaders));
        
        // --- 获取任务列表并处理依赖任务 ---
        const taskList = await fetchTaskList(config, commonHeaders);
        if (taskList && taskList.length > 0) {
            // 处理答题奖励
            const quizTaskFn = (cfg, hdrs) => claimQuizReward(cfg, hdrs, taskList);
            results.push(await executeTask(quizTaskFn, "答题奖励", config, commonHeaders));

            // 处理任意下单奖励
            const anyOrderTaskFn = (cfg, hdrs) => claimAnyOrderReward(cfg, hdrs, taskList);
            results.push(await executeTask(anyOrderTaskFn, "任意下单奖励", config, commonHeaders));

            // 处理饲料收集器奖励
            const hardBoxTaskFn = (cfg, hdrs) => claimHardBoxReward(cfg, hdrs, taskList);
            results.push(await executeTask(hardBoxTaskFn, "饲料收集器", config, commonHeaders));
            
            // 处理浏览福利中心奖励
            const browseGoods2TaskFn = (cfg, hdrs) => claimBrowseGoods2Reward(cfg, hdrs, taskList);
            results.push(await executeTask(browseGoods2TaskFn, "浏览福利中心", config, commonHeaders));

            // 处理自动浏览任务
            const browseTaskObject = taskList.find(task => task.taskCode === "BROWSE_GOODS3");
            if (browseTaskObject && browseTaskObject.cmsLink) {
                const pageUuid = getURLParam(browseTaskObject.cmsLink, 'uuid');
                if (pageUuid) {
                    console.log(`[${config.name}] 动态获取到 '浏览品质之爱' 的 pageUuid: ${pageUuid}`);
                    const browseTaskThunk = (cfg, hdrs) => doBrowseTask(cfg, hdrs, "BROWSE_GOODS3", "浏览品质之爱", pageUuid);
                    results.push(await executeTask(browseTaskThunk, "浏览品质之爱", config, commonHeaders));
                } else {
                    results.push("ℹ️ '浏览品质之爱': 未能在cmsLink中找到pageUuid");
                }
            } else {
                results.push("ℹ️ '浏览品质之爱': 未在任务列表中找到或缺少cmsLink");
            }
        } else {
            console.log(`[${config.name}] 获取任务列表失败, 跳过依赖任务。`);
        }

        results.push(await executeTask(fetchLatestIds, "动态获取喂食ID", config, commonHeaders));
        results.push(await executeTask(feed, "自动喂食", config, commonHeaders));
        results.push(await executeTask(checkFishProgress, "查询最新进度", config, commonHeaders));

        const summary = results.filter(res => res).join('\n');
        notify(config.name, '叮咚农场任务报告', '', summary);
        
        console.log(`=============== 账号 [${config.name}] 任务执行完毕 ===============`);
        
        if (i < accountsToRun.length - 1) {
            console.log(`等待5秒后处理下一个账号...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
    console.log("\n所有账号任务执行完毕。");
})().finally(() => {
    if (typeof $done !== 'undefined') {
        $done();
    }
});