/*
 * 叮咚农场自动任务 (签到 + 喂食)
 * 兼容 Quantumult X (小火箭) 和 Surge
 *
 * 最后更新: 2026-02-02
 *
 * 此版本已修改为自动读取由 ddxq_header_catcher.js 捕获的信息。
 * 当脚本提示Cookie失效时, 请打开叮咚买菜App, 进入农场页面一次,
 * 脚本所需信息便会自动更新。
 */

// --- 配置区 ---
// Key for reading stored data
const ddxq_headers_key = "ddxq_headers";
const ddxq_url_key = "ddxq_url";

// 备用配置, 仅在从未成功抓取过信息时使用。
// 您可以把您一个账号的信息填在这里作为备份。
const fallbackConfig = {
    name: "备用账号",
    cookie: 'DDXQSESSID=d16d33v05vh55h563vgvd8dg03ugyygvwhhmk469du71y7e0zwvd4px1jv6ht548',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 xzone/12.16.0 station_id/611cd49cb5871d00015f5956 device_id/d53e701967a6e12aeb3905856bbb10913ec2442c',
    // 喂食所需的 propsId 和 seedId 通常比较固定, 建议从旧脚本复制过来填好
    propsId: '211006153587589079',
    seedId: '211006153587660079'
};

// --- 核心加载逻辑 ---
let checkinConfig = {};
let accountName = "叮咚账号";

// 从URL中提取参数的辅助函数
function getURLParam(url, name) {
    if (!url) return null;
    const reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)");
    const match = url.substr(url.indexOf("?") + 1).match(reg);
    if (match) return decodeURIComponent(match[2]);
    return null;
}

// 加载配置的主函数
function loadConfig() {
    const storedHeadersStr = typeof $prefs !== 'undefined' ? $prefs.valueForKey(ddxq_headers_key) : null;
    const storedUrl = typeof $prefs !== 'undefined' ? $prefs.valueForKey(ddxq_url_key) : null;

    if (storedHeadersStr && storedUrl) {
        console.log("检测到已保存的会话信息, 将优先使用。");
        const storedHeaders = JSON.parse(storedHeadersStr);

        // 编写一个辅助函数, 用于不区分大小写地获取请求头
        const getHeader = (key) => {
            const headerKey = Object.keys(storedHeaders).find(h => h.toLowerCase() === key.toLowerCase());
            return headerKey ? storedHeaders[headerKey] : null;
        };

        // 从URL和请求头中组装配置
        checkinConfig = {
            name: accountName,
            cookie: getHeader('cookie'),
            userAgent: getHeader('user-agent'),
            deviceToken: getHeader('ddmc-device-token') || getURLParam(storedUrl, 'device_token'),
            stationId: getHeader('ddmc-station-id') || getURLParam(storedUrl, 'station_id'),
            uid: getHeader('ddmc-uid') || getURLParam(storedUrl, 'uid'),
            deviceId: getHeader('ddmc-device-id') || getURLParam(storedUrl, 'DeviceId'),
            lat: getHeader('ddmc-latitude') || getURLParam(storedUrl, 'lat'),
            lng: getHeader('ddmc-longitude') || getURLParam(storedUrl, 'lng'),
            cityNumber: getHeader('ddmc-city-number') || getURLParam(storedUrl, 'city_number'),
            propsId: fallbackConfig.propsId, // 喂食ID使用备用配置
            seedId: fallbackConfig.seedId,   // 种子ID使用备用配置
        };
        
        // 检查关键信息是否存在
        if (!checkinConfig.cookie) {
            console.log("已保存的信息不完整 (缺少Cookie), 转为使用备用配置。");
            checkinConfig = fallbackConfig;
            accountName = fallbackConfig.name;
        }

    } else {
        console.log("未检测到已保存的会话信息, 将使用脚本内的备用配置。");
        checkinConfig = fallbackConfig;
        accountName = fallbackConfig.name;
    }
}

// --- 后面是和原来一样的签到业务逻辑, 无需关心 ---

// 脚本开始运行时加载配置
loadConfig();

const apiHost = 'https://farm.api.ddxq.mobi';

// 根据加载的配置生成通用请求头
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

// ... (The rest of the script is the same as the original) ...
// 统一API的通知函数
const notify = (title, subtitle, body) => {
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
        const env = typeof $task !== 'undefined' ? 'Quantumult X' : (typeof $httpClient !== 'undefined' ? 'Surge' : 'unknown');

        if (env === 'Quantumult X') {
            $task.fetch(options).then(response => {
                if (response.statusCode >= 200 && response.statusCode < 300) {
                    resolve(JSON.parse(response.body));
                } else {
                    reject(`HTTP Error: ${response.statusCode}`);
                }
            }, reason => {
                reject(`Request Failed: ${reason.error}`);
            });
        } else if (env === 'Surge') {
            $httpClient.get(options, (error, response, data) => {
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
            reject("Unsupported environment.");
        }
    });
}

const done = () => {
    if (typeof $done !== 'undefined') {
        $done();
    }
};

// 业务逻辑函数...
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
            if (data.success && data.data.rewards && data.data.rewards.length > 0) {
                const reward = data.data.rewards[0];
                return `✅ 任意下单奖励领取成功, 获得${reward.amount}g饲料`;
            } else if ((data.data && data.data.taskStatus === "REWARDED") || (data.msg && data.msg.includes("已领取"))) {
                return `ℹ️ 任意下单奖励: ${data.msg || '今日已领取'}`;
            } else {
                return `ℹ️ 任意下单奖励: ${data.msg || '无法领取'}`;
            }
        } catch (error) {
            return `❌ 任意下单奖励领取异常: ${error}`;
        }
    } else {
        return `ℹ️ 任意下单任务: 未在任务列表中找到`;
    }
}


// 喂食 (循环多次)
async function feed() {
    let successCount = 0;
    const maxFeeds = 20;
    let finalMsg = "未开始喂食或饲料不足"; 

    for (let i = 0; i < maxFeeds; i++) {
        console.log(`尝试进行第 ${i + 1} 次喂食...`);
        const url = `${apiHost}/api/v2/props/feed?api_version=9.1.0&app_client_id=1&station_id=${checkinConfig.stationId}&uid=${checkinConfig.uid}&device_id=${checkinConfig.deviceId}&latitude=${checkinConfig.lat}&longitude=${checkinConfig.lng}&device_token=${checkinConfig.deviceToken}&gameId=1&propsId=${checkinConfig.propsId}&seedId=${checkinConfig.seedId}&triggerMultiFeed=0`;

        try {
            const data = await sendRequest({ url, headers: commonHeaders });
            console.log(`第 ${i + 1} 次喂食响应: ${JSON.stringify(data)}`);

            if (data.success) {
                successCount++;
                finalMsg = data.data.msg;
            } else {
                console.log(`喂食因服务器返回错误而停止: ${data.msg}`);
                finalMsg = data.msg;
                break;
            }
        } catch (error) {
            console.log(`喂食过程中发生网络或解析异常: ${error}`);
            finalMsg = `❌ 喂食异常: ${error}`;
            break;
        }

        if (i < maxFeeds - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    if (successCount > 0) {
        return `✅ 成功喂食 ${successCount} 次。最后提示: ${finalMsg}`;
    } else {
        return `ℹ️ 未执行喂食或失败: ${finalMsg}`;
    }
}


// --- 主执行函数 ---
(async () => {
    // 检查配置是否加载成功
    if (!checkinConfig.cookie) {
        const errorMsg = "配置加载失败, 缺少关键信息(Cookie)。请先按说明手动进入一次农场页面以自动抓取配置";
        console.log(errorMsg);
        notify('叮咚农场任务失败', '', errorMsg);
        done();
        return;
    }
    
    try {
        console.log("开始执行叮咚农场任务...");
        const results = [];

        results.push(await dailySign());
        results.push(await continuousSign());
        results.push(await claimQuizReward());
        results.push(await claimLotteryReward());
        results.push(await claimAnyOrderReward());
        results.push(await feed());

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
