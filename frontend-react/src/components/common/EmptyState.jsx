const EmptyState = ({ icon, title, description, action }) => (
    <div className="flex flex-col items-center justify-center py-14 text-center">
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4 text-gray-400 text-2xl">
            {icon || '—'}
        </div>
        <p className="text-sm font-medium text-gray-700 mb-1">{title || 'Sin resultados'}</p>
        {description && <p className="text-xs text-gray-400 max-w-xs">{description}</p>}
        {action && <div className="mt-4">{action}</div>}
    </div>
);

export default EmptyState;
