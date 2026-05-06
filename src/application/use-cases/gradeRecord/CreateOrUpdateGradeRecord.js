class CreateOrUpdateGradeRecord {
    constructor(gradeRecordRepository, periodRepository) {
        this.gradeRecordRepository = gradeRecordRepository;
        this.periodRepository = periodRepository;
    }

    async execute(data) {
        const { periodId, normalNote, aptitudinalNote } = data;
        // Validar período abierto
        const isOpen = await this.periodRepository.checkOpen(periodId);
        if (!isOpen) throw new Error('No se pueden modificar notas en un período cerrado');
        // Validar rango de notas (0 a 10)
        if (normalNote !== undefined && (normalNote < 0 || normalNote > 10)) {
            throw new Error('La nota normal debe estar entre 0 y 10');
        }
        if (aptitudinalNote !== undefined && (aptitudinalNote < 0 || aptitudinalNote > 10)) {
            throw new Error('La nota actitudinal debe estar entre 0 y 10');
        }
        // Calcular promedio automáticamente
        let average = null;
        if (normalNote !== undefined && aptitudinalNote !== undefined) {
            average = (parseFloat(normalNote) + parseFloat(aptitudinalNote)) / 2;
            average = Math.round(average * 100) / 100; // redondear a 2 decimales
        } else if (normalNote !== undefined) {
            average = parseFloat(normalNote);
        } else if (aptitudinalNote !== undefined) {
            average = parseFloat(aptitudinalNote);
        }
        data.average = average;
        return await this.gradeRecordRepository.upsert(data);
    }
}
module.exports = CreateOrUpdateGradeRecord;