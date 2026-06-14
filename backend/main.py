from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import sqlite3
import math

app = FastAPI()

# Ενεργοποίηση του CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db_connection():
    conn = sqlite3.connect('movielens.db')
    conn.row_factory = sqlite3.Row
    return conn

# --- ΜΟΝΤΕΛΑ ΔΕΔΟΜΕΝΩΝ ΓΙΑ ΤΑ POST REQUESTS ---
class MovieCreate(BaseModel):
    title: str
    genres: str

class RatingInput(BaseModel):
    movieId: int
    rating: float

class RecommendationRequest(BaseModel):
    ratings: List[RatingInput]

# --- API 1: Αναζήτηση Ταινιών (GET) ---
@app.get("/movielens/api/movies")
async def search_movies(search: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM movies WHERE title LIKE ?", ('%' + search + '%',))
    movies = cursor.fetchall()
    conn.close()
    
    return {
        "status": "success",
        "movies": [{"movieId": m["movieId"], "title": m["title"], "genres": m["genres"]} for m in movies]
    }

# --- API 2: Λήψη Βαθμολογιών (GET) ---
@app.get("/movielens/api/ratings/{movieId}")
async def get_ratings(movieId: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT userId, rating, timestamp FROM ratings WHERE movieId = ?", (movieId,))
    ratings = cursor.fetchall()
    conn.close()
    
    return {
        "status": "success",
        "ratings": [{"userId": r["userId"], "rating": r["rating"], "timestamp": r["timestamp"]} for r in ratings]
    }

# --- API 3: Προσθήκη Νέας Ταινίας (POST) ---
@app.post("/movielens/api/movies")
async def add_movie(movie: MovieCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute(
        "INSERT INTO movies (title, genres) VALUES (?, ?)",
        (movie.title, movie.genres)
    )
    conn.commit()
    new_id = cursor.lastrowid # Παίρνουμε το νέο ID που δημιουργήθηκε αυτόματα
    conn.close()
    
    return {
        "status": "success",
        "movieId": new_id
    }

# --- API 4: Συστάσεις / Recommendations (POST) ---
@app.post("/movielens/api/recommendations")
async def get_recommendations(req: RecommendationRequest):
    user_ratings = {r.movieId: r.rating for r in req.ratings}
    if not user_ratings:
        return {"status": "success", "recommendations": []}

    mean_u = sum(user_ratings.values()) / len(user_ratings)
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Βρίσκουμε χρήστες (v) που έχουν βαθμολογήσει τις ίδιες ταινίες
    placeholders = ','.join('?' * len(user_ratings))
    cursor.execute(f"SELECT userId, movieId, rating FROM ratings WHERE movieId IN ({placeholders})", list(user_ratings.keys()))
    overlapping_ratings = cursor.fetchall()
    
    users_v = {}
    for row in overlapping_ratings:
        uid, mid, rating = row['userId'], row['movieId'], row['rating']
        if uid not in users_v:
            users_v[uid] = {}
        users_v[uid][mid] = rating
        
    # 2. Υπολογισμός ομοιότητας (Pearson Correlation)
    similarities = {}
    for v_id, v_ratings_dict in users_v.items():
        co_rated = set(user_ratings.keys()).intersection(v_ratings_dict.keys())
        if len(co_rated) < 2: # Χρειαζόμαστε τουλάχιστον 2 κοινές για Pearson
            continue
            
        cursor.execute("SELECT AVG(rating) as avg_rating FROM ratings WHERE userId = ?", (v_id,))
        mean_v = cursor.fetchone()['avg_rating']
        
        num = 0.0
        den_u = 0.0
        den_v = 0.0
        for mid in co_rated:
            diff_u = user_ratings[mid] - mean_u
            diff_v = v_ratings_dict[mid] - mean_v
            num += diff_u * diff_v
            den_u += diff_u ** 2
            den_v += diff_v ** 2
        
        if den_u > 0 and den_v > 0:
            sim = num / (math.sqrt(den_u) * math.sqrt(den_v))
            if sim > 0: # Κρατάμε μόνο αυτούς με θετική συσχέτιση
                similarities[v_id] = (sim, mean_v)
    
    # 3. Επιλογή Top-K χρηστών (π.χ. K=50)
    top_k = sorted(similarities.items(), key=lambda x: x[1][0], reverse=True)[:50]
    if not top_k:
         return {"status": "success", "recommendations": []}
         
    top_k_users = {v_id: sim_data for v_id, sim_data in top_k}
    
    # 4. Πρόβλεψη βαθμολογιών για ταινίες που δεν έχει δει ο χρήστης
    placeholders_k = ','.join('?' * len(top_k_users))
    cursor.execute(f"SELECT userId, movieId, rating FROM ratings WHERE userId IN ({placeholders_k})", list(top_k_users.keys()))
    candidates_ratings = cursor.fetchall()
    
    movie_preds = {} 
    for row in candidates_ratings:
        mid = row['movieId']
        if mid in user_ratings: # Αγνοούμε ταινίες που έχει ήδη δει
            continue
            
        v_id, r_vi = row['userId'], row['rating']
        sim_uv, mean_v = top_k_users[v_id]
        
        if mid not in movie_preds:
            movie_preds[mid] = {'num': 0.0, 'den': 0.0}
            
        movie_preds[mid]['num'] += sim_uv * (r_vi - mean_v)
        movie_preds[mid]['den'] += abs(sim_uv)
        
    predictions = []
    for mid, vals in movie_preds.items():
        if vals['den'] > 0:
            pred_rating = mean_u + (vals['num'] / vals['den'])
            predictions.append((mid, pred_rating))
            
    # 5. Επιλογή Top-N ταινιών (π.χ. N=10)
    top_n_preds = sorted(predictions, key=lambda x: x[1], reverse=True)[:10]
    
    recommendations = []
    if top_n_preds:
        movie_ids = [mid for mid, _ in top_n_preds]
        placeholders_m = ','.join('?' * len(movie_ids))
        cursor.execute(f"SELECT * FROM movies WHERE movieId IN ({placeholders_m})", movie_ids)
        movie_details = {row['movieId']: row for row in cursor.fetchall()}
        
        for mid, pred in top_n_preds:
            if mid in movie_details:
                m = movie_details[mid]
                recommendations.append({
                    "movieId": mid,
                    "title": m["title"],
                    "genres": m["genres"],
                    "predictedRating": round(pred, 2)
                })
    
    conn.close()
    return {"status": "success", "recommendations": recommendations}