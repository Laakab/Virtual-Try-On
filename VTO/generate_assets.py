from PIL import Image, ImageDraw
import os

def create_image(path, color, shape):
    # Ensure directory exists
    os.makedirs(os.path.dirname(path), exist_ok=True)
    
    img = Image.new('RGBA', (500, 500), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    if shape == 'sunglasses':
        draw.ellipse((50, 200, 200, 300), fill='black')
        draw.ellipse((300, 200, 450, 300), fill='black')
        draw.rectangle((200, 240, 300, 260), fill='black')
    elif shape == 'hat':
        draw.polygon([(100, 300), (250, 50), (400, 300)], fill=color)
        draw.rectangle((50, 300, 450, 350), fill=color)
    elif shape == 'coat':
        draw.rectangle((100, 100, 400, 500), fill=color)
    
    img.save(path)
    print(f"Created {path}")

base_dir = os.path.join("virtual-try-on", "frontend", "assets")
create_image(os.path.join(base_dir, "sunglasses", "default.png"), "black", "sunglasses")
create_image(os.path.join(base_dir, "hats", "default.png"), "brown", "hat")
create_image(os.path.join(base_dir, "coats", "default.png"), "blue", "coat")
