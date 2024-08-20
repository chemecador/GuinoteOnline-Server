import express from 'express';
import pool from './db.js';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { handleGameConnection } from './controller/game-controller.js';

const app = express();
const server = createServer(app);
const io = new Server(server);

app.get('/testdb', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database connection failed' });
    }
});

io.on('connection', (socket) => {
    handleGameConnection(io, socket);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
