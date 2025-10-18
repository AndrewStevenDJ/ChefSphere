// src/controllers/list.controller.js
const db = require('../config/db.config');

// --- POST /api/lists (Crear Lista Personalizada) ---
const createList = async (req, res) => {
    const ID_Usuario = req.user.id;
    const { nombre_lista, descripcion } = req.body;

    if (!nombre_lista) {
        return res.status(400).json({ message: 'El nombre de la lista es obligatorio.' });
    }

    try {
        const sql = 'INSERT INTO LISTA_PERSONALIZADA (ID_Usuario, Nombre_Lista, Descripción) VALUES (?, ?, ?)';
        const result = await db.query(sql, [ID_Usuario, nombre_lista, descripcion || null]);
        
        res.status(201).json({ 
            success: true, 
            message: 'Lista creada con éxito.',
            ID_Lista: result.insertId 
        });

    } catch (error) {
        console.error('Error al crear lista:', error.message);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

// --- GET /api/lists (Listar Listas del Usuario) ---
const getAllLists = async (req, res) => {
    const ID_Usuario = req.user.id;

    try {
        const sql = 'SELECT ID_Lista, Nombre_Lista, Descripción FROM LISTA_PERSONALIZADA WHERE ID_Usuario = ? ORDER BY ID_Lista DESC';
        const lists = await db.query(sql, [ID_Usuario]);
        
        res.status(200).json({ success: true, data: lists });

    } catch (error) {
        console.error('Error al listar listas:', error.message);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

const deleteList = async (req, res) => {
    // La lógica de eliminación se implementará después.
    res.status(501).json({ message: 'Funcionalidad de eliminación de lista pendiente.' });
};

// --- POST /api/lists/{listId}/recipes/{recipeId} (Añadir/Remover Receta) ---
const toggleRecipeInList = async (req, res) => {
    const { listId, recipeId } = req.params;
    // CORRECCIÓN CLAVE: Accede al ID del usuario como req.user.id
    const ID_Usuario = req.user.id; 

    let connection;
    try {
        // 1. VERIFICAR PERMISOS Y EXISTENCIA DE LISTA
        
        // La sintaxis de listCheck era la que causó el error de desestructuración, 
        // pero la corregimos en el paso anterior. Ahora verificamos la propiedad:
        const listCheck = await db.query('SELECT ID_Usuario FROM LISTA_PERSONALIZADA WHERE ID_Lista = ?', [listId]);
        
        if (listCheck.length === 0 || listCheck[0].ID_Usuario !== ID_Usuario) {
            return res.status(403).json({ message: 'Acceso denegado. La lista no existe o no te pertenece.' });
        }
        
        // --- 2. INICIAR TRANSACCIÓN ---
        connection = await db.pool.getConnection();
        await connection.beginTransaction();

        // 3. Verificar si la receta ya está en la lista (LISTA_RECETA)
        const [existingEntry] = await connection.execute(
            'SELECT ID_Lista FROM LISTA_RECETA WHERE ID_Lista = ? AND ID_Receta = ?',
            [listId, recipeId]
        );

        let action;
        let message;

        if (existingEntry.length > 0) {
            // Caso A: Ya existe - Remover
            await connection.execute('DELETE FROM LISTA_RECETA WHERE ID_Lista = ? AND ID_Receta = ?', [listId, recipeId]);
            action = 'removed';
            message = 'Receta removida de la lista.';
        } else {
            // Caso B: No existe - Añadir
            await connection.execute('INSERT INTO LISTA_RECETA (ID_Lista, ID_Receta) VALUES (?, ?)', [listId, recipeId]);
            action = 'added';
            message = 'Receta añadida a la lista con éxito.';
        }

        // --- 4. FINALIZAR TRANSACCIÓN ---
        await connection.commit();
        connection.release();

        res.status(200).json({ success: true, action: action, message: message });

    } catch (error) {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        console.error('Error al alternar receta en lista (revisar IDs):', error.message);
        res.status(500).json({ message: 'Error interno del servidor al gestionar la lista.' });
    }
};
// ... Asegúrate de que las funciones deleteList y toggleRecipeInList estén en module.exports
module.exports = {
    createList,
    getAllLists,
    deleteList,
    toggleRecipeInList
};