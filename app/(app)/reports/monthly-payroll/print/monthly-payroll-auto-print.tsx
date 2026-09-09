"use client";

import { useEffect } from "react";

export function MonthlyPayrollAutoPrint() {
    useEffect(() => {
        window.print();
    }, []);

    return null;
}
