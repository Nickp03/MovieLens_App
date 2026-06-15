import sqlite3
import csv
import os

def create_database():
    # Δημιουργία ή σύνδεση με το αρχείο της βάσης δεδομένων SQLite
    db_path = 'movielens.db'
    if os.path.exists(db_path):
        os.remove(db_path)
        print(f"Το παλιό αρχείο '{db_path}' εντοπίστηκε και διαγράφηκε για πλήρες reset.")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Διαδρομή για τον φάκελο με τα CSV αρχεία
    dataset_dir = 'ml-latest-small'
    
    # Πίνακας movies
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS movies (
            movieId INTEGER PRIMARY KEY,
            title TEXT,
            genres TEXT
        )
    ''')

    # Πίνακας ratings
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ratings (
            userId INTEGER,
            movieId INTEGER,
            rating REAL,
            timestamp INTEGER,
            PRIMARY KEY (userId, movieId),
            FOREIGN KEY(movieId) REFERENCES movies(movieId)
        )
    ''')

    # Πίνακας tags
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tags (
            userId INTEGER,
            movieId INTEGER,
            tag TEXT,
            timestamp INTEGER,
            PRIMARY KEY (userId, movieId),
            FOREIGN KEY(movieId) REFERENCES movies(movieId)
        )
    ''')

    # Φόρτωση movies.csv
    with open(os.path.join(dataset_dir, 'movies.csv'), 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader) # Προσπέραση της πρώτης γραμμής (headers)
        cursor.executemany('INSERT OR IGNORE INTO movies VALUES (?, ?, ?)', reader)

    # Φόρτωση ratings.csv
    with open(os.path.join(dataset_dir, 'ratings.csv'), 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader)
        cursor.executemany('INSERT OR IGNORE INTO ratings VALUES (?, ?, ?, ?)', reader)

    # Φόρτωση tags.csv
    with open(os.path.join(dataset_dir, 'tags.csv'), 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader)
        cursor.executemany('INSERT OR IGNORE INTO tags VALUES (?, ?, ?, ?)', reader)

    # Αποθήκευση και κλείσιμο
    conn.commit()
    conn.close()
    print(f"Η βάση δεδομένων δημιουργήθηκε επιτυχώς στο αρχείο: {db_path}")

if __name__ == "__main__":
    create_database()