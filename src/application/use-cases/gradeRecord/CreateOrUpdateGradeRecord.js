class CreateOrUpdateGradeRecord {
    constructor(gradeRecordRepository, periodRepository) {
        this.gradeRecordRepository = gradeRecordRepository;
        this.periodRepository = periodRepository;
    }

    async execute(data) {
        console.log('=== CreateOrUpdateGradeRecord ===');
        console.log('Datos recibidos:', data);
        
        const { periodId, normalNote, aptitudinalNote, absences, isElective } = data;
        
        const isOpen = await this.periodRepository.checkOpen(periodId);
        console.log('Período abierto:', isOpen);
        if (!isOpen) throw new Error('No se pueden modificar notas en un período cerrado');
        
        let processedNormalNote = null;
        let average = null;
        
        if (normalNote !== undefined && normalNote !== null && normalNote !== '') {
            if (typeof normalNote === 'string' && normalNote.includes(',')) {
                const notes = normalNote.split(',').map(n => parseFloat(n.trim()));
                const validNotes = notes.filter(n => !isNaN(n) && n >= 0 && n <= 10);
                if (validNotes.length > 0) {
                    processedNormalNote = validNotes.join(',');
                    const sum = validNotes.reduce((a, b) => a + b, 0);
                    average = sum / validNotes.length;
                    average = Math.round(average * 100) / 100;
                }
            } else {
                const note = parseFloat(normalNote);
                if (!isNaN(note) && note >= 0 && note <= 10) {
                    processedNormalNote = note.toString();
                    if (!isElective) {
                        average = note;
                    }
                }
            }
        }
        
        let processedAptitudinalNote = null;
        if (!isElective && aptitudinalNote !== undefined && aptitudinalNote !== null && aptitudinalNote !== '') {
            const aptValue = parseFloat(aptitudinalNote);
            if (!isNaN(aptValue) && aptValue >= 0 && aptValue <= 10) {
                processedAptitudinalNote = aptValue;
            }
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
        
        console.log('Datos a guardar:', saveData);
        
        const result = await this.gradeRecordRepository.upsert(saveData);
        console.log('Resultado:', result);
        
        return result;
    }
}

module.exports = CreateOrUpdateGradeRecord;