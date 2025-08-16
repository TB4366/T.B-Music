<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>T.B Music - Live</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            text-align: center;
            background-color: #1a1a1a;
            color: #fff;
        }
        h1 {
            margin-top: 50px;
        }
        button {
            padding: 15px 30px;
            font-size: 18px;
            margin-top: 20px;
            cursor: pointer;
            background-color: #ff4d4d;
            border: none;
            border-radius: 10px;
            color: #fff;
        }
        button.active {
            background-color: #4dff4d;
        }
        audio {
            display: none;
        }
    </style>
</head>
<body>

    <h1>Welcome to T.B Music</h1>
    <button id="liveBtn">Go Live</button>

    <audio id="musicPlayer"></audio>
    <audio id="voiceMessage" src="voice.mp3"></audio> <!-- voeg hier je stembestand toe -->

    <script>
        const liveBtn = document.getElementById('liveBtn');
        const musicPlayer = document.getElementById('musicPlayer');
        const voiceMessage = document.getElementById('voiceMessage');

        // Voeg hier je muziekbestanden toe
        const playlist = [
            'song1.mp3',
            'song2.mp3',
            'song3.mp3'
        ];

        let currentSongIndex = 0;
        let songCount = 0;
        let isLive = false;

        function playNextSong() {
            musicPlayer.src = playlist[currentSongIndex];
            musicPlayer.play();

            currentSongIndex = (currentSongIndex + 1) % playlist.length;
            songCount++;

            // Om de 2 nummers, speel de stem
            if (songCount % 2 === 0) {
                voiceMessage.play();
            }
        }

        musicPlayer.addEventListener('ended', () => {
            if (isLive) {
                playNextSong();
            }
        });

        liveBtn.addEventListener('click', () => {
            isLive = !isLive;
            if (isLive) {
                liveBtn.textContent = "Live On";
                liveBtn.classList.add('active');
                playNextSong();
            } else {
                liveBtn.textContent = "Go Live";
                liveBtn.classList.remove('active');
                musicPlayer.pause();
            }
        });
    </script>

</body>
</html>
