// src/config/swagger.config.js

const swaggerJSDoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0', // Versión de OpenAPI
        info: {
            title: 'ChefSphere API (Recetario Gourmet)', // Título de la documentación
            version: '1.0.0',
            description: 'API RESTful completa para la gestión de recetas, usuarios, interacciones y flujo editorial.',
            contact: {
                name: 'Tu Nombre',
                email: 'tu.correo@ejemplo.com'
            }
        },
        servers: [
            {
                url: 'http://localhost:3000', // URL base de tu API
                description: 'Servidor de Desarrollo Local'
            }
        ],
        components: {
            securitySchemes: {
                // Definición del esquema de seguridad (JWT Bearer Token)
                BearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Acceso mediante token JWT obtenido en /api/auth/login'
                }
            }
        },
        security: [
            // Aplica la seguridad globalmente (puedes sobrescribirla por ruta)
            // {
            //     BearerAuth: []
            // }
        ]
    },
    // Rutas donde se buscarán los comentarios JSDoc
    apis: [
        './src/routes/*.js',       // Escanea todos tus archivos de rutas
        './src/controllers/*.js',   // Puedes añadir los controladores para lógica más detallada
        './src/routes/auth.routes.js', // (C) Explicitly include the auth file
        './src/routes/recipe.routes.js' 
    ],
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;