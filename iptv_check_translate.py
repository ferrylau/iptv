import re
import requests
from deep_translator import GoogleTranslator
import time
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading
from typing import List, Dict, Tuple, Any

# --- 配置 ---
M3U_URL = "https://iptv-org.github.io/iptv/index.country.m3u"
INPUT_FILE_NAME = "index.country.m3u8" # 临时下载文件
OUTPUT_FILE_NAME = "index.country.chinese.m3u8" # 最终输出文件
SOURCE_LANG = 'en'
TARGET_LANG = 'zh-CN'
TRANSLATION_DELAY = 0.1 # 线程启动间的延迟（秒），用于翻译步骤
MAX_WORKERS = 100        # 并发线程数：用于流检查和翻译，高风险设置
TIMEOUT = 5             # 流检查时的请求超时时间（秒）

# 硬编码的国家分组对照表
COUNTRY_MAPPING = {
    "Afghanistan": "阿富汗", "Albania": "阿尔巴尼亚", "Algeria": "阿尔及利亚", "Andorra": "安道尔",
    "Angola": "安哥拉", "Argentina": "阿根廷", "Armenia": "亚美尼亚", "Aruba": "阿鲁巴",
    "Australia": "澳大利亚", "Austria": "奥地利", "Azerbaijan": "阿塞拜疆", "Bahamas": "巴哈马",
    "Bahrain": "巴林", "Bangladesh": "孟加拉国", "Barbados": "巴巴多斯", "Belarus": "白俄罗斯",
    "Belgium": "比利时", "Benin": "贝宁", "Bermuda": "百慕大", "Bhutan": "不丹",
    "Bolivia": "玻利维亚", "Bonaire": "博奈尔", "Bosnia and Herzegovina": "波斯尼亚和黑塞哥维那",
    "Botswana": "博茨瓦纳", "Brazil": "巴西", "British Virgin Islands": "英属维尔京群岛",
    "Brunei": "文莱", "Bulgaria": "保加利亚", "Burkina Faso": "布基纳法索", "Burundi": "布隆迪",
    "Cambodia": "柬埔寨", "Cameroon": "喀麦隆", "Canada": "加拿大", "Cape Verde": "佛得角",
    "Central African Republic": "中非共和国", "Chad": "乍得", "Chile": "智利", "China": "中国",
    "Colombia": "哥伦比亚", "Comoros": "科摩罗", "Costa Rica": "哥斯达黎加", "Croatia": "克罗地亚",
    "Cuba": "古巴", "Curacao": "库拉索", "Cyprus": "塞浦路斯", "Czech Republic": "捷克",
    "Democratic Republic of the Congo": "刚果（金）", "Denmark": "丹麦", "Djibouti": "吉布提",
    "Dominican Republic": "多米尼加", "Ecuador": "厄瓜多尔", "Egypt": "埃及", "El Salvador": "萨尔瓦多",
    "Equatorial Guinea": "赤道几内亚", "Eritrea": "厄立特里亚", "Estonia": "爱沙尼亚",
    "Ethiopia": "埃塞俄比亚", "Faroe Islands": "法罗群岛", "Finland": "芬兰", "France": "法国",
    "French Polynesia": "法属波利尼西亚", "Gabon": "加蓬", "Gambia": "冈比亚", "Georgia": "格鲁吉亚",
    "Germany": "德国", "Ghana": "加纳", "Greece": "希腊", "Guadeloupe": "瓜德罗普",
    "Guam": "关岛", "Guatemala": "危地马拉", "Guernsey": "根西岛", "Guinea": "几内亚",
    "Guyana": "圭亚那", "Haiti": "海地", "Honduras": "洪都拉斯", "Hong Kong": "香港",
    "Hungary": "匈牙利", "Iceland": "冰岛", "India": "印度", "Indonesia": "印度尼西亚",
    "International": "国际", "Iran": "伊朗", "Iraq": "伊拉克", "Ireland": "爱尔兰",
    "Israel": "以色列", "Italy": "意大利", "Ivory Coast": "科特迪瓦", "Jamaica": "牙买加",
    "Japan": "日本", "Jordan": "约旦", "Kazakhstan": "哈萨克斯坦", "Kenya": "肯尼亚",
    "Kosovo": "科索沃", "Kuwait": "科威特", "Kyrgyzstan": "吉尔吉斯斯坦", "Laos": "老挝",
    "Latvia": "拉脱维亚", "Lebanon": "黎巴嫩", "Liberia": "利比里亚", "Libya": "利比亚",
    "Liechtenstein": "列支敦士登", "Lithuania": "立陶宛", "Luxembourg": "卢森堡", "Macao": "澳门",
    "Madagascar": "马达加斯加", "Malawi": "马拉维", "Malaysia": "马来西亚", "Maldives": "马尔代夫",
    "Mali": "马里", "Malta": "马耳他", "Martinique": "马提尼克", "Mauritania": "毛里塔尼亚",
    "Mauritius": "毛里求斯", "Mexico": "墨西哥", "Moldova": "摩尔多瓦", "Monaco": "摩纳哥",
    "Mongolia": "蒙古", "Montenegro": "黑山", "Morocco": "摩洛哥", "Mozambique": "莫桑比克",
    "Myanmar": "缅甸", "Namibia": "纳米比亚", "Nepal": "尼泊尔", "Netherlands": "荷兰",
    "New Zealand": "新西兰", "Nicaragua": "尼加拉瓜", "Niger": "尼日尔", "Nigeria": "尼日利亚",
    "North Korea": "朝鲜", "North Macedonia": "北马其顿", "Norway": "挪威", "Oman": "阿曼",
    "Pakistan": "巴基斯坦", "Palestine": "巴勒斯坦", "Panama": "巴拿马", "Papua New Guinea": "巴布亚新几内亚",
    "Paraguay": "巴拉圭", "Peru": "秘鲁", "Philippines": "菲律宾", "Poland": "波兰",
    "Portugal": "葡萄牙", "Puerto Rico": "波多黎各", "Qatar": "卡塔尔", "Republic of the Congo": "刚果（布）",
    "Reunion": "留尼汪", "Romania": "罗马尼亚", "Russia": "俄罗斯", "Rwanda": "卢旺达",
    "Saint Kitts and Nevis": "圣基茨和内维斯", "Saint Lucia": "圣卢西亚", "Samoa": "萨摩亚",
    "San Marino": "圣马力诺", "Saudi Arabia": "沙特阿拉伯", "Senegal": "塞内加尔",
    "Serbia": "塞尔维亚", "Sierra Leone": "塞拉利昂", "Singapore": "新加坡", "Sint Maarten": "荷属圣马丁",
    "Slovakia": "斯洛伐克", "Slovenia": "斯洛文尼亚", "Somalia": "索马里", "South Africa": "南非",
    "South Korea": "韩国", "Spain": "西班牙", "Sri Lanka": "斯里兰卡", "Sudan": "苏丹",
    "Suriname": "苏里南", "Sweden": "瑞典", "Switzerland": "瑞士", "Syria": "叙利亚",
    "Taiwan": "台湾", "Tajikistan": "塔吉克斯坦", "Tanzania": "坦桑尼亚", "Thailand": "泰国",
    "Togo": "多哥", "Trinidad and Tobago": "特立尼达和多巴哥", "Tunisia": "突尼斯",
    "Turkiye": "土耳其", "Turkmenistan": "土库曼斯坦", "U.S. Virgin Islands": "美属维尔京群岛",
    "Uganda": "乌干达", "Ukraine": "乌克兰", "Undefined": "未定义", "United Arab Emirates": "阿联酋",
    "United Kingdom": "英国", "United States": "美国", "Uruguay": "乌拉圭", "Uzbekistan": "乌兹别克斯坦",
    "Vatican City": "梵蒂冈", "Venezuela": "委内瑞拉", "Vietnam": "越南", "Western Sahara": "西撒哈拉",
    "Yemen": "也门", "Zambia": "赞比亚", "Zimbabwe": "津巴布韦"
}

# 用于线程安全的打印和统计
print_lock = threading.Lock()
check_results: Dict[str, Any] = {
    "total": 0, "working": 0, "timed_out": 0, "failed_error": 0
}

# --- 核心函数：M3U 文件操作 ---

def download_m3u(url: str, filename: str) -> str | None:
    """【步骤 1/5】从给定URL下载M3U文件并保存。"""
    print(f"\n--- 1. 下载 M3U 文件 ---")
    print(f"正在下载文件: {url}")
    try:
        response = requests.get(url, stream=True)
        response.raise_for_status()
        
        content = response.content.decode('utf-8', errors='ignore')

        with open(filename, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✅ 下载完成。文件已保存为 {filename}")
        return content
    except requests.exceptions.RequestException as e:
        print(f"❌ 错误：下载文件失败。请检查URL和网络连接: {e}")
        return None

def parse_m3u_blocks(content: str) -> List[Dict[str, str]]:
    """将 M3U 内容解析为 (EXTINF, URL) 频道块列表。"""
    
    # 正则表达式匹配 #EXTINF:... 后面的 URL
    pattern = re.compile(r'(#EXTINF:.*?,\s*([^,\n]+))(?:\s*|[\n\r]+)(http[^#\s]+)', re.IGNORECASE)
    
    blocks = []
    # 使用 finditer 迭代所有匹配项
    for match in pattern.finditer(content):
        extinf_line = match.group(1).strip()
        channel_name = match.group(2).strip()
        url = match.group(3).strip()
        
        blocks.append({
            'extinf': extinf_line,
            'url': url,
            'name': channel_name,
            'status': 'PENDING'
        })
            
    if not blocks:
        print("❌ 警告：未在文件中找到任何有效的频道和 URL 组合。")
        
    return blocks

# --- 核心函数：流可用性检查（并发） ---

def check_stream_url(stream_data: Dict[str, str], index: int, total_count: int) -> Dict[str, str]:
    """
    【步骤 2/5】单个工作函数：使用 HEAD 请求检查 URL 是否可用。
    返回带有更新状态的 stream_data
    """
    url = stream_data['url']
    name = stream_data['name']
    
    is_working = False
    status_text = ""
    issue_type = None # 'timeout', 'error', or None
    
    try:
        # 使用 HEAD 请求，并忽略 SSL 证书问题
        response = requests.head(url, timeout=TIMEOUT, allow_redirects=True, verify=False) 
        status_code = response.status_code
        
        if 200 <= status_code < 400:
            status_text = "✅ WORKING"
            is_working = True
            stream_data['status'] = 'WORKING'
        else:
            status_text = f"❌ FAILED ({status_code})"
            issue_type = 'error'
            stream_data['status'] = 'FAILED'
            
    except requests.exceptions.Timeout:
        status_text = "❌ TIMEOUT"
        issue_type = 'timeout'
        stream_data['status'] = 'TIMEOUT'
    except requests.exceptions.RequestException as e:
        status_text = f"❌ ERROR ({type(e).__name__})"
        issue_type = 'error'
        stream_data['status'] = 'FAILED'
    
    # 使用锁来安全打印和更新统计数据
    with print_lock:
        check_results["total"] += 1
        
        if is_working:
            check_results["working"] += 1
        else:
            if issue_type == 'timeout':
                check_results["timed_out"] += 1
            elif issue_type == 'error':
                check_results["failed_error"] += 1
            
        progress_percent = (check_results["total"] / total_count) * 100
        
        # 打印实时进度和结果
        print(f"[{check_results['total']}/{total_count} | {progress_percent:.1f}%] {status_text:<15} | 频道: {name[:40]:<40} | URL: {url[:50]}...")
            
    return stream_data

def concurrent_check_and_filter(streams: List[Dict[str, str]]) -> List[Dict[str, str]]:
    """
    并发检查所有流，并返回仅包含 WORKING 流的列表。
    """
    total_streams = len(streams)
    print(f"\n--- 2. 验证流可用性 ({total_streams} 个链接) ---")
    print(f"🚀 使用 {MAX_WORKERS} 个线程并发检查，超时 {TIMEOUT} 秒。")

    futures = []
    working_streams: List[Dict[str, str]] = [] 
    
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        for i, stream in enumerate(streams):
            future = executor.submit(
                check_stream_url,
                stream,
                i,
                total_streams
            )
            futures.append(future)

        # 收集结果
        for future in as_completed(futures):
            stream_data = future.result()
            if stream_data['status'] == 'WORKING':
                working_streams.append(stream_data)
                
    return working_streams

# --- 核心函数：名称翻译（并发） ---

def worker_translate(name: str, index: int, total_count: int, target_lang: str, source_lang: str) -> Tuple[str, str]:
    """单个频道名称的翻译工作函数，将在单独的线程中运行。"""
    try:
        translator = GoogleTranslator(source=source_lang, target=target_lang)
        translated_text = translator.translate(name)
        
        # 使用锁确保打印输出不会混乱
        with print_lock:
            progress_percent = (index + 1 / total_count) * 100
            # 打印实时进度和结果
            print(f"翻译进度: {index + 1}/{total_count} ({progress_percent:.1f}%) | "
                  f"原始: {name[:30]:<30} -> 翻译: {translated_text[:30]:<30}")
            
        return (name, translated_text)
    except Exception as e:
        with print_lock:
            print(f"\n❌ 警告：线程 {index + 1} 翻译失败: {name}. 错误: {e}")
        return (name, name) # 失败时返回原始名称

def translate_channels_concurrent(unique_names: List[str]) -> Dict[str, str]:
    """
    【步骤 3/5】使用多线程加速翻译过程。
    """
    channel_map = {}
    total_count = len(unique_names)
    
    print(f"\n--- 3. 自动翻译频道名称 (TURBO模式 - {total_count}个) ---")
    print(f"🚀 使用 {MAX_WORKERS} 个线程并发翻译。")

    futures = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        for i, name in enumerate(unique_names):
            future = executor.submit(
                worker_translate,
                name,
                i,
                total_count,
                TARGET_LANG,
                SOURCE_LANG
            )
            futures.append(future)
            # 线程启动间添加延迟，避免瞬间发送过多请求导致封锁
            time.sleep(TRANSLATION_DELAY / MAX_WORKERS) 

        # 收集所有已完成的翻译结果
        for future in as_completed(futures):
            original, translated = future.result()
            channel_map[original] = translated
    
    print(f"\n✅ 频道翻译完成。已成功翻译 {len(channel_map)} 个名称。")
    return channel_map

# --- 核心函数：构建和保存文件 ---

def build_and_save_final_m3u8(working_streams: List[Dict[str, str]], country_map: Dict[str, str], channel_map: Dict[str, str], output_path: str):
    """
    【步骤 4/5】执行替换和文件写入操作。
    """
    print(f"\n--- 4. 构建和保存最终 M3U8 文件 ---")
    
    country_replace_count = 0
    channel_replace_count = 0
    
    # 1. 替换 group-title="..." 的函数
    def replace_country_name(match):
        nonlocal country_replace_count
        english_name = match.group(2)
        chinese_name = country_map.get(english_name, english_name)
        if chinese_name != english_name:
            country_replace_count += 1
        return f'{match.group(1)}{chinese_name}{match.group(3)}'
    
    # 正则表达式用于替换 group-title="..."
    country_pattern = re.compile(r'(group-title=")([^"]+)(")')

    # 开始写入文件
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("#EXTM3U\n") # M3U 文件头
            
            for stream in working_streams:
                original_extinf = stream['extinf']
                original_name = stream['name']
                url = stream['url']
                
                # 1. 替换国家/地区分组名称 (group-title)
                translated_extinf = country_pattern.sub(replace_country_name, original_extinf)
                
                # 2. 替换频道名称（位于 EXTINF 行的末尾）
                translated_name = channel_map.get(original_name, original_name)
                
                # 由于 original_extinf 的格式是 #EXTINF:...,[Name]，我们直接替换末尾的名称
                final_extinf = re.sub(r',\s*([^,\n]+)$', f', {translated_name}', translated_extinf)
                
                if translated_name != original_name:
                    channel_replace_count += 1
                
                f.write(final_extinf + '\n')
                f.write(url + '\n')
                
        print(f"   替换统计:")
        print(f"   - 国家/地区分组替换数量: {country_replace_count}")
        print(f"   - 频道名称替换数量: {channel_replace_count}")
        print(f"✅ 文件构建完成。新文件已保存到：{output_path}")
        
    except Exception as e:
        print(f"❌ 写入文件时发生错误: {e}")

# --- 主程序入口 ---
def main():
    # 0. 初始化
    start_time = time.time()
    
    # 1. 下载文件
    m3u_content = download_m3u(M3U_URL, INPUT_FILE_NAME)
    if not m3u_content:
        return

    # 1.5 解析成块
    all_streams = parse_m3u_blocks(m3u_content)

    # 2. 并发检查并过滤（核心清理步骤）
    working_streams = concurrent_check_and_filter(all_streams)
    
    # 3. 从工作流中提取唯一名称并翻译
    unique_working_channels = sorted(list(set(s['name'] for s in working_streams)))
    channel_translation_map = translate_channels_concurrent(unique_working_channels)

    # 4. 构建并保存最终文件
    build_and_save_final_m3u8(working_streams, COUNTRY_MAPPING, channel_translation_map, OUTPUT_FILE_NAME)

    # 5. 清理和总结
    if os.path.exists(INPUT_FILE_NAME):
        os.remove(INPUT_FILE_NAME) 
        print(f"   已删除临时下载文件: {INPUT_FILE_NAME}")
    
    end_time = time.time()
    print(f"\n--- 5. 任务总结 ---")
    print(f"检查总数: {check_results['total']}")
    print(f"✅ 可播放（WORKING）: {check_results['working']}")
    print(f"❌ 超时（TIMEOUT）: {check_results['timed_out']}")
    print(f"❌ 失败/错误（FAILED/ERROR）: {check_results['failed_error']}")
    print(f"🎉 **所有任务完成！总耗时: {end_time - start_time:.2f} 秒**")
    print(f"最终文件（已清理并翻译）: {OUTPUT_FILE_NAME}")

if __name__ == "__main__":
    # 关闭 requests 库发出的不必要的 InsecureRequestWarning
    requests.packages.urllib3.disable_warnings() 
    main()
