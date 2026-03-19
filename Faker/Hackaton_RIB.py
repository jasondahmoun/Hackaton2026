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

    bank_Dynamic_provider = DynamicProvider(
     provider_name="bank",
     elements=["BNP Paribas","Crédit Agricole", "Caisse d'épargne", "Crédit mutuelle"],
    )
    fake.add_provider(bank_Dynamic_provider)
    
    Siret_Dynamic_provider = DynamicProvider(
     provider_name="siret_provider",
     elements=["00032517500065","00180725400022","10038820600011","10038843800010","10038844600013","211388446000"],
    )
    fake.add_provider(Siret_Dynamic_provider)
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

    return {
        "IBAN": fake.iban(),
        "BIC":fake.swift8(),
        "ribKey":random.randint(10,999),
        "bankCode":random.randint(10000,99999),
        "agenceCode":random.randint(10000,99999),
        "accountNumber" :random.randint(10000000000,99999999999),
        "bankName": fake.bank(),
        "supplierTitulaire": fake.name(),
        "supplierName": supplierName,
        "supplierAddr": supplierAddr,
        "bankAddr": fake.address(),
    }
    

def generate_pdf(invoice_data, filename):
    c = canvas.Canvas(filename, pagesize=A4)
    width, height = A4

    y = height - 50
    c.setFont("Helvetica", 30)
    c.drawString(80, y, f"RELEVE D'IDENTITE BANCAIRE")
    y -= 80

    
    c.setFont("Helvetica", 18)

    c.drawString(30, y, invoice_data['supplierTitulaire'])

    y -= 50

    c.setFont("Helvetica", 12)

    c.drawString(30, y, invoice_data['supplierName'])
    c.drawRightString(580, y, invoice_data['supplierAddr'])
    
    y -= 30
    
    c.drawString(30, y, invoice_data['bankName'])
    c.drawRightString(580, y, invoice_data['bankAddr'])

    y -= 80

    c.setFont("Helvetica", 18)
    c.drawString(30, y, f"IBAN      {invoice_data['IBAN']}")

    y -= 80
    
    c.drawString(30, y, f"BIC      {invoice_data['BIC']}")

    y -= 80
    c.drawString(30, y, f"RIB")
    c.setFont("Helvetica", 14)
    c.drawString(104, y, f"Code Banque")
    c.drawString(254, y, f"Code Agence")
    c.drawString(390, y, f"Numéro de compte")

    y -= 30

    c.drawString(104, y, f"{invoice_data['bankCode']}")
    c.drawString(254, y, f"{invoice_data['agenceCode']}")
    c.drawString(390, y, f"{invoice_data['accountNumber']}")

    y -= 50
    c.drawString(104, y, f"Clé RIB")
    c.drawString(254, y, f"Domiciliation")
    y -= 30
    c.drawString(104, y, f"{invoice_data['ribKey']}")
    c.drawString(254, y, f"{invoice_data['bankName']}")

    



    c.save()

def main():
    doc = PdfDocument()
    for i in range(5):
        data = generate_invoice_data()

        pdf_path = os.path.join(OUTPUT_DIR, f"RIB_{i}.pdf")
        json_path = os.path.join(OUTPUT_DIR, f"RIB_{i}.json")

        generate_pdf(data, pdf_path)
        doc.LoadFromFile(pdf_path)

        page = doc.Pages[0]
        rotation = int(page.Rotation.value)

        #rotation += random.randint(0,3)
        page.Rotation = PdfPageRotateAngle(rotation)

        doc.SaveToFile(pdf_path)
        doc.Close()
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    main()