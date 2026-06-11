import React, { createContext, useContext, useState, useCallback } from 'react';

const RefreshContext = createContext();

export const RefreshProvider = ({ children }) => {
    const [refreshKey, setRefreshKey] = useState(0);

    const refresh = useCallback(() => {
        setRefreshKey(prev => prev + 1);
    }, []);

    return (
        <RefreshContext.Provider value={{ refreshKey, refresh }}>
            {children}
        </RefreshContext.Provider>
    );
};

export const useRefresh = () => useContext(RefreshContext);