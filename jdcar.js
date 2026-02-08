/*
 * 京东汽车 - 签到脚本
 *
 * ========== 配置说明 ==========
 *
 * 1. 自动抓取Cookie (推荐):
 *    - 在 Shadowrocket/Surge 中配置一个 MITM (中间人) 规则。
 *    - 添加主机名: api.m.jd.com
 *    - 当你通过App访问京东时, 脚本会自动抓取并保存你的Cookie。
 *    - 成功抓取后, 你会收到一条通知, 之后应【禁用】此脚本的MITM功能, 只保留其定时任务功能, 以免重复抓取。
 *
 * 2. 手动填写Cookie:
 *    - 如果不想使用自动抓取, 可以直接在下面的 `manualCookies` 数组中填入你的京东Cookie。
 *    - Cookie通常是以 "pt_pin=xxxx; pt_key=yyyy;" 的格式。
 *
 * 脚本会优先使用自动抓取的Cookie, 如果没有, 则会使用手动填写的Cookie。
 *
 */

// --- 配置区 ---
// 支持多账号, 在此处手动填写京东Cookie, 每个Cookie占一行。
const manualCookies = [
  "pt_key=app_openAAJpiKaAADBovCmy0dERDCeDrJEsGWZ0_114V9CABTBJuFD8Whg-jQ0kQqo74NI47Bb3WLIBnIg; pt_pin=jd_5f54b2f173200; pwdt_id=jd_5f54b2f173200; mba_muid=1722848472062556347923.606.1770564721112; unpl=ADC_c6Iimzq7p3ZG2CEZLg0OhI9YdF72zJUZIMQ3FvxyrmQ%2BKD%2Fe5c5YnfJyvSN2DBEHFLL1p5Fyr4fXB2kxHU7pQFXQXySEsgkab72zrd9VNFGGXBmar4BzwJyj59uEriohadEuzGrgZr92ODw5dmCL0ET5syoEou0yqb2Ca9CcnNc%3D%7CJF8EAMhnNSttUBhdABoKSRFETV9WWwgLSERXaGNQAQkKSQQFGAZJF0V7XlVdWRRLFx9uYBRUWlNJVQ4fBysiE0pfVlpeCE4WAV9kAVNfUUlcBysEdRcRT11dW18AJRQCbgl4DBoMCRUZGwF1En5IWVNcVApDFW1fZAVkXGhLUgYYCx4bFU1eVVleDE8QAWphDVdfaEpkDBoyGxMQS11WX18MTxQHa2A1ZFxoSmQEK0l1E11LW1ddVA1CEgVsZgJXWVxMVgAdChgQIEptVA; 3AB9D23F7A4B3C9B=VZHDO6JVN325VN36FVCSWXVA7HISUGND6AEOX645D7B2BJUYDKMXJV7W3UAZHY7NFW4UOOTM4E4CI4K6LOPLT4456U; 3AB9D23F7A4B3CSS=jdd03VZHDO6JVN325VN36FVCSWXVA7HISUGND6AEOX645D7B2BJUYDKMXJV7W3UAZHY7NFW4UOOTM4E4CI4K6LOPLT4456UAAAAM4HXP3PQQAAAAADACTO5ZDEVFNJ4X; shshshfpb=BApXWhSDXPvlA9dcyII9uxYEJqol-jBQpBxdjNE1X9xJ1ItZfQtPQx07p3i2rZNUhI-WOkv6BsqFbI74zv6gH5t56YVjm-TAMo2FA; shshshfpa=88037922-d2c8-8071-33c0-c3fec54aa5f3-1655223362; unionwsws=%7B%22devicefinger%22%3A%22eidIcb548121a9sd8fdFQB2ET8q9AYA8zIvxh%2FH3RshISDtGBskjYs8qjCG48jNMhChFymM4nh4IwM7dcwjMiGTdSfBTGPR7k8qYEnqo2k0Saq46610z%22%7D; __jda=122270672.1722848472062556347923.1722848472.1770105857.1770563204.156; __jdv=122270672%7Cdirect%7C-%7Cnone%7C-%7C1765079047429; qid_evord=66; uapTheme=3; qid_ls=1759128517081; qid_ts=1770564389339; qid_vis=9; b_dh=844; joyya=1769950170.0.39.11g9egu; shshshfpv=JD0211d47dILoNJgFpxK176995007007207sebbX7saR0tC5wx7SzKmcV3jv-QnyMXH-9SNTZ--KGthSm32K-lItWIf_gZlcenFV1lQWzvQZCAp0IrqHeNoNR0FhPQMJU-iGlpMxjMmCrTHLKJgwac-s7xibcYLT7H30i8g4z6~BApXWi1E2GvlDfnkezvBfAvWnbl4daJQqOMs89MlX9xJ1ItZfQtPQx07p3i2rZNUhI-WOkv6BsqNUdosL7PsK7N9_NQvg-2HBRrbNIE9A; qid_fs=1756010023248; qid_uid=7dac11fb-a22c-4e24-881c-e11f28c9c25b; shshshfpx=88037922-d2c8-8071-33c0-c3fec54aa5f3-1655223362; b_avif=1; b_dpr=3; b_dw=390; b_webp=1; abtest=20250313135407452_68; webp=1; cartLastOpTime=; cartNum=3",
  // "pt_pin=xxxx; pt_key=yyyy;",
  // "pt_pin=zzzz; pt_key=wwww;",
];

const SCRIPT_NAME = "京东汽车";
const COOKIE_KEY = "jd_cookie_car"; // 用于在持久化存储中读写Cookie的键名
const JD_API_HOST = 'https://car-member.jd.com/api/';
// --- 配置区结束 ---

// --- MITM 自动抓取Cookie ---
// 仅在$request环境中(即MITM模式下)执行
if (typeof $request !== 'undefined' && $request) {
  const isJdApp = $request.headers['User-Agent'] && $request.headers['User-Agent'].includes('jdapp');
  if (isJdApp && $request.url.includes('api.m.jd.com/client.action')) {
    const cookie = $request.headers['Cookie'];
    if (cookie && cookie.includes('pt_key')) {
      const existingCookie = $persistentStore.read(COOKIE_KEY);
      if (existingCookie !== cookie) {
        $persistentStore.write(cookie, COOKIE_KEY);
        $notification.post('京东Cookie已更新', SCRIPT_NAME, '请禁用此脚本的MITM功能, 仅保留定时任务。');
      }
    }
  }
  $done({});
}
// --- 脚本主体 ---
else {
  // 定义一个轻量级的辅助对象, 仅包含Surge/Shadowrocket所需的功能
  const $ = {
    read: (key) => $persistentStore.read(key),
    write: (val, key) => $persistentStore.write(val, key),
    notify: (title, subtitle = '', body = '') => $notification.post(title, subtitle, body),
    done: (value = {}) => $done(value)
  };

  /**
   * 封装$httpClient为Promise, 以便使用async/await
   * @param {object} options - $httpClient的请求选项
   * @returns {Promise<{response: object, data: any}>}
   */
  function sendRequest(options) {
    return new Promise((resolve, reject) => {
      const method = options.method?.toUpperCase() === 'POST' ? 'post' : 'get';
      $httpClient[method](options, (error, response, data) => {
        if (error) {
          return reject(error);
        }
        try {
          // 尝试解析JSON, 如果失败则返回原始数据
          data = JSON.parse(data);
        } catch {}
        resolve({ response, data });
      });
    });
  }

  // --- 核心业务逻辑 ---

  async function check(cookie) {
    const options = taskUrl('v1/user/exchange/bean/check', cookie);
    const { data } = await sendRequest(options);
    if (data && data.error && data.error.msg) {
      return `检查京豆兑换状态失败: ${data.error.msg}`;
    }
    return '京豆兑换状态正常。';
  }

  async function sign(cookie) {
    const options = taskUrl('v1/user/sign', cookie, 'POST');
    const { data } = await sendRequest(options);
    if (data && data.status) {
      return `签到成功, 获得${data.data.point}赛点, 已连签${data.data.signDays}天。`;
    } else if (data && data.error && data.error.msg) {
      return `签到失败: ${data.error.msg}`;
    }
    return '签到失败: 未知错误。';
  }

  async function mission(cookie) {
    const options = taskUrl('v1/user/mission', cookie);
    const { data } = await sendRequest(options);
    let missionSummary = [];

    if (data && data.status && data.data.missionList) {
      for (const mission of data.data.missionList) {
        if (mission['missionStatus'] === 0 && (mission['missionType'] === 1 || mission['missionType'] === 5)) {
          await sendRequest(taskPostUrl('v1/game/mission', { "missionId": mission.missionId }, cookie));
          await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒
          const receiveResult = await sendRequest(taskPostUrl('v1/user/mission/receive', { "missionId": mission.missionId }, cookie));
          if (receiveResult.data && receiveResult.data.status) {
            missionSummary.push(`完成任务: ${mission.missionName}`);
          }
        }
      }
    }
    return missionSummary.length > 0 ? missionSummary.join('\n') : '没有可自动完成的任务。';
  }

  async function getPoint(cookie) {
    const options = taskUrl('v1/user/point', cookie);
    const { data } = await sendRequest(options);
    if (data && data.status) {
      const { remainPoint, oncePoint } = data.data;
      const msg = `当前赛点: ${remainPoint}/${oncePoint}。`;
      if (remainPoint >= oncePoint) {
        return msg + '赛点已足够, 请前往App兑换京豆！';
      }
      return msg + '赛点不足, 无法兑换。';
    }
    return '查询赛点失败。';
  }

  async function getUserInfo(cookie) {
    const options = {
      url: `https://wq.jd.com/user/info/QueryJDUserInfo?sceneval=2`,
      headers: {
        "Accept": "application/json,text/plain, */*",
        "Content-Type": "application/x-www-form-urlencoded",
        "Referer": "https://wqs.jd.com/my/jingdou/my.shtml?sceneval=2",
        "Cookie": cookie,
        "User-Agent": "jdapp;iPhone;9.2.2;14.2;%E4%BA%AC%E4%B8%9C/9.2.2 CFNetwork/1206 Darwin/20.1.0"
      },
      method: 'POST'
    };
    const { data } = await sendRequest(options);
    
    // --- Debugging Log ---
    console.log(`JD UserInfo API Response: ${JSON.stringify(data, null, 2)}`);
    // --- End Debugging Log ---
    
    if (data && data.retcode === 0 && data.base) {
      return { nickname: data.base.nickname, isLogin: true };
    }
    return { nickname: '', isLogin: false };
  }

  // --- 辅助函数 ---

  function taskUrl(function_id, cookie, method = 'GET') {
    return {
      url: `${JD_API_HOST}${function_id}?timestamp=${new Date().getTime() + new Date().getTimezoneOffset() * 60 * 1000 + 8 * 60 * 60 * 1000}`,
      method: method,
      headers: {
        "Accept": "*/*",
        "Connection": "keep-alive",
        "Content-Type": "application/x-www-form-urlencoded",
        "Host": "car-member.jd.com",
        "Referer": "https://h5.m.jd.com/babelDiy/Zeus/44bjzCpzH9GpspWeBzYSqBA7jEtP/index.html",
        "Cookie": cookie,
        "User-Agent": "jdapp;iPhone;9.2.2;14.2;%E4%BA%AC%E4%B8%9C/9.2.2 CFNetwork/1206 Darwin/20.1.0",
      }
    };
  }

  function taskPostUrl(function_id, body, cookie) {
    return {
      url: `${JD_API_HOST}${function_id}?timestamp=${new Date().getTime() + new Date().getTimezoneOffset() * 60 * 1000 + 8 * 60 * 60 * 1000}`,
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        "Accept": "*/*",
        "Content-Type": "application/json;charset=UTF-8",
        "Host": "car-member.jd.com",
        "Referer": "https://h5.m.jd.com/babelDiy/Zeus/44bjzCpzH9GpspWeBzYSqBA7jEtP/index.html",
        "Cookie": cookie,
        "User-Agent": "jdapp;iPhone;9.2.2;14.2;%E4%BA%AC%E4%B8%9C/9.2.2 CFNetwork/1206 Darwin/20.1.0",
      }
    };
  }
  
  // --- 主执行函数 ---
  (async () => {
    // 1. 获取所有有效的Cookie
    let storedCookies = ($.read(COOKIE_KEY) || "").split('\n').filter(Boolean);
    const allCookiesRaw = [...storedCookies, ...manualCookies];
    const allCookies = [...new Set(allCookiesRaw.map(c => c.trim()).filter(c => c.includes('pt_key')))];

    if (allCookies.length === 0) {
      $.notify(SCRIPT_NAME, '没有找到任何有效的京东Cookie', '请先配置Cookie。');
      return;
    }

    // 2. 遍历所有Cookie执行任务
    let overallMessage = '';
    for (let i = 0; i < allCookies.length; i++) {
      const cookie = allCookies[i];
      let accountMessage = `\n--- 账号 ${i + 1} ---\n`;

      const { nickname, isLogin } = await getUserInfo(cookie);
      if (!isLogin) {
        accountMessage += 'Cookie已失效, 请重新抓取。';
        overallMessage += accountMessage;
        continue;
      }
      
      accountMessage += `账号名: ${nickname}\n`;

      try {
        const signResult = await sign(cookie);
        accountMessage += `${signResult}\n`;

        await new Promise(resolve => setTimeout(resolve, 1500)); // 延迟

        const missionResult = await mission(cookie);
        accountMessage += `${missionResult}\n`;

        await new Promise(resolve => setTimeout(resolve, 1500)); // 延迟

        const pointResult = await getPoint(cookie);
        accountMessage += `${pointResult}\n`;

      } catch (e) {
        accountMessage += `执行失败: ${e.message || e}\n`;
      }
      overallMessage += accountMessage;
    }

    // 3. 发送最终通知
    $.notify(SCRIPT_NAME, '所有账号执行完毕', overallMessage.trim());

  })().catch((e) => {
    console.log(e);
    $.notify(SCRIPT_NAME, '脚本发生严重错误', e.message || e);
  }).finally(() => {
    $.done();
  });
}