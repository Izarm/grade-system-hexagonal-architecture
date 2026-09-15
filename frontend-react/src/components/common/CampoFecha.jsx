import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

// Campo de fecha en español.
//
// El <input type="date"> del navegador trae su propio calendario, pero ese
// calendario lo dibuja el navegador y sigue el idioma del navegador, no el de
// la página: en un Chrome en inglés sale "Su Mo Tu We Th Fr Sa" y 09/13/2026
// por mucho que el documento diga lang="es". Este componente lo reemplaza para
// que todos vean lo mismo, esté como esté configurado su equipo.
//
// Mantiene la misma interfaz que el input nativo: `value` y lo que recibe
// `onChange` son cadenas 'AAAA-MM-DD' (o '' cuando está vacío), así que los
// formularios que ya guardaban ese formato no cambian.

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

// --- Conversiones ------------------------------------------------------------
// Se trabaja siempre con las piezas de la cadena, sin construir un Date a
// partir de 'AAAA-MM-DD': eso lo interpreta como UTC y en Colombia (UTC-5)
// devuelve el día anterior.

const aTexto = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};

const aIso = (texto) => {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((texto || '').trim());
    if (!m) return null;
    const d = Number(m[1]), mes = Number(m[2]), a = Number(m[3]);
    if (mes < 1 || mes > 12 || d < 1) return null;
    if (d > diasDelMes(a, mes - 1)) return null;
    return `${a}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

const diasDelMes = (anio, mes) => new Date(anio, mes + 1, 0).getDate();

const hoyIso = () => {
    const h = new Date();
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
};

const piezas = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? { anio: +m[1], mes: +m[2] - 1, dia: +m[3] } : null;
};

const CampoFecha = ({
    value = '',
    onChange,
    min,
    max,
    disabled = false,
    required = false,
    id,
    className = 'w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm',
}) => {
    const [abierto, setAbierto] = useState(false);
    const [texto, setTexto] = useState(aTexto(value));
    const [posicion, setPosicion] = useState(null);

    const hoy = hoyIso();
    const inicial = piezas(value) || piezas(hoy);
    const [mesVisible, setMesVisible] = useState({ anio: inicial.anio, mes: inicial.mes });

    const contenedor = useRef(null);
    const panel = useRef(null);

    // Si el formulario cambia el valor desde fuera (al editar otro estudiante,
    // o al limpiar el formulario) el texto escrito debe seguirlo.
    useEffect(() => { setTexto(aTexto(value)); }, [value]);

    const colocar = useCallback(() => {
        if (!contenedor.current) return;
        const r = contenedor.current.getBoundingClientRect();
        const ALTO = 330, ANCHO = 280;
        // Se abre hacia arriba si abajo no cabe, y se mantiene dentro de la
        // ventana por la derecha.
        const arriba = r.bottom + ALTO > window.innerHeight && r.top > ALTO;
        setPosicion({
            top: arriba ? r.top - ALTO - 4 : r.bottom + 4,
            left: Math.max(8, Math.min(r.left, window.innerWidth - ANCHO - 8)),
        });
    }, []);

    const abrir = () => {
        if (disabled) return;
        const p = piezas(value) || piezas(hoy);
        setMesVisible({ anio: p.anio, mes: p.mes });
        colocar();
        setAbierto(true);
    };

    // El panel va en un portal sobre el body, así que hay que cerrarlo a mano
    // al hacer clic fuera, al pulsar Escape y al mover la página.
    useEffect(() => {
        if (!abierto) return;
        const fuera = (e) => {
            if (contenedor.current?.contains(e.target)) return;
            if (panel.current?.contains(e.target)) return;
            setAbierto(false);
        };
        const tecla = (e) => { if (e.key === 'Escape') setAbierto(false); };
        document.addEventListener('mousedown', fuera);
        document.addEventListener('keydown', tecla);
        window.addEventListener('resize', colocar);
        // `true` para enterarse también del scroll dentro de los modales.
        window.addEventListener('scroll', colocar, true);
        return () => {
            document.removeEventListener('mousedown', fuera);
            document.removeEventListener('keydown', tecla);
            window.removeEventListener('resize', colocar);
            window.removeEventListener('scroll', colocar, true);
        };
    }, [abierto, colocar]);

    const fueraDeRango = (iso) => (min && iso < min) || (max && iso > max);

    const elegir = (iso) => {
        if (fueraDeRango(iso)) return;
        onChange(iso);
        setTexto(aTexto(iso));
        setAbierto(false);
    };

    // Se escribe con las barras puestas automáticamente. Solo se avisa al
    // formulario cuando la fecha está completa y es válida.
    const escribir = (e) => {
        const crudo = e.target.value.replace(/[^\d]/g, '').slice(0, 8);
        let t = crudo;
        if (crudo.length > 4) t = `${crudo.slice(0, 2)}/${crudo.slice(2, 4)}/${crudo.slice(4)}`;
        else if (crudo.length > 2) t = `${crudo.slice(0, 2)}/${crudo.slice(2)}`;
        setTexto(t);
        if (t === '') { onChange(''); return; }
        const iso = aIso(t);
        if (iso && !fueraDeRango(iso)) onChange(iso);
    };

    // Al salir del campo, lo que no sea una fecha válida se descarta y se
    // vuelve a mostrar lo que hay guardado.
    const salir = () => {
        if (texto === '') { onChange(''); return; }
        const iso = aIso(texto);
        if (!iso || fueraDeRango(iso)) setTexto(aTexto(value));
    };

    const mover = (n) => setMesVisible(({ anio, mes }) => {
        const d = new Date(anio, mes + n, 1);
        return { anio: d.getFullYear(), mes: d.getMonth() };
    });

    const { anio, mes } = mesVisible;
    const primerDia = new Date(anio, mes, 1).getDay();
    const total = diasDelMes(anio, mes);
    const seleccionado = piezas(value);

    const celdas = [];
    for (let i = 0; i < primerDia; i++) celdas.push(null);
    for (let d = 1; d <= total; d++) celdas.push(d);

    const isoDe = (d) => `${anio}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    const calendario = (
        <div
            ref={panel}
            style={{ position: 'fixed', top: posicion?.top, left: posicion?.left, width: 280, zIndex: 1000 }}
            className="bg-white rounded-xl shadow-xl border border-gray-200 p-3"
        >
            <div className="flex items-center justify-between mb-2">
                <button type="button" onClick={() => mover(-1)} aria-label="Mes anterior"
                    className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 transition">
                    &#8249;
                </button>
                <div className="flex items-center gap-1">
                    <select value={mes} onChange={e => setMesVisible(v => ({ ...v, mes: +e.target.value }))}
                        aria-label="Mes"
                        className="text-sm font-semibold text-gray-800 bg-transparent outline-none cursor-pointer capitalize">
                        {MESES.map((m, i) => <option key={m} value={i}>{m}</option>)}
                    </select>
                    <select value={anio} onChange={e => setMesVisible(v => ({ ...v, anio: +e.target.value }))}
                        aria-label="Año"
                        className="text-sm font-semibold text-gray-800 bg-transparent outline-none cursor-pointer">
                        {Array.from({ length: 121 }, (_, i) => 1940 + i).map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                </div>
                <button type="button" onClick={() => mover(1)} aria-label="Mes siguiente"
                    className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 transition">
                    &#8250;
                </button>
            </div>

            <div className="grid grid-cols-7 gap-0.5 mb-1">
                {DIAS.map(d => (
                    <div key={d} className="h-7 flex items-center justify-center text-[11px] font-medium text-gray-400">{d}</div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
                {celdas.map((d, i) => {
                    if (d === null) return <div key={`v${i}`} className="h-8" />;
                    const iso = isoDe(d);
                    const esHoy = iso === hoy;
                    const esElegido = seleccionado && seleccionado.anio === anio && seleccionado.mes === mes && seleccionado.dia === d;
                    const bloqueado = fueraDeRango(iso);
                    let estilo = 'text-gray-700 hover:bg-gray-100';
                    if (bloqueado) estilo = 'text-gray-300 cursor-not-allowed';
                    else if (esElegido) estilo = 'bg-blue-700 text-white font-semibold hover:bg-blue-800';
                    else if (esHoy) estilo = 'text-blue-700 font-semibold ring-1 ring-blue-200';
                    return (
                        <button key={iso} type="button" disabled={bloqueado} onClick={() => elegir(iso)}
                            className={`h-8 rounded-md text-sm transition ${estilo}`}>
                            {d}
                        </button>
                    );
                })}
            </div>

            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                <button type="button"
                    onClick={() => { onChange(''); setTexto(''); setAbierto(false); }}
                    className="text-xs text-gray-500 hover:text-gray-700 transition">
                    Borrar
                </button>
                <button type="button"
                    onClick={() => elegir(hoy)}
                    disabled={fueraDeRango(hoy)}
                    className="text-xs font-medium text-blue-700 hover:text-blue-800 transition disabled:opacity-40">
                    Hoy
                </button>
            </div>
        </div>
    );

    return (
        <div ref={contenedor} className="relative">
            <input
                id={id}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="dd/mm/aaaa"
                value={texto}
                onChange={escribir}
                onBlur={salir}
                onFocus={colocar}
                disabled={disabled}
                required={required}
                className={`${className} pr-9`}
            />
            <button type="button" onClick={abrir} disabled={disabled} tabIndex={-1}
                aria-label="Abrir calendario"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-700 transition disabled:opacity-40">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            </button>
            {abierto && posicion && createPortal(calendario, document.body)}
        </div>
    );
};

export default CampoFecha;
