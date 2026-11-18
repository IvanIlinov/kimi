import { useEffect, useState } from 'preact/hooks';
import { api } from './client';

interface State<T> {
    data: T | null;
    error: string | null;
    loading: boolean;
}

// Загрузка данных по адресу. При смене адреса прежние данные остаются на экране, пока идёт новый запрос.
export function useApi<T>(path: string) {
    const [state, setState] = useState<State<T>>({ data: null, error: null, loading: true });
    const [tick, setTick] = useState(0);

    useEffect(() => {
        let alive = true;
        setState((s) => ({ ...s, loading: true, error: null }));
        api<T>(path)
            .then((data) => alive && setState({ data, error: null, loading: false }))
            .catch((e: Error) => alive && setState({ data: null, error: e.message, loading: false }));
        return () => {
            alive = false;
        };
    }, [path, tick]);

    return {
        ...state,
        reload: () => setTick((t) => t + 1),
        setData: (data: T) => setState({ data, error: null, loading: false }),
    };
}
