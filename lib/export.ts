import * as XLSX from "xlsx";

/**
 * Downloads a simple array of objects directly to a CSV file.
 * Automatically extracts the headers from the keys of the first row.
 */
export function exportToCSV(data: any[], filename: string) {
    if (!data || data.length === 0) return;

    const worksheet = XLSX.utils.json_to_sheet(data);
    const csvContent = XLSX.utils.sheet_to_csv(worksheet);

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Generates an Excel (.xlsx) file containing one or more sheets from arrays of objects.
 * Automatically auto-sizes the columns based on the content length.
 */
export function exportToExcel(data: any[], filename: string, sheetName: string = "Data") {
    if (!data || data.length === 0) return;

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);

    // Provide a simple auto-fit width heuristic based on the length of strings in columns (including headers)
    const objectKeys = Object.keys(data[0]);
    const wscols = objectKeys.map(key => {
        // Compute max width required for this column
        let maxLength = key.length;
        for (let i = 0; i < data.length; i++) {
            const val = data[i][key];
            if (val !== null && val !== undefined) {
                const len = String(val).length;
                if (len > maxLength) maxLength = len;
            }
        }
        return { wch: Math.min(maxLength + 2, 50) }; // Cap max width so it doesn't span eternally
    });

    worksheet["!cols"] = wscols;

    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Generates a local browser download popup
    XLSX.writeFile(workbook, `${filename}.xlsx`);
}
