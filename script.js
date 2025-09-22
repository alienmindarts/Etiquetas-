// Import jsPDF
const { jsPDF } = window.jspdf;

// Fixed sender information
const sender = {
    name: 'ALOE',
    address1: 'APARTADO 002125',
    address2: 'EC MONTE BELO SETÚBAL',
    address3: '2910-998 SETÚBAL, PORTUGAL'
};

// Country phone indicatives
const countryCodes = {
    'PORTUGAL': '+351',
    'SPAIN': '+34',
    'ITALY': '+39',
    'NETHERLANDS': '+31',
    'GERMANY': '+49',
    'SWITZERLAND': '+41',
    'FRANCE': '+33',
    'BELGIUM': '+32',
    'AUSTRIA': '+43',
    'DENMARK': '+45',
    'SWEDEN': '+46',
    'NORWAY': '+47',
    'FINLAND': '+358',
    'IRELAND': '+353',
    'LUXEMBOURG': '+352',
    'MONACO': '+377',
    'ANDORRA': '+376',
    'SAN MARINO': '+378',
    'VATICAN CITY': '+379'
};
let logoDataUrl = null;
let defaultLogoDataUrl = null;
let showLogoEnabled = true;

// Helpers for parsing and formatting
function normalizeCountryName(name) {
    if (!name) return '';
    const upper = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
    const aliases = {
        // Spanish variants
        'ITALIA': 'ITALY',
        'ESPANA': 'SPAIN',
        'ALEMANIA': 'GERMANY',
        'SUIZA': 'SWITZERLAND',

        // Portuguese variants
        'ESPANHA': 'SPAIN',
        'ALEMANHA': 'GERMANY',
        'SUICA': 'SWITZERLAND',
        'FRANCA': 'FRANCE',
        'BELGICA': 'BELGIUM',
        'PAISES BAIXOS': 'NETHERLANDS',
        'PAISES-BAIXOS': 'NETHERLANDS',
        'HOLANDA': 'NETHERLANDS',
        'DINAMARCA': 'DENMARK',
        'SUECIA': 'SWEDEN',
        'NORUEGA': 'NORWAY',
        'FINLANDIA': 'FINLAND',
        'IRLANDA': 'IRELAND',
        'LUXEMBURGO': 'LUXEMBOURG',
        'CIDADE DO VATICANO': 'VATICAN CITY',
        'VATICANO': 'VATICAN CITY',
        'SAO MARINO': 'SAN MARINO',

        // French variant
        'PAYS-BAS': 'NETHERLANDS',

        // Spanish variant
        'PAISES BAJOS': 'NETHERLANDS'
    };
    return aliases[upper] || upper;
}

function joinNonEmpty(parts, sep = ', ') {
    return parts.filter(p => p && String(p).trim() !== '').join(sep);
}

// Extract postal code and city from a "cityPostal" string, prioritizing rules by country
function extractPostalAndCity(cityPostalRaw, countryNormalized) {
    const cleaned = (cityPostalRaw || '').replace(/[;,]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleaned) return { postal: '', city: '' };

    const cn = (countryNormalized || '').toUpperCase();
    // Country-specific patterns to disambiguate 4/5 digit formats
    const patternsByCountry = {
        'PORTUGAL': /\b\d{4}-\d{3}\b/,
        'NETHERLANDS': /\b\d{4}\s?[A-Z]{2}\b/i,
        'GERMANY': /\b\d{5}\b/,
        'FRANCE': /\b\d{5}\b/,
        'ITALY': /\b\d{5}\b/,
        'SPAIN': /\b\d{5}\b/,
        'FINLAND': /\b\d{5}\b/,
        'SWEDEN': /\b\d{3}\s?\d{2}\b/,
        'BELGIUM': /\b\d{4}\b/,
        'AUSTRIA': /\b\d{4}\b/,
        'DENMARK': /\b\d{4}\b/,
        'NORWAY': /\b\d{4}\b/,
        'IRELAND': /\b[A-Z]\d{2}\s?[A-Z0-9]{4}\b/i, // Eircode (simplified)
        'LUXEMBOURG': /\bL?-?\d{4}\b/i,
        'MONACO': /\b\d{5}\b/,
        'ANDORRA': /\bAD\d{3}\b/i,
        'SAN MARINO': /\b\d{5}\b/,
        'VATICAN CITY': /\b\d{5}\b/
    };

    let pattern = patternsByCountry[cn] || /\b(\d{4}-\d{3}|\d{4}\s?[A-Z]{2}|\d{5}|\d{3}\s?\d{2}|\d{4})\b/i;
    const match = cleaned.match(pattern);
    if (!match) {
        return { postal: '', city: cleaned };
    }

    const postal = match[0].toUpperCase();
    const city = cleaned.replace(match[0], '').replace(/\s+/g, ' ').replace(/^[, ]+|[, ]+$/g, '').trim();
    return { postal, city };
}

// Build the location line, ensuring it starts with the postal code when available
function buildLocationLine(cityPostalRaw, province, countryNormalized) {
    const { postal, city } = extractPostalAndCity(cityPostalRaw, countryNormalized);
    const base = postal ? `${postal}${city ? ' ' + city : ''}` : (cityPostalRaw || '').trim();
    return joinNonEmpty([base, province, countryNormalized], ', ');
}

// Function to parse address string
function parseAddress(addressString) {
    const parts = addressString.split(',').map(part => part.trim()).filter(p => p.length > 0);

    const name = parts.shift() || '';
    let phone = parts.pop() || '';
    const countryOriginal = parts.pop() || '';
    const countryNormalized = normalizeCountryName(countryOriginal);

    // Add country code if missing
    const code = countryCodes[countryNormalized];
    if (code && !/^\s*\+/.test(phone)) {
        phone = `${code} ${phone}`.trim();
    }

    let address = '';
    let cityPostal = '';
    let province = '';

    if (parts.length >= 2) {
        address = parts.slice(0, -1).join(', ');
        // Allow manual line breaks in street address using ';'
        address = address.split(';').map(s => s.trim()).filter(Boolean).join('\n');
        cityPostal = parts[parts.length - 1];
    } else if (parts.length === 1) {
        address = parts[0];
        address = address.split(';').map(s => s.trim()).filter(Boolean).join('\n');
        cityPostal = '';
    }

    return {
        name,
        address,
        cityPostal,
        province,
        country: countryNormalized,
        phone
    };
}

// Function to generate PDF
function generatePDF(addresses) {
    const doc = new jsPDF();
    let y = 20; // Starting Y position

    addresses.forEach((address, index) => {
        if (y > 220) { // New page if needed (leave space for two labels)
            doc.addPage();
            y = 20;
        }

        // Left label
        let x = 10;
        const height1 = addLabel(doc, address, x, y);

        // Right label (duplicate)
        x = 115;
        const height2 = addLabel(doc, address, x, y);

        const maxHeight = Math.max(height1, height2);
        y += maxHeight + 5; // Small space between pairs of labels
    });

    return doc;
}

// Helper function to add wrapped text and return new y
function addWrappedText(doc, text, x, y, maxWidth, lineHeight = 4) {
    const paragraphs = String(text || '').split(/\n/);
    paragraphs.forEach(par => {
        const lines = doc.splitTextToSize(par, maxWidth);
        lines.forEach(line => {
            if (String(line).trim() !== '') {
                doc.text(line, x, y);
            }
            y += lineHeight;
        });
    });
    return y;
}

// Helper function to add a single label
function addLabel(doc, address, x, y) {
    const maxWidth = 85; // Prevent overlap with adjacent label
    const initialY = y;

    // Sender section
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    y = addWrappedText(doc, 'FROM / SENDER:', x, y, maxWidth, 4);
    y = addWrappedText(doc, sender.name, x, y, maxWidth, 4);
    y = addWrappedText(doc, sender.address1, x, y, maxWidth, 4);
    y = addWrappedText(doc, sender.address2, x, y, maxWidth, 4);
    y = addWrappedText(doc, sender.address3, x, y, maxWidth, 4);
    y += 2; // Small spacing between sections

    // Ship to section (bold)
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    y = addWrappedText(doc, 'SHIP TO:', x, y, maxWidth, 4);
    y = addWrappedText(doc, address.name, x, y, maxWidth, 4);
    y = addWrappedText(doc, address.address, x, y, maxWidth, 4);
    const locationLine = buildLocationLine(address.cityPostal, address.province, address.country);
    y = addWrappedText(doc, locationLine, x, y, maxWidth, 4);
    y = addWrappedText(doc, address.phone, x, y, maxWidth, 4);

    return y - initialY;
}

// Function to generate HTML preview (supports optional top-right logo)
function generatePreviewHTML(addresses) {
    let html = '';
    addresses.forEach(address => {
        const locationLine = buildLocationLine(address.cityPostal, address.province, address.country);
        const hasLogo = !!logoDataUrl && showLogoEnabled;
        const addressHTML = address.address
            ? address.address.split('\n').map(s => s.trim()).filter(Boolean).join('<br>')
            : '';
        html += `
            <div class="label ${hasLogo ? 'has-logo' : ''}">
                ${hasLogo ? `<img class="label-logo" src="${logoDataUrl}" alt="Logo">` : ''}
                <div class="sender">
                    FROM / SENDER:<br>
                    ${sender.name}<br>
                    ${sender.address1}<br>
                    ${sender.address2}<br>
                    ${sender.address3}
                </div>
                <div class="recipient">
                    <strong>SHIP TO:</strong><br>
                    ${address.name}<br>
                    ${addressHTML ? addressHTML + '<br>' : ''}
                    ${locationLine ? locationLine + '<br>' : ''}
                    ${address.phone}
                </div>
            </div>
        `;
    });
    return html;
}

// Function to update preview
function updatePreview() {
    const input = document.getElementById('addresses').value;
    const addressLines = input.split('\n').filter(line => line.trim() !== '');
    const addresses = addressLines.map(line => {
        try {
            return parseAddress(line);
        } catch (e) {
            return null; // Skip invalid lines
        }
    }).filter(addr => addr !== null);

    const previewHTML = generatePreviewHTML(addresses);
    document.getElementById('preview').innerHTML = previewHTML;
}

// Generate PDF by rasterizing each label and placing two identical copies per row
async function generatePDFFromPreview() {
    const previewEl = document.getElementById('preview');
    const labels = Array.from(document.querySelectorAll('#preview .label'));
    if (!previewEl || labels.length === 0) {
        return;
    }

    // Enable PDF-only styling (remove frames, layout tweaks)
    previewEl.classList.add('pdf-mode');

    try {
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // Minimize margins and gutter to maximize size while keeping two columns (~13.5% increase)
        const margin = 0; // mm
        const gutter = 0; // mm between columns and rows
        const colW = (pageWidth - 2 * margin - gutter) / 2; // mm -> 105mm on A4

        const xLeft = margin;
        const xRight = margin + colW + gutter;
        let y = margin;

        for (const el of labels) {
            // Render each preview label to a canvas (2x for sharpness)
            const canvas = await html2canvas(el, { scale: 3, useCORS: true, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/png');

            const ratio = canvas.height / canvas.width;
            const imgWmm = colW;
            const imgHmm = imgWmm * ratio;

            // Page-break if needed
            if (y + imgHmm > pageHeight - margin) {
                doc.addPage();
                y = margin;
            }

            // Place two identical copies of the same label side-by-side (one row)
            doc.addImage(imgData, 'PNG', xLeft, y, imgWmm, imgHmm);
            doc.addImage(imgData, 'PNG', xRight, y, imgWmm, imgHmm);

            // Advance to next row
            y += imgHmm + gutter;
        }

        doc.save('shipping-labels.pdf');
    } finally {
        // Restore screen styling
        previewEl.classList.remove('pdf-mode');
    }
}

// Logo upload handling
const logoInputEl = document.getElementById('logoInput');
const logoPreviewEl = document.getElementById('logoPreview');
const showLogoEl = document.getElementById('showLogo');

// Sync checkbox state and wire change handler
if (showLogoEl) {
    showLogoEnabled = showLogoEl.checked;
    showLogoEl.addEventListener('change', () => {
        showLogoEnabled = showLogoEl.checked;
        updatePreview();
    });
}

// Preload default Aloe SVG as data URL (shown automatically unless user clears or hides)
(function preloadDefaultLogo() {
    const defaultLogoSVG = `<svg width="3288" height="3544" viewBox="0 0 3288 3544" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M1552.94 1887.65C1552.94 2309.81 1326.52 2687.5 1011.5 2687.5C1328.31 2687.5 1552.94 3065.22 1552.94 3487.35C1552.94 3065.22 1772.8 2687.5 2094.38 2687.5C1777.58 2687.5 1552.94 2309.81 1552.94 1887.65Z" fill="black"/>
<path d="M1993.47 1548.02C1993.47 1703.89 1905.99 1843.35 1784.28 1843.35C1906.68 1843.35 1993.47 1982.81 1993.47 2138.68C1993.47 1982.81 2078.42 1843.35 2202.67 1843.35C2080.26 1843.35 1993.47 1703.89 1993.47 1548.02Z" fill="black"/>
<path d="M630.036 3012.36L1028.73 2027.93L1555.4 713.713L1898.43 1657.78L1898.44 1657.81C1958.63 1566.67 1993.46 1450.69 1993.46 1328.98C1993.46 1601.13 2166.23 1844.68 2410.13 1845.81L1644 0L359.317 3056.66C277.281 3250.27 205.09 3379.88 142.743 3445.51C80.3952 3511.14 32.8144 3543.95 0 3543.95H703.868C605.425 3498.01 556.204 3420.9 556.204 3312.61C556.204 3233.86 580.814 3133.77 630.036 3012.36Z" fill="black"/>
<path d="M2073.46 2055L2515.22 3066.51C2567.72 3194.48 2593.98 3292.92 2593.98 3361.83C2593.98 3443.87 2552.96 3504.58 2470.92 3543.95H3288C3248.62 3537.39 3194.48 3501.3 3125.57 3435.67C3059.94 3370.04 2991.03 3248.63 2918.84 3071.43L2410.13 1845.81C2264.87 1846.47 2146.38 1930.6 2073.46 2055Z" fill="black"/>
</svg>`;
    defaultLogoDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(defaultLogoSVG);

    // Only set as current logo if user hasn't provided one yet
    if (!logoDataUrl) {
        logoDataUrl = defaultLogoDataUrl;
        if (logoPreviewEl) {
            logoPreviewEl.src = logoDataUrl;
            logoPreviewEl.style.display = 'inline-block';
        }
        updatePreview();
    }
})();
if (logoInputEl) {
    logoInputEl.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) {
            // Clear logo if selection was removed
            logoDataUrl = null;
            if (logoPreviewEl) {
                logoPreviewEl.src = '';
                logoPreviewEl.style.display = 'none';
            }
            updatePreview();
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            logoDataUrl = reader.result;
            if (logoPreviewEl) {
                logoPreviewEl.src = logoDataUrl;
                logoPreviewEl.style.display = 'inline-block';
            }
            updatePreview();
        };
        reader.readAsDataURL(file);
    });
}

// Event listener for textarea input
document.getElementById('addresses').addEventListener('input', updatePreview);

// Event listener for generate button
document.getElementById('generateBtn').addEventListener('click', async () => {
    // Ensure preview is current
    updatePreview();
    await generatePDFFromPreview();
});