import os
import random
from time import sleep
from pydub import AudioSegment
from pydub.playback import play

# Map met nummers en jingles
MUSIC_DIR = "playlist"
JINGLE_DIR = "jingles"

# Laad bestanden
songs = [os.path.join(MUSIC_DIR, f) for f in os.listdir(MUSIC_DIR) if f.endswith(".mp3")]
jingles = [os.path.join(JINGLE_DIR, f) for f in os.listdir(JINGLE_DIR) if f.endswith(".mp3")]

def play_song_with_jingle(song_path, jingle_path=None):
    song = AudioSegment.from_mp3(song_path)
    
    # Voeg jingle toe voor de song
    if jingle_path:
        jingle = AudioSegment.from_mp3(jingle_path)
        combined = jingle + song
    else:
        combined = song

    # Speel af
    play(combined)

def main():
    print("🎵 Sky Radio Clone gestart...")
    while True:
        song = random.choice(songs)
        jingle = random.choice(jingles) if jingles else None
        play_song_with_jingle(song, jingle)
        sleep(1)  # korte pauze tussen nummers

if __name__ == "__main__":
    main()
