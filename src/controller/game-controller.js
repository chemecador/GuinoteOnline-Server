import jwt from 'jsonwebtoken';
import { shuffleDeck, dealCards, allCards } from '../utils/deck-utils.js';

const secretKey = process.env.JWT_SECRET;

let waitingPlayer = null;

export function handleGameConnection(io, socket) {
    console.log('A player connected:', socket.id);

    socket.on('search_game', (token) => {
        console.log(`Petición de search_game recibida del token: ${token}`);
    
        const username = validateToken(token);
        if (!username) { 
            socket.emit('error', { message: 'Invalid token' });
            return;
        }

        if (waitingPlayer === null) {
            waitingPlayer = { socket, username };
            console.log(`Jugador 1 conectado: ${username}`);
            socket.emit('waiting', { message: 'Esperando rival...' });
        } else {
            const gameId = `game_${socket.id}_${waitingPlayer.socket.id}`;
            socket.join(gameId);
            waitingPlayer.socket.join(gameId);

            console.log(`Jugador 2 conectado: ${username}`);
            console.log(`Emparejando jugadores: ${waitingPlayer.username} vs ${username}`);

            const shuffledDeck = shuffleDeck([...allCards]);
            const { player1Cards, player2Cards, triunfoCard } = dealCards(shuffledDeck);

            const startingPlayer = waitingPlayer.username;

            waitingPlayer.socket.emit('game_start', {
                message: 'Partida encontrada',
                gameId,
                myUsername: waitingPlayer.username,
                opponentUsername: username,
                playerCards: player1Cards,
                triunfoCard,
                currentTurn: startingPlayer
            });

            socket.emit('game_start', {
                message: 'Partida encontrada',
                gameId,
                myUsername: username,
                opponentUsername: waitingPlayer.username,
                playerCards: player2Cards,
                triunfoCard,
                currentTurn: startingPlayer
            });

            waitingPlayer = null;
        }
    });

    socket.on('play_card', (data) => {
        
        console.log('Data received:', data);

        const { card, token } = data;
        console.log(`Petición de play_card recibida del token: ${token}`);
    
        if (!token) {
            console.error('No token provided');
            socket.emit('error', { message: 'No token provided' });
            return;
        }
        const username = validateToken(token);
    
        if (!username) {
            socket.emit('error', { message: 'Invalid token' });
            return;
        }
        console.log(`El jugador ${username} ha tirado la carta ${card.name}`);
    
        socket.to(gameId).emit('opponent_played_card', { card, username });
    });

    socket.on('disconnect', () => {
        console.log('A player disconnected:', socket.id);
        if (waitingPlayer && waitingPlayer.socket === socket) {
            waitingPlayer = null;
        }
    });
}

function validateToken(token) {
    try {
        const decoded = jwt.verify(token, secretKey);
        return decoded.username; 
    } catch (err) {
        console.error(`Token validation failed for token: ${token}. Error: ${err.message}`);
        return null;
    }
}
