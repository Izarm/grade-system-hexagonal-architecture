import { createContext, useContext, useState, useCallback } from 'react';
import Notification from '../components/common/Notification';

const NotificationContext = createContext();

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const showNotification = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type, duration }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, duration);
  }, []);

  const showSuccess = (message) => showNotification(message, 'success');
  const showError = (message) => showNotification(message, 'error');
  const showWarning = (message) => showNotification(message, 'warning');
  const showInfo = (message) => showNotification(message, 'info');

  return (
    <NotificationContext.Provider value={{ showNotification, showSuccess, showError, showWarning, showInfo }}>
      {children}
      {notifications.map(notif => (
        <Notification
          key={notif.id}
          message={notif.message}
          type={notif.type}
          duration={notif.duration}
        />
      ))}
    </NotificationContext.Provider>
  );
};