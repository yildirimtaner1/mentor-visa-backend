import sys
try:
    from PIL import Image
    img = Image.open('frontend/public/screenshots/gckey-step2-choose-option.png')
    print('Mode:', img.mode)
    print('Pixel at 0,0:', img.getpixel((0,0)))
    print('Pixel at 10,10:', img.getpixel((10,10)))
except Exception as e:
    print(e)
