import cv2
import numpy as np
from PIL import Image

def apply_overlay(bg_img, landmarks, overlay_path, item_type):
    # Convert bg_img (OpenCV) to PIL
    bg_pil = Image.fromarray(cv2.cvtColor(bg_img, cv2.COLOR_BGR2RGB))
    
    try:
        overlay_pil = Image.open(overlay_path).convert("RGBA")
    except Exception as e:
        print(f"Error loading overlay: {e}")
        return bg_img

    # Calculate position and size based on landmarks
    # Landmarks is a list of dicts {x, y, z}
    
    if item_type == "sunglasses":
        # Eyes: Left (33), Right (263) - approximate indices for outer corners
        # Or use pupils: Left (468), Right (473)
        left_eye = landmarks[33]
        right_eye = landmarks[263]
        
        eye_width = np.sqrt((right_eye['x'] - left_eye['x'])**2 + (right_eye['y'] - left_eye['y'])**2)
        center_x = (left_eye['x'] + right_eye['x']) / 2
        center_y = (left_eye['y'] + right_eye['y']) / 2
        
        # Scale sunglasses
        scale_factor = 2.5  # Adjust as needed
        new_width = int(eye_width * scale_factor)
        aspect_ratio = overlay_pil.height / overlay_pil.width
        new_height = int(new_width * aspect_ratio)
        
        overlay_resized = overlay_pil.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        # Position
        top_left_x = int(center_x - new_width / 2)
        top_left_y = int(center_y - new_height / 2)
        
        bg_pil.paste(overlay_resized, (top_left_x, top_left_y), overlay_resized)
        
    elif item_type == "hat":
        # Forehead: 10
        forehead = landmarks[10]
        # Chin: 152 (to estimate face height)
        chin = landmarks[152]
        
        face_height = np.sqrt((chin['x'] - forehead['x'])**2 + (chin['y'] - forehead['y'])**2)
        
        # Scale hat
        scale_factor = 1.5
        new_width = int(face_height * scale_factor) # Heuristic
        aspect_ratio = overlay_pil.height / overlay_pil.width
        new_height = int(new_width * aspect_ratio)
        
        overlay_resized = overlay_pil.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        # Position - Place above forehead
        top_left_x = int(forehead['x'] - new_width / 2)
        top_left_y = int(forehead['y'] - new_height * 0.8) # Adjust to sit on head
        
        bg_pil.paste(overlay_resized, (top_left_x, top_left_y), overlay_resized)
        
    elif item_type == "coat":
        # Shoulders: 11, 12 (MediaPipe Pose) - but we only have FaceMesh here
        # FaceMesh doesn't give shoulders. We can estimate based on chin.
        chin = landmarks[152]
        left_face = landmarks[234]
        right_face = landmarks[454]
        
        face_width = np.sqrt((right_face['x'] - left_face['x'])**2 + (right_face['y'] - left_face['y'])**2)
        
        # Scale coat
        scale_factor = 4.0
        new_width = int(face_width * scale_factor)
        aspect_ratio = overlay_pil.height / overlay_pil.width
        new_height = int(new_width * aspect_ratio)
        
        overlay_resized = overlay_pil.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        # Position - Below chin
        top_left_x = int(chin['x'] - new_width / 2)
        top_left_y = int(chin['y'] + face_width * 0.5)
        
        bg_pil.paste(overlay_resized, (top_left_x, top_left_y), overlay_resized)

    return cv2.cvtColor(np.array(bg_pil), cv2.COLOR_RGB2BGR)
