# MovieLens Recommendation System

## Περιγραφή
Μια Full-stack web εφαρμογή για την αναζήτηση ταινιών και την παροχή εξατομικευμένων συστάσεων. Το σύστημα μαθαίνει από τις βαθμολογίες του χρήστη στο τρέχον session και προτείνει νέες ταινίες χρησιμοποιώντας τον αλγόριθμο **User-Based Collaborative Filtering** (βασισμένο στον συντελεστή συσχέτισης **Pearson**), υλοποιημένο από το μηδέν με Python και SQLite3.

## Χαρακτηριστικά (Features)
* **Αναζήτηση & Δυναμική Αξιολόγηση:** Αναζήτηση ταινιών σε πραγματικό χρόνο και βαθμολόγησή τους (1-5).
* **Έξυπνες Συστάσεις:** Υπολογισμός προσωποποιημένων προτάσεων με βάση τη γειτονιά των $K$ πιο όμοιων χρηστών.
* **Διαχείριση Δεδομένων:** Δυνατότητα προσθήκης νέων ταινιών στο σύστημα με αυστηρό έλεγχο εγκυρότητας (Validation).
* **Μνήμη Session:** Οι βαθμολογίες διατηρούνται καθ' όλη τη διάρκεια της περιήγησης χρησιμοποιώντας το `sessionStorage` του browser.

## Τεχνολογίες που χρησιμοποιήθηκαν
* **Backend:** Python 3, FastAPI, Uvicorn, Pydantic
* **Βάση Δεδομένων:** SQLite3
* **Frontend:** HTML5, CSS3, Vanilla JavaScript (Fetch API)
* **Dataset:** [MovieLens Dataset](https://grouplens.org/datasets/movielens/latest/)

---

## Οδηγίες Εγκατάστασης & Εκτέλεσης

Ακολουθήστε πιστά τα παρακάτω βήματα για να στήσετε και να εκτελέσετε την εφαρμογή τοπικά στον υπολογιστή σας:

### 1. Λήψη και Τοποθέτηση Δεδομένων
Κατεβάστε το MovieLens dataset και τοποθετήστε το φάκελο ml-latest-small - με τα αρχεία `movies.csv` και `ratings.csv` (καθώς και το `tags.csv` αν είναι διαθέσιμο) - μέσα στον φάκελο `backend/`.

### 2. Δημιουργία και Ενεργοποίηση Εικονικού Περιβάλλοντος (Virtual Environment)
Ανοίξτε το τερματικό σας (Terminal), πλοηγηθείτε στον ριζικό φάκελο του project και εκτελέστε τις παρακάτω εντολές:

```bash
# Δημιουργία του venv
python3 -m venv venv

# Ενεργοποίηση (Linux/macOS):
source venv/bin/activate

# Ενεργοποίηση (Windows - Command Prompt):
venv\Scripts\activate

#Εγκατάσταση Απαιτούμενων Βιβλιοθηκών (Dependencies)
cd backend
pip install -r requirements.txt

#Αρχικοποίηση της Βάσης Δεδομένων (SQLite)
python setup_db.py

#Εκκίνηση του Backend Server (FastAPI)
uvicorn main:app --port 3000 --reload

#Εκκίνηση του Frontend Server
source venv/bin/activate
cd frontend
python3 -m http.server