import React, { useState, useEffect } from 'react';
import api from '../api/client';

export const useActiveAcademicYear = () => {
    const [activeYear, setActiveYear] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadActiveYear = async () => {
        try {
            setLoading(true);
            const response = await api.get('/academic-years/active');
            setActiveYear(response.data);
            setError(null);
        } catch (err) {
            console.error('Error cargando año activo:', err);
            setError(err.response?.data?.message || 'No hay año lectivo activo');
            setActiveYear(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadActiveYear();
    }, []);

    const refresh = () => loadActiveYear();

    return { activeYear, loading, error, refresh };
};