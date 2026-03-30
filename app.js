class FlashCardsApp {
    constructor() {
        this.currentDeckId = null;
        this.currentCardIndex = 0;
        this.studyCards = [];
        this.isFlipped = false;
        this.data = {
            decks: [],
            stats: {
                lastStudyDate: null,
                streak: 0,
                reviewsToday: 0
            }
        };
        this.init();
    }

    init() {
        this.loadData();
        this.updateStreak();
        this.renderHome();
    }

    // === DATA MANAGEMENT ===
    loadData() {
        const saved = localStorage.getItem('flashcards-data');
        if (saved) {
            this.data = JSON.parse(saved);
            // Migrate old data if needed
            if (!this.data.stats) {
                this.data.stats = {
                    lastStudyDate: null,
                    streak: 0,
                    reviewsToday: 0
                };
            }
        }
    }

    saveData() {
        localStorage.setItem('flashcards-data', JSON.stringify(this.data));
    }

    // === SPACED REPETITION ALGORITHM (SM-2) ===
    calculateNextReview(card, grade) {
        const now = Date.now();
        
        if (!card.efactor) card.efactor = 2.5;
        if (!card.interval) card.interval = 0;
        if (!card.repetitions) card.repetitions = 0;

        if (grade >= 3) {
            if (card.repetitions === 0) {
                card.interval = 1;
            } else if (card.repetitions === 1) {
                card.interval = 6;
            } else {
                card.interval = Math.round(card.interval * card.efactor);
            }
            card.repetitions++;
        } else {
            card.repetitions = 0;
            card.interval = 1;
        }

        card.efactor = card.efactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
        if (card.efactor < 1.3) card.efactor = 1.3;

        // Set next review date based on grade
        let minutes;
        switch(grade) {
            case 1: minutes = 1; break;
            case 2: minutes = 10; break;
            case 3: minutes = 1440; break; // 1 day
            case 4: minutes = 5760; break; // 4 days
            default: minutes = 1;
        }

        card.nextReview = now + (minutes * 60 * 1000);
        card.lastReview = now;
    }

    isDue(card) {
        if (!card.nextReview) return true;
        return Date.now() >= card.nextReview;
    }

    // === STREAK MANAGEMENT ===
    updateStreak() {
        const today = new Date().toDateString();
        const lastDate = this.data.stats.lastStudyDate ? new Date(this.data.stats.lastStudyDate).toDateString() : null;
        
        if (lastDate === today) {
            // Already studied today, keep streak
            return;
        }
        
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toDateString();
        
        if (lastDate === yesterdayStr) {
            // Studied yesterday, continue streak
            // Will be incremented when actually studying
        } else if (lastDate !== null) {
            // Missed a day, reset streak
            this.data.stats.streak = 0;
        }
        
        // Reset daily reviews counter
        this.data.stats.reviewsToday = 0;
        this.saveData();
    }

    incrementStreak() {
        const today = new Date().toDateString();
        const lastDate = this.data.stats.lastStudyDate ? new Date(this.data.stats.lastStudyDate).toDateString() : null;
        
        if (lastDate !== today) {
            this.data.stats.streak++;
            this.data.stats.lastStudyDate = Date.now();
            this.saveData();
        }
    }

    // === SCREEN MANAGEMENT ===
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');

        if (screenId === 'home-screen') {
            this.renderHome();
        } else if (screenId === 'stats-screen') {
            this.renderStats();
        }
    }

    // === HOME SCREEN ===
    renderHome() {
        const decksList = document.getElementById('decks-list');
        decksList.innerHTML = '';

        if (this.data.decks.length === 0) {
            decksList.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-secondary);">Нет колод. Создайте первую колоду!</div>';
        } else {
            this.data.decks.forEach(deck => {
                const dueCards = deck.cards.filter(c => this.isDue(c)).length;
                const totalCards = deck.cards.length;
                
                const deckEl = document.createElement('div');
                deckEl.className = 'deck-card';
                deckEl.innerHTML = `
                    <h3>${this.escapeHtml(deck.name)}</h3>
                    ${deck.description ? `<p>${this.escapeHtml(deck.description)}</p>` : ''}
                    <div class="deck-stats">
                        <span>К изучению <strong>${dueCards}</strong></span>
                        <span>Всего <strong>${totalCards}</strong></span>
                    </div>
                    <div class="deck-actions">
                        <button class="btn btn-primary" onclick="app.startStudy('${deck.id}')" ${dueCards === 0 ? 'disabled' : ''}>
                            ${dueCards > 0 ? 'Изучать' : 'Завершено'}
                        </button>
                        <button class="btn btn-secondary" onclick="app.viewDeckCards('${deck.id}')">
                            Карточки
                        </button>
                        <button class="delete-btn" onclick="app.deleteDeck('${deck.id}')">Удалить</button>
                    </div>
                `;
                decksList.appendChild(deckEl);
            });
        }

        this.updateHomeStats();
    }

    updateHomeStats() {
        const totalCards = this.data.decks.reduce((sum, d) => sum + d.cards.length, 0);
        const dueCards = this.data.decks.reduce((sum, d) => 
            sum + d.cards.filter(c => this.isDue(c)).length, 0);

        document.getElementById('total-cards').textContent = totalCards;
        document.getElementById('cards-due').textContent = dueCards;
        document.getElementById('streak').textContent = this.data.stats.streak;
    }

    // === DECK MANAGEMENT ===
    addDeck() {
        const nameInput = document.getElementById('deck-name-input');
        const descInput = document.getElementById('deck-description-input');
        
        const name = nameInput.value.trim();
        if (!name) {
            alert('Введите название колоды');
            return;
        }

        const deck = {
            id: Date.now().toString(),
            name: name,
            description: descInput.value.trim(),
            cards: [],
            createdAt: Date.now()
        };

        this.data.decks.push(deck);
        this.saveData();

        nameInput.value = '';
        descInput.value = '';
        
        this.showScreen('home-screen');
    }

    deleteDeck(deckId) {
        if (confirm('Удалить эту колоду и все её карточки?')) {
            this.data.decks = this.data.decks.filter(d => d.id !== deckId);
            this.saveData();
            this.renderHome();
        }
    }

    // === CARD MANAGEMENT ===
    viewDeckCards(deckId) {
        this.currentDeckId = deckId;
        const deck = this.data.decks.find(d => d.id === deckId);
        
        document.getElementById('deck-cards-name').textContent = deck.name;
        this.renderCardsList();
        this.showScreen('deck-cards-screen');
    }

    renderCardsList(filter = '') {
        const deck = this.data.decks.find(d => d.id === this.currentDeckId);
        const cardsList = document.getElementById('cards-list');
        cardsList.innerHTML = '';

        let cards = deck.cards;
        if (filter) {
            const lowerFilter = filter.toLowerCase();
            cards = cards.filter(c => 
                c.front.toLowerCase().includes(lowerFilter) ||
                c.back.toLowerCase().includes(lowerFilter) ||
                (c.tags && c.tags.some(t => t.toLowerCase().includes(lowerFilter)))
            );
        }

        if (cards.length === 0) {
            cardsList.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-secondary);">Нет карточек</div>';
            return;
        }

        cards.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = 'card-item';
            cardEl.innerHTML = `
                <div class="card-item-header">
                    <button class="delete-btn" onclick="app.deleteCard('${card.id}')">Удалить</button>
                </div>
                <div class="card-item-front">${this.escapeHtml(card.front)}</div>
                <div class="card-item-back">${this.escapeHtml(card.back)}</div>
                ${card.tags && card.tags.length > 0 ? `
                    <div class="card-item-tags">
                        ${card.tags.map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`).join('')}
                    </div>
                ` : ''}
            `;
            cardsList.appendChild(cardEl);
        });
    }

    filterCards() {
        const filter = document.getElementById('search-input').value;
        this.renderCardsList(filter);
    }

    showAddCardScreen() {
        this.showScreen('add-card-screen');
    }

    addCard() {
        const frontInput = document.getElementById('card-front-input');
        const backInput = document.getElementById('card-back-input');
        const tagsInput = document.getElementById('card-tags-input');

        const front = frontInput.value.trim();
        const back = backInput.value.trim();

        if (!front || !back) {
            alert('Заполните обе стороны карточки');
            return;
        }

        const tags = tagsInput.value.split(',').map(t => t.trim()).filter(t => t);

        const card = {
            id: Date.now().toString(),
            front: front,
            back: back,
            tags: tags,
            createdAt: Date.now(),
            nextReview: Date.now(),
            lastReview: null,
            interval: 0,
            repetitions: 0,
            efactor: 2.5
        };

        const deck = this.data.decks.find(d => d.id === this.currentDeckId);
        deck.cards.push(card);
        this.saveData();

        frontInput.value = '';
        backInput.value = '';
        tagsInput.value = '';

        this.viewDeckCards(this.currentDeckId);
    }

    deleteCard(cardId) {
        if (confirm('Удалить эту карточку?')) {
            const deck = this.data.decks.find(d => d.id === this.currentDeckId);
            deck.cards = deck.cards.filter(c => c.id !== cardId);
            this.saveData();
            this.renderCardsList();
        }
    }

    // === STUDY MODE ===
    startStudy(deckId) {
        this.currentDeckId = deckId;
        const deck = this.data.decks.find(d => d.id === deckId);
        
        this.studyCards = deck.cards.filter(c => this.isDue(c));
        
        if (this.studyCards.length === 0) {
            alert('Нет карточек для изучения');
            return;
        }

        // Shuffle cards
        this.studyCards.sort(() => Math.random() - 0.5);
        
        this.currentCardIndex = 0;
        document.getElementById('deck-name').textContent = deck.name;
        document.getElementById('study-complete').style.display = 'none';
        
        this.showScreen('study-screen');
        this.showCard();
    }

    showCard() {
        if (this.currentCardIndex >= this.studyCards.length) {
            this.completeStudy();
            return;
        }

        const card = this.studyCards[this.currentCardIndex];
        const flashcard = document.getElementById('flashcard');
        
        flashcard.classList.remove('flipped');
        this.isFlipped = false;

        document.querySelector('#card-front .card-content').textContent = card.front;
        document.querySelector('#card-back .card-content').textContent = card.back;
        
        document.getElementById('answer-buttons').style.display = 'none';
        
        this.updateProgress();
    }

    flipCard() {
        const flashcard = document.getElementById('flashcard');
        flashcard.classList.toggle('flipped');
        this.isFlipped = !this.isFlipped;

        if (this.isFlipped) {
            document.getElementById('answer-buttons').style.display = 'grid';
        }
    }

    answerCard(grade) {
        const card = this.studyCards[this.currentCardIndex];
        const deck = this.data.decks.find(d => d.id === this.currentDeckId);
        const deckCard = deck.cards.find(c => c.id === card.id);

        this.calculateNextReview(deckCard, grade);
        this.data.stats.reviewsToday++;
        this.incrementStreak();
        this.saveData();

        this.currentCardIndex++;
        this.showCard();
    }

    updateProgress() {
        const progress = (this.currentCardIndex / this.studyCards.length) * 100;
        document.getElementById('study-progress').style.width = progress + '%';
    }

    completeStudy() {
        document.querySelector('.card-container').style.display = 'none';
        document.getElementById('answer-buttons').style.display = 'none';
        document.getElementById('study-complete').style.display = 'block';
    }

    // === STATS ===
    renderStats() {
        const totalCards = this.data.decks.reduce((sum, d) => sum + d.cards.length, 0);
        const learnedCards = this.data.decks.reduce((sum, d) => 
            sum + d.cards.filter(c => c.repetitions > 0).length, 0);
        const newCards = totalCards - learnedCards;

        document.getElementById('stat-total-cards').textContent = totalCards;
        document.getElementById('stat-learned-cards').textContent = learnedCards;
        document.getElementById('stat-new-cards').textContent = newCards;
        document.getElementById('stat-reviews-today').textContent = this.data.stats.reviewsToday;
        document.getElementById('stat-streak').textContent = this.data.stats.streak;
    }

    // === IMPORT/EXPORT ===
    exportData() {
        const dataStr = JSON.stringify(this.data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `flashcards-backup-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                if (confirm('Это заменит все текущие данные. Продолжить?')) {
                    this.data = imported;
                    this.saveData();
                    this.renderHome();
                    alert('Данные успешно импортированы!');
                }
            } catch (err) {
                alert('Ошибка при импорте данных: ' + err.message);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    confirmClearData() {
        if (confirm('Удалить все данные? Это действие необратимо!')) {
            if (confirm('Вы уверены? Все колоды и карточки будут удалены!')) {
                this.data = {
                    decks: [],
                    stats: {
                        lastStudyDate: null,
                        streak: 0,
                        reviewsToday: 0
                    }
                };
                this.saveData();
                this.showScreen('home-screen');
            }
        }
    }

    // === UTILITIES ===
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize app
const app = new FlashCardsApp();

// Re-show study screen properly when returning
document.addEventListener('DOMContentLoaded', () => {
    const studyScreen = document.getElementById('study-screen');
    if (studyScreen.classList.contains('active')) {
        document.querySelector('.card-container').style.display = 'flex';
    }
});
