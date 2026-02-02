/*
 * 叮咚农场自动任务 (签到 + 喂食)
 * 兼容 Quantumult X (小火箭) 和 Surge
 *
 * 最后更新: 2026-02-01
 *
 * 使用方法:
 * 1. 将此脚本文件放到 小火箭(Quantumult X) 或 Surge 的脚本目录中。
 * 2. 在小火箭[task_local] 中配置多个任务, 使用 argument 参数区分不同账号。
 *    例如:
 *    30 7,10,16 * * * dingdong_farm_checkin.js, argument=account1, tag=叮咚农场-账号1
 *    35 7,10,16 * * * dingdong_farm_checkin.js, argument=account2, tag=叮咚农场-账号2
 *
 * 注意:
 * 脚本中的 Cookie 和其他身份验证信息可能需要定期更新。
 * 如果脚本失效, 请自行抓包替换 allConfigs 中的个人信息。
 */

// --- 配置区 ---
// 在这里添加您所有的账号信息
const allConfigs = {
    'account1': {
        name: "默认账号",
        cookie: 'DDXQSESSID=d16d33v05vh55h563vgvd8dg03ugyygvwhhmk469du71y7e0zwvd4px1jv6ht548',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 xzone/12.16.0 station_id/611cd49cb5871d00015f5956 device_id/d53e701967a6e12aeb3905856bbb10913ec2442c relaunchId/5CC59B02-23E0-4173-801A-5EF1BFB58C6E',
        deviceToken: 'BMjsMHb5cUncPBW1zO0jKTOEQeA7Lc7pseTHdZFdFek6bKnzYx6mpWtvTueU+UWKquJo5ssIkJlldFf0oFbU4yw==',
        stationId: '611cd49cb5871d00015f5956',
        uid: '5c70ab5955af540f2c79ab4f',
        deviceId: 'd53e701967a6e12aeb3905856bbb10913ec2442c',
        lat: '30.272027',
        lng: '119.941419',
        propsId: '211006153587589079',
        seedId: '211006153587660079',
        agbp: 'application/json, text/plain, */*',
        cityNumber: '0901'
    },
    'account2': {
        name: "Lau的账号",
        cookie: 'DDXQSESSID=g1906v4uv4ddu5934v0949dv096v968gql8xz06gg9duvge88ysz43o2qk6hzy07',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 xzone/12.16.0 station_id/611cd49cb5871d00015f5956 device_id/8e0c9e96aaec7e80497b235048b93a7f236eca9b relaunchId/BC1881F9-0782-43D4-8840-DBC8BB623017',
        deviceToken: 'BLSfmhYcct0xbW9IGy3mrIe0k8zd+j04cj+AZYoKVJcOUF/4JtNl9+3iQvooQk+4/0f3ZK7pf/1EjQgURW3iCaQ==',
        stationId: '611cd49cb5871d00015f5956',
        uid: '5c8477e1dc92d018368ec747',
        deviceId: '8e0c9e96aaec7e80497b235048b93a7f236eca9b',
        lat: '30.272027',
        lng: '119.941419',
        propsId: '260201188207600071',
        seedId: '260201188212355071',
        agbp: 'application/json, text/plain, */*',
        cityNumber: '0901'
    }
};

// --- 账号选择逻辑 ---
let checkinConfig;
const defaultAccountKey = 'account1'; // 设置一个默认账号的key

if (typeof $argument !== 'undefined' && allConfigs[$argument]) {
    // 如果传入了参数 (例如 'account1', 'account2')，并且在 allConfigs 中能找到对应的账号
    checkinConfig = allConfigs[$argument];
    console.log(`参数匹配成功，本次运行账号: 【${checkinConfig.name || $argument}】`);
} else {
    // 如果没有传入参数或参数无效，则使用默认账号
    checkinConfig = allConfigs[defaultAccountKey];
    console.log(`未提供有效账号参数，使用默认账号: 【${checkinConfig.name || defaultAccountKey}】`);
}
// --- 配置区结束 ---

const apiHost = 'https://farm.api.ddxq.mobi';

const commonHeaders = {
    'Host': 'farm.api.ddxq.mobi',
    'Cookie': checkinConfig.cookie,
    'User-Agent': checkinConfig.userAgent,
    'ddmc-device-token': checkinConfig.deviceToken,
    'ddmc-station-id': checkinConfig.stationId,
    'ddmc-uid': checkinConfig.uid,
    'ddmc-device-id': checkinConfig.deviceId,
    'ddmc-latitude': checkinConfig.lat,
    'ddmc-longitude': checkinConfig.lng,
    'ddmc-city-number': checkinConfig.cityNumber,
    'ddmc-api-version': '9.1.0',
    'ddmc-app-client-id': '1',
    'Origin': 'https://game.m.ddxq.mobi',
    'Referer': 'https://game.m.ddxq.mobi/',
};

// --- 核心函数, 请勿修改 ---

// 统一API的通知函数
const notify = (title, subtitle, body) => {
  const accountName = checkinConfig.name || '';
  const finalTitle = `[${accountName}] ${title}`;
  if (typeof $task !== 'undefined') {
    $notify(finalTitle, subtitle, body);
  } else if (typeof $httpClient !== 'undefined') {
    $notification.post(finalTitle, subtitle, body);
  }
};

// 统一API的请求函数
function sendRequest(options) {
    return new Promise((resolve, reject) => {
        if (typeof $task !== 'undefined') {
            // Quantumult X 环境
            $task.fetch(options).then(response => {
                if (response.statusCode >= 200 && response.statusCode < 300) {
                    resolve(JSON.parse(response.body));
                } else {
                    reject(`HTTP Error: ${response.statusCode}`);
                }
            }).catch(reason => {
                reject(`Request Failed: ${reason.error}`);
            });
        } else if (typeof $httpClient !== 'undefined') {
            // Surge 环境
            const requestOptions = {
                url: options.url,
                headers: options.headers,
                body: options.body
            };
            $httpClient.get(requestOptions, (error, response, data) => {
                if (error) {
                    reject(`Request Failed: ${error}`);
                    return;
                }
                if (response.status >= 200 && response.status < 300) {
                    resolve(JSON.parse(data));
                } else {
                    reject(`HTTP Error: ${response.status}`);
                }
            });
        } else {
            reject("Unsupported environment: $task and $httpClient are not defined.");
        }
    });
}

// 统一API的脚本结束函数
const done = () => {
    if (typeof $done !== 'undefined') {
        $done();
    }
};

// --- 业务逻辑函数 ---

// 每日签到
async function dailySign() {
    const url = `${apiHost}/api/v2/task/achieve?api_version=9.1.0&app_client_id=1&station_id=${checkinConfig.stationId}&uid=${checkinConfig.uid}&device_id=${checkinConfig.deviceId}&latitude=${checkinConfig.lat}&longitude=${checkinConfig.lng}&device_token=${checkinConfig.deviceToken}&gameId=1&taskCode=DAILY_SIGN`;
    try {
        const data = await sendRequest({ url, headers: commonHeaders });
        console.log('每日签到响应: ' + JSON.stringify(data));
        if (data.success && data.data.rewards && data.data.rewards.length > 0) {
            const reward = data.data.rewards[0];
            return `✅ 每日签到成功, 获得${reward.amount}g饲料`;
        } else if (data.code === 2002 || (data.msg && data.msg.includes("已完成"))) {
             return `ℹ️ 每日签到: 今日已签,无需重复`;
        } else {
            return `❌ 每日签到失败: ${data.msg || '未知错误'}`;
        }
    } catch (error) {
        console.log(`每日签到异常: ${error}`);
        return `❌ 每日签到异常: ${error}`;
    }
}

// 连续签到
async function continuousSign() {
    const url = `${apiHost}/api/v2/task/achieve?api_version=9.1.0&app_client_id=1&station_id=${checkinConfig.stationId}&uid=${checkinConfig.uid}&device_id=${checkinConfig.deviceId}&latitude=${checkinConfig.lat}&longitude=${checkinConfig.lng}&device_token=${checkinConfig.deviceToken}&gameId=1&taskCode=CONTINUOUS_SIGN`;
    try {
        const data = await sendRequest({ url, headers: commonHeaders });
        console.log('连续签到响应: ' + JSON.stringify(data));
        if (data.success && data.data.rewards && data.data.rewards.length > 0) {
            const reward = data.data.rewards[0];
            return `✅ 连续签到成功, 获得${reward.amount}g饲料`;
        } else if (data.code === 2002 || (data.msg && data.msg.includes("已完成"))) {
             return `ℹ️ 连续签到: 今日已签,无需重复`;
        } else {
            return `❌ 连续签到失败: ${data.msg || '未知错误'}`;
        }
    } catch (error) {
        console.log(`连续签到异常: ${error}`);
        return `❌ 连续签到异常: ${error}`;
    }
}

// 领取答题奖励 (使用固定ID)
async function claimQuizReward() {
    // 注意: 这里的 missionId, missionInstanceId, examSerialNo 是固定的
    // 如果答题任务是动态的, 此功能可能会在第二天失效
    const missionId = "7385";
    const missionInstanceId = "558400";
    const examSerialNo = "5000006200094";

    const url = `${apiHost}/api/v2/task/reward?api_version=9.1.0&app_client_id=1&station_id=${checkinConfig.stationId}&uid=${checkinConfig.uid}&device_id=${checkinConfig.deviceId}&latitude=${checkinConfig.lat}&longitude=${checkinConfig.lng}&device_token=${checkinConfig.deviceToken}&gameId=1&missionId=${missionId}&missionInstanceId=${missionInstanceId}&examSerialNo=${examSerialNo}&taskCode=QUIZ1`;

    try {
        const data = await sendRequest({ url, headers: commonHeaders });
        console.log('答题奖励响应: ' + JSON.stringify(data));
        if (data.success && data.data.rewards && data.data.rewards.length > 0) {
            const reward = data.data.rewards[0];
            return `✅ 答题奖励领取成功, 获得${reward.amount}g饲料`;
        } else if (data.msg && (data.msg.includes("已领取") || data.msg.includes("已完成"))) {
            return `ℹ️ 答题奖励: ${data.msg}`;
        } else {
            return `❌ 答题奖励领取失败: ${data.msg || '未知错误'}`;
        }
    } catch (error) {
        console.log(`答题奖励领取异常: ${error}`);
        return `❌ 答题奖励领取异常: ${error}`;
    }
}

// 领取三餐福袋奖励
async function claimLotteryReward() {
    const url = `${apiHost}/api/v2/task/achieve?api_version=9.1.0&app_client_id=1&station_id=${checkinConfig.stationId}&uid=${checkinConfig.uid}&device_id=${checkinConfig.deviceId}&latitude=${checkinConfig.lat}&longitude=${checkinConfig.lng}&device_token=${checkinConfig.deviceToken}&gameId=1&taskCode=LOTTERY`;
    try {
        const data = await sendRequest({ url, headers: commonHeaders });
        console.log('三餐福袋奖励响应: ' + JSON.stringify(data));
        if (data.success && data.data.rewards && data.data.rewards.length > 0) {
            const reward = data.data.rewards[0];
            return `✅ 三餐福袋领取成功, 获得${reward.amount}g饲料`;
        } else if (data.code === 2002 || (data.msg && data.msg.includes("不在活动时间")) || (data.msg && data.msg.includes("已完成"))) {
             return `ℹ️ 三餐福袋: ${data.msg || '今日已完成/不在活动时间'}`;
        } else {
            return `❌ 三餐福袋领取失败: ${data.msg || '未知错误'}`;
        }
    } catch (error) {
        console.log(`三餐福袋领取异常: ${error}`);
        return `❌ 三餐福袋领取异常: ${error}`;
    }
}

// 获取任务列表
async function fetchTaskList() {
    const url = `${apiHost}/api/v2/task/list?api_version=9.1.0&app_client_id=1&station_id=${checkinConfig.stationId}&uid=${checkinConfig.uid}&device_id=${checkinConfig.deviceId}&latitude=${checkinConfig.lat}&longitude=${checkinConfig.lng}&device_token=${checkinConfig.deviceToken}&gameId=1`;
    try {
        const data = await sendRequest({ url, headers: commonHeaders });
        if (data.success && data.data && data.data.userTasks) {
            return data.data.userTasks;
        }
         else {
            console.log(`获取任务列表失败: ${data.msg || '未知错误'}`);
            return [];
        }
    } catch (error) {
        console.log(`获取任务列表异常: ${error}`);
        return [];
    }
}

// 领取任意下单任务奖励
async function claimAnyOrderReward() {
    const taskList = await fetchTaskList();
    const anyOrderTask = taskList.find(task => task.taskCode === "ANY_ORDER");

    if (anyOrderTask && anyOrderTask.userTaskLogId) {
        const url = `${apiHost}/api/v2/task/reward?api_version=9.1.0&app_client_id=1&station_id=${checkinConfig.stationId}&uid=${checkinConfig.uid}&device_id=${checkinConfig.deviceId}&latitude=${checkinConfig.lat}&longitude=${checkinConfig.lng}&device_token=${checkinConfig.deviceToken}&gameId=1&userTaskLogId=${anyOrderTask.userTaskLogId}`;
        try {
            const data = await sendRequest({ url, headers: commonHeaders });
            console.log('任意下单奖励响应: ' + JSON.stringify(data));
            if (data.success && data.data.rewards && data.data.rewards.length > 0) {
                const reward = data.data.rewards[0];
                return `✅ 任意下单奖励领取成功, 获得${reward.amount}g饲料`;
            } else if ((data.data && data.data.taskStatus === "REWARDED") || (data.msg && data.msg.includes("已领取"))) {
                return `ℹ️ 任意下单奖励: ${data.msg || '今日已领取'}`;
            } else {
                return `ℹ️ 任意下单奖励: ${data.msg || '无法领取'}`;
            }
        } catch (error) {
            console.log(`任意下单奖励领取异常: ${error}`);
            return `❌ 任意下单奖励领取异常: ${error}`;
        }
    } else {
        return `ℹ️ 任意下单任务: 未在任务列表中找到或缺少userTaskLogId`;
    }
}

// 喂食 (循环多次)
async function feed() {
    let successCount = 0;
    const maxFeeds = 20; // 为防止意外,设置一个最大喂食次数
    let finalMsg = "未开始喂食或饲料不足"; // 默认消息

    for (let i = 0; i < maxFeeds; i++) {
        console.log(`尝试进行第 ${i + 1} 次喂食...`);
        const url = `${apiHost}/api/v2/props/feed?api_version=9.1.0&app_client_id=1&station_id=${checkinConfig.stationId}&uid=${checkinConfig.uid}&device_id=${checkinConfig.deviceId}&latitude=${checkinConfig.lat}&longitude=${checkinConfig.lng}&device_token=${checkinConfig.deviceToken}&gameId=1&propsId=${checkinConfig.propsId}&seedId=${checkinConfig.seedId}&triggerMultiFeed=0`;

        try {
            const data = await sendRequest({ url, headers: commonHeaders });
            console.log(`第 ${i + 1} 次喂食响应: ${JSON.stringify(data)}`);

            if (data.success) {
                successCount++;
                finalMsg = data.data.msg; // 保存最后一次成功的消息
            } else {
                // 只要服务器返回任何错误, 就停止
                console.log(`喂食因服务器返回错误而停止: ${data.msg}`);
                finalMsg = data.msg; // 将错误信息作为最终消息
                break; // 跳出循环
            }
        } catch (error) {
            console.log(`喂食过程中发生网络或解析异常: ${error}`);
            finalMsg = `❌ 喂食异常: ${error}`;
            break; // 发生异常, 跳出循环
        }

        // 喂食成功后, 延迟2秒, 避免请求过于频繁
        if (i < maxFeeds - 1) { // 最后一次成功后不延迟
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    if (successCount > 0) {
        return `✅ 成功喂食 ${successCount} 次。最后提示: ${finalMsg}`;
    } else {
        // 如果一次都未成功, 返回导致循环停止或未开始的消息
        return `ℹ️ 未执行喂食或失败: ${finalMsg}`;
    }
}


// --- 主执行函数 ---
(async () => {
    try {
        console.log("开始执行叮咚农场任务...");
        const results = [];

        results.push(await dailySign()); // 每日签到
        results.push(await continuousSign()); // 连续签到
        results.push(await claimQuizReward()); // 问卷
        results.push(await claimLotteryReward()); // 三餐福袋
        results.push(await claimAnyOrderReward()); // 任意下单
        results.push(await feed()); // 喂鱼

        const summary = results.filter(res => res).join('\n');
        
        console.log("任务执行完毕。");

        notify('叮咚农场任务报告', '', summary);
    } catch (e) {
        console.log(`脚本执行出现异常: ${e}`);
        notify('叮咚农场脚本错误', '', `详情: ${e}`);
    } finally {
        done();
    }
})();