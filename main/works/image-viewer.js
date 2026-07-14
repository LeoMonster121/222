/**
 * =====================================================
 * 图片预览器 - Image Viewer
 * =====================================================
 * 功能：
 * 1. 全屏 Modal 展示图片
 * 2. 鼠标滚轮缩放（以鼠标位置为中心）
 * 3. 拖拽移动（放大后可用）
 * 4. 复原按钮重置状态
 * 5. 点击背景/ESC 关闭
 * 6. 淡入淡出动画
 * =====================================================
 */

(function() {
    'use strict';

    // ========== 配置常量 ==========
    const CONFIG = {
        MIN_SCALE: 1,           // 最小缩放
        MAX_SCALE: 5,            // 最大缩放
        ZOOM_SENSITIVITY: 0.001, // 缩放灵敏度
        TRANSITION_DURATION: 300 // 动画时长（毫秒）
    };

    // ========== 状态变量 ==========
    let currentModal = null;
    let currentImg = null;
    let currentScale = 1;
    let translateX = 0;
    let translateY = 0;
    let isDragging = false;
    let hasDragged = false;  // 标记是否发生了拖拽
    let startX = 0;
    let startY = 0;
    let lastMouseX = 0;
    let lastMouseY = 0;
    let originalBodyOverflow = '';

    // ========== 工具函数 ==========
    
    /**
     * 限制数值在指定范围内
     */
    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    /**
     * 计算两点之间的距离
     */
    function getDistance(touches) {
        if (touches.length < 2) return 0;
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * 获取鼠标相对于容器的位置
     */
    function getMousePositionInContainer(e, container) {
        const rect = container.getBoundingClientRect();
        return {
            x: e.clientX - rect.left - rect.width / 2,
            y: e.clientY - rect.top - rect.height / 2
        };
    }

    /**
     * 更新图片 transform
     */
    function updateTransform(animate = false) {
        if (!currentImg) return;
        
        if (animate) {
            currentImg.classList.add('is-resetting');
            // 动画结束后移除 class
            setTimeout(() => {
                currentImg.classList.remove('is-resetting');
            }, CONFIG.TRANSITION_DURATION);
        }
        
        currentImg.style.transform = `translate(${translateX}px, ${translateY}px) scale(${currentScale})`;
        
        // 更新缩放指示器
        updateZoomIndicator();
        
        // 更新容器拖拽状态
        updateContainerCursor();
    }

    /**
     * 更新缩放指示器
     */
    function updateZoomIndicator() {
        const indicator = document.querySelector('.image-viewer-zoom-indicator');
        if (indicator) {
            indicator.textContent = Math.round(currentScale * 100) + '%';
        }
    }

    /**
     * 更新容器光标状态
     */
    function updateContainerCursor() {
        if (!currentModal) return;
        const container = currentModal.querySelector('.image-viewer-container');
        if (container) {
            if (currentScale > 1) {
                container.classList.remove('no-drag');
            } else {
                container.classList.add('no-drag');
            }
        }
    }

    /**
     * 重置图片状态
     */
    function resetImageState() {
        currentScale = 1;
        translateX = 0;
        translateY = 0;
        updateTransform(true);
    }

    /**
     * 关闭预览
     */
    function closeViewer() {
        if (!currentModal) return;
        
        currentModal.classList.add('is-closing');
        
        // 动画结束后移除
        setTimeout(() => {
            if (currentModal && currentModal.parentNode) {
                currentModal.parentNode.removeChild(currentModal);
            }
            currentModal = null;
            currentImg = null;
            
            // 恢复 body overflow
            document.body.style.overflow = originalBodyOverflow;
            
            // 移除全局事件监听
            document.removeEventListener('keydown', handleKeyDown);
        }, CONFIG.TRANSITION_DURATION);
    }

    // ========== 事件处理 ==========

    /**
     * 键盘事件处理
     */
    function handleKeyDown(e) {
        if (!currentModal) return;
        
        switch (e.key) {
            case 'Escape':
                closeViewer();
                break;
            case '+':
            case '=':
                // 放大
                zoomIn();
                break;
            case '-':
                // 缩小
                zoomOut();
                break;
            case '0':
                // 重置
                resetImageState();
                break;
        }
    }

    /**
     * 滚轮缩放事件
     */
    function handleWheel(e) {
        if (!currentModal || !currentImg) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        // 获取鼠标位置
        const rect = currentImg.getBoundingClientRect();
        const mouseX = e.clientX - rect.left - rect.width / 2;
        const mouseY = e.clientY - rect.top - rect.height / 2;
        
        // 计算缩放比例
        const delta = -e.deltaY * CONFIG.ZOOM_SENSITIVITY;
        const newScale = clamp(currentScale * (1 + delta), CONFIG.MIN_SCALE, CONFIG.MAX_SCALE);
        
        // 如果缩放不变，不处理
        if (newScale === currentScale) return;
        
        // 计算新的平移量（以鼠标位置为中心缩放）
        const scaleFactor = newScale / currentScale;
        translateX = mouseX - (mouseX - translateX) * scaleFactor;
        translateY = mouseY - (mouseY - translateY) * scaleFactor;
        
        currentScale = newScale;
        updateTransform();
    }

    /**
     * 指针按下事件（用于拖拽）
     */
    function handlePointerDown(e) {
        if (!currentModal) return;

        // 只响应左键
        if (e.button !== 0) return;

        // scale 为 1 时禁止拖拽
        if (currentScale <= 1) return;

        const container = currentModal.querySelector('.image-viewer-container');
        if (e.target !== container && !container.contains(e.target)) return;

        isDragging = true;
        hasDragged = false;  // 重置拖拽标记
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;

        container.classList.add('is-dragging');

        // 捕获指针
        e.target.setPointerCapture(e.pointerId);
    }

    /**
     * 指针移动事件（用于拖拽）
     */
    function handlePointerMove(e) {
        if (!isDragging || !currentModal) return;

        // 禁止默认行为
        e.preventDefault();

        // 标记发生了拖拽
        const dx = Math.abs(e.clientX - startX);
        const dy = Math.abs(e.clientY - startY);
        if (dx > 5 || dy > 5) {
            hasDragged = true;
        }

        translateX = e.clientX - startX;
        translateY = e.clientY - startY;

        updateTransform();
    }

    /**
     * 指针释放事件（结束拖拽）
     */
    function handlePointerUp(e) {
        if (!isDragging) return;

        isDragging = false;

        const container = currentModal?.querySelector('.image-viewer-container');
        if (container) {
            container.classList.remove('is-dragging');
        }

        // 释放指针捕获
        if (e.target && typeof e.target.releasePointerCapture === 'function') {
            e.target.releasePointerCapture(e.pointerId);
        }

        // 延迟重置拖拽标记，确保 click 事件能检测到
        setTimeout(() => {
            hasDragged = false;
        }, 10);
    }

    /**
     * 点击背景关闭
     */
    function handleBackgroundClick(e) {
        if (!currentModal) return;

        // 如果刚刚发生了拖拽，不处理点击事件
        if (hasDragged) {
            return;
        }

        // 只响应直接点击 Modal 背景
        if (e.target === currentModal || e.target.classList.contains('image-viewer-container')) {
            closeViewer();
        }
    }

    /**
     * 双指缩放（触摸设备）
     */
    let lastTouchDistance = 0;

    function handleTouchStart(e) {
        if (e.touches.length === 2) {
            lastTouchDistance = getDistance(e.touches);
        }
    }

    function handleTouchMove(e) {
        if (e.touches.length === 2 && lastTouchDistance > 0) {
            e.preventDefault();
            
            const newDistance = getDistance(e.touches);
            const delta = newDistance / lastTouchDistance;
            const newScale = clamp(currentScale * delta, CONFIG.MIN_SCALE, CONFIG.MAX_SCALE);
            
            if (newScale !== currentScale) {
                currentScale = newScale;
                updateTransform();
            }
            
            lastTouchDistance = newDistance;
        }
    }

    function handleTouchEnd(e) {
        if (e.touches.length < 2) {
            lastTouchDistance = 0;
        }
    }

    // ========== 缩放控制函数 ==========

    /**
     * 放大
     */
    function zoomIn() {
        currentScale = clamp(currentScale * 1.2, CONFIG.MIN_SCALE, CONFIG.MAX_SCALE);
        updateTransform(true);
    }

    /**
     * 缩小
     */
    function zoomOut() {
        currentScale = clamp(currentScale / 1.2, CONFIG.MIN_SCALE, CONFIG.MAX_SCALE);
        // 如果缩小到最小，自动居中
        if (currentScale <= 1) {
            translateX = 0;
            translateY = 0;
        }
        updateTransform(true);
    }

    // ========== 主函数 ==========

    /**
     * 打开图片预览
     * @param {string} imageSrc - 图片地址
     */
    function openImageViewer(imageSrc) {
        // 如果已打开，先关闭
        if (currentModal) {
            closeViewer();
            setTimeout(() => openImageViewer(imageSrc), CONFIG.TRANSITION_DURATION + 50);
            return;
        }

        // 保存原始 body overflow
        originalBodyOverflow = document.body.style.overflow;
        
        // 禁止页面滚动
        document.body.style.overflow = 'hidden';
        
        // 重置状态
        currentScale = 1;
        translateX = 0;
        translateY = 0;
        isDragging = false;

        // 创建 Modal
        const modal = document.createElement('div');
        modal.className = 'image-viewer-modal';
        modal.innerHTML = `
            <div class="image-viewer-container no-drag">
                <div class="image-viewer-loading"></div>
                <img class="image-viewer-img" src="${imageSrc}" alt="Preview">
            </div>
            <div class="image-viewer-hint">滚轮缩放 · 拖拽移动 · ESC 关闭</div>
            <div class="image-viewer-toolbar">
                <button class="image-viewer-btn" id="zoomOutBtn" title="缩小 (-)">
                    <svg viewBox="0 0 24 24">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        <line x1="8" y1="11" x2="14" y2="11"></line>
                    </svg>
                </button>
                <div class="image-viewer-zoom-indicator">100%</div>
                <button class="image-viewer-btn" id="zoomInBtn" title="放大 (+)">
                    <svg viewBox="0 0 24 24">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        <line x1="11" y1="8" x2="11" y2="14"></line>
                        <line x1="8" y1="11" x2="14" y2="11"></line>
                    </svg>
                </button>
                <button class="image-viewer-btn" id="resetBtn" title="复原 (0)">
                    <svg viewBox="0 0 24 24">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                        <path d="M3 3v5h5"></path>
                    </svg>
                    <span>复原</span>
                </button>
            </div>
        `;

        document.body.appendChild(modal);
        currentModal = modal;
        
        // 获取图片元素
        const img = modal.querySelector('.image-viewer-img');
        currentImg = img;
        
        // 获取容器
        const container = modal.querySelector('.image-viewer-container');
        
        // 图片加载完成后
        img.onload = () => {
            const loading = modal.querySelector('.image-viewer-loading');
            if (loading) loading.remove();
            
            // 延迟显示（等待 CSS 过渡）
            requestAnimationFrame(() => {
                modal.classList.add('is-visible');
            });
            
            // 3秒后隐藏提示
            setTimeout(() => {
                const hint = modal.querySelector('.image-viewer-hint');
                if (hint) hint.classList.add('is-hidden');
            }, 3000);
        };
        
        // 图片加载失败
        img.onerror = () => {
            const loading = modal.querySelector('.image-viewer-loading');
            if (loading) loading.remove();
            
            // 显示错误信息
            const errorMsg = document.createElement('div');
            errorMsg.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: #fff;
                font-size: 16px;
                text-align: center;
            `;
            errorMsg.textContent = '图片加载失败';
            container.appendChild(errorMsg);
            
            modal.classList.add('is-visible');
        };

        // 绑定事件
        
        // 滚轮缩放
        modal.addEventListener('wheel', handleWheel, { passive: false });
        
        // 指针事件（拖拽）
        modal.addEventListener('pointerdown', handlePointerDown);
        modal.addEventListener('pointermove', handlePointerMove);
        modal.addEventListener('pointerup', handlePointerUp);
        modal.addEventListener('pointercancel', handlePointerUp);
        
        // 触摸事件（双指缩放）
        modal.addEventListener('touchstart', handleTouchStart, { passive: false });
        modal.addEventListener('touchmove', handleTouchMove, { passive: false });
        modal.addEventListener('touchend', handleTouchEnd);
        
        // 点击背景关闭
        modal.addEventListener('click', handleBackgroundClick);
        
        // 工具栏按钮
        modal.querySelector('#zoomInBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            zoomIn();
        });
        
        modal.querySelector('#zoomOutBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            zoomOut();
        });
        
        modal.querySelector('#resetBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            resetImageState();
        });
        
        // 键盘事件
        document.addEventListener('keydown', handleKeyDown);
        
        // 延迟显示（确保 DOM 已渲染）
        requestAnimationFrame(() => {
            modal.classList.add('is-visible');
        });
    }

    // ========== 暴露 API ==========
    
    window.ImageViewer = {
        open: openImageViewer,
        close: closeViewer,
        zoomIn: zoomIn,
        zoomOut: zoomOut,
        reset: resetImageState
    };

})();
