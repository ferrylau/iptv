/*
 * ddxq_id_catcher.js
 * 功能：从叮咚买菜响应体中抓取 propsId 和 seedId
 * 运行环境: Shadowrocket, Surge, Quantumult X
 * 最后更新: 2026-02-02
 */

const scriptName = "叮咚ID抓取";
const ddxq_props_id_key = "ddxq_props_id";
const ddxq_seed_id_key = "ddxq_seed_id";

// 通用通知函数
const notify = (title, subtitle, body) => {
  const finalTitle = `[${scriptName}] ${title}`;
  if (typeof $notify !== 'undefined') {
    $notify(finalTitle, subtitle, body);
  } else if (typeof $notification !== 'undefined') {
    $notification.post(finalTitle, subtitle, body);
  } else {
    console.log(`${finalTitle}\n${subtitle}\n${body}`);
  }
};

(function main() {
  console.log(`[${scriptName}] 脚本开始运行...`);

  // 1. 检查是否有响应体
  if (typeof $response === 'undefined' || !$response.body) {
    console.log(`[${scriptName}] 未获取到响应体，跳过执行。`);
    $done({});
    return;
  }

  // 2. 兼容性获取状态码 (Shadowrocket/Surge 使用 .status, QX 使用 .statusCode)
  const status = $response.status || $response.statusCode;
  console.log(`[${scriptName}] 当前响应状态码: ${status}`);

  if (status !== 200) {
    // 只有在明确拿到非200状态码时才报错
    if (status) {
      notify("抓取失败", "❌", `服务器状态码异常: ${status}`);
      $done({});
      return;
    }
    console.log(`[${scriptName}] 无法确定状态码，尝试继续解析 body...`);
  }

  try {
    const body = JSON.parse($response.body);
    
    // 3. 校验叮咚响应格式
    if (body.code === 0 && body.data) {
      // 使用可选链 (?.) 防止字段不存在时崩掉
      const propsId = body.data.feed?.propsId;
      const seedId = body.data.baseSeed?.seedId;

      if (propsId && seedId) {
        // 4. 写入持久化存储 (强制转为字符串防止报错)
        $persistentStore.write(propsId.toString(), ddxq_props_id_key);
        $persistentStore.write(seedId.toString(), ddxq_seed_id_key);
        
        console.log(`[${scriptName}] ✅ 成功抓取！\npropsId: ${propsId}\nseedId: ${seedId}`);
        notify("抓取成功", "✅", `喂食 ID 已更新`);
      } else {
        console.log(`[${scriptName}] ⚠️ 响应码正确但未找到 propsId 或 seedId`);
      }
    } else {
      console.log(`[${scriptName}] ❌ 响应 code 不为 0 或 data 为空`);
    }
  } catch (e) {
    console.log(`[${scriptName}] ❌ 解析 JSON 失败: ${e.message}`);
    // 如果是图片或其他非JSON格式请求误入，这里会捕获错误
  } finally {
    // 5. 必须调用 $done 结束脚本
    $done({});
  }
})();
