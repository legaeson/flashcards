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
            try {
                const parsed = JSON.parse(saved);
                if (parsed && Array.isArray(parsed.decks)) {
                    this.data = parsed;
                }
            } catch (err) {
                console.warn('Corrupted localStorage data, starting fresh:', err);
            }
            // Migrate old data if needed
            if (!this.data.stats || typeof this.data.stats !== 'object') {
                this.data.stats = {
                    lastStudyDate: null,
                    streak: 0,
                    reviewsToday: 0
                };
            }
            if (!Array.isArray(this.data.decks)) {
                this.data.decks = [];
            }
        }
    }

    saveData() {
        try {
            localStorage.setItem('flashcards-data', JSON.stringify(this.data));
        } catch (err) {
            console.warn('Could not save data (quota/private mode?):', err);
        }
    }

    generateId() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    }

    // === SPACED REPETITION ALGORITHM (SM-2) ===
    // interval is stored in days. Grades 1-2 are short lapses (minutes),
    // grades 3+ advance the SM-2 schedule.
    calculateNextReview(card, grade) {
        const now = Date.now();

        if (typeof card.efactor !== 'number') card.efactor = 2.5;
        if (typeof card.interval !== 'number') card.interval = 0;
        if (typeof card.repetitions !== 'number') card.repetitions = 0;

        // Update efactor first (standard SM-2 order)
        card.efactor = card.efactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
        if (card.efactor < 1.3) card.efactor = 1.3;

        let minutes;
        if (grade < 3) {
            card.repetitions = 0;
            card.interval = 0;
            minutes = grade === 1 ? 1 : 10;
        } else {
            if (card.repetitions === 0) {
                card.interval = 1;
            } else if (card.repetitions === 1) {
                card.interval = 6;
            } else {
                card.interval = Math.round(card.interval * card.efactor);
            }
            card.repetitions++;
            // Easy (4-5) schedules ~30% further out than Good (3)
            const easyMultiplier = grade >= 4 ? 1.3 : 1;
            minutes = Math.round(card.interval * 1440 * easyMultiplier);
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
        const target = document.getElementById(screenId);
        if (!target) {
            console.warn('Unknown screen:', screenId);
            return;
        }
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        target.classList.add('active');

        if (screenId === 'home-screen') {
            this.renderHome();
        } else if (screenId === 'stats-screen') {
            this.renderStats();
        } else if (screenId === 'deck-cards-screen') {
            this.renderCardsList(this.getCurrentFilter());
        }
    }

    getCurrentFilter() {
        const input = document.getElementById('search-input');
        return input ? input.value : '';
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

                const title = document.createElement('h3');
                title.textContent = deck.name;
                deckEl.appendChild(title);

                if (deck.description) {
                    const desc = document.createElement('p');
                    desc.textContent = deck.description;
                    deckEl.appendChild(desc);
                }

                const stats = document.createElement('div');
                stats.className = 'deck-stats';
                const dueSpan = document.createElement('span');
                dueSpan.textContent = 'К изучению ';
                const dueStrong = document.createElement('strong');
                dueStrong.textContent = dueCards;
                dueSpan.appendChild(dueStrong);
                const totalSpan = document.createElement('span');
                totalSpan.textContent = 'Всего ';
                const totalStrong = document.createElement('strong');
                totalStrong.textContent = totalCards;
                totalSpan.appendChild(totalStrong);
                stats.appendChild(dueSpan);
                stats.appendChild(totalSpan);
                deckEl.appendChild(stats);

                const actions = document.createElement('div');
                actions.className = 'deck-actions';

                const studyBtn = document.createElement('button');
                studyBtn.className = 'btn btn-primary';
                studyBtn.textContent = dueCards > 0 ? 'Изучать' : 'Завершено';
                studyBtn.disabled = dueCards === 0;
                studyBtn.addEventListener('click', () => this.startStudy(deck.id));

                const cardsBtn = document.createElement('button');
                cardsBtn.className = 'btn btn-secondary';
                cardsBtn.textContent = 'Карточки';
                cardsBtn.addEventListener('click', () => this.viewDeckCards(deck.id));

                const delBtn = document.createElement('button');
                delBtn.className = 'delete-btn';
                delBtn.textContent = 'Удалить';
                delBtn.addEventListener('click', () => this.deleteDeck(deck.id));

                actions.appendChild(studyBtn);
                actions.appendChild(cardsBtn);
                actions.appendChild(delBtn);
                deckEl.appendChild(actions);

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
            id: this.generateId(),
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
        const deck = this.data.decks.find(d => d.id === deckId);
        if (!deck) {
            console.warn('Deck not found:', deckId);
            this.showScreen('home-screen');
            return;
        }
        this.currentDeckId = deckId;

        document.getElementById('deck-cards-name').textContent = deck.name;
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.value = '';
        this.renderCardsList();
        this.showScreen('deck-cards-screen');
    }

    renderCardsList(filter = '') {
        const deck = this.data.decks.find(d => d.id === this.currentDeckId);
        const cardsList = document.getElementById('cards-list');
        cardsList.innerHTML = '';

        if (!deck || !Array.isArray(deck.cards)) {
            cardsList.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-secondary);">Нет карточек</div>';
            return;
        }

        const toText = (v) => (typeof v === 'string' ? v : (v == null ? '' : String(v)));

        let cards = deck.cards;
        if (filter) {
            const lowerFilter = filter.toLowerCase();
            cards = cards.filter(c => {
                const front = toText(c.front).toLowerCase();
                const back = toText(c.back).toLowerCase();
                const tagHit = Array.isArray(c.tags) && c.tags.some(t => toText(t).toLowerCase().includes(lowerFilter));
                return front.includes(lowerFilter) || back.includes(lowerFilter) || tagHit;
            });
        }

        if (cards.length === 0) {
            cardsList.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-secondary);">Нет карточек</div>';
            return;
        }

        cards.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = 'card-item';

            const header = document.createElement('div');
            header.className = 'card-item-header';
            const delBtn = document.createElement('button');
            delBtn.className = 'delete-btn';
            delBtn.textContent = 'Удалить';
            delBtn.addEventListener('click', () => this.deleteCard(card.id));
            header.appendChild(delBtn);
            cardEl.appendChild(header);

            const frontEl = document.createElement('div');
            frontEl.className = 'card-item-front';
            frontEl.textContent = toText(card.front);
            cardEl.appendChild(frontEl);

            const backEl = document.createElement('div');
            backEl.className = 'card-item-back';
            backEl.textContent = toText(card.back);
            cardEl.appendChild(backEl);

            if (Array.isArray(card.tags) && card.tags.length > 0) {
                const tagsEl = document.createElement('div');
                tagsEl.className = 'card-item-tags';
                card.tags.forEach(tag => {
                    const tagEl = document.createElement('span');
                    tagEl.className = 'tag';
                    tagEl.textContent = toText(tag);
                    tagsEl.appendChild(tagEl);
                });
                cardEl.appendChild(tagsEl);
            }

            cardsList.appendChild(cardEl);
        });
    }

    filterCards() {
        const filter = document.getElementById('search-input').value;
        this.renderCardsList(filter);
    }

    showAddCardScreen() {
        if (!this.data.decks.some(d => d.id === this.currentDeckId)) {
            alert('Сначала выберите колоду');
            this.showScreen('home-screen');
            return;
        }
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
            id: this.generateId(),
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
        if (!deck) {
            alert('Колода не найдена');
            this.showScreen('home-screen');
            return;
        }
        if (!Array.isArray(deck.cards)) deck.cards = [];
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
            if (!deck || !Array.isArray(deck.cards)) return;
            deck.cards = deck.cards.filter(c => c.id !== cardId);
            this.saveData();
            this.renderCardsList(this.getCurrentFilter());
        }
    }

    // === STUDY MODE ===
    startStudy(deckId) {
        const deck = this.data.decks.find(d => d.id === deckId);
        if (!deck || !Array.isArray(deck.cards)) {
            alert('Колода не найдена');
            return;
        }
        this.currentDeckId = deckId;

        this.studyCards = deck.cards.filter(c => this.isDue(c));

        if (this.studyCards.length === 0) {
            alert('Нет карточек для изучения');
            return;
        }

        // Fisher-Yates shuffle (uniform)
        for (let i = this.studyCards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.studyCards[i], this.studyCards[j]] = [this.studyCards[j], this.studyCards[i]];
        }

        this.currentCardIndex = 0;
        document.getElementById('deck-name').textContent = deck.name;
        document.getElementById('study-complete').style.display = 'none';
        const container = document.querySelector('.card-container');
        if (container) container.style.display = 'flex';

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
        if (!card) return;
        const deck = this.data.decks.find(d => d.id === this.currentDeckId);
        if (!deck || !Array.isArray(deck.cards)) return;
        const deckCard = deck.cards.find(c => c.id === card.id);
        if (!deckCard) return;

        this.calculateNextReview(deckCard, grade);
        this.data.stats.reviewsToday++;
        this.incrementStreak();
        this.saveData();

        this.currentCardIndex++;
        this.showCard();
    }

    updateProgress() {
        const total = this.studyCards.length || 1;
        const progress = Math.min(100, (this.currentCardIndex / total) * 100);
        document.getElementById('study-progress').style.width = progress + '%';
    }

    completeStudy() {
        document.querySelector('.card-container').style.display = 'none';
        document.getElementById('answer-buttons').style.display = 'none';
        document.getElementById('study-progress').style.width = '100%';
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
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    sanitizeImported(imported) {
        if (!imported || typeof imported !== 'object' || !Array.isArray(imported.decks)) {
            throw new Error('bad format: missing "decks" array');
        }
        const toText = (v) => (typeof v === 'string' ? v : (v == null ? '' : String(v)));
        return {
            decks: imported.decks.map(d => ({
                id: typeof d.id === 'string' ? d.id : this.generateId(),
                name: toText(d.name) || 'Без названия',
                description: toText(d.description),
                createdAt: typeof d.createdAt === 'number' ? d.createdAt : Date.now(),
                cards: Array.isArray(d.cards) ? d.cards.map(c => ({
                    id: typeof c.id === 'string' ? c.id : this.generateId(),
                    front: toText(c.front),
                    back: toText(c.back),
                    tags: Array.isArray(c.tags) ? c.tags.map(toText) : [],
                    createdAt: typeof c.createdAt === 'number' ? c.createdAt : Date.now(),
                    nextReview: typeof c.nextReview === 'number' ? c.nextReview : Date.now(),
                    lastReview: typeof c.lastReview === 'number' ? c.lastReview : null,
                    interval: typeof c.interval === 'number' ? c.interval : 0,
                    repetitions: typeof c.repetitions === 'number' ? c.repetitions : 0,
                    efactor: typeof c.efactor === 'number' ? c.efactor : 2.5
                })) : []
            })),
            stats: {
                lastStudyDate: imported.stats && typeof imported.stats.lastStudyDate === 'number' ? imported.stats.lastStudyDate : null,
                streak: imported.stats && typeof imported.stats.streak === 'number' ? imported.stats.streak : 0,
                reviewsToday: imported.stats && typeof imported.stats.reviewsToday === 'number' ? imported.stats.reviewsToday : 0
            }
        };
    }

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onerror = () => alert('Не удалось прочитать файл');
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                const clean = this.sanitizeImported(imported);
                if (confirm('Это заменит все текущие данные. Продолжить?')) {
                    this.data = clean;
                    this.currentDeckId = null;
                    this.currentCardIndex = 0;
                    this.studyCards = [];
                    this.saveData();
                    this.showScreen('home-screen');
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
                this.currentDeckId = null;
                this.currentCardIndex = 0;
                this.studyCards = [];
                this.isFlipped = false;
                const searchInput = document.getElementById('search-input');
                if (searchInput) searchInput.value = '';
                this.saveData();
                this.showScreen('home-screen');
            }
        }
    }

    // === UTILITIES ===
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = typeof text === 'string' ? text : (text == null ? '' : String(text));
        return div.innerHTML;
    }
}

// Initialize app after DOM is ready (script is at end of body,
// but DOMContentLoaded covers async/deferred load cases too)
let app;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        app = new FlashCardsApp();
        window.app = app;
    });
} else {
    app = new FlashCardsApp();
    window.app = app;
}
