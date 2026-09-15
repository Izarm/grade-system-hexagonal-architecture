const SkeletonRow = ({ cols = 4 }) => (
    <tr className="animate-pulse">
        {Array.from({ length: cols }).map((_, i) => (
            <td key={i} className="px-4 py-3">
                <div className="h-4 bg-gray-200 rounded" style={{ width: `${60 + (i * 10) % 30}%` }} />
            </td>
        ))}
    </tr>
);

const SkeletonTable = ({ rows = 5, cols = 4 }) => (
    <tbody>
        {Array.from({ length: rows }).map((_, i) => (
            <SkeletonRow key={i} cols={cols} />
        ))}
    </tbody>
);

export const SkeletonCard = ({ lines = 3 }) => (
    <div className="animate-pulse p-4 border border-gray-100 rounded-lg space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
            <div key={i} className="h-4 bg-gray-200 rounded" style={{ width: `${80 - i * 20}%` }} />
        ))}
    </div>
);

export default SkeletonTable;
