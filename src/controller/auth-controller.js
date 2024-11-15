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
    return res
      .status(400)
      .json({ message: 'Password must be at least 6 characters long' });
  }

  try {
    const hashedPassword = await bcrypt.hash(pass, 10);

    const result = await pool.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING *',
      [user, email, hashedPassword]
    );

    const userRow = result.rows[0];

    const token = jwt.sign(
      { id: userRow.id, username: userRow.username, email: userRow.email },
      jwtSecret,
      {
        expiresIn: '30d',
      }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: userRow.id,
        username: userRow.username,
        email: userRow.email,
        created_at: userRow.created_at,
      },
    });
  } catch (error) {
    console.error('Error during user registration:', error);
    next(error);
  }
};

export const login = async (req, res, next) => {
  const { user, pass } = req.body;

  if (!user || !pass) {
    return res
      .pass(400)
      .json({ message: 'Username and password are required' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [
      user,
    ]);

    const rowUser = result.rows[0];

    if (!rowUser) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const isMatch = await bcrypt.compare(pass, rowUser.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { id: rowUser.id, username: rowUser.username, email: rowUser.email },
      jwtSecret,
      {
        expiresIn: '30d',
      }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: rowUser.id,
        username: rowUser.username,
        email: rowUser.email,
      },
    });
  } catch (error) {
    console.error('Error during login:', error);
    next(error);
  }
};

export const loginDev = (req, res, next) => {
  const { user, pass } = req.body;

  const dummyUsers = [
    { id: 1, username: 'user1', email: 'user1@example.com' },
    { id: 2, username: 'user2', email: 'user2@example.com' },
    { id: 3, username: 'user3', email: 'user3@example.com' },
    { id: 4, username: 'user4', email: 'user4@example.com' },
    { id: 5, username: 'user5', email: 'user5@example.com' },
  ];

  if (!user || !pass) {
    return res
      .status(400)
      .json({ message: 'Username and password are required' });
  }

  try {
    const randomUser =
      dummyUsers[Math.floor(Math.random() * dummyUsers.length)];

    const token = jwt.sign(
      {
        id: randomUser.id,
        username: randomUser.username,
        email: randomUser.email,
      },
      jwtSecret,
      {
        expiresIn: '30d',
      }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: randomUser.id,
        username: randomUser.username,
        email: randomUser.email,
      },
    });
  } catch (error) {
    console.error('Error during dev login:', error);
    next(error);
  }
};
