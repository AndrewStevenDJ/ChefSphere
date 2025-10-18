const adminCheck = (req, res, next) => {
    // 1. Verificar si el usuario está autenticado (req.user existe)
    // El auth.middleware.js ya debería haber hecho esto, pero es buena práctica verificar.
    if (!req.user) {
        return res.status(401).json({ message: 'No autenticado. Token requerido.' });
    }
    
    // 2. Verificar el rol
    if (req.user.role === 'Admin') {
        next(); // El usuario es Admin, continuar con el controlador.
    } else {
        // Acceso denegado si el rol no es Admin (incluso si es Autor o Lector)
        res.status(403).json({ message: 'Acceso denegado. Se requiere rol de Administrador.' });
    }
};

module.exports = {
    adminCheck
};