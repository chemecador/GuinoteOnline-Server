import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const server = createServer(app);
const io = new Server(server);

let waitingPlayer = null;

io.on('connection', (socket) => {
    console.log('A player connected:', socket.id);

    socket.on('find_game', (userId) => {
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
    
            socket.emit('game_start', {
                message: 'Partida encontrada',
                gameId,
                userId1: waitingPlayer.userId,
                userId2: userId
            });
            waitingPlayer.socket.emit('game_start', {
                message: 'Partida encontrada',
                gameId,
                userId1: waitingPlayer.userId,
                userId2: userId
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
