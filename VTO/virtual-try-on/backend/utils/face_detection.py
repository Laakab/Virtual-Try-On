import cv2
import mediapipe as mp
import numpy as np

mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(static_image_mode=True, max_num_faces=1, refine_landmarks=True, min_detection_confidence=0.5)

def detect_landmarks(image):
    # Convert to RGB
    rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    results = face_mesh.process(rgb_image)
    
    if not results.multi_face_landmarks:
        return None
    
    landmarks = results.multi_face_landmarks[0]
    h, w, _ = image.shape
    
    # Extract key points
    # MediaPipe landmarks are normalized [0, 1]
    points = []
    for lm in landmarks.landmark:
        points.append({'x': lm.x * w, 'y': lm.y * h, 'z': lm.z})
        
    return points
