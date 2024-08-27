import bcrypt from 'bcrypt';
import 'dotenv/config';
import jwt from 'jsonwebtoken';
import pool from '../db.js';

const jwtSecret = process.env.JWT_SECRET;

export const register = async (req, res, next) => {
    const { user, email, pass } = req.body;

    if (!user || !email || !pass) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    if (pass.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    try {
        const hashedPassword = await bcrypt.hash(pass, 10);

        const result = await pool.query(
            'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING *',
            [user, email, hashedPassword]
        );

        const user = result.rows[0];

        const token = jwt.sign({ id: user.id, username: user.username, email: user.email }, jwtSecret, {
            expiresIn: '1h'
        });

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                created_at: user.created_at
            }
        });
    } catch (error) {
        console.error('Error during user registration:', error);
        next(error);
    }
};


export const login = async (req, res, next) => {
    const { reqUser, reqPass } = req.body;

    if (!reqUser || !reqPass) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [reqUser]);

        const rowUser = result.rows[0];

        if (!rowUser) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        const isMatch = await bcrypt.compare(reqPass, rowUser.password);

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        const token = jwt.sign({ id: rowUser.id, username: rowUser.username, email: rowUser.email }, jwtSecret, {
            expiresIn: '1h'
        });

        res.status(200).json({
            message: 'Login successful',
            token,
            user: {
                id: rowUser.id,
                username: rowUser.username,
                email: rowUser.email
            }
        });
    } catch (error) {
        console.error('Error during login:', error);
        next(error);
    }
};
