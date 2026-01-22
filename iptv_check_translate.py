import requests
import re
import urllib.parse
import time
import os
import asyncio
import subprocess # 新增：用于执行 FFmpeg 命令行工具
import threading
from typing import List, Dict, Optional, Tuple
from deep_translator import GoogleTranslator
from requests.exceptions import RequestException
import sys # 新增：用于错误输出


M3U_SOURCES_CHINA: List[Tuple[str, str]] = [
    ('https://raw.githubusercontent.com/zbefine/iptv/main/iptv.m3u','m3u'),
    ('https://raw.githubusercontent.com/vamoschuck/TV/main/M3U','m3u'),
]

M3U_SOURCES_CHINA_EXTRA: List[Tuple[str, str]] = [
    ('https://epg.pw/test_channels.m3u','m3u'),
    ('https://epg.pw/test_channels_hong_kong.m3u','m3u'),
    ('https://epg.pw/test_channels_macau.m3u','m3u'),

    ('https://epg.pw/test_channels_taiwan.m3u','m3u'),
    ('https://iptv-org.github.io/iptv/countries/tw.m3u','m3u'),

    ('https://epg.pw/test_channels_singapore.m3u','m3u'),
    ('https://epg.pw/test_channels_malaysia.m3u','m3u'),
]

M3U_SOURCES_GLOBAL: List[Tuple[str, str]] = [
    ("https://iptv-org.github.io/iptv/index.country.m3u","m3u"),
    #("https://raw.githubusercontent.com/wcb1969/iptv/refs/heads/main/%E7%94%B5%E4%BF%A1IPTV.txt", "txt"),
]

SOURCE_ALL: List[Tuple[List[Tuple[str, str]],str]] = [
    (M3U_SOURCES_CHINA, "china_tv.m3u"),
    (M3U_SOURCES_CHINA_EXTRA, "china_extra_tv.m3u"),
    (M3U_SOURCES_GLOBAL, "global_tv.m3u"),
]

SOURCE_LANG = 'en'
TARGET_LANG = 'zh-CN'
TRANSLATION_DELAY = 0.1 # 线程启动间的延迟（秒），用于翻译步骤

# IP 地理位置 API 配置
IP_API_BASE_URL = "http://ip-api.com/json/"
IP_RATE_LIMIT_DELAY = 1.5 # 每次 IP 查询之间等待 1.5 秒以遵守 ip-api.com 的免费限制

# 并发配置
MAX_WORKERS = 30      # 并发线程数：用于翻译
TIMEOUT = 5          # 默认请求超时时间（秒）

# 新增：流可用性检查配置
STREAM_CHECK_WORKERS = 50 # 并发线程数：用于流检查（优化：减少并发数以降低带宽压力）
STREAM_CHECK_TIMEOUT = 3  # 检查超时时间（秒），用于快速判断连接（优化：减少检测时长）
FFMPEG_BINARY = "ffmpeg"  # FFmpeg 可执行文件名称 (通常在系统 PATH 中)

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
    "Guam": "关岛", "Guatemala": "危地马拉", "Honduras": "洪都拉斯", "Hong Kong": "香港",
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

# 用于线程安全的打印
print_lock = threading.Lock()

# --------------------------------------------------------------------------
# M3U TXT 源整合器
# 该脚本用于从远程 TXT 文件（格式：频道名,链接）获取数据，
# 并将其转换为标准的 M3U 格式列表。
# --------------------------------------------------------------------------

def get_filename_from_url(url: str) -> str:
    """
    从完整的 URL 中提取并解码文件名，作为 M3U 的 group-title。

    Args:
        url: 外部 TXT 源文件的完整 URL。

    Returns:
        解码后的文件名字符串，如果失败则返回 "External Source"。
    """
    try:
        parsed_url = urllib.parse.urlparse(url)
        # 获取路径的最后一段
        path = parsed_url.path
        filename_encoded = os.path.basename(path)
        
        # URL 解码，以处理中文文件名（例如 %E7%9B%B4%E6%92%AD%E6%BA%90）
        filename = urllib.parse.unquote(filename_encoded)
        
        return filename if filename else "External Source"
    except Exception as e:
        print(f"Error parsing URL: {e}", file=sys.stderr)
        return "External Source"

def fetch_and_parse_txt(url: str) -> list:
    """
    获取远程 TXT 文件内容，并将其解析为 M3U 项目列表。

    Args:
        url: 远程 TXT 源文件的 URL。

    Returns:
        包含解析后项目（字典）的列表。
        每个字典格式为: {'name': str, 'url': str, 'group': str}
    """
    print(f"-> Fetching content from: {url}")
    
    # 确定 group-title
    group_title = get_filename_from_url(url)
    
    try:
        # 使用 requests 获取文件内容，设置超时
        response = requests.get(url, timeout=10)
        response.raise_for_status()  # 检查 HTTP 状态码，如果不是 200 则抛出异常
        
        # 假设内容是 UTF-8 编码
        content = response.text
        
    except requests.exceptions.RequestException as e:
        print(f"Error fetching URL: {e}", file=sys.stderr)
        return []

    parsed_items = []
    lines = content.split('\n')
    
    for line in lines:
        trimmed_line = line.strip()
        if not trimmed_line:
            continue
        
        # 期望格式: 频道名,链接 (链接可能包含逗号)
        parts = trimmed_line.split(',', 1) # 只分割第一个逗号
        
        if len(parts) == 2:
            name = parts[0].strip()
            link = parts[1].strip()
            
            # 简单验证链接是否有效
            if name and link:
                parsed_items.append({
                    'name': name,
                    'url': link,
                    'group': group_title  # 使用文件名作为 group-title
                })
            else:
                print(f"Warning: Skipping malformed line (Invalid name or URL): {trimmed_line}")
        else:
            print(f"Warning: Skipping malformed line (Missing comma separator): {trimmed_line}")
            
    print(f"-> Successfully parsed {len(parsed_items)} items with group-title: '{group_title}'")
    return parsed_items

def generate_m3u(items: list) -> str:
    """
    将项目列表转换为 M3U 格式的字符串。

    Args:
        items: 包含 M3U 频道信息的字典列表。

    Returns:
        完整的 M3U 格式内容字符串。
    """
    m3u_content = "#EXTM3U\n"
    for item in items:
        # 确保名称和分组标题中不包含未转义的双引号
        safe_name = item['name'].replace('"', "'")
        safe_group = item['group'].replace('"', "'")

        # M3U 格式：#EXTINF:-1 group-title="<分组名>",<频道名>
        m3u_content += f'#EXTINF:-1 group-title="{safe_group}",{safe_name}\n'
        m3u_content += f'{item["url"]}\n'
        
    return m3u_content

# --- FFmpeg 可用性检查 ---
def check_ffmpeg_availability():
    """检查系统 PATH 中是否可以找到 FFmpeg，如果找不到则终止程序。"""
    print("\n" + "="*50)
    print("--- 步骤 0: FFmpeg 依赖检查 ---")
    try:
        # 尝试运行 ffmpeg，只输出版本信息，检查是否可用
        subprocess.run([FFMPEG_BINARY, "-version"], check=True, capture_output=True, text=True, timeout=5)
        print(f"✅ FFmpeg 检查通过。使用二进制文件: {FFMPEG_BINARY}")
        print("="*50)
    except FileNotFoundError:
        print(f"❌ 错误: 未在系统 PATH 中找到 '{FFMPEG_BINARY}'。")
        print("请确保您已安装 FFmpeg 并将其路径添加到系统环境变量中。")
        print("程序终止。")
        sys.exit(1)
    except subprocess.CalledProcessError as e:
        print(f"❌ 错误: FFmpeg 启动失败或返回错误代码。请检查安装。错误信息: {e.stderr.strip()}")
        print("程序终止。")
        sys.exit(1)
    except subprocess.TimeoutExpired:
        print(f"⚠️ 警告: FFmpeg 检查超时，但假定可用。请注意性能。")
        print("="*50)
    except Exception as e:
        print(f"❌ 错误: FFmpeg 检查过程中发生未知错误: {e}")
        print("程序终止。")
        sys.exit(1)


# --- GeoIP 和 M3U 解析工具函数 (保持不变) ---

def extract_ip_from_url(url: str) -> str:
    """从完整的 URL 中提取 IP 地址或域名。"""
    try:
        parsed_url = urllib.parse.urlparse(url)
        hostname = parsed_url.hostname
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
    """
    将 M3U/M3U8 内容解析为频道块列表。
    
    核心逻辑修改：
    1. 优先提取 'tvg-country' 的值作为分类 (group)。
    2. 如果 'tvg-country' 不存在，则回退到 'group-title' 的值。
    """

    # 正则表达式匹配 #EXTINF:... 后面的 URL。
    # Group 1: 完整的 #EXTINF 行，直到逗号 (,)
    # Group 2: 频道名称 (在最后一个逗号 , 后面，换行符之前)
    # Group 3: URL (任意非空白字符)
    pattern = re.compile(
        r'(#EXTINF:.*?,\s*([^,\n]+))'   # 匹配 EXTINF 行及频道名称
        r'(?:\s*|[\n\r]+)'              # 匹配 EXTINF 行和 URL 之间的分隔符 (空白或换行)
        r'(\S+)',                       # 匹配 URL (任意非空白字符)
        re.IGNORECASE | re.DOTALL
    )

    # 正则表达式用于提取 group-title 属性 (作为后备分类)
    group_title_pattern = re.compile(r'group-title="([^"]*)"', re.IGNORECASE)
    
    # 新增：正则表达式用于提取 tvg-country 属性 (作为优先分类)
    tvg_country_pattern = re.compile(r'tvg-country="([^"]*)"', re.IGNORECASE)
    # 新增：正则表达式用于提取 tvg-name 属性
    tvg_name_pattern = re.compile(r'tvg-name="([^"]*)"', re.IGNORECASE)
    # 新增：正则表达式用于提取 tvg-logo 属性
    tvg_logo_pattern = re.compile(r'tvg-logo="([^"]*)"', re.IGNORECASE)


    blocks = []
    
    for match in pattern.finditer(content):
        extinf_line = match.group(1).strip()
        channel_name = match.group(2).strip()
        url = match.group(3).strip()

        # 1. 提取 tvg-country (优先)
        country_match = tvg_country_pattern.search(extinf_line)
        tvg_country = country_match.group(1).strip() if country_match else ''
        
        # 2. 提取 group-title (后备)
        group_match = group_title_pattern.search(extinf_line)
        original_group_title = group_match.group(1).strip() if group_match else 'Undefined'
        
        # 3. 确定最终分类：如果 tvg_country 存在，则覆盖 group-title
        final_group = tvg_country if tvg_country else original_group_title
        
        # 提取其他可选属性
        tvg_name_match = tvg_name_pattern.search(extinf_line)
        tvg_name = tvg_name_match.group(1).strip() if tvg_name_match else ''

        tvg_logo_match = tvg_logo_pattern.search(extinf_line)
        tvg_logo = tvg_logo_match.group(1).strip() if tvg_logo_match else ''

        new_tag = f'group-title="{final_group}"'        
        if group_title_pattern.search(extinf_line):
            extinf_line = group_title_pattern.sub(new_tag, extinf_line)
        else:
            # 如果没有 group-title 属性，则尝试在 #EXTINF:-1 后添加
            extinf_line = extinf_line.replace('#EXTINF:-1', f'#EXTINF:-1 {new_tag}', 1)

        blocks.append({
            'extinf': extinf_line,
            'url': url,
            'name': channel_name,
            # 核心修改：使用优先逻辑确定的分类
            'group': final_group, 
            'tvg_name': tvg_name,
            'tvg_logo': tvg_logo,
            # 也可以保留原始属性以供调试，但根据需求，这里只输出 final_group
        })

    if not blocks:
        # ⚠️ 注意：在生产环境中，这应该使用 logging 模块
        print("❌ 警告：未在文件中找到任何有效的频道和 URL 组合。") 

    return blocks

# --- 核心函数：流可用性检查 (并发) - 使用 FFmpeg ---

async def print_progress(index: int, total_count: int, stream_name: str, status: str):
    """原子性地打印和更新进度条"""
    if not GLOBAL_PRINT_LOCK:
        return # 如果锁未初始化，跳过打印

    async with GLOBAL_PRINT_LOCK:
        progress_percent = ((index + 1) / total_count) * 100
        # 使用 \r 实现单行更新
        print(f"检查进度: {index + 1}/{total_count} ({progress_percent:.1f}%) | "
              f"[{status}] 频道: {stream_name[:30]:<30}", end="\r", flush=True)

async def async_worker_check_stream(
    stream: Dict[str, str], 
    index: int, 
    total_count: int,
    semaphore: asyncio.Semaphore # 新增参数：信号量
) -> Optional[Dict[str, str]]:
    """
    流可用性检查协程。使用 FFmpeg 异步检查流的可播放性，并受信号量限制并发数。
    """
    url = stream['url']
    is_working = False
    
    # 整个进程运行的最大时间: STREAM_CHECK_TIMEOUT (读取时间) + 5秒 (网络握手/重连缓冲)
    process_timeout = STREAM_CHECK_TIMEOUT + 5 

    # --- FFmpeg 命令设置 ---
    command = [
        FFMPEG_BINARY, 
        '-hide_banner', 
        '-v', 'error', 
        '-reconnect', '1',
        '-reconnect_streamed', '1',
        '-reconnect_delay_max', '5',
        '-analyzeduration', '1000000',
        '-probesize', '1000000',
        '-i', url, 
        '-t', str(STREAM_CHECK_TIMEOUT), 
        '-f', 'null', 
        '-'
    ]
    
    # 初始状态显示 'Checking'
    await print_progress(index, total_count, stream['name'], "🚧 Checking")

    proc = None
    
    # --- 核心修改：使用信号量限制并发执行 ---
    async with semaphore:
        try:
            # 1. 异步创建子进程
            # create_subprocess_exec 是异步 I/O 的推荐方式
            proc = await asyncio.create_subprocess_exec(
                *command, 
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            # 2. 异步等待命令完成，并设置超时保护
            # asyncio.wait_for 会在超时时抛出 TimeoutError，并自动尝试取消 proc.communicate()
            await asyncio.wait_for(proc.communicate(), timeout=process_timeout)
            
            # 如果执行到这里，表示进程已退出，且未超时
            return_code = proc.returncode

            # FFmpeg 退出码 0 或 1 通常表示成功读取数据，1 可能包含非致命警告
            if return_code in [0, 1]:
                is_working = True
            else:
                is_working = False

        except asyncio.TimeoutError:
            # 捕获超时，确保清理子进程
            is_working = False
            if proc and proc.returncode is None:
                # 进程仍在运行，尝试终止它
                try:
                    # 尝试优雅终止 (SIGTERM)
                    proc.terminate()
                    # 再次等待进程结束，但设置一个很短的清理时间
                    await asyncio.wait_for(proc.wait(), timeout=1)
                except (ProcessLookupError, asyncio.TimeoutError):
                    # 如果失败，强制杀死 (SIGKILL)
                    proc.kill()
                
        except FileNotFoundError:
            # 在信号量内部打印 FFmpeg 错误，否则会被其他任务覆盖
            await print_progress(index, total_count, stream['name'], "❌ FFMPEG")
            print(f"\n❌ 警告：未找到 '{FFMPEG_BINARY}' 命令。请确保 FFmpeg 已安装并配置到 PATH 中。", file=sys.stderr)
            is_working = False
            
        except Exception as e:
            is_working = False
            # 如果需要，可以在这里打印详细错误信息

    # 最终状态更新 (在信号量释放后，但仍需确保原子性)
    status = "✅ OK" if is_working else "❌ BAD"
    await print_progress(index, total_count, stream['name'], status)

    return stream if is_working else None

async def async_check_stream_availability(streams: List[Dict[str, str]]) -> List[Dict[str, str]]:
    """
    使用 asyncio 并发检查流的可用性，并使用 Semaphore 限制并发数。
    """
    global GLOBAL_PRINT_LOCK
    GLOBAL_PRINT_LOCK = asyncio.Lock() # 初始化全局打印锁

    total_count = len(streams)
    
    # --- 核心修改：创建信号量 ---
    semaphore = asyncio.Semaphore(STREAM_CHECK_WORKERS)
    
    print(f"\n--- 步骤 2: 流可用性检查 ({total_count}个流) ---")
    print(f"🚀 使用 {FFMPEG_BINARY} 和信号量限制 {STREAM_CHECK_WORKERS} 个并发任务 (超时: {STREAM_CHECK_TIMEOUT}s)。")
    
    start_time = time.time()
    
    tasks = []
    # 创建所有任务
    for i, stream in enumerate(streams):
        # 使用 asyncio.create_task 并传递信号量
        task = async_worker_check_stream(stream, i, total_count, semaphore)
        tasks.append(task)
    
    # 使用 asyncio.gather 并发等待所有任务完成
    results = await asyncio.gather(*tasks, return_exceptions=False)
    
    working_streams = [result for result in results if result is not None]

    end_time = time.time()
    
    # 清除进度行并打印最终统计信息
    print("\n" + " " * 80, end="\r") 
    print(f"✅ 流检查完成。原始数量: {total_count}，可用数量: {len(working_streams)}。")
    print(f"总耗时: {end_time - start_time:.2f} 秒")
    
    return working_streams

# --- 核心函数：数据处理 (保持不变) ---

def download_and_merge_sources(china_sources: List[Tuple[str, str]]) -> List[Dict[str, str]]:
    """
    下载主 M3U
    """
    all_streams = []

    print("\n" + "="*50)
    print("--- 步骤 1: 下载和合并 M3U 源 ---")

    # 2. 处理中国专用源
    print(f"\n 正在处理 {len(china_sources)} 个源...")

    for m3u_url, file_type in china_sources:
        try:
            if file_type == "m3u":
                response = requests.get(m3u_url, timeout=TIMEOUT)
                response.raise_for_status()
                content = response.content.decode('utf-8', errors='ignore')
                main_streams = parse_m3u_blocks(content)
            elif file_type == "txt":
                m3u_items = fetch_and_parse_txt(m3u_url)
                if not m3u_items:
                    print("\nCould not parse any valid items. Exiting.")
                    continue
                final_m3u_content = generate_m3u(m3u_items)
                main_streams = parse_m3u_blocks(final_m3u_content)

            all_streams.extend(main_streams)
            
            print(f"  - ✅ 源 {m3u_url} 合并成功。新增流数量: {len(main_streams)}")

        except RequestException as e:
            print(f"  - ❌ 源 {m3u_url} 下载或解析失败，跳过: {e}")

    print(f"\n✅ 所有源合并完成。最终总流数量: {len(all_streams)}")
    print("="*50)
    return all_streams

def classify_undefined_streams(streams: List[Dict[str, str]], country_map: Dict[str, str]) -> List[Dict[str, str]]:
    """
    针对 group-title="Undefined" 的流，进行 IP 地理位置查询和分类。
    """
    streams_to_classify = [s for s in streams if s['group'] == 'Undefined']
    total_to_classify = len(streams_to_classify)

    print(f"\n--- 步骤 3: IP 地理位置分类 (GeoIP) ---")

    if not total_to_classify:
        print("✅ 无需分类：没有 group-title=\"Undefined\" 的频道。跳过 GeoIP 查询。")
        return streams

    print(f"找到 {total_to_classify} 个 'Undefined' 频道需要 GeoIP 查找。")
    print(f"⚠️ 注意: 启用速率限制 ({IP_RATE_LIMIT_DELAY} 秒延迟)。此步骤是串行执行。")

    country_map_keys = set(country_map.keys())

    # 遍历所有流，只处理 Undefined 的流
    for i, stream in enumerate(streams):
        if stream['group'] != 'Undefined':
            continue

        ip_or_domain = extract_ip_from_url(stream['url'])

        # 打印进度
        print(f"[GeoIP Progress] 查找频道: {stream['name'][:30]:<30} | 源: {ip_or_domain}", end="")

        api_country_name = get_geo_info_for_classification(ip_or_domain)

        # 1. 映射到英文分组名
        if api_country_name in country_map_keys:
            new_group_title_english = api_country_name

            # 替换 EXTINF 中的 group-title
            # 使用正则表达式来匹配并替换 group-title="Undefined" 或不存在 group-title 的情况
            group_title_pattern = re.compile(r'group-title="[^"]*"')
            new_tag = f'group-title="{new_group_title_english}"'
            
            if group_title_pattern.search(stream['extinf']):
                 stream['extinf'] = group_title_pattern.sub(new_tag, stream['extinf'])
            else:
                 # 如果没有 group-title 属性，则尝试在 #EXTINF:-1 后添加
                 stream['extinf'] = stream['extinf'].replace('#EXTINF:-1', f'#EXTINF:-1 {new_tag}', 1)

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

async def worker_translate(name: str, index: int, total_count: int, semaphore: asyncio.Semaphore, translator:GoogleTranslator) -> Tuple[str, str]:
    """单个频道名称的翻译工作函数。"""
    await asyncio.sleep(TRANSLATION_DELAY) # 允许事件循环在启动任务时切换
    async with semaphore:
        try:
            # 关键：使用 asyncio.to_thread() 将阻塞的翻译操作推送到单独的线程执行
            # 这样就不会阻塞主事件循环
            translated_text = await asyncio.to_thread(translator.translate, name)
            
            # 由于 to_thread 在线程中执行，我们仍然使用 print_lock 来保护 print
            with print_lock:
                progress_percent = ((index + 1) / total_count) * 100
                # 使用 sys.stdout.write 替代 print(end='\r') 以更好地控制进度显示
                sys.stdout.write(
                    f"\r翻译进度: {index + 1}/{total_count} ({progress_percent:.1f}%) | "
                    f"原始: {name[:20]:<20} -> 翻译: {translated_text[:20]:<20}"
                )
                sys.stdout.flush()
                
            return (name, translated_text)
            
        except Exception as e:
            with print_lock:
                # 打印错误时，需要换行以确保进度行不被覆盖
                sys.stdout.write(f"\n❌ 警告：线程 {index + 1} 翻译失败: {name}. 错误: {e}\n")
                sys.stdout.flush()
            return (name, name) # 失败时返回原始名称
            
async def translate_channels_concurrent(unique_names: List[str]) -> Dict[str, str]:
    """
    使用多线程加速翻译频道名称。
    """
    channel_map = {}
    total_count = len(unique_names)

    semaphore = asyncio.Semaphore(MAX_WORKERS)
    translator = GoogleTranslator(source=SOURCE_LANG, target=TARGET_LANG)      

    print(f"\n--- 步骤 4: 自动翻译频道名称 (TURBO模式 - {total_count}个) ---")
    print(f"🚀 使用 {MAX_WORKERS} 个并发翻译。")

    tasks = []
    for i, name in enumerate(unique_names):
        task = asyncio.create_task(
            worker_translate(
                name,
                i,
                total_count,
                semaphore,
                translator
            )
        )
        tasks.append(task)
    # asyncio.gather 等待所有任务完成
    results = await asyncio.gather(*tasks)    
    for original, translated in results:
        channel_map[original] = translated    

    print("\n" + " " * 80, end="\r") # 清除进度行
    print(f"✅ 频道翻译完成。已成功翻译 {len(channel_map)} 个名称。")
    return channel_map

def build_and_save_final_m3u8(final_streams: List[Dict[str, str]], country_map: Dict[str, str], channel_map: Dict[str, str], output_path: str):
    """
    执行替换（英文分组名 -> 中文分组名，英文频道名 -> 中文频道名）和文件写入操作。
    """
    print(f"\n--- 步骤 5: 构建和保存最终 M3U8 文件 ---")

    country_replace_count = 0
    channel_replace_count = 0

    # 1. 替换 group-title="..." 的函数 (将英文国家名替换为中文名)
    def replace_country_name_func(match):
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
                translated_extinf_group = country_pattern.sub(replace_country_name_func, original_extinf)

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

# --- 主程序入口 ---
async def main():
    start_time = time.time()

    # 关闭 requests 库发出的不必要的 InsecureRequestWarning
    requests.packages.urllib3.disable_warnings()

    # 步骤 0: 检查 FFmpeg 可用性
    check_ffmpeg_availability()
    
    for source, outfile in SOURCE_ALL:
        # 步骤 1: 下载和合并所有源
        all_streams = download_and_merge_sources(source)
        
        if not all_streams:
            print("未能从任何源获取到流数据。 url=", source)
            continue

        # 步骤 2: 流可用性检查 (清理无效流) - 使用 FFmpeg
        working_streams =  await async_check_stream_availability(all_streams)

        if not working_streams:
            print("所有流均不可用或检查失败。 url=", source)
            continue

        # 步骤 3: IP 地理位置分类 (仅针对 group="Undefined")
        # 此步骤仍使用 requests 库访问 GeoIP API
        classified_streams = classify_undefined_streams(working_streams, COUNTRY_MAPPING)

        # 步骤 4: 提取唯一名称并翻译 (并发)
        # 此步骤仍使用 deep_translator 库
        unique_channels = sorted(list(set(s['name'] for s in classified_streams)))
        channel_translation_map = await translate_channels_concurrent(unique_channels)

        # 步骤 5: 构建和保存最终文件
        build_and_save_final_m3u8(classified_streams, COUNTRY_MAPPING, channel_translation_map, outfile)
        
        print("\n" + "="*50)        
        print(f"🎉 **当前任务完成！最终文件（已清理、分类并翻译）: {outfile}**")

    end_time = time.time()        
    print(f"总耗时: {end_time - start_time:.2f} 秒")
    print("="*50)

if __name__ == "__main__":
    asyncio.run(main())    
