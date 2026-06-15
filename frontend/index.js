// Η βασική διεύθυνση URL του FastAPI backend API για την επικοινωνία
const API_BASE_URL = 'http://127.0.0.1:3000/movielens/api';

// Αντί για άδειο πίνακα, ελέγχουμε αν υπάρχουν ήδη αποθηκευμένες βαθμολογίες στο sessionStorage.
// Επειδή το sessionStorage αποθηκεύει μόνο κείμενο (string), χρησιμοποιούμε JSON.parse για να το ξανακάνουμε πίνακα.
let userRatings = JSON.parse(sessionStorage.getItem('userRatings')) || [];

// Πίνακας για τις ταινίες που πρόσθεσε ο χρήστης ΜΟΝΟ σε αυτό το session
let addedMovies = JSON.parse(sessionStorage.getItem('addedMovies')) || [];

// =========================================================================
// ΛΕΙΤΟΥΡΓΙΚΟΤΗΤΑ 1: ΠΡΟΣΘΗΚΗ ΝΕΑΣ ΤΑΙΝΙΑΣ (POST REQUEST)
// =========================================================================

// Ακρόαση του γεγονότος υποβολής (submit) της φόρμας προσθήκης ταινίας
document.getElementById('add-movie-form').addEventListener('submit', async (e) => {
    e.preventDefault(); // Αποτρέπει την ανανέωση (reload) της σελίδας που κάνει αυτόματα μια φόρμα

    // Ανάκτηση των τιμών που πληκτρολόγησε ο χρήστης στα πεδία εισαγωγής
    const title = document.getElementById('movie-title').value;
    const genres = document.getElementById('movie-genres').value;
    const messageDiv = document.getElementById('add-movie-message'); // Το στοιχείο όπου θα εμφανιστεί το feedback

    try {
        // Ασύγχρονο αίτημα POST στο API για τη δημιουργία της ταινίας
        const response = await fetch(`${API_BASE_URL}/movies`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }, // Δηλώνουμε ότι στέλνουμε δεδομένα μορφής JSON
            body: JSON.stringify({ title, genres }) // Μετατροπή του αντικειμένου JS σε κείμενο JSON
        });

        // Μετατροπή της απάντησης του backend σε αντικείμενο JavaScript
        const data = await response.json();

        // Έλεγχος αν η προσθήκη στη βάση δεδομένων ήταν επιτυχής
        if (data.status === 'success') {
            // Εμφάνιση πράσινου μηνύματος επιτυχίας μαζί με το ID που παρήγαγε η SQLite
            messageDiv.innerHTML = `<p class="success">Movie added successfully! (ID: ${data.movieId})</p>`;

            // Αποθήκευση της νέας ταινίας μαζί με το ID που έδωσε η SQLite
            addedMovies.push({ movieId: data.movieId, title, genres });
            sessionStorage.setItem('addedMovies', JSON.stringify(addedMovies));

            // Ανανέωση του πίνακα στην οθόνη
            displayAddedMovies();

            document.getElementById('add-movie-form').reset(); // Καθαρισμός των πεδίων της φόρμας
        } else {
            // Εμφάνιση κόκκινου μηνύματος σε περίπτωση αποτυχίας από το backend
            messageDiv.innerHTML = `<p class="error">Error adding movie.</p>`;
        }
    } catch (error) {
        // Διαχείριση σφαλμάτων σε περίπτωση που το backend είναι κλειστό ή δεν υπάρχει δίκτυο
        messageDiv.innerHTML = `<p class="error">Connection error to the backend.</p>`;
    }
});

// Εμφανίζει τις ταινίες που προστέθηκαν στο τρέχον session
function displayAddedMovies() {
    const messageDiv = document.getElementById('add-movie-message');

    // Αν δεν υπάρχουν ταινίες στο session, καθαρίζουμε το div (εκτός αν υπάρχει μήνυμα επιτυχίας)
    if (addedMovies.length === 0) return;

    let html = `
        <div style="margin-top: 1.5rem;">
            <h3>Movies Added in this Session:</h3>
            <table>
                <tr>
                    <th>ID</th>
                    <th>Title</th>
                    <th>Genres</th>
                    <th>Rate It!</th>
                </tr>
    `;

    addedMovies.forEach(movie => {
        html += `
            <tr>
                <td>${movie.movieId}</td>
                <td>${movie.title}</td>
                <td>${movie.genres}</td>
                <td>
                    <input type="number" id="rate-${movie.movieId}" min="0.5" max="5" step="0.5" placeholder="0.5-5" style="width: 60px;">
                    <button onclick="rateMovie(${movie.movieId})">Rate</button>
                </td>
            </tr>
        `;
    });

    html += `</table></div>`;

    // Κρατάμε το τρέχον μήνυμα επιτυχίας/σφάλματος αν υπάρχει, και κολλάμε από κάτω τον πίνακα
    const currentFeedback = messageDiv.querySelector('p') ? messageDiv.querySelector('p').outerHTML : '';
    messageDiv.innerHTML = currentFeedback + html;
}
displayAddedMovies();

// =========================================================================
// ΛΕΙΤΟΥΡΓΙΚΟΤΗΤΑ 2: ΑΝΑΖΗΤΗΣΗ ΤΑΙΝΙΩΝ & ΔΥΝΑΜΙΚΟΣ ΜΕΣΟΣ ΟΡΟΣ (GET REQUESTS)
// =========================================================================

// Ακρόαση του click στο κουμπί αναζήτησης
document.getElementById('search-btn').addEventListener('click', async () => {
    const keyword = document.getElementById('search-input').value; // Λήψη της λέξης-κλειδιού
    const resultsDiv = document.getElementById('search-results');   // Το div που θα φιλοξενήσει τον πίνακα αποτελεσμάτων

    // Έλεγχος εγκυρότητας: Αν το πεδίο είναι άδειο, σταματάμε την εκτέλεση
    if (!keyword) {
        resultsDiv.innerHTML = '<p class="error">Please enter a keyword.</p>';
        return;
    }

    // Προσωρινό μήνυμα αναμονής για τον χρήστη
    resultsDiv.innerHTML = '<p>Searching...</p>';

    try {
        // 1ο Fetch: Αναζήτηση ταινιών με βάση το keyword (χρήση encodeURIComponent για ασφαλή χαρακτήρες στο URL)
        const response = await fetch(`${API_BASE_URL}/movies?search=${encodeURIComponent(keyword)}`);
        const data = await response.json();

        // Αν δεν βρεθεί καμία ταινία, ενημερώνουμε κατάλληλα το UI
        if (data.movies.length === 0) {
            resultsDiv.innerHTML = '<p>No movies found.</p>';
            return;
        }

        // Αρχικοποίηση του HTML string για τη δημιουργία της δομής του πίνακα αποτελεσμάτων
        let html = `
            <table>
                <tr>
                    <th>ID</th>
                    <th>Title</th>
                    <th>Genres</th>
                    <th>Avg Rating</th>
                    <th>Rate It!</th>
                </tr>
        `;

        // Loop σε κάθε ταινία που επέστρεψε η αναζήτηση για τον υπολογισμό των ratings
        for (const movie of data.movies) {
            // 2ο Fetch (Nested): Ζητάμε όλες τις υπάρχουσες βαθμολογίες για τη συγκεκριμένη ταινία
            const ratingsResponse = await fetch(`${API_BASE_URL}/ratings/${movie.movieId}`);
            const ratingsData = await ratingsResponse.json();

            // Δημιουργούμε ένα τοπικό αντίγραφο των βαθμολογιών
            let allRatings = [...ratingsData.ratings];

            // Ελέγχουμε αν ο χρήστης έχει βαθμολογήσει αυτή την ταινία σε αυτό το session
            const sessionRating = userRatings.find(r => r.movieId === movie.movieId);
            if (sessionRating) {
                // Αν τη βαθμολόγησε, την προσθέτουμε "εικονικά" στον πίνακα για τον σωστό υπολογισμό
                allRatings.push({ rating: sessionRating.rating });
            }

            let avgRating = 'N/A'; // Προεπιλεγμένη τιμή αν η ταινία δεν έχει βαθμολογηθεί ποτέ

            // Υπολογισμός με βάση ενημερωμένο σύνολο βαθμολογιών
            if (allRatings.length > 0) {
                const sum = allRatings.reduce((acc, curr) => acc + curr.rating, 0);
                avgRating = (sum / allRatings.length).toFixed(2);
            }

            // Δυναμική προσθήκη μιας γραμμής (row) στον πίνακα για κάθε ταινία
            html += `
                <tr>
                    <td>${movie.movieId}</td>
                    <td>${movie.title}</td>
                    <td>${movie.genres}</td>
                    <td>${avgRating}</td>
                    <td>
                        <input type="number" id="rate-${movie.movieId}" min="0.5" max="5" step="0.5" placeholder="0.5-5" style="width: 60px;">
                        <button onclick="rateMovie(${movie.movieId})">Rate</button>
                    </td>
                </tr>
            `;
        }

        html += `</table>`; // Κλείσιμο του πίνακα
        resultsDiv.innerHTML = html; // Εισαγωγή όλης της δομής HTML στο UI με ένα μόνο layout update (DOM injection)

    } catch (error) {
        // Διαχείριση σφαλμάτων κατά την ανάκτηση των δεδομένων
        resultsDiv.innerHTML = `<p class="error">Error fetching movies.</p>`;
    }
});

// =========================================================================
// ΛΕΙΤΟΥΡΓΙΚΟΤΗΤΑ 3: ΒΑΘΜΟΛΟΓΗΣΗ ΤΑΙΝΙΑΣ (IN-MEMORY SESSION STORAGE)
// =========================================================================

// Προσάρτηση της συνάρτησης στο καθολικό αντικείμενο 'window' 
// για να είναι προσβάσιμη από τα inline 'onclick' attributes του δυναμικού πίνακα
window.rateMovie = async function (movieId) {
    // Λήψη της τιμής από το input πεδίο της συγκεκριμένης ταινίας
    const ratingInput = document.getElementById(`rate-${movieId}`).value;
    const rating = parseFloat(ratingInput); // Μετατροπή του κειμένου σε δεκαδικό αριθμό

    // Έλεγχος εγκυρότητας: Ο βαθμός πρέπει να είναι αριθμός εντός του ορίου 0.5 - 5.0
    if (isNaN(rating) || rating < 0.5 || rating > 5.0) {
        alert("Please enter a valid rating between 0.5 and 5.0");
        return;
    }

    // Έλεγχος αν ο χρήστης έχει ήδη βαθμολογήσει αυτή την ταινία στο τρέχον session
    const existingIndex = userRatings.findIndex(r => r.movieId === movieId);

    if (existingIndex > -1) {
        // Αν υπάρχει ήδη, ενημερώνουμε απλά την υπάρχουσα βαθμολογία (Update)
        userRatings[existingIndex].rating = rating;
    } else {
        // Αν είναι νέα βαθμολογία, την προσθέτουμε στον πίνακα (Insert/Push)
        userRatings.push({ movieId, rating });
    }

    // Μετατρέπουμε τον πίνακα σε string και τον σώζουμε στο sessionStorage
    sessionStorage.setItem('userRatings', JSON.stringify(userRatings));

    // Ζωντανή ανανέωση του μέσου όρου στην οθόνη χωρίς refresh!
    try {
        // Ξαναζητάμε τις βαθμολογίες της βάσης
        const ratingsResponse = await fetch(`${API_BASE_URL}/ratings/${movieId}`);
        const ratingsData = await ratingsResponse.json();

        let allRatings = [...ratingsData.ratings];
        allRatings.push({ rating: rating }); // Προσθέτουμε τη νέα/ανανεωμένη ψήφο μας

        // Επανυπολογισμός
        const sum = allRatings.reduce((acc, curr) => acc + curr.rating, 0);
        const newAvg = (sum / allRatings.length).toFixed(2);

        // Εύρεση του συγκεκριμένου κελιού στον πίνακα και ενημέρωση της τιμής του
        const avgCell = document.getElementById(`avg-${movieId}`);
        if (avgCell) {
            avgCell.innerHTML = `<strong>${newAvg}</strong>`; // Το βάζουμε και με bold για να ξεχωρίζει η αλλαγή!
        }
    } catch (err) {
        console.log("Could not dynamically update average rating in UI.");
    }

    // Εμφάνιση μηνύματος επιβεβαίωσης στον χρήστη
    alert(`Rated movie ${movieId} with ${rating} stars!`);
};

// =========================================================================
// ΛΕΙΤΟΥΡΓΙΚΟΤΗΤΑ 4: ΛΗΨΗ ΠΡΟΣΩΠΙΚΩΝ ΣΥΣΤΑΣΕΩΝ (POST REQUEST)
// =========================================================================

// Ακρόαση του click στο κουμπί "Get Recommendations"
document.getElementById('get-recommendations-btn').addEventListener('click', async () => {
    const recsDiv = document.getElementById('recommendations-results'); // Το div των αποτελεσμάτων

    // Έλεγχος εγκυρότητας: Ο χρήστης πρέπει να έχει βαθμολογήσει τουλάχιστον 1 ταινία για να δουλέψει ο Pearson
    if (userRatings.length === 0) {
        recsDiv.innerHTML = '<p class="error">Please search and rate at least one movie first!</p>';
        return;
    }

    // Μήνυμα ενημέρωσης ότι ο αλγόριθμος εκτελείται στο backend
    recsDiv.innerHTML = '<p>Crunching numbers and finding best matches...</p>';

    try {
        // Ασύγχρονο αίτημα POST στέλνοντας ολόκληρο τον πίνακα 'userRatings' στο backend
        const response = await fetch(`${API_BASE_URL}/recommendations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ratings: userRatings }) // Το backend περιμένει object με κλειδί "ratings"
        });

        const data = await response.json();

        // Αν ο αλγόριθμος δεν βρει κοινά δεδομένα με άλλους χρήστες για να παράγει συστάσεις
        if (data.recommendations.length === 0) {
            recsDiv.innerHTML = '<p>Not enough data to make recommendations. Try rating more popular movies.</p>';
            return;
        }

        // Αρχικοποίηση πίνακα για την παρουσίαση των προτεινόμενων ταινιών
        let html = `
            <table>
                <tr>
                    <th>Title</th>
                    <th>Genres</th>
                    <th>Predicted Rating</th>
                </tr>
        `;

        // Διάσχιση των προτεινόμενων ταινιών (Recommendations) που επέστρεψε ο αλγόριθμος
        data.recommendations.forEach(rec => {
            html += `
                <tr>
                    <td>${rec.title}</td>
                    <td>${rec.genres}</td>
                    <td><strong>${rec.predictedRating}</strong></td>
                </tr>
            `;
        });

        html += `</table>`;
        recsDiv.innerHTML = html; // Εμφάνιση του πίνακα συστάσεων στην οθόνη
    } catch (error) {
        // Διαχείριση σφαλμάτων δικτύου ή backend κατά τη λήψη συστάσεων
        recsDiv.innerHTML = `<p class="error">Error fetching recommendations.</p>`;
    }
});