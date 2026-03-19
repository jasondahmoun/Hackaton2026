import os
import random
from faker import Faker
from faker.providers import DynamicProvider
from spire.pdf.common import *
from spire.pdf import *
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
import json

fake = Faker('fr_FR')

OUTPUT_DIR = "invoices"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def generate_invoice_data():
    items = []
    total = 0

    Desc_Siret_Dynamic_provider = DynamicProvider(
     provider_name="desc_Siret",
     elements=["Numéro de SIRET : ","SIRET :","No Siret :"],
    )
    Desc_Name_Dynamic_provider = DynamicProvider(
     provider_name="desc_Name",
     elements=["Entreprise : ","Nom de l'entreprise :"],
    )

    Siret_Dynamic_provider = DynamicProvider(
     provider_name="siret_provider",
     elements=["00032517500065","00180725400022","10038820600011","10038843800010","10038844600013","211388446000"],
    )
    produit_Dynamic_provider = DynamicProvider(
     provider_name="produit",
     elements=["Chaise  ", "Table     ","Bureau  ", "Feuille   ", "Enceinte", "Vélo      "],
    )



    fake.add_provider(Siret_Dynamic_provider)
    fake.add_provider(Desc_Siret_Dynamic_provider)
    fake.add_provider(Desc_Name_Dynamic_provider)
    fake.add_provider(produit_Dynamic_provider)
   
    fake.siret_provider()
    supplierSiret= fake.siret_provider()
        
    if(supplierSiret=="00032517500065"):
        supplierName="Thierry JANOYER"
        supplierAddr="51 RUE MARX DORMOY, 13004 MARSEILLE"  
    elif(supplierSiret=="00180725400022"):
        supplierName="Jacques-lucien BRETON"
        supplierAddr="31 RUE D'ALEMBERT, 02100 SAINT-QUENTIN"
    elif(supplierSiret=="10038820600011"):
        supplierName="INDIVISION SARTHOU JEAN ET MARIE-AMELIE"
        supplierAddr="20 ALLEE DES GENISTAS 33680 LACANAU"
    elif(supplierSiret=="10038844600013"):
        supplierName="OFTP"
        supplierAddr="211 RUE DU PLANCONNET 07430 VERNOSC-LES-ANNONAY"
    else:
        supplierName=fake.company()
        supplierAddr=fake.address()

    for _ in range(random.randint(5, 10)):
        price = round(random.uniform(10, 99), 2)
        qty = random.randint(100, 999)
        line_total = price * qty

        items.append({
            "description": fake.produit(),
            "quantity": qty,
            "unit_price": price,
            "total": round(line_total, 2)
        })
    
        total += line_total
         

    return {
        "invoice_number": f"INV-{random.randint(1000,9999)}",
        "date": str(fake.date_between(start_date="-1y", end_date="+1w")),
        "desc_Siret": fake.desc_Siret(),
        "desc_Name": fake.desc_Name(),
        "supplierSiret":supplierSiret,
        "supplierName":supplierName,
        "supplierAddr":supplierAddr,
        "client": fake.company(),
        "address_supplier": fake.address(),
        "address_client": fake.address(),
        "items": items,
        "totalHT": round(total, 2),
        "tva": round(total/5, 2),
        "totalTTC": round(total+total/5, 2)

    }

def generate_pdf(invoice_data, filename):
    c = canvas.Canvas(filename, pagesize=A4)
    width, height = A4

    y = height - 50
    x = width - 10
    c.setFont("Helvetica", 12)

    c.drawString(50, y, f"Facture: {invoice_data['invoice_number']}")
    y -= 20
    c.drawString(50, y, f"Date: {invoice_data['date']}")
    y -= 40

    c.drawString(50, y, "Fournisseur:")
    y -= 20
    
    c.drawString(80, y, invoice_data['desc_Siret'])

    c.drawString(230, y, invoice_data['supplierSiret'])
    y -= 20
    c.drawString(80, y, invoice_data['desc_Name'])
    
    c.drawString(230, y, invoice_data['supplierName'])
    y -= 20
    c.drawString(80, y, "Addresse du Fournisseur:")
    
    c.drawString(230, y, invoice_data['supplierAddr'])
    y -= 40

    c.drawString(50, y, "Client:")
    y -= 20    
    c.drawString(80, y, invoice_data['desc_Siret'])

    c.drawString(230, y, "35174572400200")
    y -= 20
    c.drawString(80, y, invoice_data['desc_Name'])
    
    c.drawString(230, y, "Ikea")
    y -= 20
    c.drawString(80, y, "Addresse du Fournisseur:")
    
    c.drawString(230, y, "425 RUE HENRI BARBUSSE 78370 PLAISIR")
    y -= 40

    c.drawString(50, y, "Articles:")
    y -= 20
    c.drawString(80, y, "Produits        Quantité   Prix Unitaire  Total Produit")
    y -= 20

    for item in invoice_data["items"]:
        line = f"{item['description']}        {item['quantity']}           {item['unit_price']}€            {item['total']} €"
        c.drawString(80, y, line)
        y -= 20

    y -= 20
    c.drawString(50, y, f"TOTAL HT:")
    c.drawString(150, y, f"{invoice_data['totalHT']}€")
    y -= 20
    c.drawString(50, y, f"TVA 20%:")
    c.drawString(150, y, f"{invoice_data['tva']}€")
    y -= 20
    c.drawString(50, y, f"TOTAL TTC:")
    c.drawString(150, y, f"{invoice_data['totalTTC']}€")
    y -= 20

    c.save()

def main():
    doc = PdfDocument()
    for i in range(5):
        data = generate_invoice_data()

        pdf_path = os.path.join(OUTPUT_DIR, f"facture_{i}.pdf")
        json_path = os.path.join(OUTPUT_DIR, f"facture_{i}.json")

        generate_pdf(data, pdf_path)
        doc.LoadFromFile(pdf_path)

        page = doc.Pages[0]
        rotation = int(page.Rotation.value)

        rotation += random.randint(0,3)
        page.Rotation = PdfPageRotateAngle(rotation)

        doc.SaveToFile(pdf_path)
        doc.Close()
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    main()