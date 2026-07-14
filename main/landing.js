/**
 * Landing 页面背景与书本动画系统
 * - 背景动画统一使用 requestAnimationFrame
 * - 书本动画使用 GSAP，并封装为独立初始化函数
 * - 中文注释，便于维护
 */

// ==================== 全局配置 ====================
// 集中管理背景与书本动画参数
const CONFIG = {
  // 电影颗粒：使用小画布放大，性能更好且带有像素颗粒感
  grain: {
    size: 120, // 离屏画布尺寸
    opacity: 0.05, // CSS 控制透明度
    updateInterval: 2 // 每 2 帧更新一次，降低 CPU 占用
  },

  // 噪点纹理：Canvas 生成，不依赖任何图片
  noise: {
    size: 300, // 噪点单元尺寸
    opacity: 0.04, // 整体透明度
    scrollX: 0.12, // X 轴滚动速度
    scrollY: 0.08 // Y 轴滚动速度
  },

  // 聚光灯：中央柔和灯光，鼠标移动时缓动跟随
  spotlight: {
    radius: 700, // 灯光半径
    easing: 0.035, // 缓动系数，越小跟随越慢越柔和
    opacity: 0.12 // 灯光强度
  },

  // 环境呼吸光：整体亮度缓慢变化，周期约 8 秒
  ambient: {
    period: 8000, // 呼吸周期（毫秒）
    minOpacity: 0.02, // 最暗时的叠加透明度
    maxOpacity: 0.1 // 最亮时的叠加透明度
  },

  // 像素尘埃：漂浮微粒，数量控制在 40 个以内
  dust: {
    count: 200, // 粒子数量
    minSize: 1.5, // 最小尺寸
    maxSize: 5, // 最大尺寸
    maxSpeed: 0.3 // 最大移动速度
  },

  // 书本动画参数
  book: {
    floatY: 18, // 上下漂浮幅度（px）
    floatDuration: 7, // 漂浮周期（秒）
    swing: 1, // 左右摆动角度（deg）
    swingDuration: 6, // 左右摆动周期（秒）
    hoverScale: 1.04, // hover 放大比例
    hoverDuration: 0.6, // hover 过渡时长（秒）
    tiltMaxX: 8, // RotateX 最大角度
    tiltMaxY: 8, // RotateY 最大角度
    tiltZ: 12, // TranslateZ 幅度
    tiltEase: 0.08, // 鼠标跟随缓动系数，越小惯性越大
    resetDuration: 1.2, // 鼠标离开后恢复时长
    perspective: 1200, // CSS 透视距离
    shadow: {
      baseBlur: 6, // 基础模糊
      baseOpacity: 0.8, // 基础透明度
      baseScale: 0.7, // 基础大小
      hoverBlur: 10, // hover 模糊
      hoverOpacity: 0.55, // hover 透明度
      hoverScale: 0.55, // hover 大小
      floatSensitivity: 1.6 // 漂浮对阴影的影响系数
    },
    floatDriftX: 18, // 漂浮时水平漂移范围
    floatDriftY: 10 // 漂浮时垂直漂移范围
  },

  // 像素光标参数
  pixelCursor: {
    size: 16, // 光标尺寸 px
    gap: 2, // 拖尾生成间隔帧
    trailLife: 28, // 拖尾存在帧数
    trailCount: 18, // 单次点击爆炸粒子数
    color: '#a8b9ff', // 默认光标颜色
    hoverColor: '#7ee787', // hover 书本时颜色
    scale: 1, // 默认缩放
    hoverScale: 1.4 // hover 放大
  }
};

// ==================== 运行时状态 ====================
// 所有动态数据集中管理，避免全局变量散落
const state = {
  width: 0,
  height: 0,
  dpr: Math.min(window.devicePixelRatio || 1, 2), // 限制像素比，避免高分屏性能问题
  mouseX: 0,
  mouseY: 0,
  targetX: 0,
  targetY: 0,
  frame: 0,
  dust: [], // 存储所有尘埃粒子
  noiseOffset: { x: 0, y: 0 }, // 噪点纹理滚动偏移
  noiseCanvas: null, // 离屏噪点画布
  noisePattern: null, // 缓存的噪点图案
  grainPattern: null, // 缓存的颗粒图案
  ambientGradient: null, // 预生成的环境光渐变
  // 书本动画相关状态
  book: {
    tiltX: 0,
    tiltY: 0,
    translateZ: 0,
    targetTiltX: 0,
    targetTiltY: 0,
    targetTranslateZ: 0,
    isHovering: false,
    rafId: null,
    floatTween: null,
    swingTween: null,
    isEntering: false
  },
  // 像素光标相关状态
  cursor: {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    isHoveringBook: false,
    scale: 1,
    targetScale: 1,
    trails: [],
    explosions: [],
    frame: 0
  }
};

// ==================== DOM 引用缓存 ====================
// 减少重复查询 DOM 带来的性能损耗
const bgCanvas = document.getElementById('bgCanvas');
const grainCanvas = document.getElementById('grainCanvas');
const noiseCanvas = document.getElementById('noiseCanvas');
const pixelCursorCanvas = document.getElementById('pixelCursorCanvas');
const bookEl = document.getElementById('bookImage');
const bookWrapper = bookEl ? bookEl.closest('.book-wrapper') : null;
const bookShadow = bookWrapper ? bookWrapper.querySelector('.book-shadow') : null;
const bookBloom = bookWrapper ? bookWrapper.querySelector('.book-bloom') : null;
const landingEl = document.querySelector('.landing');
const bgCtx = bgCanvas.getContext('2d');
const grainCtx = grainCanvas.getContext('2d');
const noiseCtx = noiseCanvas.getContext('2d');
const cursorCtx = pixelCursorCanvas ? pixelCursorCanvas.getContext('2d') : null;

/**
 * 统一设置所有画布的尺寸与像素比
 * 使用 setTransform 避免 scale 叠加导致的变形
 */
function resizeCanvases() {
  state.width = window.innerWidth;
  state.height = window.innerHeight;
  const dpr = state.dpr;

  [bgCanvas, grainCanvas, noiseCanvas, pixelCursorCanvas].forEach((canvas) => {
    canvas.width = state.width * dpr;
    canvas.height = state.height * dpr;
    canvas.style.width = state.width + 'px';
    canvas.style.height = state.height + 'px';
  });

  // 重置画布变换矩阵并应用像素比缩放
  bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  grainCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  noiseCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (cursorCtx) {
    cursorCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // 初始鼠标位置设于屏幕中央，让聚光灯默认居中
  state.mouseX = state.targetX = state.width / 2;
  state.mouseY = state.targetY = state.height / 2;

  // 窗口尺寸变化后重新生成噪点纹理并缓存
  generateNoiseTexture();

  // 重新初始化所有动画模块，确保渐变等尺寸适配新窗口
  updateNoise = createNoise();
  updateGrain = createGrain();
  updateSpotlight = createSpotlight();
  updateDust = createDust();
  updateAmbient = createAmbientLight();
}

/**
 * 生成静态噪点纹理并缓存为 Pattern
 * 纯 Canvas 生成，不依赖任何外部图片
 */
function generateNoiseTexture() {
  const size = CONFIG.noise.size;
  const offCanvas = document.createElement('canvas');
  offCanvas.width = size;
  offCanvas.height = size;
  const ctx = offCanvas.getContext('2d');
  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;

  // 逐像素填充随机灰度，透明度极低以保持柔和
  for (let i = 0; i < data.length; i += 4) {
    const v = Math.random() * 255;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 18;
  }

  ctx.putImageData(imageData, 0, 0);
  state.noiseCanvas = offCanvas;
  state.noisePattern = noiseCtx.createPattern(offCanvas, 'repeat');
}

/**
 * 创建噪点纹理动画
 * 使用离屏 Canvas 生成，通过 Pattern 平铺并缓慢滚动
 */
function createNoise() {
  const { size, opacity, scrollX, scrollY } = CONFIG.noise;
  const pattern = state.noisePattern;

  return function updateNoise() {
    if (!pattern) return;

    // 缓慢更新滚动偏移，制造纹理流动感
    state.noiseOffset.x += scrollX;
    state.noiseOffset.y += scrollY;

    noiseCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    noiseCtx.clearRect(0, 0, state.width, state.height);
    noiseCtx.globalAlpha = opacity;

    // 使用矩阵变换实现无缝平铺滚动
    const matrix = new DOMMatrix();
    matrix.translateSelf(state.noiseOffset.x % size, state.noiseOffset.y % size);
    pattern.setTransform(matrix);

    noiseCtx.fillStyle = pattern;
    noiseCtx.fillRect(0, 0, state.width, state.height);
  };
}

/**
 * 创建电影颗粒效果
 * 小画布生成随机噪点，通过 CSS 放大并保持 5% 透明度
 * 持续缓慢变化，每 N 帧更新一次以节省性能
 */
function createGrain() {
  const { size, updateInterval } = CONFIG.grain;
  // 离屏画布用于生成颗粒纹理
  const offCanvas = document.createElement('canvas');
  offCanvas.width = size;
  offCanvas.height = size;
  const ctx = offCanvas.getContext('2d');
  const imageData = ctx.createImageData(size, size);
  // 预分配缓冲区，避免循环内频繁创建
  const buffer = new Uint8ClampedArray(imageData.data);

  // 缓存图案对象
  state.grainPattern = grainCtx.createPattern(offCanvas, 'repeat');

  return function updateGrain() {
    // 按间隔更新，降低 CPU 占用，视觉上仍足够动态
    if (state.frame % updateInterval !== 0) return;

    // 重新生成随机颗粒
    for (let i = 0; i < buffer.length; i += 4) {
      const v = Math.random() * 255;
      buffer[i] = v;
      buffer[i + 1] = v;
      buffer[i + 2] = v;
      buffer[i + 3] = 255;
    }

    imageData.data.set(buffer);
    ctx.putImageData(imageData, 0, 0);

    // 更新缓存的图案
    state.grainPattern = grainCtx.createPattern(offCanvas, 'repeat');

    grainCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    grainCtx.clearRect(0, 0, state.width, state.height);
    grainCtx.fillStyle = state.grainPattern;
    grainCtx.fillRect(0, 0, state.width, state.height);
  };
}

/**
 * 创建聚光灯效果
 * 页面中央默认有一盏柔和灯光，鼠标移动时缓慢跟随
 * 使用缓动算法让运动更自然
 */
function createSpotlight() {
  const { radius, easing, opacity } = CONFIG.spotlight;

  // 预创建径向渐变，后续仅需改变 globalAlpha 即可
  state.spotlightGradient = bgCtx.createRadialGradient(
    state.width / 2,
    state.height / 2,
    0,
    state.width / 2,
    state.height / 2,
    radius
  );
  state.spotlightGradient.addColorStop(0, 'rgba(180, 200, 255, 0.6)');
  state.spotlightGradient.addColorStop(0.4, 'rgba(140, 160, 220, 0.3)');
  state.spotlightGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

  return function updateSpotlight() {
    // 缓动公式：当前位置逐步接近目标位置
    state.mouseX += (state.targetX - state.mouseX) * easing;
    state.mouseY += (state.targetY - state.mouseY) * easing;

    // 移动渐变中心到当前缓动位置
    bgCtx.globalCompositeOperation = 'screen';
    bgCtx.globalAlpha = opacity;
    bgCtx.fillStyle = state.spotlightGradient;
    bgCtx.fillRect(0, 0, state.width, state.height);
    bgCtx.globalCompositeOperation = 'source-over';
  };
}

/**
 * 创建像素尘埃
 * 背景中漂浮极少量微粒，速度很慢，数量不超过 40 个
 */
function createDust() {
  const { count, minSize, maxSize, maxSpeed } = CONFIG.dust;
  const particles = [];

  // 初始化粒子位置与速度
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * state.width,
      y: Math.random() * state.height,
      size: minSize + Math.random() * (maxSize - minSize),
      vx: (Math.random() - 0.5) * maxSpeed,
      vy: (Math.random() - 0.5) * maxSpeed,
      alpha: 0.15 + Math.random() * 0.35
    });
  }

  return function updateDust() {
    bgCtx.globalCompositeOperation = 'screen';

    particles.forEach((p) => {
      // 缓慢移动
      p.x += p.vx;
      p.y += p.vy;

      // 超出边界后从对面出现，保持粒子总数不变
      if (p.x < -10) p.x = state.width + 10;
      if (p.x > state.width + 10) p.x = -10;
      if (p.y < -10) p.y = state.height + 10;
      if (p.y > state.height + 10) p.y = -10;

      // 绘制微小像素点
      bgCtx.globalAlpha = p.alpha;
      bgCtx.fillStyle = '#a0b0ff';
      bgCtx.fillRect(p.x, p.y, p.size, p.size);
    });

    bgCtx.globalCompositeOperation = 'source-over';
  };
}

/**
 * 创建环境呼吸光
 * 背景整体亮度缓慢呼吸，周期约 8 秒
 * 使用正弦波实现平滑过渡
 */
function createAmbientLight() {
  const { period, minOpacity, maxOpacity } = CONFIG.ambient;

  // 预创建全屏径向渐变，避免每帧重复创建
  const cx = state.width / 2;
  const cy = state.height / 2;
  const r = Math.max(state.width, state.height) * 0.8;

  state.ambientGradient = bgCtx.createRadialGradient(cx, cy, 0, cx, cy, r);
  state.ambientGradient.addColorStop(0, 'rgba(100, 120, 200, 0.25)');
  state.ambientGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

  return function updateAmbient(timestamp) {
    // 根据时间戳计算呼吸相位，确保周期稳定在 8 秒左右
    const phase = ((timestamp || 0) % period) / period;
    const t = phase * Math.PI * 2;
    // 使用 sin 曲线，从中间值开始变化，避免突变
    const value = (Math.sin(t - Math.PI / 2) + 1) / 2;

    const opacity = minOpacity + (maxOpacity - minOpacity) * value;

    bgCtx.globalCompositeOperation = 'screen';
    bgCtx.globalAlpha = opacity;
    bgCtx.fillStyle = state.ambientGradient;
    bgCtx.fillRect(0, 0, state.width, state.height);
    bgCtx.globalCompositeOperation = 'source-over';
  };
}

// ==================== 主循环调度 ====================
// 各模块的更新函数引用，由 initBackground 初始化
let updateNoise, updateGrain, updateSpotlight, updateDust, updateAmbient;

/**
 * 主动画循环
 * 统一在 requestAnimationFrame 中调度，确保流畅且易控帧
 */
function loop(timestamp) {
  state.frame++;

  // 清空主画布
  bgCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  bgCtx.clearRect(0, 0, state.width, state.height);

  // 按顺序绘制各层效果
  updateAmbient(timestamp);
  updateSpotlight();
  updateDust();

  // 噪点与颗粒在独立画布上更新，避免干扰主画布
  updateNoise();
  updateGrain();

  requestAnimationFrame(loop);
}

/**
 * 初始化背景动画系统
 * 绑定事件、创建各效果模块并启动主循环
 */
function initBackground() {
  resizeCanvases();

  // 初始化所有背景动画模块
  updateNoise = createNoise();
  updateGrain = createGrain();
  updateSpotlight = createSpotlight();
  updateDust = createDust();
  updateAmbient = createAmbientLight();

  // 监听鼠标移动，更新聚光灯目标位置
  window.addEventListener('mousemove', (e) => {
    state.targetX = e.clientX;
    state.targetY = e.clientY;
  });

  // 移动端触摸支持
  window.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
      state.targetX = e.touches[0].clientX;
      state.targetY = e.touches[0].clientY;
    }
  }, { passive: true });

  // 窗口尺寸变化时重置画布
  window.addEventListener('resize', resizeCanvases);

  // 启动动画循环
  requestAnimationFrame(loop);
}

// ==================== 书本动画系统 ====================

/**
 * 封装书本真实感效果：
 * - 动态阴影随漂浮位置变化
 * - 封面 Reflection 缓慢漂移
 * - Hover 时反射与环境光联动
 */
class BookEffectManager {
  constructor({ el, wrapper, shadow, config }) {
    this.el = el;
    this.wrapper = wrapper;
    this.shadow = shadow;
    this.config = config;

    this.floatY = config.floatY;
    this.baseBlur = config.shadow.baseBlur;
    this.baseOpacity = config.shadow.baseOpacity;
    this.baseScale = config.shadow.baseScale;
    this.hoverBlur = config.shadow.hoverBlur;
    this.hoverOpacity = config.shadow.hoverOpacity;
    this.hoverScale = config.shadow.hoverScale;
    this.floatSensitivity = config.shadow.floatSensitivity;

    this.floatDriftX = config.floatDriftX;
    this.floatDriftY = config.floatDriftY;

    this.isHovering = false;
    this.progress = 0;
    this.floatProgress = 0;

    this.applyShadowBase();
  }

  setHover(isHovering) {
    this.isHovering = isHovering;
  }

  updateFloat(progress, phaseOffset = 0) {
    this.floatProgress = progress + phaseOffset;
    const normalized = Math.sin(this.floatProgress);

    if (this.isHovering) {
      this.progress += (1 - this.progress) * 0.08;
    } else {
      this.progress += (0 - this.progress) * 0.08;
    }

    const shadowBlur = this.baseBlur + (this.hoverBlur - this.baseBlur) * this.progress;
    const shadowOpacity = this.baseOpacity + (this.hoverOpacity - this.baseOpacity) * this.progress;
    const shadowScale = this.baseScale + (this.hoverScale - this.baseScale) * this.progress;

    const floatImpact = normalized * this.floatSensitivity;
    const finalBlur = Math.max(1, shadowBlur + floatImpact * 0.7);
    const finalOpacity = Math.min(1, Math.max(0, shadowOpacity - normalized * 0.2));
    const finalScale = Math.max(0.2, shadowScale + normalized * 0.04);

    if (this.wrapper) {
      gsap.set(this.wrapper, {
        x: normalized * this.floatDriftX,
        y: 60 + normalized * this.floatDriftY,
        overwrite: 'auto'
      });
    }

    this.applyShadow(finalBlur, finalOpacity, finalScale);
  }

  applyShadowBase() {
    if (!this.shadow) return;
    gsap.set(this.shadow, {
      width: `${this.baseScale * 100}%`,
      opacity: this.baseOpacity,
      filter: `blur(${this.baseBlur}px)`,
      x: '-50%'
    });
  }

  applyShadow(blur, opacity, scale) {
    if (!this.shadow) return;
    gsap.to(this.shadow, {
      width: `${scale * 100}%`,
      opacity,
      filter: `blur(${blur}px)`,
      x: '-50%',
      duration: 0.35,
      ease: 'power2.out',
      overwrite: 'auto'
    });
  }
}

/**
 * 初始化书本动画总入口
 * 按顺序初始化漂浮、Hover、倾斜效果
 */
function initBook() {
  if (!bookEl || !bookWrapper) return;

  // 先确保书本回到默认状态，避免多个初始化叠加
  gsap.set(bookEl, { clearProps: 'all' });
  bookWrapper.classList.remove('is-hovered');

  initBookAnimation();
  initBookHover();
  initBookTilt();
}

/**
 * 书本上下漂浮 + 左右轻微摆动
 * - Y 轴：±18px，周期 7 秒，Sine.inOut，无限循环
 * - Rotation：±1°，周期 6 秒，Sine.inOut，无限循环
 */
function initBookAnimation() {
  if (!bookEl) return;

  const effectManager = new BookEffectManager({
    el: bookEl,
    wrapper: bookWrapper,
    shadow: bookShadow,
    config: CONFIG.book
  });

  state.book.effectManager = effectManager;

  const floatProxy = { value: 0 };

  // 上下漂浮动画
  state.book.floatTween = gsap.to(floatProxy, {
    value: 1,
    duration: CONFIG.book.floatDuration / 2,
    ease: 'sine.inOut',
    repeat: -1,
    yoyo: true,
    onUpdate() {
      const normalized = floatProxy.value * 2 - 1;
      effectManager.updateFloat(normalized);
    }
  });

  // 左右轻微摆动动画
  state.book.swingTween = gsap.to(bookEl, {
    rotation: CONFIG.book.swing,
    duration: CONFIG.book.swingDuration,
    ease: 'sine.inOut',
    repeat: -1,
    yoyo: true
  });
}

/**
 * 书本 Hover 效果
 * 鼠标靠近时：放大、增强阴影、增加 Glow
 */
function initBookHover() {
  if (!bookEl || !bookWrapper) return;

  // 鼠标移入：放大并增强视觉反馈
  bookWrapper.addEventListener('mouseenter', () => {
    state.book.isHovering = true;
    bookWrapper.classList.add('is-hovered');

    gsap.to(bookEl, {
      scale: CONFIG.book.hoverScale,
      duration: CONFIG.book.hoverDuration,
      ease: 'power2.out'
    });
  });

  // 鼠标移出：缓慢恢复
  bookWrapper.addEventListener('mouseleave', () => {
    state.book.isHovering = false;
    bookWrapper.classList.remove('is-hovered');

    gsap.to(bookEl, {
      scale: 1,
      duration: CONFIG.book.hoverDuration,
      ease: 'power2.inOut'
    });

    // 鼠标离开后，倾斜角度也缓慢归零
    gsap.to(state.book, {
      targetTiltX: 0,
      targetTiltY: 0,
      targetTranslateZ: 0,
      duration: CONFIG.book.resetDuration,
      ease: 'power2.out',
      onUpdate: applyTilt
    });
  });
}

/**
 * 书本跟随鼠标倾斜
 * 根据鼠标位置计算 RotateX、RotateY、TranslateZ
 * 使用缓动模拟真实重量惯性，不能直接跟随
 */
function initBookTilt() {
  if (!bookEl || !bookWrapper) return;

  // 监听鼠标在书本区域内的移动
  bookWrapper.addEventListener('mousemove', (e) => {
    if (!state.book.isHovering) return;

    const rect = bookWrapper.getBoundingClientRect();
    // 计算鼠标相对书本中心的归一化位置 [-1, 1]
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;

    // 根据鼠标位置设置目标倾斜角度
    state.book.targetTiltX = -y * CONFIG.book.tiltMaxX;
    state.book.targetTiltY = x * CONFIG.book.tiltY;
    state.book.targetTranslateZ = CONFIG.book.tiltZ;
  });

  // 使用 GSAP ticker 持续平滑更新倾斜，带来惯性手感
  gsap.ticker.add(() => {
    if (!state.book.isHovering) return;

    // 缓动公式：当前值逐步接近目标值，形成惯性延迟
    state.book.tiltX += (state.book.targetTiltX - state.book.tiltX) * CONFIG.book.tiltEase;
    state.book.tiltY += (state.book.targetTiltY - state.book.tiltY) * CONFIG.book.tiltEase;
    state.book.translateZ += (state.book.targetTranslateZ - state.book.translateZ) * CONFIG.book.tiltEase;

    applyTilt();
  });
}

/**
 * 将当前倾斜状态应用到书本元素
 * 统一设置 3D 变换属性，避免分散修改
 */
function applyTilt() {
  if (!bookEl) return;

  gsap.set(bookEl, {
    rotateX: state.book.tiltX,
    rotateY: state.book.tiltY,
    z: state.book.translateZ,
    transformPerspective: CONFIG.book.perspective,
    overwrite: 'auto'
  });
}

function enterPortfolio() {
  if (state.book.isEntering) return;
  state.book.isEntering = true;

  const timeline = gsap.timeline({
    onComplete() {
      window.location.href = 'home.html';
    }
  });

  timeline
    .add(() => {
      if (state.book.floatTween) state.book.floatTween.pause();
      if (state.book.swingTween) state.book.swingTween.pause();
      if (state.book.tiltTicker) gsap.ticker.remove(state.book.tiltTicker);
    })
    .to(bookEl, {
      scale: 1.35,
      duration: 0.9,
      ease: 'power2.inOut'
    }, 0)
    .to(bookEl, {
      rotateY: 95,
      duration: 1.0,
      ease: 'power2.inOut'
    }, 0.05)
    .to(bookBloom, {
      opacity: 1,
      duration: 0.55,
      ease: 'power2.out'
    }, 0.4)
    .to(landingEl, {
      opacity: 0,
      duration: 0.75,
      ease: 'power2.inOut'
    }, 0.85);
}

// ==================== 像素光标系统 ====================

class PixelCursor {
  constructor() {
    this.particles = [];
    this.explosions = [];
    this.mouseX = 0;
    this.mouseY = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.isHoveringBook = false;
    this.cursorSize = CONFIG.pixelCursor.size;
    this.cursorColor = CONFIG.pixelCursor.color;
    this.cursorScale = CONFIG.pixelCursor.scale;
    this.targetScale = CONFIG.pixelCursor.scale;
    this.frameCount = 0;
    this.trailGap = CONFIG.pixelCursor.gap;
    this.trailLife = CONFIG.pixelCursor.trailLife;
    this.trailCount = CONFIG.pixelCursor.trailCount;
  }

  setMousePosition(x, y) {
    this.targetX = x;
    this.targetY = y;
  }

  setHoverBook(isHovering) {
    this.isHoveringBook = isHovering;
    this.targetScale = isHovering ? CONFIG.pixelCursor.hoverScale : CONFIG.pixelCursor.scale;
  }

  createTrail() {
    const dx = this.targetX - this.mouseX;
    const dy = this.targetY - this.mouseY;
    const speed = Math.sqrt(dx * dx + dy * dy);

    if (speed > 1.5) {
      this.particles.push({
        x: this.mouseX,
        y: this.mouseY,
        size: this.cursorSize * 0.55,
        alpha: 0.75,
        life: this.trailLife,
        maxLife: this.trailLife,
        color: this.cursorColor
      });
    }
  }

  createExplosion(x, y) {
    for (let i = 0; i < this.trailCount; i++) {
      const angle = (Math.PI * 2 * i) / this.trailCount + Math.random() * 0.6;
      const speed = 2 + Math.random() * 4.5;
      this.explosions.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: this.cursorSize * (0.4 + Math.random() * 0.9),
        alpha: 1,
        life: 28 + Math.random() * 24,
        maxLife: 52,
        color: this.cursorColor
      });
    }
  }

  update() {
    this.mouseX += (this.targetX - this.mouseX) * 0.35;
    this.mouseY += (this.targetY - this.mouseY) * 0.35;
    this.cursorScale += (this.targetScale - this.cursorScale) * 0.15;
    this.cursorColor = this.isHoveringBook ? CONFIG.pixelCursor.hoverColor : CONFIG.pixelCursor.color;

    this.frameCount++;
    if (this.frameCount % this.trailGap === 0) {
      this.createTrail();
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life--;
      p.alpha = Math.max(0, (p.life / p.maxLife) * 0.55);
      p.size *= 0.94;

      if (p.life <= 0 || p.alpha <= 0.01) {
        this.particles.splice(i, 1);
      }
    }

    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const p = this.explosions[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.955;
      p.vy *= 0.955;
      p.life--;
      p.alpha = Math.max(0, p.life / p.maxLife);
      p.size *= 0.965;

      if (p.life <= 0 || p.alpha <= 0.01) {
        this.explosions.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    ctx.clearRect(0, 0, state.width, state.height);

    this.particles.forEach(p => {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
    });

    this.explosions.forEach(p => {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
    });

    const size = this.cursorSize * this.cursorScale;
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.cursorColor;
    ctx.beginPath();
    ctx.arc(this.mouseX, this.mouseY, size / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.arc(this.mouseX, this.mouseY, size / 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function initPixelCursor() {
  if (!pixelCursorCanvas || !cursorCtx) return;

  const cursor = new PixelCursor();
  state.cursor.manager = cursor;
  state.cursor.x = state.width / 2;
  state.cursor.y = state.height / 2;
  cursor.setMousePosition(state.cursor.x, state.cursor.y);

  pixelCursorCanvas.width = state.width * state.dpr;
  pixelCursorCanvas.height = state.height * state.dpr;
  pixelCursorCanvas.style.width = state.width + 'px';
  pixelCursorCanvas.style.height = state.height + 'px';
  cursorCtx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

  document.addEventListener('mousemove', (e) => {
    state.cursor.x = e.clientX;
    state.cursor.y = e.clientY;
    cursor.setMousePosition(e.clientX, e.clientY);
  });

  document.addEventListener('click', (e) => {
    cursor.createExplosion(e.clientX, e.clientY);
  });

  if (bookWrapper) {
    bookWrapper.addEventListener('mouseenter', () => {
      state.book.isHovering = true;
      cursor.setHoverBook(true);
    });

    bookWrapper.addEventListener('mouseleave', () => {
      state.book.isHovering = false;
      cursor.setHoverBook(false);
    });

    bookWrapper.addEventListener('click', () => {
      enterPortfolio();
    });
  }

  function loopCursor() {
    state.cursor.frame++;
    cursor.update();
    cursor.draw(cursorCtx);
    requestAnimationFrame(loopCursor);
  }

  requestAnimationFrame(loopCursor);
}

// ==================== 页面初始化 ====================
// 页面加载完成后启动背景系统与书本动画
document.addEventListener('DOMContentLoaded', () => {
  initBackground();
  initBook();
  initPixelCursor();
});
