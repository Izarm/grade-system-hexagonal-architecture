class User {
    constructor(id, name, document, email, phone, password, role, deletedAt = null) {
        this.id = id;
        this.name = name;
        this.document = document;        // Documento único
        this.email = email;              // Correo único
        this.phone = phone;              // Opcional
        this.password = password;
        this.role = role;                // 'admin' o 'docente'
        this.deletedAt = deletedAt;      // Soft delete
    }
}

module.exports = User;
