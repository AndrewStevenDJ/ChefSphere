// src/controllers/recipe.controller.js
const db = require('../config/db.config');

// --- Función Auxiliar para obtener el ID del observador (para el Cooldown) ---
// Nota: req.ip necesita configuración de middleware si la API está detrás de un proxy/load balancer
const getViewerId = (req) => {
    const ipAddress = req.ip || '127.0.0.1';
    // Si req.user existe (usuario autenticado), usa el ID de usuario. Si no, usa la IP.
    return req.user ? `U:${req.user.id}` : `IP:${ipAddress}`;
};


// --- GET /api/recipes (Obtener listado de recetas con filtros) ---
const getAllRecipes = async (req, res) => {
    // 1. Obtener parámetros de Paginación y Filtros
    const { 
        categoria, dificultad, tiempo_max, popularidad, busqueda, 
        page = 1, // Por defecto, página 1
        limit = 20 // Por defecto, 20 resultados por página
    } = req.query; 

    // Conversión a enteros y cálculo de OFFSET
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    // Asegura que pageNum y limitNum son números válidos y positivos
    if (isNaN(pageNum) || pageNum < 1 || isNaN(limitNum) || limitNum < 1) {
         return res.status(400).json({ message: 'Parámetros de paginación (page, limit) inválidos.' });
    }
    const offset = (pageNum - 1) * limitNum; 
    
    let whereClauses = ["R.Estado_Publicacion = 'Publicada'"];
    let params = [];
    let joinClauses = [];
    let orderBy = "R.Fecha_Publicacion DESC"; // Orden por defecto

    try {
        // --- LÓGICA DE FILTROS ---
        
        // FILTRO 1: DIFICULTAD
        if (dificultad) {
            whereClauses.push("R.Dificultad = ?");
            params.push(dificultad);
        }

        // FILTRO 2: TIEMPO MÁXIMO
        if (tiempo_max) {
            whereClauses.push("R.Tiempo_Preparacion <= ?");
            params.push(parseInt(tiempo_max));
        }
        
        // FILTRO 3: POPULARIDAD
        if (popularidad === 'true') {
            orderBy = "R.Contador_MeGusta DESC"; 
        }

        // FILTRO 4: CATEGORÍA (Lógica de Unión)
        if (categoria) {
            joinClauses.push("JOIN RECETA_CATEGORIA RC ON R.ID_Receta = RC.ID_Receta");
            whereClauses.push("RC.ID_Categoria = ?");
            params.push(categoria);
        }

        // FILTRO 5: BÚSQUEDA
        if (busqueda) {
            whereClauses.push("(R.Título LIKE ? OR R.Descripción LIKE ?)");
            params.push(`%${busqueda}%`, `%${busqueda}%`);
        }
        
        // --- ENSAMBLAR CONSULTA FINAL ---
        const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        const joins = joinClauses.join(' ');
        
        // 2. Consulta para OBTENER EL TOTAL DE REGISTROS (para el frontend)
        // Se ejecuta primero para tener la metadata de paginación
        const countSql = `
            SELECT COUNT(R.ID_Receta) AS total
            FROM RECETA R
            ${joins}
            ${whereClause};
        `;
        const totalCountResult = await db.query(countSql, params); 
        const totalRecipes = totalCountResult[0].total;
        
        // 3. Consulta para OBTENER RECETAS (con LIMIT y OFFSET)
        const sql = `
            SELECT 
                R.ID_Receta, R.Título, R.Dificultad, R.Porciones, R.Contador_MeGusta, 
                U.Nombre AS Autor_Nombre, U.Apellido AS Autor_Apellido
            FROM RECETA R
            JOIN RECETA_AUTOR RA ON R.ID_Receta = RA.ID_Receta AND RA.Rol_Autor = 'Principal'
            JOIN USUARIO U ON RA.ID_Usuario = U.ID_Usuario
            ${joins}
            ${whereClause}
            ORDER BY ${orderBy}
            LIMIT ? OFFSET ?;
        `;
        
        // Se añaden los parámetros de paginación al final de los parámetros de filtro
        const recipeParams = [...params, limitNum, offset]; 
        
        const recipes = await db.query(sql, recipeParams);
        
        const totalPages = Math.ceil(totalRecipes / limitNum);

        res.status(200).json({ 
            success: true, 
            pagination: {
                totalRecipes,
                totalPages,
                currentPage: pageNum,
                limit: limitNum
            },
            data: recipes
        });
    } catch (error) {
        console.error('Error al obtener el listado de recetas con paginación:', error.message);
        res.status(500).json({ message: 'Error interno del servidor al listar recetas.' });
    }
};

// --- GET /api/recipes/{id} (Obtener detalles de una receta con Cooldown) ---
const getRecipeById = async (req, res) => {
    const { id } = req.params;
    const ID_Receta = id;
    const viewerId = getViewerId(req); // Obtiene el ID_Usuario o IP
    const cooldownTime = 24; // Tiempo de cooldown en horas

    try {
        // 1. Obtener la información básica de la receta
        // CORRECCIÓN 1: El resultado 'recipeRows' es el array de filas directo.
        const recipeRows = await db.query('SELECT * FROM RECETA WHERE ID_Receta = ? AND Estado_Publicacion = ?', [ID_Receta, 'Publicada']);

        // Usamos .length directamente en el array de filas
        if (recipeRows.length === 0) { 
            return res.status(404).json({ message: 'Receta no encontrada o no publicada.' });
        }
        
        let recipe = recipeRows[0]; // La primera fila es el objeto receta

        // --- LÓGICA DEL COOLDOWN ---
        const checkViewSql = `
            SELECT Fecha_Vista 
            FROM RECETA_VISTA 
            WHERE ID_Receta = ? AND Usuario_o_IP = ? 
            AND Fecha_Vista > DATE_SUB(NOW(), INTERVAL ? HOUR)
        `;
        // CORRECCIÓN 2: El resultado 'lastView' es el array de filas directo.
        const lastView = await db.query(checkViewSql, [ID_Receta, viewerId, cooldownTime]);
        
        // Usamos .length directamente en el array de filas
        if (lastView.length === 0) {
            // Es una vista válida: Registrar e incrementar
            await db.query(
                'INSERT INTO RECETA_VISTA (ID_Receta, Usuario_o_IP) VALUES (?, ?)',
                [ID_Receta, viewerId]
            );
            await db.query('UPDATE RECETA SET Contador_Vistas = Contador_Vistas + 1 WHERE ID_Receta = ?', [ID_Receta]);
            recipe.Contador_Vistas++; 
        } 
        // -----------------------------

        // 2. Obtener Pasos, Ingredientes e Imágenes (CORRECCIÓN CLAVE AQUÍ)
        
        // CORRECCIÓN 3: Obtener Pasos
        recipe.Pasos = await db.query('SELECT Número_Paso, Descripcion_Paso, Duracion_Paso, Imagen_Paso_URL FROM PASO WHERE ID_Receta = ? ORDER BY Número_Paso ASC', [id]);
        // Ya que db.query devuelve las filas directamente, 'recipe.Pasos' es un array listo.
        
        // CORRECCIÓN 4: Obtener Ingredientes
        recipe.Ingredientes = await db.query(`
            SELECT RI.Cantidad, RI.Notas, IB.Nombre_Ingrediente, UM.Nombre_Unidad 
            FROM RECETA_INGREDIENTE RI 
            JOIN INGREDIENTE_BASE IB ON RI.ID_Ingrediente_Base = IB.ID_Ingrediente_Base 
            JOIN UNIDAD_MEDIDA UM ON RI.ID_Unidad = UM.ID_Unidad 
            WHERE RI.ID_Receta = ?
        `, [id]);
        // Ya que db.query devuelve las filas directamente, 'recipe.Ingredientes' es un array listo.
        
        res.status(200).json({ success: true, data: recipe });

    } catch (error) {
        // Es vital que este log muestre el error completo si aún hay un fallo de BD (ej. tabla mal escrita)
        console.error('Error FATAL al obtener el detalle de la receta (Final):', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};


// --- POST /api/recipes (Crear Receta con Transacción) ---
const createRecipe = async (req, res) => {
    const ID_Usuario = req.user.id; 
    
    const { 
        titulo, descripcion, porciones, dificultad, 
        pasos, ingredientes, categorias 
    } = req.body;

    if (!titulo || !porciones || !dificultad || !pasos || !ingredientes) {
        return res.status(400).json({ message: 'Faltan campos obligatorios para la receta (título, porciones, dificultad, pasos, ingredientes).' });
    }

    let connection; 
    
    try {
        // --- INICIAR TRANSACCIÓN ---
        connection = await db.pool.getConnection(); 
        await connection.beginTransaction(); 

        // 1. INSERCIÓN 1: RECETA
        const recipeSql = 'INSERT INTO RECETA (Título, Descripción, Porciones, Dificultad, Estado_Publicacion) VALUES (?, ?, ?, ?, ?)';
        const [recipeResult] = await connection.execute(recipeSql, [titulo, descripcion, porciones, dificultad, 'En_Revision']);
        const ID_Receta = recipeResult.insertId;

        // 2. INSERCIÓN 2: RECETA_AUTOR (Autor principal)
        const authorSql = 'INSERT INTO RECETA_AUTOR (ID_Receta, ID_Usuario, Rol_Autor, Puede_Editar) VALUES (?, ?, ?, ?)';
        await connection.execute(authorSql, [ID_Receta, ID_Usuario, 'Principal', true]);

        // 3. INSERCIÓN 3: PASOS
        if (pasos && pasos.length > 0) {
            for (const paso of pasos) {
                const pasoSql = 'INSERT INTO PASO (ID_Receta, Número_Paso, Descripcion_Paso, Duracion_Paso, Imagen_Paso_URL) VALUES (?, ?, ?, ?, ?)';
                await connection.execute(pasoSql, [
                    ID_Receta, 
                    paso.numero, 
                    paso.descripcion, 
                    paso.duracion, 
                    paso.imagen_url || null
                ]);
            }
        }
        
        // 4. INSERCIÓN 4: CATEGORÍAS (RECETA_CATEGORIA)
        if (categorias && categorias.length > 0) {
            for (const catId of categorias) {
                const catSql = 'INSERT INTO RECETA_CATEGORIA (ID_Receta, ID_Categoria) VALUES (?, ?)';
                await connection.execute(catSql, [ID_Receta, catId]);
            }
        }

        // 5. INSERCIÓN 5: GESTIÓN DE INGREDIENTES
        if (ingredientes && ingredientes.length > 0) {
            for (const ingrediente of ingredientes) {
                let ID_Ingrediente_Base;

                // a) Buscar Ingrediente Base (Lógica de normalización básica)
                const [existingIngred] = await connection.execute(
                    'SELECT ID_Ingrediente_Base FROM INGREDIENTE_BASE WHERE Nombre_Ingrediente = ?', 
                    [ingrediente.nombre]
                );

                if (existingIngred.length > 0) {
                    ID_Ingrediente_Base = existingIngred[0].ID_Ingrediente_Base;
                } else {
                    // b) Si no existe, insertarlo
                    const [newIngredResult] = await connection.execute(
                        'INSERT INTO INGREDIENTE_BASE (Nombre_Ingrediente) VALUES (?)', 
                        [ingrediente.nombre]
                    );
                    ID_Ingrediente_Base = newIngredResult.insertId;
                }

                // c) Insertar en RECETA_INGREDIENTE
                const recipeIngredSql = 'INSERT INTO RECETA_INGREDIENTE (ID_Receta, ID_Ingrediente_Base, ID_Unidad, Cantidad, Notas) VALUES (?, ?, ?, ?, ?)';
                await connection.execute(recipeIngredSql, [
                    ID_Receta, 
                    ID_Ingrediente_Base, 
                    ingrediente.id_unidad, 
                    ingrediente.cantidad, 
                    ingrediente.notas
                ]);
            }
        }
        
        // --- FINALIZAR TRANSACCIÓN ---
        await connection.commit(); 
        connection.release(); 

        res.status(201).json({ 
            success: true, 
            message: 'Receta creada y enviada a revisión.', 
            ID_Receta 
        });

    } catch (error) {
        if (connection) {
            await connection.rollback(); 
            connection.release();
        }
        console.error('Error fatal al crear la receta (ROLLBACK ejecutado):', error.message); 
        res.status(500).json({ message: 'Error interno del servidor al crear la receta.' });
    }
};

const toggleLike = async (req, res) => {
    const ID_Receta = req.params.id;
    const ID_Usuario = req.user.id; // Obtenido del token JWT

    let connection;
    try {
        // --- 1. INICIAR TRANSACCIÓN ---
        // Usamos transacción para garantizar que el contador y la tabla ME_GUSTA estén sincronizados.
        connection = await db.pool.getConnection();
        await connection.beginTransaction();

        // 2. Verificar si el usuario ya dio "Me Gusta"
        const [existingLike] = await connection.execute(
            'SELECT ID_Receta FROM ME_GUSTA WHERE ID_Receta = ? AND ID_Usuario = ?',
            [ID_Receta, ID_Usuario]
        );

        let action;
        let message;

        if (existingLike.length > 0) {
            // Caso A: YA EXISTE - Remover el Like
            await connection.execute(
                'DELETE FROM ME_GUSTA WHERE ID_Receta = ? AND ID_Usuario = ?',
                [ID_Receta, ID_Usuario]
            );
            // Decrementar el contador
            await connection.execute(
                'UPDATE RECETA SET Contador_MeGusta = Contador_MeGusta - 1 WHERE ID_Receta = ? AND Contador_MeGusta > 0',
                [ID_Receta]
            );
            action = 'removed';
            message = 'Me Gusta removido.';
        } else {
            // Caso B: NO EXISTE - Dar Like
            await connection.execute(
                'INSERT INTO ME_GUSTA (ID_Receta, ID_Usuario) VALUES (?, ?)',
                [ID_Receta, ID_Usuario]
            );
            // Incrementar el contador
            await connection.execute(
                'UPDATE RECETA SET Contador_MeGusta = Contador_MeGusta + 1 WHERE ID_Receta = ?',
                [ID_Receta]
            );
            action = 'added';
            message = 'Me Gusta añadido con éxito.';
        }

        // --- 3. FINALIZAR TRANSACCIÓN ---
        await connection.commit();
        connection.release();

        res.status(200).json({ success: true, action: action, message: message });

    } catch (error) {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        console.error('Error fatal al alternar like:', error.message);
        res.status(500).json({ message: 'Error interno del servidor al procesar el like.' });
    }
};

const rateRecipe = async (req, res) => {
    const ID_Receta = req.params.id;
    const ID_Usuario = req.user.id; 
    const { puntuacion } = req.body;

    // Validación: Puntuación debe ser un número entero entre 1 y 5
    if (!Number.isInteger(puntuacion) || puntuacion < 1 || puntuacion > 5) {
        return res.status(400).json({ message: 'La puntuación debe ser un número entero entre 1 y 5.' });
    }

    let connection;
    try {
        // Usamos una transacción para garantizar consistencia
        connection = await db.pool.getConnection();
        await connection.beginTransaction();

        // 1. Verificar si ya existe una calificación del usuario para esta receta
        const [existingRate] = await connection.execute(
            'SELECT ID_Calificacion FROM CALIFICACION WHERE ID_Receta = ? AND ID_Usuario = ?',
            [ID_Receta, ID_Usuario]
        );

        if (existingRate.length > 0) {
            // Caso A: Ya existe - Actualizar la calificación
            await connection.execute(
                'UPDATE CALIFICACION SET Puntuacion = ?, Fecha_Calificacion = NOW() WHERE ID_Calificacion = ?',
                [puntuacion, existingRate[0].ID_Calificacion]
            );
            
            await connection.commit();
            res.status(200).json({ success: true, action: 'updated', message: 'Calificación actualizada con éxito.' });
            
        } else {
            // Caso B: No existe - Insertar nueva calificación
            await connection.execute(
                'INSERT INTO CALIFICACION (ID_Receta, ID_Usuario, Puntuacion, Fecha_Calificacion) VALUES (?, ?, ?, NOW())',
                [ID_Receta, ID_Usuario, puntuacion]
            );
            
            await connection.commit();
            res.status(201).json({ success: true, action: 'created', message: 'Calificación registrada con éxito.' });
        }
        
        connection.release();

    } catch (error) {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        console.error('Error al calificar la receta:', error.message);
        res.status(500).json({ message: 'Error interno del servidor al procesar la calificación.' });
    }
};

const toggleFavorite = async (req, res) => {
    const ID_Receta = req.params.id;
    const ID_Usuario = req.user.id; 

    let connection;
    try {
        // 1. INICIAR TRANSACCIÓN (Patrón de seguridad comprobado)
        connection = await db.pool.getConnection();
        await connection.beginTransaction();

        // 2. Verificar si ya es favorito (Usando connection.execute dentro de la transacción)
        const [existingFavorite] = await connection.execute(
            'SELECT ID_Usuario FROM FAVORITO WHERE ID_Receta = ? AND ID_Usuario = ?',
            [ID_Receta, ID_Usuario]
        );

        let action;
        let message;

        if (existingFavorite.length > 0) {
            // Caso A: YA EXISTE - Remover de Favoritos (DELETE)
            await connection.execute(
                'DELETE FROM FAVORITO WHERE ID_Receta = ? AND ID_Usuario = ?',
                [ID_Receta, ID_Usuario]
            );
            // Decrementar Contador_Guardados en RECETA
            await connection.execute(
                'UPDATE RECETA SET Contador_Guardados = Contador_Guardados - 1 WHERE ID_Receta = ? AND Contador_Guardados > 0',
                [ID_Receta]
            );
            action = 'removed';
            message = 'Receta eliminada de favoritos.';
        } else {
            // Caso B: NO EXISTE - Añadir a Favoritos (INSERT)
            await connection.execute(
                'INSERT INTO FAVORITO (ID_Receta, ID_Usuario) VALUES (?, ?)',
                [ID_Receta, ID_Usuario]
            );
            // Incrementar Contador_Guardados en RECETA
            await connection.execute(
                'UPDATE RECETA SET Contador_Guardados = Contador_Guardados + 1 WHERE ID_Receta = ?',
                [ID_Receta]
            );
            action = 'added';
            message = 'Receta añadida a favoritos.';
        }

        // 3. FINALIZAR TRANSACCIÓN
        await connection.commit();
        connection.release();

        res.status(200).json({ success: true, action: action, message: message });

    } catch (error) {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        // Devuelve el error 500 para el cliente, pero loguea el error real en consola
        console.error('Error fatal al alternar favorito (ROLLBACK):', error.message);
        res.status(500).json({ message: 'Error interno del servidor al procesar favoritos.' });
    }
};

const updateRecipe = async (req, res) => {
    const ID_Receta = req.params.id;
    const ID_Usuario = req.user.id; // Usuario que intenta editar

    const { 
        titulo, descripcion, porciones, dificultad, 
        pasos, ingredientes, categorias 
    } = req.body;

    // Validación básica (mantenida)
    if (!titulo || !porciones || !dificultad || !pasos || !ingredientes) {
        return res.status(400).json({ message: 'Faltan campos obligatorios para la actualización.' });
    }

    let connection; 
    
    try {
        // --- 1. VERIFICAR PERMISOS DE EDICIÓN ---
        // CORRECCIÓN: Usamos db.query, que solo devuelve las filas.
        // Necesitamos asegurar que el resultado NO es undefined.
        const authorCheckResults = await db.query( 
            'SELECT Rol_Autor, Puede_Editar FROM RECETA_AUTOR WHERE ID_Receta = ? AND ID_Usuario = ?',
            [ID_Receta, ID_Usuario]
        );
        // authorCheck ahora contiene el array de filas, sin necesidad de desestructurar [].

        if (authorCheckResults.length === 0) {
            return res.status(403).json({ message: 'Acceso denegado. No eres autor de esta receta.' });
        }
        
        // El resultado de la consulta es authorCheckResults[0]
        const author = authorCheckResults[0]; 
        
        // La lógica de verificación de permisos permanece correcta
        if (author.Rol_Autor !== 'Principal' && author.Puede_Editar !== 1) {
            return res.status(403).json({ message: 'Acceso denegado. No tienes permisos para editar esta receta.' });
        }
        
        // --- 2. INICIAR TRANSACCIÓN ---
        // ... el resto de la lógica de transacción y COMMIT/ROLLBACK se mantiene intacta y es correcta.
        
        connection = await db.pool.getConnection(); 
        await connection.beginTransaction(); 

        // 3. ACTUALIZAR: Metadatos de la RECETA
        const updateRecipeSql = 'UPDATE RECETA SET Título=?, Descripción=?, Porciones=?, Dificultad=?, Estado_Publicacion=? WHERE ID_Receta=?';
        await connection.execute(updateRecipeSql, [titulo, descripcion, porciones, dificultad, 'En_Revision', ID_Receta]);

        // --- 4. ELIMINAR DATOS ANTIGUOS ---
        await connection.execute('DELETE FROM PASO WHERE ID_Receta = ?', [ID_Receta]);
        await connection.execute('DELETE FROM RECETA_INGREDIENTE WHERE ID_Receta = ?', [ID_Receta]);
        await connection.execute('DELETE FROM RECETA_CATEGORIA WHERE ID_Receta = ?', [ID_Receta]);

        // --- 5. INSERTAR NUEVOS DATOS (lógica mantenida y correcta) ---
        // ... (Pasos)
        if (pasos && pasos.length > 0) {
             for (const paso of pasos) {
                 const pasoSql = 'INSERT INTO PASO (ID_Receta, Número_Paso, Descripcion_Paso, Duracion_Paso, Imagen_Paso_URL) VALUES (?, ?, ?, ?, ?)';
                 await connection.execute(pasoSql, [ID_Receta, paso.numero, paso.descripcion, paso.duracion, paso.imagen_url || null]);
             }
        }
        
        // ... (Categorías)
        if (categorias && categorias.length > 0) {
            for (const catId of categorias) {
                const catSql = 'INSERT INTO RECETA_CATEGORIA (ID_Receta, ID_Categoria) VALUES (?, ?)';
                await connection.execute(catSql, [ID_Receta, catId]);
            }
        }

        // ... (Ingredientes)
        if (ingredientes && ingredientes.length > 0) {
            for (const ingrediente of ingredientes) {
                let ID_Ingrediente_Base;

                // Buscar Ingrediente Base
                const [existingIngred] = await connection.execute('SELECT ID_Ingrediente_Base FROM INGREDIENTE_BASE WHERE Nombre_Ingrediente = ?', [ingrediente.nombre]);

                if (existingIngred.length > 0) {
                    ID_Ingrediente_Base = existingIngred[0].ID_Ingrediente_Base;
                } else {
                    // Si no existe, insertarlo
                    const [newIngredResult] = await connection.execute('INSERT INTO INGREDIENTE_BASE (Nombre_Ingrediente) VALUES (?)', [ingrediente.nombre]);
                    ID_Ingrediente_Base = newIngredResult.insertId;
                }

                // Insertar en RECETA_INGREDIENTE
                const recipeIngredSql = 'INSERT INTO RECETA_INGREDIENTE (ID_Receta, ID_Ingrediente_Base, ID_Unidad, Cantidad, Notas) VALUES (?, ?, ?, ?, ?)';
                await connection.execute(recipeIngredSql, [ID_Receta, ID_Ingrediente_Base, ingrediente.id_unidad, ingrediente.cantidad, ingrediente.notas]);
            }
        }
        
        // --- 6. FINALIZAR TRANSACCIÓN ---
        await connection.commit(); 
        connection.release(); 

        res.status(200).json({ success: true, message: `Receta ${ID_Receta} actualizada y reenviada a revisión.` });

    } catch (error) {
        if (connection) {
            await connection.rollback(); 
            connection.release();
        }
        console.error('Error fatal al actualizar la receta (ROLLBACK):', error.message); 
        res.status(500).json({ message: 'Error interno del servidor al actualizar la receta.' });
    }
};

// --- DELETE /api/recipes/{id} (Eliminar Receta) ---
// src/controllers/recipe.controller.js

// --- DELETE /api/recipes/{id} (Implementación de SOFT DELETE) ---
const deleteRecipe = async (req, res) => {
    const ID_Receta = req.params.id;
    const ID_Usuario = req.user.id;
    const userRole = req.user.role; 

    try {
        // 1. VERIFICACIÓN DE PERMISOS OPTIMIZADA (Se mantiene)
        if (userRole !== 'Admin') {
            const authorCheck = await db.query(
                'SELECT Rol_Autor FROM RECETA_AUTOR WHERE ID_Receta = ? AND ID_Usuario = ?',
                [ID_Receta, ID_Usuario]
            );
            
            if (authorCheck.length === 0 || authorCheck[0].Rol_Autor !== 'Principal') {
                return res.status(403).json({ message: 'Permiso denegado. Solo el autor principal o un administrador pueden eliminar esta receta.' });
            }
        }
        
        // 2. SOFT DELETE: Marcar la receta como eliminada y cambiar el estado
        const sql = 'UPDATE RECETA SET Eliminada = TRUE, Estado_Publicacion = ? WHERE ID_Receta = ?';
        
        // CORRECCIÓN CLAVE: Acceso directo al objeto OkPacket (sin desestructuración)
        const result = await db.query(sql, ['Eliminada', ID_Receta]); 

        // Accedemos directamente a la propiedad affectedRows del objeto OkPacket
        if (result.affectedRows === 0) { 
             return res.status(404).json({ message: `Receta ${ID_Receta} no encontrada.` });
        }

        res.status(200).json({ success: true, message: `Receta ${ID_Receta} marcada para eliminación lógica (Soft Delete).` });

    } catch (error) {
        console.error('Error al realizar Soft Delete:', error.message);
        res.status(500).json({ message: 'Error interno del servidor al gestionar la eliminación.' });
    }
};

// --- RUTA DE ADMINISTRACIÓN ADICIONAL: RESTAURACIÓN ---
const restoreRecipe = async (req, res) => {
    const ID_Receta = req.params.id;
    const ID_Usuario = req.user.id;
    const userRole = req.user.role; 

    try {
        // 1. VERIFICACIÓN DE PERMISOS
        // Para la restauración, solo el autor principal o un administrador pueden revertir el Soft Delete.
        if (userRole !== 'Admin') {
            const authorCheck = await db.query(
                'SELECT Rol_Autor FROM RECETA_AUTOR WHERE ID_Receta = ? AND ID_Usuario = ?',
                [ID_Receta, ID_Usuario]
            );
            
            if (authorCheck.length === 0 || authorCheck[0].Rol_Autor !== 'Principal') {
                return res.status(403).json({ message: 'Permiso denegado. Solo el autor principal o un administrador pueden restaurar esta receta.' });
            }
        }

        // 2. RESTAURACIÓN: Cambiar Eliminada de TRUE a FALSE y a estado Borrador
        const sql = 'UPDATE RECETA SET Eliminada = FALSE, Estado_Publicacion = ? WHERE ID_Receta = ?';
        
        // El estado 'Borrador' es seguro porque exige revisión o publicación manual.
        const result = await db.query(sql, ['Borrador', ID_Receta]); 

        if (result.affectedRows === 0) {
             // 404 si la receta no existe o ya está restaurada
             return res.status(404).json({ message: `Receta ${ID_Receta} no encontrada o ya está activa.` });
        }

        res.status(200).json({ 
            success: true, 
            message: `Receta ${ID_Receta} restaurada. Estado cambiado a 'Borrador' para revisión.` 
        });

    } catch (error) {
        console.error('Error al restaurar la receta:', error.message);
        res.status(500).json({ message: 'Error interno del servidor al restaurar la receta.' });
    }
};

// Asegúrate de añadir restoreRecipe y deleteRecipe al module.exports.
// Además, debes implementar la ruta de restauración en recipe.routes.js:
// router.put('/:id/restore', authMiddleware.verifyToken, adminMiddleware.adminCheck, recipeController.restoreRecipe);
const updateRecipeStatus = async (req, res) => {
    const ID_Receta = req.params.id;
    const ID_Administrador = req.user.id; 
    
    // El body debe contener el nuevo estado deseado y las notas del revisor
    const { nuevo_estado, notas_revisor } = req.body; 

    // Validación del estado
    const validStatuses = ['Publicada', 'Rechazada'];
    if (!validStatuses.includes(nuevo_estado)) {
        return res.status(400).json({ message: 'Estado no válido. Debe ser "Publicada" o "Rechazada".' });
    }

    let connection;
    try {
        // --- 1. INICIAR TRANSACCIÓN ---
        connection = await db.pool.getConnection();
        await connection.beginTransaction();

        // 2. ACTUALIZAR: El estado de la receta
        const updateSql = 'UPDATE RECETA SET Estado_Publicacion = ? WHERE ID_Receta = ?';
        const [updateResult] = await connection.execute(updateSql, [nuevo_estado, ID_Receta]);

        if (updateResult.affectedRows === 0) {
            await connection.rollback();
            connection.release();
            return res.status(404).json({ message: 'Receta no encontrada para actualizar.' });
        }

        // 3. REGISTRAR: El evento de revisión en la tabla REVISION
        const revisionSql = 'INSERT INTO REVISION (ID_Receta, ID_Administrador, Resultado, Notas_Revisor) VALUES (?, ?, ?, ?)';
        await connection.execute(revisionSql, [ID_Receta, ID_Administrador, nuevo_estado, notas_revisor || '']);

        // 4. NOTIFICAR (Lógica de Negocio)
        // Lógica: Identificar al autor de la receta y generar una NOTIFICACION
        // Esto requeriría una consulta para obtener el ID_Usuario del autor y luego insertar en NOTIFICACION.

        // --- 5. FINALIZAR TRANSACCIÓN ---
        await connection.commit();
        connection.release();

        res.status(200).json({ 
            success: true, 
            message: `Receta ${ID_Receta} marcada como ${nuevo_estado.toUpperCase()}.` 
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        console.error('Error al actualizar el estado de la receta:', error.message);
        res.status(500).json({ message: 'Error interno del servidor al procesar la revisión.' });
    }
};


// --- POST /api/recipes/{id}/comments (Publicar Comentario) ---
const postComment = async (req, res) => {
    const ID_Receta = req.params.id;
    const ID_Usuario = req.user.id;
    const { texto, id_comentario_padre } = req.body;

    if (!texto) {
        return res.status(400).json({ message: 'El texto del comentario es obligatorio.' });
    }

    try {
        const sql = `
            INSERT INTO COMENTARIO (ID_Receta, ID_Usuario, Texto, Fecha, ID_Comentario_Padre) 
            VALUES (?, ?, ?, NOW(), ?)
        `;
        const params = [ID_Receta, ID_Usuario, texto, id_comentario_padre || null];

        // CORRECCIÓN FINAL: Capturar el objeto OkPacket directamente y acceder a .insertId
        // Ya no se necesita results[0] porque db.query devuelve el objeto principal.
        const result = await db.query(sql, params); 
        
        // Acceso directo al ID insertado
        const insertedId = result.insertId; 

        res.status(201).json({ 
            success: true, 
            message: 'Comentario publicado con éxito.',
            ID_Comentario: insertedId 
        });

    } catch (error) {
        console.error('Error al publicar comentario:', error.message);
        res.status(500).json({ message: 'Error interno del servidor al publicar comentario.' });
    }
};

// --- GET /api/recipes/{id}/comments (Listar Comentarios) ---
const getCommentsByRecipe = async (req, res) => {
    const ID_Receta = req.params.id;

    try {
        const sql = `
            SELECT 
                C.ID_Comentario, C.Texto, C.Fecha, C.ID_Comentario_Padre,
                U.ID_Usuario, U.Nombre, U.Apellido
            FROM COMENTARIO C
            JOIN USUARIO U ON C.ID_Usuario = U.ID_Usuario
            WHERE C.ID_Receta = ? AND C.Estado = 'Visible'
            -- CORRECCIÓN: Usar 'Fecha' para la ordenación
            ORDER BY C.Fecha ASC 
        `;
        const comments = await db.query(sql, [ID_Receta]);
        
        res.status(200).json({ success: true, data: comments });

    } catch (error) {
        console.error('Error al obtener comentarios:', error.message);
        res.status(500).json({ message: 'Error interno del servidor al listar comentarios.' });
    }
};

// --- DELETE /api/comments/{id} (Eliminar Comentario) ---
const deleteComment = async (req, res) => {
    const ID_Comentario = req.params.commentId;
    const ID_Usuario = req.user.id; // ID del usuario que hace la petición
    const userRole = req.user.role; // Rol del usuario que hace la petición

    try {
        // 1. VERIFICACIÓN DE PERMISOS: Obtener el dueño actual del comentario
        const commentOwnerCheck = await db.query(
            'SELECT ID_Usuario FROM COMENTARIO WHERE ID_Comentario = ?', 
            [ID_Comentario]
        );
        
        if (commentOwnerCheck.length === 0) {
            return res.status(404).json({ message: 'Comentario no encontrado.' });
        }
        
        const ownerId = commentOwnerCheck[0].ID_Usuario;
        const isOwner = ownerId === ID_Usuario;
        const isAdmin = userRole === 'Admin';

        // 2. APLICAR REGLA DE NEGOCIO
        if (!isOwner && !isAdmin) {
            return res.status(403).json({ 
                message: 'Acceso denegado. Solo el autor del comentario o un administrador puede eliminarlo.' 
            });
        }
        
        // 3. ELIMINACIÓN LÓGICA (Soft Delete)
        await db.query("UPDATE COMENTARIO SET Estado = 'Eliminado' WHERE ID_Comentario = ?", [ID_Comentario]);
        
        res.status(200).json({ success: true, message: 'Comentario marcado como eliminado.' });

    } catch (error) {
        // Si hay un error de conexión o de BD, se captura aquí.
        console.error('Error al eliminar comentario:', error.message);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

// --- POST /api/comments/{id}/report (Reportar Comentario) ---
const reportComment = async (req, res) => {
    const ID_Comentario = req.params.commentId;
    const ID_Usuario = req.user.id;
    const { motivo } = req.body;

    let connection;
    try {
        // 1. INICIAR TRANSACCIÓN para registrar el reporte y actualizar el contador
        connection = await db.pool.getConnection();
        await connection.beginTransaction();

        // 2. Insertar el registro de reporte
        const reportSql = 'INSERT INTO REPORTE_COMENTARIO (ID_Comentario, ID_Usuario, Motivo, Fecha_Reporte) VALUES (?, ?, ?, NOW())';
        await connection.execute(reportSql, [ID_Comentario, ID_Usuario, motivo || 'Reporte sin especificar']);

        // 3. Incrementar el contador de reportes en la tabla COMENTARIO
        await connection.execute("UPDATE COMENTARIO SET Reportes_Activos = Reportes_Activos + 1, Estado = 'Reportado' WHERE ID_Comentario = ?", [ID_Comentario]);

        // NOTA: Si el contador supera un umbral (ej. 5), el estado podría cambiar a 'Oculto' automáticamente.
        
        await connection.commit();
        connection.release();

        res.status(200).json({ success: true, message: 'Comentario reportado para revisión. Gracias.' });

    } catch (error) {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        // Este error puede ocurrir si se intenta reportar el mismo comentario dos veces (si la PK lo impide)
        console.error('Error al reportar comentario:', error.message);
        res.status(500).json({ message: 'Error interno del servidor al procesar el reporte.' });
    }
};

// --- PUT /api/comments/{id}/restore (Restaurar Comentario) ---
const restoreComment = async (req, res) => {
    const ID_Comentario = req.params.commentId;
    const ID_Administrador = req.user.id; 
    
    try {
        // 1. Verificar si el comentario existe
        // NOTA: Asumimos que esta consulta SELECT aún devuelve el array de filas
        const commentCheck = await db.query('SELECT ID_Comentario FROM COMENTARIO WHERE ID_Comentario = ?', [ID_Comentario]); 

        if (commentCheck.length === 0) {
            return res.status(404).json({ message: 'Comentario no encontrado.' });
        }

        // 2. RESTAURAR: Cambiar el estado a 'Visible' y resetear el contador de reportes
        const sql = `
            UPDATE COMENTARIO 
            SET Estado = 'Visible', Reportes_Activos = 0 
            WHERE ID_Comentario = ?
        `;
        // CORRECCIÓN CLAVE: Capturar el OkPacket directamente
        const result = await db.query(sql, [ID_Comentario]); 

        if (result.affectedRows === 0) { // Acceso directo a .affectedRows
            // ... (manejo de error si no se actualiza ninguna fila)
        }

        res.status(200).json({ 
            success: true, 
            message: `Comentario ${ID_Comentario} restaurado y visible.` 
        });

    } catch (error) {
        console.error('Error al restaurar comentario:', error.message);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

// --- EXPORTACIÓN DE FUNCIONES ---
module.exports = {
    getAllRecipes,
    getRecipeById,
    createRecipe,
    toggleLike,
    rateRecipe,
    toggleFavorite,
    updateRecipe,
    deleteRecipe,
    restoreRecipe,
    updateRecipeStatus,
    reportComment,
    postComment,
    getCommentsByRecipe,
    deleteComment,
    restoreComment
};