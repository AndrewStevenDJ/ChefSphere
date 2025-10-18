// src/routes/list.routes.js
const express = require('express');
const router = express.Router();
const listController = require('../controllers/list.controller'); // <-- Nuevo Controlador
const authMiddleware = require('../../middleware/auth.middleware');

/**
 * @swagger
 * tags:
 *   name: Listas Personalizadas
 *   description: Gestión de las colecciones o álbumes de recetas del usuario.
 * /api/lists:
 *   post:
 *     summary: Crear una nueva lista personalizada (álbum).
 *     tags: [Listas Personalizadas]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nombre_lista]
 *             properties:
 *               nombre_lista: { type: string, example: "Recetas de Navidad" }
 *               descripcion: { type: string, example: "Para cenas y postres festivos." }
 *     responses:
 *       '201':
 *         description: Lista creada con éxito.
 *       '403':
 *         description: Token ausente.
 *   get:
 *     summary: Listar todas las listas personales del usuario.
 *     tags: [Listas Personalizadas]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       '200':
 *         description: Lista de colecciones devuelta.
 * /api/lists/{listId}/recipes/{recipeId}:
 *   post:
 *     summary: Añadir o remover una receta de una lista específica.
 *     tags: [Listas Personalizadas]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: listId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: recipeId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: Receta añadida o removida (Toggle).
 *       '403':
 *         description: La lista no pertenece al usuario.
 */

// Todas las rutas requieren autenticación
router.use(authMiddleware.verifyToken); 

// CRUD de la Lista
router.post('/', listController.createList);           // POST /api/lists (Crear Lista)
router.get('/', listController.getAllLists);            // GET /api/lists (Listar Listas del usuario)

/**
 * @swagger
 * /api/lists/{listId}:
 *   delete:
 *     summary: Eliminar una lista personalizada (solo si está vacía).
 *     tags: [Listas Personalizadas]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: listId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: Lista eliminada con éxito.
 *       '403':
 *         description: La lista no pertenece al usuario.
 */
router.delete('/:listId', listController.deleteList);   // DELETE /api/lists/{listId}

// Gestión del Contenido de la Lista
router.post('/:listId/recipes/:recipeId', listController.toggleRecipeInList); // POST /api/lists/{listId}/recipes/{recipeId}

module.exports = router;