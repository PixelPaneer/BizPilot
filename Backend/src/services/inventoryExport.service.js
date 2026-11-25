import PDFDocument from "pdfkit";

export function buildInventoryCsv(items) {
  const rows = [
    ["Product Name", "Category", "Available Quantity", "Unit", "Selling Price", "Stock Status"],
  ];

  for (const item of items) {
    rows.push([
      item.name,
      item.category,
      item.quantity,
      item.unit,
      Number(item.price).toFixed(2),
      item.status,
    ]);
  }

  return rows
    .map((row) =>
      row
        .map((value) => {
          const text = String(value ?? "");
          return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        })
        .join(",")
    )
    .join("\r\n");
}

export async function buildInventoryPdf(items) {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
    const chunks = [];

    document.on("data", (chunk) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);

    document.font("Helvetica-Bold").fontSize(22).fillColor("#234c3a").text("BizPilot");
    document.moveDown(0.15);
    document.font("Helvetica").fontSize(9).fillColor("#788078").text("AI Business Assistant");
    document.moveDown(0.8);

    document.font("Helvetica-Bold").fontSize(16).fillColor("#234c3a").text("Inventory Report");
    document.moveDown(0.35);
    document.font("Helvetica").fontSize(10).fillColor("#26352d");
    document.text(`Generated on: ${new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date())}`);
    document.text(`Total products: ${items.length}`);

    document.moveDown(0.6);

    const tableTop = document.y;
    const left = document.page.margins.left;
    const widths = [145, 75, 82, 55, 90, 75];
    const headers = ["Product Name", "Category", "Quantity", "Unit", "Selling Price", "Status"];

    document.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff");
    document.rect(left, tableTop, widths.reduce((sum, width) => sum + width, 0), 24).fill("#234c3a");

    let x = left;
    headers.forEach((header, index) => {
      document.text(header, x + 4, tableTop + 7, {
        width: widths[index] - 8,
        height: 10,
        align: index >= 2 && index <= 4 ? "right" : "left",
      });
      x += widths[index];
    });

    let y = tableTop + 24;
    items.forEach((item, rowIndex) => {
      const rowHeight = 26;
      if (y + rowHeight > document.page.height - document.page.margins.bottom) {
        document.addPage();
        y = document.page.margins.top;
      }

      if (rowIndex % 2 === 1) {
        document.rect(left, y, widths.reduce((sum, width) => sum + width, 0), rowHeight).fill("#fbf7ef");
      }

      const values = [
        item.name,
        item.category,
        String(item.quantity),
        item.unit,
        `Rs. ${Number(item.price).toFixed(2)}`,
        item.status === "out-of-stock"
          ? "Out of Stock"
          : item.status === "low-stock"
            ? "Low Stock"
            : "In Stock",
      ];

      x = left;
      document.font("Helvetica").fontSize(8).fillColor("#26352d");
      values.forEach((value, index) => {
        document.text(String(value), x + 4, y + 8, {
          width: widths[index] - 8,
          height: 12,
          ellipsis: true,
          align: index >= 2 && index <= 4 ? "right" : "left",
        });
        x += widths[index];
      });
      y += rowHeight;
    });

    const pageCount = document.bufferedPageRange().count;
    for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      document.switchToPage(pageIndex);
      document.font("Helvetica").fontSize(8).fillColor("#788078");
      document.text(
        `Page ${pageIndex + 1} of ${pageCount}`,
        left,
        document.page.height - 24,
        { width: document.page.width - left - document.page.margins.right, align: "right" }
      );
    }

    document.end();
  });
}
