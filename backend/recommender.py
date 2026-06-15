import math
import sqlite3
from typing import List, Dict

# =========================================================================
# ΡΥΘΜΙΣΕΙΣ ΑΛΓΟΡΙΘΜΟΥ (GLOBAL CONSTANTS)
# =========================================================================
TOP_K = 10 # Πλήθος πιο όμοιων χρηστών που θα εξεταστούν (Γειτονιά)
TOP_N = 10 # Πλήθος ταινιών που θα επιστραφούν τελικά στο Frontend

def get_pearson_recommendations(user_ratings: Dict[int, float], cursor: sqlite3.Cursor) -> List[dict]:
    """
    Υπολογίζει προσωποποιημένες συστάσεις ταινιών με βάση τον αλγόριθμο Pearson Correlation.
    """
    if not user_ratings:
        return []

    mean_u = sum(user_ratings.values()) / len(user_ratings)
    
    # 1. Εύρεση χρηστών (v) που έχουν βαθμολογήσει τις ίδιες ταινίες
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
        print(f"User {v_id} ==> Rating {v_ratings_dict}")
        co_rated = set(user_ratings.keys()).intersection(v_ratings_dict.keys())
            
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
            print(f"[TEST] Χρήστης {v_id} -> Υπολογίστηκε sim = {sim}")
            similarities[v_id] = (sim, mean_v)
    
    # 3. Επιλογή Top-K χρηστών
    top_k = sorted(similarities.items(), key=lambda x: x[1][0], reverse=True)[:TOP_K]
    if not top_k:
        return []
         
    top_k_users = {v_id: sim_data for v_id, sim_data in top_k}
    
    # 4. Πρόβλεψη βαθμολογιών για ταινίες που δεν έχει δει ο χρήστης
    placeholders_k = ','.join('?' * len(top_k_users))
    cursor.execute(f"SELECT userId, movieId, rating FROM ratings WHERE userId IN ({placeholders_k})", list(top_k_users.keys()))
    candidates_ratings = cursor.fetchall()
    
    movie_preds = {} 
    for row in candidates_ratings:
        mid = row['movieId']
        if mid in user_ratings: # Αγνοούμε όσες έχει ήδη δει
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
            
    # 5. Επιλογή Top-N ταινιών
    top_n_preds = sorted(predictions, key=lambda x: x[1], reverse=True)[:TOP_N]
    
    recommendations = []
    if top_n_preds:
        movie_ids = [mid for mid, _ in top_n_preds]
        placeholders_m = ','.join('?' * len(movie_ids))
        cursor.execute(f"SELECT * FROM movies WHERE movieId IN ({placeholders_m})", movie_ids)
        movie_details = {row['movieId']: row for row in cursor.fetchall()}
        
        for mid, raw_pred in top_n_preds:
            if mid in movie_details:
                m = movie_details[mid]
                
                # 3. CLIPPING: Εφαρμόζεται μόνο για την εμφάνιση της βαθμολογίας στο UI
                display_rating = min(5.0, max(0.5, raw_pred))
                
                recommendations.append({
                    "movieId": mid,
                    "title": m["title"],
                    "genres": m["genres"],
                    "predictedRating": round(display_rating, 2)
                })
                
    return recommendations