import { shuffleDeck, dealCards, allCards } from '../utils/deck-utils.js';

let waitingPlayer = null;

export function handleGameConnection(io, socket) {
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
}
