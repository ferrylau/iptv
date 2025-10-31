import requests
import re
import urllib.parse
import time
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading
from typing import List, Dict, Tuple, Any
from deep_translator import GoogleTranslator

# ===============================================
# 步骤 1: 配置
# ===============================================

# M3U 文件源配置
M3U_URL = "https://iptv-org.github.io/iptv/index.country.m3u"
INPUT_FILE_NAME = "index.country.m3u" # 临时下载文件 (主源)

# 中间文件配置 (新)
INTERMEDIATE_FILE_NAME = "merged_streams_for_check.m3u" # 阶段 1 输出，供外部检查
INPUT_CLEANED_FILE_NAME = "cleaned_streams.m3u"        # 阶段 2 输入，用户清理后的文件

# --- 更改配置：中国 M3U 源列表 ---
CHINA_M3U_SOURCES: List[Tuple[str, str]] = [
    # 您原来提供的第一个中国源
    ("https://raw.githubusercontent.com/Guovin/iptv-api/gd/output/ipv6/result.m3u", "ipv6_result.m3u"),
    # 示例：第二个中国源 (请替换为您真实的 URL)
    ("https://raw.githubusercontent.com/fanmingming/live/refs/heads/main/tv/m3u/ipv6.m3u", "china_source_2.m3u"), 
]
# -----------------------------------------------------

OUTPUT_FILE_NAME = "index.country.chinese.m3u" # 最终输出文件
SOURCE_LANG = 'en'
TARGET_LANG = 'zh-CN'
TRANSLATION_DELAY = 0.1 # 线程启动间的延迟（秒），用于翻译步骤

# IP 地理位置 API 配置
IP_API_BASE_URL = "http://ip-api.com/json/"
IP_RATE_LIMIT_DELAY = 1.5 # 每次 IP 查询之间等待 1.5 秒以遵守 ip-api.com 的免费限制

# 并发配置
MAX_WORKERS = 50    # 并发线程数：用于翻译
TIMEOUT = 5          # 请求超时时间（秒）

# 硬编码的国家分组对照表 (英文 -> 中文)
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
    "Guam": "关岛", "Guatemala": "危地马拉", "Guernsey": "根西岛", "Guinea": "几内内",
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
    "Myanmar": "缅甸", "Namibia": "纳米比亚", "Nepal": "尼泊尔", "Netherlands": "荷兰", "The Netherlands": "荷兰",
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
    "Turkiye": "土耳其", "Turkey": "土耳其", "Turkmenistan": "土库曼斯坦", "U.S. Virgin Islands": "美属维尔京群岛",
    "Uganda": "乌干达", "Ukraine": "乌克兰", "Undefined": "未定义", "United Arab Emirates": "阿联酋",
    "United Kingdom": "英国", "United States": "美国", "Uruguay": "乌拉圭", "Uzbekistan": "乌兹别克斯坦",
    "Vatican City": "梵蒂冈", "Venezuela": "委内瑞拉", "Vietnam": "越南", "Western Sahara": "西撒哈拉",
    "Yemen": "也门", "Zambia": "赞比亚", "Zimbabwe": "津巴布韦"
}

# 用于线程安全的打印 (仅用于翻译步骤)
print_lock = threading.Lock()

# --- GeoIP 和 M3U 解析工具函数 ---

def extract_ip_from_url(url: str) -> str:
    """从完整的 URL 中提取 IP 地址或域名。"""
    try:
        parsed_url = urllib.parse.urlparse(url)
        hostname = parsed_url.hostname
        # 简单的域名/IP提取，忽略端口等
        return hostname or ""
    except Exception:
        return ""

def get_geo_info_for_classification(ip_or_domain: str) -> str:
    """
    调用 GeoIP API 获取国家名称 (e.g., 'China')。
    返回的是英文国家名称，以便于 COUNTRY_MAPPING 查找。
    """
    if not ip_or_domain:
        return "Unknown"

    try:
        # 1. GeoIP 查询
        url = f"{IP_API_BASE_URL}{ip_or_domain}?fields=country,status"
        response = requests.get(url, timeout=TIMEOUT)
        response.raise_for_status()
        data = response.json()

        if data.get('status') == 'success' and data.get('country'):
            return data['country']
        else:
            return "Query Failed"

    except requests.exceptions.RequestException:
        return "Error"

def parse_m3u_blocks(content: str) -> List[Dict[str, str]]:
    """将 M3U 内容解析为 (EXTINF, URL, group-title) 频道块列表。"""
    
    # 正则表达式匹配 #EXTINF:... 后面的 URL
    # group 1: 完整的 #EXTINF 行
    # group 2: 频道名称 (在 , 后面，换行符之前)
    # group 3: URL
    pattern = re.compile(r'(#EXTINF:.*?,\s*([^,\n]+))(?:\s*|[\n\r]+)(http[^#\s]+)', re.IGNORECASE)
    # 正则表达式用于提取 group-title
    group_title_pattern = re.compile(r'group-title="([^"]*)"', re.IGNORECASE)
    
    blocks = []
    for match in pattern.finditer(content):
        extinf_line = match.group(1).strip()
        channel_name = match.group(2).strip()
        url = match.group(3).strip()
        
        # 提取 group-title
        group_match = group_title_pattern.search(extinf_line)
        # 默认设置为 Undefined，以便进行 GeoIP 分类
        group_title = group_match.group(1) if group_match else 'Undefined' 
        
        blocks.append({
            'extinf': extinf_line,
            'url': url,
            'name': channel_name,
            'group': group_title, 
            'status': 'N/A' # 状态不再重要，因为跳过了检查
        })
        
    if not blocks:
        print("❌ 警告：未在文件中找到任何有效的频道和 URL 组合。")
        
    return blocks

# --- 核心函数：M3U 文件操作 ---

def download_m3u(url: str, filename: str) -> str | None:
    """从给定URL下载M3U文件并保存。"""
    print(f"--- 正在下载文件: {url} ---")
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url, headers=headers, timeout=TIMEOUT)
        response.raise_for_status()
        
        content = response.content.decode('utf-8', errors='ignore')

        with open(filename, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✅ 下载完成。文件已保存为 {filename}")
        return content
    except requests.exceptions.RequestException as e:
        print(f"❌ 错误：下载文件失败。请检查URL和网络连接: {e}")
        return None

def save_merged_m3u(streams: List[Dict[str, str]], output_path: str):
    """
    【阶段 1 核心】保存所有解析和合并后的流到一个中间 M3U 文件。
    用于用户进行外部可用性检查。
    """
    print(f"\n--- 阶段 1: 3. 保存合并后的 M3U 文件 ({output_path}) ---")
    
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("#EXTM3U\n") # M3U 文件头
            
            for stream in streams:
                # 写入 EXTINF 行，此时 group-title 已经被处理为英文国家名或 Undefined
                f.write(stream['extinf'] + '\n') 
                f.write(stream['url'] + '\n')
                
        print(f"🎉 阶段 1 完成。已将 {len(streams)} 个流保存到 {output_path}")
        print("==================================================================")
        print(f"👉 **下一步:** 请使用外部工具检查此文件中的流。")
        print(f"👉 **完成后:** 删除无效流，并将文件重命名为 **{INPUT_CLEANED_FILE_NAME}**，然后重新运行脚本。")
        print("==================================================================")
        
    except Exception as e:
        print(f"❌ 写入中间文件时发生错误: {e}")


def classify_undefined_streams(streams: List[Dict[str, str]], country_map: Dict[str, str]) -> List[Dict[str, str]]:
    """
    【阶段 2 - 步骤 1/3】针对 group-title="Undefined" 的流，进行 IP 地理位置查询和分类。
    """
    
    streams_to_classify = [s for s in streams if s['group'] == 'Undefined']
    total_to_classify = len(streams_to_classify)
    
    if not total_to_classify:
        print("\n--- 阶段 2: 1. IP 地理位置分类 (GeoIP) ---")
        print("✅ 无需分类：清理文件中没有 group-title=\"Undefined\" 的频道。跳过 GeoIP 查询。")
        return streams

    print(f"\n--- 阶段 2: 1. IP 地理位置分类 (GeoIP) ---")
    print(f"找到 {total_to_classify} 个 'Undefined' 频道需要 GeoIP 查找。")
    print(f"⚠️ 注意: 启用速率限制 ({IP_RATE_LIMIT_DELAY} 秒延迟)。此步骤是串行执行。")
    
    country_map_keys = set(country_map.keys())
    
    # 遍历所有流，但只处理 Undefined 的流
    for i, stream in enumerate(streams):
        if stream['group'] != 'Undefined':
            continue
        
        ip_or_domain = extract_ip_from_url(stream['url'])
        
        # 打印进度 (只针对 Undefined 频道)
        print(f"[GeoIP Progress] 查找频道: {stream['name'][:30]:<30} | 源: {ip_or_domain}", end="")

        api_country_name = get_geo_info_for_classification(ip_or_domain)

        # 1. 映射到英文分组名
        if api_country_name in country_map_keys:
            new_group_title_english = api_country_name 
            
            # 替换 EXTINF 中的 group-title
            old_tag = 'group-title="Undefined"'
            new_tag = f'group-title="{new_group_title_english}"'
            
            stream['extinf'] = stream['extinf'].replace(old_tag, new_tag)
            stream['group'] = new_group_title_english # 更新 internal record
            
            print(f" -> 匹配成功: {api_country_name} (更新为英文分组名)")
        else:
            # 2. 如果查找失败或不在映射表中，保持 Undefined
            if api_country_name in ["Query Failed", "Error", "Unknown"]:
                print(f" -> 保持 Undefined: 查找失败或无法识别 ({api_country_name})")
            else:
                print(f" -> 保持 Undefined: 查找到 {api_country_name}，但不在 COUNTRY_MAPPING 中")
        
        # 强制延迟，确保遵守 ip-api.com 的速率限制
        time.sleep(IP_RATE_LIMIT_DELAY) 
        
    return streams 

# --- 核心函数：名称翻译（并发） ---

def worker_translate(name: str, index: int, total_count: int, target_lang: str, source_lang: str) -> Tuple[str, str]:
    """单个频道名称的翻译工作函数。"""
    try:
        translator = GoogleTranslator(source=source_lang, target=target_lang)
        translated_text = translator.translate(name)
        
        with print_lock:
            progress_percent = ((index + 1) / total_count) * 100
            print(f"翻译进度: {index + 1}/{total_count} ({progress_percent:.1f}%) | "
                  f"原始: {name[:30]:<30} -> 翻译: {translated_text[:30]:<30}")
            
        return (name, translated_text)
    except Exception as e:
        with print_lock:
            print(f"\n❌ 警告：线程 {index + 1} 翻译失败: {name}. 错误: {e}")
        return (name, name) # 失败时返回原始名称

def translate_channels_concurrent(unique_names: List[str]) -> Dict[str, str]:
    """
    【阶段 2 - 步骤 2/3】使用多线程加速翻译频道名称。
    """
    channel_map = {}
    total_count = len(unique_names)
    
    print(f"\n--- 阶段 2: 2. 自动翻译频道名称 (TURBO模式 - {total_count}个) ---")
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

def build_and_save_final_m3u8(final_streams: List[Dict[str, str]], country_map: Dict[str, str], channel_map: Dict[str, str], output_path: str):
    """
    【阶段 2 - 步骤 3/3】执行替换（英文分组名 -> 中文分组名）和文件写入操作。
    """
    print(f"\n--- 阶段 2: 3. 构建和保存最终 M3U8 文件 ---")
    
    country_replace_count = 0
    channel_replace_count = 0
    
    # 1. 替换 group-title="..." 的函数 (将英文国家名替换为中文名)
    def replace_country_name(match):
        nonlocal country_replace_count
        english_name = match.group(2)
        chinese_name = country_map.get(english_name, english_name)
        if chinese_name != english_name:
            country_replace_count += 1
        return f'{match.group(1)}{chinese_name}{match.group(3)}'
    
    # 正则表达式用于替换 group-title="..."
    country_pattern = re.compile(r'(group-title=")([^"]+)(")')

    # 正则表达式用于替换 EXTINF 行末尾的名称 (注意要匹配到行尾)
    name_end_pattern = re.compile(r',\s*([^,\n]+)$')

    # 开始写入文件
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("#EXTM3U\n") # M3U 文件头
            
            for stream in final_streams:
                original_extinf = stream['extinf']
                original_name = stream['name']
                url = stream['url']
                
                # 1. 替换国家/地区分组名称 (group-title)
                translated_extinf_group = country_pattern.sub(replace_country_name, original_extinf)
                
                # 2. 替换频道名称
                translated_name = channel_map.get(original_name, original_name)
                
                # 替换 EXTINF 行末尾的频道名称
                final_extinf = name_end_pattern.sub(f', {translated_name}', translated_extinf_group)
                
                if translated_name != original_name:
                    channel_replace_count += 1
                
                f.write(final_extinf + '\n')
                f.write(url + '\n')
                
        print(f"  替换统计:")
        print(f"  - 国家/地区分组替换数量: {country_replace_count}")
        print(f"  - 频道名称替换数量: {channel_replace_count}")
        print(f"✅ 文件构建完成。新文件已保存到：{output_path}")
        
    except Exception as e:
        print(f"❌ 写入文件时发生错误: {e}")

# --- 阶段 1 入口：下载和合并 ---

def run_phase_1_merge():
    """运行下载、合并和输出中间文件的第一阶段。"""
    
    # 1. 下载第一个文件 (主文件)
    print("\n" + "="*50)
    print("--- 阶段 1: 1. 下载主 M3U 文件 ---")
    m3u_content_1 = download_m3u(M3U_URL, INPUT_FILE_NAME)
    if not m3u_content_1: 
        print("❌ 主文件下载失败，终止程序。")
        return
    
    # 2. 解析成块
    all_streams = parse_m3u_blocks(m3u_content_1)
    initial_stream_count = len(all_streams)

    # 2.1 处理多个中国专用源
    print("\n" + "="*50)
    print(f"--- 阶段 1: 2. 处理 {len(CHINA_M3U_SOURCES)} 个中国专用源 ---")
    
    china_country_english = "China" 
    
    group_title_pattern = re.compile(r'\sgroup-title="[^"]*"', re.IGNORECASE)
    new_group_tag = f' group-title="{china_country_english}"'

    total_merged_count = 0

    for m3u_url, temp_filename in CHINA_M3U_SOURCES:
        print(f"\n>>>> 正在处理中国源: {m3u_url}")
        m3u_content_china = download_m3u(m3u_url, temp_filename)
        
        if m3u_content_china:
            china_streams = parse_m3u_blocks(m3u_content_china)
            china_streams_count = len(china_streams)
            total_merged_count += china_streams_count
            
            for stream in china_streams:
                if group_title_pattern.search(stream['extinf']):
                    stream['extinf'] = group_title_pattern.sub(new_group_tag, stream['extinf'])
                else:
                    stream['extinf'] = stream['extinf'].replace('#EXTINF:-1', f'#EXTINF:-1{new_group_tag}', 1)
                
                stream['group'] = china_country_english
                all_streams.append(stream)
            
        else:
            print(f"❌ 中国源下载失败，跳过合并: {m3u_url}")

    print(f"\n✅ 所有源合并完成。初始流数量: {initial_stream_count}, 总合并流数量: {total_merged_count}。最终总流数量: {len(all_streams)}")
    print("="*50)
    
    # 3. 保存合并后的 M3U 文件供用户外部检查
    save_merged_m3u(all_streams, INTERMEDIATE_FILE_NAME)


# --- 阶段 2 入口：处理清理后的文件 ---

def run_phase_2_process(cleaned_file_path: str):
    """运行导入清理后的文件、GeoIP、翻译和最终输出的第二阶段。"""
    
    print("\n" + "="*50)
    print(f"--- 阶段 2: 正在导入清理文件 {cleaned_file_path} ---")
    
    try:
        with open(cleaned_file_path, 'r', encoding='utf-8') as f:
            cleaned_content = f.read()
        
        # 1. 解析清理后的文件
        streams_from_cleaned = parse_m3u_blocks(cleaned_content)
        print(f"✅ 成功导入 {len(streams_from_cleaned)} 个流。")

    except FileNotFoundError:
        print(f"❌ 错误：文件 {cleaned_file_path} 不存在。请确保您已完成清理并重命名文件。")
        return
    except Exception as e:
        print(f"❌ 导入或解析文件 {cleaned_file_path} 失败: {e}")
        return

    # 2. IP 地理位置分类 (仅针对 Undefined)
    final_classified_streams = classify_undefined_streams(streams_from_cleaned, COUNTRY_MAPPING)

    # 3. 提取唯一名称并翻译
    unique_channels = sorted(list(set(s['name'] for s in final_classified_streams)))
    channel_translation_map = translate_channels_concurrent(unique_channels)

    # 4. 构建并保存最终文件
    build_and_save_final_m3u8(final_classified_streams, COUNTRY_MAPPING, channel_translation_map, OUTPUT_FILE_NAME)

    print("\n" + "="*50)
    print("--- 阶段 2: 任务总结 ---")
    print(f"导入流数量: {len(streams_from_cleaned)}")
    print(f"🎉 **所有任务完成！最终文件（已清理并翻译）: {OUTPUT_FILE_NAME}**")
    print("="*50)


# --- 主程序入口 ---
def main():
    start_time = time.time()
    
    # 关闭 requests 库发出的不必要的 InsecureRequestWarning
    requests.packages.urllib3.disable_warnings() 
    
    # 清理临时文件
    def cleanup_temps():
        print("\n--- 清理临时文件 ---")
        temp_files = [INPUT_FILE_NAME, INTERMEDIATE_FILE_NAME] + [f for _, f in CHINA_M3U_SOURCES]
        
        # 移除所有临时文件，但不包括 INPUT_CLEANED_FILE_NAME，因为它在第二阶段是输入文件
        for temp_filename in temp_files:
            if os.path.exists(temp_filename):
                os.remove(temp_filename) 
                print(f"  已删除临时文件: {temp_filename}")
    
    # 检查是否存在清理后的文件，以确定运行哪个阶段
    if os.path.exists(INPUT_CLEANED_FILE_NAME):
        # --- 运行阶段 2 ---
        cleanup_temps()
        run_phase_2_process(INPUT_CLEANED_FILE_NAME)
        # 删除阶段 2 的输入文件，以便下次运行新周期
        if os.path.exists(INPUT_CLEANED_FILE_NAME):
            os.remove(INPUT_CLEANED_FILE_NAME)
            print(f"  已删除阶段 2 输入文件: {INPUT_CLEANED_FILE_NAME}")

    else:
        # --- 运行阶段 1 ---
        cleanup_temps() # 清理残留的旧临时文件，包括旧的 merged 文件
        run_phase_1_merge()

    end_time = time.time()
    print(f"\n**总耗时: {end_time - start_time:.2f} 秒**")

if __name__ == "__main__":
    main()
