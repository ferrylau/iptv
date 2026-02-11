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

const $ = MagicJS("叮咚农场", "INFO");

const ddxq_headers_key = "ddxq_headers_v1";
const ddxq_url_key = "ddxq_url_v1";
const ddxq_props_id_key = "ddxq_props_id_v1";
const ddxq_seed_id_key = "ddxq_seed_id_v1";
const apiHost = 'https://farm.api.ddxq.mobi';

// 统一API的请求函数 (使用MagicJS)
const sendRequest = (options) => {
  return new Promise((resolve, reject) => {
    $.http.get(options).then(resp => {
      // MagicJS 默认不因HTTP错误状态码而拒绝，所以我们手动检查
      if (resp.status >= 200 && resp.status < 300) {
        // resp.body 应该已经被 MagicJS 尝试解析为对象了
        resolve(resp.body);
      } else {
        reject(`HTTP Error: ${resp.status}`);
      }
    }).catch(err => {
      // MagicJS 在网络层面的错误（如超时、无法连接）会在这里捕获
      reject(`Request Failed: ${err.message || err}`);
    });
  });
};

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
    // 检查是否在Surge/Shadowrocket环境中
    const p_store = typeof $persistentStore !== 'undefined' ? $persistentStore : null;
    if (!p_store) {
        $.logger.warning("非Surge/Shadowrocket环境，无法读取农场持久化数据！");
        // 对于手动配置，即使没有p_store也应该继续处理
    }

    const storedHeadersStr = p_store ? p_store.read(ddxq_headers_key) : null;
    const storedUrl = p_store ? p_store.read(ddxq_url_key) : null;
    const storedPropsId = p_store ? p_store.read(ddxq_props_id_key) : null;
    const storedSeedId = p_store ? p_store.read(ddxq_seed_id_key) : null;

    for (const cfg of configs) {
        if (cfg.useStore) {
            if (storedHeadersStr && storedUrl) {
                $.logger.info(`[${cfg.name}] 检测到已保存的会话信息, 将进行处理。`);
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
                $.logger.warning(`[${cfg.name}] 配置为自动抓取, 但未找到已保存的会话信息, 跳过。`);
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

async function handleMultiOrderTask(config, headers) {
    // 1. Check the task status first
    const listUrl = `${apiHost}/api/v2/task/list?api_version=9.1.0&app_client_id=1&station_id=${config.stationId}&uid=${config.uid}&device_id=${config.deviceId}&latitude=${config.lat}&longitude=${config.lng}&device_token=${config.deviceToken}&gameId=1&taskCode=MULTI_ORDER`;
    
    let statusData;
    try {
        statusData = await sendRequest({ url: listUrl, headers });
    } catch (e) {
        return `❌ N单有礼-查询失败: ${e}`;
    }

    if (!statusData.success || !statusData.data.userTasks || statusData.data.userTasks.length === 0) {
        return `ℹ️ N单有礼-未找到任务信息。`;
    }

    const multiOrderTask = statusData.data.userTasks[0];
    const buttonStatus = multiOrderTask.buttonStatus;

    // 2. If reward is ready to be claimed (TO_REWARD status)
    if (buttonStatus === 'TO_REWARD') {
        $.logger.info(`[${config.name}] N单有礼状态为[待领奖]，开始检查可领奖的任务...`);

        const achievableTasks = multiOrderTask.targetRewardRangesVos.filter(t => t.status === 'ACHIEVED' && t.userTaskLogId);

        if (achievableTasks.length === 0) {
            return `ℹ️ N单有礼: 状态为[待领奖]但未找到可领取的具体任务。`;
        }

        const logIds = achievableTasks.map(t => t.userTaskLogId).join(',');
        $.logger.info(`[${config.name}] 找到可领奖的logIds: ${logIds}`);

        const rewardUrl = `${apiHost}/api/v2/task/batchReward?api_version=9.1.0&app_client_id=1&station_id=${config.stationId}&uid=${config.uid}&device_id=${config.deviceId}&latitude=${config.lat}&longitude=${config.lng}&device_token=${config.deviceToken}&gameId=1&taskCode=MULTI_ORDER&userTaskLogIds=${logIds}`;
        
        try {
            const rewardData = await sendRequest({ url: rewardUrl, headers });
            if (rewardData.success && rewardData.data.taskRewardsVos) {
                const rewardAmount = rewardData.data.taskRewardsVos.reduce((sum, task) => {
                    return sum + task.rewards.reduce((subSum, reward) => subSum + reward.amount, 0);
                }, 0);
                return `✅ N单有礼-领取成功! 共获得 ${rewardAmount}g 饲料。`;
            } else {
                return `❌ N单有礼-领取失败: ${rewardData.msg || '未知错误'}`;
            }
        } catch (e) {
            return `❌ N单有礼-领取异常: ${e}`;
        }
    } else if (buttonStatus === 'TO_RECEIVE') {
        // Fallback for the old logic, just in case
        $.logger.info(`[${config.name}] N单有礼状态为[待领取]，尝试激活任务...`);
        const receiveUrl = `${apiHost}/api/v2/task/receive?api_version=9.1.0&app_client_id=1&station_id=${config.stationId}&uid=${config.uid}&device_id=${config.deviceId}&latitude=${config.lat}&longitude=${config.lng}&device_token=${config.deviceToken}&gameId=1&taskCode=MULTI_ORDER`;
        
        try {
            const receiveData = await sendRequest({ url: receiveUrl, headers });
            if (receiveData.success) {
                return `✅ N单有礼-激活成功! 新状态: [${receiveData.data?.buttonStatus || '未知'}]`;
            } else {
                return `❌ N单有礼-激活失败: ${receiveData.msg || '未知错误'}`;
            }
        } catch (e) {
            return `❌ N单有礼-激活异常: ${e}`;
        }
    } else {
        // If status is not TO_REWARD or TO_RECEIVE, just report it
        return `ℹ️ N单有礼-无需操作: 当前状态为 [${buttonStatus}]`;
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
        $.notification.post("叮咚农场", "无有效账号", "请确认是否已成功抓取主账号信息或手动填写了其他账号。");
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
        results.push(await executeTask(handleMultiOrderTask, "N单有礼", config, commonHeaders));
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
        $.notification.post(`[${config.name}] 叮咚农场任务报告`, '', summary);
        
        console.log(`=============== 账号 [${config.name}] 任务执行完毕 ===============`);
        
        if (i < accountsToRun.length - 1) {
            console.log(`等待5秒后处理下一个账号...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
    console.log("\n所有账号任务执行完毕。");
})().finally(() => {
    $.done();
});


/**
 *
 * This script is generated by Gemini. It's a combination of other scripts.
 * The MagicJS library is included below.
 *
 */
// @formatter:off
function MagicJS(e="MagicJS",t="INFO"){const i=()=>{const e=typeof $loon!=="undefined";const t=typeof $task!=="undefined";const n=typeof module!=="undefined";const i=typeof $httpClient!=="undefined"&&!e;const s=typeof $storm!=="undefined";const r=typeof $environment!=="undefined"&&typeof $environment["stash-build"]!=="undefined";const o=i||e||s||r;const u=typeof importModule!=="undefined";return{isLoon:e,isQuanX:t,isNode:n,isSurge:i,isStorm:s,isStash:r,isSurgeLike:o,isScriptable:u,get name(){if(e){return"Loon"}else if(t){return"QuantumultX"}else if(n){return"NodeJS"}else if(i){return"Surge"}else if(u){return"Scriptable"}else{return"unknown"}},get build(){if(i){return $environment["surge-build"]}else if(r){return $environment["stash-build"]}else if(s){return $storm.buildVersion}},get language(){if(i||r){return $environment["language"]}},get version(){if(i){return $environment["surge-version"]}else if(r){return $environment["stash-version"]}else if(s){return $storm.appVersion}else if(n){return process.version}},get system(){if(i){return $environment["system"]}else if(n){return process.platform}},get systemVersion(){if(s){return $storm.systemVersion}},get deviceName(){if(s){return $storm.deviceName}}}};const s=(n,e="INFO")=>{let i=e;const s={SNIFFER:6,DEBUG:5,INFO:4,NOTIFY:3,WARNING:2,ERROR:1,CRITICAL:0,NONE:-1};const r={SNIFFER:"",DEBUG:"",INFO:"",NOTIFY:"",WARNING:"❗ ",ERROR:"❌ ",CRITICAL:"❌ ",NONE:""};const t=(e,t="INFO")=>{if(!(s[i]<s[t.toUpperCase()]))console.log(`[${t}] [${n}]
${r[t.toUpperCase()]}${e}
`)};const o=e=>{i=e};return{setLevel:o,sniffer:e=>{t(e,"SNIFFER")},debug:e=>{t(e,"DEBUG")},info:e=>{t(e,"INFO")},notify:e=>{t(e,"NOTIFY")},warning:e=>{t(e,"WARNING")},error:e=>{t(e,"ERROR")},retry:e=>{t(e,"RETRY")}}};return new class{constructor(e,t){this._startTime=Date.now();this.version="3.0.0";this.scriptName=e;this.env=i();this.logger=s(e,t);this.http=typeof MagicHttp==="function"?MagicHttp(this.env,this.logger):undefined;this.data=typeof MagicData==="function"?MagicData(this.env,this.logger):undefined;this.notification=typeof MagicNotification==="function"?MagicNotification(this.scriptName,this.env,this.logger):undefined;this.utils=typeof MagicUtils==="function"?MagicUtils(this.env,this.logger):undefined;this.qinglong=typeof MagicQingLong==="function"?MagicQingLong(this.env,this.data,this.logger):undefined;if(typeof this.data!=="undefined"){let e=this.data.read("magic_loglevel");const n=this.data.read("magic_bark_url");if(e){this.logger.setLevel(e.toUpperCase())}if(n){this.notification.setBark(n)}}}get isRequest(){return typeof $request!=="undefined"&&typeof $response==="undefined"}get isResponse(){return typeof $response!=="undefined"}get isDebug(){return this.logger.level==="DEBUG"}get request(){if(typeof $request!=="undefined"){this.logger.sniffer(`RESPONSE:
${JSON.stringify($request)}`);return $request}}get response(){if(typeof $response!=="undefined"){if($response.hasOwnProperty("status"))$response["statusCode"]=$response["status"];if($response.hasOwnProperty("statusCode"))$response["status"]=$response["statusCode"];this.logger.sniffer(`RESPONSE:
${JSON.stringify($response)}`);return $response}else{return undefined}}done=(e={})=>{this._endTime=Date.now();let t=(this._endTime-this._startTime)/1e3;this.logger.info(`SCRIPT COMPLETED: ${t} S.`);if(typeof $done!=="undefined"){$done(e)}}}(e,t)}
function MagicHttp(c,l){const e="Mozilla/5.0 (iPhone; CPU iPhone OS 13_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.5 Mobile/15E148 Safari/604.1";const t="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.125 Safari/537.36 Edg/84.0.522.59";let r;if(c.isNode){const S=require("axios");r=S.create()}class s{constructor(e=true){this.handlers=[];this.isRequest=e}use(e,t,r){this.handlers.push({fulfilled:e,rejected:t,synchronous:r?r.synchronous:false,runWhen:r?r.runWhen:null});return this.handlers.length-1}eject(e){if(this.handlers[e]){this.handlers[e]=null}}forEach(t){this.handlers.forEach(e=>{if(e!==null){t(e)}})}}function n(e){let r={...e};if(!!r.params){if(!c.isNode){let e=Object.keys(r.params).map(e=>{const t=encodeURIComponent(e);r.url=r.url.replace(new RegExp(`${e}=[^&]*`,"ig"),"");r.url=r.url.replace(new RegExp(`${t}=[^&]*`,"ig"),"");return`${t}=${encodeURIComponent(r.params[e])}`}).join("&");if(r.url.indexOf("?")<0)r.url+="?";if(!/(&|\?)$/g.test(r.url)){r.url+="&"}r.url+=e;delete r.params;l.debug(`Params to QueryString: ${r.url}`)}}return r}const d=(e,t)=>{let r=typeof t==="object"?{headers:{},...t}:{url:t,headers:{}};if(!r.method){r["method"]=e}r=n(r);if(r["rewrite"]===true){if(c.isSurge){r.headers["X-Surge-Skip-Scripting"]=false;delete r["rewrite"]}else if(c.isQuanX){r["hints"]=false;delete r["rewrite"]}}if(c.isSurge){if(r["method"]!=="GET"&&r.headers["Content-Type"].indexOf("application/json")>=0&&r.body instanceof Array){r.body=JSON.stringify(r.body);l.debug(`Convert Array object to String: ${r.body}`)}}else if(c.isQuanX){if(r.hasOwnProperty("body")&&typeof r["body"]!=="string")r["body"]=JSON.stringify(r["body"]);r["method"]=e}else if(c.isNode){if(e==="POST"||e==="PUT"||e==="PATCH"||e==="DELETE"){r.data=r.data||r.body}else if(e==="GET"){r.params=r.params||r.body}delete r.body}return r};const f=(t,r=null)=>{if(t){let e={...t,config:t.config||r,status:t.statusCode||t.status,body:t.body||t.data,headers:t.headers||t.header};if(typeof e.body==="string"){try{e.body=JSON.parse(e.body)}catch{}}delete t.data;return e}else{return t}};const o=r=>{return Object.keys(r).reduce((e,t)=>{e[t.toLowerCase()]=r[t];return e},{})};const i=s=>{return Object.keys(s).reduce((e,t)=>{const r=t.split("-").map(e=>e[0].toUpperCase()+e.slice(1)).join("-");e[r]=s[t];return e},{})};const h=(t,r=null)=>{if(!!t&&t.status>=400){l.debug(`Raise exception when status code is ${t.status}`);let e={name:"RequestException",message:`Request failed with status code ${t.status}`,config:r||t.config,response:t};return e}};const a={request:new s,response:new s(false)};let p=[];let y=[];let g=true;function m(e){e=n(e);l.debug(`HTTP ${e["method"].toUpperCase()}:
${JSON.stringify(e)}`);return e}function b(e){try{e=!!e?f(e):e;l.sniffer(`HTTP ${e.config["method"].toUpperCase()}:
${JSON.stringify(e.config)}
STATUS CODE:
${e.status}
RESPONSE:
${typeof e.body==="object"?JSON.stringify(e.body):e.body}`);const t=h(e);if(!!t){return Promise.reject(t)}return e}catch(t){l.error(t);return e}}const T=t=>{try{p=[];y=[];a.request.forEach(e=>{if(typeof e.runWhen==="function"&&e.runWhen(t)===false){return}g=g&&e.synchronous;p.unshift(e.fulfilled,e.rejected)});a.response.forEach(e=>{y.push(e.fulfilled,e.rejected)})}catch(e){l.error(`Failed to register interceptors: ${e}.`)}};const u=(e,s)=>{let n;const t=e.toUpperCase();s=d(t,s);if(c.isNode){n=r}else{if(c.isSurgeLike){n=o=>{return new Promise((s,n)=>{$httpClient[e.toLowerCase()](o,(t,r,e)=>{if(t){let e={name:t.name||t,message:t.message||t,stack:t.stack||t,config:o,response:f(r)};n(e)}else{r.config=o;r.body=e;s(r)}})})}}else{n=n=>{return new Promise((r,s)=>{$task.fetch(n).then(e=>{e=f(e,n);const t=h(e,n);if(t){return Promise.reject(t)}r(e)}).catch(e=>{let t={name:e.message||e.error,message:e.message||e.error,stack:e.error,config:n,response:!!e.response?f(e.response):null};s(t)})})}}}let o;T(s);const i=[m,undefined];const a=[b,undefined];if(!g){l.debug("Interceptors are executed in asynchronous mode.");let r=[n,undefined];Array.prototype.unshift.apply(r,i);Array.prototype.unshift.apply(r,p);r=r.concat(a);r=r.concat(y);o=Promise.resolve(s);while(r.length){try{let e=r.shift();let t=r.shift();if(!c.isNode&&s["timeout"]&&e===n){o=u(s)}else{o=o.then(e,t)}}catch(e){l.error(`request exception: ${e}`)}}return o}else{l.debug("Interceptors are executed in synchronous mode.");Array.prototype.unshift.apply(p,i);p=p.concat([m,undefined]);while(p.length){let e=p.shift();let t=p.shift();try{s=e(s)}catch(e){t(e);break}}try{if(!c.isNode&&s["timeout"]){o=u(s)}else{o=n(s)}}catch(e){return Promise.reject(e)}Array.prototype.unshift.apply(y,a);while(y.length){o=o.then(y.shift(),y.shift())}return o}function u(r){try{const e=new Promise((e,t)=>{setTimeout(()=>{let e={message:`timeout of ${r["timeout"]}ms exceeded.`,config:r};t(e)},r["timeout"])});return Promise.race([n(r),e])}catch(e){l.error(`Request Timeout exception: ${e}.`)}}};return{request:u,interceptors:a,convertHeadersToLowerCase:o,convertHeadersToCamelCase:i,modifyResponse:f,get:e=>{return u("GET",e)},post:e=>{return u("POST",e)},put:e=>{return u("PUT",e)},patch:e=>{return u("PATCH",e)},delete:e=>{return u("DELETE",e)},head:e=>{return u("HEAD",e)},options:e=>{return u("OPTIONS",e)}}}
function MagicData(i,u){let f={fs:undefined,data:{}};if(i.isNode){f.fs=require("fs");try{f.fs.accessSync("./magic.json",f.fs.constants.R_OK|f.fs.constants.W_OK)}catch(e){f.fs.writeFileSync("./magic.json","{}",{encoding:"utf8"})}f.data=require("./magic.json")}const o=(e,t)=>{if(typeof t==="object"){return false}else{return e===t}};const a=e=>{if(e==="true"){return true}else if(e==="false"){return false}else if(typeof e==="undefined"){return null}else{return e}};const c=(e,t,s,n)=>{if(s){try{if(typeof e==="string")e=JSON.parse(e);if(e["magic_session"]===true){e=e[s]}else{e=null}}catch{e=null}}if(typeof e==="string"&&e!=="null"){try{e=JSON.parse(e)}catch{}}if(n===false&&!!e&&e["magic_session"]===true){e=null}if((e===null||typeof e==="undefined")&&t!==null&&typeof t!=="undefined"){e=t}e=a(e);return e};const l=t=>{if(typeof t==="string"){let e={};try{e=JSON.parse(t);const s=typeof e;if(s!=="object"||e instanceof Array||s==="bool"||e===null){e={}}}catch{}return e}else if(t instanceof Array||t===null||typeof t==="undefined"||t!==t||typeof t==="boolean"){return{}}else{return t}};const y=(e,t=null,s="",n=false,r=null)=>{let l=r||f.data;if(!!l&&typeof l[e]!=="undefined"&&l[e]!==null){val=l[e]}else{val=!!s?{}:null}val=c(val,t,s,n);return val};const d=(e,t=null,s="",n=false,r=null)=>{let l="";if(r||i.isNode){l=y(e,t,s,n,r)}else{if(i.isSurgeLike){l=$persistentStore.read(e)}else if(i.isQuanX){l=$prefs.valueForKey(e)}l=c(l,t,s,n)}u.debug(`READ DATA [${e}]${!!s?`[${s}]`:""} <${typeof l}>
${JSON.stringify(l)}`);return l};const p=(t,s,n="",e=null)=>{let r=e||f.data;r=l(r);if(!!n){let e=l(r[t]);e["magic_session"]=true;e[n]=s;r[t]=e}else{r[t]=s}if(e!==null){e=r}return r};const S=(e,t,s="",n=null)=>{if(typeof t==="undefined"||t!==t){return false}if(!i.isNode&&(typeof t==="boolean"||typeof t==="number")){t=String(t)}let r="";if(n||i.isNode){r=p(e,t,s,n)}else{if(!s){r=t}else{if(i.isSurgeLike){r=!!$persistentStore.read(e)?$persistentStore.read(e):r}else if(i.isQuanX){r=!!$prefs.valueForKey(e)?$prefs.valueForKey(e):r}r=l(r);r["magic_session"]=true;r[s]=t}}if(!!r&&typeof r==="object"){r=JSON.stringify(r,null,4)}u.debug(`WRITE DATA [${e}]${s?`[${s}]`:""} <${typeof t}>
${JSON.stringify(t)}`);if(!n){if(i.isSurgeLike){return $persistentStore.write(r,e)}else if(i.isQuanX){return $prefs.setValueForKey(r,e)}else if(i.isNode){try{f.fs.writeFileSync("./magic.json",r);return true}catch(e){u.error(e);return false}}}return true};const e=(t,s,n,r=o,l=null)=>{s=a(s);const e=d(t,null,n,false,l);if(r(e,s)===true){return false}else{const i=S(t,s,n,l);let e=d(t,null,n,false,l);if(r===o&&typeof e==="object"){return i}return r(s,e)}};const g=(e,t,s)=>{let n=s||f.data;n=l(n);if(!!t){obj=l(n[e]);delete obj[t];n[e]=obj}else{delete n[e]}if(!!s){s=n}return n};const t=(e,t="",s=null)=>{let n={};if(s||i.isNode){n=g(e,t,s);if(!s){f.fs.writeFileSync("./magic.json",JSON.stringify(n,null,4))}else{s=n}}else{if(!t){if(i.isStorm){return $persistentStore.remove(e)}else if(i.isSurgeLike){return $persistentStore.write(null,e)}else if(i.isQuanX){return $prefs.removeValueForKey(e)}}else{if(i.isSurgeLike){n=$persistentStore.read(e)}else if(i.isQuanX){n=$prefs.valueForKey(e)}n=l(n);delete n[t];const r=JSON.stringify(n,null,4);S(e,r)}}u.debug(`DELETE KEY [${e}]${!!t?`[${t}]`:""}`)};const s=(e,t=null)=>{let s=[];let n=d(e,null,null,true,t);n=l(n);if(n["magic_session"]!==true){s=[]}else{s=Object.keys(n).filter(e=>e!=="magic_session")}u.debug(`READ ALL SESSIONS [${e}] <${typeof s}>
${JSON.stringify(s,null,4)}`);return s};const n=(e,t=null)=>{let s={};let n=d(e,null,null,true,t);n=l(n);if(n["magic_session"]===true){s={...n};delete s["magic_session"]}u.debug(`READ ALL SESSIONS [${e}] <${typeof s}>
${JSON.stringify(s,null,4)}`);return s};return{read:d,write:S,del:t,update:e,allSessions:n,allSessionNames:s,defaultValueComparator:o,convertToObject:l}}
function MagicNotification(r,f,l){let s=null;let u=null;const c=typeof MagicHttp==="function"?MagicHttp(f,l):undefined;const e=t=>{try{let e=t.replace(/\/+$/g,"");s=`${/^https?:\/\/([^/]*)/.exec(e)[0]}/push`;u=/\/([^\/]+)\/?$/.exec(e)[1]}catch(e){l.error(`Bark url error: ${e}.`)}};function t(e=r,t="",i="",o=""){const n=i=>{try{let t={};if(typeof i==="string"){if(f.isLoon)t={openUrl:i};else if(f.isQuanX)t={"open-url":i};else if(f.isSurge)t={url:i}}else if(typeof i==="object"){if(f.isLoon){t["openUrl"]=!!i["open-url"]?i["open-url"]:"";t["mediaUrl"]=!!i["media-url"]?i["media-url"]:""}else if(f.isQuanX){t=!!i["open-url"]||!!i["media-url"]?i:{}}else if(f.isSurge){let e=i["open-url"]||i["openUrl"];t=e?{url:e}:{}}}return t}catch(e){l.error(`Failed to convert notification option, ${e}`)}return i};o=n(o);if(arguments.length==1){e=r;t="",i=arguments[0]}l.notify(`title:${e}
subTitle:${t}
body:${i}
options:${typeof o==="object"?JSON.stringify(o):o}`);if(f.isSurge){$notification.post(e,t,i,o)}else if(f.isLoon){if(!!o)$notification.post(e,t,i,o);else $notification.post(e,t,i)}else if(f.isQuanX){$notify(e,t,i,o)}if(s&&u&&typeof c!=="undefined"){p(e,t,i)}}function i(e=r,t="",i="",o=""){if(l.level==="DEBUG"){if(arguments.length==1){e=r;t="",i=arguments[0]}this.notify(e,t,i,o)}}function p(e=r,t="",i="",o=""){if(typeof c==="undefined"||typeof c.post==="undefined"){throw"Bark notification needs to import MagicHttp module."}let n={url:s,headers:{"Content-Type":"application/json; charset=utf-8"},body:{title:e,body:t?`${t}
${i}`:i,device_key:u}};c.post(n).catch(e=>{l.error(`Bark notify error: ${e}`)})}return{post:t,debug:i,bark:p,setBark:e}}
function MagicUtils(r,h){const e=(o,i=5,l=0,a=null)=>{return(...e)=>{return new Promise((s,r)=>{function n(...t){Promise.resolve().then(()=>o.apply(this,t)).then(e=>{if(typeof a==="function"){Promise.resolve().then(()=>a(e)).then(()=>{s(e)}).catch(e=>{if(i>=1){if(l>0)setTimeout(()=>n.apply(this,t),l);else n.apply(this,t)}else{r(e)}i--})}else{s(e)}}).catch(e=>{h.error(e);if(i>=1&&l>0){setTimeout(()=>n.apply(this,t),l)}else if(i>=1){n.apply(this,t)}else{r(e)}i--})}n.apply(this,e)})}};const t=(e,t="yyyy-MM-dd hh:mm:ss")=>{let s={"M+":e.getMonth()+1,"d+":e.getDate(),"h+":e.getHours(),"m+":e.getMinutes(),"s+":e.getSeconds(),"q+":Math.floor((e.getMonth()+3)/3),S:e.getMilliseconds()};if(/(y+)/.test(t))t=t.replace(RegExp.$1,(e.getFullYear()+"").substr(4-RegExp.$1.length));for(let e in s)if(new RegExp("("+e+")").test(t))t=t.replace(RegExp.$1,RegExp.$1.length==1?s[e]:("00"+s[e]).substr((""+s[e]).length));return t};const s=()=>{return t(new Date,"yyyy-MM-dd hh:mm:ss")};const n=()=>{return t(new Date,"yyyy-MM-dd")};const o=t=>{return new Promise(e=>setTimeout(e,t))};const i=(e,t=null)=>{if(r.isNode){const s=require("assert");if(t)s(e,t);else s(e)}else{if(e!==true){let e=`AssertionError: ${t||"The expression evaluated to a falsy value"}`;h.error(e)}}};return{retry:e,formatTime:t,now:s,today:n,sleep:o,assert:i}}
function MagicQingLong(e,s,o){let i="";let l="";let c="";let u="";let d="";let n="";const g="magic.json";const r=3e3;const f=MagicHttp(e,o);const t=(e,n,r,t,a)=>{i=e;c=n;u=r;l=t;d=a};function a(e){i=i||s.read("magic_qlurl");n=n||s.read("magic_qltoken");return e}function p(e){if(!i){i=s.read("magic_qlurl")}if(e.url.indexOf(i)<0){e.url=`${i}${e.url}`}return{...e,timeout:r}}function y(e){e.params={...e.params,t:Date.now()};return e}function m(e){n=n||s.read("magic_qltoken");if(n){e.headers["authorization"]=`Bearer ${n}`}return e}function h(e){c=c||s.read("magic_qlclient");if(!!c){e.url=e.url.replace("/api/","/open/")}return e}async function b(e){try{const n=e.message||e.error||JSON.stringify(e);if((n.indexOf("NSURLErrorDomain")>=0&&n.indexOf("-1012")>=0||!!e.response&&e.response.status===401)&&!!e.config&&e.config.refreshToken!==true){o.warning(`Qinglong Panel token has expired.`);await v();e.config["refreshToken"]=true;return await f.request(e.config.method,e.config)}else{return Promise.reject(e)}}catch(e){return Promise.reject(e)}}f.interceptors.request.use(a,undefined);f.interceptors.request.use(p,undefined);f.interceptors.request.use(h,undefined,{runWhen:e=>{return e.url.indexOf("api/user/login")<0&&e.url.indexOf("open/auth/token")<0}});f.interceptors.request.use(m,undefined,{runWhen:e=>{return e.url.indexOf("api/user/login")<0&&e.url.indexOf("open/auth/token")<0}});f.interceptors.request.use(y,undefined,{runWhen:e=>{return e.url.indexOf("open/auth/token")<0&&e.url.indexOf("t=")<0}});f.interceptors.response.use(undefined,b);async function v(){c=c||s.read("magic_qlclient");u=u||s.read("magic_qlsecrt");l=l||s.read("magic_qlname");d=d||s.read("magic_qlpwd");if(i&&c&&u){await f.get({url:`/open/auth/token`,headers:{"content-type":"application/json"},params:{client_id:c,client_secret:u}}).then(e=>{if(Object.keys(e.body).length>0&&e.body.data&&e.body.data.token){o.info("Successfully logged in to Qinglong Panel");n=e.body.data.token;s.update("magic_qltoken",n);return n}else{throw new Error("Get Qinglong Panel token failed.")}}).catch(e=>{o.error(`Error logging in to Qinglong Panel.
${e.message}`)})}else if(i&&l&&d){await f.post({url:`/api/user/login`,headers:{"content-type":"application/json"},body:{username:l,password:d}}).then(e=>{o.info("Successfully logged in to Qinglong Panel");n=e.body.data.token;s.update("magic_qltoken",n);return n}).catch(e=>{o.error(`Error logging in to Qinglong Panel.
${e.message}`)})}}async function w(n,r,t=null){i=i||s.read("magic_qlurl");if(t===null){let e=await E([{name:n,value:r}]);if(!!e&&e.length===1){return e[0]}}else{f.put({url:`/api/envs`,headers:{"content-type":"application/json"},body:{name:n,value:r,id:t}}).then(e=>{if(e.body.code===200){o.debug(`QINGLONG UPDATE ENV ${n} <${typeof r}> (${t})
${JSON.stringify(r)}`);return true}else{o.error(`Error updating environment variable from Qinglong Panel.
${JSON.stringify(e)}`)}}).catch(e=>{o.error(`Error updating environment variable from Qinglong Panel.
${e.message}`);return false})}}async function E(e){let n=[];await f.post({url:`/api/envs`,headers:{"content-type":"application/json"},body:e}).then(e=>{if(e.body.code===200){e.body.data.forEach(e=>{o.debug(`QINGLONG ADD ENV ${e.name} <${typeof e.value}> (${e.id})
${JSON.stringify(e)}`);n.push(e.id)})}else{o.error(`Error adding environment variable from Qinglong Panel.
${JSON.stringify(e)}`)}}).catch(e=>{o.error(`Error adding environment variable from Qinglong Panel.
${e.message}`)});return n}async function N(n){return await f.delete({url:`/api/envs`,headers:{accept:"application/json","accept-language":"zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",connection:"keep-alive","content-type":"application/json;charset=UTF-8","user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.5005.63 Safari/537.36 Edg/102.0.1245.30"},body:n}).then(e=>{if(e.body.code===200){o.debug(`QINGLONG DELETE ENV IDS: ${n}`);return true}else{o.error(`Error deleting environment variable from Qinglong Panel.
${JSON.stringify(e)}`);return false}}).catch(e=>{o.error(`Error deleting environment variable from Qinglong Panel.
${e.message}`)})}async function O(t=null,a="",i=0){if(i<=3){let r=[];await f.get({url:`/api/envs`,headers:{"content-type":"application/json"},params:{searchValue:a}}).then(e=>{if(e.body.code===200){const n=e.body.data;if(!!t){let e=[];for(const e of n){if(e.name===t){r.push(e)}}r=e}r=n}else{o.error(`Error reading environment variable from Qinglong Panel.
${JSON.stringify(e)}`);b();i+=1;O(t,a,i)}}).catch(e=>{o.error(`Error reading environment variable from Qinglong Panel.
${JSON.stringify(e)}`);b();i+=1;O(t,a,i)});return r}else{throw new Error("An error occurred while reading environment variable from Qinglong Panel.")}}async function S(e){let n=null;const r=await O();for(const t of r){if(t.id===e){n=t;break}}return n}async function $(n){let r=false;await f.put({url:`/api/envs/disable`,headers:{accept:"application/json","accept-Language":"zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",connection:"keep-alive","content-type":"application/json;charset=UTF-8","user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.5005.63 Safari/537.36 Edg/102.0.1245.30"},body:n}).then(e=>{if(e.body.code===200){o.debug(`QINGLONG DISABLED ENV IDS: ${n}`);r=true}else{o.error(`Error disabling environment variable from Qinglong Panel.
${JSON.stringify(e)}`)}}).catch(e=>{o.error(`Error disabling environment variable from Qinglong Panel.
${e.message}`)});return r}async function Q(n){let r=false;await f.put({url:`/api/envs/enable`,headers:{accept:"application/json","accept-language":"zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",connection:"keep-alive","content-type":"application/json;charset=UTF-8","user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.5005.63 Safari/537.36 Edg/102.0.1245.30"},body:n}).then(e=>{if(e.body.code===200){o.debug(`QINGLONG ENABLED ENV IDS: ${n}`);r=true}else{o.error(`Error enabling environment variable from Qilong panel.
${JSON.stringify(e)}`)}}).catch(e=>{o.error(`Error enabling environment variable from Qilong panel.
${e.message}`)});return r}async function q(e,n="",r=""){let t=false;await f.post({url:`/api/scripts`,headers:{"content-type":"application/json"},body:{filename:e,path:n,content:r}}).then(e=>{if(e.body.code===200){t=true}else{o.error(`Error reading data from Qinglong Panel.
${JSON.stringify(e)}`)}}).catch(e=>{o.error(`Error reading data from Qinglong Panel.
${e.message}`)});return t}async function P(r,t="",a=0){if(a<=3){let n="";await f.get({url:`/api/scripts/${r}`,params:{path:t}}).then(async e=>{if(e.body.code===200){n=e.body.data}else{o.error(`Error reading data from Qinglong Panel.
${JSON.stringify(e)}`);await b();a+=1;return await P(r,t,a)}}).catch(async e=>{o.error(`Error reading data from Qinglong Panel.
${e.message?e.message:e}`);await b();a+=1;return await P(r,t,a)});return n}else{throw new Error("An error occurred while reading the data from Qinglong Panel.")}}async function j(e,n="",r=""){let t=false;await f.put({url:`/api/scripts`,headers:{"content-type":"application/json"},body:{filename:e,path:n,content:r}}).then(e=>{if(e.body.code===200){t=true}else{o.error(`Error reading data from Qinglong Panel.
${JSON.stringify(e)}`)}}).catch(e=>{o.error(`Error reading data from Qinglong Panel.
${e.message}`)});return t}async function k(e,n=""){let r=false;await f.delete({url:`/api/scripts`,headers:{"content-type":"application/json"},body:{filename:e,path:n}}).then(e=>{if(e.body.code===200){r=true}else{o.error(`Error reading data from Qinglong Panel.
${JSON.stringify(e)}`)}}).catch(e=>{o.error(`Error reading data from Qinglong Panel.
${e.message}`)});return r}async function T(e,n,r=""){let t=await P(g,"");let a=s.convertToObject(t);let i=s.write(e,n,r,a);t=JSON.stringify(a,null,4);let o=await j(g,"",t);return o&&i}async function J(...n){let e=await P(g,"");let r=s.convertToObject(e);for(let e of n){s.write(e[0],e[1],typeof e[2]!=="undefined"?e[2]:"",r)}e=JSON.stringify(r,null,4);return await j(g,"",e)}async function G(e,n,r,t=s.defaultValueComparator){let a=await P(g,"");let i=s.convertToObject(a);const o=s.update(e,n,r,t,i);let l=false;if(o===true){a=JSON.stringify(i,null,4);l=await j(g,"",a)}return o&&l}async function _(...n){let e=await P(g,"");let r=s.convertToObject(e);for(let e of n){s.update(e[0],e[1],typeof e[2]!=="undefined"?e[2]:"",typeof e[3]!=="undefined"?e["comparator"]:s.defaultValueComparator,r)}e=JSON.stringify(r,null,4);return await j(g,"",e)}async function L(e,n,r="",t=false){let a=await P(g,"");let i=s.convertToObject(a);return s.read(e,n,r,t,i)}async function x(...n){let e=await P(g,"");let r=s.convertToObject(e);let t=[];for(let e of n){const a=s.read(e[0],e[1],typeof e[2]!=="undefined"?e[2]:"",typeof e[3]==="boolean"?e[3]:false,r);t.push(a)}return t}async function D(e,n=""){let r=await P(g,"");let t=s.convertToObject(r);const a=s.del(e,n,t);r=JSON.stringify(t,null,4);const i=await j(g,"",r);return a&&i}async function W(...n){let e=await P(g,"");let r=s.convertToObject(e);for(let e of n){s.del(e[0],typeof e[1]!=="undefined"?e[1]:"",r)}e=JSON.stringify(r,null,4);return await j(g,"",e)}async function z(e){let n=await P(g,"");let r=s.convertToObject(n);return s.allSessionNames(e,r)}async function A(e){let n=await P(g,"");let r=s.convertToObject(n);return s.allSessions(e,r)}return{url:i||s.read("magic_qlurl"),init:t,getToken:v,setEnv:w,setEnvs:E,getEnv:S,getEnvs:O,delEnvs:N,disableEnvs:$,enableEnvs:Q,addScript:q,getScript:P,editScript:j,delScript:k,write:T,read:L,del:D,update:G,batchWrite:J,batchRead:x,batchUpdate:_,batchDel:W,allSessions:A,allSessionNames:z}}
// @formatter:on