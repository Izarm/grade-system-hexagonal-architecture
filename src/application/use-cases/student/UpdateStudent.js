const { leerNombreDePeticion } = require('../../../shared/personName');
const { NotFoundError, ConflictError } = require('../../../shared/errors');

class UpdateStudent {
    constructor(studentRepository, enrollmentRepository = null) {
        this.studentRepository = studentRepository;
        this.enrollmentRepository = enrollmentRepository;
    }

    async execute(id, data) {
        const existing = await this.studentRepository.findById(id);
        if (!existing) {
            throw new NotFoundError('El estudiante no existe o ya fue eliminado');
        }

        // Apellidos y nombres por separado (acepta tambien el formato antiguo).
        const nombre = leerNombreDePeticion(data);
        const studentCode = data.studentCode || data.student_code || existing.student_code;

        const repetido = await this.studentRepository.findByStudentCode(studentCode, id);
        if (repetido) {
            throw new ConflictError('Ya existe otro estudiante con ese código', 'studentCode');
        }

        const normalized = {
            ...data,
            lastName: nombre.apellidos,
            firstName: nombre.nombres,
            studentCode,
            // El repositorio lee estos en camelCase; si llegan en snake_case
            // (p. ej. al reenviar la ficha completa) igual se conservan.
            birthDate:        data.birthDate        || data.birth_date        || null,
            folioNumber:      data.folioNumber       ?? data.folio_number       ?? null,
            documentType:     data.documentType     || data.document_type     || null,
            documentNumber:   data.documentNumber   || data.document_number   || null,
            documentIssueDate:data.documentIssueDate|| data.document_issue_date|| null,
            documentIssuePlace:data.documentIssuePlace|| data.document_issue_place|| null,
            phoneLandline:    data.phoneLandline    || data.phone_landline    || null,
            phoneMobile1:     data.phoneMobile1     || data.phone_mobile1     || null,
            phoneMobile2:     data.phoneMobile2     || data.phone_mobile2     || null,
            emailFather:      data.emailFather      || data.email_father      || null,
            emailMother:      data.emailMother      || data.email_mother      || null,
            address:          data.address          || null,
            guardian:         data.guardian         || null,
            admissionDate:    data.admissionDate    || data.admission_date    || null,
            withdrawalDate:   data.withdrawalDate   || data.withdrawal_date   || null,
            withdrawalReason: data.withdrawalReason || data.withdrawal_reason || null,
            observations:     data.observations     || null,
        };

        const updated = await this.studentRepository.update(id, normalized);
        if (!updated) {
            throw new Error('No se pudo actualizar el estudiante');
        }

        // El folio se asigna por orden alfabetico dentro de cada bloque de grados,
        // asi que un cambio de nombre desordena la numeracion de todo el año.
        const cambioElNombre =
            existing.last_name !== nombre.apellidos ||
            existing.first_name !== nombre.nombres;

        if (this.enrollmentRepository && cambioElNombre) {
            const matriculas = await this.enrollmentRepository.findByStudent(id);
            const años = [...new Set(matriculas.map(m => m.academic_year_id))];
            for (const año of años) {
                await this.enrollmentRepository.recalculateFolioNumbers(año);
            }
        }

        return { id, ...normalized };
    }
}

module.exports = UpdateStudent;
