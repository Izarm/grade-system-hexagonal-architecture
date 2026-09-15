const { leerNombreDePeticion } = require('../../../shared/personName');
const { ConflictError } = require('../../../shared/errors');

class CreateStudent {
    constructor(studentRepository) {
        this.studentRepository = studentRepository;
    }

    async execute(data) {
        // Apellidos y nombres por separado. Acepta { lastName, firstName },
        // los alias en español y tambien el { fullName } antiguo, que separa
        // automaticamente. Valida y normaliza (espacios, mayusculas, tildes).
        const nombre = leerNombreDePeticion(data);
        // Auto-generar código si no se proporciona
        const studentCode = data.studentCode || data.student_code
            || await this.studentRepository.generateCode();

        // Normalizar todos los campos nuevos de San José de Tarbes
        // Avisar del codigo repetido antes de que reviente la base de datos.
        const repetido = await this.studentRepository.findByStudentCode(studentCode);
        if (repetido) {
            throw new ConflictError('Ya existe un estudiante con ese código', 'studentCode');
        }

        const normalized = {
            ...data,
            lastName: nombre.apellidos,
            firstName: nombre.nombres,
            studentCode,
            documentType:      data.documentType      || data.document_type      || null,
            documentNumber:    data.documentNumber    || data.document_number    || null,
            documentIssueDate: data.documentIssueDate || data.document_issue_date || null,
            documentIssuePlace:data.documentIssuePlace|| data.document_issue_place|| null,
            phoneLandline:     data.phoneLandline     || data.phone_landline     || null,
            phoneMobile1:      data.phoneMobile1      || data.phone_mobile1      || null,
            phoneMobile2:      data.phoneMobile2      || data.phone_mobile2      || null,
            emailFather:       data.emailFather       || data.email_father       || null,
            emailMother:       data.emailMother       || data.email_mother       || null,
            address:           data.address           || null,
            guardian:          data.guardian          || null,
            admissionDate:     data.admissionDate     || data.admission_date     || null,
            withdrawalDate:    data.withdrawalDate    || data.withdrawal_date    || null,
            withdrawalReason:  data.withdrawalReason  || data.withdrawal_reason  || null,
            observations:      data.observations      || null,
        };

        return await this.studentRepository.create(normalized);
    }
}

module.exports = CreateStudent;