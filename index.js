import express from 'express';
import { createServer } from 'node:http'
import { Server } from 'socket.io'

const app = express()
const server = createServer(app)
const io = new Server(server, {
  connectionStateRecovery: {}
})

let waitingPlayer = null;

io.on('connection', (socket) => {
    console.log('A player connected:', socket.id);

    socket.on('find_game', () => {
        if (waitingPlayer === null) {
            waitingPlayer = socket;
            socket.emit('waiting', { message: 'Waiting...' });
        } else {
            const gameId = `game_${socket.id}_${waitingPlayer.id}`;
            socket.join(gameId);
            waitingPlayer.join(gameId);
            io.to(gameId).emit('game_start', { gameId });
            waitingPlayer = null;
        }
    });

    socket.on('disconnect', () => {
        console.log('A player disconnected:', socket.id);
        if (waitingPlayer === socket) {
            waitingPlayer = null;
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
