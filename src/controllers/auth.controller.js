// src/controllers/auth.controller.js
const db = require('../config/db.config'); // Tu conexión a MySQL
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
const SALT_ROUNDS = 10; // Nivel de seguridad para la encriptación de contraseñas

// --- CONTROLADOR DE REGISTRO (POST /api/auth/register) ---
exports.register = async (req, res) => {
    // CORRECCIÓN: Se incluye 'apellido' de req.body
    const { nombre, apellido, email, password } = req.body; 

    // CORRECCIÓN: Validación de campos incluye 'apellido'
    if (!nombre || !apellido || !email || !password) {
        return res.status(400).json({ message: 'Todos los campos (nombre, apellido, email, password) son obligatorios.' });
    }

    try {
        // 1. Verificar si el usuario ya existe
        let userExists = await db.query('SELECT ID_Usuario FROM USUARIO WHERE Email = ?', [email]);
        if (userExists.length > 0) {
            return res.status(409).json({ message: 'El email ya está registrado.' });
        }

        // 2. Encriptar la contraseña (Hashing)
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        
        // 3. Insertar el nuevo usuario en la base de datos
        const role = 'Lector'; // Rol por defecto
        
        // CORRECCIÓN: Se incluye la columna Apellido en la sentencia SQL
        const sql = 'INSERT INTO USUARIO (Nombre, Apellido, Email, Contraseña_Hash, Fecha_Registro, Rol) VALUES (?, ?, ?, ?, NOW(), ?)';
        
        // CORRECCIÓN: Se incluye la variable 'apellido' en los parámetros
        const params = [nombre, apellido, email, passwordHash, role]; 
        
        const result = await db.query(sql, params);

        res.status(201).json({ 
            success: true, 
            message: 'Usuario registrado con éxito.',
            userId: result.insertId 
        });

    } catch (error) {
        console.error('Error en el registro:', error.message);
        // Devolver un error 500 para fallos no controlados (ej. problemas de DB)
        res.status(500).json({ message: 'Error interno del servidor al registrar.' });
    }
};

// --- CONTROLADOR DE LOGIN (POST /api/auth/login) ---
exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        // 1. Buscar el usuario por email
        let users = await db.query('SELECT ID_Usuario, Contraseña_Hash, Rol FROM USUARIO WHERE Email = ?', [email]);

        if (users.length === 0) {
            return res.status(401).json({ message: 'Credenciales inválidas.' });
        }
        
        const user = users[0];

        // 2. Comparar la contraseña ingresada con el Hash almacenado
        const isMatch = await bcrypt.compare(password, user.Contraseña_Hash);

        if (!isMatch) {
            return res.status(401).json({ message: 'Credenciales inválidas.' });
        }

        // 3. Generar el Token de Acceso (JWT)
        const payload = {
            id: user.ID_Usuario,
            role: user.Rol
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' }); // El token expira en 1 día

        res.status(200).json({
            success: true,
            token: token,
            role: user.Rol,
            message: 'Autenticación exitosa.'
        });

    } catch (error) {
        console.error('Error en el login:', error.message);
        res.status(500).json({ message: 'Error interno del servidor al autenticar.' });
    }
};

exports.getMe = async (req, res) => {
    // El ID del usuario está en el token, adjunto por verifyToken
    const ID_Usuario = req.user.id; 

    try {
        // Obtenemos los datos esenciales (sin el hash de la contraseña)
        const sql = 'SELECT ID_Usuario, Nombre, Apellido, Email, Rol FROM USUARIO WHERE ID_Usuario = ?';
        const user = await db.query(sql, [ID_Usuario]);

        if (user.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }
        
        res.status(200).json({ success: true, data: user[0] });

    } catch (error) {
        console.error('Error al obtener datos del usuario:', error.message);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};