/*
 * 叮咚农场自动任务 (签到 + 喂食)
 * 兼容 Quantumult X (小火箭) 和 Surge
 *
 * 最后更新: 2026-02-01
 *
 * 使用方法:
 * 1. 将此脚本文件放到 小火箭(Quantumult X) 或 Surge 的脚本目录中。
 * 2. 添加一个定时任务 (cron) 来每天自动运行此脚本。
 *    - 小火箭: [task_local]
 *    - Surge:   [Script]
 *    例如: `30 7 * * * dingdong_farm_checkin.js, tag=叮咚农场任务`
 *
 * 注意:
 * 脚本中的 Cookie 和其他身份验证信息可能需要定期更新。
 * 如果脚本失效，请自行抓包替换 `checkinConfig` 中的个人信息。
 */

// --- 配置区 ---
// 请在此处填入你自己的抓包信息
const checkinConfig = {
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
};
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
  if (typeof $task !== 'undefined') {
    $notify(title, subtitle, body);
  } else if (typeof $httpClient !== 'undefined') {
    $notification.post(title, subtitle, body);
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
        if (data.success) {
            const reward = data.data.rewards[0];
            return `✅ 签到成功, 获得${reward.amount}g饲料`;
        } else if (data.code === 2002 || (data.msg && data.msg.includes("已完成"))) {
             return `ℹ️ 今日已签到,无需重复`;
        } else {
            return `❌ 签到失败: ${data.msg || '未知错误'}`;
        }
    } catch (error) {
        console.log(`签到异常: ${error}`);
        return `❌ 签到异常: ${error}`;
    }
}

// 喂食
async function feed() {
    const url = `${apiHost}/api/v2/props/feed?api_version=9.1.0&app_client_id=1&station_id=${checkinConfig.stationId}&uid=${checkinConfig.uid}&device_id=${checkinConfig.deviceId}&latitude=${checkinConfig.lat}&longitude=${checkinConfig.lng}&device_token=${checkinConfig.deviceToken}&gameId=1&propsId=${checkinConfig.propsId}&seedId=${checkinConfig.seedId}&triggerMultiFeed=0`;

    try {
        const data = await sendRequest({ url, headers: commonHeaders });
        if (data.success) {
            return `✅ ${data.data.msg}`;
        } else {
            return `❌ 喂食失败: ${data.msg || '未知错误'}`;
        }
    } catch (error) {
        console.log(`喂食异常: ${error}`);
        return `❌ 喂食异常: ${error}`;
    }
}

// --- 主执行函数 ---
(async () => {
    console.log("开始执行叮咚农场任务...");
    const results = [];

    const signResult = await dailySign();
    results.push(signResult);
    console.log(signResult);

    const feedResult = await feed();
    results.push(feedResult);
    console.log(feedResult);
    
    const summary = results.join('\n');
    console.log("任务执行完毕。");
    
    notify('叮咚农场任务报告', ' ', summary);
    done();
})();
