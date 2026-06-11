const pool = require('../infrastructure/database/mysql');

async function checkAndCloseYear() {
    try {
        const [years] = await pool.query(
            `SELECT id, name, end_date 
             FROM academic_years 
             WHERE active = 1 
               AND end_date < CURDATE() 
               AND deleted_at IS NULL`
        );
        
        const closedYears = [];
        
        for (const year of years) {
            console.log(`Cerrando año automaticamente: ${year.name}`);
            
            await pool.beginTransaction();
            
            try {
                await pool.query(
                    `UPDATE periods 
                     SET status = 'closed', closed_at = NOW()
                     WHERE academic_year_id = ? AND status = 'open'`,
                    [year.id]
                );
                
                await pool.query(
                    `UPDATE academic_years 
                     SET active = 0 
                     WHERE id = ?`,
                    [year.id]
                );
                
                await pool.query(
                    `INSERT INTO academic_year_logs (academic_year_id, action, user_id, notes)
                     VALUES (?, 'auto_closed', NULL, ?)`,
                    [year.id, `Cierre automatico por fecha limite: ${year.end_date}`]
                );
                
                await pool.commit();
                closedYears.push(year.name);
                
            } catch (error) {
                await pool.rollback();
                console.error(`Error cerrando año ${year.name}:`, error);
            }
        }
        
        if (closedYears.length > 0) {
            console.log(`Años cerrados automaticamente: ${closedYears.join(', ')}`);
        }
        
        return closedYears;
        
    } catch (error) {
        console.error('Error en cierre automatico:', error);
        return [];
    }
}
 
module.exports = { checkAndCloseYear };