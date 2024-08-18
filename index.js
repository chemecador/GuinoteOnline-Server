import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const server = createServer(app);
const io = new Server(server);

let waitingPlayer = null;

const allCards = [
    'bastos1', 'bastos2', 'bastos3', 'bastos4', 'bastos5', 'bastos6', 'bastos7', 'bastos10', 'bastos11', 'bastos12',
    'copas1', 'copas2', 'copas3', 'copas4', 'copas5', 'copas6', 'copas7', 'copas10', 'copas11', 'copas12',
    'espadas1', 'espadas2', 'espadas3', 'espadas4', 'espadas5', 'espadas6', 'espadas7', 'espadas10', 'espadas11', 'espadas12',
    'oros1', 'oros2', 'oros3', 'oros4', 'oros5', 'oros6', 'oros7', 'oros10', 'oros11', 'oros12'
];

function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function dealCards(deck) {
    const player1Cards = deck.slice(0, 6);
    const player2Cards = deck.slice(6, 12);
    const triunfoCard = deck[12];
    return { player1Cards, player2Cards, triunfoCard };
}

io.on('connection', (socket) => {
    console.log('A player connected:', socket.id);

    socket.on('search_game', (userId) => {
        if (waitingPlayer === null) {
            waitingPlayer = { socket, userId };
            console.log(`Jugador 1 conectado: ${userId}`);
            socket.emit('waiting', { message: 'Esperando rival...' });
        } else {
            const gameId = `game_${socket.id}_${waitingPlayer.socket.id}`;
            socket.join(gameId);
            waitingPlayer.socket.join(gameId);

            console.log(`Jugador 2 conectado: ${userId}`);
            console.log(`Emparejando jugadores: ${waitingPlayer.userId} vs ${userId}`);

            const shuffledDeck = shuffleDeck([...allCards]);
            const { player1Cards, player2Cards, triunfoCard } = dealCards(shuffledDeck);

            socket.emit('game_start', {
                message: 'Partida encontrada',
                gameId,
                userId1: waitingPlayer.userId,
                userId2: userId,
                playerCards: player2Cards,
                triunfoCard
            });

            waitingPlayer.socket.emit('game_start', {
                message: 'Partida encontrada',
                gameId,
                userId1: waitingPlayer.userId,
                userId2: userId,
                playerCards: player1Cards,
                triunfoCard
            });

            waitingPlayer = null;
        }
    });

    socket.on('disconnect', () => {
        console.log('A player disconnected:', socket.id);
        if (waitingPlayer && waitingPlayer.socket === socket) {
            waitingPlayer = null;
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
