from PIL import Image, ImageOps, ImageFilter
import numpy as np
import cv2


def _pil_to_cv(image: Image.Image) -> np.ndarray:
    return np.array(image)


def _cv_to_pil(image: np.ndarray) -> Image.Image:
    return Image.fromarray(image)


def _correct_orientation_with_tesseract(image: Image.Image) -> Image.Image:
    """
    Corrige les rotations 90/180/270 si pytesseract est installé.
    Si indisponible ou échec, renvoie l'image telle quelle.
    """
    try:
        import pytesseract
        osd = pytesseract.image_to_osd(image)
        angle = 0
        for line in osd.splitlines():
            if "Rotate:" in line:
                angle = int(line.split(":")[1].strip())
                break

        if angle != 0:
            # Tesseract indique l'angle à appliquer pour remettre le texte droit
            image = image.rotate(-angle, expand=True)
    except Exception:
        pass

    return image


def _deskew_image(image: Image.Image) -> Image.Image:
    """
    Corrige une légère inclinaison (ex: scan tordu de quelques degrés).
    """
    gray = np.array(image.convert("L"))

    # Inversion pour que le texte soit blanc sur fond noir
    thresh = cv2.threshold(
        gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
    )[1]

    coords = np.column_stack(np.where(thresh > 0))
    if len(coords) == 0:
        return image

    angle = cv2.minAreaRect(coords)[-1]

    # Normalisation de l'angle OpenCV
    if angle < -45:
        angle = 90 + angle
    else:
        angle = angle

    # Ignore les angles absurdes
    if abs(angle) < 0.3:
        return image

    h, w = gray.shape[:2]
    center = (w // 2, h // 2)
    matrix = cv2.getRotationMatrix2D(center, angle, 1.0)

    rotated = cv2.warpAffine(
        np.array(image),
        matrix,
        (w, h),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )

    return Image.fromarray(rotated)


def _deblur_light(image: Image.Image) -> Image.Image:
    """
    Améliore légèrement une image un peu floue avec unsharp mask.
    Ça n'efface pas un gros flou, mais aide souvent sur des scans moyens.
    """
    return image.filter(ImageFilter.UnsharpMask(radius=1.5, percent=180, threshold=3))


def preprocess_image(image: Image.Image) -> Image.Image:
    # 1) Corrige rotation 90/180/270 si OCR dispo
    image = _correct_orientation_with_tesseract(image)

    # 2) Niveaux de gris
    image = image.convert("L")

    # 3) Contraste auto
    image = ImageOps.autocontrast(image)

    # 4) Agrandissement
    image = image.resize((image.width * 2, image.height * 2), Image.Resampling.LANCZOS)

    # 5) Réduction légère du bruit
    image_cv = _pil_to_cv(image)
    image_cv = cv2.fastNlMeansDenoising(image_cv, None, h=10, templateWindowSize=7, searchWindowSize=21)
    image = _cv_to_pil(image_cv)

    # 6) Renforcement de netteté / léger défloutage
    image = _deblur_light(image)

    # 7) Correction d'inclinaison légère
    image = _deskew_image(image)

    # 8) Binarisation adaptative
    gray = np.array(image)
    binary = cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        15,
    )

    return Image.fromarray(binary)