import io
import logging
from typing import List, Dict, Any
import pandas as pd
from fastapi import Response
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch

# Set up logging
logger = logging.getLogger(__name__)

def generate_xlsx_response(data: List[Dict[str, Any]], filename: str) -> Response:
    """
    Generates an Excel file and returns a standard FastAPI Response.
    """
    try:
        logger.info(f"Generating XLSX for {filename} with {len(data)} records")
        df = pd.DataFrame(data)
        
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Student Fees')
        
        content = output.getvalue()
        output.close()
        
        headers = {
            'Content-Disposition': f'attachment; filename="{filename}.xlsx"',
            'Content-Length': str(len(content)),
            'Access-Control-Expose-Headers': 'Content-Disposition'
        }
        
        return Response(
            content=content,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers=headers
        )
    except Exception as e:
        logger.error(f"Error generating XLSX: {str(e)}")
        raise

def generate_pdf_response(data: List[Dict[str, Any]], filename: str, title: str = "Financial Report") -> Response:
    """
    Generates a PDF file and returns a standard FastAPI Response.
    """
    try:
        logger.info(f"Generating PDF for {filename} with {len(data)} records")
        if not data:
            data = [{"Message": "No records found for export"}]
            
        output = io.BytesIO()
        # Use landscape for better table fit
        doc = SimpleDocTemplate(
            output, 
            pagesize=landscape(letter),
            rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=18
        )
        
        elements = []
        styles = getSampleStyleSheet()
        
        # Add Header
        title_para = Paragraph(f"<b>{title}</b>", styles['Heading1'])
        elements.append(title_para)
        elements.append(Paragraph(f"Generated on {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M')}", styles['Normal']))
        elements.append(Spacer(1, 0.2 * inch))

        # Prepare table data
        headers = list(data[0].keys())
        table_data = [headers]
        for item in data:
            row = [str(item.get(h, "")) for h in headers]
            table_data.append(row)

        # Create table with dynamic widths
        # Assuming landscape letter is 11 inches wide, using ~10 inches for table
        col_width = 10 * inch / len(headers)
        t = Table(table_data, colWidths=[col_width] * len(headers))
        
        # Add styling
        style = TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#1e293b")), # Slate 800
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            ('TOPPADDING', (0, 0), (-1, 0), 10),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor("#f8fafc")), # Slate 50
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")), # Slate 200
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ])
        t.setStyle(style)
        
        elements.append(t)
        doc.build(elements)
        
        content = output.getvalue()
        output.close()
        
        headers = {
            'Content-Disposition': f'attachment; filename="{filename}.pdf"',
            'Content-Length': str(len(content)),
            'Access-Control-Expose-Headers': 'Content-Disposition'
        }
        
        return Response(
            content=content,
            media_type='application/pdf',
            headers=headers
        )
    except Exception as e:
        logger.error(f"Error generating PDF: {str(e)}")
        raise
