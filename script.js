let player;
let isPlaying = false;

// YouTube IFrame API callback
function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '0', // Verberg video
        width: '0',
        playerVars: {
            listType:'playlist',
            list: 'YOUR_PLAYLIST_ID', // <-- Vervang dit met je YouTube playlist ID
            autoplay: 0,
            loop: 1,
            modestbranding: 1,
            controls: 0
        },
        events: {
            'onReady': onPlayerReady
        }
    });
}

function onPlayerReady(event) {
    const btn = document.getElementById('playPauseBtn');
    btn.addEventListener('click', () => {
        if(isPlaying) {
            player.pauseVideo();
            btn.textContent = 'Play';
        } else {
            player.playVideo();
            btn.textContent = 'Stop';
        }
        isPlaying = !isPlaying;
    });
}
