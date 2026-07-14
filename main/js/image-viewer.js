/**
 * 图片预览器功能 - Image Viewer
 * 纯原生 JavaScript 实现，支持滚轮缩放、拖拽、复原等功能
 */

(function() {
    'use strict';

    // ========== 配置常量 ==========
    const CONFIG = {
        MIN_SCALE: 1,           // 最小缩放
        MAX_SCALE: 25,          // 最大缩放
        ZOOM_FACTOR: 0.1,      // 每次滚轮缩放的比例
        ANIMATION_DURATION: 300 // 淡入淡出动画时长(ms)
    };

    // ========== 状态变量 ==========
    let state = {
        scale: 1,              // 当前缩放值
        translateX: 0,         // X轴偏移
        translateY: 0,         // Y轴偏移
        isDragging: false,     // 是否正在拖拽
        hasDragged: false,     // 本次指针操作是否已发生拖拽
        startX: 0,             // 拖拽起始X
        startY: 0,             // 拖拽起始Y
        lastTranslateX: 0,     // 上一次X偏移
        lastTranslateY: 0,     // 上一次Y偏移
        currentImage: null,    // 当前图片元素
        modal: null,           // Modal元素
        container: null,       // 容器元素
        originalOverflow: ''   // 原始overflow值
    };

    // ========== 初始化图片预览功能 ==========
    function initImageViewer() {
        // 使用事件委托处理动态生成的元素
        document.addEventListener('click', handleViewerClick, { once: false });
    }

    // ========== 处理预览器点击事件 ==========
    function handleViewerClick(e) {
        const btn = e.target.closest('.view-details-btn');
        const previewImg = e.target.closest('.details-preview');

        if (btn) {
            e.preventDefault();
            e.stopPropagation();

            // 优先使用 data-src 属性
            let src = btn.getAttribute('data-src');

            // 如果没有 data-src，从相邻的 preview 图片获取
            if (!src) {
                const preview = btn.closest('.details-item-upload, .details-item-wrapper')?.querySelector('.details-preview');
                if (preview && preview.src) {
                    src = preview.src;
                }
            }

            if (src) {
                openViewer(src);
            }
        } else if (previewImg) {
            // 点击详情预览图片也可以打开
            e.preventDefault();
            e.stopPropagation();
            if (previewImg.src) {
                openViewer(previewImg.src);
            }
        }
    }

    // ========== 打开预览器 ==========
    function openViewer(imageSrc) {
        // 保存原始overflow状态
        state.originalOverflow = document.body.style.overflow;
        
        // 禁用页面滚动
        document.body.style.overflow = 'hidden';

        // 创建Modal
        createModal(imageSrc);
        
        // 显示Modal（触发淡入动画）
        requestAnimationFrame(() => {
            state.modal.classList.add('iv-open');
        });

        // 绑定ESC键监听
        bindEscKey();
    }

    // ========== 创建Modal结构 ==========
    function createModal(imageSrc) {
        // 创建Modal容器
        state.modal = document.createElement('div');
        state.modal.className = 'iv-modal';
        
        // 创建图片容器
        state.container = document.createElement('div');
        state.container.className = 'iv-container iv-no-drag';
        
        // 创建图片元素
        state.currentImage = document.createElement('img');
        state.currentImage.className = 'iv-image';
        state.currentImage.src = imageSrc;
        state.currentImage.alt = 'Preview Image';
        state.currentImage.draggable = false;
        state.currentImage.style.pointerEvents = 'auto';
        
        // 防止点击图片时冒泡到 modal 导致关闭
        state.currentImage.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // 创建加载指示器
        const loading = document.createElement('div');
        loading.className = 'iv-loading';
        
        // 创建复原按钮
        const resetBtn = document.createElement('button');
        resetBtn.className = 'iv-reset-btn';
        resetBtn.textContent = '复原';
        resetBtn.addEventListener('click', resetView);

        // 组装DOM结构
        state.container.appendChild(state.currentImage);
        state.modal.appendChild(loading);
        state.modal.appendChild(state.container);
        state.modal.appendChild(resetBtn);
        document.body.appendChild(state.modal);

        // 图片加载完成后移除loading
        state.currentImage.onload = () => {
            loading.remove();
        };

        // 绑定事件
        bindEvents();
    }

    // ========== 绑定事件 ==========
    function bindEvents() {
        // 滚轮缩放事件
        state.modal.addEventListener('wheel', handleWheel, { passive: false });
        
        // 鼠标拖拽事件（使用PointerEvent）
        state.container.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('pointermove', handlePointerMove);
        document.addEventListener('pointerup', handlePointerUp);
        
        // 点击背景关闭
        state.modal.addEventListener('click', handleModalClick);
        
        // 触摸事件支持
        state.modal.addEventListener('touchstart', handleTouchStart, { passive: true });
        state.modal.addEventListener('touchmove', handleTouchMove, { passive: false });
        state.modal.addEventListener('touchend', handleTouchEnd);
    }

    // ========== 滚轮缩放处理 ==========
    function handleWheel(e) {
        e.preventDefault();
        e.stopPropagation();

        // 获取鼠标在容器中的相对位置
        const rect = state.container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left - rect.width / 2;
        const mouseY = e.clientY - rect.top - rect.height / 2;

        // 计算缩放方向
        const delta = e.deltaY > 0 ? (1 - CONFIG.ZOOM_FACTOR) : (1 + CONFIG.ZOOM_FACTOR);
        const newScale = Math.max(CONFIG.MIN_SCALE, Math.min(CONFIG.MAX_SCALE, state.scale * delta));

        // 如果缩放值没变，不做处理
        if (newScale === state.scale) return;

        // 计算鼠标位置相对于图片的偏移
        const scaleDiff = newScale - state.scale;
        const offsetX = (mouseX - state.translateX) * (scaleDiff / state.scale);
        const offsetY = (mouseY - state.translateY) * (scaleDiff / state.scale);

        // 更新状态
        state.scale = newScale;
        state.translateX -= offsetX;
        state.translateY -= offsetY;

        // 更新transform
        updateTransform();
        
        // 更新拖拽状态
        updateDragState();
    }

    // ========== Pointer事件处理 ==========
    function handlePointerDown(e) {
        // 只响应左键
        if (e.button !== 0) return;

        // 记录原始点击位置、变换量和点击目标
        state.isDragging = true;
        state.hasDragged = false;
        state.startX = e.clientX;
        state.startY = e.clientY;
        state.lastTranslateX = state.translateX;
        state.lastTranslateY = state.translateY;
        state.clickTarget = e.target;

        state.container.classList.add('iv-dragging');
        state.container.classList.remove('iv-no-drag');

        // 设置pointer捕获，防止事件跑到 modal 点击监听里
        state.container.setPointerCapture(e.pointerId);
    }

    function handlePointerMove(e) {
        if (!state.isDragging) return;

        e.preventDefault();

        const dx = e.clientX - state.startX;
        const dy = e.clientY - state.startY;

        // 超过阈值才算拖拽
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            state.hasDragged = true;
        }

        state.translateX = state.lastTranslateX + dx;
        state.translateY = state.lastTranslateY + dy;

        updateTransform();
    }

    function handlePointerUp(e) {
        if (!state.isDragging) return;

        state.isDragging = false;
        state.container.classList.remove('iv-dragging');

        updateDragState();
    }

    // ========== 触摸事件处理 ==========
    let lastTouchDistance = 0;
    let lastTouchCenter = { x: 0, y: 0 };

    function handleTouchStart(e) {
        if (e.touches.length === 2) {
            // 双指缩放
            e.preventDefault();
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            lastTouchDistance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
            lastTouchCenter = {
                x: (touch1.clientX + touch2.clientX) / 2,
                y: (touch1.clientY + touch2.clientY) / 2
            };
        }
    }

    function handleTouchMove(e) {
        if (e.touches.length === 2) {
            e.preventDefault();
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            
            // 计算当前双指距离和中心点
            const distance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
            const center = {
                x: (touch1.clientX + touch2.clientX) / 2,
                y: (touch1.clientY + touch2.clientY) / 2
            };

            // 计算缩放
            const scaleDelta = distance / lastTouchDistance;
            const newScale = Math.max(CONFIG.MIN_SCALE, Math.min(CONFIG.MAX_SCALE, state.scale * scaleDelta));

            if (newScale !== state.scale) {
                const rect = state.container.getBoundingClientRect();
                const mouseX = center.x - rect.left - rect.width / 2;
                const mouseY = center.y - rect.top - rect.height / 2;

                const scaleDiff = newScale - state.scale;
                const offsetX = (mouseX - state.translateX) * (scaleDiff / state.scale);
                const offsetY = (mouseY - state.translateY) * (scaleDiff / state.scale);

                state.scale = newScale;
                state.translateX -= offsetX;
                state.translateY -= offsetY;

                updateTransform();
            }

            // 计算拖拽
            state.translateX += center.x - lastTouchCenter.x;
            state.translateY += center.y - lastTouchCenter.y;
            updateTransform();

            lastTouchDistance = distance;
            lastTouchCenter = center;
        }
    }

    function handleTouchEnd(e) {
        if (e.touches.length < 2) {
            lastTouchDistance = 0;
            updateDragState();
        }
    }

    // ========== 更新Transform ==========
    function updateTransform() {
        if (!state.currentImage) return;
        
        state.currentImage.style.transform = 
            `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`;
    }

    // ========== 更新拖拽状态 ==========
    function updateDragState() {
        if (state.scale <= CONFIG.MIN_SCALE) {
            state.container.classList.add('iv-no-drag');
            state.container.classList.remove('iv-dragging');
        } else {
            state.container.classList.remove('iv-no-drag');
        }
    }

    // ========== 复原功能 ==========
    function resetView() {
        state.scale = 1;
        state.translateX = 0;
        state.translateY = 0;
        state.lastTranslateX = 0;
        state.lastTranslateY = 0;
        
        updateTransform();
        updateDragState();
    }

    // ========== 关闭预览器 ==========
    function closeViewer() {
        if (!state.modal) return;

        // 触发淡出动画
        state.modal.classList.remove('iv-open');
        state.modal.classList.add('iv-closing');

        // 动画结束后移除
        setTimeout(() => {
            if (state.modal && state.modal.parentNode) {
                state.modal.parentNode.removeChild(state.modal);
            }
            state.modal = null;
            state.currentImage = null;
            state.container = null;
            
            // 恢复页面滚动
            document.body.style.overflow = state.originalOverflow;
            
            // 重置状态
            resetView();
        }, CONFIG.ANIMATION_DURATION);

        // 移除ESC键监听
        unbindEscKey();
    }

    // ========== 绑定ESC键 ==========
    function bindEscKey() {
        document.addEventListener('keydown', handleEscKey);
    }

    function unbindEscKey() {
        document.removeEventListener('keydown', handleEscKey);
    }

    function handleEscKey(e) {
        if (e.key === 'Escape') {
            closeViewer();
        }
    }

    // ========== 处理Modal点击 ==========
    function handleModalClick(e) {
        // 如果刚发生拖拽，不关闭
        if (state.hasDragged) return;

        const target = state.clickTarget || e.target;

        // 点击背景区域（modal 或 container）关闭预览器
        // 点击图片、按钮、loading 等不关闭
        if (target === state.modal || target === state.container) {
            closeViewer();
        }

        state.clickTarget = null;
    }

    // ========== 公开API ==========
    window.ImageViewer = {
        open: openViewer,
        close: closeViewer,
        reset: resetView,
        init: initImageViewer
    };

    // ========== 初始化 ==========
    // DOM加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initImageViewer);
    } else {
        initImageViewer();
    }

})();
