// src/middleware/auth.middleware.js
const jwt = require('jsonwebtoken');
require('dotenv').config();

const verifyToken = (req, res, next) => {
    // 1. Obtener el token del encabezado 'Authorization'
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(403).json({ message: 'Token de autenticación requerido.' });
    }
    
    // El formato es "Bearer <token>"
    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(403).json({ message: 'Formato de token inválido.' });
    }

    // 2. Verificar el token
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // Adjuntar datos del usuario (ID, Rol) a la petición
        req.user = decoded; 
        next(); // Continuar con el controlador
    } catch (error) {
        return res.status(401).json({ message: 'Token inválido o expirado.' });
    }
};

module.exports = {
    verifyToken
};