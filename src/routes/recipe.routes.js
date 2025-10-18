// src/routes/recipe.routes.js
const express = require('express');
const router = express.Router();
const recipeController = require('../controllers/recipe.controller');
const authMiddleware = require('../../middleware/auth.middleware');
const adminMiddleware = require('../../middleware/admin.middleware');

/**
 * @swagger
 * tags:
 *   name: Recetas
 *   description: Operaciones de contenido principal (Crear, Leer, Actualizar)
 * /api/recipes:
 *   get:
 *     summary: Listar y filtrar recetas con paginación
 *     tags: [Recetas]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Número de página.
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *         description: Recetas por página.
 *       - in: query
 *         name: dificultad
 *         schema: { type: string, enum: [Fácil, Media, Difícil] }
 *         description: Filtro por nivel de dificultad.
 *       - in: query
 *         name: categoria
 *         schema: { type: integer }
 *         description: ID de la categoría para filtros.
 *     responses:
 *       '200':
 *         description: Lista de recetas exitosa con metadatos de paginación.
 *   post:
 *     summary: Crear una nueva receta y enviarla a revisión.
 *     tags: [Recetas]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [titulo, porciones, dificultad, pasos, ingredientes]
 *             properties:
 *               titulo: { type: string, example: "Flan de Coco Cremoso" }
 *               descripcion: { type: string, example: "Un postre fácil." }
 *               porciones: { type: integer, example: 6 }
 *               dificultad: { type: string, example: "Media" }
 *               pasos: { type: array, items: { type: object } }
 *               ingredientes: { type: array, items: { type: object } }
 *               categorias: { type: array, items: { type: integer, example: 2 } }
 *     responses:
 *       '201':
 *         description: Receta creada y enviada a revisión.
 *       '403':
 *         description: Permiso denegado o token ausente.
 */
// Rutas Públicas: GET
router.get('/', recipeController.getAllRecipes); // GET /api/recipes

/**
 * @swagger
 * /api/recipes/{id}:
 *   get:
 *     summary: Obtener el detalle completo de una receta.
 *     tags: [Recetas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: ID de la receta.
 *     responses:
 *       '200':
 *         description: Detalle de la receta (incluye pasos, ingredientes, y contadores).
 *       '404':
 *         description: Receta no encontrada o no publicada.
 *   put:
 *     summary: Actualizar una receta (Solo Autor Principal/Admin).
 *     tags: [Recetas]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: El cuerpo debe ser idéntico al POST, reemplazando la receta completa.
 *     responses:
 *       '200':
 *         description: Receta actualizada y reenviada a revisión.
 *       '403':
 *         description: Acceso denegado (no es autor principal).
 *   delete:
 *     summary: Eliminar una receta (Solo Autor Principal/Admin).
 *     tags: [Recetas]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: Receta eliminada permanentemente.
 *       '403':
 *         description: Permiso denegado.
 */
router.get('/:id', recipeController.getRecipeById); // GET /api/recipes/{id}

// Rutas Privadas: POST (requieren autenticación)
router.post('/', authMiddleware.verifyToken, recipeController.createRecipe); // POST /api/recipes

/**
 * @swagger
 * /api/recipes/{id}/like:
 *   post:
 *     summary: Alternar (añadir/quitar) "Me Gusta" a una receta.
 *     tags: [Interacciones]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: ID de la receta.
 *     responses:
 *       '200':
 *         description: Éxito. Devuelve 'added' o 'removed'.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 action: { type: string, enum: [added, removed] }
 */
router.post('/:id/like', authMiddleware.verifyToken, recipeController.toggleLike); // POST /api/recipes/{id}/like

/**
 * @swagger
 * /api/recipes/{id}/rate:
 *   post:
 *     summary: Calificar una receta (1 a 5 estrellas).
 *     tags: [Interacciones]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [puntuacion]
 *             properties:
 *               puntuacion: { type: integer, minimum: 1, maximum: 5 }
 *     responses:
 *       '200':
 *         description: Calificación actualizada con éxito.
 *       '201':
 *         description: Calificación registrada por primera vez.
 */
router.post('/:id/rate', authMiddleware.verifyToken, recipeController.rateRecipe); // POST /api/recipes/{id}/rate

/**
 * @swagger
 * /api/recipes/{id}/favorite:
 *   post:
 *     summary: Alternar (añadir/quitar) una receta de la lista de Favoritos.
 *     tags: [Interacciones]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: Favorito añadido o eliminado.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 action: { type: string, enum: [added, removed] }
 */
router.post('/:id/favorite', authMiddleware.verifyToken, recipeController.toggleFavorite); // POST /api/recipes/{id}/favorite

// Rutas Privadas: PUT (requieren autenticación)
router.put('/:id', authMiddleware.verifyToken, recipeController.updateRecipe); // PUT /api/recipes/{id}

/**
 * @swagger
 * /api/recipes/{id}/restore:
 *   put:
 *     summary: Restaurar una receta eliminada lógicamente (Soft Delete).
 *     tags: [Recetas]
 *     description: Esta operación solo puede ser realizada por el Autor Principal o un Administrador.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: Receta restaurada con éxito. El estado se revierte a 'Borrador'.
 *       '403':
 *         description: Permiso denegado (no es Admin o Autor Principal).
 *       '404':
 *         description: Receta no encontrada o ya está activa.
 */
router.put('/:id/restore', authMiddleware.verifyToken, recipeController.restoreRecipe); // PUT /api/recipes/{id}/restore
//  DELETE /api/recipes/{id}

router.put(
    '/:id/status', 
    authMiddleware.verifyToken, 
    adminMiddleware.adminCheck, // <--- ÚNICO PUNTO DE ACCESO PARA ADMINS
    recipeController.updateRecipeStatus // Función para actualizar el estado
);

/**
 * @swagger
 * /api/recipes/{id}/comments:
 *   get:
 *     summary: Listar comentarios visibles de una receta.
 *     tags: [Comentarios]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: ID de la receta.
 *     responses:
 *       '200':
 *         description: Lista de comentarios, incluidos los anidados (respuestas).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 */
// Rutas de Comentarios
router.get('/:id/comments', recipeController.getCommentsByRecipe); // GET /api/recipes/{id}/comments

/**
 * @swagger
 * /api/recipes/{id}/comments:
 *   post:
 *     summary: Publicar un nuevo comentario o respuesta.
 *     tags: [Comentarios]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: ID de la receta a comentar.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [texto]
 *             properties:
 *               texto: { type: string, example: "¡Me encantó esta receta!" }
 *               id_comentario_padre: 
 *                 type: integer
 *                 nullable: true
 *                 example: 5
 *                 description: ID del comentario al que se responde (NULL si es de primer nivel).
 *     responses:
 *       '201':
 *         description: Comentario publicado con éxito.
 *       '400':
 *         description: Texto del comentario obligatorio.
 */
router.post('/:id/comments', authMiddleware.verifyToken, recipeController.postComment); // POST /api/recipes/{id}/comments

module.exports = router;