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
        if (y > 200) { // New page if needed (leave space for two labels)
            doc.addPage();
            y = 20;
        }

        // Left label
        let x = 20;
        addLabel(doc, address, x, y);

        // Right label (duplicate)
        x = 110;
        addLabel(doc, address, x, y);

        y += 80; // Space for next pair of labels
    });

    return doc;
}

// Helper function to add a single label
function addLabel(doc, address, x, y) {
    // Sender section
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('FROM / SENDER:', x, y);
    y += 10;
    doc.text(sender.name, x, y);
    y += 5;
    doc.text(sender.address1, x, y);
    y += 5;
    doc.text(sender.address2, x, y);
    y += 5;
    doc.text(sender.address3, x, y);
    y += 15;

    // Ship to section (bold)
    doc.setFont('helvetica', 'bold');
    doc.text('SHIP TO:', x, y);
    y += 10;
    doc.text(address.name, x, y);
    y += 5;
    doc.text(address.address, x, y);
    y += 5;
    doc.text(address.cityPostal + ', ' + address.province + ', ' + address.country, x, y);
    y += 5;
    doc.text(address.phone, x, y);
}

// Function to generate HTML preview
function generatePreviewHTML(addresses) {
    let html = '';
    addresses.forEach(address => {
        html += `
            <div class="label">
                <div class="sender">
                    <strong>FROM / SENDER:</strong><br>
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

// Event listener for textarea input
document.getElementById('addresses').addEventListener('input', updatePreview);

// Event listener for generate button
document.getElementById('generateBtn').addEventListener('click', () => {
    const input = document.getElementById('addresses').value;
    const addressLines = input.split('\n').filter(line => line.trim() !== '');
    const addresses = addressLines.map(parseAddress);

    const doc = generatePDF(addresses);
    doc.save('shipping-labels.pdf');
});