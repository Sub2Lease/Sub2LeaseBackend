const fs = require("node:fs");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const libre = require("libreoffice-convert");

function generateContract(template_path, output_path, data) {
    const content = fs.readFileSync(template_path);
    const zip = new PizZip(content);

    const doc = new Docxtemplater(zip, {
        delimiters: { start: '{', end: '}' }
    });

    doc.render({
        OWNER_NAME: data.OWNER_NAME,
        TENANT_NAME: data.TENANT_NAME,
        ADDRESS: data.ADDRESS,
        DATE: data.DATE,
        START_DATE: data.START_DATE,
        END_DATE: data.END_DATE,
        RENT: data.RENT,
        DEPOSIT: data.DEPOSIT,
        OWNER_SIGNATURE: data.OWNER_SIGNATURE,
        TENANT_SIGNATURE: data.TENANT_SIGNATURE,
        OWNER_SIGN_DATE: data.OWNER_SIGN_DATE,
        TENANT_SIGN_DATE: data.TENANT_SIGN_DATE
    });

    const buffer = doc.getZip().generate({ type: "nodebuffer" });
    fs.writeFileSync(output_path, buffer);
}

function signContract(input_path, output_path, isOwner, signature, date) {
    const content = fs.readFileSync(input_path);
    const zip = new PizZip(content);

    const doc = new Docxtemplater(zip, {
        delimiters: { start: '{', end: '}' }
    });
    console.log("TAGS:", doc.getTags());
    if (isOwner) {
        doc.render({
            OWNER_SIGNATURE: signature,
            OWNER_SIGN_DATE: date,
            TENANT_SIGNATURE: "{TENANT_SIGNATURE}",
            TENANT_SIGN_DATE: "{TENANT_SIGN_DATE}"
        });
    } else {
        doc.render({
            TENANT_SIGNATURE: signature,
            TENANT_SIGN_DATE: date,
            OWNER_SIGNATURE: "{OWNER_SIGNATURE}",
            OWNER_SIGN_DATE: "{OWNER_SIGN_DATE}"
        });
    }

    const buffer = doc.getZip().generate({ type: "nodebuffer" });
    fs.writeFileSync(output_path, buffer);
}
function doc_to_pdf(inputPath, outputPath, callback) {
    const docxData = fs.readFileSync(inputPath);

    libre.convert(docxData, ".pdf", undefined, (err, done) => {
        if (err) {
            console.error(`Error converting: ${err}`);
        }
        fs.writeFileSync(outputPath, done);
        console.log("Finished converting!");
        if (callback) callback();
    });
}

module.exports = { generateContract, signContract, doc_to_pdf };

// EXAMPLE USAGE
// const data = {
//   OWNER_NAME: "John Doe",
//   TENANT_NAME: "Alice Smith",
//   ADDRESS: "123 State St, Madison WI",
//   DATE: "11/22/2025",
//   START_DATE: "01/01/2026",
//   END_DATE: "05/31/2026",
//   RENT: "1100",
//   DEPOSIT: "1100",
//   OWNER_SIGNATURE: "John Doe",
//   TENANT_SIGNATURE: "Alice Smith",
//   OWNER_SIGN_DATE: "11/22/2025",
//   TENANT_SIGN_DATE: "11/22/2025",
// };

// generateContract(
//   "./templates/Sublease-Agreement-Template.docx",
//   "./temp.docx",
//   data
// );

// signContract(
//   "./templates/Filled-Sublease-Agreement.docx",
//   "./templates/Filled-Sublease-Agreement.docx",
//   true,
//   data.OWNER_SIGNATURE,
//   data.OWNER_SIGN_DATE
// );