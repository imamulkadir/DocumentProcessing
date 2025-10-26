const mammoth = require("mammoth");
const pdfParse = require("pdf-parse");
const fs = require("fs");
const path = require("path");

class DocumentProcessor {
  constructor() {
    this.supportedTypes = [".pdf", ".docx"];
  }

  async extractText(filePath) {
    try {
      const extension = path.extname(filePath).toLowerCase();

      switch (extension) {
        case ".docx":
          return await this.extractFromDocx(filePath);
        case ".pdf":
          return await this.extractFromPdf(filePath);
        default:
          throw new Error(`Unsupported file type: ${extension}`);
      }
    } catch (error) {
      throw new Error(`Text extraction failed: ${error.message}`);
    }
  }

  async extractFromDocx(filePath) {
    try {
      const buffer = fs.readFileSync(filePath);
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      throw new Error(`DOCX extraction failed: ${error.message}`);
    }
  }

  async extractFromPdf(filePath) {
    try {
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      return data.text;
    } catch (error) {
      throw new Error(`PDF extraction failed: ${error.message}`);
    }
  }

  parseDocumentData(text) {
    try {
      const extractedData = {
        invoice_number: null,
        customer_name: null,
        amount: null,
      };

      const invoicePatterns = [
        /invoice\s*(?:number|no\.?|#)?\s*:?\s*([A-Z0-9\-_]+)/i,
      ];

      for (const pattern of invoicePatterns) {
        const match = text.match(pattern);
        if (match) {
          extractedData.invoice_number = match[1].trim();
          break;
        }
      }

      const customerPatterns = [/name\s*:\s*([A-Za-z0-9\.,&' -]+)(?=\r?\n|$)/i];

      for (const pattern of customerPatterns) {
        const match = text.match(pattern);
        if (match) {
          let customerName = match[1].trim();
          // Clean up the customer name
          customerName = customerName.replace(/[,\.]$/, "").trim();
          if (customerName.length > 2 && customerName.length < 100) {
            extractedData.customer_name = customerName;
            break;
          }
        }
      }

      // Extract amount - look for currency patterns
      const amountPatterns = [
        /(?:total|amount|sum|due)\s*:?\s*\$?([\d,]+\.?\d*)/gi,
        /\$\s*([\d,]+\.?\d*)/g,
        /(?:usd|dollar|dollars)\s*([\d,]+\.?\d*)/gi,
        /([\d,]+\.?\d*)\s*(?:usd|dollar|dollars)/gi,
        /(?:price|cost|fee)\s*:?\s*\$?([\d,]+\.?\d*)/gi,
      ];

      let amounts = [];
      for (const pattern of amountPatterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
          const amount = parseFloat(match[1].replace(/,/g, ""));
          if (!isNaN(amount) && amount > 0) {
            amounts.push(amount);
          }
        }
      }

      // Choose the largest amount as it's likely the total
      if (amounts.length > 0) {
        extractedData.amount = Math.max(...amounts);
      }

      // Fallback: if no specific patterns found, try to extract any reasonable data
      if (!extractedData.invoice_number) {
        const fallbackInvoice = text.match(/([A-Z]{2,}\-?\d{3,})/);
        if (fallbackInvoice) {
          extractedData.invoice_number = fallbackInvoice[1];
        }
      }

      if (!extractedData.customer_name) {
        const fallbackCustomer = text.match(
          /([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/
        );
        if (fallbackCustomer) {
          extractedData.customer_name = fallbackCustomer[1];
        }
      }

      if (!extractedData.amount) {
        const fallbackAmount = text.match(/([\d,]+\.?\d{2})/);
        if (fallbackAmount) {
          const amount = parseFloat(fallbackAmount[1].replace(/,/g, ""));
          if (!isNaN(amount) && amount > 10) {
            // Reasonable minimum amount
            extractedData.amount = amount;
          }
        }
      }

      return extractedData;
    } catch (error) {
      throw new Error(`Data parsing failed: ${error.message}`);
    }
  }

  validateFile(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error("File does not exist");
      }

      const stats = fs.statSync(filePath);
      if (!stats.isFile()) {
        throw new Error("Path is not a file");
      }

      const extension = path.extname(filePath).toLowerCase();
      if (!this.supportedTypes.includes(extension)) {
        throw new Error(`Unsupported file type: ${extension}`);
      }

      // Check file size (16MB limit)
      const maxSize = 16 * 1024 * 1024;
      if (stats.size > maxSize) {
        throw new Error("File too large (max 16MB)");
      }

      return true;
    } catch (error) {
      throw new Error(`File validation failed: ${error.message}`);
    }
  }
}

module.exports = DocumentProcessor;
