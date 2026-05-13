"""
Mood-Based Music Recommender — Flask Backend
"""
from flask import Flask, render_template, jsonify, request
import random

app = Flask(__name__)

# ── Song catalog: mood -> language -> list[song] ──
# Each song: { title, artist, youtube_url, energy }
SONG_DATA = {
    "sad": {
        "telugu": [
            {"title": "Nee Jathaga", "artist": "Karthik", "youtube_url": "https://www.youtube.com/watch?v=0RDMM8PZzLQ", "energy": "low"},
            {"title": "Manasu Maree", "artist": "Sid Sriram", "youtube_url": "https://www.youtube.com/watch?v=yK1FfWGFGrc", "energy": "low"},
            {"title": "Nijamena", "artist": "Anurag Kulkarni", "youtube_url": "https://www.youtube.com/watch?v=N6oO4w5bPYM", "energy": "medium"},
            {"title": "Kalyani Vaccha", "artist": "Sid Sriram", "youtube_url": "https://www.youtube.com/watch?v=R4K5nVL5GPg", "energy": "low"},
            {"title": "Ye Chota Nuvvunna", "artist": "Karthik", "youtube_url": "https://www.youtube.com/watch?v=KZx5HQsE5J8", "energy": "medium"},
        ],
        "hindi": [
            {"title": "Channa Mereya", "artist": "Arijit Singh", "youtube_url": "https://www.youtube.com/watch?v=284Ov7ysmfA", "energy": "low"},
            {"title": "Tujhe Kitna Chahne Lage", "artist": "Arijit Singh", "youtube_url": "https://www.youtube.com/watch?v=SxTYjptEzZs", "energy": "low"},
            {"title": "Agar Tum Saath Ho", "artist": "Arijit Singh & Alka Yagnik", "youtube_url": "https://www.youtube.com/watch?v=sK7riqg2mr4", "energy": "medium"},
            {"title": "Kabira", "artist": "Tochi Raina & Rekha Bhardwaj", "youtube_url": "https://www.youtube.com/watch?v=jHNNMj5bNQw", "energy": "medium"},
            {"title": "Ae Dil Hai Mushkil", "artist": "Arijit Singh", "youtube_url": "https://www.youtube.com/watch?v=6FURuLYrR_Q", "energy": "medium"},
        ],
        "english": [
            {"title": "Someone Like You", "artist": "Adele", "youtube_url": "https://www.youtube.com/watch?v=hLQl3WQQoQ0", "energy": "low"},
            {"title": "Fix You", "artist": "Coldplay", "youtube_url": "https://www.youtube.com/watch?v=k4V3Mo61fJM", "energy": "medium"},
            {"title": "Let Her Go", "artist": "Passenger", "youtube_url": "https://www.youtube.com/watch?v=RBumgq5yVrA", "energy": "low"},
            {"title": "All I Want", "artist": "Kodaline", "youtube_url": "https://www.youtube.com/watch?v=mtf7hC17IBM", "energy": "medium"},
            {"title": "The Night We Met", "artist": "Lord Huron", "youtube_url": "https://www.youtube.com/watch?v=KtlgYxa6BMU", "energy": "low"},
        ],
    },
    "hype": {
        "telugu": [
            {"title": "Oo Antava", "artist": "Indravathi Chauhan", "youtube_url": "https://www.youtube.com/watch?v=FUqh60R_aEQ", "energy": "high"},
            {"title": "Saami Saami", "artist": "Mounika Yadav", "youtube_url": "https://www.youtube.com/watch?v=2RqOkMelyoo", "energy": "high"},
            {"title": "Butta Bomma", "artist": "Armaan Malik", "youtube_url": "https://www.youtube.com/watch?v=1GFkN4deuZU", "energy": "medium"},
            {"title": "Ramuloo Ramulaa", "artist": "Anurag Kulkarni", "youtube_url": "https://www.youtube.com/watch?v=2F9MzMU_1Rc", "energy": "high"},
            {"title": "Naatu Naatu", "artist": "Rahul Sipligunj & Kaala Bhairava", "youtube_url": "https://www.youtube.com/watch?v=OsU0CGZoV8E", "energy": "high"},
        ],
        "hindi": [
            {"title": "Kar Har Maidaan Fateh", "artist": "Sukhwinder Singh", "youtube_url": "https://www.youtube.com/watch?v=UBZ3cX1FWxk", "energy": "high"},
            {"title": "Malhari", "artist": "Vishal Dadlani", "youtube_url": "https://www.youtube.com/watch?v=l_MyUGq7pgs", "energy": "high"},
            {"title": "Zinda", "artist": "Siddharth Mahadevan", "youtube_url": "https://www.youtube.com/watch?v=L8SRp8JTbck", "energy": "high"},
            {"title": "Sultan Title Track", "artist": "Sukhwinder Singh", "youtube_url": "https://www.youtube.com/watch?v=c9WN_FVnJcg", "energy": "high"},
            {"title": "Apna Time Aayega", "artist": "Ranveer Singh", "youtube_url": "https://www.youtube.com/watch?v=jA_MvS5P31U", "energy": "medium"},
        ],
        "english": [
            {"title": "Lose Yourself", "artist": "Eminem", "youtube_url": "https://www.youtube.com/watch?v=_Yhyp-_hX2s", "energy": "high"},
            {"title": "Stronger", "artist": "Kanye West", "youtube_url": "https://www.youtube.com/watch?v=PsO6ZnUZI0g", "energy": "high"},
            {"title": "Eye of the Tiger", "artist": "Survivor", "youtube_url": "https://www.youtube.com/watch?v=btPJPFnesV4", "energy": "high"},
            {"title": "Thunder", "artist": "Imagine Dragons", "youtube_url": "https://www.youtube.com/watch?v=fKopy74weus", "energy": "medium"},
            {"title": "Can't Hold Us", "artist": "Macklemore & Ryan Lewis", "youtube_url": "https://www.youtube.com/watch?v=2zNSgSzhBfM", "energy": "high"},
        ],
    },
    "chill": {
        "telugu": [
            {"title": "Inkem Inkem Kaavaale", "artist": "Sid Sriram", "youtube_url": "https://www.youtube.com/watch?v=vHk_FT1jMvU", "energy": "low"},
            {"title": "Nee Kannu Neeli Samudram", "artist": "Sid Sriram", "youtube_url": "https://www.youtube.com/watch?v=6hRKo_ICWDY", "energy": "low"},
            {"title": "Saranga Dariya", "artist": "Mangli", "youtube_url": "https://www.youtube.com/watch?v=ZjLX0K6HTVo", "energy": "medium"},
            {"title": "Samajavaragamana", "artist": "Sid Sriram", "youtube_url": "https://www.youtube.com/watch?v=K7gPhEghXxo", "energy": "low"},
            {"title": "Srivalli", "artist": "Sid Sriram", "youtube_url": "https://www.youtube.com/watch?v=6qAaziZqIls", "energy": "medium"},
        ],
        "hindi": [
            {"title": "Tum Hi Ho", "artist": "Arijit Singh", "youtube_url": "https://www.youtube.com/watch?v=Umqb9KENgmk", "energy": "low"},
            {"title": "Iktara", "artist": "Kavita Seth", "youtube_url": "https://www.youtube.com/watch?v=fSS_HId-wAg", "energy": "low"},
            {"title": "Khairiyat", "artist": "Arijit Singh", "youtube_url": "https://www.youtube.com/watch?v=hoNb6fU1xP4", "energy": "low"},
            {"title": "Ilahi", "artist": "Arijit Singh", "youtube_url": "https://www.youtube.com/watch?v=kPHlaBlIHHQ", "energy": "medium"},
            {"title": "Tum Se Hi", "artist": "Mohit Chauhan", "youtube_url": "https://www.youtube.com/watch?v=mt9xg0JuDKc", "energy": "low"},
        ],
        "english": [
            {"title": "Here Comes the Sun", "artist": "The Beatles", "youtube_url": "https://www.youtube.com/watch?v=KQetemT1sWc", "energy": "low"},
            {"title": "Banana Pancakes", "artist": "Jack Johnson", "youtube_url": "https://www.youtube.com/watch?v=OkyrIRyrRdY", "energy": "low"},
            {"title": "Sunflower", "artist": "Post Malone & Swae Lee", "youtube_url": "https://www.youtube.com/watch?v=ApXoWvfEYVU", "energy": "medium"},
            {"title": "Riptide", "artist": "Vance Joy", "youtube_url": "https://www.youtube.com/watch?v=uJ_1HMAGb4k", "energy": "medium"},
            {"title": "Budapest", "artist": "George Ezra", "youtube_url": "https://www.youtube.com/watch?v=VHrLPs3_1Fs", "energy": "medium"},
        ],
    },
    "romantic": {
        "telugu": [
            {"title": "Pillaa Raa", "artist": "Sid Sriram", "youtube_url": "https://www.youtube.com/watch?v=N1FcVEMwngY", "energy": "low"},
            {"title": "Undiporaadhey", "artist": "Sid Sriram", "youtube_url": "https://www.youtube.com/watch?v=5j4hhG3t3ow", "energy": "low"},
            {"title": "Emai Poyave", "artist": "Sid Sriram", "youtube_url": "https://www.youtube.com/watch?v=zK3JFoizdGY", "energy": "low"},
            {"title": "Kanunna Kalyanam", "artist": "Anurag Kulkarni", "youtube_url": "https://www.youtube.com/watch?v=2V1HWl8PVKM", "energy": "medium"},
            {"title": "Priyathama Priyathama", "artist": "Sid Sriram", "youtube_url": "https://www.youtube.com/watch?v=GiKk5rk7Mkk", "energy": "low"},
        ],
        "hindi": [
            {"title": "Hawayein", "artist": "Arijit Singh", "youtube_url": "https://www.youtube.com/watch?v=cYOB941gyXI", "energy": "low"},
            {"title": "Pehla Nasha", "artist": "Udit Narayan & Sadhana Sargam", "youtube_url": "https://www.youtube.com/watch?v=ixkhEM36SRg", "energy": "low"},
            {"title": "Raataan Lambiyan", "artist": "Jubin Nautiyal & Asees Kaur", "youtube_url": "https://www.youtube.com/watch?v=gvyUuxdRdR4", "energy": "medium"},
            {"title": "Tera Ban Jaunga", "artist": "Akhil Sachdeva & Tulsi Kumar", "youtube_url": "https://www.youtube.com/watch?v=IX9S7rpJ4Qc", "energy": "low"},
            {"title": "Tere Liye", "artist": "Atif Aslam & Shreya Ghoshal", "youtube_url": "https://www.youtube.com/watch?v=LCC8Fnt2eaI", "energy": "medium"},
        ],
        "english": [
            {"title": "Perfect", "artist": "Ed Sheeran", "youtube_url": "https://www.youtube.com/watch?v=2Vv-BfVoq4g", "energy": "low"},
            {"title": "All of Me", "artist": "John Legend", "youtube_url": "https://www.youtube.com/watch?v=450p7goxZqg", "energy": "low"},
            {"title": "Thinking Out Loud", "artist": "Ed Sheeran", "youtube_url": "https://www.youtube.com/watch?v=lp-EO5I60KA", "energy": "medium"},
            {"title": "A Thousand Years", "artist": "Christina Perri", "youtube_url": "https://www.youtube.com/watch?v=rtOvBOTyX00", "energy": "low"},
            {"title": "Love Me Like You Do", "artist": "Ellie Goulding", "youtube_url": "https://www.youtube.com/watch?v=AJtDXIazrMo", "energy": "medium"},
        ],
    },
    "angry": {
        "telugu": [
            {"title": "Deva Deva", "artist": "Anurag Kulkarni", "youtube_url": "https://www.youtube.com/watch?v=JJcLbGB-lVQ", "energy": "high"},
            {"title": "Jai Balayya", "artist": "Sri Krishna & Geetha Madhuri", "youtube_url": "https://www.youtube.com/watch?v=Zn3i_rD3xbQ", "energy": "high"},
            {"title": "Vakeel Saab Title Song", "artist": "Anup Rubens", "youtube_url": "https://www.youtube.com/watch?v=0Djv8i9j0PE", "energy": "high"},
            {"title": "Daang Daang", "artist": "Ram Miriyala", "youtube_url": "https://www.youtube.com/watch?v=8uQcGfm9_K0", "energy": "high"},
            {"title": "Pataas Title Song", "artist": "Sagar", "youtube_url": "https://www.youtube.com/watch?v=5GmNmwL_b4I", "energy": "medium"},
        ],
        "hindi": [
            {"title": "Sadda Haq", "artist": "Mohit Chauhan", "youtube_url": "https://www.youtube.com/watch?v=4bPjq_yNpEM", "energy": "high"},
            {"title": "Chak De India", "artist": "Sukhwinder Singh", "youtube_url": "https://www.youtube.com/watch?v=jmVHB1BQXYM", "energy": "high"},
            {"title": "Dangal Title Track", "artist": "Daler Mehndi", "youtube_url": "https://www.youtube.com/watch?v=w8G_Dvq3TjQ", "energy": "high"},
            {"title": "Khalibali", "artist": "Shivam Pathak", "youtube_url": "https://www.youtube.com/watch?v=v7K4vGYL9zI", "energy": "high"},
            {"title": "Bhaag DK Bose", "artist": "Ram Sampath", "youtube_url": "https://www.youtube.com/watch?v=jbhADxJswag", "energy": "high"},
        ],
        "english": [
            {"title": "In the End", "artist": "Linkin Park", "youtube_url": "https://www.youtube.com/watch?v=eVTXPUF4Oz4", "energy": "high"},
            {"title": "Numb", "artist": "Linkin Park", "youtube_url": "https://www.youtube.com/watch?v=kXYiU_JCYtU", "energy": "high"},
            {"title": "Break Stuff", "artist": "Limp Bizkit", "youtube_url": "https://www.youtube.com/watch?v=ZpUYjpKg9KY", "energy": "high"},
            {"title": "Killing in the Name", "artist": "Rage Against the Machine", "youtube_url": "https://www.youtube.com/watch?v=bWXazVhlyxQ", "energy": "high"},
            {"title": "Given Up", "artist": "Linkin Park", "youtube_url": "https://www.youtube.com/watch?v=0xyxtzD54rM", "energy": "high"},
        ],
    },
}

MOOD_CAPTIONS = {
    "sad":      "You seem low\u2026 try this.",
    "hype":     "Energy boost incoming \u26a1",
    "chill":    "Relax mode activated \U0001f319",
    "angry":    "Let it out \U0001f525",
    "romantic": "Feels hitting different \u2764\ufe0f",
    "surprise": "Here\u2019s something unexpected \U0001f3b2",
}

ALL_MOODS = list(SONG_DATA.keys())


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/recommend", methods=["POST"])
def recommend():
    data = request.get_json(force=True)
    mood = data.get("mood", "").lower().strip()
    language = data.get("language", "all").lower().strip()
    energy = data.get("energy", "all").lower().strip()

    if mood == "surprise":
        mood = random.choice(ALL_MOODS)

    if mood not in SONG_DATA:
        return jsonify({"error": "Unknown mood"}), 400

    caption = MOOD_CAPTIONS.get(mood, MOOD_CAPTIONS["surprise"])

    if language != "all" and language in SONG_DATA[mood]:
        candidates = list(SONG_DATA[mood][language])
    else:
        candidates = []
        for lang_songs in SONG_DATA[mood].values():
            candidates.extend(lang_songs)

    if energy != "all":
        filtered = [s for s in candidates if s["energy"] == energy]
        if filtered:
            candidates = filtered

    count = min(random.randint(3, 5), len(candidates))
    picks = random.sample(candidates, count)

    songs = [
        {"title": s["title"], "artist": s["artist"], "youtube_url": s["youtube_url"]}
        for s in picks
    ]
    return jsonify({"caption": caption, "songs": songs})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
