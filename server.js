const swaggerUi = require('swagger-ui-express'); // <-- NUEVA Importación
const swaggerSpec = require('./src/config/swagger.config'); // <-- NUEVA Importación

// server.js o app.js
const express = require('express');
const app = express();
const cors = require('cors');
const port = 3000;

const corsOptions = {
    origin: 'http://localhost:5173', // Solo permite peticiones desde tu frontend React
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true, // Importante para enviar cookies/tokens si fuera necesario
    optionsSuccessStatus: 204
};

app.use(cors(corsOptions)); // <-- APLICA EL MIDDLEWARE

// MIDDLEWARE ESENCIAL
app.use(express.json()); // Permite a Express leer cuerpos JSON de peticiones

// Rutas
const authRoutes = require('./src/routes/auth.routes');
const recipeRoutes = require('./src/routes/recipe.routes'); // La agregaremos después
const listRoutes = require('./src/routes/list.routes');


app.use('/api/auth', authRoutes);
app.use('/api/lists', listRoutes); // <-- Conexión de rutas de listas

const commentRoutes = require('./src/routes/comment.routes'); // Nueva ruta para comentarios
app.use('/api/comments', commentRoutes); // <-- Conexión de rutas de comentarios

app.use('/api/recipes', recipeRoutes); // <-- Las rutas de recetas quedan limpias
// ...

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.listen(port, () => {
  console.log(`ChefSphere API corriendo en http://localhost:${port}`);
  console.log(`Documentación de Swagger disponible en http://localhost:${port}/api-docs`); // Mensaje útil
  
});