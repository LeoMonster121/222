/**
 * =====================================================
 * 视频轮播背景个人主页 - JavaScript
 * =====================================================
 */

const CONFIG = {
    slideshowInterval: 5000,  // 轮播间隔（毫秒）
    transitionDuration: 1000,  // 淡入淡出时间（毫秒）
    videoCount: 2             // 视频数量
};

let currentVideoIndex = 0;
let slideshowTimer = null;
let videos = [];

document.addEventListener('DOMContentLoaded', () => {
    initVideos();
    initSmoothScroll();
    initHoverEffects();
    
    // 立即尝试播放视频
    playAllVideos();
    
    // 点击页面时也尝试播放
    document.addEventListener('click', playAllVideos, { once: true });
});

function initVideos() {
    videos = [];
    
    // 获取所有视频元素
    for (let i = 1; i <= CONFIG.videoCount; i++) {
        const video = document.getElementById(`video${i}`);
        if (video) {
            videos.push(video);
            
            // 确保视频属性
            video.muted = true;
            video.autoplay = true;
            video.loop = true;
            video.playsInline = true;
            
            // 监听错误
            video.addEventListener('error', () => {
                console.warn(`视频 ${i} 加载失败`);
            });
        }
    }
    
    if (videos.length > 0) {
        videos[0].classList.add('active');
        
        if (videos.length > 1) {
            startSlideshow();
        }
    }
    
    // 标签页切换时处理
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            playAllVideos();
            if (videos.length > 1) startSlideshow();
        } else {
            stopSlideshow();
        }
    });
}

function playAllVideos() {
    videos.forEach(v => {
        if (v && v.paused) {
            v.play().catch(() => {});
        }
    });
}

function playVideo(video) {
    if (video && video.paused) {
        video.play().catch(() => {});
    }
}

function startSlideshow() {
    if (slideshowTimer) clearInterval(slideshowTimer);
    slideshowTimer = setInterval(transitionToNextVideo, CONFIG.slideshowInterval);
}

function stopSlideshow() {
    if (slideshowTimer) {
        clearInterval(slideshowTimer);
        slideshowTimer = null;
    }
}

function transitionToNextVideo() {
    if (videos.length < 2) return;
    
    const nextIndex = (currentVideoIndex + 1) % videos.length;
    const currentVideo = videos[currentVideoIndex];
    const nextVideo = videos[nextIndex];
    
    if (!currentVideo || !nextVideo) return;
    
    // 淡出当前视频
    currentVideo.classList.remove('active');
    
    // 淡入下一个视频并播放
    nextVideo.classList.add('active');
    playVideo(nextVideo);
    
    currentVideoIndex = nextIndex;
}

function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (href === '#') return;
            
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                const navHeight = 80;
                const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - navHeight;
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

function initHoverEffects() {
    document.querySelectorAll('.work-card').forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-8px) scale(1.02)';
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
        });
    });
}

// 键盘控制
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        if (slideshowTimer) {
            stopSlideshow();
        } else {
            startSlideshow();
        }
    }
    if (e.code === 'ArrowRight') transitionToNextVideo();
    if (e.code === 'ArrowLeft') {
        const prevIndex = currentVideoIndex === 0 ? videos.length - 1 : currentVideoIndex - 1;
        if (prevIndex !== currentVideoIndex) {
            stopSlideshow();
            videos[currentVideoIndex].classList.remove('active');
            videos[prevIndex].classList.add('active');
            playVideo(videos[prevIndex]);
            currentVideoIndex = prevIndex;
            startSlideshow();
        }
    }
});

// 暴露API
window.VideoSlideshow = {
    next: transitionToNextVideo,
    start: startSlideshow,
    stop: stopSlideshow
};
