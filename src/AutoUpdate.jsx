import React, { useEffect } from 'react';
import { checkForUpdate } from './updateUtils';

const AutoUpdate = () => {
    useEffect(() => {
        const intervalo = setInterval(() => checkForUpdate(false), 60 * 1000);
        return () => clearInterval(intervalo);
    }, []);

    return null;
};

export default AutoUpdate;
