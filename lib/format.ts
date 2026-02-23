/**
 * Format a number/price to be readable, with a custom thousand separator.
 * We avoid non-breaking spaces (\\u00A0) because they often render as 
 * slashes or weird characters in PDF libraries like jsPDF.
 */
export function formatPrice(amount: number): string {
    if (amount === undefined || amount === null) return "0";

    // Some PDF libraries (like jsPDF) struggle with ANY type of space character
    // and might convert them to slashes or ignore them. We will use a standard 
    // dot (often used in some francophone regions) or a thin space if possible, 
    // but a dot is safest for PDF rendering if spaces fail.
    // However, to stick to the space requirement and bypass regex/Intl issues:

    // Convert to string and split into an array of characters
    const str = Math.round(amount).toString();
    let result = '';

    // Manually insert a standard space every 3 digits from the right
    for (let i = str.length - 1, count = 1; i >= 0; i--, count++) {
        result = str[i] + result;
        if (count % 3 === 0 && i !== 0) {
            // Using a simple Javascript string space " "
            // to avoid any unicode interpretation by jsPDF
            result = " " + result;
        }
    }

    return result;
}

/**
 * Specifically for tickets/PDFs where currency suffix is needed
 */
export function formatCurrency(amount: number): string {
    return `${formatPrice(amount)} F`;
}
