export interface ParsedSMS {
    amount: number;
    merchant?: string;
}

export const parseBankSMS = (sms: string): ParsedSMS | null => {
    // Basic regex to find amounts like Rs. 500, INR 500, etc.
    const amountRegex = /(?:Rs\.?|INR|₹)\s*([\d,]+\.?\d*)/i;
    const match = sms.match(amountRegex);

    if (match && match[1]) {
        const amount = parseFloat(match[1].replace(/,/g, ''));
        
        // Very basic merchant extraction (e.g. "at Starbucks", "to John")
        let merchant = undefined;
        const merchantRegex = /(?:at|to)\s+([A-Za-z0-9\s]+?)(?=\s+(?:on|via|ref|using|.|$))/i;
        const merchantMatch = sms.match(merchantRegex);
        if (merchantMatch && merchantMatch[1]) {
            merchant = merchantMatch[1].trim();
        }

        return { amount, merchant };
    }

    return null;
};
