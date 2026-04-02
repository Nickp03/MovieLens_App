# MovieLens Recommendation System

## Περιγραφή
Μια Full-stack εφαρμογή για την αναζήτηση ταινιών και την παροχή εξατομικευμένων συστάσεων με βάση τον αλγόριθμο Collaborative Filtering (Pearson Correlation).

## Οδηγίες Εγκατάστασης & Εκτέλεσης
1. Τοποθετήστε τα αρχεία `movies.csv` και `ratings.csv` στον φάκελο `backend/`.
2. Εκτελέστε το script αρχικοποίησης της βάσης:
   `python setup_db.py`
3. Εγκαταστήστε τις εξαρτήσεις:
   `pip install -r requirements.txt`
4. Εκκινήστε τον server:
   `uvicorn main:app --reload`
5. Ανοίξτε το αρχείο `frontend/index.html` στον browser σας.