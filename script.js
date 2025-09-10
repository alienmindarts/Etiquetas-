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

// Function to parse address string
function parseAddress(addressString) {
    const parts = addressString.split(',').map(part => part.trim());
    // Assume last 3 parts are: Country, Province/City, Phone
    // But based on examples, it's more like: Name, ...Address..., City Postal, Province, Country, Phone
    // For flexibility, we'll take the first part as name, last as phone, second last as country, etc.
    let phone = parts.pop();
    let country = parts.pop().toUpperCase();
    const province = parts.pop(); // May be optional
    const cityPostal = parts.pop();
    const address = parts.slice(1).join(', '); // Everything after name
    const name = parts[0];

    // Add country code if missing
    const code = countryCodes[country];
    if (code && !phone.startsWith('+')) {
        phone = code + ' ' + phone.replace(/^\+?\d+\s*/, ''); // Remove any existing + and digits, then add code
    }

    return {
        name,
        address,
        cityPostal,
        province,
        country,
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
    const lines = doc.splitTextToSize(text, maxWidth);
    lines.forEach(line => {
        doc.text(line, x, y);
        y += lineHeight;
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
    y = addWrappedText(doc, address.cityPostal + ', ' + address.province + ', ' + address.country, x, y, maxWidth, 4);
    y = addWrappedText(doc, address.phone, x, y, maxWidth, 4);

    return y - initialY;
}

// Function to generate HTML preview
function generatePreviewHTML(addresses) {
    let html = '';
    addresses.forEach(address => {
        html += `
            <div class="label">
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
                    ${address.address}<br>
                    ${address.cityPostal}, ${address.province}, ${address.country}<br>
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

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const margin = 10; // mm
    const gutter = 5;  // mm between columns and rows
    const colW = (pageWidth - 2 * margin - gutter) / 2; // mm

    const xLeft = margin;
    const xRight = margin + colW + gutter;
    let y = margin;

    for (const el of labels) {
        // Render each preview label to a canvas (2x for sharpness)
        const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
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
}

// Event listener for textarea input
document.getElementById('addresses').addEventListener('input', updatePreview);

// Event listener for generate button
document.getElementById('generateBtn').addEventListener('click', async () => {
    // Ensure preview is current
    updatePreview();
    await generatePDFFromPreview();
});