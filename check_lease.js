const fs = require("fs");
const pdfParse = require("pdf-parse");
const { execSync } = require("child_process");
require("dotenv").config();

async function analyzeLeaseGemini(pdfBytes) {
  if (!pdfBytes || !(pdfBytes instanceof Buffer)) {
    throw new Error("Invalid file input: expected raw PDF bytes.");
  }

  if (pdfBytes.length < 500) {
    return {
      allowed: false,
      reason: "The provided file is too small to be a real lease document."
    };
  }

  if (!pdfBytes.slice(0, 4).toString().includes("%PDF")) {
    return {
      allowed: false,
      reason: "This file is not a valid PDF."
    };
  }

  const base64 = pdfBytes.toString("base64");

  const prompt = `
You are a legal text analyzer. Read the LEASE file attached below.

Determine whether subleasing is allowed.

Rules:
- Explicitly allows subleasing → allowed: true
- Allows subleasing only with landlord consent → allowed: "conditional"
- Prohibits subleasing → allowed: false
- Never mentions subleasing/assignment → allowed: "not_mentioned"

Return ONLY JSON exactly like:

{
  "allowed": true/false/"conditional"/"not_mentioned",
  "reason": "short explanation citing the relevant lease text"
}
`;

  // Build JSON payload for v1beta (snake_case fields).
  const payload = {
    contents: [
      {
        parts: [
          {
            inline_data: {
              mime_type: "application/pdf",
              data: base64
            }
          },
          { text: prompt }
        ]
      }
    ]
  };

  // Write temporary payload file (avoids shell command length limits).
  fs.writeFileSync("gemini_payload.json", JSON.stringify(payload));

  // Use v1beta endpoint and the gemini-2.5-flash model.
  const curl = `
    curl -s -X POST \
      -H "Content-Type: application/json" \
      -d @gemini_payload.json \
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}"
  `;

  let raw;
  try {
    raw = execSync(curl, { maxBuffer: 1024 * 1024 * 50 }).toString();
  } catch (err) {
    console.error("Gemini error (curl):", err.toString());
    return { allowed: false, reason: "AI analysis failed. Try again later." };
  }

  let response;
  try {
    response = JSON.parse(raw);
  } catch (err) {
    return { allowed: false, reason: "Gemini returned invalid JSON." };
  }

  const text = response?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    console.error("Gemini error: No text in response:", response);
    return { allowed: false, reason: "Unexpected AI response format." };
  }

    let cleaned = text.trim();

    // Remove ```json or ``` fences if present
    cleaned = cleaned.replace(/```json/i, "").replace(/```/g, "").trim();

    // Extract the first {...} JSON block if Gemini adds explanation
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
    return { allowed: false, reason: "AI returned no valid JSON object." };
    }

    cleaned = jsonMatch[0];

    let result;
    try {
        result = JSON.parse(cleaned);
    } catch (err) {
        console.error("Error parsing cleaned JSON:", cleaned);
        return { allowed: false, reason: "AI returned non-JSON output." };
    }

    return {
        allowed: result.allowed,
        reason: result.reason
    };
}

module.exports = { analyzeLeaseGemini };

async function runTest() {
  try {
    const pdfPath = "leases/_tmp__lease_documents_20231101115817.pdf";  // CHANGE IF NEEDED
    const pdfBytes = fs.readFileSync(pdfPath);
    console.log("PDF loaded. Byte length:", pdfBytes.length);
    const result = await analyzeLeaseGemini(pdfBytes);
    console.log("\n=== Lease Analysis Result ===");
    console.log(result);
  } catch (err) {
    console.error("Error during test:", err);
  }
}

runTest();