const API_BASE_URL = 'http://127.0.0.1:8000/movielens/api';

// Εδώ θα αποθηκεύουμε τις βαθμολογίες του χρήστη (προσωρινά στη μνήμη του browser)
let userRatings = [];

// --- 1. ΠΡΟΣΘΗΚΗ ΤΑΙΝΙΑΣ ---
document.getElementById('add-movie-form').addEventListener('submit', async (e) => {
    e.preventDefault(); // Αποτρέπει την ανανέωση της σελίδας
    
    const title = document.getElementById('movie-title').value;
    const genres = document.getElementById('movie-genres').value;
    const messageDiv = document.getElementById('add-movie-message');

    try {
        const response = await fetch(`${API_BASE_URL}/movies`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, genres })
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            messageDiv.innerHTML = `<p class="success">Movie added successfully! (ID: ${data.movieId})</p>`;
            document.getElementById('add-movie-form').reset(); // Καθαρισμός φόρμας
        } else {
            messageDiv.innerHTML = `<p class="error">Error adding movie.</p>`;
        }
    } catch (error) {
        messageDiv.innerHTML = `<p class="error">Connection error to the backend.</p>`;
    }
});

// --- 2. ΑΝΑΖΗΤΗΣΗ & ΕΜΦΑΝΙΣΗ ΜΕΣΟΥ ΟΡΟΥ ΒΑΘΜΟΛΟΓΙΑΣ ---
document.getElementById('search-btn').addEventListener('click', async () => {
    const keyword = document.getElementById('search-input').value;
    const resultsDiv = document.getElementById('search-results');
    
    if (!keyword) {
        resultsDiv.innerHTML = '<p class="error">Please enter a keyword.</p>';
        return;
    }

    resultsDiv.innerHTML = '<p>Searching...</p>';

    try {
        const response = await fetch(`${API_BASE_URL}/movies?search=${encodeURIComponent(keyword)}`);
        const data = await response.json();

        if (data.movies.length === 0) {
            resultsDiv.innerHTML = '<p>No movies found.</p>';
            return;
        }

        // Δημιουργία πίνακα για τα αποτελέσματα
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

        for (const movie of data.movies) {
            // Για κάθε ταινία, ζητάμε τις βαθμολογίες της για να βρούμε τον μέσο όρο
            const ratingsResponse = await fetch(`${API_BASE_URL}/ratings/${movie.movieId}`);
            const ratingsData = await ratingsResponse.json();
            
            let avgRating = 'N/A';
            if (ratingsData.ratings.length > 0) {
                const sum = ratingsData.ratings.reduce((acc, curr) => acc + curr.rating, 0);
                avgRating = (sum / ratingsData.ratings.length).toFixed(2);
            }

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
        
        html += `</table>`;
        resultsDiv.innerHTML = html;

    } catch (error) {
        resultsDiv.innerHTML = `<p class="error">Error fetching movies.</p>`;
    }
});

// --- 3. ΒΑΘΜΟΛΟΓΗΣΗ ΤΑΙΝΙΑΣ (Αποθήκευση στη μνήμη) ---
window.rateMovie = function(movieId) {
    const ratingInput = document.getElementById(`rate-${movieId}`).value;
    const rating = parseFloat(ratingInput);

    if (isNaN(rating) || rating < 0.5 || rating > 5.0) {
        alert("Please enter a valid rating between 0.5 and 5.0");
        return;
    }

    // Ελέγχουμε αν την έχουμε ξαναβαθμολογήσει στο ίδιο session
    const existingIndex = userRatings.findIndex(r => r.movieId === movieId);
    if (existingIndex > -1) {
        userRatings[existingIndex].rating = rating;
    } else {
        userRatings.push({ movieId, rating });
    }

    alert(`Rated movie ${movieId} with ${rating} stars!`);
};

// --- 4. ΛΗΨΗ ΣΥΣΤΑΣΕΩΝ ---
document.getElementById('get-recommendations-btn').addEventListener('click', async () => {
    const recsDiv = document.getElementById('recommendations-results');

    if (userRatings.length === 0) {
        recsDiv.innerHTML = '<p class="error">Please search and rate at least one movie first!</p>';
        return;
    }

    recsDiv.innerHTML = '<p>Crunching numbers and finding best matches...</p>';

    try {
        const response = await fetch(`${API_BASE_URL}/recommendations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ratings: userRatings })
        });

        const data = await response.json();

        if (data.recommendations.length === 0) {
            recsDiv.innerHTML = '<p>Not enough data to make recommendations. Try rating more popular movies.</p>';
            return;
        }

        let html = `
            <table>
                <tr>
                    <th>Title</th>
                    <th>Genres</th>
                    <th>Predicted Rating</th>
                </tr>
        `;

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
        recsDiv.innerHTML = html;

    } catch (error) {
        recsDiv.innerHTML = `<p class="error">Error fetching recommendations.</p>`;
    }
});