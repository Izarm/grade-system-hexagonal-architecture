class CreateOrUpdateGradeRecord {
    constructor(gradeRecordRepository, periodRepository) {
        this.gradeRecordRepository = gradeRecordRepository;
        this.periodRepository = periodRepository;
    }

    async execute(data) {
        const { periodId, normalNote, aptitudinalNote, absences, isElective } = data;

        const isOpen = await this.periodRepository.checkOpen(periodId);
        if (!isOpen) throw new Error('No se pueden modificar notas en un período cerrado');

        // Redondea a un solo decimal
        const round1 = (n) => Math.round(n * 10) / 10;

        let processedNormalNote = null;
        let average = null;

        if (normalNote !== undefined && normalNote !== null && normalNote !== '') {
            const note = parseFloat(normalNote);
            if (isNaN(note)) throw new Error('La nota debe ser un número válido');
            if (note < 0 || note > 10) throw new Error('La nota debe estar entre 0 y 10');
            const r = round1(note);
            processedNormalNote = r.toString();
            if (!isElective) average = r;
        }

        let processedAptitudinalNote = null;
        if (!isElective && aptitudinalNote !== undefined && aptitudinalNote !== null && aptitudinalNote !== '') {
            const aptValue = parseFloat(aptitudinalNote);
            if (isNaN(aptValue)) throw new Error('La nota actitudinal debe ser un número válido');
            if (aptValue < 0 || aptValue > 10) throw new Error('La nota actitudinal debe estar entre 0 y 10');
            processedAptitudinalNote = round1(aptValue);
        }
        
        let processedAbsences = null;
        if (absences !== undefined && absences !== null && absences !== '') {
            const absValue = parseInt(absences);
            if (!isNaN(absValue) && absValue >= 0) {
                processedAbsences = absValue;
            }
        }
        
        const saveData = {
            enrollmentId: data.enrollmentId,
            periodId: data.periodId,
            subjectAssignmentId: data.subjectAssignmentId,
            normalNote: processedNormalNote,
            aptitudinalNote: processedAptitudinalNote,
            absences: processedAbsences,
            average: average,
            isElective: isElective || false,
            teacherId: data.teacherId || null,
        };
        
        const result = await this.gradeRecordRepository.upsert(saveData);
        
        return result;
    }
}

module.exports = CreateOrUpdateGradeRecord;