import L from 'leaflet';
import { useCallback } from 'react';

export const stopMapDomEvent = (event) => {
    event?.stopPropagation?.();
    if (event?.nativeEvent) {
        L.DomEvent.stopPropagation(event.nativeEvent);
    }
};

export const useLeafletDomEventIsolation = () => {
    return useCallback((element) => {
        if (!element) return;
        L.DomEvent.disableClickPropagation(element);
        L.DomEvent.disableScrollPropagation(element);
    }, []);
};
