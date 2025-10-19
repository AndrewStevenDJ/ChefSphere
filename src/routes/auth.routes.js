// src/routes/auth.routes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../../middleware/auth.middleware'); 


/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Registrar nuevo usuario
 *     tags: [Autenticación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nombre
 *               - apellido
 *               - email
 *               - password
 *             properties:
 *               nombre:
 *                 type: string
 *                 example: Juan
 *               apellido:
 *                 type: string
 *                 example: Pérez
 *               email:
 *                 type: string
 *                 format: email
 *                 example: juan.perez@test.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: MiClave123
 *     responses:
 *       '201':
 *         description: Usuario registrado exitosamente.
 *       '400':
 *         description: Campos obligatorios faltantes.
 *       '409':
 *         description: El email ya está registrado.
 */
// POST /api/auth/register
router.post('/register', authController.register);

// ===============================================
// SWAGGER DOCS FOR /auth/login START HERE
// ===============================================

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Iniciar sesión del usuario
 *     tags: [Autenticación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: steven.diaz@test.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: miPasswordSeguro123
 *     responses:
 *       '200':
 *         description: Autenticación exitosa y token JWT generado.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 token:
 *                   type: string
 *                 role:
 *                   type: string
 *       '401':
 *         description: Credenciales inválidas.
 */
// POST /api/auth/login
router.post('/login', authController.login); // <-- Doc now immediately precedes the route

// POST /api/auth/logout (Opcional: si usas tokens, solo necesitas que el cliente lo elimine)
// router.post('/logout', authController.logout);


/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Obtener la información del usuario autenticado.
 *     tags: [Autenticación]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       '200':
 *         description: Retorna la información de la cuenta (ID, Nombre, Apellido, Email, Rol).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     ID_Usuario:
 *                       type: integer
 *                       example: 1
 *                     Nombre:
 *                       type: string
 *                       example: Juan
 *                     Apellido:
 *                       type: string
 *                       example: Pérez
 *                     Email:
 *                       type: string
 *                       example: juan.perez@test.com
 *                     Rol:
 *                       type: string
 *                       example: Lector
 *       '401':
 *         description: Token ausente o inválido.
 *       '404':
 *         description: Usuario no encontrado.
 */
router.get('/me', authMiddleware.verifyToken, authController.getMe); // GET /api/auth/me

module.exports = router;