import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const ActiveYearContext = createContext();

export const ActiveYearProvider = ({ children }) => {
    const [activeYear, setActiveYear] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadActiveYear = async () => {
        try {
            setLoading(true);
            const response = await api.get('/academic-years/active');
            setActiveYear(response.data || null);
            setError(null);
        } catch (err) {
            console.error('Error cargando año activo:', err);
            setError(err.response?.data?.message || 'Error de conexión');
            setActiveYear(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadActiveYear();
    }, []);

    const refresh = () => loadActiveYear();

    return (
        <ActiveYearContext.Provider value={{ activeYear, loading, error, refresh }}>
            {children}
        </ActiveYearContext.Provider>
    );
};

export const useActiveYear = () => {
    const context = useContext(ActiveYearContext);
    if (!context) {
        throw new Error('useActiveYear must be used within ActiveYearProvider');
    }
    return context;
};