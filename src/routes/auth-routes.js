import express from 'express';
import { register, loginDev } from '../controller/auth-controller.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', loginDev);

export default router;