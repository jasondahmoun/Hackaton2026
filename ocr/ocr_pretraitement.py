from PIL import Image, ImageOps, ImageFilter

def preprocess_image(image: Image.Image) -> Image.Image:
    image = image.convert("L")  # niveaux de gris
    image = ImageOps.autocontrast(image)
    image = image.resize((image.width * 2, image.height * 2))
    image = image.filter(ImageFilter.SHARPEN)

    # binarisation simple
    image = image.point(lambda x: 0 if x < 150 else 255, mode="1")

    return image