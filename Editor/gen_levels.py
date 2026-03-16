
import json
import random
import os

def generate_level(level_index):
    """
    生成单个关卡的地图和卡组数据
    """
    # 颜色池
    all_colors = ["R", "G", "B", "Y", "P", "O", "C", "M", "S"]
    
    # 每 15 关增加一种颜色
    num_colors = min(len(all_colors), (level_index // 15) + 3)
    
    # 随机选择颜色
    colors = all_colors[:num_colors]
    
    # 7x7 地图
    size = 7
    map_data = [["0" for _ in range(size)] for _ in range(size)]
    deck = []
    
    # 简单生成逻辑：随机填充一些块
    for color in colors:
        num_clusters = random.randint(1, 2)
        for _ in range(num_clusters):
            pixels_to_place = random.randint(3, 8)
            actual_placed = 0
            
            # 找到一个起点
            for _ in range(20): # 尝试 20 次
                r, c = random.randint(0, size-1), random.randint(0, size-1)
                if map_data[r][c] == "0":
                    map_data[r][c] = color
                    actual_placed += 1
                    # 尝试在周围扩展
                    curr_r, curr_c = r, c
                    for _ in range(pixels_to_place - 1):
                        neighbors = []
                        for dr, dc in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
                            nr, nc = curr_r + dr, curr_c + dc
                            if 0 <= nr < size and 0 <= nc < size and map_data[nr][nc] == "0":
                                neighbors.append((nr, nc))
                        if neighbors:
                            curr_r, curr_c = random.choice(neighbors)
                            map_data[curr_r][curr_c] = color
                            actual_placed += 1
                        else:
                            break
                    break
            
            if actual_placed > 0:
                deck.append([color, actual_placed])
    
    return {
        "map": map_data,
        "deck": deck
    }

def verify_and_fix_levels(levels):
    """
    检查并修复关卡中的子弹数量与地图块数不一致的问题
    """
    fixed_count = 0
    for i, level in enumerate(levels):
        # 统计地图上的真实颜色块数量
        color_counts = {}
        for row in level["map"]:
            for cell in row:
                if cell != "0":
                    color_counts[cell] = color_counts.get(cell, 0) + 1
        
        # 统计 deck 中的子弹数量
        deck_counts = {}
        for color, ammo in level["deck"]:
            deck_counts[color] = deck_counts.get(color, 0) + ammo
        
        # 检查是否一致
        inconsistent = False
        # 1. 检查 deck 中的颜色是否都在地图上，且数量一致
        # 由于同一个颜色可能分布在多个卡片里，我们直接比较总量
        # 如果总量不等，我们需要重新分配 deck
        
        if color_counts != deck_counts:
            inconsistent = True
        
        if inconsistent:
            # 简单修复逻辑：如果总量不匹配，按照实际统计结果重组 deck
            # 保持原始颜色的相对顺序（如果可能）
            new_deck = []
            seen_colors = []
            for color, _ in level["deck"]:
                if color in color_counts and color not in seen_colors:
                    new_deck.append([color, color_counts[color]])
                    seen_colors.append(color)
            
            # 如果有地图上有但 deck 里漏掉的颜色
            for color, count in color_counts.items():
                if color not in seen_colors:
                    new_deck.append([color, count])
                    seen_colors.append(color)
            
            level["deck"] = new_deck
            fixed_count += 1
            # print(f"Level {i+1}: 修复了子弹数量不一致的问题")
            
    return fixed_count

def format_levels(levels):
    """
    将关卡数据格式化为紧凑的 JS 格式
    """
    lines = []
    lines.append("[")
    for i, level in enumerate(levels):
        lines.append("    {")
        # Map
        lines.append('        "map": [')
        for j, row in enumerate(level["map"]):
            row_str = "            [" + ", ".join(f'"{cell}"' for cell in row) + "]"
            if j < len(level["map"]) - 1:
                row_str += ","
            lines.append(row_str)
        lines.append("        ],")
        # Deck
        deck_items = [f'["{d[0]}", {d[1]}]' for d in level["deck"]]
        lines.append(f'        "deck": [{", ".join(deck_items)}]')
        
        # End of level
        footer = "    }"
        if i < len(levels) - 1:
            footer += ","
        lines.append(footer)
    lines.append("]")
    return "\n".join(lines)

def main():
    # 允许配置生成的关卡总数
    TOTAL_LEVELS = 50
    
    # 手动定义的精品关卡（前 10 关）
    existing_levels = [
        {
            "map": [
                ["R", "R", "R", "0", "B", "B", "B"],
                ["R", "0", "B", "0", "R", "0", "B"],
                ["R", "R", "R", "0", "B", "B", "B"],
                ["0", "0", "0", "0", "0", "0", "0"],
                ["B", "B", "B", "0", "R", "R", "R"],
                ["B", "0", "R", "0", "B", "0", "R"],
                ["B", "B", "B", "0", "R", "R", "R"]
            ],
            "deck": [["R", 8], ["B", 8], ["R", 8], ["B", 8]]
        },
        {
            "map": [
                ["G", "G", "G", "0", "Y", "Y", "Y"],
                ["G", "P", "G", "0", "Y", "P", "Y"],
                ["G", "G", "G", "0", "Y", "Y", "Y"],
                ["0", "0", "0", "0", "0", "0", "0"],
                ["Y", "Y", "Y", "0", "G", "G", "G"],
                ["Y", "P", "Y", "0", "G", "P", "G"],
                ["Y", "Y", "Y", "0", "G", "G", "G"]
            ],
            "deck": [["G", 8], ["Y", 8], ["G", 8], ["Y", 8], ["P", 4]]
        },
        {
            "map": [
                ["R", "0", "0", "B", "0", "0", "G"],
                ["0", "R", "0", "B", "0", "G", "0"],
                ["0", "0", "R", "B", "G", "0", "0"],
                ["P", "P", "P", "Y", "P", "P", "P"],
                ["0", "0", "G", "B", "R", "0", "0"],
                ["0", "G", "0", "B", "0", "R", "0"],
                ["G", "0", "0", "B", "0", "0", "R"]
            ],
            "deck": [["R", 6], ["B", 6], ["G", 6], ["P", 6], ["Y", 1]]
        },
        {
            "map": [
                ["R", "R", "0", "R", "R", "0", "R"],
                ["R", "R", "0", "R", "R", "0", "R"],
                ["0", "0", "0", "0", "0", "0", "0"],
                ["B", "B", "0", "B", "B", "0", "B"],
                ["B", "B", "0", "B", "B", "0", "B"],
                ["0", "0", "0", "0", "0", "0", "0"],
                ["G", "G", "0", "G", "G", "0", "G"]
            ],
            "deck": [["R", 5], ["B", 5], ["R", 5], ["B", 5], ["G", 5]]
        },
        {
            "map": [
                ["R", "R", "R", "R", "R", "R", "R"],
                ["G", "G", "G", "G", "G", "G", "0"],
                ["B", "B", "B", "B", "B", "0", "0"],
                ["Y", "Y", "Y", "Y", "0", "0", "0"],
                ["P", "P", "P", "0", "0", "0", "0"],
                ["R", "R", "0", "0", "0", "0", "0"],
                ["G", "0", "0", "0", "0", "0", "0"]
            ],
            "deck": [["R", 9], ["G", 7], ["B", 5], ["Y", 4], ["P", 3]]
        },
        {
            "map": [
                ["P", "P", "P", "P", "P", "P", "P"],
                ["P", "0", "0", "0", "0", "0", "P"],
                ["P", "0", "R", "R", "R", "0", "P"],
                ["P", "0", "R", "Y", "R", "0", "P"],
                ["P", "0", "R", "R", "R", "0", "P"],
                ["P", "0", "0", "0", "0", "0", "P"],
                ["P", "P", "P", "P", "P", "P", "P"]
            ],
            "deck": [["P", 12], ["P", 12], ["R", 8], ["Y", 1]]
        },
        {
            "map": [
                ["R", "0", "R", "0", "B", "0", "B"],
                ["0", "G", "0", "Y", "0", "P", "0"],
                ["R", "0", "R", "0", "B", "0", "B"],
                ["0", "Y", "0", "G", "0", "Y", "0"],
                ["G", "0", "G", "0", "P", "0", "P"],
                ["0", "P", "0", "R", "0", "B", "0"],
                ["G", "0", "G", "0", "P", "0", "P"]
            ],
            "deck": [["R", 5], ["B", 5], ["G", 6], ["Y", 3], ["P", 6]]
        },
        {
            "map": [
                ["R", "B", "G", "Y", "P", "R", "B"],
                ["R", "B", "G", "Y", "P", "R", "B"],
                ["R", "B", "G", "Y", "P", "R", "B"],
                ["R", "B", "G", "Y", "P", "R", "B"],
                ["R", "B", "G", "Y", "P", "R", "B"],
                ["R", "B", "G", "Y", "P", "R", "B"],
                ["R", "B", "G", "Y", "P", "R", "B"]
            ],
            "deck": [["R", 7], ["B", 7], ["G", 7], ["Y", 7], ["P", 7], ["R", 7], ["B", 7]]
        },
        {
            "map": [
                ["0", "0", "0", "R", "0", "0", "0"],
                ["0", "0", "0", "R", "0", "0", "0"],
                ["0", "0", "0", "R", "0", "0", "0"],
                ["B", "B", "B", "P", "B", "B", "B"],
                ["0", "0", "0", "G", "0", "0", "0"],
                ["0", "0", "0", "G", "0", "0", "0"],
                ["0", "0", "0", "G", "0", "0", "0"]
            ],
            "deck": [["R", 3], ["B", 6], ["G", 3], ["P", 1]]
        },
        {
            "map": [
                ["R", "B", "G", "Y", "P", "R", "B"],
                ["G", "Y", "P", "R", "B", "G", "Y"],
                ["P", "R", "B", "G", "Y", "P", "R"],
                ["B", "G", "Y", "P", "R", "B", "G"],
                ["Y", "P", "R", "B", "G", "Y", "P"],
                ["R", "B", "G", "Y", "P", "R", "B"],
                ["G", "Y", "P", "R", "B", "G", "Y"]
            ],
            "deck": [["R", 5], ["B", 5], ["G", 5], ["Y", 5], ["P", 5], ["R", 5], ["B", 5], ["G", 5], ["Y", 5], ["P", 4]]
        }
    ]

    levels = existing_levels
    num_existing = len(existing_levels)
    
    # 生成剩余关卡
    for i in range(num_existing, TOTAL_LEVELS):
        levels.append(generate_level(i))
    
    # 校验并修复可能的子弹不一致问题
    fixed_count = verify_and_fix_levels(levels)
    if fixed_count > 0:
        print(f"校验完成：自动修复了 {fixed_count} 个关卡的子弹数量不一致问题。")

    # 使用自定义格式化函数生成 JS 内容
    output = "// 自动生成的关卡数据\nwindow.GAME_LEVELS = " + format_levels(levels) + ";"
    
    # 获取脚本所在目录，确保输出到正确位置
    target_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "mapdata.js"))
    
    try:
        with open(target_path, "w", encoding="utf-8") as f:
            f.write(output)
        print(f"成功生成 {TOTAL_LEVELS} 个关卡，已写入: {target_path}")
    except Exception as e:
        print(f"写入文件失败: {e}")


if __name__ == "__main__":
    main()
