# -*- coding: utf-8 -*-
"""
生成 PC Dynamic Island 应用图标（黑色圆角方形 + 青→品红霓虹描边 + 中央胶囊 + 音频波形）

输出：
  build/icon.png    512x512 预览 / 源图
  build/icon.ico    多尺寸（16~256）Windows 应用图标
"""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import os

S = 512
BG = (11, 11, 13)
DARK = (15, 15, 20)
CYAN = (34, 211, 238)
PINK = (232, 121, 249)
VIOLET = (167, 139, 250)


def diag_gradient(size, c1, c2):
    """对角线性渐变画布（左上 c1 -> 右下 c2）"""
    w, h = size
    y = np.linspace(0, 1, h)[:, None]
    x = np.linspace(0, 1, w)[None, :]
    t = np.clip((x + y) / 2, 0, 1)
    grad = np.zeros((h, w, 3), dtype=np.float32)
    for i in range(3):
        grad[..., i] = c1[i] * (1 - t) + c2[i] * t
    return grad


def rounded_mask(size, radius):
    mask = Image.new('L', size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius=radius, fill=255)
    return mask


def neon_ring(size, radius, thickness, c1, c2):
    """圆角霓虹渐变描边环（RGBA 图层）"""
    grad = diag_gradient(size, c1, c2)
    outer = rounded_mask(size, radius)
    inner = rounded_mask(size, max(1, radius - thickness))
    ring = np.zeros((size[1], size[0], 4), dtype=np.float32)
    ring[..., :3] = grad
    ring[..., 3] = np.clip(np.asarray(outer) - np.asarray(inner), 0, 255).astype(np.float32)
    return Image.fromarray(np.uint8(ring), 'RGBA')


def rounded_rect_filled(size, radius, fill):
    img = Image.new('RGBA', size, (0, 0, 0, 0))
    ImageDraw.Draw(img).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius=radius, fill=fill)
    return img


def blend_additive(base, layer, ox, oy):
    """把 layer 以「加色发光」方式叠加到 base（带偏移），产生真正的霓虹光晕"""
    b = np.asarray(base).copy().astype(np.float32)
    l = np.asarray(layer).astype(np.float32)
    a = l[..., 3:4] / 255.0
    rgb = l[..., :3] * a  # 预乘 alpha
    bh, bw = b.shape[:2]
    lh, lw = l.shape[:2]
    x0, y0 = max(0, ox), max(0, oy)
    x1, y1 = min(bw, ox + lw), min(bh, oy + lh)
    if x1 <= x0 or y1 <= y0:
        return base
    src = rgb[y0 - oy:y1 - oy, x0 - ox:x1 - ox, :]
    b[y0:y1, x0:x1, :3] = np.minimum(255, b[y0:y1, x0:x1, :3] + src)
    return Image.fromarray(np.uint8(b), 'RGBA')


def glow_layer(ring, blur_radius, strength):
    """由描边环生成强光晕：高斯模糊 + 提高 alpha 与颜色亮度"""
    g = ring.filter(ImageFilter.GaussianBlur(blur_radius))
    arr = np.asarray(g).astype(np.float32)
    arr[..., 3] = np.clip(arr[..., 3] * strength, 0, 255)
    a = arr[..., 3:4] / 255.0
    arr[..., :3] = np.clip(arr[..., :3] * (0.7 + 0.6 * a), 0, 255)
    return Image.fromarray(np.uint8(arr), 'RGBA')


def main():
    # 纯黑底
    base = Image.new('RGBA', (S, S), (*BG, 255))

    # ---- 1. 外框：青→品红霓虹描边 + 柔和光晕 ----
    fx, fy = 26, 26
    frame = neon_ring((S - 52, S - 52), 56, 18, CYAN, PINK)
    base = blend_additive(base, glow_layer(frame, 22, 2.6), fx, fy)   # 大范围柔光
    base = blend_additive(base, frame, fx, fy)                        # 清晰描边（加色更亮）
    # 内部深色填充（盖住中间，形成边框）
    inner = rounded_rect_filled((S - 52 - 38, S - 52 - 38), 44, DARK)
    base.alpha_composite(inner, (fx + 19, fy + 19))

    # ---- 2. 中央胶囊：深色内部 + 青→粉霓虹描边 + 光晕 ----
    cap_w, cap_h, cap_r = 300, 116, 58
    cap_x, cap_y = (S - cap_w) // 2, (S - cap_h) // 2 - 6
    cap_ring = neon_ring((cap_w, cap_h), cap_r, 9, CYAN, PINK)
    base = blend_additive(base, glow_layer(cap_ring, 14, 2.2), cap_x, cap_y)
    base = blend_additive(base, cap_ring, cap_x, cap_y)
    cap_inner = rounded_rect_filled((cap_w - 18, cap_h - 18), cap_r - 9, (9, 9, 12, 255))
    base.alpha_composite(cap_inner, (cap_x + 9, cap_y + 9))

    # ---- 3. 左侧青色发光圆钮 ----
    knob_d = 48
    knob_cx, knob_cy = cap_x + 66, cap_y + cap_h // 2
    knob = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(knob).ellipse(
        [knob_cx - knob_d // 2, knob_cy - knob_d // 2, knob_cx + knob_d // 2, knob_cy + knob_d // 2],
        fill=(*CYAN, 255))
    base = blend_additive(base, glow_layer(knob, 18, 2.5), 0, 0)
    base = blend_additive(base, knob, 0, 0)

    # ---- 4. 右侧音频波形（青/粉交替竖条，带光晕） ----
    bar_w, bar_gap = 12, 8
    heights = [40, 66, 48, 74, 44]
    colors = [CYAN, PINK, CYAN, PINK, CYAN]
    start_x = cap_x + cap_w - 122
    base_y = cap_y + cap_h // 2
    wave = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    dw = ImageDraw.Draw(wave)
    for i, (h, c) in enumerate(zip(heights, colors)):
        x0 = start_x + i * (bar_w + bar_gap)
        x1 = x0 + bar_w
        y0, y1 = base_y - h // 2, base_y + h // 2
        dw.rounded_rectangle([x0, y0, x1, y1], radius=bar_w // 2, fill=(*c, 255))
    base = blend_additive(base, glow_layer(wave, 12, 2.2), 0, 0)
    base = blend_additive(base, wave, 0, 0)

    # ---- 输出 ----
    os.makedirs('build', exist_ok=True)
    png_path = 'build/icon.png'
    ico_path = 'build/icon.ico'
    base.convert('RGB').save(png_path, 'PNG')
    base.save(ico_path, 'ICO', sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print(f'OK -> {png_path}, {ico_path}')


if __name__ == '__main__':
    main()
