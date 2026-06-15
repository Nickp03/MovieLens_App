from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import sqlite3

from recommender import get_pearson_recommendations

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
    # Μετατροπή της λίστας εισόδου σε λεξικό {movieId: rating}
    user_ratings = {r.movieId: r.rating for r in req.ratings}
    if not user_ratings:
        return {"status": "success", "recommendations": []}

    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Κλήση της συνάρτησης από το recommender.py
    recommendations = get_pearson_recommendations(user_ratings, cursor)
    
    conn.close()
    
    return {
        "status": "success", 
        "recommendations": recommendations
    }