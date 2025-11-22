import requests
import time

def check_backend():
    url = "http://localhost:8000/products"
    try:
        response = requests.get(url)
        if response.status_code == 200:
            print("Backend is running and returned products:")
            print(response.json())
            return True
        else:
            print(f"Backend returned status code: {response.status_code}")
            return False
    except Exception as e:
        print(f"Failed to connect to backend: {e}")
        return False

if __name__ == "__main__":
    # Retry a few times
    for i in range(5):
        if check_backend():
            break
        time.sleep(2)
