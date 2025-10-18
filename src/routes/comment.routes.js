// src/routes/comment.routes.js
const express = require('express');
const router = express.Router();
const recipeController = require('../controllers/recipe.controller');
const authMiddleware = require('../../middleware/auth.middleware');
const adminMiddleware = require('../../middleware/admin.middleware');


/**
 * @swagger
 * /api/comments/{commentId}:
 *   delete:
 *     summary: Eliminar (soft delete) un comentario.
 *     tags: [Comentarios]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: Comentario marcado como eliminado.
 *       '403':
 *         description: Permiso denegado (no es el autor del comentario).
 */

// Comentarios y Moderación
router.delete('/:commentId', authMiddleware.verifyToken, recipeController.deleteComment); // DELETE /api/comments/{commentId}

/**
 * @swagger
 * /api/comments/{commentId}/report:
 *   post:
 *     summary: Reportar un comentario como ofensivo o spam.
 *     tags: [Moderación]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               motivo: { type: string, example: "Contenido ofensivo." }
 *     responses:
 *       '200':
 *         description: Reporte registrado y comentario marcado para revisión.
 */
router.post('/:commentId/report', authMiddleware.verifyToken, recipeController.reportComment); // POST /api/comments/{commentId}/report


/**
 * @swagger
 * /api/comments/{commentId}/restore:
 *   put:
 *     summary: Restaurar un comentario (Solo Admin).
 *     tags: [Moderación]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: Comentario restaurado y marcado como visible.
 *       '403':
 *         description: Permiso denegado (no es Admin).
 */
router.put(
    '/:commentId/restore', 
    authMiddleware.verifyToken, 
    adminMiddleware.adminCheck, // Solo Admins
    recipeController.restoreComment // Función a implementar
);

module.exports = router;