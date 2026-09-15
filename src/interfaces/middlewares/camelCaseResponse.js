// ADVERTENCIA: Este middleware NO está activado en app.js.
// Para activarlo, primero migrar TODOS los accesos del frontend de snake_case a camelCase
// (full_name → fullName, student_code → studentCode, etc.) ya que sobreescribe res.json globalmente.

function toCamel(str) {
    return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function convertKeys(obj) {
    if (Array.isArray(obj)) return obj.map(convertKeys);
    if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
        return Object.fromEntries(
            Object.entries(obj).map(([k, v]) => [toCamel(k), convertKeys(v)])
        );
    }
    return obj;
}

const camelCaseResponse = (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (data) => originalJson(convertKeys(data));
    next();
};

module.exports = camelCaseResponse;
